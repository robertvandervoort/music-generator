import {
  clipErrorMessage,
  countryFromMeta,
  ctaActionFromLabel,
  isDoNotTrack,
  referrerHost,
  regionFromMeta,
  resolveSampleRate,
  routeFromLocation,
  sampledIn,
  utmValue,
} from './context.ts';
import { buildTracePayload, randomHex, type OtlpSpan } from './otlp.ts';

const ENDPOINT = '/rum/trace';
const BATCH_MS = import.meta.env.DEV ? 400 : 10_000;
const MAX_BODY_BYTES = 48_000;
const MAX_JS_ERRORS = 20;

const storageKeys = {
  sampled: 'tm.rum.sampled',
  sessionId: 'tm.rum.session_id',
  traceId: 'tm.rum.trace_id',
  referrer: 'tm.rum.referrer',
  utmSource: 'tm.rum.utm_source',
  utmMedium: 'tm.rum.utm_medium',
  utmCampaign: 'tm.rum.utm_campaign',
  landing: 'tm.rum.landing_route',
} as const;

interface FetchLaterResult {
  readonly activated: boolean;
}

interface FetchLaterInit extends RequestInit {
  activateAfter?: number;
}

type FetchLaterFn = (input: RequestInfo | URL, init?: FetchLaterInit) => FetchLaterResult;

interface SessionFields {
  id: string;
  traceId: string;
  referrer: string;
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  landingRoute: string;
  country: string;
  region: string;
}

const memoryStore = new Map<string, string>();
const queue: OtlpSpan[] = [];
const lastSentVital = new Map<string, string>();
const vitalSpans = new Map<string, OtlpSpan>();

let started = false;
let route = '/';
let session: SessionFields | null = null;
let engagementSpan: OtlpSpan | null = null;
let engagementOrigin = 0;
let errorCount = 0;
let deadline = 0;
let debounceTimer: ReturnType<typeof setTimeout> | undefined;
let flushTimer: ReturnType<typeof setTimeout> | undefined;
let pending: FetchLaterResult | null = null;
let controller: AbortController | null = null;
let inflight: OtlpSpan[] = [];

function sessionGet(key: string): string | null {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return memoryStore.get(key) ?? null;
  }
}

function sessionSet(key: string, value: string): void {
  try {
    sessionStorage.setItem(key, value);
  } catch {
    memoryStore.set(key, value);
  }
}

function persistent(key: string, create: () => string): string {
  const existing = sessionGet(key);
  if (existing) return existing;
  const value = create();
  sessionSet(key, value);
  return value;
}

function sessionUuid(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return randomHex(16);
}

function trackingAllowed(): boolean {
  const windowSignal = (window as Window & { doNotTrack?: string }).doNotTrack;
  return !isDoNotTrack([navigator.doNotTrack, windowSignal]);
}

function sessionSampled(rate: number): boolean {
  const existing = sessionGet(storageKeys.sampled);
  if (existing === '1') return true;
  if (existing === '0') return false;
  const allowed = sampledIn(rate, Math.random());
  sessionSet(storageKeys.sampled, allowed ? '1' : '0');
  return allowed;
}

function metaContent(name: string): string | null {
  return document.querySelector(`meta[name="${name}"]`)?.getAttribute('content') ?? null;
}

function captureSession(landingRoute: string): SessionFields {
  const id = persistent(storageKeys.sessionId, sessionUuid);
  const traceId = persistent(storageKeys.traceId, () => randomHex(16));
  const storedReferrer = sessionGet(storageKeys.referrer);
  if (!storedReferrer) {
    const referrer = referrerHost(document.referrer, location.hostname);
    const utmSource = utmValue(location.search, 'utm_source');
    const utmMedium = utmValue(location.search, 'utm_medium');
    const utmCampaign = utmValue(location.search, 'utm_campaign');
    sessionSet(storageKeys.referrer, referrer);
    sessionSet(storageKeys.utmSource, utmSource);
    sessionSet(storageKeys.utmMedium, utmMedium);
    sessionSet(storageKeys.utmCampaign, utmCampaign);
    sessionSet(storageKeys.landing, landingRoute);
    return {
      id,
      traceId,
      referrer,
      utmSource,
      utmMedium,
      utmCampaign,
      landingRoute,
      country: countryFromMeta(metaContent('cf-country')),
      region: regionFromMeta(metaContent('cf-region')),
    };
  }
  return {
    id,
    traceId,
    referrer: storedReferrer,
    utmSource: sessionGet(storageKeys.utmSource) ?? 'none',
    utmMedium: sessionGet(storageKeys.utmMedium) ?? 'none',
    utmCampaign: sessionGet(storageKeys.utmCampaign) ?? 'none',
    landingRoute: sessionGet(storageKeys.landing) ?? landingRoute,
    country: countryFromMeta(metaContent('cf-country')),
    region: regionFromMeta(metaContent('cf-region')),
  };
}

function foregroundMillis(): number {
  const entries = performance.getEntriesByType('visibility-state');
  if (entries.length === 0) return performance.now();
  let total = 0;
  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index];
    if (!entry || entry.name !== 'visible') continue;
    const next = entries[index + 1];
    const end = next ? next.startTime : performance.now();
    total += end - entry.startTime;
  }
  return total;
}

function nowUnixNano(): string {
  return (BigInt(Math.round(performance.timeOrigin + performance.now())) * 1_000_000n).toString();
}

function commonAttributes(): Record<string, string> {
  const current = session;
  return {
    'rum.route': route,
    'rum.referrer': current?.referrer ?? 'direct',
    'rum.utm_source': current?.utmSource ?? 'none',
    'rum.utm_medium': current?.utmMedium ?? 'none',
    'rum.utm_campaign': current?.utmCampaign ?? 'none',
    'rum.landing_route': current?.landingRoute ?? route,
    'rum.country': current?.country ?? 'unknown',
    'rum.region': current?.region ?? 'unknown',
    'session.id': current?.id ?? '',
  };
}

function makeSpan(name: string, extra: Record<string, string>, statusCode?: number): OtlpSpan {
  const time = nowUnixNano();
  return {
    spanId: randomHex(8),
    name,
    startTimeUnixNano: time,
    endTimeUnixNano: time,
    attributes: { ...commonAttributes(), ...extra },
    statusCode,
  };
}

function rotateEngagement(): void {
  engagementOrigin = foregroundMillis();
  engagementSpan = null;
}

function isPendingSpan(span: OtlpSpan | null): span is OtlpSpan {
  return !!span && (queue.includes(span) || inflight.includes(span));
}

function syncEngagement(): void {
  const delta = Math.max(0, Math.round(foregroundMillis() - engagementOrigin));
  if (delta <= 0) return;
  if (!isPendingSpan(engagementSpan)) {
    engagementSpan = makeSpan('page_engagement', { 'rum.engagement_time_ms': String(delta) });
    queue.push(engagementSpan);
    return;
  }
  engagementSpan.attributes['rum.engagement_time_ms'] = String(delta);
  engagementSpan.attributes['rum.route'] = route;
  engagementSpan.endTimeUnixNano = nowUnixNano();
}

function vitalRating(name: 'LCP' | 'CLS' | 'INP', value: number): string {
  if (name === 'LCP') {
    if (value <= 2500) return 'good';
    if (value <= 4000) return 'needs-improvement';
    return 'poor';
  }
  if (name === 'INP') {
    if (value <= 200) return 'good';
    if (value <= 500) return 'needs-improvement';
    return 'poor';
  }
  if (value <= 0.1) return 'good';
  if (value <= 0.25) return 'needs-improvement';
  return 'poor';
}

function formatVital(name: 'LCP' | 'CLS' | 'INP', value: number): string {
  return name === 'CLS' ? value.toFixed(4) : Math.round(value).toString();
}

function upsertVital(name: 'LCP' | 'CLS' | 'INP', value: number): void {
  const rendered = formatVital(name, value);
  const existing = vitalSpans.get(name);
  if (existing && isPendingSpan(existing)) {
    existing.attributes['rum.vital_value'] = rendered;
    existing.attributes['rum.vital_rating'] = vitalRating(name, value);
    existing.endTimeUnixNano = nowUnixNano();
    scheduleSoon();
    return;
  }
  if (lastSentVital.get(name) === rendered) return;
  const span = makeSpan('rum.web_vital', {
    'rum.vital_name': name,
    'rum.vital_value': rendered,
    'rum.vital_rating': vitalRating(name, value),
  });
  vitalSpans.set(name, span);
  queue.push(span);
  scheduleSoon();
}

function interactionPaint(durations: number[]): number {
  if (durations.length === 0) return 0;
  const sorted = [...durations].sort((left, right) => right - left);
  const index = Math.min(sorted.length - 1, Math.floor(sorted.length / 50));
  return sorted[index] ?? 0;
}

function installFetchLater(): FetchLaterFn {
  const scope = globalThis as typeof globalThis & { fetchLater?: FetchLaterFn };
  if (typeof scope.fetchLater === 'function') return scope.fetchLater;
  const polyfill: FetchLaterFn = (input, init = {}) => {
    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
    let activated = false;
    const destroy = () => {
      document.removeEventListener('visibilitychange', sendNow);
      if (timeoutHandle !== undefined) clearTimeout(timeoutHandle);
    };
    const sendNow = () => {
      if (!(init.signal && init.signal.aborted)) {
        const method = init.method ?? 'GET';
        if ('keepalive' in Request.prototype || method !== 'POST' || init.headers) {
          void fetch(input, { ...init, keepalive: true }).catch(() => undefined);
          activated = true;
        } else {
          const body = init.body;
          activated = (typeof body === 'string' || body instanceof Blob)
            && navigator.sendBeacon(String(input), body);
        }
      }
      destroy();
    };
    if (document.visibilityState === 'hidden') {
      queueMicrotask(sendNow);
    } else {
      document.addEventListener('visibilitychange', sendNow);
      if (typeof init.activateAfter === 'number' && init.activateAfter >= 0) {
        timeoutHandle = setTimeout(sendNow, init.activateAfter);
      }
    }
    init.signal?.addEventListener('abort', destroy, { once: true });
    return {
      get activated() {
        return activated;
      },
    };
  };
  scope.fetchLater = polyfill;
  return polyfill;
}

function commitInflight(): void {
  for (const span of inflight) {
    if (span === engagementSpan) rotateEngagement();
    if (span.name === 'rum.web_vital') {
      const name = span.attributes['rum.vital_name'];
      const value = span.attributes['rum.vital_value'];
      if (name && value) lastSentVital.set(name, value);
    }
  }
  inflight = [];
  pending = null;
  controller = null;
  deadline = 0;
}

function restoreInflight(): void {
  if (controller) controller.abort();
  for (let index = inflight.length - 1; index >= 0; index -= 1) {
    const span = inflight[index];
    if (!queue.includes(span)) queue.unshift(span);
  }
  inflight = [];
  pending = null;
  controller = null;
}

function settleInflight(): void {
  if (inflight.length === 0) return;
  if (pending?.activated) commitInflight();
  else restoreInflight();
}

function scheduleNow(): void {
  if (!trackingAllowed()) {
    queue.length = 0;
    inflight = [];
    deadline = 0;
    return;
  }
  settleInflight();
  syncEngagement();
  if (queue.length === 0 || !session) {
    if (queue.length === 0) deadline = 0;
    return;
  }
  const hidden = document.visibilityState === 'hidden';
  if (deadline === 0) deadline = Date.now() + (hidden ? 0 : BATCH_MS);
  const wait = hidden ? 0 : Math.max(0, deadline - Date.now());
  let spans = queue.slice();
  let body = buildTracePayload(session.traceId, spans);
  while (body.length > MAX_BODY_BYTES && spans.length > 1) {
    spans = spans.slice(0, -1);
    body = buildTracePayload(session.traceId, spans);
  }
  inflight = spans;
  for (const span of inflight) {
    const index = queue.indexOf(span);
    if (index >= 0) queue.splice(index, 1);
  }
  controller = new AbortController();
  try {
    pending = installFetchLater()(ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body,
      credentials: 'omit',
      keepalive: true,
      signal: controller.signal,
      activateAfter: wait,
    });
  } catch {
    restoreInflight();
    return;
  }
  if (flushTimer !== undefined) clearTimeout(flushTimer);
  flushTimer = setTimeout(() => {
    flushTimer = undefined;
    if (pending?.activated) {
      commitInflight();
      if (queue.length > 0) scheduleSoon();
    }
  }, wait + 50);
  if (hidden) {
    queueMicrotask(() => {
      if (!pending?.activated) return;
      commitInflight();
      if (queue.length > 0) scheduleSoon();
    });
  }
}

function scheduleSoon(): void {
  if (document.visibilityState === 'hidden') {
    if (debounceTimer !== undefined) clearTimeout(debounceTimer);
    debounceTimer = undefined;
    scheduleNow();
    return;
  }
  if (debounceTimer !== undefined) return;
  debounceTimer = setTimeout(() => {
    debounceTimer = undefined;
    scheduleNow();
  }, 200);
}

function reportJsError(type: string, message: string): void {
  if (errorCount >= MAX_JS_ERRORS) return;
  errorCount += 1;
  queue.push(makeSpan('rum.js_error', {
    'exception.type': type.slice(0, 80) || 'Error',
    'exception.message': clipErrorMessage(message),
  }, 2));
  scheduleSoon();
}

function installErrors(): void {
  window.addEventListener('error', (event) => {
    const error = event.error as unknown;
    const type = error instanceof Error ? error.name : 'Error';
    const message = event.message || (error instanceof Error ? error.message : 'Script error');
    reportJsError(type, message);
  });
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason as unknown;
    const type = reason instanceof Error ? reason.name : 'UnhandledRejection';
    const message = reason instanceof Error ? reason.message : String(reason);
    reportJsError(type, message);
  });
}

function installVitals(): void {
  try {
    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const last = entries[entries.length - 1] as (PerformanceEntry & { renderTime?: number; loadTime?: number }) | undefined;
      if (!last) return;
      const value = last.renderTime || last.loadTime || last.startTime;
      if (value > 0) upsertVital('LCP', value);
    });
    observer.observe({ type: 'largest-contentful-paint', buffered: true });
  } catch {
    // This browser does not emit LCP entries.
  }

  try {
    let cls = 0;
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const shift = entry as PerformanceEntry & { value?: number; hadRecentInput?: boolean };
        if (shift.hadRecentInput) continue;
        cls += shift.value ?? 0;
      }
      if (cls > 0) upsertVital('CLS', cls);
    });
    observer.observe({ type: 'layout-shift', buffered: true });
  } catch {
    // This browser does not emit layout-shift entries.
  }

  try {
    const durations: number[] = [];
    const indexById = new Map<number, number>();
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const timing = entry as PerformanceEntry & { interactionId?: number; duration: number };
        const id = timing.interactionId ?? 0;
        if (!id) continue;
        const existing = indexById.get(id);
        if (existing === undefined) {
          indexById.set(id, durations.length);
          durations.push(timing.duration);
        } else {
          durations[existing] = Math.max(durations[existing] ?? 0, timing.duration);
        }
      }
      const value = interactionPaint(durations);
      if (value > 0) upsertVital('INP', value);
    });
    observer.observe({ type: 'event', buffered: true, durationThreshold: 16 } as PerformanceObserverInit);
  } catch {
    // This browser does not emit event timing entries.
  }
}

function installRouteChanges(): void {
  const emit = () => {
    const next = routeFromLocation(location.pathname, location.hash);
    if (next === route) return;
    syncEngagement();
    rotateEngagement();
    route = next;
    queue.push(makeSpan('page_view', { 'rum.navigation': 'route_change' }));
    scheduleSoon();
  };
  window.addEventListener('popstate', emit);
  window.addEventListener('hashchange', emit);
  const methods = ['pushState', 'replaceState'] as const;
  for (const method of methods) {
    const original = history[method].bind(history);
    history[method] = (...args: Parameters<History['pushState']>) => {
      original(...args);
      emit();
    };
  }
}

function installCtas(): void {
  document.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const control = target.closest('button, a');
    if (!control) return;
    const label = `${control.getAttribute('aria-label') ?? ''} ${control.textContent ?? ''}`;
    const action = ctaActionFromLabel(label);
    if (!action) return;
    queue.push(makeSpan('rum.cta_event', { 'rum.cta_name': action }));
    scheduleSoon();
  }, true);
}

function installEngagement(): void {
  const flushHidden = () => {
    if (document.visibilityState !== 'hidden') return;
    syncEngagement();
    scheduleNow();
  };
  document.addEventListener('visibilitychange', flushHidden);
  window.addEventListener('pagehide', () => {
    syncEngagement();
    scheduleNow();
  });
  window.setInterval(() => {
    if (document.visibilityState !== 'visible') return;
    if (pending?.activated) commitInflight();
    syncEngagement();
    if (queue.length > 0) scheduleSoon();
  }, 15_000);
}

function startRum(): void {
  if (!trackingAllowed()) return;
  const rate = resolveSampleRate(import.meta.env.VITE_RUM_SAMPLE_RATE);
  if (!sessionSampled(rate)) return;
  route = routeFromLocation(location.pathname, location.hash);
  session = captureSession(route);
  engagementOrigin = foregroundMillis();
  queue.push(makeSpan('page_view', { 'rum.navigation': 'load' }));
  scheduleSoon();
  installVitals();
  installErrors();
  installEngagement();
  installRouteChanges();
  installCtas();
}

export function initRum(): void {
  const flag = globalThis as typeof globalThis & { __tmRum?: boolean };
  if (started || flag.__tmRum) return;
  started = true;
  flag.__tmRum = true;
  try {
    startRum();
  } catch {
    // Telemetry must not break playback.
  }
}

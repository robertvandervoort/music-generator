const AI_REFERRER_HOSTS = [
  'chatgpt.com',
  'perplexity.ai',
  'gemini.google.com',
  'copilot.microsoft.com',
  'claude.ai',
] as const;

export const DEFAULT_RUM_TRACES_URL = 'https://vdvlabs.ai/rum/v1/traces';

export type CtaAction = 'start' | 'export' | 'generate';

export function rumTracesUrl(raw: string | undefined): string {
  const value = raw?.trim();
  return value || DEFAULT_RUM_TRACES_URL;
}

export function ctaSpanName(action: CtaAction): string {
  return `rum.cta_${action}`;
}

export function referrerHost(referrer: string, pageHostname: string): string {
  if (!referrer) return 'direct';
  try {
    const host = new URL(referrer).hostname.toLowerCase().replace(/\.$/, '');
    if (!host || host === pageHostname.toLowerCase()) return 'direct';
    for (const aiHost of AI_REFERRER_HOSTS) {
      if (host === aiHost || host.endsWith(`.${aiHost}`)) return aiHost;
    }
    return host;
  } catch {
    return 'direct';
  }
}

function withoutControls(value: string): string {
  let result = '';
  for (const char of value) {
    const code = char.charCodeAt(0);
    if (code > 31 && code !== 127) result += char;
  }
  return result;
}

function hasControlChar(value: string): boolean {
  for (const char of value) {
    const code = char.charCodeAt(0);
    if (code <= 31 || code === 127) return true;
  }
  return false;
}

export function utmValue(search: string, key: string): string {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const clean = withoutControls(params.get(key) ?? '').trim().slice(0, 80);
  return clean || 'none';
}

export function routeFromLocation(pathname: string, hash: string): string {
  const raw = hash.startsWith('#/') ? hash.slice(1) : pathname;
  const path = (raw.split('?')[0] ?? '').trim();
  if (!path) return '/';
  const withSlash = path.startsWith('/') ? path : `/${path}`;
  if (withSlash.length > 1 && withSlash.endsWith('/')) return withSlash.slice(0, -1);
  return withSlash;
}

export function countryFromMeta(content: string | null | undefined): string {
  const value = (content ?? '').trim();
  if (!/^[A-Za-z0-9]{2}$/.test(value)) return 'unknown';
  return value.toUpperCase();
}

export function regionFromMeta(content: string | null | undefined): string {
  const value = (content ?? '').trim();
  if (!value || value.startsWith('__')) return 'unknown';
  if (/[<>"'`&\\]/.test(value) || hasControlChar(value) || value.length > 80) return 'unknown';
  return value;
}

export function resolveSampleRate(raw: string | undefined): number {
  if (raw === undefined || raw.trim() === '') return 1;
  const value = Number(raw);
  if (!Number.isFinite(value)) return 1;
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}

export function sampledIn(rate: number, roll: number): boolean {
  if (rate >= 1) return true;
  if (rate <= 0) return false;
  return roll < rate;
}

export function isDoNotTrack(signals: Array<string | null | undefined>): boolean {
  return signals.some((signal) => signal === '1' || signal === 'yes');
}

export function ctaActionFromLabel(label: string): CtaAction | null {
  const text = label.trim().toLowerCase();
  if (/\bgenerate\b/.test(text)) return 'generate';
  if (/\b(?:download|export)\b/.test(text)) return 'export';
  if (/\b(?:play|start)\b/.test(text)) return 'start';
  return null;
}

export function clipErrorMessage(message: string): string {
  const collapsed = message.replace(/\s+/g, ' ').trim();
  if (collapsed.length <= 160) return collapsed || 'Unknown error';
  return `${collapsed.slice(0, 157)}...`;
}

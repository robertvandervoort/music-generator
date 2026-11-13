import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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
} from '../src/rum/context.ts';
import { buildTracePayload, RUM_SERVICE_NAME, randomHex } from '../src/rum/otlp.ts';

assert.equal(referrerHost('', 'turingmusic.vdvlabs.ai'), 'direct');
assert.equal(referrerHost('https://turingmusic.vdvlabs.ai/listen', 'turingmusic.vdvlabs.ai'), 'direct');
assert.equal(referrerHost('https://www.chatgpt.com/c/abc', 'turingmusic.vdvlabs.ai'), 'chatgpt.com');
assert.equal(referrerHost('https://claude.ai/chat', 'turingmusic.vdvlabs.ai'), 'claude.ai');
assert.equal(referrerHost('https://gemini.google.com/app', 'turingmusic.vdvlabs.ai'), 'gemini.google.com');
assert.equal(referrerHost('https://copilot.microsoft.com/', 'turingmusic.vdvlabs.ai'), 'copilot.microsoft.com');
assert.equal(referrerHost('https://www.perplexity.ai/search', 'turingmusic.vdvlabs.ai'), 'perplexity.ai');
assert.equal(referrerHost('https://news.example.com/story', 'turingmusic.vdvlabs.ai'), 'news.example.com');
assert.equal(referrerHost('not a url', 'turingmusic.vdvlabs.ai'), 'direct');

assert.equal(utmValue('', 'utm_source'), 'none');
assert.equal(utmValue('?utm_source=newsletter&utm_medium=email&utm_campaign=fall', 'utm_source'), 'newsletter');
assert.equal(utmValue('?utm_medium=email', 'utm_medium'), 'email');
assert.equal(utmValue('?utm_campaign=fall', 'utm_campaign'), 'fall');
assert.equal(utmValue(`?utm_source=${'a'.repeat(120)}`, 'utm_source').length, 80);

assert.equal(routeFromLocation('/listen/', ''), '/listen');
assert.equal(routeFromLocation('/', ''), '/');
assert.equal(routeFromLocation('/studio', '#section'), '/studio');
assert.equal(routeFromLocation('/old', '#/scores'), '/scores');

assert.equal(countryFromMeta('jp'), 'JP');
assert.equal(countryFromMeta('T1'), 'T1');
assert.equal(countryFromMeta('__CF_COUNTRY__'), 'unknown');
assert.equal(countryFromMeta(''), 'unknown');
assert.equal(countryFromMeta('<script>'), 'unknown');
assert.equal(regionFromMeta('Tokyo'), 'Tokyo');
assert.equal(regionFromMeta('__CF_REGION__'), 'unknown');
assert.equal(regionFromMeta('"><script>'), 'unknown');

assert.equal(resolveSampleRate(undefined), 1);
assert.equal(resolveSampleRate(''), 1);
assert.equal(resolveSampleRate('nope'), 1);
assert.equal(resolveSampleRate('0'), 0);
assert.equal(resolveSampleRate('0.25'), 0.25);
assert.equal(resolveSampleRate('2'), 1);
assert.equal(sampledIn(1, 0.99), true);
assert.equal(sampledIn(0, 0), false);
assert.equal(sampledIn(0.25, 0.2), true);
assert.equal(sampledIn(0.25, 0.25), false);

assert.equal(isDoNotTrack(['1']), true);
assert.equal(isDoNotTrack(['yes']), true);
assert.equal(isDoNotTrack(['0', null]), false);
assert.equal(isDoNotTrack([undefined]), false);

assert.equal(ctaActionFromLabel('START'), 'play');
assert.equal(ctaActionFromLabel('Play preview'), 'play');
assert.equal(ctaActionFromLabel('Export all'), 'download');
assert.equal(ctaActionFromLabel('Download mix'), 'download');
assert.equal(ctaActionFromLabel('Generate'), 'generate');
assert.equal(ctaActionFromLabel('Generative'), null);
assert.equal(ctaActionFromLabel('STOP'), null);
assert.equal(clipErrorMessage(`  ${'x'.repeat(200)}  `).length, 160);

const traceId = randomHex(16);
assert.equal(traceId.length, 32);
const payload = JSON.parse(buildTracePayload(traceId, [{
  spanId: randomHex(8),
  name: 'page_view',
  startTimeUnixNano: '1000',
  endTimeUnixNano: '1000',
  attributes: {
    'rum.route': '/',
    'rum.referrer': 'chatgpt.com',
    'rum.utm_source': 'newsletter',
    'rum.utm_medium': 'none',
    'rum.utm_campaign': 'none',
    'rum.landing_route': '/',
    'rum.country': 'JP',
    'rum.region': 'Tokyo',
    'session.id': 'session-1',
    'rum.navigation': 'load',
  },
}])) as {
  resourceSpans: Array<{
    resource: { attributes: Array<{ key: string; value: { stringValue: string } }> };
    scopeSpans: Array<{ spans: Array<{ name: string; attributes: Array<{ key: string; value: { stringValue: string } }> }> }>;
  }>;
};
assert.equal(payload.resourceSpans[0].resource.attributes[0].key, 'service.name');
assert.equal(payload.resourceSpans[0].resource.attributes[0].value.stringValue, RUM_SERVICE_NAME);
assert.equal(payload.resourceSpans[0].scopeSpans[0].spans[0].name, 'page_view');
const keys = payload.resourceSpans[0].scopeSpans[0].spans[0].attributes.map((item) => item.key);
for (const key of ['rum.referrer', 'rum.utm_source', 'rum.landing_route', 'rum.country', 'session.id']) {
  assert.equal(keys.includes(key), true, key);
}

const nginx = readFileSync(new URL('../nginx.conf', import.meta.url), 'utf8');
const index = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
assert.match(index, /name="cf-country" content="__CF_COUNTRY__"/);
assert.match(index, /name="cf-region" content="__CF_REGION__"/);
assert.match(nginx, /sub_filter '__CF_COUNTRY__' '\$rum_cf_country'/);
assert.match(nginx, /sub_filter '__CF_REGION__' '\$rum_cf_region'/);
assert.match(nginx, /location = \/rum\/trace/);
assert.match(nginx, /client_max_body_size 64k/);
assert.match(nginx, /proxy_pass http:\/\/\$otel_host:4318\/v1\/traces/);
assert.match(nginx, /otel-collector/);
assert.match(nginx, /"request_time":\$request_time/);
assert.match(nginx, /"referer":"\$http_referer"/);
assert.match(nginx, /"cf_country":"\$http_cf_ipcountry"/);
assert.match(nginx, /"cf_region":"\$http_cf_region"/);
assert.match(nginx, /"cf_city":"\$log_cf_city"/);
assert.match(nginx, /log_format turingmusic_json escape=json/);

console.log('rum checks passed');

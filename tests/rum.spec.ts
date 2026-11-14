import { expect, test, type Page, type Request } from '@playwright/test';
import { DEFAULT_RUM_TRACES_URL } from '../src/rum/context.ts';

interface OtlpPayload {
  resourceSpans?: Array<{
    resource?: { attributes?: Array<{ key?: string; value?: { stringValue?: string } }> };
    scopeSpans?: Array<{
      spans?: Array<{ name?: string; attributes?: Array<{ key?: string; value?: { stringValue?: string } }> }>;
    }>;
  }>;
}

function spansOf(payloads: OtlpPayload[]) {
  return payloads.flatMap((payload) =>
    (payload.resourceSpans ?? []).flatMap((resource) =>
      (resource.scopeSpans ?? []).flatMap((scope) => scope.spans ?? []),
    ),
  );
}

function attribute(span: { attributes?: Array<{ key?: string; value?: { stringValue?: string } }> }, key: string) {
  return span.attributes?.find((item) => item.key === key)?.value?.stringValue;
}

async function collectRum(page: Page) {
  const payloads: OtlpPayload[] = [];
  const posts: Request[] = [];
  page.on('request', (request: Request) => {
    if (request.method() !== 'POST' || request.url() !== DEFAULT_RUM_TRACES_URL) return;
    posts.push(request);
    const raw = request.postData();
    if (!raw) return;
    payloads.push(JSON.parse(raw) as OtlpPayload);
  });
  await page.route(DEFAULT_RUM_TRACES_URL, async (route) => {
    const request = route.request();
    if (request.method() === 'OPTIONS') {
      await route.fulfill({
        status: 204,
        headers: {
          'access-control-allow-origin': '*',
          'access-control-allow-methods': 'POST',
          'access-control-allow-headers': 'content-type',
        },
      });
      return;
    }
    expect(request.headers()['content-type']).toContain('application/json');
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: '{}',
      headers: { 'access-control-allow-origin': '*' },
    });
  });
  await page.addInitScript(() => {
    const original = Document.prototype.querySelector;
    Document.prototype.querySelector = function (selector: string) {
      const element = original.call(this, selector);
      if (selector === 'meta[name="cf-country"]' && element) element.setAttribute('content', 'JP');
      if (selector === 'meta[name="cf-region"]' && element) element.setAttribute('content', 'Tokyo');
      return element;
    };
  });
  return { payloads, posts };
}

test('rum records landing source, country, route changes, and play', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  const { payloads, posts } = await collectRum(page);
  let sameOriginTraces = 0;
  page.on('request', (request) => {
    if (new URL(request.url()).pathname === '/rum/trace') sameOriginTraces += 1;
  });
  await page.goto('/?utm_source=newsletter&utm_medium=email&utm_campaign=fall', {
    referer: 'https://www.chatgpt.com/c/landing',
  });
  await expect.poll(() => spansOf(payloads).some((span) => span.name === 'page_view'), { timeout: 4000 }).toBe(true);

  const pageView = spansOf(payloads).find((span) => span.name === 'page_view');
  expect(attribute(pageView ?? {}, 'rum.referrer')).toBe('chatgpt.com');
  expect(attribute(pageView ?? {}, 'rum.utm_source')).toBe('newsletter');
  expect(attribute(pageView ?? {}, 'rum.utm_medium')).toBe('email');
  expect(attribute(pageView ?? {}, 'rum.utm_campaign')).toBe('fall');
  expect(attribute(pageView ?? {}, 'rum.landing_route')).toBe('/');
  expect(attribute(pageView ?? {}, 'rum.route')).toBe('/');
  expect(attribute(pageView ?? {}, 'rum.country')).toBe('JP');
  expect(attribute(pageView ?? {}, 'rum.region')).toBe('Tokyo');
  expect(attribute(pageView ?? {}, 'session.id')).toMatch(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  );
  const serviceName = payloads[0]?.resourceSpans?.[0]?.resource?.attributes?.find((item) => item.key === 'service.name');
  expect(serviceName?.value?.stringValue).toBe('turingmusic-web-rum');

  await page.evaluate(() => history.pushState({}, '', '/studio'));
  await page.getByRole('button', { name: 'START' }).click();
  await expect.poll(() => spansOf(payloads).some((span) => (
    span.name === 'page_view' && attribute(span, 'rum.route') === '/studio'
  )), { timeout: 4000 }).toBe(true);
  await expect.poll(() => spansOf(payloads).some((span) => span.name === 'rum.cta_start'), { timeout: 4000 }).toBe(true);
  expect(posts.length).toBeGreaterThan(0);
  expect(sameOriginTraces).toBe(0);

  const studioView = spansOf(payloads).find((span) => (
    span.name === 'page_view' && attribute(span, 'rum.route') === '/studio'
  ));
  expect(attribute(studioView ?? {}, 'rum.landing_route')).toBe('/');
  expect(attribute(studioView ?? {}, 'rum.referrer')).toBe('chatgpt.com');
  expect(attribute(studioView ?? {}, 'rum.navigation')).toBe('route_change');
  expect(pageErrors).toEqual([]);
});

test('rum stays quiet when do not track is set', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(Navigator.prototype, 'doNotTrack', { configurable: true, get: () => '1' });
  });
  let hits = 0;
  page.on('request', (request) => {
    if (request.url() === DEFAULT_RUM_TRACES_URL || new URL(request.url()).pathname === '/rum/trace') hits += 1;
  });
  await page.goto('/');
  await page.waitForTimeout(1200);
  expect(hits).toBe(0);
});

test('export is recorded as a download action', async ({ page }) => {
  const { payloads } = await collectRum(page);
  await page.goto('/');
  await expect.poll(() => spansOf(payloads).some((span) => span.name === 'page_view'), { timeout: 4000 }).toBe(true);
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export', exact: true }).first().click();
  await downloadPromise;
  await expect.poll(() => spansOf(payloads).some((span) => span.name === 'rum.cta_export'), { timeout: 4000 }).toBe(true);
});

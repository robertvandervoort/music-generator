export const RUM_SERVICE_NAME = 'turingmusic-web-rum';

export interface OtlpSpan {
  spanId: string;
  name: string;
  startTimeUnixNano: string;
  endTimeUnixNano: string;
  attributes: Record<string, string>;
  statusCode?: number;
}

export function randomHex(bytes: number): string {
  const buffer = new Uint8Array(bytes);
  crypto.getRandomValues(buffer);
  let hex = '';
  for (const byte of buffer) hex += byte.toString(16).padStart(2, '0');
  return hex;
}

export function buildTracePayload(traceId: string, spans: OtlpSpan[]): string {
  return JSON.stringify({
    resourceSpans: [
      {
        resource: {
          attributes: [
            { key: 'service.name', value: { stringValue: RUM_SERVICE_NAME } },
          ],
        },
        scopeSpans: [
          {
            scope: { name: RUM_SERVICE_NAME, version: '1.0.0' },
            spans: spans.map((span) => ({
              traceId,
              spanId: span.spanId,
              name: span.name,
              kind: 1,
              startTimeUnixNano: span.startTimeUnixNano,
              endTimeUnixNano: span.endTimeUnixNano,
              attributes: Object.entries(span.attributes).map(([key, value]) => ({
                key,
                value: { stringValue: value },
              })),
              ...(span.statusCode ? { status: { code: span.statusCode } } : {}),
            })),
          },
        ],
      },
    ],
  });
}

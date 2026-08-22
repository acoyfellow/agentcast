export interface HarHeader {
  readonly name: string;
  readonly value: string;
}

export interface HarContent {
  readonly text?: string;
  readonly mimeType?: string;
}

export interface HarRequest {
  readonly method: string;
  readonly url: string;
  readonly headers?: readonly HarHeader[];
}

export interface HarResponse {
  readonly status: number;
  readonly headers?: readonly HarHeader[];
  readonly content?: HarContent;
}

export interface HarEntry {
  readonly request: HarRequest;
  readonly response: HarResponse;
}

export interface HarLog {
  readonly log?: {
    readonly entries?: readonly HarEntry[];
  };
}

export function loadHarEntries(har: HarLog): readonly HarEntry[] {
  return har.log?.entries ?? [];
}

export function matchHarEntry(entries: readonly HarEntry[], method: string, url: string): HarEntry | undefined {
  const requested = new URL(url);
  return entries.find((entry) => {
    if (entry.request.method.toUpperCase() !== method.toUpperCase()) return false;
    try {
      const recorded = new URL(entry.request.url);
      return recorded.origin === requested.origin && recorded.pathname === requested.pathname;
    } catch {
      return false;
    }
  });
}

export function createFetchFromHar(har: HarLog): typeof fetch {
  const entries = loadHarEntries(har);
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    const method = init?.method ?? (typeof input === 'object' && !(input instanceof URL) && 'method' in input ? input.method : 'GET') ?? 'GET';
    const entry = matchHarEntry(entries, method, url);
    if (!entry) return new Response(JSON.stringify({ error: `HAR fixture has no ${method} ${url}` }), { status: 404, headers: { 'Content-Type': 'application/json' } });
    const headers = new Headers();
    for (const header of entry.response.headers ?? []) headers.set(header.name, header.value);
    return new Response(entry.response.content?.text ?? '', {
      status: entry.response.status,
      headers,
    });
  }) as typeof fetch;
}

export function assertScrubbedHar(har: HarLog): void {
  const encoded = JSON.stringify(har);
  if (/bearer/i.test(encoded) || /token=/i.test(encoded) || /"password"\s*:\s*"[^"]+"/i.test(encoded)) {
    throw new RangeError('HAR fixture leaked a credential value');
  }
  for (const entry of loadHarEntries(har)) {
    if (entry.request.headers?.some((header) => /authorization|cookie/i.test(header.name) && header.value)) {
      throw new RangeError('HAR request still has credential headers');
    }
    if (entry.response.headers?.some((header) => /set-cookie|authorization/i.test(header.name) && header.value)) {
      throw new RangeError('HAR response still has credential headers');
    }
    const cookies = (entry as { request?: { cookies?: unknown[] }; response?: { cookies?: unknown[] } });
    if ((cookies.request?.cookies?.length ?? 0) > 0 || (cookies.response?.cookies?.length ?? 0) > 0) {
      throw new RangeError('HAR fixture still has cookies');
    }
    const url = new URL(entry.request.url);
    if (url.search) throw new RangeError('HAR request still has a query string');
    if (url.username || url.password) throw new RangeError('HAR request still has userinfo');
  }
}

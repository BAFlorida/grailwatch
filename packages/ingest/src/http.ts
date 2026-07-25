import fs from "node:fs";
import path from "node:path";
import { env } from "@grailwatch/shared/env";

export function userAgent(): string {
  const contact = env.SCRAPER_CONTACT ? ` (+${env.SCRAPER_CONTACT})` : "";
  return `GrailWatchBot/0.1${contact}`;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Per-adapter politeness throttle: returns an async gate that guarantees at
 * least minIntervalMs between the moments it resolves.
 */
export function throttled(minIntervalMs: number): () => Promise<void> {
  let last = 0;
  return async () => {
    const wait = last + minIntervalMs - Date.now();
    if (wait > 0) await sleep(wait);
    last = Date.now();
  };
}

export interface CachedFetchOptions {
  /** cache file key, e.g. "psa/123" */
  cacheKey: string;
  ttlMs: number;
  headers?: Record<string, string>;
  /** called just before a real network request (NOT on cache hits) — the
   * scrapers hang their rate-limit gate here so cached pages cost nothing */
  onNetwork?: () => Promise<void>;
}

interface CacheEntry {
  fetchedAt: number;
  url: string;
  body: string;
}

/** GET text with a simple file cache under CACHE_DIR. */
export async function fetchTextCached(url: string, opts: CachedFetchOptions): Promise<string> {
  const safeKey = opts.cacheKey.replace(/[^a-zA-Z0-9/._-]/g, "_");
  const file = path.join(env.CACHE_DIR, `${safeKey}.json`);
  try {
    const cached = JSON.parse(fs.readFileSync(file, "utf8")) as CacheEntry;
    if (Date.now() - cached.fetchedAt < opts.ttlMs) return cached.body;
  } catch {
    // cache miss or unreadable — fall through to the network
  }
  if (opts.onNetwork) await opts.onNetwork();
  const res = await fetch(url, {
    headers: { "user-agent": userAgent(), ...opts.headers },
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`GET ${url} → HTTP ${res.status}`);
  const body = await res.text();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify({ fetchedAt: Date.now(), url, body } satisfies CacheEntry));
  return body;
}

export async function fetchJson<T>(
  url: string,
  init: RequestInit & { timeoutMs?: number } = {},
): Promise<T> {
  const { timeoutMs, ...rest } = init;
  const res = await fetch(url, {
    ...rest,
    headers: { "user-agent": userAgent(), ...(rest.headers as Record<string, string> | undefined) },
    signal: AbortSignal.timeout(timeoutMs ?? 30_000),
  });
  if (!res.ok) throw new Error(`${rest.method ?? "GET"} ${url} → HTTP ${res.status}`);
  return (await res.json()) as T;
}

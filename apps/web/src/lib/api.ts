export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init);
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    // non-JSON error body — fall through with null
  }
  if (!res.ok) {
    const err = (json as { error?: { code?: string; message?: string; details?: unknown } } | null)
      ?.error;
    throw new ApiError(
      res.status,
      err?.code ?? "http_error",
      err?.message ?? `HTTP ${res.status}`,
      err?.details,
    );
  }
  return json as T;
}

export function getJson<T>(path: string): Promise<T> {
  return request<T>(path, { headers: { accept: "application/json" } });
}

export function sendJson<T>(path: string, method: "POST" | "PUT" | "DELETE", body: unknown): Promise<T> {
  return request<T>(path, {
    method,
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify(body),
  });
}

export function sendCsv<T>(path: string, csv: string): Promise<T> {
  return request<T>(path, {
    method: "POST",
    headers: { "content-type": "text/csv", accept: "application/json" },
    body: csv,
  });
}

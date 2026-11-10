/** Call one of our own API routes; throws the server's message on failure. */
export async function call<T = unknown>(url: string, method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE' = 'POST', body?: unknown): Promise<T> {
  const res = await fetch(url, { method, headers: body !== undefined ? { 'content-type': 'application/json' } : undefined, body: body !== undefined ? JSON.stringify(body) : undefined });
  const json = (await res.json().catch(() => null)) as { ok: boolean; data?: T; error?: string } | null;
  if (!res.ok || !json?.ok) throw new Error(json?.error ?? `Request failed (${res.status})`);
  return json.data as T;
}

import { NextRequest } from "next/server";

const BASE = "http://localhost:3000";

type Init = { method?: string; body?: unknown; headers?: Record<string, string>; rawBody?: string };

/** Buat NextRequest (turunan Request) untuk memanggil route handler langsung. */
export function makeRequest(path: string, init: Init = {}) {
  const { method = "GET", body, headers = {}, rawBody } = init;
  const hasBody = rawBody !== undefined || body !== undefined;
  return new NextRequest(`${BASE}${path}`, {
    method,
    headers: hasBody ? { "content-type": "application/json", ...headers } : headers,
    body: rawBody !== undefined ? rawBody : body !== undefined ? JSON.stringify(body) : undefined,
  });
}

/** Request multipart untuk route upload. */
export function makeFormRequest(path: string, form: FormData) {
  return new NextRequest(`${BASE}${path}`, { method: "POST", body: form });
}

/** Konteks route dinamis Next 16: params berupa Promise. */
export function ctx<T extends Record<string, string>>(params: T) {
  return { params: Promise.resolve(params) };
}

/** Baca status + body JSON dari Response. */
export async function readJson(res: Response) {
  const text = await res.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { status: res.status, body: body as any };
}

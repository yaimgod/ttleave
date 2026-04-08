import { NextResponse } from "next/server";

/** Log the real error server-side; return a generic message to clients. */
export function serverError(err: unknown, status = 500) {
  console.error(err);
  return NextResponse.json({ error: "An internal server error occurred" }, { status });
}

/** Parse request body as JSON. Returns a 400 response if the body is malformed. */
export async function parseJsonBody<T>(
  request: Request
): Promise<{ ok: true; data: T } | { ok: false; response: NextResponse }> {
  try {
    const data = (await request.json()) as T;
    return { ok: true, data };
  } catch {
    return {
      ok: false,
      response: NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }),
    };
  }
}

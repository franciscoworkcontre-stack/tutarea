import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Helper: fetch with manual AbortController timeout (AbortSignal.timeout doesn't
// reliably abort undici fetches on Node 24 Vercel, but AbortController does).
function fetchWithManualTimeout(
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  timeoutMs: number
): Promise<Response> {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(new Error(`fetch timeout after ${timeoutMs}ms`)), timeoutMs);
  return fetch(input, { ...init, signal: ac.signal }).finally(() => clearTimeout(timer));
}

// Minimal network diagnostic endpoint: tests raw fetch to Supabase
// without the Supabase JS client, to isolate the hang root cause.
export async function GET() {
  const url = process.env["NEXT_PUBLIC_SUPABASE_URL"];
  const key = process.env["SUPABASE_SERVICE_ROLE_KEY"];

  if (!url || !key) {
    return NextResponse.json({ error: "env vars missing", url: !!url, key: !!key }, { status: 500 });
  }

  const results: Record<string, unknown> = {
    env_url: url,
    node_version: process.version,
  };

  // Test 1: basic HTTPS fetch with 5s manual timeout
  const t1 = Date.now();
  try {
    const res = await fetchWithManualTimeout(`${url}/rest/v1/`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    }, 5000);
    results.rest_root_status = res.status;
    results.rest_root_ms = Date.now() - t1;
  } catch (e) {
    results.rest_root_error = e instanceof Error ? e.message : String(e);
    results.rest_root_ms = Date.now() - t1;
  }

  // Test 2: RPC call with 5s manual timeout + Connection: close
  const t2 = Date.now();
  try {
    const rpcRes = await fetchWithManualTimeout(`${url}/rest/v1/rpc/drizzle_query`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: key,
        Authorization: `Bearer ${key}`,
        Connection: "close",
      },
      body: JSON.stringify({ query_sql: "SELECT 1 as n", query_params: [], query_method: "all" }),
    }, 5000);
    const body = await rpcRes.text();
    results.rpc_status = rpcRes.status;
    results.rpc_body = body.slice(0, 100);
    results.rpc_ms = Date.now() - t2;
  } catch (e) {
    results.rpc_error = e instanceof Error ? e.message : String(e);
    results.rpc_ms = Date.now() - t2;
  }

  return NextResponse.json(results);
}

import { NextResponse } from "next/server";
import * as https from "node:https";

export const dynamic = "force-dynamic";

// Test node:https directly (bypasses undici/fetch which hangs on Vercel Node 24)
function httpsGet(url: string, headers: Record<string, string>): Promise<{ status: number; body: string; ms: number }> {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const req = https.request(
      { hostname: parsed.hostname, port: 443, path: parsed.pathname, method: "GET", headers: { ...headers, Connection: "close" }, timeout: 5000 },
      (res) => {
        let body = "";
        res.setEncoding("utf8");
        res.on("data", (c) => { body += c; });
        res.on("end", () => resolve({ status: res.statusCode ?? 0, body: body.slice(0, 100), ms: Date.now() - start }));
      }
    );
    req.on("timeout", () => req.destroy(new Error("timeout after 5s")));
    req.on("error", (e) => reject(Object.assign(e, { ms: Date.now() - start })));
    req.end();
  });
}

function httpsPost(url: string, headers: Record<string, string>, body: string): Promise<{ status: number; body: string; ms: number }> {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const req = https.request(
      { hostname: parsed.hostname, port: 443, path: parsed.pathname, method: "POST", headers: { ...headers, "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body), Connection: "close" }, timeout: 5000 },
      (res) => {
        let data = "";
        res.setEncoding("utf8");
        res.on("data", (c) => { data += c; });
        res.on("end", () => resolve({ status: res.statusCode ?? 0, body: data.slice(0, 100), ms: Date.now() - start }));
      }
    );
    req.on("timeout", () => req.destroy(new Error("timeout after 5s")));
    req.on("error", (e) => reject(Object.assign(e, { ms: Date.now() - start })));
    req.write(body);
    req.end();
  });
}

export async function GET() {
  const url = process.env["NEXT_PUBLIC_SUPABASE_URL"];
  const key = process.env["SUPABASE_SERVICE_ROLE_KEY"];

  if (!url || !key) {
    return NextResponse.json({ error: "env vars missing", url: !!url, key: !!key }, { status: 500 });
  }

  const results: Record<string, unknown> = { node_version: process.version };

  // Test 1: GET /rest/v1/ with node:https
  try {
    const r = await httpsGet(`${url}/rest/v1/`, { apikey: key, Authorization: `Bearer ${key}` });
    results.rest_root = { status: r.status, ms: r.ms };
  } catch (e) {
    results.rest_root = { error: e instanceof Error ? e.message : String(e) };
  }

  // Test 2: POST /rest/v1/rpc/drizzle_query with node:https
  try {
    const r = await httpsPost(
      `${url}/rest/v1/rpc/drizzle_query`,
      { apikey: key, Authorization: `Bearer ${key}` },
      JSON.stringify({ query_sql: "SELECT 1 as n", query_params: [], query_method: "all" })
    );
    results.rpc = { status: r.status, body: r.body, ms: r.ms };
  } catch (e) {
    results.rpc = { error: e instanceof Error ? e.message : String(e) };
  }

  return NextResponse.json(results);
}

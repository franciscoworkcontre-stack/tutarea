import { NextResponse } from "next/server";
import * as https from "node:https";
import * as net from "node:net";

export const dynamic = "force-dynamic";
export const maxDuration = 10;

export async function GET() {
  const url = process.env["NEXT_PUBLIC_SUPABASE_URL"] ?? "";
  const key = (process.env["SUPABASE_SERVICE_ROLE_KEY"] ?? "").trim();

  const results: Record<string, unknown> = {
    node_version: process.version,
    url_present: !!url,
    key_length: key.length,
    key_first_4: key.slice(0, 4),
    key_last_4: key.slice(-4),
  };

  const host = url.replace("https://", "");

  // Test 1: plain TCP
  const t1 = Date.now();
  try {
    await new Promise<void>((resolve, reject) => {
      const sock = net.createConnection({ host, port: 443 });
      const timer = setTimeout(() => { sock.destroy(); reject(new Error("TCP timeout")); }, 3000);
      sock.on("connect", () => { clearTimeout(timer); sock.destroy(); resolve(); });
      sock.on("error", (e) => { clearTimeout(timer); reject(e); });
    });
    results.tcp = { ok: true, ms: Date.now() - t1 };
  } catch (e) {
    results.tcp = { error: e instanceof Error ? e.message : String(e), ms: Date.now() - t1 };
  }

  // Test 2: node:https GET with sanitized key
  const t2 = Date.now();
  try {
    const response = await new Promise<{ status: number; ms: number }>((resolve, reject) => {
      const req = https.request(
        {
          hostname: host,
          port: 443,
          path: "/rest/v1/",
          method: "GET",
          headers: {
            "apikey": key,
            "Authorization": `Bearer ${key}`,
            "Connection": "close",
          },
          timeout: 6000,
        },
        (res) => {
          res.resume();
          res.on("end", () => resolve({ status: res.statusCode ?? 0, ms: Date.now() - t2 }));
        }
      );
      req.on("timeout", () => { req.destroy(new Error("HTTPS timeout 6s")); });
      req.on("error", (e) => reject(e));
      req.end();
    });
    results.https_get = response;
  } catch (e) {
    results.https_get = { error: e instanceof Error ? e.message : String(e), ms: Date.now() - t2 };
  }

  // Test 3: node:https POST to RPC
  const t3 = Date.now();
  try {
    const body = JSON.stringify({ query_sql: "SELECT 1 as n", query_params: [], query_method: "all" });
    const response = await new Promise<{ status: number; body: string; ms: number }>((resolve, reject) => {
      const req = https.request(
        {
          hostname: host,
          port: 443,
          path: "/rest/v1/rpc/drizzle_query",
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Content-Length": Buffer.byteLength(body).toString(),
            "apikey": key,
            "Authorization": `Bearer ${key}`,
            "Connection": "close",
          },
          timeout: 6000,
        },
        (res) => {
          let data = "";
          res.setEncoding("utf8");
          res.on("data", (c) => { data += c; });
          res.on("end", () => resolve({ status: res.statusCode ?? 0, body: data.slice(0, 100), ms: Date.now() - t3 }));
        }
      );
      req.on("timeout", () => { req.destroy(new Error("HTTPS RPC timeout 6s")); });
      req.on("error", (e) => reject(e));
      req.write(body);
      req.end();
    });
    results.https_rpc = response;
  } catch (e) {
    results.https_rpc = { error: e instanceof Error ? e.message : String(e), ms: Date.now() - t3 };
  }

  return NextResponse.json(results);
}

import { NextResponse } from "next/server";
import * as https from "node:https";
import * as tls from "node:tls";

export const dynamic = "force-dynamic";
export const maxDuration = 10;

function tlsConnect(host: string, port: number): Promise<{ ok: boolean; cert?: string; error?: string; ms: number }> {
  const start = Date.now();
  return new Promise((resolve) => {
    const sock = tls.connect({ host, port, servername: host, rejectUnauthorized: false }, () => {
      const cert = sock.getPeerCertificate(false);
      sock.destroy();
      const cn = cert?.subject?.CN;
      resolve({ ok: true, cert: Array.isArray(cn) ? cn[0] : (cn ?? "unknown"), ms: Date.now() - start });
    });
    const timer = setTimeout(() => {
      sock.destroy();
      resolve({ ok: false, error: "TLS timeout after 5s", ms: Date.now() - start });
    }, 5000);
    sock.on("error", (e) => {
      clearTimeout(timer);
      resolve({ ok: false, error: e.message, ms: Date.now() - start });
    });
    sock.on("secureConnect", () => clearTimeout(timer));
  });
}

function httpsGetRaw(host: string, path: string, timeoutMs = 5000): Promise<{ status: number; ms: number } | { error: string; ms: number }> {
  const start = Date.now();
  return new Promise((resolve) => {
    const req = https.request({ hostname: host, port: 443, path, method: "GET", timeout: timeoutMs, headers: { Connection: "close" } }, (res) => {
      res.resume();
      res.on("end", () => resolve({ status: res.statusCode ?? 0, ms: Date.now() - start }));
    });
    req.on("timeout", () => { req.destroy(); resolve({ error: "timeout", ms: Date.now() - start }); });
    req.on("error", (e) => resolve({ error: e.message, ms: Date.now() - start }));
    req.end();
  });
}

export async function GET() {
  const supabaseUrl = process.env["NEXT_PUBLIC_SUPABASE_URL"] ?? "";
  const supabaseHost = supabaseUrl.replace("https://", "");

  const results: Record<string, unknown> = { node_version: process.version };

  // TLS handshake to Supabase
  results.supabase_tls = await tlsConnect(supabaseHost, 443);

  // TLS handshake to a known-good external host
  results.google_tls = await tlsConnect("www.google.com", 443);

  // HTTP GET to api.telegram.org (needed for bot)
  results.telegram_https = await httpsGetRaw("api.telegram.org", "/", 5000);

  // HTTP GET to Supabase REST root
  results.supabase_https = await httpsGetRaw(supabaseHost, "/rest/v1/", 5000);

  return NextResponse.json(results);
}

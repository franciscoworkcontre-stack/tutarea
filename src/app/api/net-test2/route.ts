import { NextResponse } from "next/server";
import { setTimeout as sleep } from "timers/promises";

export const dynamic = "force-dynamic";
// Allow up to 10 seconds for this diagnostic route
export const maxDuration = 10;

// Test 2: verify AbortSignal.timeout actually works, and test DNS resolution
export async function GET() {
  const results: Record<string, unknown> = {
    node_version: process.version,
    time: new Date().toISOString(),
  };

  // Test A: AbortSignal.timeout actually aborts quickly
  const tA = Date.now();
  try {
    // Fetch a URL that will definitely hang (httpbin.org with delay)
    await fetch("https://httpbin.org/delay/30", {
      signal: AbortSignal.timeout(1000),
    });
    results.abort_test = "no abort (BROKEN)";
  } catch (e) {
    results.abort_test = e instanceof Error ? e.name + ": " + e.message : String(e);
    results.abort_ms = Date.now() - tA;
  }

  // Test B: DNS lookup for Supabase host
  const tB = Date.now();
  try {
    const { dns } = await import("node:dns/promises");
    const addrs = await Promise.race([
      dns.resolve4("oxkrcwdqplelntxrelcw.supabase.co"),
      sleep(3000).then(() => { throw new Error("DNS timeout after 3s"); }),
    ]);
    results.dns_addrs = addrs;
    results.dns_ms = Date.now() - tB;
  } catch (e) {
    results.dns_error = e instanceof Error ? e.message : String(e);
    results.dns_ms = Date.now() - tB;
  }

  // Test C: raw TCP connect to Supabase port 443
  const tC = Date.now();
  try {
    const net = await import("node:net");
    await new Promise<void>((resolve, reject) => {
      const sock = net.createConnection({ host: "oxkrcwdqplelntxrelcw.supabase.co", port: 443 });
      const timer = setTimeout(() => { sock.destroy(); reject(new Error("TCP timeout after 3s")); }, 3000);
      sock.on("connect", () => { clearTimeout(timer); sock.destroy(); resolve(); });
      sock.on("error", (e) => { clearTimeout(timer); reject(e); });
    });
    results.tcp_connect = "ok";
    results.tcp_ms = Date.now() - tC;
  } catch (e) {
    results.tcp_error = e instanceof Error ? e.message : String(e);
    results.tcp_ms = Date.now() - tC;
  }

  return NextResponse.json(results);
}

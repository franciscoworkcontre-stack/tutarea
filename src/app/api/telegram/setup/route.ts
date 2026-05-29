import { NextResponse } from "next/server";
import * as https from "node:https";

export const dynamic = "force-dynamic";
export const maxDuration = 15;

const APP_URL = process.env["NEXT_PUBLIC_APP_URL"]?.trim() ?? "https://tutarea-tusalarioio.vercel.app";

// Use node:https to avoid undici/fetch hang on Vercel Node 24
function telegramGet(token: string, method: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: "api.telegram.org",
        port: 443,
        path: `/bot${token}/${method}`,
        method: "GET",
        headers: { Connection: "close" },
        timeout: 10000,
      },
      (res) => {
        let data = "";
        res.setEncoding("utf8");
        res.on("data", (c) => { data += c; });
        res.on("end", () => { try { resolve(JSON.parse(data)); } catch { resolve(data); } });
      }
    );
    req.on("timeout", () => req.destroy(new Error(`Telegram ${method} timeout`)));
    req.on("error", reject);
    req.end();
  });
}

function telegramPost(token: string, method: string, body: Record<string, unknown>): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const req = https.request(
      {
        hostname: "api.telegram.org",
        port: 443,
        path: `/bot${token}/${method}`,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(payload),
          Connection: "close",
        },
        timeout: 10000,
      },
      (res) => {
        let data = "";
        res.setEncoding("utf8");
        res.on("data", (c) => { data += c; });
        res.on("end", () => { try { resolve(JSON.parse(data)); } catch { resolve(data); } });
      }
    );
    req.on("timeout", () => req.destroy(new Error(`Telegram ${method} timeout`)));
    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

export async function GET() {
  console.log("[setup] start");
  const BOT_TOKEN = process.env["TELEGRAM_BOT_TOKEN"]?.trim();
  if (!BOT_TOKEN) {
    return NextResponse.json({ error: "TELEGRAM_BOT_TOKEN not set" }, { status: 500 });
  }

  const webhookUrl = `${APP_URL}/api/telegram/webhook`;
  console.log("[setup] webhookUrl:", webhookUrl, "token_len:", BOT_TOKEN.length);

  let info: { ok: boolean; result?: { url: string; last_error_message?: string; pending_update_count?: number } };
  let setResult: unknown;
  try {
    [info, setResult] = await Promise.all([
      telegramGet(BOT_TOKEN, "getWebhookInfo") as Promise<{ ok: boolean; result?: { url: string; last_error_message?: string; pending_update_count?: number } }>,
      telegramPost(BOT_TOKEN, "setWebhook", { url: webhookUrl, drop_pending_updates: true }),
    ]);
    console.log("[setup] done");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[setup] error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  return NextResponse.json({
    previous_webhook: info.result?.url ?? "(none)",
    last_error: info.result?.last_error_message ?? null,
    pending_updates_dropped: info.result?.pending_update_count ?? 0,
    new_webhook: webhookUrl,
    set_result: setResult,
  });
}

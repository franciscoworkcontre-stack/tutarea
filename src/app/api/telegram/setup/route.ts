import { NextResponse } from "next/server";

const APP_URL = process.env["NEXT_PUBLIC_APP_URL"] ?? "https://tutarea-tusalarioio.vercel.app";
const BOT_TOKEN = process.env["TELEGRAM_BOT_TOKEN"];

export async function GET() {
  if (!BOT_TOKEN) {
    return NextResponse.json({ error: "TELEGRAM_BOT_TOKEN not set" }, { status: 500 });
  }

  const webhookUrl = `${APP_URL}/api/telegram/webhook`;

  // Get current webhook info
  const infoRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo`);
  const info = await infoRes.json() as { ok: boolean; result?: { url: string; last_error_message?: string; pending_update_count?: number } };

  // Set webhook to correct URL
  const setRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setWebhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url: webhookUrl, drop_pending_updates: true }),
  });
  const setResult = await setRes.json();

  return NextResponse.json({
    previous_webhook: info.result?.url ?? "(none)",
    last_error: info.result?.last_error_message ?? null,
    pending_updates_dropped: info.result?.pending_update_count ?? 0,
    new_webhook: webhookUrl,
    set_result: setResult,
  });
}

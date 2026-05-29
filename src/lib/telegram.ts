import * as https from "node:https";

// Use node:https instead of fetch/undici to avoid the Node 24 + Vercel
// bug where undici fetch hangs indefinitely for external HTTPS requests.
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
        res.on("data", (chunk) => { data += chunk; });
        res.on("end", () => {
          try { resolve(JSON.parse(data)); } catch { resolve(data); }
        });
      }
    );
    req.on("timeout", () => req.destroy(new Error(`Telegram API ${method} timeout`)));
    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

export async function sendTelegramMessage(chatId: number, text: string, replyMarkup?: unknown) {
  const token = process.env["TELEGRAM_BOT_TOKEN"]?.trim();
  if (!token) return;

  await telegramPost(token, "sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "Markdown",
    ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
  });
}

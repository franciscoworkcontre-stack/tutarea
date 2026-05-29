import * as https from "node:https";

// Use node:https instead of fetch/undici to avoid the Node 24 + Vercel
// bug where undici fetch hangs indefinitely for external HTTPS requests.
function httpsGet(url: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const req = https.request(
      {
        hostname: parsed.hostname,
        port: 443,
        path: parsed.pathname + parsed.search,
        method: "GET",
        headers: { Connection: "close" },
        timeout: 15000,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (c: Buffer) => chunks.push(c));
        res.on("end", () => resolve(Buffer.concat(chunks)));
      }
    );
    req.on("timeout", () => req.destroy(new Error("HTTPS GET timeout")));
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

export async function getTelegramFileUrl(fileId: string): Promise<string> {
  const token = process.env["TELEGRAM_BOT_TOKEN"]?.trim();
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN not set");
  const buf = await httpsGet(`https://api.telegram.org/bot${token}/getFile?file_id=${fileId}`);
  const data = JSON.parse(buf.toString()) as { ok: boolean; result?: { file_path: string } };
  if (!data.ok || !data.result?.file_path) throw new Error("Could not get file path");
  return `https://api.telegram.org/file/bot${token}/${data.result.file_path}`;
}

export async function downloadTelegramFile(fileUrl: string): Promise<Buffer> {
  return httpsGet(fileUrl);
}

export async function answerCallbackQuery(callbackQueryId: string) {
  const token = process.env["TELEGRAM_BOT_TOKEN"]?.trim();
  if (!token) return;
  await telegramPost(token, "answerCallbackQuery", { callback_query_id: callbackQueryId });
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

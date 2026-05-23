import { createHmac } from "crypto";

const TTL_MS = 15 * 60 * 1000; // 15 minutes

function secret(): string {
  return process.env["TELEGRAM_WEBHOOK_SECRET"] ?? "dev_secret";
}

export function generateTelegramLinkToken(chatId: number): string {
  const expiresAt = Date.now() + TTL_MS;
  const payload = `${chatId}:${expiresAt}`;
  const hmac = createHmac("sha256", secret()).update(payload).digest("hex").slice(0, 16);
  return Buffer.from(`${payload}:${hmac}`).toString("base64url");
}

export function verifyTelegramLinkToken(token: string): { chatId: number } | null {
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf8");
    const parts = decoded.split(":");
    if (parts.length !== 3) return null;
    const chatIdStr = parts[0]!;
    const expiresAtStr = parts[1]!;
    const hmac = parts[2]!;
    const payload = `${chatIdStr}:${expiresAtStr}`;
    const expected = createHmac("sha256", secret()).update(payload).digest("hex").slice(0, 16);
    if (hmac !== expected) return null;
    if (Date.now() > parseInt(expiresAtStr, 10)) return null;
    return { chatId: parseInt(chatIdStr, 10) };
  } catch {
    return null;
  }
}

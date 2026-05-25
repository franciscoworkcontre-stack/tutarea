export async function sendTelegramMessage(chatId: number, text: string, replyMarkup?: unknown) {
  const token = process.env["TELEGRAM_BOT_TOKEN"];
  if (!token) return;

  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "Markdown",
      reply_markup: replyMarkup,
    }),
  });
}

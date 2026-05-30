import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { profiles } from "@/db/schema";
import { eq } from "drizzle-orm";
import { verifyTelegramLinkToken } from "@/lib/telegram-token";

async function notifyTelegram(chatId: number, name: string) {
  const token = process.env["TELEGRAM_BOT_TOKEN"];
  if (!token) return;
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: `✅ ¡Cuenta vinculada, *${name}*!\n\nAhora puedes enviarme texto o un 🎙 audio y crearé tareas en tu workspace automáticamente.\n\nEscribe /help para ver los comandos disponibles.`,
      parse_mode: "Markdown",
    }),
  });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const { token } = (await request.json()) as { token: string };
  if (!token) {
    return NextResponse.json({ error: "Token requerido" }, { status: 400 });
  }

  const payload = verifyTelegramLinkToken(token);
  if (!payload) {
    return NextResponse.json(
      { error: "Token inválido o expirado. Escríbele al bot de nuevo para obtener un link nuevo." },
      { status: 400 }
    );
  }

  const { chatId } = payload;

  // Check if this chat_id is already linked to another account
  const [existing] = await db.select().from(profiles).where(eq(profiles.telegramChatId, chatId.toString())).limit(1);
  if (existing && existing.id !== user.id) {
    return NextResponse.json(
      { error: "Este chat de Telegram ya está vinculado a otra cuenta." },
      { status: 409 }
    );
  }

  // Link the account
  await db.update(profiles)
    .set({
      telegramChatId: chatId.toString(),
      telegramLinkedAt: new Date(),
      telegramLinkCode: null,
      telegramLinkCodeExpiresAt: null,
      updatedAt: new Date(),
    })
    .where(eq(profiles.id, user.id));

  const [profile] = await db.select().from(profiles).where(eq(profiles.id, user.id)).limit(1);

  await notifyTelegram(chatId, profile?.fullName ?? user.email ?? "usuario");

  return NextResponse.json({ ok: true });
}

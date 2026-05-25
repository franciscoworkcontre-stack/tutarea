import { NextResponse } from "next/server";
import { registerBotCommands } from "@/lib/telegram-commands";

export async function POST() {
  try {
    const result = await registerBotCommands();
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

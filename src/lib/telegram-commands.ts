const BOT_TOKEN = process.env["TELEGRAM_BOT_TOKEN"];

export async function registerBotCommands() {
  if (!BOT_TOKEN) throw new Error("TELEGRAM_BOT_TOKEN not set");

  const commands = [
    { command: "tarea", description: "Crear una tarea — /tarea Revisar propuesta de diseño" },
    { command: "urgente", description: "Crear tarea urgente — /urgente Fix bug en login" },
    { command: "mis_tareas", description: "Ver tus 5 tareas activas más urgentes" },
    { command: "hoy", description: "Resumen del día: tareas pendientes de hoy" },
    { command: "vencidas", description: "Ver tareas vencidas sin completar" },
    { command: "proyectos", description: "Listar proyectos activos del workspace" },
    { command: "nota", description: "Guardar nota rápida — /nota Recordar llamar a cliente X" },
    { command: "help", description: "Ver todos los comandos disponibles" },
  ];

  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setMyCommands`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ commands }),
  });

  const data = await res.json() as { ok: boolean; description?: string };
  if (!data.ok) throw new Error(`setMyCommands failed: ${data.description}`);
  return data;
}

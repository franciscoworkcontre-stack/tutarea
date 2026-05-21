import { motion } from "framer-motion";

export default function NotificationsPage() {
  return (
    <div className="max-w-2xl mx-auto px-6 py-8">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
      >
        <h1 className="text-2xl font-semibold tracking-tighter mb-1">Notificaciones</h1>
        <p className="text-text-muted text-sm mb-8">
          Configura cuándo y cómo te avisamos.
        </p>

        <div className="space-y-4">
          {notificationSettings.map((setting) => (
            <div
              key={setting.id}
              className="flex items-center justify-between p-4 rounded-xl border border-border bg-surface"
            >
              <div>
                <p className="font-medium text-sm">{setting.label}</p>
                <p className="text-xs text-text-muted">{setting.desc}</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  defaultChecked={setting.default}
                />
                <div className="w-10 h-6 bg-surface-2 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent border border-border" />
              </label>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}

const notificationSettings = [
  {
    id: "assigned",
    label: "Tarea asignada",
    desc: "Cuando alguien te asigna una tarea",
    default: true,
  },
  {
    id: "mention",
    label: "Mención en comentario",
    desc: "Cuando te @mencionan en un comentario",
    default: true,
  },
  {
    id: "due-today",
    label: "Tarea vence hoy",
    desc: "Recordatorio a las 8am de tu zona horaria",
    default: true,
  },
  {
    id: "overdue",
    label: "Tarea vencida",
    desc: "Cuando una tarea tuya está atrasada",
    default: false,
  },
  {
    id: "status-change",
    label: "Cambio de estado",
    desc: "En tareas que sigues",
    default: false,
  },
  {
    id: "telegram",
    label: "Notificaciones por Telegram",
    desc: "Recibe alertas en tu bot de Telegram",
    default: false,
  },
];

# Deploy tutarea en 5 minutos

## Opción A — Vercel Web UI (más rápido)

1. Ir a **https://vercel.com/new**
2. Click **"Import Git Repository"**
3. Conectar GitHub y seleccionar `franciscoworkcontre-stack/tutarea`
4. En "Environment Variables", agregar todas las vars del `.env.example`
5. Click **Deploy** ✅

---

## Opción B — Vercel CLI

```bash
cd /private/tmp/tutarea
vercel login
vercel --prod
```

---

## Variables de entorno requeridas

Todas están en `.env.example`. Las mínimas para que funcione:

```
NEXT_PUBLIC_SUPABASE_URL=       # Supabase → Settings → API
NEXT_PUBLIC_SUPABASE_ANON_KEY=  # Supabase → Settings → API
SUPABASE_SERVICE_ROLE_KEY=      # Supabase → Settings → API
DATABASE_URL=                    # postgresql://postgres:[pass]@[host]:5432/postgres
NEXT_PUBLIC_APP_URL=            # https://tu-app.vercel.app
ANTHROPIC_API_KEY=              # https://console.anthropic.com
```

Opcionales para Telegram:
```
TELEGRAM_BOT_TOKEN=             # @BotFather en Telegram
TELEGRAM_WEBHOOK_SECRET=        # Cualquier string seguro
TELEGRAM_BOT_USERNAME=          # Username del bot
OPENAI_API_KEY=                 # Para Whisper (transcripción de voz)
```

---

## Base de datos (Supabase)

1. Crear proyecto en **https://supabase.com**
2. Ir a SQL Editor y ejecutar `src/db/migrations/0001_initial.sql`
3. Ejecutar `src/db/policies.sql` para activar Row Level Security
4. Copiar la URL y keys en las env vars

---

## Código en GitHub

https://github.com/franciscoworkcontre-stack/tutarea

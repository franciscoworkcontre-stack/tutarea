# Deploy tutarea

## Estado actual ✅

| Componente | Estado |
|-----------|--------|
| Código en GitHub | ✅ `franciscoworkcontre-stack/tutarea` |
| Supabase (proyecto) | ✅ `pljqzabbetilkrsjqhgt` — East US |
| Migraciones aplicadas | ✅ schema + RLS policies |
| Variables de entorno | ✅ listas en `.env.local` (no se commitean) |

## Variables de entorno (ya configuradas)

```
NEXT_PUBLIC_SUPABASE_URL=https://pljqzabbetilkrsjqhgt.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...WJJhi2jmE_WjW8GOXF9SXeqAefRRIHe1UIpx9ZBwNFk
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...rGllYNxR1xWYUMp0bTr7GlFuSFrCqgfuZCTftgbd0Ek
DATABASE_URL=postgresql://postgres.pljqzabbetilkrsjqhgt:TutareaDB2024!@aws-0-us-east-1.pooler.supabase.com:5432/postgres
ANTHROPIC_API_KEY=<tu clave de https://console.anthropic.com>
NEXT_PUBLIC_APP_URL=https://tutarea.vercel.app  # cambiar tras deploy
```

Opcionales para Telegram:
```
TELEGRAM_BOT_TOKEN=
TELEGRAM_WEBHOOK_SECRET=tutarea_webhook_secret_2024
OPENAI_API_KEY=
```

---

## Opción A — Vercel Web UI (recomendado, 3 pasos)

1. Ir a **https://vercel.com/new**
2. **Import Git Repository** → conectar GitHub → seleccionar `franciscoworkcontre-stack/tutarea`
3. En **Environment Variables**, copiar las vars de arriba → **Deploy** ✅

Vercel detecta Next.js automáticamente. No se necesita configuración adicional.

---

## Opción B — CLI desde tu terminal (NO desde Claude Code)

El plugin de Vercel en Claude Code intercepta los comandos. Ejecutar desde terminal propio:

```bash
cd /private/tmp/tutarea

# Login (una sola vez)
vercel login

# Deploy
vercel --yes --name tutarea \
  -e NEXT_PUBLIC_SUPABASE_URL="https://pljqzabbetilkrsjqhgt.supabase.co" \
  -e NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsanF6YWJiZXRpbGtyc2pxaGd0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkzOTYwMzgsImV4cCI6MjA5NDk3MjAzOH0.WJJhi2jmE_WjW8GOXF9SXeqAefRRIHe1UIpx9ZBwNFk" \
  -e SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsanF6YWJiZXRpbGtyc2pxaGd0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTM5NjAzOCwiZXhwIjoyMDk0OTcyMDM4fQ.rGllYNxR1xWYUMp0bTr7GlFuSFrCqgfuZCTftgbd0Ek" \
  -e DATABASE_URL="postgresql://postgres.pljqzabbetilkrsjqhgt:TutareaDB2024!@aws-0-us-east-1.pooler.supabase.com:5432/postgres" \
  -e ANTHROPIC_API_KEY="<tu-clave>" \
  -e NEXT_PUBLIC_APP_URL="https://tutarea.vercel.app"
```

---

## Opción C — GitHub Actions (CI/CD automático)

El workflow `.github/workflows/deploy.yml` ya está configurado. Solo necesitas agregar 3 secrets en GitHub:

1. Ir a `https://github.com/franciscoworkcontre-stack/tutarea/settings/secrets/actions`
2. Agregar:
   - `VERCEL_TOKEN` → obtener en https://vercel.com/account/tokens
   - `VERCEL_ORG_ID` → desde `.vercel/project.json` tras hacer el primer deploy manual
   - `VERCEL_PROJECT_ID` → desde `.vercel/project.json` tras hacer el primer deploy manual

---

## Tras el deploy

1. Actualizar `NEXT_PUBLIC_APP_URL` con la URL real de Vercel
2. Si usas Telegram: configurar el webhook en la ruta `/api/telegram/webhook`
3. En Supabase → Authentication → URL Configuration: agregar la URL de Vercel como "Site URL"

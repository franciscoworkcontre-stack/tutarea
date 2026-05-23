## Deploy Configuration (configured by /setup-deploy)
- Platform: Vercel
- Production URL: https://tutarea.vercel.app (update after first deploy)
- Deploy workflow: auto-deploy on push to main (or manual: `vercel --prod` from terminal)
- Deploy status command: HTTP health check
- Merge method: squash
- Project type: web app (Next.js 15 App Router)
- Post-deploy health check: https://tutarea.vercel.app

### Custom deploy hooks
- Pre-merge: none
- Deploy trigger: push to main OR `vercel --prod` (run from terminal, NOT from Claude Code — Vercel plugin intercepts CLI)
- Deploy status: poll production URL
- Health check: https://tutarea.vercel.app

### Supabase project
- Project ref: pljqzabbetilkrsjqhgt
- URL: https://pljqzabbetilkrsjqhgt.supabase.co
- Region: East US (North Virginia)

### Known quirks
- The `vercel@claude-plugins-official` Claude Code plugin intercepts all `vercel` CLI commands and injects an expired token. Always run `vercel` from a separate terminal, not from inside Claude Code sessions.

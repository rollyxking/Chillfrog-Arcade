# Chillfrog Arcade
1. Create a NEW Supabase project; run `supabase/schema.sql` in the SQL editor.
2. Create a Telegram bot via @BotFather; run `/setdomain` with your Vercel domain (required for Login Widget).
3. Copy `.env.example` values into Vercel Environment Variables (server secrets must NOT be VITE_ prefixed).
4. `npm install && npx vercel dev` locally (Telegram widget only works on the registered domain), `vercel --prod` to deploy.
Security: all writes go through /api/* with the service-role key; anon clients are read-only via RLS.

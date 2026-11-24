# Deploying FindIt Campus

This covers running the app in production. It does not point at a live
URL — hosting it means creating an account on a provider and configuring
it yourself; what's here is the exact build/run setup and the things that
matter for *this* app specifically (SQLite file + uploaded images need a
persistent disk, not ephemeral container storage).

## How production serving works

In development, two processes run: Vite's dev server (frontend, port 5173)
and Express (API, port 4000), with Vite proxying `/api` and `/uploads` to
Express (see `client/vite.config.js`).

In production, there's one process. `server/src/index.js` checks
`NODE_ENV=production` and, if set, serves the built `client/dist` as
static files from the same Express app, falling back to `index.html` for
any non-API, non-upload path so React Router's client-side routes work on
a hard refresh or a direct link. The frontend already calls `/api/...`
with a relative path, so this needs zero frontend config change between
dev and prod.

## Build and run

```bash
# 1. Build the frontend
cd client
npm install
npm run build          # outputs client/dist

# 2. Set up and run the backend
cd ../server
npm install
cp .env.example .env   # fill in real values, see below
npx prisma migrate deploy   # applies migrations without the interactive dev prompts
NODE_ENV=production npm start
```

The whole app is now on whatever `PORT` you configured (default 4000) —
one URL serves both the UI and the API.

## Environment variables that matter in production

| Variable | Notes |
|---|---|
| `DATABASE_URL` | `file:./dev.db` works, but **put it on a persistent volume** — see below |
| `JWT_SECRET` | Generate a real random value: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`. Don't reuse the example value. |
| `PORT` | Whatever your host expects (often injected automatically, e.g. `process.env.PORT` on Render/Railway) |
| `ADMIN_EMAILS` | Comma-separated emails that get admin access automatically — set this to your actual campus staff emails |
| `NODE_ENV` | Must be `production` for Express to serve the built frontend |

## The two things that will bite you if you skip them

1. **SQLite file and `server/uploads/` must be on persistent storage.**
   Most container platforms (Render, Railway, Fly.io, Heroku-style dynos)
   wipe the filesystem on every redeploy unless you explicitly attach a
   persistent disk/volume and point `DATABASE_URL` and the uploads path at
   it. If you skip this, every deploy silently resets to an empty
   database and loses every uploaded photo. For a class project demo this
   is often fine to ignore; for anything meant to stay up, it isn't.

2. **Run `prisma migrate deploy`, not `migrate dev`, in production.**
   `migrate dev` is interactive and will prompt about resets — it's a dev
   tool. `migrate deploy` just applies pending migrations non-interactively,
   which is what you want in a deploy script / CI step.

## Suggested free-tier path for a student project

A single small VM or a platform with a persistent disk option (e.g.
Render's paid disk add-on, or a basic always-on VPS) is the simplest fit,
since this app is one Node process plus a SQLite file plus a folder of
images — no separate database server or object storage service required.
If you outgrow SQLite (concurrent writes from many users), the schema is
plain Prisma models, so swapping `provider = "sqlite"` for `"postgresql"`
in `server/prisma/schema.prisma` and pointing `DATABASE_URL` at a real
Postgres instance is a config change, not a rewrite — Prisma's query API
doesn't change.

## Smoke test after deploying

1. `curl https://your-domain/api/health` → `{"ok":true}`
2. Load the site in a browser, sign up, post a found item
3. Confirm the uploaded photo actually renders (this is the step that
   fails first if storage isn't persistent/configured right)

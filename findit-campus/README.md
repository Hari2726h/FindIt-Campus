# FindIt Campus

Smart lost-and-found board for campus. All 8 weeks of the build plan are
implemented: schema/wireframes, auth/CRUD, search/filter, matching,
claim+verification, chat, moderation/trust, and polish/deploy prep.

See [WIREFRAMES.md](./WIREFRAMES.md) for screen layouts, [WRITEUP.md](./WRITEUP.md)
for the full design write-up, [DEMO_SCRIPT.md](./DEMO_SCRIPT.md) for a
guided walkthrough, and [DEPLOY.md](./DEPLOY.md) for production setup.

## Stack

- `server/` — Node.js, Express, Prisma ORM, SQLite (file-based, zero config)
- `client/` — React (Vite), plain CSS, react-router-dom

## What's implemented

- Full data model in `server/prisma/schema.prisma`: users (with
  `trustScore`, `isAdmin`), posts, images, verification challenge, claims,
  claim attempts, conversations, messages, reports.
- Signup / login with JWT, bcrypt password hashing, rate-limited
  (10 attempts / 15 min / IP).
- Create / list / view / edit / delete lost and found posts, with multiple
  image upload per post. A basic profanity filter rejects abusive titles,
  descriptions, and chat messages.
- Board filters: type, category (dropdown, shared constant with the post
  form so values always match exactly), debounced search/location, date
  range, sort, clear-filters button.
- **Matching engine v1** (`server/src/utils/matching.js`): pure rule-based
  scorer (category, date proximity, location, description similarity via
  Jaccard index), computed live — no persisted match table, no external
  services. Shown as "Possible matches" on a post's detail page, owner
  only.
- **Claim + verification flow.** A found post collects a hidden question +
  secret answer; the secret answer is only ever returned to that post's
  own owner, never publicly. Anyone else can submit an answer attempt,
  capped at `maxAttempts` (default 3). The finder reviews every attempt
  next to their own secret answer and explicitly confirms or rejects —
  no automatic string match, since free-text answers vary too much for
  that to be reliable. Confirming one claim auto-rejects every other
  pending claim and flips the post to `CLAIMED`.
- **In-app chat.** Confirming a claim opens a conversation; the chat page
  polls every 4 seconds — no WebSocket dependency.
- **Inbox + notifications.** Every claim the current user is involved in
  (as claimant or finder), plus a summary used for the nav bar's badge
  (pending reviews + unread messages), polled every 15s. Unread counts use
  two nullable `lastReadAt` timestamps on `Claim` — no separate
  notifications table.
- **Admin dashboard + reports + trust score.** Anyone can report a post or
  a user (one open report per reporter/target at a time, rate-limited to
  10/hour/IP). Users whose email is listed in `ADMIN_EMAILS` get an
  `/admin` dashboard: stats tiles, a report queue with resolve/dismiss,
  and the ability to delete a reported post directly. Confirming a claim
  gives the finder +2 trust and the claimant +1; resolving a report as
  valid docks the target's trust by 3 (post) or 5 (user). Trust score is
  shown next to a post's "Posted by" line.
- **Polish**: a catch-all 404 page, a top-level error boundary so a render
  bug shows a recoverable message instead of a blank screen, and
  responsive nav/filter layout under 640px.
- **Production serving**: Express serves the built `client/dist` directly
  when `NODE_ENV=production`, so a single process handles both the API
  and the frontend — see [DEPLOY.md](./DEPLOY.md).
- **Mark as resolved.** Owners can close out any post that isn't already
  resolved — a found post once it's been handed over (status moves
  `CLAIMED → RESOLVED`), or a lost post the owner got back some other way
  (`OPEN → RESOLVED`). This is the only state transition the generic
  `PUT /api/posts/:id` endpoint allows via `status`; owners can't directly
  set `OPEN` or `CLAIMED` through it (that invariant is enforced server-side,
  not just hidden in the UI) since confirming a claim is the only legitimate
  way a post becomes `CLAIMED`. Deleting a post is blocked while it's
  `CLAIMED`, so an owner can't destroy the other party's confirmed claim and
  chat by mistake — resolve it first.

## Audited for correctness (see git history / conversation for the full list)

Before calling this done, every backend file was run through independent
adversarial review (not just the person who wrote it re-reading their own
code) looking specifically for race conditions, crash paths, and
authorization gaps — the kind of bugs that don't show up until a real user
hits them, which matters here since this app has never actually been run
(the dev environment had no outbound network access to install
dependencies). Fixes that came out of that pass:

- **Every route handler is wrapped in `wrapAsync`** (`server/src/utils/wrapAsync.js`).
  Express 4 does not forward a rejected promise from an async handler to
  error-handling middleware, so an uncaught error anywhere — not a specific
  bug, any Prisma error from bad input — used to crash the entire process
  for every user. This was the most serious finding.
- **Every `:id`/`:claimId` route param is validated** (`server/src/utils/validate.js`)
  before being used in a query, instead of relying on whatever Prisma did
  with a `NaN`.
- Claim confirmation, report resolution, and claim-attempt submission are
  now atomic (transactional guards instead of read-then-write), closing
  races where two near-simultaneous requests — a double-click, or two admin
  tabs — could double-credit trust score, double-process a report, or let a
  claimant exceed the attempt cap.
- `PostDetail.jsx` now resets all per-post state when navigating between
  posts, since React Router keeps the component mounted across an `:id`
  change — previously a claim/review panel could briefly show the
  *previous* post's data.

## Schema change note (if you ran `prisma migrate dev` before this update)

Across this build, the schema went through two structural changes: the
original unused `Match` table was replaced by a proper `Claim` model, and
`User`/`Report` gained a few fields (`isAdmin`, the `Report.reporter`
relation). If your local `dev.db` already has an older schema applied,
Prisma will want to reset the dev database when you migrate again — that's
expected and fine, there's no real data to preserve in a dev SQLite file:

```bash
cd server
npx prisma migrate dev --name add-admin-and-reports
# if prompted about a reset, accept it — this is dev-only data
```

If you'd rather skip migration history entirely, delete
`server/prisma/dev.db` and `server/prisma/migrations/` and run
`npx prisma migrate dev --name init` fresh.

## Running it (development)

### 1. Backend

```bash
cd server
cp .env.example .env      # edit JWT_SECRET and ADMIN_EMAILS
npm install
npx prisma migrate dev --name init
npm run dev                # starts on http://localhost:4000
```

### 2. Frontend

```bash
cd client
npm install
npm run dev                # starts on http://localhost:5173
```

The client calls the API at a relative `/api` path (see
`client/src/api/client.js`), proxied to `localhost:4000` in dev by Vite
and served from the same origin in production by Express — see
[DEPLOY.md](./DEPLOY.md) for production builds.

### Try the full flow end to end

See [DEMO_SCRIPT.md](./DEMO_SCRIPT.md) for a complete guided walkthrough
(claim/verify, chat, matching, reporting, and the admin dashboard).

## API summary

| Method | Path                       | Auth | Notes |
|--------|----------------------------|------|-------|
| POST   | /api/auth/signup           | no   | name, email, password, collegeId?; rate-limited |
| POST   | /api/auth/login            | no   | email, password; rate-limited |
| GET    | /api/auth/me               | yes  | current user |
| GET    | /api/posts                 | no   | filters: type, category, q, location, from, to, sort |
| GET    | /api/posts/mine             | yes  | current user's posts (any status) |
| GET    | /api/posts/:id              | no   | public detail (question, not answer) |
| GET    | /api/posts/:id/matches      | yes  | owner only — top 5 scored matches of the opposite type |
| GET    | /api/posts/:id/claims/mine  | yes  | your own claim + attempts on this post, if any |
| GET    | /api/posts/:id/claims       | yes  | owner only — all claims + secret answer, for review |
| POST   | /api/posts/:id/claims       | yes  | submit an answer attempt (found posts only) |
| POST   | /api/posts                  | yes  | multipart/form-data, field `images`; profanity-filtered |
| PUT    | /api/posts/:id               | yes  | owner only; profanity-filtered; `status` may only be set to RESOLVED |
| DELETE | /api/posts/:id               | yes  | owner only; blocked while status is CLAIMED |
| POST   | /api/claims/:claimId/confirm | yes  | post owner only; grants trust score |
| POST   | /api/claims/:claimId/reject  | yes  | post owner only |
| GET    | /api/claims/:claimId/messages | yes | claimant or finder only; marks read |
| POST   | /api/claims/:claimId/messages | yes | claimant or finder only; profanity-filtered |
| GET    | /api/claims/mine              | yes | inbox: claims as claimant + as finder + unread summary |
| POST   | /api/reports                   | yes | report a post or user; rate-limited |
| GET    | /api/admin/stats                | admin | post/user/report counts |
| GET    | /api/admin/reports               | admin | all reports with target preview |
| PATCH  | /api/admin/reports/:id           | admin | body `{status: RESOLVED\|DISMISSED}`; adjusts trust score |
| DELETE | /api/admin/posts/:id              | admin | delete any post, bypassing ownership |

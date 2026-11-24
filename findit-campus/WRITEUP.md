# FindIt Campus — project write-up

## Problem

Students lose ID cards, bottles, headphones and wallets around campus
constantly. The usual fix — a WhatsApp group or a corkboard — has two
failure modes: posts get buried, and anyone can falsely claim an item
just by reading its public description. A lost wallet's public post says
"black leather wallet, lost near the library" — that's not enough to
prove ownership to a stranger, but it's also not something you want to
publish in full (name, cards, exact contents) to the entire campus.

## Core idea

Separate what's **public** (enough to recognize the item) from what's
**secret** (enough to prove you own it). When someone finds an item, they
write a public description *and* privately record one identifying detail
only the real owner would know — a name written inside, a sticker, a
scratch, a saved contact. Anyone claiming the item has to answer that
question; the finder — who actually knows the answer — decides if the
answer is convincing enough, rather than a computer doing an exact string
match (which breaks on "Rahul" vs "RAHUL S" vs "my name is Rahul"). Only
after the finder confirms does the two parties' chat unlock, so no
contact info is exchanged with someone who turns out to be a false claim.

That mechanism — hidden question → claimant answers → human confirms →
chat unlocks — is the one thing in this project that isn't "yet another
CRUD app," so most of the design effort went there.

## Architecture

- **Backend**: Node.js + Express + Prisma ORM + SQLite. SQLite was chosen
  deliberately over Postgres/MySQL for a student project: zero setup, the
  whole database is one file, and Prisma makes swapping to Postgres later
  a one-line config change if it's ever needed.
- **Frontend**: React (Vite), plain CSS (no UI framework dependency to
  keep the bundle and the learning curve small), `react-router-dom` for
  client-side routing.
- **Auth**: JWT + bcrypt. Stateless tokens, 7-day expiry.
- **Images**: Multer to local disk under `server/uploads/`, served
  statically by Express.
- **No paid AI, no external services.** Matching and abuse filtering are
  both plain rule-based code — intentional, both to fit the "no paid AI"
  constraint and because at campus scale (hundreds, not millions, of
  posts) a simple weighted scorer is both fast enough and, crucially,
  *explainable*: you can look at the score breakdown and see exactly why
  two posts matched.

## Data model (see `server/prisma/schema.prisma` for the authoritative version)

- `User` — auth, `trustScore`, `isAdmin`
- `Post` — lost or found item; `status` moves `OPEN → CLAIMED → RESOLVED`
- `PostImage` — one-to-many photos per post
- `VerificationChallenge` — one-to-one with a found `Post`; holds the
  hidden question and secret answer
- `Claim` — one per (post, claimant) pair; status `PENDING → CONFIRMED`
  or `REJECTED`; holds two `lastReadAt` timestamps used for chat unread
  counts
- `ClaimAttempt` — every answer a claimant submits, kept as history
- `Conversation` / `Message` — created only once a claim is confirmed
- `Report` — generic (`targetType` + `targetId`) so both posts and users
  can be reported through the same table

Deliberately *not* modeled: a persisted "Match" row. The matching engine
(below) computes scores on the fly from existing `Post` rows — nothing
downstream needs a stored match, so persisting one would just be a cache
with no cache invalidation story. Simpler to not have it.

## The matching engine

`server/src/utils/matching.js` scores a lost/found pair on four signals,
each normalized to 0–1 and combined with fixed weights:

| Signal | Weight | How it's computed |
|---|---|---|
| Category | 0.35 | exact match = 1, both "other" = 0.3, else 0 |
| Date proximity | 0.20 | linear falloff over a 30-day window |
| Location | 0.20 | exact match = 1, substring match = 0.6, else 0 |
| Description similarity | 0.25 | Jaccard index over tokenized words (stopwords removed) |

This runs live against every open post of the opposite type whenever a
post's owner views their "possible matches" — no background job, no
stale cache.

## Abuse resistance (Week 7)

- Claim attempts capped at 3 per (post, claimant) — stops brute-forcing
  the secret answer.
- Finder manually confirms/rejects every claim — no auto-match on exact
  string comparison, which would both be bypassable (guess common
  answers) and too strict (reject correct-but-differently-phrased
  answers).
- A small static profanity filter runs on post titles/descriptions and
  chat messages — no external moderation API.
- A hand-rolled in-memory sliding-window rate limiter throttles
  signup/login (10 per 15 min per IP) and report submission (10 per hour
  per IP) — no Redis, no extra dependency, appropriate for a
  single-process student deployment.
- Reports feed an admin dashboard; resolving a report (marking it valid)
  docks the reported post owner's or user's trust score — the one place
  trust score actually changes downward. It moves upward by +2/+1 when a
  claim is confirmed (finder/claimant respectively), so trust reflects
  real transaction history, not self-reported reputation.

## Trade-offs made on purpose

- **Chat is polling (4s), not WebSockets.** No new dependency, same REST
  pattern as the rest of the app, trivially easy to reason about and
  review without live-testing infrastructure. The cost is a few seconds
  of latency, which is fine for arranging a handover — it's not a
  real-time gaming app.
- **In-app notifications only, no email/push.** Keeps the stack to one
  service (no SMTP, no push provider to configure/pay for).
- **Admin access via an email allowlist (`ADMIN_EMAILS`), not a role
  management UI.** For a campus deployment with a handful of staff
  accounts, an env var is simpler and has zero attack surface beyond
  protecting the env file itself.

## Known limitations / future work

- No image similarity matching (perceptual hashing) yet — text/metadata
  only, per the Week 4 plan's "v1" scope.
- Trust score has no decay or weighting by recency.
- The in-memory rate limiter resets on server restart and doesn't share
  state across multiple server instances — fine for one process, not for
  a horizontally-scaled deployment.
- No automated test suite — correctness was verified by static analysis
  (`node --check` on every backend file, manual trace of every new React
  effect/handler, bracket-balance checks) rather than by running the app,
  since this development environment has no outbound network access to
  install dependencies. See `README.md` for how to run and verify it
  yourself.

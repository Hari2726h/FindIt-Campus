# Demo script

~7 minutes. Needs two browser windows (or one regular + one incognito,
since the session token lives in `localStorage` per-browser-profile) and,
for the last part, a third account whose email is listed in
`ADMIN_EMAILS`.

Run both servers first (`server/` → `npm run dev`, `client/` → `npm run dev`),
open `http://localhost:5173`.

## 1. Setup (30s)

- **Window A**: sign up as `arjun@campus.edu` — this is the finder.
- **Window B**: sign up as `priya@campus.edu` — this is the claimant.

*Say: "Two students, no relation to each other yet."*

## 2. Post a found item with a hidden question (1 min)

In **Window A** (Arjun): click **+ New post** → select **Found item**.

- Category: `bottle`, Title: `Blue steel water bottle`, Description:
  `Found near the CS building canteen, has some stickers on it`
- Date + location: today, "CS canteen"
- Upload a photo if you have one handy
- Scroll to **Hidden verification question** — point this out explicitly:
  *"This is the part that makes this different from a WhatsApp group post.
  The public description says 'has some stickers' — vague on purpose. The
  real identifying detail goes here, hidden."*
- Question: `What sticker is on the bottle?`
- Secret answer: `a cat sticker`
- Submit.

Open the post — point out the public page only shows the *question*, never
the answer.

## 3. Someone claims it (1 min)

In **Window B** (Priya): go to the board, find the bottle post, open it.

- Show the verification box with just the question visible.
- Try one wrong answer first: `a dog sticker` → submit. Point out it's
  tracked as an attempt and status stays pending — *"the finder sees
  this, nothing auto-rejects you."*
- Submit the correct answer: `a cat sticker`.

## 4. Finder reviews and confirms (1 min)

Back in **Window A** (Arjun), refresh/reopen the post:

- Point out **"Claims on this item"** shows Arjun's own secret answer
  right next to Priya's two attempts, side by side.
- *"This is the design call — no automatic exact-string match. A human
  who actually knows the answer makes the call, because free-text answers
  vary too much for a computer to trust blindly."*
- Click **Confirm match**.

## 5. Chat unlocks (1 min)

Both windows now show **Open chat**. Open it in both.

- Send a message from Priya ("Hey, that's mine! Can I grab it from the
  CS canteen?"), see it poll into Arjun's window within a few seconds
  (point out: *"polling, not WebSockets — deliberate, zero extra
  dependency"*).
- Reply from Arjun.
- Mention the **Inbox** page and the nav bar badge — show the unread
  count appear/disappear.

## 6. Possible matches (auto-suggestion) (1 min)

- In **Window B**, post a **Lost item**: category `bottle`, title
  `Lost my water bottle`, same date/location as the found post.
- Open that lost post's detail page (as its owner) → **Possible matches**
  section shows the found bottle ranked with a score.
- *"This runs live — category, date, location, and description similarity,
  weighted. No AI call, just a scoring function anyone can read."*

## 7. Abuse controls + admin (1.5 min)

- In **Window B**, click **Report this post** on some post, submit a
  reason.
- Log into a **third window** with the `ADMIN_EMAILS`-listed account →
  nav bar shows an **Admin** badge.
- Open **/admin** → show the stats tiles, then the report in the list →
  click **Resolve (valid)** → mention this docks the target's trust
  score, which is visible as "(trust: N)" next to any poster's name on
  the post detail page.
- Briefly mention (don't need to trigger live): claim attempts are capped
  at 3, signup/login and report submission are rate-limited per IP, and
  there's a basic profanity filter on posts and chat.

## Closing line

*"Eight weeks: schema and wireframes, auth and CRUD, search and matching,
the claim-and-verify flow that's the actual point of the project, chat,
then moderation and trust on top. Everything's plain REST and SQLite —
no paid APIs anywhere, which was a constraint from the start."*

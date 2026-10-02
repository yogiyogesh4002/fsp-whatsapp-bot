# Deploying the FSP bot — Neon + Vercel

Written for you, doing this for the first time. Follow it top to bottom; nothing
is assumed.

You need three accounts, all free to start: **Neon** (the database),
**GitHub** (to hold the code), **Vercel** (to run it). Your Evolution GO server
on Railway stays exactly as it is.

Roughly 25 minutes.

---

## Why a database at all?

Vercel has no permanent disk. Anything written to a file disappears the moment
the function finishes. Leads, chats and your team's accounts have to live
somewhere that persists — that is Neon, a hosted Postgres.

---

# PART 1 — Neon (the database)

### Step 1.1 — Create the project

1. Go to **https://neon.com** and sign up (GitHub login is quickest).
2. Click **New Project**.
3. Fill in:
   - **Name:** `fsp-whatsapp-bot`
   - **Postgres version:** leave the default
   - **Region:** **Asia Pacific (Singapore)** — `ap-southeast-1`. Closest to
     India, so the dashboard feels fast.
4. Click **Create project**.

### Step 1.2 — Copy the connection string

Neon shows a **Connection string** box right after creating the project. If you
navigate away: **Dashboard → Connect** (or **Connection Details**).

Two things matter:

- Make sure the **Connection pooling** toggle is **ON**. The host then contains
  `-pooler`. Vercel opens and closes a lot of short connections, and the pooled
  endpoint is built for that. Without it you will hit connection limits.
- Copy the whole string, starting `postgresql://`.

It looks like this:

```
postgresql://neondb_owner:npg_AbC123xyz@ep-cool-name-a1b2c3-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require
```

Check it has **`-pooler`** in it and ends with **`?sslmode=require`**.

> This string is a password. Do not paste it into chat, a screenshot, or a
> GitHub file.

### Step 1.3 — Put it in your local config

Open `.env.local` in this project. Find the last line:

```ini
DATABASE_URL=
```

Paste your string after the `=`, no quotes, no spaces:

```ini
DATABASE_URL=postgresql://neondb_owner:npg_...@ep-...-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require
```

Save it. `.env.local` is gitignored, so this never reaches GitHub.

### Step 1.4 — Create the tables

In this folder, run:

```bash
npm run db:migrate
```

You want to see:

```
  Neon : ep-...-pooler.ap-southeast-1.aws.neon.tech

  + connected — PostgreSQL 17.x
  + schema applied (19 statements)
    activity           5 columns
    blocked_outbound   5 columns
    escalations        9 columns
    leads             27 columns
    messages          13 columns
    notes              5 columns
    settings           2 columns
    users              8 columns

  No accounts yet — open the app and create the first admin.
```

Eight tables. If you get `cannot connect`, go back to step 1.2 — nearly always
a missing `-pooler` or a truncated paste.

### Step 1.5 — Try it locally

```bash
npm run build
npm start
```

Open **http://localhost:3100**. It asks you to create the first admin account —
do that. You land on the empty lead board, and **Settings** shows a green
**Neon ok**.

That confirms the database works before Vercel is involved at all.

---

# PART 2 — GitHub

Vercel deploys from a repository. The code is already committed locally.

### Step 2.1 — Make an empty repo

1. Go to **https://github.com/new**.
2. **Repository name:** `fsp-whatsapp-bot`
3. Choose **Private**.
4. Do **not** tick "Add a README" or any `.gitignore` — the repo must start
   empty.
5. **Create repository**.

### Step 2.2 — Push

Copy the URL GitHub shows you, then:

```bash
git remote add origin https://github.com/YOUR-USERNAME/fsp-whatsapp-bot.git
git branch -M main
git push -u origin main
```

Refresh GitHub — you should see the files. **Check that `.env.local` is not
there.** It should not be; if it is, stop and tell me.

---

# PART 3 — Vercel

### Step 3.1 — Import the repo

1. Go to **https://vercel.com** and sign in with GitHub.
2. **Add New → Project**.
3. Find `fsp-whatsapp-bot` and click **Import**.
4. Vercel detects Next.js by itself. Change nothing about the build settings.

### Step 3.2 — Add the environment variables

**Before** clicking Deploy, expand **Environment Variables**. Add each of these.
Copy the four secret values from your own `.env.local` — do not retype them.

| Name | Value |
|---|---|
| `DATABASE_URL` | your Neon pooled string (from step 1.2) |
| `EVOLUTION_API_URL` | `https://evolution-go-production-8912.up.railway.app` |
| `EVOLUTION_API_KEY` | the Evolution GO **global** api key, from `.env.local` |
| `EVOLUTION_INSTANCE` | `keypurpose` |
| `WEBHOOK_TOKEN` | copy from `.env.local` |
| `SESSION_SECRET` | copy from `.env.local` |
| `BOT_ENABLED` | `false` |
| `FSP_WEBSITE_URL` | `https://fsp-beta.vercel.app/` |
| `BOT_WORKING_HOURS` | `Mon-Sat, 10am - 7pm IST` |
| `BOT_TZ_OFFSET_MINUTES` | `330` |
| `BOT_HOURS_START` | `10` |
| `BOT_HOURS_END` | `19` |
| `BOT_REPLY_DELAY_MS` | `1200` |
| `BOT_SEND_PRESENCE` | `true` |

Notes:

- `BOT_ENABLED=false` is deliberate. The bot will receive messages and draft
  replies but send nothing until you flip it. Part 5.
- Copy `WEBHOOK_TOKEN` and `SESSION_SECRET` exactly. New values would break the
  webhook and sign everyone out.
- Do **not** set `PORT`. Vercel handles it.

### Step 3.3 — Deploy

Click **Deploy** and wait a couple of minutes. When it finishes you get a URL
like:

```
https://fsp-whatsapp-bot.vercel.app
```

Open it. You should see the login page. Sign in with the admin account you made
in step 1.5 — it is the same Neon database, so the account is already there.

Go to **Settings** and check:

- **Neon ok** — green
- **connected: open** and the instance `keypurpose`
- **webhook** — still empty. That is Part 4.

---

# PART 4 — Connect WhatsApp to it

This is the step that makes messages actually arrive. Until now, nothing reaches
the bot.

### Step 4.1 — Register the webhook

Easiest from the dashboard: **Settings → Public base URL of this app** → paste
your Vercel URL → click **Register webhook on Evolution**.

Or from this folder:

```bash
npm run connect -- set https://fsp-whatsapp-bot.vercel.app
```

(Use your real Vercel URL.)

### Step 4.2 — Confirm

```bash
npm run connect
```

You want:

```
  + connected  : true
  + logged in  : true
  . number       : +918680895851
  . webhook      : https://fsp-whatsapp-bot.vercel.app/api/webhook/evolution?token=***
  . events       : MESSAGE
```

The webhook line must point at **your Vercel URL** and end in
`/api/webhook/evolution`.

### Step 4.3 — Send a real test

From **your own phone**, WhatsApp the FSP number **+91 86808 95851**:

> What is FSP?

Within a few seconds, on the lead board:

- a new card appears in **New** with your name;
- open it, and the Chat tab shows your message and the bot's drafted reply,
  marked **not sent**.

You will get nothing on your phone — correct, auto-reply is still off.

That proves the whole chain: WhatsApp → Evolution GO → Vercel → Neon → the board.

If no card appears, see Troubleshooting.

---

# PART 5 — Switch auto-reply on

Do this once you have read some drafts and are happy with them. I suggest
sending it a handful of messages first — a fee question, a batch-date question,
"what is FSP" — and reading what it would have said.

**To go live:** sign in, and press the **Auto-reply off** button in the top bar.
It turns green and says **Auto-reply on**.

That switch is stored in the database, so it survives redeploys and you do not
need to touch Vercel. (You can also set `BOT_ENABLED=true` in Vercel, but the
button is the easier control.)

Now message the FSP number from your phone again. This time you get a real
reply.

### Turning it off in a hurry

Press the same button. It stops sending immediately — messages keep arriving and
leads keep appearing, just no replies.

---

## What it will and will not say

Already enforced, with tests that fail the build if they break:

- **Never replies in a group.** Group, broadcast, status and channel messages
  are dropped before anything else runs.
- **Never sends money details.** No fee, price, discount, EMI, UPI, bank
  account, IFSC, QR or payment link, and it never confirms a payment. Every
  money question gets the handover: *"I'll connect with our team and the team
  will get back to you shortly."*

Optional extra — have Evolution GO itself refuse to even deliver group messages:

```bash
npm run connect -- groups-off
```

---

## Troubleshooting

**`npm run db:migrate` says cannot connect.** The `DATABASE_URL` is wrong.
Re-copy it from Neon with pooling ON. It must contain `-pooler` and end with
`?sslmode=require`.

**Vercel build fails.** Open the failed deployment's **Build Logs**. If it is a
missing variable, add it under Settings → Environment Variables and **Redeploy**
(adding a variable does not redeploy by itself).

**Settings shows "Neon down" on Vercel but works locally.** `DATABASE_URL` is
missing or mistyped in Vercel. Fix it, then Redeploy.

**You send a WhatsApp message and no card appears.**
1. `npm run connect` — is the webhook pointing at your Vercel URL?
2. Settings → **Last webhook event**. If it says "nothing yet", Evolution GO is
   not reaching Vercel. Re-register (step 4.1).
3. Vercel → your project → **Logs**, then message again and watch for the
   request to `/api/webhook/evolution`. A 401 there means `WEBHOOK_TOKEN` in
   Vercel does not match the one in the registered URL — re-register.

**Signed out after every deploy.** `SESSION_SECRET` is changing. Set it as a
fixed value in Vercel.

**Leads vanished.** Check `DATABASE_URL` still points at the same Neon project.
Neon free projects suspend when idle but do not lose data — the first request
after idling is just a little slow.

**A reply was not what you expected.** Settings → **Test the bot**. It replays
any message through the real engine and tells you which answer matched and which
handover trigger fired, sending nothing.

---

## Testing safely, from now on

Never POST test payloads at the webhook while auto-reply is on — the bot will
really message whatever number is in the payload. Use either:

- **Settings → Test the bot** — touches neither WhatsApp nor the database; or
- `&dry=1` on the webhook URL — runs the full pipeline and sends nothing.

For a genuine end-to-end test, message the FSP number from your own phone. Never
use made-up numbers; they can belong to real people.

# Deploying the FSP bot to Railway

Written for whoever runs the deploy — you, or a developer helping you.

The bot has to be reachable from the public internet, because your Evolution GO
server (on Railway) is the thing that calls it. Running it on a laptop does not
work: Railway cannot reach `localhost`.

Your Evolution GO instance is already connected, so nothing about WhatsApp
pairing changes here.

---

## 1. Put the code in a git repository

A repo already exists locally. Push it to GitHub:

```bash
git remote add origin https://github.com/<you>/fsp-whatsapp-bot.git
git branch -M main
git push -u origin main
```

`.env.local` is gitignored, so **no secrets are pushed**. You set them on
Railway in step 3.

---

## 2. Create the service

In your Railway project (the same one as Evolution GO, so they share a private
network):

1. **New → GitHub Repo →** pick this repo.
2. Railway reads `railway.json` and builds from the `Dockerfile`. No build
   command to configure.
3. **Settings → Networking → Generate Domain.** Note the URL, e.g.
   `https://fsp-bot-production-xxxx.up.railway.app`.

---

## 3. Add a volume, so leads survive a redeploy

The database is a single SQLite file. Without a volume it is wiped on every
deploy.

**Settings → Volumes → New Volume**, mount path exactly:

```
/data
```

The image already defaults `DB_PATH=/data/fsp.db`.

---

## 4. Set the environment variables

**Variables → Raw Editor**, paste this and fill in the blanks:

```ini
EVOLUTION_API_URL=https://evolution-go-production-8912.up.railway.app
EVOLUTION_API_KEY=<your Evolution GO global api key>
EVOLUTION_INSTANCE=keypurpose

WEBHOOK_TOKEN=<copy from your local .env.local>
SESSION_SECRET=<copy from your local .env.local>

# Start silent: messages are received, leads appear, replies are drafted and
# shown marked "not sent", but nothing goes out. Flip to true when you are
# happy with what it would have said.
BOT_ENABLED=false

FSP_WEBSITE_URL=https://fsp-beta.vercel.app/
BOT_WORKING_HOURS=Mon-Sat, 10am - 7pm IST
BOT_TZ_OFFSET_MINUTES=330
BOT_HOURS_START=10
BOT_HOURS_END=19
BOT_REPLY_DELAY_MS=1200
BOT_SEND_PRESENCE=true

DB_PATH=/data/fsp.db
NODE_ENV=production
```

Copy `WEBHOOK_TOKEN` and `SESSION_SECRET` from your local `.env.local` — they
are already generated. Do not invent new ones unless you want everyone signed
out.

Do **not** set `PORT`; Railway injects it.

---

## 5. Create your account

Open the Railway URL. The first visit asks you to create the admin account.
Add the rest of the team from **Settings → Team**.

---

## 6. Point WhatsApp at it

Two ways — either is fine.

**From the dashboard:** Settings → paste the Railway URL into *Public base URL*
→ **Register webhook on Evolution**.

**Or from your machine:**

```bash
npm run connect -- set https://fsp-bot-production-xxxx.up.railway.app
```

Then confirm:

```bash
npm run connect
```

You want to see the webhook line pointing at `/api/webhook/evolution` and
`events: MESSAGE`.

---

## 7. Watch it silently for a while

With `BOT_ENABLED=false`, send a message to the FSP number from your own phone.
You should see:

- the lead appear in the **New** column within a few seconds;
- the drafted reply in the chat thread, marked **not sent**.

That proves the whole chain — WhatsApp → Evolution GO → webhook → engine —
without a single message reaching a customer.

Read a day's worth of drafts. When you are happy, flip the **Auto-reply**
button in the top bar (or set `BOT_ENABLED=true`). From that moment it replies
for real.

---

## Optional: ask the server to drop groups too

The bot already refuses to reply in group chats, and there is a test that fails
the build if that ever stops being true. If you want Evolution GO to not even
deliver group messages:

```bash
npm run connect -- groups-off
```

Belt and braces. It also stops status/story updates being delivered.

---

## Troubleshooting

**Build fails on Railway.** Check the build log for the `npm run build` step.
The same command works locally, so a failure there is usually a missing
environment variable at build time — but none are required to build.

**Deploy is healthy but nothing arrives.** Run `npm run connect`. If the
webhook is empty or points elsewhere, re-register it (step 6). Confirm the
Railway domain is generated and public.

**Signed out after every deploy.** `SESSION_SECRET` is changing. Set it as a
fixed variable rather than regenerating it.

**Leads disappeared after a deploy.** The `/data` volume is missing or the
mount path is wrong. Check step 3.

**Webhook arrives but the reply is not what you expected.** Settings → *Test
the bot* replays any message through the real engine and names the matched
answer and the trigger, sending nothing.

---

## A note on testing

Never feed test payloads to the webhook while auto-reply is on — the bot will
really message whatever number is in the payload. For that, the endpoint takes
a dry-run flag that runs the full pipeline and sends nothing:

```
POST /api/webhook/evolution?token=<WEBHOOK_TOKEN>&dry=1
```

Safer still, use **Settings → Test the bot**, which never touches WhatsApp or
the database.

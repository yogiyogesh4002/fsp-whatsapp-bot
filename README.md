# FSP WhatsApp Assistant — Jarvis

A WhatsApp auto-reply bot for **FSP (Facilitator Support Program)** plus a Kanban lead
board for the team. It connects to WhatsApp through **Evolution GO**, answers questions
from [`WHATSAPP-BOT-KNOWLEDGE.md`](WHATSAPP-BOT-KNOWLEDGE.md), and hands anything it must
not answer to a human.

**Business site:** https://fsp-beta.vercel.app/
**Deploying it:** see [DEPLOY.md](DEPLOY.md) — the bot needs a public URL, because
Evolution GO is the thing that calls it.

---

## The two rules that are enforced in code

These are not suggestions in a prompt — they are checked by code on every message, with
tests that fail the build if they ever stop holding.

### 1. It never replies in a group

Group chats (`@g.us`), broadcast lists, status updates and channels are dropped before
anything else runs. Nothing is stored, nothing is sent. Only one-to-one chats get a reply.

### 2. It never shares payment details

No fee, price, cost, discount, EMI, UPI id, bank account, IFSC, QR code or payment link
ever leaves this bot — and it never confirms that a payment was received. Three layers:

| Layer | What it does |
|---|---|
| **Inbound screen** | 16 trigger patterns catch money questions *before* an answer is composed, in English, Tamil and Tanglish (`fee`, `how much`, `evlo`, `கட்டணம்`, `upi`, `payment link`, …). |
| **Answer library** | Contains no amounts at all. There is nothing to leak. |
| **Outbound guard** | Every outgoing message is scanned for amounts, UPI handles, IFSC codes, account numbers and gateway names. A hit blocks the send, logs the draft, and shows it in Settings. |

On any money question the customer gets:

> The team shares the current investment details directly so you get accurate, up-to-date information.
>
> I'll connect with our team and the team will get back to you shortly. Could you share your **name** and **city** so I can pass it on correctly?

The guard applies to the team too. If someone types a price into the dashboard reply box,
it is blocked there as well.

---

## What the bot does

- Answers **35 FSP topics** — programs, modules, founder, community, eligibility, resources,
  challenges, and the nine objections from the knowledge base.
- **Mirrors the customer's language**: English, Tamil script, or Tanglish.
- **Captures the lead** as it talks — name, city, profession, profile, goal, program of
  interest, preferred contact time.
- **Hands over on all 16 triggers**: fees, payments, batch dates, duration/format,
  certificate recognition, enrolment, refunds, corporate enquiries, partnerships, the
  founder, invoices, complaints, anything unknown, a request for a human, a repeated
  question, and off-topic advice.
- **Sends the handoff once per topic**, then keeps chatting normally — it does not repeat
  itself.
- **Stops replying** after abuse or "not interested", and pauses itself the moment a human
  replies from the dashboard.

Everything it says comes from the knowledge base. There is no model generating free text,
so it cannot invent a fee, a date or a promise. Anything the knowledge base does not cover
becomes trigger 13 — hand over.

---

## Setup

Requires **Node 24+** (the database uses Node's built-in `node:sqlite`, so there is nothing
to compile).

### 1. Fill in `.env.local`

A `.env.local` was created for you with `WEBHOOK_TOKEN` and `SESSION_SECRET` already
generated. Add your Evolution details:

```ini
EVOLUTION_API_URL=http://localhost:8080   # your Evolution server, no trailing slash
EVOLUTION_API_KEY=                        # the AUTHENTICATION_API_KEY of that server
EVOLUTION_INSTANCE=fsp                    # the instance holding the FSP number
```

Everything else has a working default. See [`.env.example`](.env.example) for the full list
(working hours, reply delay, auto-reply switch, database path).

### 2. Start it

```bash
npm run build
npm start            # http://localhost:3100
```

For development: `npm run dev`.

### 3. Create your account

Open http://localhost:3100 — the first visit asks you to create the admin account. Add the
rest of the team from **Settings → Team**.

If you ever get locked out:

```bash
npm run user -- list
npm run user -- reset you@fsp.in NewPassword123
```

### 4. Connect WhatsApp

This talks to **Evolution GO** (the Go rewrite), whose API differs from the older
Node "Evolution API v2" — different routes, and a two-tier key. Only the *global*
key goes in your config; the per-instance token is looked up by instance name.

Check what the server currently thinks:

```bash
npm run connect
```

It reports whether the number is paired, which number it is, the webhook URL, and
whether your secrets are set.

If the instance does not exist yet:

```bash
npm run connect -- create
npm run qr                 # prints the pairing QR / code — scan from WhatsApp → Linked devices
```

Then point Evolution GO's webhook at this app:

```bash
npm run connect -- set https://your-public-url
```

The URL must be reachable **from the Evolution GO server**. If Evolution GO is
hosted (Railway, a VPS) then `localhost` will not do — see [DEPLOY.md](DEPLOY.md).

The webhook endpoint is:

```
POST {your-url}/api/webhook/evolution?token={WEBHOOK_TOKEN}
```

It subscribes to the `MESSAGE` and `CONNECTION` events. Requests without the
right token get a 401.

Optionally have the server drop group messages before they are even delivered:

```bash
npm run connect -- groups-off
```

### 5. Test before going live

**Settings → Test the bot** runs the real engine with nothing sent to WhatsApp and nothing
saved. Click through the sample messages — especially *"What is the fee?"*, *"Send me the
payment link"* and the group toggle — and confirm you are happy with every reply.

You can also keep `BOT_ENABLED=false` for the first day: messages are received, leads are
created and replies are drafted and shown in the chat marked *not sent*, but nothing goes
out. Flip it on from the **Auto-reply** button in the top bar.

> **Never POST test payloads to the webhook while auto-reply is on.** The bot will really
> message whatever number is in the payload. Add `&dry=1` to the webhook URL to run the
> full pipeline and send nothing, or use *Test the bot*, which touches neither WhatsApp nor
> the database.

---

## Using the lead board

Seven columns, left to right:

| Column | Meaning |
|---|---|
| **New** | Just messaged |
| **Engaged** | Asking questions, bot is helping |
| **Qualified** | Name, city and profile captured |
| **Needs Team** | Bot handed over — someone must call |
| **Team Contacted** | A team member has reached out |
| **Joined** | Enrolled in a program |
| **Closed** | Not interested or unreachable |

The bot moves leads forward on its own but **never pulls one backwards**, and once a lead
reaches *Team Contacted* the bot stops changing its column at all.

- **Drag a card** between columns, or open it and use the stage dropdown on a phone.
- **Open a card** for the full WhatsApp thread, the lead's details, the handover history,
  notes, and a log of who changed what.
- **Reply as the team** from the Chat tab. Sending pauses the bot for that chat so you and
  Jarvis never talk over each other — un-tick *Pause bot* to hand it back.
- **Copy summary** on the Details tab gives you the handoff block from the knowledge base,
  ready to paste into your team group.
- **Mark as handled** on the Team tab clears an escalation.
- Filter by owner, search by name/phone/city, or show **only leads waiting on the team**.
- The board refreshes itself every 10 seconds.

Moving a lead to *Team Contacted*, *Joined* or *Closed* pauses the bot for that chat
automatically.

### Roles

- **agent** — sees and works every lead, replies, adds notes, moves cards.
- **admin** — also manages accounts, the auto-reply switch, the webhook, and can delete leads.

---

## Reading the numbers

**Settings → Activity** shows leads, messages, open escalations, failed sends, and blocked
drafts. The most useful table is **"What people ask that the bot cannot answer"**: it ranks
the 16 triggers by how often they fire. If trigger 3 (batch dates) is at the top every week,
that is a question worth answering publicly on the website — and the knowledge base's own
advice.

**Payment guard log** lists every draft the guard refused. It should normally be empty;
anything in it is worth reading.

---

## Changing what the bot says

Everything lives in `src/lib/bot/`:

| File | What's in it |
|---|---|
| `knowledge.ts` | The answer library — one entry per topic, with its match patterns and its English / Tamil / Tanglish replies. |
| `triggers.ts` | The 16 handover triggers. |
| `templates.ts` | Greeting, handoff, follow-up and small-talk wording. |
| `guard.ts` | The outbound payment guard. |
| `engine.ts` | The decision order, and which answers may override a trigger. |
| `capture.ts` | Lead-detail extraction, including the city list. |
| `language.ts` | English / Tamil / Tanglish detection. |

To add an answer, copy an existing entry in `knowledge.ts`, give it an `id`, a few
`patterns` and a `reply`. Replies are written in markdown and converted to WhatsApp
formatting (`*bold*`, `_italic_`) on the way out, and long ones are split into
WhatsApp-sized messages.

Not every answer has a Tamil and Tanglish version yet — the highest-traffic ones do, and
anything without one falls back to English. Adding `ta:` and `tl:` to an entry is all it
takes.

After any change:

```bash
npm run test:bot     # 26 behaviour tests, including the group and payment rules
npm run build
```

The tests assert that no reply to any money phrasing ever contains an amount, a UPI handle
or an account number. Keep them passing.

---

## Troubleshooting

**Nothing arrives.** Run `npm run connect`. If the webhook URL is not pointing at
`/api/webhook/evolution`, re-run `npm run connect -- set <url>`. If the state is not `open`,
run `npm run qr` and pair the number again. Remember the URL must be reachable *from the
Evolution server* — `localhost` only works if they share a machine.

**Messages arrive but nothing is sent.** Check the **Auto-reply** button in the top bar, and
that `EVOLUTION_API_URL` / `EVOLUTION_API_KEY` / `EVOLUTION_INSTANCE` are set. Failed sends
appear in red in the lead's chat with the exact error.

**The bot answered something it should have escalated**, or escalated something it could
have answered. Reproduce it in **Settings → Test the bot** — the result names the trigger
and the matched answer, which tells you whether to tighten a trigger in `triggers.ts` or add
a pattern in `knowledge.ts`.

**A reply was blocked.** Look at the Payment guard log in Settings. The pattern name says
which rule fired.

---

## Data

Everything is in one SQLite file, `data/fsp.db` — leads, messages, escalations, notes and
the audit log. Back it up by copying the file (stop the app first, or copy the `.db`, `.db-wal`
and `.db-shm` together). It is gitignored.

Deleting a lead from the dashboard deletes its whole conversation. Only admins can do it.

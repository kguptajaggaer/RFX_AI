# RFX AI — Intelligent Sourcing Platform

AI-drafted RFx events and format-agnostic offer intake for procurement teams.

## What it does

| Feature | Description |
|---|---|
| **AI Co-pilot** | Draft a complete RFx through conversation — GPT-4o proposes scope, questions, line items, dates, and vendors |
| **Portal-optional Dispatch** | Send invitations to vendors via email with unique reply-to addresses — no vendor registration required |
| **Format-agnostic Intake** | Vendors submit offers as PDF, Word, Excel, scanned image, or email body — all normalized to the event schema |
| **Human-in-the-loop Review** | Every extracted value carries provenance and confidence; award blocked until a human confirms low-confidence price fields |
| **Sealed Bid** | Offers hidden from comparison grid until submission deadline |
| **Full Audit Trail** | Every value traces back to the original artefact or a named human confirmation with timestamp |

## Tech stack

- **Next.js 16** (App Router)
- **Supabase** (PostgreSQL + Auth + Storage + RLS)
- **OpenAI GPT-4o** (drafting via function calling, extraction via structured output + Vision)
- **SendGrid** (outbound dispatch + inbound email parse webhook)
- **Tailwind CSS**
- **Deployed on Vercel**

## Setup

### 1. Supabase project

1. Create a new Supabase project at [supabase.com](https://supabase.com)
2. Run migrations in order from `supabase/migrations/`:
   ```bash
   001_tenants_profiles.sql
   002_rfx_events_schema.sql
   003_vendors_invitations.sql
   004_submissions_attachments.sql
   005_extracted_confirmed_values.sql
   006_quarantine_audit.sql
   ```
3. Create a storage bucket named `offer-documents` (private)
4. Generate types: `npx supabase gen types typescript --project-id <id> > types/database.ts`

### 2. Environment variables

Copy `.env.local` and fill in your values:

```bash
cp .env.local .env.local.example  # keep as template
```

| Variable | Where to get it |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API |
| `OPENAI_API_KEY` | [platform.openai.com](https://platform.openai.com) |
| `SENDGRID_API_KEY` | [app.sendgrid.com](https://app.sendgrid.com) |
| `SENDGRID_WEBHOOK_PUBLIC_KEY` | SendGrid → Settings → Mail Settings → Event Webhook |
| `INBOUND_EMAIL_DOMAIN` | Your SendGrid Inbound Parse domain (e.g. `inbound.yourdomain.com`) |

### 3. SendGrid setup

**Outbound:** Create a Dynamic Template for vendor invitations.

**Inbound email parse:**
1. Add MX record: `inbound.yourdomain.com → mx.sendgrid.net` (priority 10)
2. SendGrid → Settings → Inbound Parse → Add Host & URL
3. Webhook URL: `https://your-app.vercel.app/api/webhooks/sendgrid/inbound`
4. Enable "Post the raw, full MIME message"

### 4. Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### 5. Deploy to Vercel

```bash
vercel --prod
```

Add all environment variables in Vercel Dashboard → Settings → Environment Variables.

## Architecture

### Key design decisions

**Two-table constraint (`extracted_values` + `confirmed_values`):**
AI-extracted values live in a separate table from human-confirmed values. The comparison grid joins only `confirmed_values`, making it structurally impossible to display unconfirmed data as vendor-attested — the PRD's hard constraint is enforced at the data layer, not just in the UI.

**Per-invitation reply email:**
Each vendor gets a unique `rfx-{uuid}@inbound.yourdomain.com` reply address. The routing key is in the `To:` header (unforgeable without the invite link), plus additional `From:` verification for defence in depth.

**Graceful degradation:**
The extraction pipeline runs asynchronously. If GPT-4o is unavailable, submissions queue with `extraction_status = 'queued'` and a Vercel Cron job retries every 5 minutes. Events can always be dispatched and offers always accepted, regardless of AI availability.

**Sealed bid (RLS + UI):**
Supabase RLS policies prevent reading `extracted_values` / `confirmed_values` before event close, enforced at the database layer independently of the UI countdown.

## Project structure

```
app/
  (dashboard)/          # Authenticated buyer area
    events/new/         # AI drafting co-pilot
    events/[id]/        # Event detail, schema, vendors, submissions, comparison, audit
  vendor/[token]/       # Vendor portal (no auth required)
  api/
    ai/draft/           # Streaming GPT-4o drafting endpoint
    events/             # CRUD + publish + award
    submissions/        # Confirm/correct extracted values
    vendor-portal/      # Token-gated offer submission
    webhooks/sendgrid/  # Inbound email + delivery events

lib/
  openai/              # Drafting system prompt + extraction schema
  extraction/          # Pipeline: route → parse → GPT-4o → store → grid cache
  email-routing/       # Invite token generation and parsing
  audit/               # Structured audit log writer

supabase/migrations/   # All 6 migration files
types/
  database.ts          # Supabase table types (regenerate with CLI)
  index.ts             # App-level type aliases
```

## Acceptance criteria status

| AC | Status |
|---|---|
| AC-1 (AI draft, inline edit) | ✅ `DraftingInterface` + `DraftPreview` |
| AC-2 (completeness check blocks submit) | ✅ Save Draft disabled on blocking issues |
| AC-3 (no vendor registration) | ✅ `/vendor/[token]` + portal submit |
| AC-4 (PDF/Excel/image → same row) | ✅ `pipeline.ts` routes by MIME type |
| AC-5 (provenance from any cell) | 🔲 `ProvenanceDrawer` component (next sprint) |
| AC-6 (award blocked on low-confidence price) | ✅ `/api/events/[eventId]/award` pre-flight |
| AC-7 (unreadable artefact → manual entry) | 🔲 `ManualEntryFallback` component (next sprint) |
| AC-8 (unmatched sender quarantined) | ✅ `inbound/route.ts` quarantine logic |
| AC-9 (late submission per rules) | ✅ `is_late` flag + `late_response_rule` enforcement |
| AC-10 (extraction unavailable → queue) | ✅ `extraction_status = 'queued'` retry loop |
| AC-11 (extraction isolation) | ✅ Extraction only touches own artefact + schema |
| AC-12 (award audit trail) | ✅ `audit_logs` on every confirmation + award |

# Invoice Intake

Human-in-the-loop intake for Sample Trading Co. The app extracts Japanese invoices with an LLM, **recomputes amounts the same way the accounting API does**, puts every draft in a review queue, and only then POSTs. Nothing is registered automatically.

## Requirements

- Node.js 20+
- pnpm 11 (`packageManager` is set in `package.json`)
- Python 3.9+ (stdlib only — no pip)
- A Gemini API key by default ([Google AI Studio](https://aistudio.google.com/apikey)). OpenAI or Anthropic also work via env.

## Setup

```bash
cp .env.example .env
# Set GOOGLE_GENERATIVE_AI_API_KEY
pnpm install
```

Put the 12 sample files in `invoices/` at the repo root (they are gitignored; copy them from the assignment pack if they are not already there).

| Variable                       | Purpose                                                |
| ------------------------------ | ------------------------------------------------------ |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Default provider                                       |
| `AI_PROVIDER`                  | `google` (default), `openai`, or `anthropic`           |
| `AI_MODEL`                     | Override (code default for Google: `gemini-2.5-flash`) |
| `ACCOUNTING_API_URL`           | Default `http://localhost:8080`                        |
| `ACCOUNTING_API_KEY`           | Default `demo-key-1234`                                |

## Run (single command)

```bash
pnpm dev
```

This starts:

1. Mock accounting API at [http://localhost:8080](http://localhost:8080)
2. Next.js app at [http://localhost:3000](http://localhost:3000) (splash) and [http://localhost:3000/dashboard](http://localhost:3000/dashboard) (intake queue)

Verify the accounting API:

```bash
curl http://localhost:8080/health
```

Open http://localhost:3000, then **Open dashboard**. Upload a file or **Process samples**. **Review** opens a dialog (original on the left, draft on the right). **Save & re-check** does not call the LLM again. **Register** saves first, then POSTs the saved draft to the mock accounting API.

## Next.js API

The dashboard talks to **Next.js App Router** routes under `src/app/api/` (this is not Nest.js). Those routes own the intake queue (in-memory) and call the mock accounting API at `:8080` via `src/lib/accounting/client.ts`. Base URL: `http://localhost:3000`. No auth on these routes.

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/api/invoices/extract` | Extract a file or bundled sample into a job |
| `GET` | `/api/invoices` | List jobs (re-checks open jobs against booked invoices) |
| `GET` | `/api/invoices/:id` | One job (re-annotates issues unless failed/registered) |
| `PATCH` | `/api/invoices/:id` | Replace the draft and re-verify (no second LLM call) |
| `POST` | `/api/invoices/:id/register` | POST the **saved** draft to the accounting API |
| `GET` | `/api/partners` | Partner master (proxy of `GET :8080/partners`) |
| `GET` | `/api/samples` | Filenames in `invoices/` |
| `GET` | `/api/files/:name` | Original upload from `uploads/` (PDF or image) |

Job `status`: `extracted` → `needs_review` \| `ready` → `registered` \| `failed`. Register is only allowed when status is `ready` and there are no blocker issues.

### `POST /api/invoices/extract`

Two body shapes:

**Upload (multipart)**

```bash
curl -sS -X POST http://localhost:3000/api/invoices/extract \
  -F "file=@invoices/invoice_01.pdf"
```

**Bundled sample (JSON)** — reads `invoices/<name>` on disk:

```bash
curl -sS -X POST http://localhost:3000/api/invoices/extract \
  -H 'Content-Type: application/json' \
  -d '{"sample":"invoice_01.pdf"}'
```

| Status | Body |
| --- | --- |
| `201` | `{ "job": IntakeJob }` |
| `400` | `{ "error": "..." }` missing `file` / `sample` |
| `500` | `{ "error": "..." }` extraction or I/O failure |

### `GET /api/invoices`

```bash
curl -sS http://localhost:3000/api/invoices
```

`200` → `{ "jobs": IntakeJob[] }`. Open jobs are re-annotated (duplicates, unknown supplier, etc.) using `GET :8080/invoices`.

### `GET /api/invoices/:id`

```bash
curl -sS http://localhost:3000/api/invoices/<job_id>
```

| Status | Body |
| --- | --- |
| `200` | `{ "job": IntakeJob }` |
| `404` | `{ "error": "Job not found" }` |

### `PATCH /api/invoices/:id`

Replace the draft. Totals in the stored job are whatever you send; the UI recalculates from lines before save. Body may be `{ "draft": { ... } }` or the draft object itself.

```bash
curl -sS -X PATCH http://localhost:3000/api/invoices/<job_id> \
  -H 'Content-Type: application/json' \
  -d '{
    "draft": {
      "partner_code": "P-1001",
      "invoice_number": "YM-2026-0107",
      "issue_date": "2026-01-07",
      "due_date": "2026-02-28",
      "currency": "JPY",
      "lines": [
        {
          "description": "Precision part A-100",
          "quantity": 120,
          "unit": "個",
          "unit_price": 1250,
          "amount": 150000,
          "tax_code": "T10"
        }
      ],
      "subtotal": 150000,
      "tax_amount": 15000,
      "total_amount": 165000
    }
  }'
```

| Field | Type |
| --- | --- |
| `partner_code` | `string \| null` |
| `invoice_number` | `string` |
| `issue_date` / `due_date` | `YYYY-MM-DD` (`due_date` may be `null`) |
| `currency` | `"JPY"` |
| `lines[].description` | `string` |
| `lines[].quantity` / `unit_price` | `integer \| null` |
| `lines[].unit` | `string` |
| `lines[].amount` | integer JPY |
| `lines[].tax_code` | `"T10"` \| `"T08"` |
| `subtotal` / `tax_amount` / `total_amount` | integer JPY |

| Status | Body |
| --- | --- |
| `200` | `{ "job": IntakeJob }` |
| `400` | `{ "error": "Invalid draft", "details": ... }` |
| `404` | `{ "error": "Job not found" }` |
| `409` | `{ "error": "Registered invoices cannot be edited" }` |

### `POST /api/invoices/:id/register`

No body. Uses the **saved** server draft (unsaved form fields are ignored). Forwards to `POST :8080/invoices`.

```bash
curl -sS -X POST http://localhost:3000/api/invoices/<job_id>/register
```

| Status | Body |
| --- | --- |
| `201` | `{ "job": IntakeJob, "record": RegisteredInvoice }` |
| `400` | `{ "error": "No draft to register" }` |
| `404` | `{ "error": "Job not found" }` |
| `409` | already registered, or duplicate (`DUPLICATE_INVOICE` + `job`) |
| `422` | blockers remain, or missing `partner_code` / `due_date` |
| other | accounting API error: `{ "error": "<code>", "message": "...", "job": IntakeJob }` |

`RegisteredInvoice`: `accounting_id`, `partner_code`, `invoice_number`, dates, amounts, `line_count`.

### `GET /api/partners`

```bash
curl -sS http://localhost:3000/api/partners
```

`200` → `{ "partners": [{ "partner_code", "name", "aliases", "registration_no" }] }`. `502` if the mock API is down.

### `GET /api/samples`

```bash
curl -sS http://localhost:3000/api/samples
```

`200` → `{ "samples": ["invoice_01.pdf", ...] }`. `404` if `invoices/` is missing.

### `GET /api/files/:name`

Serves a file previously written under `uploads/` (basename only). Used as `job.document_url`.

```bash
curl -sS -o /tmp/doc.pdf http://localhost:3000/api/files/<stored_filename>
```

`200` with `Content-Type` `application/pdf`, `image/png`, or `image/jpeg`. `404` `{ "error": "File not found" }`.

### `IntakeJob` (JSON)

Returned by extract / list / get / patch / register:

| Field | Notes |
| --- | --- |
| `id` | Job id (`job_…`) |
| `source_filename` / `media_type` | Original file |
| `document_url` | `/api/files/…` |
| `status` | see above |
| `extracted` | LLM output (printed totals, handwriting, confidence) or `null` |
| `draft` | Editable API-shaped invoice or `null` |
| `partner_match` | Match result; `partner_code` is `null` if unmatched |
| `issues` | `{ code, severity: "blocker" \| "warning", message, field?, details? }` |
| `accounting_id` | Set after a successful register |
| `register_error` | Last register failure, if any |
| `created_at` / `updated_at` | ISO timestamps |

Jobs live in memory in the Next.js process. Restarting `pnpm dev` clears them.

## Demo (≤ 3 minutes)

Do not start the recording on an empty queue if you need all 12 — extraction takes several minutes. Process samples first (or process `invoice_10.jpg`, `invoice_09.pdf`, `invoice_01.pdf`, `invoice_07.jpg`, and one clean file such as `invoice_06.jpg`), then record.

1. **Queue** — 12 jobs. Point at Flags: `0 / 1 warn` vs a blocker. Status **needs review** on `invoice_10.jpg` (no partner).
2. **Blocker (10)** — Open review. Register is disabled. Supplier 新星ロジスティクス is not in the master; we did not guess a `partner_code`.
3. **Warning (09)** — Printed total ¥147,497 vs draft ¥147,496 (floor tax). We keep the recalculated total so the API will accept it.
4. **Duplicate warning (01 / 07)** — Same P-1001 + YM-2026-0107. Warning, not a blocker, so the first one can still be booked.
5. **Register** — Open a unique ready job (e.g. `invoice_06.jpg`). Save if you touch a field, then Register. Status becomes **registered**.
6. **Duplicate rejected** — Register `invoice_01.pdf`, then try `invoice_07.jpg`. Second call fails (409 / `DUPLICATE_INVOICE`); the remaining job becomes a blocker.

Reset bookings without restarting extraction:

```bash
curl -X DELETE http://localhost:8080/invoices -H 'X-API-Key: demo-key-1234'
```

Jobs are in-memory in the Next process. Restarting `pnpm dev` clears the queue; the accounting API likewise forgets bookings on restart.

## Scripts

| Command                         | Purpose                                                   |
| ------------------------------- | --------------------------------------------------------- |
| `pnpm dev`                      | Accounting API + Next.js                                  |
| `pnpm dev:web` / `pnpm dev:api` | One process only                                          |
| `pnpm test`                     | Vitest (verify, partner match, duplicates, draft mapping) |
| `pnpm lint`                     | Biome                                                     |
| `pnpm build`                    | Production Next build                                     |

## Notes

- `accounting_api.py` is the take-home mock. **Do not change its behaviour.**
- Totals posted to the API are always recomputed from lines (floor tax per `T10` / `T08`), not taken from the model or the printed 合計.
- Design notes and the 12-invoice table: [`SUBMISSION.md`](./SUBMISSION.md).

# Invoice Intake

Human-in-the-loop invoice intake for Sample Trading Co.: extract Japanese invoices with an LLM, verify amounts deterministically, let a person review, then register into the existing accounting API.

## Requirements

- Node.js 20+
- pnpm
- Python 3.9+ (stdlib only — no pip install)
- An LLM API key (Gemini by default; used in later batches)

## Setup

```bash
cp .env.example .env.local
# Set GOOGLE_GENERATIVE_AI_API_KEY in .env.local (needed once extraction lands)
pnpm install
```

## Run (single command)

```bash
pnpm dev
```

This starts:

1. Mock accounting API at [http://localhost:8080](http://localhost:8080)
2. Next.js app at [http://localhost:3000](http://localhost:3000)

Verify the accounting API:

```bash
curl http://localhost:8080/health
```

## Sample invoices

Twelve sample invoices live in `invoices/` (PDFs with text layers, scanned images, and one scanned PDF).

## Scripts

| Command | Purpose |
|---|---|
| `pnpm dev` | Accounting API + Next.js (recommended) |
| `pnpm dev:web` | Next.js only |
| `pnpm dev:api` | Accounting API only |
| `pnpm build` | Production build |

## Notes

- The mock accounting API (`accounting_api.py`) is copied from the take-home brief and must not be modified.
- Registered invoices are in-memory; restart the API or `DELETE /invoices` to reset.

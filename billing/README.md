# Borealis Design — Billing Documents

Branded, print-ready documents for the Chantel engagement, built on the Borealis
Design aurora identity (Inter + Instrument Serif, aurora gradient accents on a
clean white sheet for practical printing).

## Files

| File | What it is |
|------|------------|
| `invoice.html` | Invoice **BD-2026-001** — consulting work Apr 29 → present, total **$3,258.75** (travel billed at 50%). |
| `rate-scope.html` | One-page **Rate & Scope Sheet** — standard rate, how projects work, reusable fixed-project quote template, optional retainer line. |
| `fonts/embedded.css` | Inter + Instrument Serif (latin subset) embedded as base64 for offline, deterministic rendering. |
| `render.mjs` | Renders both HTML files to single-page US-Letter PDFs. |
| `Borealis-Design-Invoice-BD-2026-001.pdf` | Rendered invoice. |
| `Borealis-Design-Rate-and-Scope-Sheet.pdf` | Rendered rate & scope sheet. |

## Rebuild the PDFs

```bash
npm i -D playwright && npx playwright install chromium
node render.mjs
```

Edit the `.html` files to update figures, then re-run. Each sheet is sized to
exactly one Letter page.

## Notes

- **Retainer line** on the rate sheet has blank `__ hrs / $__` fields — fill in
  per client, or hard-code your standard retainer.
- These PDFs contain **client billing details (PII)**. They live on a working
  branch; do not merge them into the deployed marketing site.

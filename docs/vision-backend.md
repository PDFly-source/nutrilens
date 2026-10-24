# Vision backend (optional, for automatic food recognition)

NutriLens on GitHub Pages runs fully on-device: Tesseract.js OCR for labels,
Open Food Facts lookups for barcodes, and a curated dish database with user
confirmation for cooked food. No cloud AI is used or claimed in this mode.

To enable automatic vision recognition (ranked dish candidates with
confidence), deploy the included server endpoints to any Node host that can
keep secrets server-side (Vercel, Cloud Run, a VPS):

1. Deploy this repository as a standard Next.js server app (`next build && next start`).
2. Set `GEMINI_API_KEY` in the host's secret storage (never in the repo).
3. Point the static deployment at it by setting `NEXT_PUBLIC_VISION_API_URL=https://<your-host>`
   before running `npm run build:pages`.
4. The client calls only `POST <url>/api/analyze-cooked` and `POST <url>/api/analyze-image`.
   API keys never reach the browser bundle: only this public URL is inlined.

Endpoints:
- `POST /api/analyze-cooked` — ranked dish candidates, visible ingredients,
  optional portion estimate. The app still requires user confirmation when
  candidates are ambiguous (top < 0.65 confidence, or within 0.15 of second place).
- `POST /api/analyze-image` — packaged-label structured extraction.

Without a key on the server, both endpoints return HTTP 500 with
`configured: false` and the client falls back to local analysis with honest
messaging.

# Real-world pipeline validation

`scripts/real-world-validation.mjs` runs the REAL tesseract.js OCR engine
over rendered label fixtures and the live Open Food Facts API:

    python3 scripts/render-fixtures.py
    npx tsx scripts/real-world-validation.mjs

This validates the OCR + parsing pipeline end-to-end on synthetic labels —
it is not a claim about real-world recognition accuracy, and no phone camera
is involved.

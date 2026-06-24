# ExpiryGuard

ExpiryGuard is a mobile-first web app for scanning packaged product labels, reading expiry/manufacturing dates with PaddleOCR, and detecting barcodes in the browser.

## Features

- Android-first mobile camera scanner
- OCR label capture through FastAPI, PaddleOCR, and OpenCV
- ZXing browser barcode detection
- English and Hindi UI with instant language switching
- Splash, onboarding, dashboard, scanner, result review, product detail, alerts, and settings screens
- Local browser storage only, with no login, Firebase, or cloud database
- Status colors for safe, near-expiry, and expired products

## Project Structure

```text
app/                 Next.js App Router entry
components/          Mobile UI, scanner, result, alerts, settings
hooks/               i18n, theme, local inventory state
locales/             en.json and hi.json
services/            API client
utils/               Date parsing, status styling, class helpers
backend/api/         FastAPI app
backend/ocr/         PaddleOCR runner and extraction parser
backend/models/      API response models
backend/utils/       OpenCV image helpers
```

## Frontend Setup

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

For Android camera testing, use Chrome or Edge on the phone. Camera APIs require HTTPS or localhost, so expose the dev server with a trusted tunnel or run on a secure local setup for real-device testing.

## Backend Setup

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt
uvicorn backend.api.main:app --reload --host 0.0.0.0 --port 8000
```

PaddleOCR downloads OCR models the first time it runs. For Hindi scans, the backend tries Hindi and English OCR and keeps the stronger result.

## Environment

This app needs a free **Groq API key** to read product labels.

👉 **See [API_KEY_SETUP.md](./API_KEY_SETUP.md) for a simple step-by-step guide.**

Quick version — create a `.env.local` file in the project root:

```bash
NEXT_PUBLIC_API_URL=http://localhost:8000
GROQ_API_KEY=gsk_your_key_here
```

`.env.local` is gitignored, so your key is never uploaded to GitHub.

## API

`POST /scan`

Form data:

- `image`: product label image
- `barcode`: optional barcode detected in the browser
- `locale`: `en` or `hi`

Response:

```json
{
  "product_name": "Milk",
  "expiry_date": "12/08/2026",
  "mfd_date": "01/04/2026",
  "barcode": "8901234567890",
  "confidence": 0.93,
  "status": "near_expiry",
  "raw_text": []
}
```

## Notes

The app stores confirmed scans in `localStorage` on the device. It does not include authentication, Firebase, or any cloud database.

# ExpiryGuard Backend

Run the OCR API with:

```bash
uvicorn backend.api.main:app --reload --host 0.0.0.0 --port 8000
```

The `/scan` endpoint accepts an uploaded image, runs PaddleOCR, extracts expiry and manufacturing dates with keyword-aware regex rules, merges any barcode value supplied by the frontend, and returns a structured JSON response.

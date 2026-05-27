from typing import Optional

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware

from backend.models.scan import ScanResponse
from backend.ocr.engine import run_ocr
from backend.ocr.parser import parse_ocr_result
from backend.utils.image import decode_upload_image


app = FastAPI(title="ExpiryGuard OCR API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok", "service": "expiryguard-ocr"}


@app.post("/scan", response_model=ScanResponse)
async def scan(
    image: UploadFile = File(...),
    barcode: Optional[str] = Form(default=None),
    locale: str = Form(default="en"),
):
    if not image.content_type or not image.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Upload an image file")

    try:
        contents = await image.read()
        cv_image = decode_upload_image(contents)
        ocr_text = await run_in_threadpool(run_ocr, cv_image, locale)
        return parse_ocr_result(
            lines=ocr_text.lines,
            ocr_confidence=ocr_text.confidence,
            barcode=barcode,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail="OCR scan failed") from exc

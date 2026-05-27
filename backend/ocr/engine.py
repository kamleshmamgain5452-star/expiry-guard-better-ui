import base64
import json
import logging
import os
from typing import Any, List, Tuple
import requests

import cv2
import numpy as np

from backend.models.scan import OCRText

logger = logging.getLogger(__name__)

GROQ_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct"
GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"

def _get_groq_key() -> str:
    return os.environ.get("GROQ_API_KEY", "").strip()

_SYSTEM_PROMPT = """You are an expert OCR and metadata extraction system for packaged product labels.
Extract ALL visible text from the image. Pay special attention to:
- Expiry dates (EXP, EXPIRY, BEST BEFORE, BB, USE BY, USE BEFORE, BEST BY, समाप्ति तिथि)
- Manufacturing dates (MFD, MFG, PKD, PACKED, MANUFACTURED, manufacturing date, उत्पादन तिथि)
- Product name / brand name
- Barcodes (any digits printed below or near a barcode, typically 8 to 14 digits)
- Batch numbers, lot numbers

Return the extracted text as a JSON object with these fields:
{
  "all_text": ["line1", "line2", ...],
  "expiry_date": "DD/MM/YYYY or null if not found",
  "mfd_date": "DD/MM/YYYY or null if not found", 
  "product_name": "product name or null if not found",
  "barcode": "barcode number or null if not found",
  "confidence": 0.95
}

IMPORTANT:
- Return ONLY valid JSON, no markdown code blocks, no explanation.
- For dates, try to normalize to DD/MM/YYYY format. If ambiguous, keep as-is.
- If a barcode is visible, extract the numbers underneath it.
- Set confidence between 0.0 and 1.0 based on image clarity.
"""

def encode_image(image: np.ndarray) -> str:
    """Encode an OpenCV image to a base64 JPEG string."""
    h, w = image.shape[:2]
    max_dim = 1024
    if max(h, w) > max_dim:
        scale = max_dim / max(h, w)
        image = cv2.resize(image, (int(w * scale), int(h * scale)))

    success, buffer = cv2.imencode(".jpg", image, [cv2.IMWRITE_JPEG_QUALITY, 85])
    if not success:
        raise ValueError("Failed to encode image to JPEG.")
    return base64.b64encode(buffer).decode("utf-8")

def run_ocr(image: np.ndarray, locale: str = "en") -> OCRText:
    """Send image to Groq Vision API and return OCR results."""
    api_key = _get_groq_key()
    logger.info("Using Groq API key: %s...%s (len=%d)", api_key[:8], api_key[-4:], len(api_key))
    if not api_key:
        logger.error("GROQ_API_KEY is not set.")
        return OCRText(lines=["Error: GROQ_API_KEY is not set."], confidence=0.0)

    try:
        b64_image = encode_image(image)
    except Exception as exc:
        logger.exception("Image encoding failed.")
        return OCRText(lines=[f"Error: {str(exc)}"], confidence=0.0)

    payload = {
        "model": GROQ_MODEL,
        "messages": [
            {
                "role": "system",
                "content": _SYSTEM_PROMPT,
            },
            {
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": "Extract all text and structured dates from this product label. Return JSON only.",
                    },
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:image/jpeg;base64,{b64_image}",
                        },
                    },
                ],
            },
        ],
        "temperature": 0.1,
        "max_tokens": 1024,
    }

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }

    try:
        resp = requests.post(GROQ_API_URL, json=payload, headers=headers, timeout=30)
        resp.raise_for_status()
        response_data = resp.json()
        content = response_data["choices"][0]["message"]["content"].strip()
    except Exception as e:
        logger.exception("Groq API request failed.")
        return OCRText(lines=[f"Request failed: {str(e)}"], confidence=0.0)

    # Clean markdown formatting if any
    if content.startswith("```"):
        lines = content.split("\n")
        if lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        content = "\n".join(lines).strip()

    try:
        data = json.loads(content)
        confidence = float(data.get("confidence", 0.9))
        
        lines: List[str] = []
        for text_line in data.get("all_text", []):
            if str(text_line).strip():
                lines.append(str(text_line).strip())
                
        # Embed structured data for parser.py to intercept
        structured = {}
        for key in ("expiry_date", "mfd_date", "product_name", "barcode"):
            val = data.get(key)
            if val and val != "null" and str(val).lower() != "none":
                structured[key] = str(val)
                
        if structured:
            lines.append(f"__GROQ_STRUCTURED__:{json.dumps(structured)}")

        return OCRText(lines=lines, confidence=confidence)
    except Exception as exc:
        logger.warning("Failed to parse Groq response as JSON. Falling back to raw text lines.")
        return OCRText(lines=[line.strip() for line in content.split("\n") if line.strip()], confidence=0.5)

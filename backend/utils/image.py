from typing import Tuple

import cv2
import numpy as np


def decode_upload_image(contents: bytes) -> np.ndarray:
    if not contents:
        raise ValueError("Uploaded image is empty")

    array = np.frombuffer(contents, np.uint8)
    image = cv2.imdecode(array, cv2.IMREAD_COLOR)
    if image is None:
        raise ValueError("Uploaded file is not a valid image")
    return image


def prepare_for_ocr(image: np.ndarray) -> np.ndarray:
    height, width = image.shape[:2]
    image = resize_if_small(image, width, height)
    lab = cv2.cvtColor(image, cv2.COLOR_BGR2LAB)
    lightness, channel_a, channel_b = cv2.split(lab)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    enhanced = clahe.apply(lightness)
    merged = cv2.merge((enhanced, channel_a, channel_b))
    return cv2.cvtColor(merged, cv2.COLOR_LAB2BGR)


def resize_if_small(image: np.ndarray, width: int, height: int) -> np.ndarray:
    longest = max(width, height)
    if longest >= 1200:
        return image
    scale = 1200 / max(longest, 1)
    new_size: Tuple[int, int] = (int(width * scale), int(height * scale))
    return cv2.resize(image, new_size, interpolation=cv2.INTER_CUBIC)

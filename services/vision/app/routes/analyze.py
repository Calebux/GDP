import io
import time
import base64
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from PIL import Image
import numpy as np
from app.auth import verify_vision_auth

router = APIRouter(prefix="/v1", tags=["Analysis"])

class AnalyzeRequest(BaseModel):
    image_base64: str
    target_dpi: int | None = 300

class VisualBalance(BaseModel):
    center_of_mass_x: float # 0.0 (left) to 1.0 (right)
    center_of_mass_y: float # 0.0 (top) to 1.0 (bottom)
    horizontal_skew: float # -0.5 (left-heavy) to +0.5 (right-heavy)
    vertical_skew: float # -0.5 (top-heavy) to +0.5 (bottom-heavy)

class AnalyzeResponse(BaseModel):
    width: int
    height: int
    ink_coverage: float # 0.0 to 1.0 (portion of non-white/non-transparent pixels)
    density_ratio: float
    visual_balance: VisualBalance
    latency_ms: float

@router.post("/analyze", response_model=AnalyzeResponse)
async def analyze_visual_balance(
    req: AnalyzeRequest,
    auth: bool = Depends(verify_vision_auth),
):
    """
    Analyzes visual density, ink coverage, and center of visual mass.
    """
    start_time = time.perf_counter()
    try:
        raw_b64 = req.image_base64
        if "," in raw_b64:
            raw_b64 = raw_b64.split(",", 1)[1]

        image_data = base64.b64decode(raw_b64)
        img = Image.open(io.BytesIO(image_data)).convert("RGBA")

        arr = np.array(img)
        w, h = img.width, img.height

        # Alpha channel & luminance
        alpha = arr[:, :, 3] / 255.0
        r, g, b = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2]
        luminance = 0.299 * r + 0.587 * g + 0.114 * b

        # Ink detection: pixel is inked if alpha > 0.1 and not pure white (lum < 245)
        ink_mask = (alpha > 0.1) & (luminance < 245)
        total_pixels = w * h
        ink_pixel_count = np.sum(ink_mask)
        ink_coverage = float(ink_pixel_count / max(1, total_pixels))

        # Weight matrix for center of mass: darker and more opaque = higher mass
        mass_matrix = (255.0 - luminance) * alpha
        total_mass = np.sum(mass_matrix)

        if total_mass > 0:
            y_indices, x_indices = np.indices((h, w))
            com_x = float(np.sum(x_indices * mass_matrix) / (total_mass * w))
            com_y = float(np.sum(y_indices * mass_matrix) / (total_mass * h))
        else:
            com_x, com_y = 0.5, 0.5

        latency_ms = (time.perf_counter() - start_time) * 1000

        return AnalyzeResponse(
            width=w,
            height=h,
            ink_coverage=round(ink_coverage, 4),
            density_ratio=round(min(1.0, ink_coverage * 2.5), 4),
            visual_balance=VisualBalance(
                center_of_mass_x=round(com_x, 3),
                center_of_mass_y=round(com_y, 3),
                horizontal_skew=round(com_x - 0.5, 3),
                vertical_skew=round(com_y - 0.5, 3),
            ),
            latency_ms=latency_ms,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Vision analysis failed: {str(e)}")

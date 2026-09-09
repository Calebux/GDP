import io
import time
import base64
from fastapi import APIRouter, Depends, File, UploadFile, HTTPException, Response
from pydantic import BaseModel
from PIL import Image
from rembg import remove, new_session
from app.auth import verify_vision_auth
from app.config import settings

router = APIRouter(prefix="/v1", tags=["Cutout"])

# Cache rembg session
session = new_session(settings.model_name)

class Base64CutoutRequest(BaseModel):
    image_base64: str
    pack_id: str | None = None

class CutoutResponse(BaseModel):
    image_base64: str
    width: int
    height: int
    latency_ms: float
    subject_box: list[int] | None = None

@router.post("/cutout", response_class=Response)
async def remove_background_file(
    file: UploadFile = File(...),
    auth: bool = Depends(verify_vision_auth),
):
    """
    Direct multipart image upload -> returns transparent PNG cutout.
    """
    start_time = time.perf_counter()
    content = await file.read()

    if len(content) > settings.max_image_size_mb * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Image size exceeds maximum limit")

    try:
        input_image = Image.open(io.BytesIO(content)).convert("RGBA")
        output_image = remove(input_image, session=session)

        buf = io.BytesIO()
        output_image.save(buf, format="PNG")
        png_bytes = buf.getvalue()

        latency_ms = (time.perf_counter() - start_time) * 1000

        return Response(
            content=png_bytes,
            media_type="image/png",
            headers={
                "X-Vision-Latency-Ms": f"{latency_ms:.2f}",
                "X-Vision-Model": settings.model_name,
            },
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Cutout processing failed: {str(e)}")

@router.post("/cutout/json", response_model=CutoutResponse)
async def remove_background_json(
    req: Base64CutoutRequest,
    auth: bool = Depends(verify_vision_auth),
):
    """
    JSON base64 cutout for RPC invocation from Node / Next.js.
    """
    start_time = time.perf_counter()
    try:
        raw_b64 = req.image_base64
        if "," in raw_b64:
            raw_b64 = raw_b64.split(",", 1)[1]

        image_data = base64.b64decode(raw_b64)
        input_image = Image.open(io.BytesIO(image_data)).convert("RGBA")
        output_image = remove(input_image, session=session)

        # Get bounding box of non-alpha content
        bbox = output_image.getbbox() # (left, upper, right, lower)

        buf = io.BytesIO()
        output_image.save(buf, format="PNG")
        output_b64 = base64.b64encode(buf.getvalue()).decode("utf-8")

        latency_ms = (time.perf_counter() - start_time) * 1000

        return CutoutResponse(
            image_base64=f"data:image/png;base64,{output_b64}",
            width=output_image.width,
            height=output_image.height,
            latency_ms=latency_ms,
            subject_box=list(bbox) if bbox else None,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Cutout JSON processing failed: {str(e)}")

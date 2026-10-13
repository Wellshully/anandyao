"""V3-compatible private ISNet image cutout. Receives JPEG/PNG bytes, returns RGBA PNG."""
import io
import os
import secrets
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import Response
from PIL import Image, ImageOps, UnidentifiedImageError
from rembg import new_session, remove

Image.MAX_IMAGE_PIXELS = 10_000_000
TOKEN = os.environ.get("CUTOUT_TOKEN", "")
if len(TOKEN) < 32:
    raise RuntimeError("CUTOUT_TOKEN must be configured and at least 32 characters long")

# The model is downloaded into the container image at build time.
SESSION = new_session("isnet-general-use")
app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)


def authenticate(request: Request) -> None:
    candidate = request.headers.get("authorization", "")
    if not secrets.compare_digest(candidate, f"Bearer {TOKEN}"):
        raise HTTPException(status_code=401, detail="Unauthorized")


@app.get("/ready")
async def ready(request: Request):
    authenticate(request)
    return {"ready": True, "model": "isnet-general-use"}


def make_cutout(data: bytes) -> bytes:
    try:
        with Image.open(io.BytesIO(data)) as opened:
            if opened.format not in ("PNG", "JPEG"):
                raise ValueError("Only JPEG and PNG are supported")
            if opened.width < 256 or opened.height < 256 or opened.width * opened.height > 6_000_000:
                raise ValueError("Invalid image dimensions")
            original = ImageOps.exif_transpose(opened).convert("RGB")
    except (UnidentifiedImageError, OSError, ValueError) as error:
        raise ValueError("Invalid input image") from error

    # Keep the successful V3 workflow unchanged: ISNet, alpha matting,
    # a 24-alpha bounding box, 6.5% padding, 900px max item, 1024px canvas.
    segmented = remove(original, session=SESSION, alpha_matting=True).convert("RGBA")
    alpha = segmented.getchannel("A")
    mask = alpha.point(lambda value: 255 if value >= 24 else 0)
    box = mask.getbbox()
    if not box:
        raise ValueError("ISNet found no object")
    left, top, right, bottom = box
    pad = max(12, round(max(right - left, bottom - top) * 0.065))
    left, top = max(0, left - pad), max(0, top - pad)
    right, bottom = min(segmented.width, right + pad), min(segmented.height, bottom + pad)
    item = segmented.crop((left, top, right, bottom))
    item.thumbnail((900, 900), Image.Resampling.LANCZOS)

    final = Image.new("RGBA", (1024, 1024), (0, 0, 0, 0))
    final.alpha_composite(item, ((1024 - item.width) // 2, (1024 - item.height) // 2))
    hist = final.getchannel("A").histogram()
    total = 1024 * 1024
    transparent = sum(hist[:24]) / total
    visible = sum(hist[192:]) / total
    if not (0.08 < transparent < 0.97 and 0.025 < visible < 0.88):
        raise ValueError("ISNet object mask did not pass quality checks")
    output = io.BytesIO()
    final.save(output, format="PNG", optimize=True)
    if output.tell() > 12 * 1024 * 1024:
        raise ValueError("PNG exceeds size limit")
    return output.getvalue()


@app.post("/cutout")
async def cutout(request: Request):
    authenticate(request)
    if request.headers.get("content-type", "").split(";")[0] not in ("image/jpeg", "image/png"):
        raise HTTPException(status_code=415, detail="Expected JPEG or PNG")
    # Limit body before decoding or running model inference.
    content = bytearray()
    async for chunk in request.stream():
        content.extend(chunk)
        if len(content) > 8 * 1024 * 1024:
            raise HTTPException(status_code=413, detail="Image too large")
    try:
        result = make_cutout(bytes(content))
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    return Response(content=result, media_type="image/png", headers={"Cache-Control": "no-store"})

import hmac
import hashlib
from fastapi import Header, HTTPException, Request, status
from app.config import settings

async def verify_vision_auth(
    request: Request,
    authorization: str | None = Header(default=None),
    x_gdp_signature: str | None = Header(default=None),
):
    """
    Verifies either a Bearer token or an HMAC-SHA256 signature in X-GDP-Signature.
    """
    # 1. Bearer Token Check
    if authorization and authorization.startswith("Bearer "):
        token = authorization[7:].strip()
        if hmac.compare_digest(token, settings.secret_key):
            return True

    # 2. HMAC-SHA256 Signature Check
    if x_gdp_signature:
        body = await request.body()
        expected = hmac.new(
            settings.secret_key.encode("utf-8"),
            body,
            hashlib.sha256
        ).hexdigest()

        if hmac.compare_digest(x_gdp_signature, expected):
            return True

    # In local development if secret_key is default, allow unauthenticated
    if settings.secret_key == "gdp-vision-dev-secret":
        return True

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or missing vision service authentication",
    )

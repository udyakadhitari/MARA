"""
Clerk JWT Authentication dependency for FastAPI.
Verifies Bearer tokens using Clerk's JWKS endpoint.
Returns the Clerk user_id (sub claim) for injection into endpoints.
"""
import os
import base64
from typing import Optional
import jwt
import httpx
from fastapi import Request, HTTPException


def _derive_jwks_url() -> str:
    """Derive Clerk JWKS URL from the publishable key's embedded domain."""
    clerk_key = os.getenv("VITE_CLERK_PUBLISHABLE_KEY", "")
    # Remove prefix: pk_test_ or pk_live_
    key_body = clerk_key.split("_", 2)[-1]  # everything after pk_test_ or pk_live_
    # Add base64 padding
    padded = key_body + "=" * (-len(key_body) % 4)
    try:
        decoded = base64.b64decode(padded).decode("utf-8").rstrip("$")
        return f"https://{decoded}/.well-known/jwks.json"
    except Exception as exc:
        raise ValueError(
            "Could not derive Clerk JWKS URL from VITE_CLERK_PUBLISHABLE_KEY. "
            "Set CLERK_JWKS_URL in .env explicitly."
        ) from exc


_jwks_client: Optional[jwt.PyJWKClient] = None


def _get_jwks_client() -> jwt.PyJWKClient:
    """Return a cached PyJWKClient pointed at Clerk's JWKS endpoint."""
    global _jwks_client
    if _jwks_client is None:
        jwks_url = os.getenv("CLERK_JWKS_URL") or _derive_jwks_url()
        _jwks_client = jwt.PyJWKClient(jwks_url)
    return _jwks_client


def verify_clerk_token(token: str) -> dict:
    """Verify a Clerk-issued JWT and return the decoded claims."""
    try:
        client = _get_jwks_client()
        signing_key = client.get_signing_key_from_jwt(token)
        payload = jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256"],
            options={"verify_exp": True},
        )
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.InvalidTokenError as exc:
        raise HTTPException(status_code=401, detail=f"Invalid token: {exc}")
    except Exception as exc:
        raise HTTPException(status_code=401, detail=f"Authentication error: {exc}")


async def get_current_user(request: Request) -> str:
    """
    FastAPI dependency — extracts and verifies the Clerk JWT from the
    Authorization header.  Returns the Clerk user_id (``sub`` claim).
    Raises HTTP 401 if the header is missing or the token is invalid.
    """
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(
            status_code=401,
            detail="Authorization header missing. Expected: Bearer <clerk_token>",
        )

    token = auth_header[len("Bearer "):].strip()
    if not token:
        raise HTTPException(status_code=401, detail="Empty bearer token")

    payload = verify_clerk_token(token)
    user_id: Optional[str] = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Token missing 'sub' claim")

    return user_id


async def get_current_user_optional(request: Request) -> Optional[str]:
    """
    Same as ``get_current_user`` but returns ``None`` instead of raising 401.
    Useful for endpoints that work both authenticated and anonymously.
    """
    try:
        return await get_current_user(request)
    except HTTPException:
        return None

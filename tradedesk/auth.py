"""Authentication: register / login / me, plus the current-user dependency.

Simple username + password auth issuing a JWT. The token carries the user id;
``current_user`` resolves it on every protected request. Per-user provider keys
are managed here too (stored encrypted on the user row).
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from . import models, schemas, security
from .db import get_session

router = APIRouter(prefix="/auth", tags=["auth"])


def _user_out(user: models.User) -> schemas.UserOut:
    return schemas.UserOut(
        id=user.id,
        username=user.username,
        email=user.email,
        provider_keys=sorted((user.encrypted_keys or {}).keys()),
    )


def current_user(
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_session),
) -> models.User:
    """Resolve the bearer token to a User, or raise 401."""
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = authorization.split(" ", 1)[1].strip()
    user_id = security.decode_token(token)
    if user_id is None:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    user = db.get(models.User, user_id)
    if user is None:
        raise HTTPException(status_code=401, detail="User no longer exists")
    return user


@router.post("/register", response_model=schemas.TokenResponse)
def register(req: schemas.RegisterRequest, db: Session = Depends(get_session)) -> schemas.TokenResponse:
    username = req.username.strip().lower()
    existing = db.scalar(select(models.User).where(models.User.username == username))
    if existing:
        raise HTTPException(status_code=409, detail="Username already taken")
    user = models.User(
        username=username,
        email=req.email,
        password_hash=security.hash_password(req.password),
        encrypted_keys={},
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    token = security.create_access_token(user.id)
    return schemas.TokenResponse(access_token=token, user=_user_out(user))


@router.post("/login", response_model=schemas.TokenResponse)
def login(req: schemas.LoginRequest, db: Session = Depends(get_session)) -> schemas.TokenResponse:
    username = req.username.strip().lower()
    user = db.scalar(select(models.User).where(models.User.username == username))
    if user is None or not security.verify_password(req.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid username or password")
    token = security.create_access_token(user.id)
    return schemas.TokenResponse(access_token=token, user=_user_out(user))


@router.get("/me", response_model=schemas.UserOut)
def me(user: models.User = Depends(current_user)) -> schemas.UserOut:
    return _user_out(user)


@router.post("/provider-key", response_model=schemas.UserOut)
def set_provider_key(
    req: schemas.SetProviderKeyRequest,
    user: models.User = Depends(current_user),
    db: Session = Depends(get_session),
) -> schemas.UserOut:
    """Store (or clear, if api_key is empty) a per-user provider key, encrypted."""
    from .providers import canonical_provider

    provider = canonical_provider(req.provider)
    if provider is None:
        raise HTTPException(status_code=400, detail=f"Unknown provider '{req.provider}'")

    keys = dict(user.encrypted_keys or {})
    if req.api_key.strip():
        keys[provider] = security.encrypt_key(req.api_key.strip())
    else:
        keys.pop(provider, None)
    user.encrypted_keys = keys
    db.add(user)
    db.commit()
    db.refresh(user)
    return _user_out(user)

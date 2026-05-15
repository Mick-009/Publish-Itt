"""
Phase 3a: Wow-moment onboarding.

Serves the curated sample excerpts and Thad reads to the first-run flow,
and tracks whether the user has completed (or skipped) onboarding so we
know whether to gate them on it.

Design notes:
- The actual content lives in `data/onboarding_samples.json` next to the
  backend root. It's loaded once at module import. To update the demo,
  edit the JSON and restart the server.
- The "onboarding_complete" flag lives on the users collection. It's
  added lazily — existing users without the field are treated as
  incomplete (i.e. they'll see the onboarding on next sign-in), which
  is acceptable for v1. If you want existing users to skip it, run
  the one-line migration: db.users.update_many({}, {"$set":
  {"onboarding_complete": True}}).
- No auth gymnastics. Both endpoints require a valid JWT.
"""
from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

logger = logging.getLogger(__name__)


# Resolve the samples file once at import time. Falling back gracefully
# if the file is missing means the rest of the server still starts —
# we just return a 503 from the samples endpoint with a clear message.
_SAMPLES_PATH = Path(__file__).parent / "data" / "onboarding_samples.json"
_SAMPLES_CACHE: Optional[dict] = None


def _load_samples() -> dict:
    """Read and parse the samples file. Cached after first successful read."""
    global _SAMPLES_CACHE
    if _SAMPLES_CACHE is not None:
        return _SAMPLES_CACHE
    if not _SAMPLES_PATH.exists():
        raise FileNotFoundError(
            f"Onboarding samples file not found at {_SAMPLES_PATH}. "
            "Place onboarding_samples.json under backend/data/."
        )
    with open(_SAMPLES_PATH, "r", encoding="utf-8") as f:
        _SAMPLES_CACHE = json.load(f)
    return _SAMPLES_CACHE


def reload_samples() -> dict:
    """Force a reload — useful during development. Not exposed via HTTP."""
    global _SAMPLES_CACHE
    _SAMPLES_CACHE = None
    return _load_samples()


# ============================================================================
# Models
# ============================================================================

class OnboardingStatusResponse(BaseModel):
    onboarding_complete: bool


class OnboardingCompleteRequest(BaseModel):
    # Optional metadata — what genre they picked, whether they skipped.
    # Stored on the user doc so we can analyze the funnel later if we want.
    chosen_genre: Optional[str] = None
    skipped: bool = False


# ============================================================================
# Router builder
# ============================================================================

def build_router(
    *,
    db: Any,
    get_current_user_dep: Any,
) -> APIRouter:
    """Build the onboarding router.

    Args:
        db: motor MongoDB database
        get_current_user_dep: the existing Depends(get_current_user) value,
            passed already-wrapped so we don't need to re-import the dep
    """
    router = APIRouter(prefix="/api/onboarding", tags=["onboarding"])

    @router.get("/samples")
    async def get_samples(current_user=get_current_user_dep) -> dict:
        """Return the full samples JSON. Auth-gated to avoid casual scraping."""
        try:
            return _load_samples()
        except FileNotFoundError as e:
            logger.error("Onboarding samples missing: %s", e)
            raise HTTPException(
                status_code=503,
                detail="Onboarding samples unavailable. Try again?",
            )
        except json.JSONDecodeError as e:
            logger.error("Onboarding samples JSON invalid: %s", e)
            raise HTTPException(
                status_code=503,
                detail="Onboarding samples couldn't be read.",
            )

    @router.get("/status", response_model=OnboardingStatusResponse)
    async def get_status(current_user=get_current_user_dep) -> OnboardingStatusResponse:
        """Return whether this user has finished onboarding.

        Reads directly from the users collection so a stale UserOut on the
        token doesn't cause loops (e.g. user just completed onboarding,
        triggers re-fetch, still sees complete=False because the token's
        cached payload is old).
        """
        doc = await db.users.find_one(
            {"id": current_user.id}, {"_id": 0, "onboarding_complete": 1}
        )
        # Missing field = incomplete. This means existing users will see
        # the onboarding on next sign-in unless explicitly migrated.
        complete = bool(doc and doc.get("onboarding_complete", False))
        return OnboardingStatusResponse(onboarding_complete=complete)

    @router.post("/complete", response_model=OnboardingStatusResponse)
    async def mark_complete(
        request: OnboardingCompleteRequest,
        current_user=get_current_user_dep,
    ) -> OnboardingStatusResponse:
        """Mark the user's onboarding as complete (whether finished or skipped)."""
        update: dict = {"onboarding_complete": True}
        if request.chosen_genre:
            update["onboarding_chosen_genre"] = request.chosen_genre
        if request.skipped:
            update["onboarding_skipped"] = True
        await db.users.update_one(
            {"id": current_user.id}, {"$set": update}
        )
        return OnboardingStatusResponse(onboarding_complete=True)

    @router.post("/reset", response_model=OnboardingStatusResponse)
    async def reset(current_user=get_current_user_dep) -> OnboardingStatusResponse:
        """Reset the user's onboarding flag so they see the flow again.

        Used by the 'Replay the intro' link in settings.
        """
        await db.users.update_one(
            {"id": current_user.id},
            {"$set": {"onboarding_complete": False}},
        )
        return OnboardingStatusResponse(onboarding_complete=False)

    return router


# ============================================================================
# Index hint — called once at startup
# ============================================================================

async def ensure_indexes(db: Any) -> None:
    """No new indexes needed — we query users by id which is already indexed.

    Kept here for symmetry with thad_revisions.ensure_indexes so server.py
    can call both consistently from its startup handler.
    """
    return None

"""
Share-a-chapter — backend module.

The author sends a chapter (or, in a future v2, a small set of chapters) to
a reader via a public link. The reader opens the link with no account, sets
a display name on first visit, reads, and leaves notes. Notes flow into the
author's existing Notes system with `note_type = "reader_feedback"`.

Module layout matches `thad_revisions.py` and `onboarding.py`:
  - Pydantic models near the top
  - `ensure_indexes(db)` for the new collection
  - `build_router(db, get_current_user_dep)` returns the APIRouter

The router exposes two prefix groups:
  /api/shares/*        — author endpoints, all authenticated
  /api/public/shares/* — reader endpoints, no auth

The /public/ namespace is the only unauthenticated surface in the app. The
URL prefix makes that security boundary visible at a glance — if a route
needs auth and it's under /public/, someone has miswired something.

Note attribution: reader notes are inserted with the AUTHOR's user_id so
they show up in the author's notes panel and respect user-scoped queries.
The reader's name is stored on the note itself in the `reader_name` field
(safe to add — db.notes uses `model_config = ConfigDict(extra="ignore")`).
"""

import logging
import uuid
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field

logger = logging.getLogger(__name__)


# ── Pydantic models ─────────────────────────────────────────────────────────


class ShareCreate(BaseModel):
    """Body for POST /api/shares — what the author sends."""

    project_id: str
    # Always a list. v1 always sends length 1. v2 (rounds-of-chapters) just
    # raises the length. No migration needed when v2 ships.
    chapter_ids: List[str]
    # Optional display title. Defaults to the chapter's own title if length 1.
    title: Optional[str] = None
    # Optional expiry. v1 UI doesn't surface this but the column exists so
    # we don't need a schema migration when we add it.
    expires_at: Optional[str] = None


class ShareUpdate(BaseModel):
    """Body for PATCH /api/shares/{id} — v1 only supports revoke."""

    revoked: Optional[bool] = None


class Share(BaseModel):
    """A share document as the author sees it."""

    model_config = ConfigDict(extra="ignore")

    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str  # author
    project_id: str
    chapter_ids: List[str]
    title: str = ""  # always populated server-side
    created_at: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )
    expires_at: Optional[str] = None
    revoked: bool = False
    # Read receipts — incremented when a distinct reader_name opens it.
    # Quiet metric, not a full audit log.
    reader_count: int = 0
    note_count: int = 0


class PublicSharedChapter(BaseModel):
    """A chapter as the READER sees it through a public share."""

    title: str
    content_html: str


class PublicShareResponse(BaseModel):
    """What GET /api/public/shares/{id} returns to the reader."""

    title: str
    author_display_name: str
    chapters: List[PublicSharedChapter]
    is_revoked: bool = False
    is_expired: bool = False


class PublicNoteCreate(BaseModel):
    """Body for POST /api/public/shares/{id}/notes — what the reader sends."""

    reader_name: str
    note_text: str
    # The highlighted snippet (truncated to ~200 chars frontend-side), or
    # empty when the note is a general "How did it land?" impression.
    location_reference: str = ""
    is_general_impression: bool = False


class PublicNoteResponse(BaseModel):
    """Tiny acknowledgement returned to the reader — no other fields exposed."""

    id: str
    created_at: str


# ── Indexes ─────────────────────────────────────────────────────────────────


async def ensure_indexes(db) -> None:
    """Create indexes for the shares collection. Safe to call multiple times."""
    await db.shares.create_index([("user_id", 1)])
    await db.shares.create_index([("user_id", 1), ("project_id", 1)])
    # `id` is the public lookup key — fast path for unauthenticated reads.
    await db.shares.create_index([("id", 1)], unique=True)
    logger.info("Share indexes created/verified.")


# ── Helpers ─────────────────────────────────────────────────────────────────


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _is_expired(share: dict) -> bool:
    """True if the share has an expires_at in the past. None = no expiry."""
    expires_at = share.get("expires_at")
    if not expires_at:
        return False
    try:
        # Stored as ISO with timezone. fromisoformat handles +00:00 since 3.11.
        return datetime.fromisoformat(expires_at) <= datetime.now(timezone.utc)
    except ValueError:
        logger.warning("Unparseable expires_at on share %s: %r", share.get("id"), expires_at)
        return False


def _strip_user(share: dict) -> dict:
    """Drop Mongo internals before returning to the client."""
    share.pop("_id", None)
    return share


# ── Router ──────────────────────────────────────────────────────────────────


def build_router(db, get_current_user_dep) -> APIRouter:
    """Build the share router with db + auth dependency injected.

    Matches the pattern used by thad_revisions and onboarding so server.py
    composition stays consistent.
    """

    router = APIRouter(tags=["shares"])

    # ── Author endpoints ────────────────────────────────────────────────

    @router.post("/api/shares", response_model=Share)
    async def create_share(body: ShareCreate, current_user=get_current_user_dep):
        # Ownership: confirm the project belongs to this user, and confirm
        # every chapter belongs to that project. Anything else is a 404 —
        # don't leak whether the IDs exist for someone else.
        project = await db.projects.find_one(
            {"id": body.project_id, "user_id": current_user.id},
            {"_id": 0, "id": 1},
        )
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")

        if not body.chapter_ids:
            raise HTTPException(status_code=422, detail="At least one chapter required")

        # Validate all chapters at once. Mongo returns them in arbitrary order
        # but we just need the count to match.
        owned_chapters = await db.chapters.find(
            {"id": {"$in": body.chapter_ids}, "project_id": body.project_id},
            {"_id": 0, "id": 1, "title": 1},
        ).to_list(len(body.chapter_ids))
        if len(owned_chapters) != len(body.chapter_ids):
            raise HTTPException(status_code=404, detail="Chapter not found")

        # Default title: the chapter's title if it's a single-chapter share,
        # otherwise the project title. Author can override via the body.
        title = (body.title or "").strip()
        if not title:
            if len(owned_chapters) == 1:
                title = owned_chapters[0].get("title") or "Untitled chapter"
            else:
                project_doc = await db.projects.find_one(
                    {"id": body.project_id}, {"_id": 0, "title": 1}
                )
                title = (project_doc or {}).get("title") or "Untitled"

        share = Share(
            user_id=current_user.id,
            project_id=body.project_id,
            chapter_ids=body.chapter_ids,
            title=title,
            expires_at=body.expires_at,
        )
        await db.shares.insert_one(share.model_dump())
        return share

    @router.get("/api/shares", response_model=List[Share])
    async def list_shares(
        project_id: Optional[str] = None, current_user=get_current_user_dep
    ):
        """Author lists their shares. Filter by project optional."""
        query = {"user_id": current_user.id}
        if project_id:
            query["project_id"] = project_id
        cursor = db.shares.find(query, {"_id": 0}).sort("created_at", -1)
        return await cursor.to_list(1000)

    @router.get("/api/shares/{share_id}", response_model=Share)
    async def get_share(share_id: str, current_user=get_current_user_dep):
        share = await db.shares.find_one(
            {"id": share_id, "user_id": current_user.id}, {"_id": 0}
        )
        if not share:
            raise HTTPException(status_code=404, detail="Share not found")
        return share

    @router.patch("/api/shares/{share_id}", response_model=Share)
    async def update_share(
        share_id: str, body: ShareUpdate, current_user=get_current_user_dep
    ):
        # v1 supports revoke only. Other fields ignored. We accept a partial
        # update body so v2 can extend without breaking the contract.
        updates: dict = {}
        if body.revoked is not None:
            updates["revoked"] = body.revoked

        if not updates:
            # No-op — return current state. Don't 422 since "send the same
            # body twice" shouldn't fail.
            share = await db.shares.find_one(
                {"id": share_id, "user_id": current_user.id}, {"_id": 0}
            )
            if not share:
                raise HTTPException(status_code=404, detail="Share not found")
            return share

        result = await db.shares.update_one(
            {"id": share_id, "user_id": current_user.id}, {"$set": updates}
        )
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Share not found")

        share = await db.shares.find_one({"id": share_id}, {"_id": 0})
        return share

    @router.get("/api/shares/{share_id}/notes")
    async def get_share_notes(share_id: str, current_user=get_current_user_dep):
        """All reader_feedback notes that came in through this share.

        Returns them newest-first. Frontend groups by reader_name client-side.
        """
        # Confirm ownership of the share first — don't let one user fish for
        # another user's reader notes by ID.
        share = await db.shares.find_one(
            {"id": share_id, "user_id": current_user.id}, {"_id": 0, "id": 1}
        )
        if not share:
            raise HTTPException(status_code=404, detail="Share not found")

        cursor = db.notes.find(
            {"share_id": share_id, "note_type": "reader_feedback"}, {"_id": 0}
        ).sort("created_at", -1)
        return await cursor.to_list(1000)

    # ── Public endpoints (NO auth dependency) ───────────────────────────
    #
    # Note: these endpoints intentionally do NOT include `current_user` in
    # their signature. That's the entire mechanism — FastAPI doesn't run the
    # auth dependency if it's not requested. The /api/public/* URL prefix
    # makes the boundary visible.

    @router.get("/api/public/shares/{share_id}", response_model=PublicShareResponse)
    async def public_get_share(share_id: str):
        share = await db.shares.find_one({"id": share_id}, {"_id": 0})
        if not share:
            raise HTTPException(status_code=404, detail="Share not found")

        revoked = bool(share.get("revoked"))
        expired = _is_expired(share)

        # If revoked or expired, we still return a 200 with the flag set so
        # the reader sees a "this link is no longer active" page instead of
        # a generic 404. Better experience for the reader and reveals nothing
        # they shouldn't see (the share existed; the author chose to stop it).
        if revoked or expired:
            return PublicShareResponse(
                title=share.get("title", ""),
                author_display_name="",
                chapters=[],
                is_revoked=revoked,
                is_expired=expired,
            )

        # Pull the author's display name. Falls back to the local part of
        # their email if display_name was never set.
        author = await db.users.find_one(
            {"id": share["user_id"]},
            {"_id": 0, "display_name": 1, "email": 1, "pen_name": 1, "use_pen_name": 1},
        )
        author_name = ""
        if author:
            if author.get("use_pen_name") and (author.get("pen_name") or "").strip():
                author_name = author["pen_name"].strip()
            elif author.get("display_name"):
                author_name = author["display_name"]
            else:
                author_name = author["email"].split("@")[0].replace(".", " ").title()

        # Fetch chapters in the order specified by chapter_ids. Mongo's $in
        # returns arbitrary order, so we re-sort client-side to honour intent.
        chapters_raw = await db.chapters.find(
            {"id": {"$in": share["chapter_ids"]}},
            {"_id": 0, "id": 1, "title": 1, "content": 1},
        ).to_list(len(share["chapter_ids"]))
        by_id = {c["id"]: c for c in chapters_raw}
        ordered = [by_id[cid] for cid in share["chapter_ids"] if cid in by_id]

        chapters_out = [
            PublicSharedChapter(
                title=c.get("title") or "Untitled chapter",
                content_html=c.get("content") or "",
            )
            for c in ordered
        ]

        return PublicShareResponse(
            title=share.get("title", ""),
            author_display_name=author_name,
            chapters=chapters_out,
            is_revoked=False,
            is_expired=False,
        )

    @router.post(
        "/api/public/shares/{share_id}/notes", response_model=PublicNoteResponse
    )
    async def public_post_note(share_id: str, body: PublicNoteCreate):
        # Look up the share. Reject if revoked or expired — a note coming in
        # after revocation likely means a tab was left open and the author
        # then cut access. Honour their intent.
        share = await db.shares.find_one({"id": share_id}, {"_id": 0})
        if not share:
            raise HTTPException(status_code=404, detail="Share not found")
        if share.get("revoked"):
            raise HTTPException(status_code=410, detail="This share is no longer active")
        if _is_expired(share):
            raise HTTPException(status_code=410, detail="This share has expired")

        # Minimal validation. The reader_name and note_text are required;
        # anything else is optional. Trim aggressively so empty-string-with-
        # whitespace doesn't slip through.
        reader_name = (body.reader_name or "").strip()
        note_text = (body.note_text or "").strip()
        if not reader_name:
            raise HTTPException(status_code=422, detail="A name is required")
        if len(reader_name) > 80:
            reader_name = reader_name[:80]
        if not note_text:
            raise HTTPException(status_code=422, detail="Note can't be empty")
        if len(note_text) > 5000:
            note_text = note_text[:5000]

        # Truncate the location reference so a deranged selection doesn't
        # blow up storage. 240 leaves room for a sentence-and-change.
        location_ref = (body.location_reference or "").strip()
        if len(location_ref) > 240:
            location_ref = location_ref[:240]

        # First note from this reader on this share? If so, bump reader_count
        # on the share. Cheap distinct-check by (share_id, reader_name) —
        # imperfect (a reader can rename themselves), but matches the casual
        # spirit of the feature. Authors who want stricter analytics can ask.
        existing = await db.notes.find_one(
            {
                "share_id": share_id,
                "reader_name": reader_name,
                "note_type": "reader_feedback",
            },
            {"_id": 0, "id": 1},
        )
        is_new_reader = existing is None

        # Build the note. user_id is the AUTHOR's, so the note shows up in
        # their notes list and respects user-scoped queries throughout the
        # rest of the codebase. Reader's identity rides on `reader_name`.
        note_id = str(uuid.uuid4())
        created_at = _now()
        note_doc = {
            "id": note_id,
            "user_id": share["user_id"],  # author owns the note
            "parent_type": "chapter",
            # If multi-chapter shares ever land, we'd pick the chapter the
            # reader was on when they left the note. v1 single-chapter: just
            # use chapter_ids[0].
            "parent_id": share["chapter_ids"][0],
            "note_type": "reader_feedback",
            "note_text": note_text,
            "location_reference": location_ref,
            "created_at": created_at,
            # Extra fields — db.notes uses extra="ignore", these survive
            # safely.
            "reader_name": reader_name,
            "share_id": share_id,
            "is_general_impression": bool(body.is_general_impression),
        }
        await db.notes.insert_one(note_doc)

        # Bump counters on the share.
        increments = {"note_count": 1}
        if is_new_reader:
            increments["reader_count"] = 1
        await db.shares.update_one({"id": share_id}, {"$inc": increments})

        return PublicNoteResponse(id=note_id, created_at=created_at)

    return router

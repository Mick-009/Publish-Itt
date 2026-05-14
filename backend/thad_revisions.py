"""
Phase 2: Regenerate-with-feedback for Thad outputs.

This module provides:
- Pydantic models for revisions and style notes
- The regeneration prompt builder
- All endpoint handlers, grouped here so server.py only needs to wire them up

Design notes:
- "source" identifies what's being revised. v1 supports:
    "analysis"               -> a tone/style analysis from AnalyzerPanel
    "workflow_recommendation"-> a workflow-stage read from WorkflowPanel
- Revisions are stored standalone (not embedded in the original analysis doc),
  so the analysis flow itself doesn't need to change. The "current" displayed
  output is whatever the most recent revision says — the frontend asks for
  history when it wants to show prior takes.
- Style notes are project-scoped and toggleable. When active, they're injected
  into both fresh analyses (server.py needs a small patch for this) AND
  regenerations (handled in this module).
"""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from typing import Any, List, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)


# ============================================================================
# Models
# ============================================================================

SourceType = Literal["analysis", "workflow_recommendation"]


class ThadRevision(BaseModel):
    """One regenerate event — original Thad output + writer feedback + new output."""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    project_id: str
    user_id: str
    source_type: SourceType
    source_id: str
    user_feedback: str
    thad_response: str          # the regenerated output (the new "current")
    previous_response: str      # what Thad said before the pushback
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class ThadStyleNote(BaseModel):
    """A piece of feedback the writer has chosen to save project-wide."""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    project_id: str
    user_id: str
    note: str
    source_revision_id: Optional[str] = None
    active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


# ---- Request/response shapes (what crosses the wire) ----

class RegenerateRequest(BaseModel):
    source_type: SourceType
    source_id: str
    project_id: str
    user_feedback: str = Field(min_length=1, max_length=2000)
    # The frontend always sends what Thad previously said, so we don't have to
    # go look it up. This also means revisions work even if the source doc
    # itself is ephemeral (e.g. a workflow read that wasn't persisted).
    previous_response: str = Field(min_length=1)


class RegenerateResponse(BaseModel):
    revision_id: str
    thad_response: str
    created_at: datetime


class StyleNoteCreate(BaseModel):
    project_id: str
    note: str = Field(min_length=1, max_length=500)
    source_revision_id: Optional[str] = None


class StyleNoteUpdate(BaseModel):
    active: bool


class StyleNoteOut(BaseModel):
    id: str
    project_id: str
    note: str
    source_revision_id: Optional[str]
    active: bool
    created_at: datetime


# ============================================================================
# Prompt builder
# ============================================================================

# Headline for what Thad is doing now — used in both the system message
# and the assistant-facing instructions. Kept here so it's easy to tune.
REGEN_INSTRUCTIONS = """\
The writer has pushed back on your previous analysis. You're not starting
fresh — you're responding to someone who's read your take and disagreed
or wants you to go further.

Rules of engagement:
- Open with a one-line acknowledgment of the pushback, in your own voice.
  Don't repeat their words back. Don't open with "You're right" unless
  you genuinely think they are. Something like "Fair — I leaned too hard
  on plot." Or "I hear you, but I still think pacing is the issue. Here's
  why..." Or "That changes how I'd read it. Let me try again."
- Then give the revised take. Change your mind where the feedback genuinely
  lands. Hold your ground where you're actually still convinced.
- Don't be sycophantic. Don't just rephrase the previous read with more
  hedging. If the writer is wrong, say so — but say it the way someone
  who respects them would.
- Don't apologize. Editors don't apologize for their reads.
- Match the format and length of the previous response. If it was JSON,
  return JSON in the same shape. If it was prose, return prose.
"""


def build_regen_prompt(
    *,
    previous_response: str,
    user_feedback: str,
    style_notes: List[str],
    source_type: SourceType,
    chapter_content: Optional[str] = None,
) -> str:
    """
    Build the user-message body for a regeneration call.

    The system prompt (GLOBAL_SYSTEM_PROMPT from prompts.py) handles Thad's
    voice baseline. This function builds the *task* part of the prompt —
    everything that's specific to this regeneration.
    """
    parts: List[str] = []

    parts.append(REGEN_INSTRUCTIONS)

    if style_notes:
        parts.append("\nStanding notes from the writer (apply throughout):")
        for note in style_notes:
            parts.append(f"- {note.strip()}")

    parts.append("\n--- YOUR PREVIOUS RESPONSE ---")
    parts.append(previous_response.strip())

    parts.append("\n--- THE WRITER'S PUSHBACK ---")
    parts.append(user_feedback.strip())

    if chapter_content:
        # Trim aggressively — we don't need the whole manuscript, just
        # enough context to ground the revision.
        snippet = chapter_content.strip()
        if len(snippet) > 8000:
            snippet = snippet[:8000] + "\n[...truncated]"
        parts.append("\n--- THE CHAPTER (for reference) ---")
        parts.append(snippet)

    if source_type == "analysis":
        parts.append(
            "\nRevise the analysis. Return JSON in the same shape as the previous "
            "response (tone_analysis, style_analysis, suggestions, reading_level)."
        )
    elif source_type == "workflow_recommendation":
        parts.append(
            "\nRevise the workflow read. Return JSON in the same shape as the "
            "previous response (stage, message, next_steps, progress_percent)."
        )

    return "\n".join(parts)


# ============================================================================
# Helpers — to be called from endpoints
# ============================================================================

async def fetch_active_style_notes(
    db: Any, project_id: str, user_id: str
) -> List[str]:
    """Return the note strings for active style notes on this project."""
    cursor = (
        db.thad_style_notes.find(
            {"project_id": project_id, "user_id": user_id, "active": True},
            {"_id": 0, "note": 1},
        )
        .sort("created_at", 1)
    )
    notes: List[str] = []
    async for doc in cursor:
        if doc.get("note"):
            notes.append(doc["note"])
    return notes


async def fetch_revisions_for_source(
    db: Any,
    project_id: str,
    user_id: str,
    source_type: str,
    source_id: str,
) -> List[dict]:
    """All revisions for a given source, newest first."""
    cursor = (
        db.thad_revisions.find(
            {
                "project_id": project_id,
                "user_id": user_id,
                "source_type": source_type,
                "source_id": source_id,
            },
            {"_id": 0},
        )
        .sort("created_at", -1)
    )
    out: List[dict] = []
    async for doc in cursor:
        out.append(doc)
    return out


# ============================================================================
# Router — to be included in server.py
# ============================================================================

def build_router(
    *,
    db: Any,
    get_current_user_dep: Any,
    call_llm_async: Any,
    fetch_chapter_content_async: Any,
) -> APIRouter:
    """
    Build the FastAPI router for the Phase 2 endpoints.

    Args expected from server.py:
        db: the motor MongoDB database
        get_current_user_dep: the existing Depends(get_current_user) value
            (pass it as the literal Depends(...), already wrapped)
        call_llm_async: async fn(system_prompt: str, user_prompt: str,
                                 want_json: bool) -> str
            Wraps the existing LiteLLM integration. The caller is responsible
            for JSON-mode toggle. Returns raw model text.
        fetch_chapter_content_async: async fn(project_id: str, source_id: str,
                                              user_id: str) -> Optional[str]
            For source_type="analysis", source_id should be the chapter ID
            and this returns the chapter's content. Return None for sources
            with no associated chapter (e.g. workflow_recommendation reads
            spanning the whole manuscript — pass an aggregate fetcher or
            return None and the prompt skips the chapter section).

    Why dependency injection rather than imports: server.py already owns the
    Mongo connection, auth dependency, LLM caller, and chapter lookup. We
    pass them in rather than re-importing from server.py to avoid a circular
    import. server.py imports this module, not the other way around.
    """
    router = APIRouter(prefix="/api/thad", tags=["thad-phase-2"])

    # ---- Regenerate -------------------------------------------------------

    @router.post("/regenerate", response_model=RegenerateResponse)
    async def regenerate(
        request: RegenerateRequest,
        current_user=get_current_user_dep,
    ) -> RegenerateResponse:
        # Verify the writer owns the project. We don't trust the client.
        project = await db.projects.find_one(
            {"id": request.project_id, "user_id": current_user.id},
            {"_id": 0, "id": 1},
        )
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")

        # Style notes are scoped to the project, so pull them now.
        style_notes = await fetch_active_style_notes(
            db, request.project_id, current_user.id
        )

        # For analysis revisions, source_id is a chapter ID — fetch its
        # content so Thad can re-read with feedback in mind. For workflow
        # reads, we skip (the prompt is fine without it).
        chapter_content: Optional[str] = None
        if request.source_type == "analysis":
            try:
                chapter_content = await fetch_chapter_content_async(
                    request.project_id, request.source_id, current_user.id
                )
            except Exception:
                logger.warning(
                    "Couldn't fetch chapter for regen — proceeding without it",
                    exc_info=True,
                )

        # Build the prompt and call the model.
        user_prompt = build_regen_prompt(
            previous_response=request.previous_response,
            user_feedback=request.user_feedback,
            style_notes=style_notes,
            source_type=request.source_type,
            chapter_content=chapter_content,
        )

        # JSON mode for both source types — the previous responses are JSON.
        try:
            response_text = await call_llm_async(
                system_prompt="",  # GLOBAL_SYSTEM_PROMPT applied inside the caller
                user_prompt=user_prompt,
                want_json=True,
            )
        except Exception as exc:
            logger.error("Regen call failed: %s", exc)
            raise HTTPException(
                status_code=503,
                detail="Couldn't reach Thad just now. Try again?",
            )

        # Persist the revision. Use the model_dump to ensure shape.
        revision = ThadRevision(
            project_id=request.project_id,
            user_id=current_user.id,
            source_type=request.source_type,
            source_id=request.source_id,
            user_feedback=request.user_feedback,
            thad_response=response_text,
            previous_response=request.previous_response,
        )
        await db.thad_revisions.insert_one(revision.model_dump())

        return RegenerateResponse(
            revision_id=revision.id,
            thad_response=response_text,
            created_at=revision.created_at,
        )

    # ---- Revisions: list --------------------------------------------------

    @router.get("/revisions/{source_type}/{source_id}")
    async def list_revisions(
        source_type: str,
        source_id: str,
        project_id: str,
        current_user=get_current_user_dep,
    ) -> List[dict]:
        if source_type not in ("analysis", "workflow_recommendation"):
            raise HTTPException(status_code=400, detail="Unknown source type")
        # Verify project ownership
        project = await db.projects.find_one(
            {"id": project_id, "user_id": current_user.id},
            {"_id": 0, "id": 1},
        )
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        return await fetch_revisions_for_source(
            db, project_id, current_user.id, source_type, source_id
        )

    # ---- Style notes: CRUD ------------------------------------------------

    @router.post("/style-notes", response_model=StyleNoteOut)
    async def create_style_note(
        request: StyleNoteCreate,
        current_user=get_current_user_dep,
    ) -> StyleNoteOut:
        project = await db.projects.find_one(
            {"id": request.project_id, "user_id": current_user.id},
            {"_id": 0, "id": 1},
        )
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        # Validate the source revision belongs to this user/project if given.
        if request.source_revision_id:
            rev = await db.thad_revisions.find_one(
                {
                    "id": request.source_revision_id,
                    "user_id": current_user.id,
                    "project_id": request.project_id,
                },
                {"_id": 0, "id": 1},
            )
            if not rev:
                raise HTTPException(
                    status_code=400, detail="Source revision not found"
                )

        note = ThadStyleNote(
            project_id=request.project_id,
            user_id=current_user.id,
            note=request.note.strip(),
            source_revision_id=request.source_revision_id,
        )
        await db.thad_style_notes.insert_one(note.model_dump())
        return StyleNoteOut(**note.model_dump())

    @router.get("/style-notes", response_model=List[StyleNoteOut])
    async def list_style_notes(
        project_id: str,
        include_inactive: bool = False,
        current_user=get_current_user_dep,
    ) -> List[StyleNoteOut]:
        project = await db.projects.find_one(
            {"id": project_id, "user_id": current_user.id},
            {"_id": 0, "id": 1},
        )
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")

        query: dict = {"project_id": project_id, "user_id": current_user.id}
        if not include_inactive:
            query["active"] = True

        cursor = db.thad_style_notes.find(query, {"_id": 0}).sort("created_at", 1)
        out: List[StyleNoteOut] = []
        async for doc in cursor:
            out.append(StyleNoteOut(**doc))
        return out

    @router.patch("/style-notes/{note_id}", response_model=StyleNoteOut)
    async def update_style_note(
        note_id: str,
        request: StyleNoteUpdate,
        current_user=get_current_user_dep,
    ) -> StyleNoteOut:
        # Read-then-update so we can verify ownership before touching.
        existing = await db.thad_style_notes.find_one(
            {"id": note_id, "user_id": current_user.id}, {"_id": 0}
        )
        if not existing:
            raise HTTPException(status_code=404, detail="Note not found")
        await db.thad_style_notes.update_one(
            {"id": note_id, "user_id": current_user.id},
            {"$set": {"active": request.active}},
        )
        existing["active"] = request.active
        return StyleNoteOut(**existing)

    @router.delete("/style-notes/{note_id}")
    async def delete_style_note(
        note_id: str,
        current_user=get_current_user_dep,
    ) -> dict:
        result = await db.thad_style_notes.delete_one(
            {"id": note_id, "user_id": current_user.id}
        )
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Note not found")
        return {"deleted": True, "id": note_id}

    return router


# ============================================================================
# Index hints — call once at startup from server.py
# ============================================================================

async def ensure_indexes(db: Any) -> None:
    """Create the indexes that make the common queries fast.

    Idempotent — safe to call on every startup.
    """
    await db.thad_revisions.create_index(
        [("project_id", 1), ("user_id", 1), ("source_type", 1), ("source_id", 1),
         ("created_at", -1)],
        name="revisions_by_source",
    )
    await db.thad_revisions.create_index(
        [("id", 1)], name="revisions_by_id", unique=True
    )
    await db.thad_style_notes.create_index(
        [("project_id", 1), ("user_id", 1), ("active", 1), ("created_at", 1)],
        name="style_notes_by_project",
    )
    await db.thad_style_notes.create_index(
        [("id", 1)], name="style_notes_by_id", unique=True
    )

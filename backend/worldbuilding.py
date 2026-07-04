"""
Worldbuilding canvas — backend module.

Cards (character, place, note) and directed connections between them.
All state lives in MongoDB; React Flow renders it on the frontend.

Module layout matches shares.py and thad_revisions.py:
  - Pydantic models and request/response shapes
  - ensure_indexes(db) for both new collections
  - build_router(db, get_current_user_dep) returns the APIRouter

All endpoints under /api/worldbuilding/*. All require JWT auth via the
standard get_current_user dependency. All queries filter by user_id so one
user can never read or modify another's canvas data.
"""

import logging
import uuid
from datetime import datetime, timezone
from typing import Any, List, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

VALID_ITEM_TYPES = {"character", "place", "note"}
VALID_PROVENANCE = {"manual", "ai", "ai_edited"}
BATCH_SIZE_LIMIT = 100


# ── Pydantic models ──────────────────────────────────────────────────────────


class Position(BaseModel):
    x: float = 0.0
    y: float = 0.0


class WorldbuildingItem(BaseModel):
    id: str
    project_id: str
    user_id: str
    type: str
    title: str = ""
    position: Position = Field(default_factory=Position)
    provenance: str = "manual"
    source_chapter_id: Optional[str] = None
    extraction_id: Optional[str] = None
    data: dict = Field(default_factory=dict)
    created_at: str
    updated_at: str


class WorldbuildingConnection(BaseModel):
    id: str
    project_id: str
    user_id: str
    source_id: str
    target_id: str
    label: Optional[str] = None
    created_at: str
    updated_at: str


# ── Request models ───────────────────────────────────────────────────────────


class WorldbuildingItemCreate(BaseModel):
    project_id: str
    type: str
    title: str = ""
    position: Position = Field(default_factory=Position)
    provenance: str = "manual"
    source_chapter_id: Optional[str] = None
    extraction_id: Optional[str] = None
    data: dict = Field(default_factory=dict)


class WorldbuildingItemUpdate(BaseModel):
    title: Optional[str] = None
    position: Optional[Position] = None
    data: Optional[dict] = None
    source_chapter_id: Optional[str] = None


class _BatchItem(BaseModel):
    """One item in a batch-create request."""
    type: str
    title: str = ""
    position: Position = Field(default_factory=Position)
    provenance: str = "manual"
    source_chapter_id: Optional[str] = None
    extraction_id: Optional[str] = None
    data: dict = Field(default_factory=dict)


class WorldbuildingItemBatchCreate(BaseModel):
    project_id: str
    items: List[_BatchItem]


class WorldbuildingConnectionCreate(BaseModel):
    project_id: str
    source_id: str
    target_id: str
    label: Optional[str] = None


class WorldbuildingConnectionUpdate(BaseModel):
    label: Optional[str] = None


# ── Indexes ──────────────────────────────────────────────────────────────────


async def ensure_indexes(db: Any) -> None:
    """Create indexes for worldbuilding collections. Idempotent."""
    await db.worldbuilding_items.create_index([("project_id", 1)])
    await db.worldbuilding_items.create_index([("project_id", 1), ("type", 1)])
    await db.worldbuilding_items.create_index([("user_id", 1)])
    await db.worldbuilding_connections.create_index([("project_id", 1)])
    await db.worldbuilding_connections.create_index(
        [("project_id", 1), ("source_id", 1)]
    )
    await db.worldbuilding_connections.create_index([("user_id", 1)])
    logger.info("Worldbuilding indexes created/verified.")


# ── Helpers ──────────────────────────────────────────────────────────────────


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _new_id() -> str:
    return str(uuid.uuid4())


def _strip_mongo(doc: dict) -> dict:
    doc.pop("_id", None)
    return doc


# ── Router ───────────────────────────────────────────────────────────────────


def build_router(db: Any, get_current_user_dep: Any) -> APIRouter:
    """Build the worldbuilding router with db + auth dependency injected."""

    router = APIRouter(prefix="/api/worldbuilding", tags=["worldbuilding"])

    # ── Items ────────────────────────────────────────────────────────────────

    @router.post("/items", response_model=WorldbuildingItem, status_code=201)
    async def create_item(
        body: WorldbuildingItemCreate,
        current_user=get_current_user_dep,
    ):
        if body.type not in VALID_ITEM_TYPES:
            raise HTTPException(
                status_code=422,
                detail=f"type must be one of: {', '.join(sorted(VALID_ITEM_TYPES))}",
            )
        # "ai_edited" is only reachable via PATCH, never at creation
        if body.provenance not in ("manual", "ai"):
            raise HTTPException(
                status_code=422,
                detail="provenance at creation must be 'manual' or 'ai'",
            )
        project = await db.projects.find_one(
            {"id": body.project_id, "user_id": current_user.id},
            {"_id": 0, "id": 1},
        )
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")

        now = _now()
        doc = {
            "id": _new_id(),
            "project_id": body.project_id,
            "user_id": current_user.id,
            "type": body.type,
            "title": body.title,
            "position": body.position.model_dump(),
            "provenance": body.provenance,
            "source_chapter_id": body.source_chapter_id,
            "extraction_id": body.extraction_id,
            "data": body.data,
            "created_at": now,
            "updated_at": now,
        }
        await db.worldbuilding_items.insert_one(doc)
        _strip_mongo(doc)
        return doc

    @router.get("/items", response_model=List[WorldbuildingItem])
    async def list_items(
        project_id: str,
        current_user=get_current_user_dep,
    ):
        project = await db.projects.find_one(
            {"id": project_id, "user_id": current_user.id},
            {"_id": 0, "id": 1},
        )
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        cursor = db.worldbuilding_items.find(
            {"project_id": project_id, "user_id": current_user.id},
            {"_id": 0},
        )
        return await cursor.to_list(10000)

    @router.post("/items/batch", status_code=201)
    async def batch_create_items(
        body: WorldbuildingItemBatchCreate,
        current_user=get_current_user_dep,
    ):
        if len(body.items) > BATCH_SIZE_LIMIT:
            raise HTTPException(
                status_code=422,
                detail=f"Batch size exceeds limit of {BATCH_SIZE_LIMIT}",
            )
        project = await db.projects.find_one(
            {"id": body.project_id, "user_id": current_user.id},
            {"_id": 0, "id": 1},
        )
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        for i, item in enumerate(body.items):
            if item.type not in VALID_ITEM_TYPES:
                raise HTTPException(
                    status_code=422,
                    detail=f"items[{i}].type must be one of: {', '.join(sorted(VALID_ITEM_TYPES))}",
                )
            if item.provenance not in ("manual", "ai"):
                raise HTTPException(
                    status_code=422,
                    detail=f"items[{i}].provenance must be 'manual' or 'ai', got {item.provenance!r}",
                )

        now = _now()
        docs = []
        for item in body.items:
            doc = {
                "id": _new_id(),
                "project_id": body.project_id,
                "user_id": current_user.id,
                "type": item.type,
                "title": item.title,
                "position": item.position.model_dump(),
                "provenance": item.provenance,
                "source_chapter_id": item.source_chapter_id,
                "extraction_id": item.extraction_id,
                "data": item.data,
                "created_at": now,
                "updated_at": now,
            }
            docs.append(doc)

        if docs:
            await db.worldbuilding_items.insert_many(docs)
        for doc in docs:
            _strip_mongo(doc)
        return {"created": docs}

    @router.patch("/items/{item_id}", response_model=WorldbuildingItem)
    async def update_item(
        item_id: str,
        body: WorldbuildingItemUpdate,
        current_user=get_current_user_dep,
    ):
        existing = await db.worldbuilding_items.find_one(
            {"id": item_id, "user_id": current_user.id}, {"_id": 0}
        )
        if not existing:
            raise HTTPException(status_code=404, detail="Item not found")

        update_data: dict = {}
        if body.title is not None:
            update_data["title"] = body.title
        if body.position is not None:
            update_data["position"] = body.position.model_dump()
        if body.data is not None:
            update_data["data"] = body.data
        if body.source_chapter_id is not None:
            update_data["source_chapter_id"] = body.source_chapter_id

        # Provenance flip: only content edits (not position moves) promote ai → ai_edited
        is_content_edit = any(
            k in update_data for k in ("title", "data", "source_chapter_id")
        )
        if existing.get("provenance") == "ai" and is_content_edit:
            update_data["provenance"] = "ai_edited"

        update_data["updated_at"] = _now()

        await db.worldbuilding_items.update_one(
            {"id": item_id, "user_id": current_user.id},
            {"$set": update_data},
        )
        updated = await db.worldbuilding_items.find_one(
            {"id": item_id}, {"_id": 0}
        )
        return updated

    @router.delete("/items/{item_id}")
    async def delete_item(
        item_id: str,
        current_user=get_current_user_dep,
    ):
        existing = await db.worldbuilding_items.find_one(
            {"id": item_id, "user_id": current_user.id}, {"_id": 0, "id": 1}
        )
        if not existing:
            raise HTTPException(status_code=404, detail="Item not found")

        await db.worldbuilding_items.delete_one(
            {"id": item_id, "user_id": current_user.id}
        )
        # Cascade: remove any connection that references this item as source or target.
        # No user_id filter needed — item ownership was already verified above.
        conn_result = await db.worldbuilding_connections.delete_many(
            {"$or": [{"source_id": item_id}, {"target_id": item_id}]}
        )
        return {
            "deleted": True,
            "also_deleted_connections": conn_result.deleted_count,
        }

    # ── Connections ──────────────────────────────────────────────────────────

    @router.post("/connections", response_model=WorldbuildingConnection, status_code=201)
    async def create_connection(
        body: WorldbuildingConnectionCreate,
        current_user=get_current_user_dep,
    ):
        if body.source_id == body.target_id:
            raise HTTPException(
                status_code=422,
                detail="A card can't connect to itself.",
            )
        project = await db.projects.find_one(
            {"id": body.project_id, "user_id": current_user.id},
            {"_id": 0, "id": 1},
        )
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")

        source = await db.worldbuilding_items.find_one(
            {
                "id": body.source_id,
                "project_id": body.project_id,
                "user_id": current_user.id,
            },
            {"_id": 0, "id": 1},
        )
        if not source:
            raise HTTPException(status_code=404, detail="Source card not found")

        target = await db.worldbuilding_items.find_one(
            {
                "id": body.target_id,
                "project_id": body.project_id,
                "user_id": current_user.id,
            },
            {"_id": 0, "id": 1},
        )
        if not target:
            raise HTTPException(status_code=404, detail="Target card not found")

        # Reject exact duplicates (same direction, same project)
        duplicate = await db.worldbuilding_connections.find_one(
            {
                "source_id": body.source_id,
                "target_id": body.target_id,
                "project_id": body.project_id,
            },
            {"_id": 0, "id": 1},
        )
        if duplicate:
            raise HTTPException(
                status_code=409,
                detail="A connection between these cards already exists.",
            )

        now = _now()
        doc = {
            "id": _new_id(),
            "project_id": body.project_id,
            "user_id": current_user.id,
            "source_id": body.source_id,
            "target_id": body.target_id,
            "label": body.label,
            "created_at": now,
            "updated_at": now,
        }
        await db.worldbuilding_connections.insert_one(doc)
        _strip_mongo(doc)
        return doc

    @router.get("/connections", response_model=List[WorldbuildingConnection])
    async def list_connections(
        project_id: str,
        current_user=get_current_user_dep,
    ):
        project = await db.projects.find_one(
            {"id": project_id, "user_id": current_user.id},
            {"_id": 0, "id": 1},
        )
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        cursor = db.worldbuilding_connections.find(
            {"project_id": project_id, "user_id": current_user.id},
            {"_id": 0},
        )
        return await cursor.to_list(10000)

    @router.patch("/connections/{connection_id}", response_model=WorldbuildingConnection)
    async def update_connection(
        connection_id: str,
        body: WorldbuildingConnectionUpdate,
        current_user=get_current_user_dep,
    ):
        existing = await db.worldbuilding_connections.find_one(
            {"id": connection_id, "user_id": current_user.id}, {"_id": 0}
        )
        if not existing:
            raise HTTPException(status_code=404, detail="Connection not found")

        # label is the only editable field; use model_fields_set to distinguish
        # "not sent" (no-op) from "explicitly sent" (update, even if null)
        update_data: dict = {"updated_at": _now()}
        if "label" in body.model_fields_set:
            update_data["label"] = body.label

        await db.worldbuilding_connections.update_one(
            {"id": connection_id, "user_id": current_user.id},
            {"$set": update_data},
        )
        updated = await db.worldbuilding_connections.find_one(
            {"id": connection_id}, {"_id": 0}
        )
        return updated

    @router.delete("/connections/{connection_id}")
    async def delete_connection(
        connection_id: str,
        current_user=get_current_user_dep,
    ):
        result = await db.worldbuilding_connections.delete_one(
            {"id": connection_id, "user_id": current_user.id}
        )
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Connection not found")
        return {"deleted": True}

    return router

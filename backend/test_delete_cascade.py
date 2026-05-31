"""
Cascade test for DELETE /api/auth/me.

Inserts one document into every collection in the cascade list, calls the
delete endpoint, then asserts every collection is empty for the test user.

Run from the backend directory with the venv active:
    python test_delete_cascade.py

Exit 0 = all assertions passed.
Exit 1 = something failed — the failure message tells you which collection
         still has documents.

The test user is cleaned up on both success and failure so it never
contaminates the real database.
"""

import asyncio
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env")

import os

import httpx
from httpx import ASGITransport
from motor.motor_asyncio import AsyncIOMotorClient

# Import the FastAPI app — this also loads all routes and middleware.
import server  # noqa: E402  (must come after load_dotenv)

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]

BASE = "http://testserver"
AUTH = f"{BASE}/api/auth"


# ── helpers ─────────────────────────────────────────────────────────────────


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _uid() -> str:
    return str(uuid.uuid4())


def fail(msg: str) -> None:
    print(f"\nFAIL: {msg}", file=sys.stderr)
    sys.exit(1)


async def _cleanup(db, uid: str, pid: str) -> None:
    """Best-effort removal of the test user and all their data after a crash."""
    for col in ("projects", "notes", "versions", "writing_sessions", "style_presets", "shares"):
        await db[col].delete_many({"user_id": uid})
    for col in ("chapters", "thad_revisions", "thad_style_notes", "art_assets", "book_art_profiles"):
        await db[col].delete_many({"project_id": pid})
    await db.users.delete_one({"id": uid})


# ── main test ────────────────────────────────────────────────────────────────


async def run() -> None:
    mongo = AsyncIOMotorClient(MONGO_URL)
    db = mongo[DB_NAME]

    ts = int(datetime.now(timezone.utc).timestamp())
    email = f"delete-test-{ts}@example.com"
    password = "testpassword123"

    # IDs allocated up-front so _cleanup can reference them even on early fail.
    uid = ""
    pid = _uid()
    cid1 = _uid()
    cid2 = _uid()

    transport = ASGITransport(app=server.app)

    try:
        async with httpx.AsyncClient(transport=transport, base_url=BASE) as client:

            # ── 1. register test user ────────────────────────────────────────
            r = await client.post(
                f"{AUTH}/register",
                json={"email": email, "password": password, "display_name": "Cascade Test"},
            )
            if r.status_code != 201:
                fail(f"register failed {r.status_code}: {r.text}")

            token = r.json()["access_token"]
            uid = r.json()["user"]["id"]
            headers = {"Authorization": f"Bearer {token}"}
            print(f"Registered test user: {email}  id={uid}")

            # ── 2. set pen_name / use_pen_name (paranoia check per brief) ────
            r = await client.patch(
                f"{AUTH}/me/preferences",
                json={"pen_name": "Test Pen Name", "use_pen_name": True},
                headers=headers,
            )
            if r.status_code != 200:
                fail(f"set pen_name failed {r.status_code}: {r.text}")

            # ── 3. insert one document per cascaded collection ───────────────
            # Direct mongo inserts — we're testing the delete cascade, not the
            # creation endpoints. Avoids needing AI or complex setup calls.

            # projects (user-scoped)
            await db.projects.insert_one({
                "id": pid, "user_id": uid, "title": "Cascade Project",
                "status": "draft", "created_at": _now(),
            })

            # chapters (project-scoped — 2, to make the count assert meaningful)
            for cid in (cid1, cid2):
                await db.chapters.insert_one({
                    "id": cid, "project_id": pid, "user_id": uid,
                    "title": "Chapter", "content": "words", "created_at": _now(),
                })

            # notes (user-scoped)
            await db.notes.insert_one({
                "id": _uid(), "user_id": uid, "parent_type": "chapter",
                "parent_id": cid1, "note_text": "test note", "created_at": _now(),
            })

            # versions (user-scoped)
            await db.versions.insert_one({
                "id": _uid(), "user_id": uid, "parent_type": "chapter",
                "parent_id": cid1, "content": "snapshot", "created_at": _now(),
            })

            # writing_sessions (user-scoped)
            await db.writing_sessions.insert_one({
                "id": _uid(), "user_id": uid, "date": "2026-01-01",
                "word_count": 100, "created_at": _now(),
            })

            # style_presets (user-scoped)
            await db.style_presets.insert_one({
                "id": _uid(), "user_id": uid, "name": "Test Preset",
                "created_at": _now(),
            })

            # shares (user-scoped)
            await db.shares.insert_one({
                "id": _uid(), "user_id": uid, "project_id": pid,
                "chapter_ids": [cid1], "title": "Test Share",
                "revoked": False, "created_at": _now(),
            })

            # thad_revisions (project-scoped only — cascade filters by project_id)
            await db.thad_revisions.insert_one({
                "id": _uid(), "project_id": pid, "user_id": uid,
                "source_type": "analysis", "source_id": cid1,
                "user_feedback": "feedback", "thad_response": "response",
                "previous_response": "old", "created_at": _now(),
            })

            # thad_style_notes (project-scoped only)
            await db.thad_style_notes.insert_one({
                "id": _uid(), "project_id": pid, "user_id": uid,
                "note": "style note", "active": True, "created_at": _now(),
            })

            # art_assets (project-scoped only)
            await db.art_assets.insert_one({
                "id": _uid(), "project_id": pid, "type": "cover",
                "style_preset": "test", "prompt_used": "test prompt",
                "status": "generated", "created_at": _now(),
            })

            # book_art_profiles (project-scoped only)
            await db.book_art_profiles.insert_one({
                "id": _uid(), "project_id": pid, "genre": "fantasy",
                "age_group": "adult", "mood": "dark", "art_style_preferences": "",
                "color_palette": "", "reference_notes": "",
                "created_at": _now(), "updated_at": _now(),
            })

            print("Inserted test documents into all cascade collections.")

            # ── 4. verify everything exists before delete ────────────────────
            checks_before = {
                "projects":          await db.projects.count_documents({"user_id": uid}),
                "chapters":          await db.chapters.count_documents({"project_id": pid}),
                "notes":             await db.notes.count_documents({"user_id": uid}),
                "versions":          await db.versions.count_documents({"user_id": uid}),
                "writing_sessions":  await db.writing_sessions.count_documents({"user_id": uid}),
                "style_presets":     await db.style_presets.count_documents({"user_id": uid}),
                "shares":            await db.shares.count_documents({"user_id": uid}),
                "thad_revisions":    await db.thad_revisions.count_documents({"project_id": pid}),
                "thad_style_notes":  await db.thad_style_notes.count_documents({"project_id": pid}),
                "art_assets":        await db.art_assets.count_documents({"project_id": pid}),
                "book_art_profiles": await db.book_art_profiles.count_documents({"project_id": pid}),
                "users":             await db.users.count_documents({"id": uid}),
            }
            expected_before = {
                "projects": 1, "chapters": 2, "notes": 1, "versions": 1,
                "writing_sessions": 1, "style_presets": 1, "shares": 1,
                "thad_revisions": 1, "thad_style_notes": 1,
                "art_assets": 1, "book_art_profiles": 1, "users": 1,
            }
            for col, count in checks_before.items():
                if count != expected_before[col]:
                    fail(f"Pre-delete check: {col} expected {expected_before[col]}, got {count}")
            print("Pre-delete: all collections confirmed populated.")

            # ── 5. wrong confirmation must be rejected ───────────────────────
            # httpx 0.28 delete() doesn't forward json kwarg — use request().
            for bad in ("delete", "Delete", "DELETE ", " DELETE", ""):
                r = await client.request(
                    "DELETE",
                    f"{AUTH}/me",
                    json={"confirmation": bad},
                    headers=headers,
                )
                if r.status_code != 400:
                    fail(f"Expected 400 for confirmation={bad!r}, got {r.status_code}: {r.text}")
            print("Wrong-confirmation rejection: all variants returned 400.")

            # ── 6. call DELETE /auth/me ──────────────────────────────────────
            r = await client.request(
                "DELETE",
                f"{AUTH}/me",
                json={"confirmation": "DELETE"},
                headers=headers,
            )
            if r.status_code != 200:
                fail(f"DELETE /auth/me returned {r.status_code}: {r.text}")
            if r.json() != {"deleted": True}:
                fail(f"Unexpected response body: {r.json()}")
            print("DELETE /auth/me: 200 OK, body correct.")

            # ── 7. verify everything is gone ─────────────────────────────────
            checks_after = {
                "projects":          await db.projects.count_documents({"user_id": uid}),
                "chapters":          await db.chapters.count_documents({"project_id": pid}),
                "notes":             await db.notes.count_documents({"user_id": uid}),
                "versions":          await db.versions.count_documents({"user_id": uid}),
                "writing_sessions":  await db.writing_sessions.count_documents({"user_id": uid}),
                "style_presets":     await db.style_presets.count_documents({"user_id": uid}),
                "shares":            await db.shares.count_documents({"user_id": uid}),
                "thad_revisions":    await db.thad_revisions.count_documents({"project_id": pid}),
                "thad_style_notes":  await db.thad_style_notes.count_documents({"project_id": pid}),
                "art_assets":        await db.art_assets.count_documents({"project_id": pid}),
                "book_art_profiles": await db.book_art_profiles.count_documents({"project_id": pid}),
                "users":             await db.users.count_documents({"id": uid}),
            }
            orphans = {col: n for col, n in checks_after.items() if n > 0}
            if orphans:
                fail(f"Orphan documents remain after delete: {orphans}")

            print("\nPASS — cascade clean. Zero orphan documents.")

    finally:
        # Clean up the test user if the test crashed before the delete ran.
        # Safe to call even if the user was already deleted — delete_many/one
        # with no matches is a no-op.
        if uid:
            await _cleanup(db, uid, pid)
        mongo.close()


# ── entrypoint ───────────────────────────────────────────────────────────────


if __name__ == "__main__":
    asyncio.run(run())

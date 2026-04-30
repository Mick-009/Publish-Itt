"""
Publish Itt — one-time user_id backfill migration
Run from your backend folder with the venv activated:

    python migrate.py

Safe to run multiple times — only updates documents missing user_id.
"""

import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

# Load your .env so MONGO_URL and DB_NAME are available
load_dotenv()

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ.get("DB_NAME", "publishitt")


async def backfill():
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]

    print(f"Connected to: {DB_NAME}")

    # ── Step 1: Build a map of project_id → user_id from projects ────────────
    projects = await db.projects.find(
        {"user_id": {"$exists": True}}, {"id": 1, "user_id": 1}
    ).to_list(10000)
    project_owner = {p["id"]: p["user_id"] for p in projects}
    print(f"Found {len(project_owner)} projects with user_id")

    # ── Step 2: Backfill chapters ─────────────────────────────────────────────
    chapters = await db.chapters.find(
        {"user_id": {"$exists": False}}, {"id": 1, "project_id": 1}
    ).to_list(10000)
    chapter_count = 0
    chapter_owner = {}  # build this for notes/versions that parent a chapter
    for ch in chapters:
        owner = project_owner.get(ch.get("project_id", ""))
        if owner:
            await db.chapters.update_one(
                {"id": ch["id"]}, {"$set": {"user_id": owner}}
            )
            chapter_count += 1
        chapter_owner[ch["id"]] = owner  # may be None if orphaned

    # Also collect already-stamped chapters for the lookup below
    stamped_chapters = await db.chapters.find(
        {"user_id": {"$exists": True}}, {"id": 1, "project_id": 1, "user_id": 1}
    ).to_list(10000)
    for ch in stamped_chapters:
        chapter_owner[ch["id"]] = ch["user_id"]

    print(f"Chapters backfilled: {chapter_count}")

    # ── Step 3: Backfill notes and versions (parent can be project or chapter) ─
    for col_name in ["notes", "versions"]:
        col = db[col_name]
        docs = await col.find(
            {"user_id": {"$exists": False}},
            {"id": 1, "parent_type": 1, "parent_id": 1}
        ).to_list(10000)
        count = 0
        for doc in docs:
            pid = doc.get("parent_id", "")
            parent_type = doc.get("parent_type", "")
            # Try project lookup first, then chapter lookup
            owner = project_owner.get(pid) or chapter_owner.get(pid)
            if owner:
                await col.update_one(
                    {"id": doc["id"]}, {"$set": {"user_id": owner}}
                )
                count += 1
        print(f"{col_name} backfilled: {count}")

    # ── Step 4: Backfill writing_sessions via project_id ─────────────────────
    sessions = await db.writing_sessions.find(
        {"user_id": {"$exists": False}}, {"id": 1, "project_id": 1}
    ).to_list(10000)
    session_count = 0
    for s in sessions:
        owner = project_owner.get(s.get("project_id", ""))
        if owner:
            await db.writing_sessions.update_one(
                {"id": s["id"]}, {"$set": {"user_id": owner}}
            )
            session_count += 1
    print(f"writing_sessions backfilled: {session_count}")

    # ── Step 5: Backfill style_presets (no project link — assign to sole user) ─
    user = await db.users.find_one({}, {"id": 1})
    if user:
        result = await db.style_presets.update_many(
            {"user_id": {"$exists": False}},
            {"$set": {"user_id": user["id"]}}
        )
        print(f"style_presets backfilled: {result.modified_count}")
    else:
        print("style_presets: no users found, skipping")

    # ── Summary ───────────────────────────────────────────────────────────────
    print("\nBackfill complete. Checking for any remaining unowned documents...")
    for col_name in ["projects", "chapters", "notes", "versions", "writing_sessions", "style_presets"]:
        col = db[col_name]
        unowned = await col.count_documents({"user_id": {"$exists": False}})
        if unowned:
            print(f"  WARNING: {col_name} still has {unowned} document(s) without user_id")
        else:
            print(f"  OK: {col_name}")

    client.close()


asyncio.run(backfill())

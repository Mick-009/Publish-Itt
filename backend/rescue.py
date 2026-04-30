"""
Publish Itt — orphan rescue script
Stamps all remaining user_id-less documents with the account's user ID.

Run from your backend folder with the venv activated:
    python rescue.py

Safe to run multiple times.
"""

import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv()

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ.get("DB_NAME", "publishitt")


async def rescue():
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]

    print(f"Connected to: {DB_NAME}")

    # ── Find your user ────────────────────────────────────────────────────────
    user = await db.users.find_one({}, {"id": 1, "email": 1})
    if not user:
        print("ERROR: No users found in the database. Cannot proceed.")
        client.close()
        return

    user_id = user["id"]
    print(f"Assigning all orphans to: {user.get('email', user_id)}")

    # ── Stamp every collection that still has unowned docs ────────────────────
    collections = [
        "projects",
        "chapters",
        "notes",
        "versions",
        "writing_sessions",
    ]

    for col_name in collections:
        col = db[col_name]
        result = await col.update_many(
            {"user_id": {"$exists": False}},
            {"$set": {"user_id": user_id}}
        )
        if result.modified_count:
            print(f"  {col_name}: stamped {result.modified_count} document(s)")
        else:
            print(f"  {col_name}: nothing to update")

    # ── Final check ───────────────────────────────────────────────────────────
    print("\nFinal check...")
    all_clean = True
    for col_name in collections + ["style_presets"]:
        col = db[col_name]
        unowned = await col.count_documents({"user_id": {"$exists": False}})
        if unowned:
            print(f"  WARNING: {col_name} still has {unowned} unowned document(s)")
            all_clean = False
        else:
            print(f"  OK: {col_name}")

    if all_clean:
        print("\nAll documents are owned. Migration complete.")
    else:
        print("\nSome documents are still unowned — contact support.")

    client.close()


asyncio.run(rescue())

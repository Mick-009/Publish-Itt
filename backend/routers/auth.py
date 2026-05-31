"""
Auth Router — JWT-based multi-user authentication for Publish Itt.
Endpoints: POST /api/auth/register, POST /api/auth/login, GET /api/auth/me
"""

from fastapi import APIRouter, HTTPException, Depends
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from pydantic import BaseModel, Field, EmailStr
from typing import Optional
from datetime import datetime, timedelta, timezone
from passlib.context import CryptContext
from jose import JWTError, jwt
import uuid
import os

auth_router = APIRouter(prefix="/api/auth", tags=["auth"])

# ── Crypto setup ────────────────────────────────────────────────────────────
SECRET_KEY = os.environ.get("JWT_SECRET_KEY", "change-me-in-production-please")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.environ.get("ACCESS_TOKEN_EXPIRE_MINUTES", 60 * 24 * 7))  # 7 days default

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


# ── Pydantic models ──────────────────────────────────────────────────────────
class UserRegister(BaseModel):
    email: EmailStr
    password: str
    display_name: Optional[str] = None


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    id: str
    email: str
    display_name: Optional[str] = None
    created_at: str
    daily_word_goal: int = 500
    onboarding_complete: bool = False
    tour_complete: bool = False
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    pen_name: Optional[str] = None
    use_pen_name: bool = False
    avatar: Optional[str] = None


class UserPreferencesUpdate(BaseModel):
    daily_word_goal: Optional[int] = None
    display_name: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    pen_name: Optional[str] = None
    use_pen_name: Optional[bool] = None
    avatar: Optional[str] = None


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class AccountDeleteRequest(BaseModel):
    confirmation: str


class UserInDB(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: str
    display_name: Optional[str] = None
    hashed_password: str
    daily_word_goal: int = 500
    created_at: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    pen_name: Optional[str] = None
    use_pen_name: bool = False
    avatar: Optional[str] = None


# ── Helpers ──────────────────────────────────────────────────────────────────
def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


# ── DB dependency injected at app startup ────────────────────────────────────
_db = None

def set_db(database):
    global _db
    _db = database


def get_db():
    if _db is None:
        raise RuntimeError("Database not initialised")
    return _db


# ── Current-user dependency (used by protected routes) ───────────────────────
async def get_current_user(token: str = Depends(oauth2_scheme)) -> UserOut:
    credentials_exc = HTTPException(
        status_code=401,
        detail="Invalid or expired token",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if not user_id:
            raise credentials_exc
    except JWTError:
        raise credentials_exc

    db = get_db()
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "hashed_password": 0})
    if not user:
        raise credentials_exc
    # Defensive default for users created before daily_word_goal field existed
    user.setdefault("daily_word_goal", 500)
    return UserOut(**user)


# ── Routes ───────────────────────────────────────────────────────────────────
@auth_router.post("/register", response_model=TokenResponse, status_code=201)
async def register(body: UserRegister):
    db = get_db()

    existing = await db.users.find_one({"email": body.email.lower()})
    if existing:
        raise HTTPException(status_code=409, detail="Email already registered")

    if len(body.password) < 8:
        raise HTTPException(status_code=422, detail="Password must be at least 8 characters")

    user = UserInDB(
        email=body.email.lower(),
        display_name=body.display_name or body.email.split("@")[0],
        hashed_password=hash_password(body.password),
    )
    await db.users.insert_one(user.model_dump())

    token = create_access_token({"sub": user.id})
    # Splat the user dict through Pydantic so every field declared on
    # UserOut is populated from the document. Mirrors get_current_user's
    # pattern. Future fields on UserOut "just work" without touching this.
    user_dict = user.model_dump()
    user_dict.pop("hashed_password", None)
    user_dict.setdefault("daily_word_goal", 500)
    return TokenResponse(
        access_token=token,
        user=UserOut(**user_dict),
    )


@auth_router.post("/login", response_model=TokenResponse)
async def login(body: UserLogin):
    db = get_db()

    user_doc = await db.users.find_one({"email": body.email.lower()})
    if not user_doc or not verify_password(body.password, user_doc["hashed_password"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = create_access_token({"sub": user_doc["id"]})
    user_doc.pop("_id", None)
    user_doc.pop("hashed_password", None)
    user_doc.setdefault("daily_word_goal", 500)
    return TokenResponse(
        access_token=token,
        user=UserOut(**user_doc),
    )


# OAuth2 form-based login (used by FastAPI's /docs Authorize button)
@auth_router.post("/login/form", response_model=TokenResponse)
async def login_form(form_data: OAuth2PasswordRequestForm = Depends()):
    db = get_db()
    user_doc = await db.users.find_one({"email": form_data.username.lower()})
    if not user_doc or not verify_password(form_data.password, user_doc["hashed_password"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = create_access_token({"sub": user_doc["id"]})
    user_doc.pop("_id", None)
    user_doc.pop("hashed_password", None)
    user_doc.setdefault("daily_word_goal", 500)
    return TokenResponse(
        access_token=token,
        user=UserOut(**user_doc),
    )


@auth_router.get("/me", response_model=UserOut)
async def me(current_user: UserOut = Depends(get_current_user)):
    return current_user


@auth_router.patch("/me/preferences", response_model=UserOut)
async def update_preferences(
    body: UserPreferencesUpdate,
    current_user: UserOut = Depends(get_current_user),
):
    """Update the current user's preferences (daily word goal, display name)."""
    db = get_db()
    updates = {}

    if body.daily_word_goal is not None:
        if body.daily_word_goal < 0 or body.daily_word_goal > 100000:
            raise HTTPException(
                status_code=422,
                detail="daily_word_goal must be between 0 and 100000",
            )
        updates["daily_word_goal"] = body.daily_word_goal

    if body.display_name is not None:
        name = body.display_name.strip()
        if not name:
            raise HTTPException(status_code=422, detail="display_name cannot be blank")
        updates["display_name"] = name

    if body.first_name is not None:
        updates["first_name"] = body.first_name.strip()

    if body.last_name is not None:
        updates["last_name"] = body.last_name.strip()

    if body.pen_name is not None:
        updates["pen_name"] = body.pen_name.strip()

    if body.use_pen_name is not None:
        updates["use_pen_name"] = body.use_pen_name

    if body.avatar is not None:
        ALLOWED_AVATARS = {
            "", "quill", "books", "typewriter", "coffee",
            "owl", "moon", "lantern", "anchor",
        }
        if body.avatar not in ALLOWED_AVATARS:
            raise HTTPException(
                status_code=422,
                detail=f"Unknown avatar: {body.avatar}",
            )
        updates["avatar"] = body.avatar

    if not updates:
        return current_user

    await db.users.update_one({"id": current_user.id}, {"$set": updates})

    refreshed = await db.users.find_one(
        {"id": current_user.id}, {"_id": 0, "hashed_password": 0}
    )
    refreshed.setdefault("daily_word_goal", 500)
    return UserOut(**refreshed)

@auth_router.post("/tour/complete", response_model=UserOut)
async def complete_tour(current_user: UserOut = Depends(get_current_user)):
    """Mark the current user's Thad tour as complete.

    Called when the writer finishes or skips the tour. The flag lives on the
    user record so it persists across logins and devices — the tour is a
    one-time experience, not a per-browser one.
    """
    db = get_db()
    await db.users.update_one(
        {"id": current_user.id},
        {"$set": {"tour_complete": True}},
    )
    refreshed = await db.users.find_one(
        {"id": current_user.id}, {"_id": 0, "hashed_password": 0}
    )
    refreshed.setdefault("daily_word_goal", 500)
    return UserOut(**refreshed)


@auth_router.delete("/me")
async def delete_account(
    body: AccountDeleteRequest,
    current_user: UserOut = Depends(get_current_user),
):
    """Permanently delete the current user's account and all their data.

    Cascades through all collections the user owns. The deletion is hard —
    nothing is soft-deleted, nothing is recoverable. The reader-facing
    public share endpoints already handle missing-user gracefully (the
    share record is deleted, so the public endpoint returns 410).

    Known limitation: documents in `manuscripts_collection` written by the
    import endpoint do not carry `user_id` and are not caught by this
    cascade. This is documented in CLAUDE.md as a parked issue.
    """
    if body.confirmation != "DELETE":
        raise HTTPException(
            status_code=400,
            detail="Confirmation must be exactly 'DELETE'.",
        )

    db = get_db()
    user_id = current_user.id

    # Step 1: collect project IDs for the project-scoped cascades.
    project_docs = await db.projects.find(
        {"user_id": user_id}, {"id": 1, "_id": 0}
    ).to_list(10000)
    project_ids = [p["id"] for p in project_docs]

    # Step 2: cascade through project-scoped collections.
    if project_ids:
        await db.chapters.delete_many({"project_id": {"$in": project_ids}})
        await db.thad_revisions.delete_many(
            {"project_id": {"$in": project_ids}}
        )
        await db.thad_style_notes.delete_many(
            {"project_id": {"$in": project_ids}}
        )
        await db.art_assets.delete_many({"project_id": {"$in": project_ids}})
        await db.book_art_profiles.delete_many(
            {"project_id": {"$in": project_ids}}
        )

    # Step 3: cascade through user-scoped collections.
    user_scoped = [
        "projects",
        "notes",
        "versions",
        "writing_sessions",
        "style_presets",
        "shares",
    ]
    for collection_name in user_scoped:
        await db[collection_name].delete_many({"user_id": user_id})

    # Step 4: delete the user record itself.
    await db.users.delete_one({"id": user_id})

    return {"deleted": True}
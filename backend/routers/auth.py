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


class UserPreferencesUpdate(BaseModel):
    daily_word_goal: Optional[int] = None
    display_name: Optional[str] = None


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class UserInDB(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: str
    display_name: Optional[str] = None
    hashed_password: str
    daily_word_goal: int = 500
    created_at: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )


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
    return TokenResponse(
        access_token=token,
        user=UserOut(
            id=user.id,
            email=user.email,
            display_name=user.display_name,
            created_at=user.created_at,
            daily_word_goal=user.daily_word_goal,
        ),
    )


@auth_router.post("/login", response_model=TokenResponse)
async def login(body: UserLogin):
    db = get_db()

    user_doc = await db.users.find_one({"email": body.email.lower()})
    if not user_doc or not verify_password(body.password, user_doc["hashed_password"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = create_access_token({"sub": user_doc["id"]})
    return TokenResponse(
        access_token=token,
        user=UserOut(
            id=user_doc["id"],
            email=user_doc["email"],
            display_name=user_doc.get("display_name"),
            created_at=user_doc["created_at"],
            daily_word_goal=user_doc.get("daily_word_goal", 500),
        ),
    )


# OAuth2 form-based login (used by FastAPI's /docs Authorize button)
@auth_router.post("/login/form", response_model=TokenResponse)
async def login_form(form_data: OAuth2PasswordRequestForm = Depends()):
    db = get_db()
    user_doc = await db.users.find_one({"email": form_data.username.lower()})
    if not user_doc or not verify_password(form_data.password, user_doc["hashed_password"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = create_access_token({"sub": user_doc["id"]})
    return TokenResponse(
        access_token=token,
        user=UserOut(
            id=user_doc["id"],
            email=user_doc["email"],
            display_name=user_doc.get("display_name"),
            created_at=user_doc["created_at"],
            daily_word_goal=user_doc.get("daily_word_goal", 500),
        ),
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

    if not updates:
        return current_user

    await db.users.update_one({"id": current_user.id}, {"$set": updates})

    refreshed = await db.users.find_one(
        {"id": current_user.id}, {"_id": 0, "hashed_password": 0}
    )
    refreshed.setdefault("daily_word_goal", 500)
    return UserOut(**refreshed)

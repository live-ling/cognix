"""Authentication API routes: register, login, get current user."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, get_current_user
from app.models.user import User
from app.schemas.auth import (
    RegisterRequest,
    LoginRequest,
    TokenResponse,
    UserOut,
    UpdateProfileRequest,
    ChangePasswordRequest,
    AiSettingsRequest,
    AiSettingsOut,
    AiTestResponse,
    AiTestCredentialsRequest,
)
from app.schemas.common import ApiResponse
from app.utils.auth import (
    hash_password,
    verify_password,
    create_access_token,
)

router = APIRouter()


@router.post("/register", response_model=ApiResponse[TokenResponse], status_code=201)
async def register(data: RegisterRequest, db: AsyncSession = Depends(get_db)):
    """Register a new user and return a JWT token."""
    # Check if email already exists
    existing = await db.scalar(select(User).where(User.email == data.email))
    if existing:
        raise HTTPException(status_code=400, detail="该邮箱已被注册")

    user = User(
        name=data.name,
        email=data.email,
        password_hash=hash_password(data.password),
    )
    db.add(user)
    await db.flush()

    token = create_access_token({"sub": user.id})
    return ApiResponse(data=TokenResponse(access_token=token))


@router.post("/login", response_model=ApiResponse[TokenResponse])
async def login(data: LoginRequest, db: AsyncSession = Depends(get_db)):
    """Login with email and password, return a JWT token."""
    user = await db.scalar(select(User).where(User.email == data.email))
    if not user or not user.password_hash:
        raise HTTPException(status_code=401, detail="邮箱或密码错误")

    if not verify_password(data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="邮箱或密码错误")

    token = create_access_token({"sub": user.id})
    return ApiResponse(data=TokenResponse(access_token=token))


def _user_out(user: User) -> UserOut:
    """Build UserOut from User model."""
    return UserOut(
        id=user.id,
        name=user.name,
        email=user.email,
        bio=user.bio or "",
        ai_configured=bool(user.ai_api_key),
        ai_base_url=user.ai_base_url or "",
        ai_model=user.ai_model or "",
        created_at=user.created_at,
    )


@router.get("/me", response_model=ApiResponse[UserOut])
async def get_me(user: User = Depends(get_current_user)):
    """Get current authenticated user info."""
    return ApiResponse(data=_user_out(user))


@router.put("/me", response_model=ApiResponse[UserOut])
async def update_me(
    data: UpdateProfileRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update current user's profile."""
    if data.name is not None:
        user.name = data.name
    if data.bio is not None:
        user.bio = data.bio
    await db.flush()
    return ApiResponse(data=_user_out(user))


@router.get("/ai-settings", response_model=ApiResponse[AiSettingsOut])
async def get_ai_settings(user: User = Depends(get_current_user)):
    """Get current user's AI settings (key masked)."""
    key = user.ai_api_key or ""
    masked = key[:4] + "****" + key[-4:] if len(key) > 8 else ("****" if key else "")
    return ApiResponse(data=AiSettingsOut(
        ai_configured=bool(key),
        ai_api_key_masked=masked,
        ai_base_url=user.ai_base_url or "",
        ai_model=user.ai_model or "",
    ))


@router.put("/ai-settings", response_model=ApiResponse[AiSettingsOut])
async def save_ai_settings(
    data: AiSettingsRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Save current user's AI settings."""
    user.ai_api_key = data.ai_api_key
    user.ai_base_url = data.ai_base_url
    user.ai_model = data.ai_model
    await db.flush()

    key = data.ai_api_key
    masked = key[:4] + "****" + key[-4:] if len(key) > 8 else "****"
    return ApiResponse(data=AiSettingsOut(
        ai_configured=True,
        ai_api_key_masked=masked,
        ai_base_url=data.ai_base_url,
        ai_model=data.ai_model,
    ))


def _extract_reply(response_data: dict) -> str:
    """Extract model reply from various response formats."""
    choices = response_data.get("choices", [])
    if not choices:
        return ""

    choice = choices[0]

    # Standard OpenAI chat format: choices[0].message.content
    msg = choice.get("message", {})
    if isinstance(msg, dict):
        content = msg.get("content", "")
        if content:
            return str(content).strip()

    # Older completion format: choices[0].text
    if "text" in choice and choice["text"]:
        return str(choice["text"]).strip()

    # Some models return reasoning_content in message
    if isinstance(msg, dict):
        reasoning = msg.get("reasoning_content", "")
        if reasoning:
            return str(reasoning).strip()

    return ""


@router.post("/ai-test", response_model=ApiResponse[AiTestResponse])
async def test_ai_settings(user: User = Depends(get_current_user)):
    """Test the user's AI API connection."""
    import httpx

    key = user.ai_api_key
    base_url = (user.ai_base_url or "").rstrip("/")
    model = user.ai_model or "gpt-4o-mini"

    if not key:
        return ApiResponse(data=AiTestResponse(success=False, message="未配置 API Key"))

    url = f"{base_url}/chat/completions"
    headers = {"Authorization": f"Bearer {key}", "Content-Type": "application/json"}
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": "只回复单词 OK，不要回复任何其他内容。"},
            {"role": "user", "content": "hi"},
        ],
        "max_tokens": 5,
        "temperature": 0,
    }

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(url, json=payload, headers=headers)
            resp.raise_for_status()
        data = resp.json()
        reply = _extract_reply(data)
        if reply:
            message = f"连接成功！模型回复: {reply[:50]}"
        else:
            message = "连接成功！API 响应正常（模型未返回文本内容）"
        return ApiResponse(data=AiTestResponse(success=True, message=message))
    except httpx.TimeoutException:
        return ApiResponse(data=AiTestResponse(success=False, message="连接超时，请检查地址"))
    except httpx.HTTPStatusError as e:
        return ApiResponse(data=AiTestResponse(success=False, message=f"API 错误: {e.response.status_code}"))
    except Exception as e:
        return ApiResponse(data=AiTestResponse(success=False, message=f"连接失败: {str(e)[:100]}"))


@router.post("/ai-test-credentials", response_model=ApiResponse[AiTestResponse])
async def test_ai_credentials(data: AiTestCredentialsRequest):
    """Test AI connection with provided credentials (before saving)."""
    import httpx

    base_url = data.ai_base_url.rstrip("/")
    url = f"{base_url}/chat/completions"
    headers = {"Authorization": f"Bearer {data.ai_api_key}", "Content-Type": "application/json"}
    payload = {
        "model": data.ai_model,
        "messages": [
            {"role": "system", "content": "只回复单词 OK，不要回复任何其他内容。"},
            {"role": "user", "content": "hi"},
        ],
        "max_tokens": 5,
        "temperature": 0,
    }

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(url, json=payload, headers=headers)
            resp.raise_for_status()
        resp_data = resp.json()
        reply = _extract_reply(resp_data)
        if reply:
            message = f"连接成功！模型回复: {reply[:50]}"
        else:
            message = "连接成功！API 响应正常（模型未返回文本内容）"
        return ApiResponse(data=AiTestResponse(success=True, message=message))
    except httpx.TimeoutException:
        return ApiResponse(data=AiTestResponse(success=False, message="连接超时，请检查地址"))
    except httpx.HTTPStatusError as e:
        return ApiResponse(data=AiTestResponse(success=False, message=f"API 错误: {e.response.status_code}"))
    except Exception as e:
        return ApiResponse(data=AiTestResponse(success=False, message=f"连接失败: {str(e)[:100]}"))


@router.post("/change-password", response_model=ApiResponse[dict])
async def change_password(
    data: ChangePasswordRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Change current user's password."""
    if not user.password_hash or not verify_password(data.old_password, user.password_hash):
        raise HTTPException(status_code=400, detail="原密码错误")

    user.password_hash = hash_password(data.new_password)
    await db.flush()
    return ApiResponse(data={"message": "密码修改成功"})

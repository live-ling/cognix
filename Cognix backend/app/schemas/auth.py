"""Pydantic schemas for authentication endpoints."""

from pydantic import BaseModel, Field, EmailStr
from typing import Optional
from datetime import datetime


class RegisterRequest(BaseModel):
    """Registration request body."""
    name: str = Field(..., min_length=1, max_length=100)
    email: str = Field(..., min_length=3, max_length=255)
    password: str = Field(..., min_length=6, max_length=128)


class LoginRequest(BaseModel):
    """Login request body."""
    email: str = Field(..., min_length=3, max_length=255)
    password: str = Field(..., min_length=1, max_length=128)


class TokenResponse(BaseModel):
    """JWT token response."""
    access_token: str
    token_type: str = "bearer"


class UserOut(BaseModel):
    """User info output (no sensitive fields)."""
    id: str
    name: str
    email: str
    bio: Optional[str] = ""
    ai_configured: bool = False
    ai_base_url: Optional[str] = ""
    ai_model: Optional[str] = ""
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class UpdateProfileRequest(BaseModel):
    """Update user profile request."""
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    bio: Optional[str] = Field(None, max_length=500)


class AiSettingsRequest(BaseModel):
    """AI API settings request."""
    ai_api_key: str = Field(..., min_length=1, max_length=255)
    ai_base_url: str = Field(..., min_length=1, max_length=500)
    ai_model: str = Field(..., min_length=1, max_length=100)


class AiSettingsOut(BaseModel):
    """AI settings output (key masked)."""
    ai_configured: bool
    ai_api_key_masked: str = ""
    ai_base_url: str = ""
    ai_model: str = ""


class AiTestResponse(BaseModel):
    """AI API test result."""
    success: bool
    message: str


class ChangePasswordRequest(BaseModel):
    """Change password request."""
    old_password: str = Field(..., min_length=1, max_length=128)
    new_password: str = Field(..., min_length=6, max_length=128)


class AiTestCredentialsRequest(BaseModel):
    """Test AI connection with provided credentials (before saving)."""
    ai_api_key: str = Field(..., min_length=1, max_length=255)
    ai_base_url: str = Field(..., min_length=1, max_length=500)
    ai_model: str = Field(..., min_length=1, max_length=100)

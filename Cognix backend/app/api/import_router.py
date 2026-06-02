"""Import API: file upload and AI question generation (bank-scoped)."""

import os
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, get_current_user, get_redis
from app.config import settings
from app.models.user import User
from app.models.bank import Bank
from app.models.question import Question
from app.schemas.common import ApiResponse
from app.schemas.import_schema import (
    UploadResponse,
    GenerateRequest,
    GenerateResponse,
    GeneratedQuestion,
)
from app.schemas.question import to_backend_type, to_backend_diff
from app.utils.file_parser import parse_file
from app.services import ai_service

router = APIRouter()

ALLOWED_EXTENSIONS = {".txt", ".docx"}
_upload_registry: dict[str, dict] = {}


@router.post("/upload", response_model=ApiResponse[UploadResponse])
async def upload_file(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    """Upload a file for AI question generation."""
    filename = file.filename or "unknown"
    ext = Path(filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"不支持的文件格式: {ext}（仅支持 .txt 和 .docx）")

    content = await file.read()
    max_bytes = settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024
    if len(content) > max_bytes:
        raise HTTPException(status_code=400, detail=f"文件过大（最大 {settings.MAX_UPLOAD_SIZE_MB}MB）")

    upload_dir = Path(settings.UPLOAD_DIR)
    upload_dir.mkdir(parents=True, exist_ok=True)
    file_id = str(uuid.uuid4())
    save_path = upload_dir / f"{file_id}{ext}"

    with open(save_path, "wb") as f:
        f.write(content)

    try:
        text = parse_file(str(save_path))
    except ValueError as e:
        os.remove(save_path)
        raise HTTPException(status_code=400, detail=str(e))

    _upload_registry[file_id] = {
        "path": str(save_path),
        "text": text,
        "filename": filename,
        "user_id": current_user.id,
    }

    preview = text[:500] + ("..." if len(text) > 500 else "")
    return ApiResponse(data=UploadResponse(
        file_id=file_id, filename=filename, preview=preview, char_count=len(text),
    ))


@router.post("/generate", response_model=ApiResponse[GenerateResponse])
async def generate_questions(
    data: GenerateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    redis=Depends(get_redis),
):
    """Generate questions from uploaded file using user's AI settings."""
    file_data = _upload_registry.get(data.file_id)
    if not file_data or file_data["user_id"] != current_user.id:
        raise HTTPException(status_code=404, detail="文件不存在或已过期")

    # Get user's AI settings
    if not current_user.ai_api_key:
        raise HTTPException(status_code=400, detail="请先在个人主页配置 AI API 设置")

    # Resolve bank
    if data.bank_id:
        bank = await db.scalar(
            select(Bank).where(Bank.id == data.bank_id, Bank.user_id == current_user.id)
        )
        if not bank:
            raise HTTPException(status_code=404, detail="题库不存在")
    else:
        bank_name = data.bank_name or f"AI导入 - {file_data['filename']}"
        bank = Bank(title=bank_name, description=f"由 AI 从「{file_data['filename']}」生成", user_id=current_user.id)
        db.add(bank)
        await db.flush()

    # Generate via AI using user's settings
    try:
        raw_questions = await ai_service.generate_questions(
            text=file_data["text"],
            count=data.count,
            question_types=data.question_types,
            api_key=current_user.ai_api_key,
            base_url=current_user.ai_base_url,
            model=current_user.ai_model,
        )
    except (ValueError, RuntimeError) as e:
        raise HTTPException(status_code=502, detail=str(e))

    # Save to DB
    created = []
    for q in raw_questions:
        qtype_backend = to_backend_type(q["type"])
        diff_backend = to_backend_diff(q["difficulty"])
        answer_str = _answers_to_str(q["answers"], q["type"])

        question = Question(
            bank_id=bank.id,
            type=qtype_backend,
            content=q["stem"],
            options=q["options"],
            answer=answer_str,
            explanation=q.get("analysis"),
            difficulty=diff_backend,
        )
        db.add(question)
        created.append(q)

    await db.flush()
    await redis.invalidate_pattern(f"banks:{current_user.id}:*")

    # Cleanup
    try:
        os.remove(file_data["path"])
    except OSError:
        pass
    _upload_registry.pop(data.file_id, None)

    return ApiResponse(data=GenerateResponse(
        bank_id=bank.id,
        bank_name=bank.title,
        created_count=len(created),
        questions=[GeneratedQuestion(**q) for q in created],
    ))


def _answers_to_str(answers: list[str], qtype: str) -> str:
    """Convert answers list to DB single string format."""
    if qtype == "judgement":
        return answers[0] if answers else "正确"
    if qtype == "multiple":
        letters = []
        for a in answers:
            a = a.strip()
            if len(a) == 1 and a.isalpha():
                letters.append(a.upper())
            elif "." in a:
                letters.append(a.split(".")[0].strip().upper())
            else:
                letters.append(a.upper())
        return "".join(sorted(letters))
    a = answers[0].strip()
    if len(a) == 1 and a.isalpha():
        return a.upper()
    if "." in a:
        return a.split(".")[0].strip().upper()
    return a.upper()

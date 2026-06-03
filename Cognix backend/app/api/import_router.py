"""Import API: file upload, AI question generation, and save after review."""

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
    SaveQuestionsRequest,
    SaveQuestionsResponse,
)
from app.schemas.question import to_backend_type, to_backend_diff
from app.utils.file_parser import parse_file
from app.services import ai_service

router = APIRouter()

ALLOWED_EXTENSIONS = {".txt", ".docx"}
_upload_registry: dict[str, dict] = {}


def _extract_text_from_generate(data: GenerateRequest) -> str:
    """Extract text from either file_id or direct text input."""
    if data.text:
        return data.text.strip()
    if data.file_id:
        file_data = _upload_registry.get(data.file_id)
        if not file_data:
            raise HTTPException(status_code=404, detail="文件不存在或已过期")
        return file_data["text"]
    raise HTTPException(status_code=400, detail="必须提供 file_id 或 text")


@router.post("/upload", response_model=ApiResponse[UploadResponse])
async def upload_file(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    """Upload a file to extract text for AI question generation."""
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
):
    """Generate questions from text using user's AI settings. Does NOT save to DB.

    Accepts either a file_id (from /upload) or raw text directly.
    Returns the generated questions for user review.
    """
    # Validate file ownership if file_id is used
    if data.file_id:
        file_data = _upload_registry.get(data.file_id)
        if not file_data or file_data["user_id"] != current_user.id:
            raise HTTPException(status_code=404, detail="文件不存在或已过期")

    # Validate bank exists if provided
    if data.bank_id:
        bank = await db.scalar(
            select(Bank).where(Bank.id == data.bank_id, Bank.user_id == current_user.id)
        )
        if not bank:
            raise HTTPException(status_code=404, detail="题库不存在")

    # Check AI config
    if not current_user.ai_api_key:
        raise HTTPException(status_code=400, detail="请先在个人主页配置 AI API 设置")

    # Extract text from file or direct input
    text = _extract_text_from_generate(data)

    # Generate via AI
    try:
        raw_questions = await ai_service.generate_questions(
            text=text,
            count=data.count,
            question_types=data.question_types,
            api_key=current_user.ai_api_key,
            base_url=current_user.ai_base_url,
            model=current_user.ai_model,
            material_mode=data.material_mode,
            single_count=data.single_count,
            multiple_count=data.multiple_count,
            judgement_count=data.judgement_count,
        )
    except (ValueError, RuntimeError) as e:
        raise HTTPException(status_code=502, detail=str(e))

    return ApiResponse(data=GenerateResponse(
        questions=[GeneratedQuestion(**q) for q in raw_questions],
    ))


@router.post("/save", response_model=ApiResponse[SaveQuestionsResponse])
async def save_questions(
    data: SaveQuestionsRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    redis=Depends(get_redis),
):
    """Save reviewed questions to a bank. Questions are user-confirmed before calling this."""
    # Validate bank
    bank = await db.scalar(
        select(Bank).where(Bank.id == data.bank_id, Bank.user_id == current_user.id)
    )
    if not bank:
        raise HTTPException(status_code=404, detail="题库不存在")

    # Save questions
    created = 0
    for q in data.questions:
        qtype_backend = to_backend_type(q.type)
        diff_backend = to_backend_diff(q.difficulty)
        answer_str = _answers_to_str(q.answers, q.type)

        question = Question(
            bank_id=bank.id,
            type=qtype_backend,
            content=q.stem,
            options=q.options,
            answer=answer_str,
            explanation=q.analysis,
            difficulty=diff_backend,
        )
        db.add(question)
        created += 1

    await db.flush()
    await redis.invalidate_pattern(f"banks:{current_user.id}:*")

    # Cleanup file if present
    if data.bank_id:
        # Clean up any registry entries that might match
        for fid, entry in list(_upload_registry.items()):
            if entry["user_id"] == current_user.id:
                try:
                    os.remove(entry["path"])
                except OSError:
                    pass
                _upload_registry.pop(fid, None)

    return ApiResponse(data=SaveQuestionsResponse(
        bank_id=bank.id,
        bank_name=bank.title,
        created_count=created,
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

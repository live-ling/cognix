"""File parsing utilities for extracting text from uploaded documents."""

import os
from pathlib import Path

# Max characters to send to AI (token limit consideration)
MAX_TEXT_LENGTH = 15000


def parse_txt(file_path: str) -> str:
    """Extract text from a .txt file. Tries UTF-8 first, falls back to GBK."""
    for encoding in ("utf-8", "gbk", "latin-1"):
        try:
            with open(file_path, "r", encoding=encoding) as f:
                return f.read().strip()
        except (UnicodeDecodeError, UnicodeError):
            continue
    raise ValueError("无法识别文件编码")


def parse_docx(file_path: str) -> str:
    """Extract text from a .docx file using python-docx."""
    from docx import Document

    doc = Document(file_path)
    paragraphs = [p.text.strip() for p in doc.paragraphs if p.text.strip()]
    return "\n".join(paragraphs)


def parse_file(file_path: str) -> str:
    """Parse a file and return its text content.

    Supports .txt and .docx. Text is truncated to MAX_TEXT_LENGTH characters.
    """
    ext = Path(file_path).suffix.lower()

    if ext == ".txt":
        text = parse_txt(file_path)
    elif ext == ".docx":
        text = parse_docx(file_path)
    else:
        raise ValueError(f"不支持的文件格式: {ext}（仅支持 .txt 和 .docx）")

    if not text:
        raise ValueError("文件内容为空")

    if len(text) > MAX_TEXT_LENGTH:
        text = text[:MAX_TEXT_LENGTH] + "\n\n[内容过长，已截断]"

    return text

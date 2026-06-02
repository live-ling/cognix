"""AI-powered question generation service.

Uses OpenAI-compatible API (supports custom base_url for proxies/alternatives).
"""

import json
import httpx
from typing import Optional

from app.config import settings

# Prompt template for question generation
SYSTEM_PROMPT = """你是一个专业的题目生成助手。根据用户提供的文本内容，生成指定数量和类型的题目。

你必须严格按照以下 JSON 格式返回，不要包含任何其他文字：

```json
[
  {
    "stem": "题干文本",
    "type": "single",
    "options": ["A. 选项1", "B. 选项2", "C. 选项3", "D. 选项4"],
    "answers": ["A"],
    "analysis": "解析说明",
    "difficulty": "medium"
  }
]
```

规则：
- type 只能是 "single"（单选）、"multiple"（多选）、"judgement"（判断）
- single 类型 answers 只有一个元素如 ["A"]
- multiple 类型 answers 有多个元素如 ["A","C"]
- judgement 类型 options 必须是 ["正确", "错误"]，answers 为 ["正确"] 或 ["错误"]
- options 每项格式为 "A. xxx"、"B. xxx"（判断题除外）
- difficulty 只能是 "easy"、"medium"、"hard"
- analysis 是对答案的解析说明
- 所有内容基于提供的文本，不要编造"""

QUESTION_TYPE_DESC = {
    "single": "单选题（4个选项，1个正确答案）",
    "multiple": "多选题（4个选项，多个正确答案）",
    "judgement": "判断题（正确/错误）",
}


async def generate_questions(
    text: str,
    count: int = 10,
    question_types: Optional[list[str]] = None,
    api_key: Optional[str] = None,
    base_url: Optional[str] = None,
    model: Optional[str] = None,
) -> list[dict]:
    """Generate questions from text using AI API.

    Args:
        text: The source text to generate questions from.
        count: Number of questions to generate (1-50).
        question_types: List of types to generate. Defaults to ["single"].
        api_key: User's API key (overrides global config).
        base_url: User's base URL (overrides global config).
        model: User's model (overrides global config).

    Returns:
        List of question dicts compatible with QuestionCreate schema.

    Raises:
        ValueError: If API key is not configured or response is invalid.
        RuntimeError: If API call fails.
    """
    key = api_key or settings.OPENAI_API_KEY
    url_base = (base_url or settings.OPENAI_BASE_URL).rstrip("/")
    mdl = model or settings.OPENAI_MODEL

    if not key:
        raise ValueError("未配置 AI API Key，请在个人主页设置中配置")

    if not question_types:
        question_types = ["single"]

    count = max(1, min(count, 50))
    types_desc = "、".join(QUESTION_TYPE_DESC.get(t, t) for t in question_types)

    user_prompt = f"""请根据以下文本内容生成 {count} 道题目。

题型要求：{types_desc}
如果指定了多种题型，请均匀分配数量。

文本内容：
{text}"""

    url = f"{url_base}/chat/completions"

    headers = {
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
    }

    payload = {
        "model": mdl,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ],
        "temperature": 0.7,
        "max_tokens": 8000,
    }

    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            resp = await client.post(url, json=payload, headers=headers)
            resp.raise_for_status()
    except httpx.TimeoutException:
        raise RuntimeError("AI 接口请求超时，请稍后重试")
    except httpx.HTTPStatusError as e:
        raise RuntimeError(f"AI 接口返回错误: {e.response.status_code}")
    except Exception as e:
        raise RuntimeError(f"AI 接口请求失败: {str(e)}")

    try:
        data = resp.json()
        content = data["choices"][0]["message"]["content"]
    except (KeyError, IndexError, json.JSONDecodeError) as e:
        raise RuntimeError(f"AI 返回格式异常: {str(e)}")

    # Parse JSON from response (handle markdown code blocks)
    questions = _parse_json_response(content)
    if not questions:
        raise RuntimeError("AI 未能生成有效题目，请重试")

    # Validate and clean each question
    cleaned = []
    for q in questions:
        valid = _validate_question(q)
        if valid:
            cleaned.append(valid)

    if not cleaned:
        raise RuntimeError("AI 生成的题目格式均不符合要求，请重试")

    return cleaned


def _parse_json_response(content: str) -> list[dict]:
    """Extract JSON array from AI response, handling code blocks."""
    content = content.strip()

    # Remove markdown code block wrapper
    if content.startswith("```"):
        lines = content.split("\n")
        # Remove first line (```json) and last line (```)
        lines = [l for l in lines if not l.strip().startswith("```")]
        content = "\n".join(lines).strip()

    try:
        result = json.loads(content)
        if isinstance(result, list):
            return result
        if isinstance(result, dict) and "questions" in result:
            return result["questions"]
        return [result] if isinstance(result, dict) else []
    except json.JSONDecodeError:
        # Try to find JSON array in the content
        start = content.find("[")
        end = content.rfind("]")
        if start != -1 and end != -1:
            try:
                return json.loads(content[start : end + 1])
            except json.JSONDecodeError:
                pass
        return []


def _validate_question(q: dict) -> Optional[dict]:
    """Validate and clean a single question dict."""
    if not isinstance(q, dict):
        return None

    stem = q.get("stem", "").strip()
    if not stem:
        return None

    qtype = q.get("type", "single").strip().lower()
    if qtype not in ("single", "multiple", "judgement"):
        qtype = "single"

    options = q.get("options", [])
    if not isinstance(options, list) or len(options) < 2:
        return None

    # Clean options - ensure they are strings
    options = [str(o).strip() for o in options if o]

    answers = q.get("answers", [])
    if not isinstance(answers, list) or not answers:
        return None
    answers = [str(a).strip() for a in answers if a]

    analysis = q.get("analysis", "").strip() or None

    difficulty = q.get("difficulty", "medium").strip().lower()
    if difficulty not in ("easy", "medium", "hard"):
        difficulty = "medium"

    return {
        "stem": stem,
        "type": qtype,
        "options": options,
        "answers": answers,
        "analysis": analysis,
        "difficulty": difficulty,
    }

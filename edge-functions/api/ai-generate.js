// EdgeOne Function: AI question generation/parsing

const SYSTEM_PROMPT = `你是一个专业的题目解析助手。用户会提供一段文本，你需要将其中的所有题目转换为统一的 JSON 格式。

核心任务：
1. **如果文本包含已有题目**（有题干、选项、答案），提取其中**所有题目**，保持原题型和原答案不变
2. **如果文本是学习材料**（无现成题目结构），则根据材料内容按指定数量生成题目
3. 无论哪种情况，都将题目转换为标准 JSON 格式输出

你必须严格按照以下 JSON 格式返回，不要包含任何其他文字：

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

规则：
- type 只能是 "single"（单选）、"multiple"（多选）、"judgement"（判断）
- single 类型 answers 只有一个元素如 ["A"]
- multiple 类型 answers 有多个元素如 ["A","C"]
- judgement 类型 options 必须是 ["正确", "错误"]，answers 为 ["正确"] 或 ["错误"]
- options 每项格式为 "A. xxx"、"B. xxx"（判断题除外）
- difficulty 根据题目内容判断，可选 "easy"、"medium"、"hard"
- analysis 保留原文解析，没有则根据题目内容简要补充
- **重要：如果文本包含已有题目，提取全部题目不要遗漏；题型必须与原文一致**
- **重要：如果文本中已有明确标注的答案，务必使用原文答案**
- 不要编造文本中不存在的题目`;

function parseJsonResponse(content) {
  content = content.trim();
  if (content.startsWith('```')) {
    content = content.split('\n').filter(l => !l.trim().startsWith('```')).join('\n').trim();
  }
  try {
    const result = JSON.parse(content);
    if (Array.isArray(result)) return result;
    if (result?.questions) return result.questions;
    return result ? [result] : [];
  } catch {
    const start = content.indexOf('[');
    const end = content.lastIndexOf(']');
    if (start !== -1 && end !== -1) {
      try { return JSON.parse(content.slice(start, end + 1)); } catch { /* ignore */ }
    }
    return [];
  }
}

export default async function onRequest(context) {
  if (context.request.method !== 'POST') {
    return new Response(JSON.stringify({ questions: [] }), { status: 405 });
  }

  try {
    const body = await context.request.json();
    const { text, count, question_types, material_mode, single_count, multiple_count, judgement_count, ai_api_key, ai_base_url, ai_model } = body;
    if (!text) return new Response(JSON.stringify({ questions: [] }));

    const isExtractMode = !material_mode && question_types?.length === 3 && count >= 50;

    let userPrompt;
    if (isExtractMode) {
      userPrompt = `请仔细阅读以下文本，提取其中**所有题目**并转换为标准格式。\n要求：\n- 题型必须与原文一致（单选题→single，多选题→multiple，判断题→judgement）\n- 答案必须与原文标注的一致\n- 如果原文包含解析，务必保留\n- 不要遗漏任何一道题\n\n文本内容：\n${text}`;
    } else if (material_mode) {
      userPrompt = `请根据以下学习材料内容生成题目。\n具体要求：\n- 单选题：${single_count || 5} 道（4个选项，1个正确答案）\n- 多选题：${multiple_count || 3} 道（4个选项，多个正确答案）\n- 判断题：${judgement_count || 2} 道（正确/错误）\n- 所有题目必须基于提供的材料内容，不要编造\n\n文本内容：\n${text}`;
    } else {
      userPrompt = `请根据以下文本内容生成 ${count || 10} 道题目。\n题型要求：${(question_types || ['single']).join('、')}\n\n文本内容：\n${text}`;
    }

    const baseUrl = (ai_base_url || 'https://api.openai.com/v1').replace(/\/$/, '');
    const url = `${baseUrl}/chat/completions`;
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${ai_api_key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: ai_model || 'gpt-4o-mini', messages: [{ role: 'system', content: SYSTEM_PROMPT }, { role: 'user', content: userPrompt }], temperature: 0.7, max_tokens: 8000 }),
    });

    if (!resp.ok) return new Response(JSON.stringify({ questions: [] }));

    const data = await resp.json();
    const content = data?.choices?.[0]?.message?.content || '';
    const questions = parseJsonResponse(content);

    return new Response(JSON.stringify({ questions }));
  } catch (e) {
    return new Response(JSON.stringify({ questions: [] }));
  }
}

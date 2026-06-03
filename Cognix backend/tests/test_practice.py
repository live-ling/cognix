"""Tests for Practice API — covers SINGLE, MULTIPLE, and TRUE_FALSE question types."""

import pytest


@pytest.fixture
async def practice_setup(client):
    """Create a bank with 5 SINGLE-choice questions for basic practice testing."""
    resp = await client.post("/api/banks", json={"title": "Practice Test Bank"})
    bank_id = resp.json()["data"]["id"]

    # Create 5 SINGLE questions (frontend format: answers as array, stem not content)
    for i in range(5):
        await client.post(f"/api/banks/{bank_id}/questions", json={
            "type": "single",
            "stem": f"Question {i+1}",
            "options": ["Option A", "Option B", "Option C", "Option D"],
            "answers": ["A"],
            "analysis": f"Explanation {i+1}",
        })

    return bank_id


@pytest.fixture
async def multi_question_bank(client):
    """Create a bank with MULTIPLE and TRUE_FALSE questions."""
    resp = await client.post("/api/banks", json={"title": "Multi & Judgement Bank"})
    bank_id = resp.json()["data"]["id"]

    # MULTIPLE choice: correct answer is A and C -> stored as "AC"
    await client.post(f"/api/banks/{bank_id}/questions", json={
        "type": "multiple",
        "stem": "Select all that apply",
        "options": ["Option A", "Option B", "Option C", "Option D"],
        "answers": ["A", "C"],
        "analysis": "A and C are correct",
    })

    # TRUE_FALSE / judgement: correct answer is "正确" (index 0 -> "A")
    await client.post(f"/api/banks/{bank_id}/questions", json={
        "type": "judgement",
        "stem": "Is this statement true?",
        "options": ["正确", "错误"],
        "answers": ["正确"],
        "analysis": "It is correct",
    })

    return bank_id


# ============================================================
# SINGLE choice tests
# ============================================================

@pytest.mark.asyncio
async def test_start_practice_sequential(client, practice_setup):
    bank_id = practice_setup
    response = await client.post("/api/practice/start", json={
        "bank_id": bank_id,
        "mode": "sequential",
        "count": 3,
    })
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert len(data["data"]["questions"]) == 3
    assert data["data"]["total_count"] == 3
    # Verify no answers exposed
    assert "answer" not in data["data"]["questions"][0]


@pytest.mark.asyncio
async def test_start_practice_random(client, practice_setup):
    response = await client.post("/api/practice/start", json={
        "bank_id": practice_setup,
        "mode": "random",
        "count": 2,
    })
    assert response.status_code == 200
    assert len(response.json()["data"]["questions"]) == 2


@pytest.mark.asyncio
async def test_submit_correct_answer(client, practice_setup):
    bank_id = practice_setup

    # Start a session
    start_resp = await client.post("/api/practice/start", json={
        "bank_id": bank_id,
        "mode": "sequential",
        "count": 3,
    })
    session_id = start_resp.json()["data"]["session_id"]
    question = start_resp.json()["data"]["questions"][0]

    # Submit correct answer (frontend sends answers array)
    response = await client.post("/api/practice/submit", json={
        "session_id": session_id,
        "question_id": question["id"],
        "answers": ["A"],
        "time_spent": 10,
    })
    assert response.status_code == 200
    data = response.json()
    assert data["data"]["is_correct"] is True
    assert data["data"]["correct_answers"] == ["A"]


@pytest.mark.asyncio
async def test_submit_wrong_answer(client, practice_setup):
    bank_id = practice_setup

    start_resp = await client.post("/api/practice/start", json={
        "bank_id": bank_id,
        "mode": "sequential",
        "count": 3,
    })
    session_id = start_resp.json()["data"]["session_id"]
    question = start_resp.json()["data"]["questions"][0]

    # Submit wrong answer
    response = await client.post("/api/practice/submit", json={
        "session_id": session_id,
        "question_id": question["id"],
        "answers": ["B"],
        "time_spent": 15,
    })
    assert response.status_code == 200
    data = response.json()
    assert data["data"]["is_correct"] is False


@pytest.mark.asyncio
async def test_submit_duplicate(client, practice_setup):
    bank_id = practice_setup

    start_resp = await client.post("/api/practice/start", json={
        "bank_id": bank_id,
        "mode": "sequential",
        "count": 3,
    })
    session_id = start_resp.json()["data"]["session_id"]
    question = start_resp.json()["data"]["questions"][0]

    # Submit once
    await client.post("/api/practice/submit", json={
        "session_id": session_id,
        "question_id": question["id"],
        "answers": ["A"],
        "time_spent": 10,
    })

    # Submit again — should fail
    response = await client.post("/api/practice/submit", json={
        "session_id": session_id,
        "question_id": question["id"],
        "answers": ["B"],
        "time_spent": 20,
    })
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_finish_practice(client, practice_setup):
    bank_id = practice_setup

    start_resp = await client.post("/api/practice/start", json={
        "bank_id": bank_id,
        "mode": "sequential",
        "count": 3,
    })
    session_id = start_resp.json()["data"]["session_id"]

    # Submit answers for all 3 questions
    for q in start_resp.json()["data"]["questions"]:
        await client.post("/api/practice/submit", json={
            "session_id": session_id,
            "question_id": q["id"],
            "answers": ["A"],
            "time_spent": 10,
        })

    # Finish
    response = await client.post("/api/practice/finish", json={
        "session_id": session_id,
        "time_spent": 30,
    })
    assert response.status_code == 200
    data = response.json()
    assert data["data"]["total_count"] == 3
    assert data["data"]["correct_count"] == 3
    assert data["data"]["accuracy"] == 100.0
    assert len(data["data"]["details"]) == 3


@pytest.mark.asyncio
async def test_mistake_auto_collection(client, practice_setup):
    """Verify wrong answers create mistake records."""
    bank_id = practice_setup

    start_resp = await client.post("/api/practice/start", json={
        "bank_id": bank_id,
        "mode": "sequential",
        "count": 3,
    })
    session_id = start_resp.json()["data"]["session_id"]
    question = start_resp.json()["data"]["questions"][0]

    # Submit wrong answer
    await client.post("/api/practice/submit", json={
        "session_id": session_id,
        "question_id": question["id"],
        "answers": ["B"],
        "time_spent": 10,
    })

    # Finish session
    # (Skip remaining questions to simplify)
    for q in start_resp.json()["data"]["questions"][1:]:
        await client.post("/api/practice/submit", json={
            "session_id": session_id,
            "question_id": q["id"],
            "answers": ["A"],
            "time_spent": 5,
        })
    await client.post("/api/practice/finish", json={
        "session_id": session_id,
        "time_spent": 25,
    })

    # Check mistakes
    mistakes_resp = await client.get("/api/mistakes")
    assert mistakes_resp.status_code == 200
    mistakes = mistakes_resp.json()["data"]["items"]
    assert len(mistakes) >= 1


# ============================================================
# MULTIPLE choice tests
# ============================================================

@pytest.mark.asyncio
async def test_multiple_correct_full(client, multi_question_bank):
    """Multiple choice: select all correct options (A and C)."""
    bank_id = multi_question_bank

    start_resp = await client.post("/api/practice/start", json={
        "bank_id": bank_id,
        "mode": "sequential",
        "count": 2,
    })
    session_id = start_resp.json()["data"]["session_id"]
    questions = start_resp.json()["data"]["questions"]
    multi_q = [q for q in questions if q["type"] == "multiple"][0]

    # Select A and C (correct full set)
    response = await client.post("/api/practice/submit", json={
        "session_id": session_id,
        "question_id": multi_q["id"],
        "answers": ["A", "C"],
        "time_spent": 20,
    })
    assert response.status_code == 200
    data = response.json()
    assert data["data"]["is_correct"] is True
    assert sorted(data["data"]["correct_answers"]) == ["A", "C"]


@pytest.mark.asyncio
async def test_multiple_partial_wrong(client, multi_question_bank):
    """Multiple choice: select only some correct options (should be wrong)."""
    bank_id = multi_question_bank

    start_resp = await client.post("/api/practice/start", json={
        "bank_id": bank_id,
        "mode": "sequential",
        "count": 2,
    })
    session_id = start_resp.json()["data"]["session_id"]
    questions = start_resp.json()["data"]["questions"]
    multi_q = [q for q in questions if q["type"] == "multiple"][0]

    # Select only A (missing C)
    response = await client.post("/api/practice/submit", json={
        "session_id": session_id,
        "question_id": multi_q["id"],
        "answers": ["A"],
        "time_spent": 15,
    })
    assert response.status_code == 200
    data = response.json()
    assert data["data"]["is_correct"] is False


@pytest.mark.asyncio
async def test_multiple_extra_wrong(client, multi_question_bank):
    """Multiple choice: select correct + wrong option (should be wrong)."""
    bank_id = multi_question_bank

    start_resp = await client.post("/api/practice/start", json={
        "bank_id": bank_id,
        "mode": "sequential",
        "count": 2,
    })
    session_id = start_resp.json()["data"]["session_id"]
    questions = start_resp.json()["data"]["questions"]
    multi_q = [q for q in questions if q["type"] == "multiple"][0]

    # Select A, C, and B (B is wrong)
    response = await client.post("/api/practice/submit", json={
        "session_id": session_id,
        "question_id": multi_q["id"],
        "answers": ["A", "B", "C"],
        "time_spent": 25,
    })
    assert response.status_code == 200
    data = response.json()
    assert data["data"]["is_correct"] is False


# ============================================================
# TRUE_FALSE / Judgement tests
# ============================================================

@pytest.mark.asyncio
async def test_judgement_correct(client, multi_question_bank):
    """Judgement: select '正确' via letter label 'A'."""
    bank_id = multi_question_bank

    start_resp = await client.post("/api/practice/start", json={
        "bank_id": bank_id,
        "mode": "sequential",
        "count": 2,
    })
    session_id = start_resp.json()["data"]["session_id"]
    questions = start_resp.json()["data"]["questions"]
    judge_q = [q for q in questions if q["type"] == "judgement"][0]

    # Frontend sends "A" for the first option ("正确")
    response = await client.post("/api/practice/submit", json={
        "session_id": session_id,
        "question_id": judge_q["id"],
        "answers": ["A"],
        "time_spent": 8,
    })
    assert response.status_code == 200
    data = response.json()
    assert data["data"]["is_correct"] is True
    # correct_answers should map back to letter label for frontend highlighting
    assert data["data"]["correct_answers"] == ["A"]


@pytest.mark.asyncio
async def test_judgement_wrong(client, multi_question_bank):
    """Judgement: select '错误' via letter label 'B' (should be wrong)."""
    bank_id = multi_question_bank

    start_resp = await client.post("/api/practice/start", json={
        "bank_id": bank_id,
        "mode": "sequential",
        "count": 2,
    })
    session_id = start_resp.json()["data"]["session_id"]
    questions = start_resp.json()["data"]["questions"]
    judge_q = [q for q in questions if q["type"] == "judgement"][0]

    # Frontend sends "B" for the second option ("错误")
    response = await client.post("/api/practice/submit", json={
        "session_id": session_id,
        "question_id": judge_q["id"],
        "answers": ["B"],
        "time_spent": 5,
    })
    assert response.status_code == 200
    data = response.json()
    assert data["data"]["is_correct"] is False

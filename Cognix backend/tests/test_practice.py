"""Tests for Practice API."""

import pytest


@pytest.fixture
async def practice_setup(client):
    """Create a bank with 5 questions for practice testing."""
    resp = await client.post("/api/banks", json={"title": "Practice Test Bank"})
    bank_id = resp.json()["data"]["id"]

    # Create 5 questions
    for i in range(5):
        await client.post(f"/api/banks/{bank_id}/questions", json={
            "type": "SINGLE",
            "content": f"Question {i+1}",
            "options": ["A. a", "B. b", "C. c", "D. d"],
            "answer": "A",
            "explanation": f"Explanation {i+1}",
        })

    return bank_id


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

    # Submit correct answer
    response = await client.post("/api/practice/submit", json={
        "session_id": session_id,
        "question_id": question["id"],
        "answer": "A",  # Correct answer
        "time_spent": 10,
    })
    assert response.status_code == 200
    data = response.json()
    assert data["data"]["is_correct"] is True
    assert data["data"]["correct_answer"] == "A"


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
        "answer": "B",
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
        "answer": "A",
        "time_spent": 10,
    })

    # Submit again — should fail
    response = await client.post("/api/practice/submit", json={
        "session_id": session_id,
        "question_id": question["id"],
        "answer": "B",
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
            "answer": "A",
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
        "answer": "B",
        "time_spent": 10,
    })

    # Finish session
    # (Skip remaining questions to simplify)
    for q in start_resp.json()["data"]["questions"][1:]:
        await client.post("/api/practice/submit", json={
            "session_id": session_id,
            "question_id": q["id"],
            "answer": "A",
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

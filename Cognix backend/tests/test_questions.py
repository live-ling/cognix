"""Tests for Question CRUD API."""

import pytest


@pytest.fixture
async def bank_id(client):
    """Create a test bank and return its ID."""
    resp = await client.post("/api/banks", json={"title": "Question Test Bank"})
    return resp.json()["data"]["id"]


@pytest.mark.asyncio
async def test_create_single_question(client, bank_id):
    response = await client.post(f"/api/banks/{bank_id}/questions", json={
        "type": "SINGLE",
        "content": "What is the answer?",
        "options": ["A. Yes", "B. No", "C. Maybe", "D. None"],
        "answer": "A",
        "difficulty": "EASY",
        "tags": ["test"],
    })
    assert response.status_code == 201
    data = response.json()
    assert data["success"] is True
    assert data["data"]["type"] == "SINGLE"
    assert data["data"]["answer"] == "A"


@pytest.mark.asyncio
async def test_create_true_false_question(client, bank_id):
    response = await client.post(f"/api/banks/{bank_id}/questions", json={
        "type": "TRUE_FALSE",
        "content": "Is the sky blue?",
        "options": ["正确", "错误"],
        "answer": "正确",
    })
    assert response.status_code == 201


@pytest.mark.asyncio
async def test_create_multiple_question(client, bank_id):
    response = await client.post(f"/api/banks/{bank_id}/questions", json={
        "type": "MULTIPLE",
        "content": "Select all correct",
        "options": ["A. One", "B. Two", "C. Three", "D. Four"],
        "answer": "ABC",
    })
    assert response.status_code == 201


@pytest.mark.asyncio
async def test_validate_single_answer_format(client, bank_id):
    """Single choice answer must be one letter A-F."""
    response = await client.post(f"/api/banks/{bank_id}/questions", json={
        "type": "SINGLE",
        "content": "Test",
        "options": ["A. a", "B. b", "C. c", "D. d"],
        "answer": "AB",  # Invalid: multi-letter for SINGLE
    })
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_list_questions(client, bank_id):
    # Create two questions
    await client.post(f"/api/banks/{bank_id}/questions", json={
        "type": "SINGLE",
        "content": "Q1",
        "options": ["A. a", "B. b"],
        "answer": "A",
    })
    await client.post(f"/api/banks/{bank_id}/questions", json={
        "type": "SINGLE",
        "content": "Q2",
        "options": ["A. a", "B. b"],
        "answer": "B",
    })

    response = await client.get(f"/api/banks/{bank_id}/questions")
    assert response.status_code == 200
    data = response.json()
    assert len(data["data"]["items"]) == 2


@pytest.mark.asyncio
async def test_delete_question(client, bank_id):
    create_resp = await client.post(f"/api/banks/{bank_id}/questions", json={
        "type": "TRUE_FALSE",
        "content": "Delete me",
        "options": ["正确", "错误"],
        "answer": "正确",
    })
    q_id = create_resp.json()["data"]["id"]

    response = await client.delete(f"/api/questions/{q_id}")
    assert response.status_code == 200
    assert response.json()["data"]["deleted"] is True

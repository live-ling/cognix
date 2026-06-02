"""Tests for Bank CRUD API."""

import pytest


@pytest.mark.asyncio
async def test_create_bank(client):
    response = await client.post("/api/banks", json={
        "title": "Test Bank",
        "description": "A test bank",
        "color": "#ff0000",
    })
    assert response.status_code == 201
    data = response.json()
    assert data["success"] is True
    assert data["data"]["title"] == "Test Bank"
    assert data["data"]["question_count"] == 0


@pytest.mark.asyncio
async def test_list_banks(client):
    # Create a bank first
    await client.post("/api/banks", json={
        "title": "List Test Bank",
        "description": "For listing",
    })
    response = await client.get("/api/banks")
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert len(data["data"]["items"]) >= 1


@pytest.mark.asyncio
async def test_get_bank(client):
    create_resp = await client.post("/api/banks", json={
        "title": "Get Test Bank",
    })
    bank_id = create_resp.json()["data"]["id"]

    response = await client.get(f"/api/banks/{bank_id}")
    assert response.status_code == 200
    assert response.json()["data"]["title"] == "Get Test Bank"


@pytest.mark.asyncio
async def test_update_bank(client):
    create_resp = await client.post("/api/banks", json={
        "title": "Update Test Bank",
    })
    bank_id = create_resp.json()["data"]["id"]

    response = await client.put(f"/api/banks/{bank_id}", json={
        "title": "Updated Bank",
    })
    assert response.status_code == 200
    assert response.json()["data"]["title"] == "Updated Bank"


@pytest.mark.asyncio
async def test_delete_bank(client):
    create_resp = await client.post("/api/banks", json={
        "title": "Delete Test Bank",
    })
    bank_id = create_resp.json()["data"]["id"]

    response = await client.delete(f"/api/banks/{bank_id}")
    assert response.status_code == 200
    assert response.json()["data"]["deleted"] is True

    # Verify 404 after delete
    get_resp = await client.get(f"/api/banks/{bank_id}")
    assert get_resp.status_code == 404


@pytest.mark.asyncio
async def test_bank_not_found(client):
    response = await client.get("/api/banks/nonexistent-id")
    assert response.status_code == 404

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from database import Base, get_db
from models import ShoppingItem
from main import app

# Setup test in-memory SQLite database with StaticPool
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db


@pytest.fixture(autouse=True)
def setup_db():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def client():
    return TestClient(app)


def test_add_and_remove_item(client):
    # Add an apple
    res = client.post("/api/commands/parse", json={"transcript": "add 3 apples"})
    assert res.status_code == 200
    data = res.json()
    assert data["intent"] == "ADD"
    assert "Added" in data["action_summary"]

    # Verify active item
    items_res = client.get("/api/items?status=active")
    assert items_res.status_code == 200
    items = items_res.json()
    assert len(items) == 1
    assert "Apple" in items[0]["name"]

    # Remove with exact/plural variation
    res_remove = client.post("/api/commands/parse", json={"transcript": "remove apples"})
    assert res_remove.status_code == 200
    assert "Removed" in res_remove.json()["action_summary"]

    # Verify item is removed
    items_res2 = client.get("/api/items?status=active")
    assert len(items_res2.json()) == 0


def test_remove_apply_matches_apple(client):
    # Add Apples to list
    client.post("/api/items", json={"name": "Apples", "quantity": 4, "category": "produce"})

    # User voice command transcribed as "remove apply"
    res_remove = client.post("/api/commands/parse", json={"transcript": "remove apply"})
    assert res_remove.status_code == 200
    assert "Removed Apples" in res_remove.json()["action_summary"]

    # Verify list is empty
    items_res = client.get("/api/items?status=active")
    assert len(items_res.json()) == 0


def test_clear_whole_list_voice_command(client):
    # Add multiple items
    client.post("/api/items", json={"name": "Milk", "quantity": 1})
    client.post("/api/items", json={"name": "Eggs", "quantity": 12})
    client.post("/api/items", json={"name": "Bread", "quantity": 2})

    items_res = client.get("/api/items?status=active")
    assert len(items_res.json()) == 3

    # Command: "clear whole list"
    res_clear = client.post("/api/commands/parse", json={"transcript": "clear whole list"})
    assert res_clear.status_code == 200
    data = res_clear.json()
    assert data["intent"] == "CLEAR"
    assert "Cleared all 3 items" in data["action_summary"]

    # Verify all items removed
    items_res_after = client.get("/api/items?status=active")
    assert len(items_res_after.json()) == 0


def test_clear_all_items_api_endpoint(client):
    # Add items
    client.post("/api/items", json={"name": "Orange Juice", "quantity": 1})
    client.post("/api/items", json={"name": "Cereal", "quantity": 1})

    # Call POST /api/items/clear
    res = client.post("/api/items/clear")
    assert res.status_code == 200
    assert res.json()["cleared_count"] == 2

    # Verify active list is empty
    items_res = client.get("/api/items?status=active")
    assert len(items_res.json()) == 0


def test_remove_multi_items(client):
    client.post("/api/items", json={"name": "Milk", "quantity": 1})
    client.post("/api/items", json={"name": "Bread", "quantity": 1})
    client.post("/api/items", json={"name": "Butter", "quantity": 1})

    res = client.post("/api/commands/parse", json={"transcript": "remove milk and bread"})
    assert res.status_code == 200
    assert "Removed" in res.json()["action_summary"]

    items_res = client.get("/api/items?status=active")
    active_names = [i["name"] for i in items_res.json()]
    assert "Milk" not in active_names
    assert "Bread" not in active_names
    assert "Butter" in active_names


def test_multilingual_clear_list(client):
    client.post("/api/items", json={"name": "Rice", "quantity": 1})
    client.post("/api/items", json={"name": "Tea", "quantity": 1})

    # Hindi clear command
    res = client.post("/api/commands/parse", json={"transcript": "sab hatao", "language": "hi"})
    assert res.status_code == 200
    assert "Cleared all" in res.json()["action_summary"]

    items_res = client.get("/api/items?status=active")
    assert len(items_res.json()) == 0


def test_remove_with_explicit_quantity_decrement(client):
    client.post("/api/items", json={"name": "Eggs", "quantity": 6})

    # Command: "remove 2 eggs"
    res = client.post("/api/commands/parse", json={"transcript": "remove 2 eggs"})
    assert res.status_code == 200
    assert "2x Eggs" in res.json()["action_summary"]

    items_res = client.get("/api/items?status=active")
    assert len(items_res.json()) == 1
    assert items_res.json()[0]["quantity"] == 4


def test_product_recommendations_running_low(client):
    # Seed items created via suggestions/seed or manual item near depletion
    res = client.get("/api/suggestions")
    assert res.status_code == 200
    data = res.json()
    assert "running_low" in data
    assert "seasonal" in data
    assert "substitutes" in data


def test_substitutes_for_item_and_voice_query(client):
    # Add regular milk
    client.post("/api/items", json={"name": "Milk", "quantity": 1})

    # Suggestions should offer almond milk / oat milk
    res = client.get("/api/suggestions")
    assert res.status_code == 200
    subs = res.json()["substitutes"]
    assert any("almond milk" in s["item_name"].lower() or "oat milk" in s["item_name"].lower() for s in subs)

    # Voice command asking for substitutes
    res_voice = client.post("/api/commands/parse", json={"transcript": "substitute for milk"})
    assert res_voice.status_code == 200
    assert "Almond Milk" in res_voice.json()["action_summary"] or "Oat Milk" in res_voice.json()["action_summary"]


def test_seasonal_recommendations(client):
    res = client.get("/api/suggestions")
    assert res.status_code == 200
    seasonal = res.json()["seasonal"]
    assert len(seasonal) > 0
    assert any("season" in s["reason"].lower() or "sale" in s["reason"].lower() for s in seasonal)

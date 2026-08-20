import json
import os
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional, List, Dict, Any

from fastapi import FastAPI, Depends, HTTPException, Query, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from database import engine, Base, get_db
from models import ShoppingItem, CommandLog
from categorize import categorize_item
from suggestions.pantry_decay import calculate_depletion_date, get_running_low_suggestions
from suggestions.seasonal import get_seasonal_suggestions
from suggestions.substitutes import get_substitute_suggestions, get_item_substitutes
from nlp.confidence import process_command

# Initialize SQLite tables
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Voice Shopping Assistant API",
    description="Dual-engine (Thinking Fast & Slow) Voice Shopping Assistant with Pantry Decay",
    version="1.0.0"
)

# Enable CORS for Vite frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DATA_DIR = Path(__file__).resolve().parent / "data"
PRODUCTS_FILE = DATA_DIR / "products.json"


# --- Standardized Error Exception Handlers ---
@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    code = "NOT_FOUND" if exc.status_code == 404 else ("BAD_REQUEST" if exc.status_code == 400 else "HTTP_ERROR")
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": exc.detail, "code": code}
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"error": "Invalid request parameters or payload", "code": "VALIDATION_ERROR", "details": str(exc)}
    )


@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"error": "Internal server error occurred", "code": "INTERNAL_SERVER_ERROR"}
    )


# --- Pydantic Schemas ---
class CommandParseRequest(BaseModel):
    transcript: str = Field(..., description="Raw voice or typed utterance")
    language: str = Field("en", description="Language code e.g. en, hi, es")


class ItemCreate(BaseModel):
    name: str = Field(..., description="Item name")
    category: Optional[str] = None
    quantity: int = Field(1, ge=1)
    unit: Optional[str] = None


class ItemUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    quantity: Optional[int] = Field(None, ge=1)
    unit: Optional[str] = None
    status: Optional[str] = None  # active, purchased, removed


# --- Helper Functions ---
def _format_item_response(item: ShoppingItem) -> Dict[str, Any]:
    data = item.to_dict()
    now = datetime.utcnow()
    
    # Calculate depletion progression bar percentage and days remaining
    if item.estimated_depletion and item.added_at:
        total_seconds = max(1.0, (item.estimated_depletion - item.added_at).total_seconds())
        elapsed_seconds = max(0.0, (now - item.added_at).total_seconds())
        pct = min(100.0, max(0.0, (elapsed_seconds / total_seconds) * 100.0))
        remaining_days = max(0, (item.estimated_depletion - now).days)
        data["depletion_pct"] = round(pct, 1)
        data["days_remaining"] = remaining_days
        data["is_running_low"] = pct >= 80.0 or remaining_days <= 1
    else:
        data["depletion_pct"] = 0.0
        data["days_remaining"] = 7
        data["is_running_low"] = False

    return data


def _load_products():
    if PRODUCTS_FILE.exists():
        with open(PRODUCTS_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    return []


# --- Seed Initial Data if Empty ---
@app.on_event("startup")
def seed_demo_data():
    db = next(get_db())
    count = db.query(ShoppingItem).count()
    if count == 0:
        now = datetime.utcnow()
        # Seed a few realistic items with different decay states
        seed_items = [
            ("Whole Milk", 1, "gallon", 4),     # 4 days ago -> running low (milk ~5 days)
            ("Organic Bananas", 1, "bunch", 3), # 3 days ago -> running low (bananas ~4 days)
            ("Whole Wheat Bread", 1, "loaf", 1),# 1 day ago -> fresh (bread ~6 days)
            ("Extra Virgin Olive Oil", 1, "bottle", 2), # fresh (olive oil ~60 days)
        ]
        for name, qty, unit, days_ago in seed_items:
            added = now - timedelta(days=days_ago)
            cat = categorize_item(name)
            depletion_date, _ = calculate_depletion_date(name, added)
            item = ShoppingItem(
                name=name,
                category=cat,
                quantity=qty,
                unit=unit,
                added_at=added,
                estimated_depletion=depletion_date,
                status="active"
            )
            db.add(item)
        db.commit()
    db.close()


# --- API Routes ---

@app.get("/")
def root():
    return {
        "app": "Voice Shopping Assistant API",
        "status": "online",
        "architecture": "Thinking Fast (System 1) & Slow (System 2)",
        "docs_url": "/docs"
    }


@app.post("/api/commands/parse")
def parse_and_execute_command(payload: CommandParseRequest, db: Session = Depends(get_db)):
    """
    Core Voice/Text Command Endpoint:
    1. Routes through System 1 / System 2 confidence gate.
    2. Performs the corresponding list mutation (ADD or REMOVE) or prepares search parameters.
    3. Returns full execution feedback with ReasoningBadge details.
    """
    transcript = payload.transcript.strip()
    if not transcript:
        raise HTTPException(status_code=400, detail="Transcript cannot be empty")

    # Step 1: Process command through Fast & Slow dual-engine
    parsed = process_command(transcript, language=payload.language, db=db)
    intent = parsed.get("intent", "UNKNOWN")
    items_to_process = parsed.get("items", [])
    if not items_to_process and parsed.get("item"):
        items_to_process = [{
            "name": parsed.get("item"),
            "quantity": parsed.get("quantity", 1),
            "unit": parsed.get("unit")
        }]

    action_summary = ""
    mutated_items = []

    # Step 2: Execute action based on resolved intent
    if intent == "ADD":
        added_names = []
        for item_data in items_to_process:
            raw_name = item_data.get("name", "").strip()
            if not raw_name:
                continue
            qty = max(1, item_data.get("quantity", 1))
            unit = item_data.get("unit")
            cat = categorize_item(raw_name)
            depletion_date, _ = calculate_depletion_date(raw_name)

            # Check if active item with same name already exists -> increment quantity
            existing = db.query(ShoppingItem).filter(
                ShoppingItem.name.ilike(raw_name),
                ShoppingItem.status == "active"
            ).first()

            if existing:
                existing.quantity += qty
                db.commit()
                db.refresh(existing)
                mutated_items.append(_format_item_response(existing))
                added_names.append(f"{existing.quantity}x {existing.name}")
            else:
                new_item = ShoppingItem(
                    name=raw_name.title(),
                    category=cat,
                    quantity=qty,
                    unit=unit,
                    added_at=datetime.utcnow(),
                    estimated_depletion=depletion_date,
                    status="active"
                )
                db.add(new_item)
                db.commit()
                db.refresh(new_item)
                mutated_items.append(_format_item_response(new_item))
                added_names.append(f"{qty}x {new_item.name}")

        action_summary = f"Added {', '.join(added_names)} to your list." if added_names else "No items identified to add."

    elif intent == "REMOVE":
        removed_names = []
        for item_data in items_to_process:
            raw_name = item_data.get("name", "").strip()
            if not raw_name:
                continue
            # Look for active item
            found = db.query(ShoppingItem).filter(
                ShoppingItem.name.ilike(f"%{raw_name}%"),
                ShoppingItem.status == "active"
            ).all()

            for item in found:
                item.status = "removed"
                removed_names.append(item.name)
            db.commit()

        action_summary = f"Removed {', '.join(removed_names)} from your list." if removed_names else f"Could not find matching item to remove."

    elif intent == "SEARCH":
        action_summary = f"Searching for '{parsed.get('item', transcript)}' in store catalog."

    else:
        action_summary = f"Understood: '{transcript}', but no specific action required."

    return {
        "success": True,
        "transcript": transcript,
        "intent": intent,
        "reasoning_path": parsed.get("reasoning_path", "instant"),  # "instant" | "deliberated"
        "confidence": parsed.get("confidence", 1.0),
        "items": items_to_process,
        "brand": parsed.get("brand"),
        "price_filter": parsed.get("price_filter"),
        "language_detected": parsed.get("language_detected", payload.language),
        "action_summary": action_summary,
        "mutated_items": mutated_items
    }


@app.get("/api/items")
def get_items(status_filter: str = "active", db: Session = Depends(get_db)):
    """Fetch all shopping items grouped with depletion calculations."""
    query = db.query(ShoppingItem)
    if status_filter != "all":
        query = query.filter(ShoppingItem.status == status_filter)
        
    items = query.order_by(ShoppingItem.category.asc(), ShoppingItem.added_at.desc()).all()
    return [_format_item_response(it) for it in items]


@app.post("/api/items")
def create_item(payload: ItemCreate, db: Session = Depends(get_db)):
    """Manual item creation endpoint (typed UI input)."""
    name = payload.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Item name cannot be empty")
        
    cat = payload.category or categorize_item(name)
    depletion_date, _ = calculate_depletion_date(name)

    # Check if active item exists
    existing = db.query(ShoppingItem).filter(
        ShoppingItem.name.ilike(name),
        ShoppingItem.status == "active"
    ).first()

    if existing:
        existing.quantity += payload.quantity
        if payload.category:
            existing.category = payload.category
        if payload.unit:
            existing.unit = payload.unit
        db.commit()
        db.refresh(existing)
        return _format_item_response(existing)

    new_item = ShoppingItem(
        name=name.title(),
        category=cat,
        quantity=payload.quantity,
        unit=payload.unit,
        added_at=datetime.utcnow(),
        estimated_depletion=depletion_date,
        status="active"
    )
    db.add(new_item)
    db.commit()
    db.refresh(new_item)
    return _format_item_response(new_item)


@app.patch("/api/items/{item_id}")
def update_item(item_id: int, payload: ItemUpdate, db: Session = Depends(get_db)):
    """Manual update for item quantity, category, unit, or status."""
    item = db.query(ShoppingItem).filter(ShoppingItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Shopping item not found")

    if payload.name is not None:
        item.name = payload.name.strip().title()
    if payload.category is not None:
        item.category = payload.category.strip().lower()
    if payload.quantity is not None:
        item.quantity = payload.quantity
    if payload.unit is not None:
        item.unit = payload.unit
    if payload.status is not None:
        if payload.status in ["active", "purchased", "removed"]:
            item.status = payload.status

    db.commit()
    db.refresh(item)
    return _format_item_response(item)


@app.delete("/api/items/{item_id}")
def delete_item(item_id: int, db: Session = Depends(get_db)):
    """Remove item from list."""
    item = db.query(ShoppingItem).filter(ShoppingItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Shopping item not found")

    item.status = "removed"
    db.commit()
    return {"success": True, "message": f"Removed '{item.name}'"}


@app.get("/api/suggestions")
def get_all_suggestions(db: Session = Depends(get_db)):
    """
    Returns 3 types of explainable, human-logic smart suggestions:
    1. Running Low: Pantry decay depletion alert
    2. Seasonal: In-season peak items for current month
    3. Substitutes: Alternatives for active items
    """
    running_low = get_running_low_suggestions(db)
    seasonal = get_seasonal_suggestions(db)
    substitutes = get_substitute_suggestions(db, limit=3)

    return {
        "running_low": running_low,
        "seasonal": seasonal,
        "substitutes": substitutes,
        "total_count": len(running_low) + len(seasonal) + len(substitutes)
    }


@app.get("/api/items/search")
def search_catalog(
    q: Optional[str] = Query(None, description="Search term"),
    brand: Optional[str] = Query(None, description="Brand filter"),
    min_price: Optional[float] = Query(None, description="Minimum price"),
    max_price: Optional[float] = Query(None, description="Maximum price"),
    category: Optional[str] = Query(None, description="Category filter")
):
    """
    Simulated store catalog search with brand, category, and price range filtering.
    """
    products = _load_products()
    results = []
    
    query_tokens = q.lower().split() if q else []

    for p in products:
        # Query filter
        if query_tokens:
            name_low = p["name"].lower()
            cat_low = p["category"].lower()
            brand_low = p["brand"].lower()
            if not any(token in name_low or token in cat_low or token in brand_low for token in query_tokens):
                continue

        # Brand filter
        if brand and brand.lower() not in p["brand"].lower():
            continue

        # Price filters
        if min_price is not None and p["price"] < min_price:
            continue
        if max_price is not None and p["price"] > max_price:
            continue

        # Category filter
        if category and category.lower() != p["category"].lower():
            continue

        results.append(p)

    return {
        "query": q,
        "filters": {"brand": brand, "min_price": min_price, "max_price": max_price, "category": category},
        "count": len(results),
        "results": results
    }


@app.get("/api/commands/stats")
def get_command_stats(db: Session = Depends(get_db)):
    """
    Telemetry data showing total instant (System 1) vs deliberated (System 2) command counts.
    """
    logs = db.query(CommandLog).order_by(CommandLog.timestamp.desc()).all()
    total = len(logs)
    instant_count = sum(1 for log in logs if log.reasoning_path == "instant")
    deliberated_count = sum(1 for log in logs if log.reasoning_path == "deliberated")

    instant_pct = round((instant_count / total) * 100, 1) if total > 0 else 100.0
    deliberated_pct = round((deliberated_count / total) * 100, 1) if total > 0 else 0.0

    recent_logs = [log.to_dict() for log in logs[:10]]

    return {
        "total_commands": total,
        "instant_count": instant_count,
        "deliberated_count": deliberated_count,
        "instant_pct": instant_pct,
        "deliberated_pct": deliberated_pct,
        "recent_logs": recent_logs
    }

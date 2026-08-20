import json
import os
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional, List, Dict, Any

from fastapi import FastAPI, Depends, HTTPException, Query, Request, status, UploadFile, File, Form
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from dotenv import load_dotenv
import httpx

from database import engine, Base, get_db
from models import ShoppingItem, CommandLog
from categorize import categorize_item
from suggestions.pantry_decay import calculate_depletion_date, get_running_low_suggestions
from suggestions.seasonal import get_seasonal_suggestions
from suggestions.substitutes import get_substitute_suggestions
from nlp.confidence import process_command

# Load environment variables
env_path = Path(__file__).resolve().parent / ".env"
load_dotenv(dotenv_path=env_path)

# Initialize SQLite tables
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Voice Shopping Assistant API",
    description="Dual-Engine (Thinking Fast & Slow) Voice Shopping Assistant with Groq LLM and Whisper-large-v3",
    version="1.0.0"
)

# Dynamic CORS origins configuration for hosting readiness
cors_origins_env = os.getenv("CORS_ORIGINS", "*").strip()
if cors_origins_env == "*":
    allow_origins = ["*"]
else:
    allow_origins = [origin.strip() for origin in cors_origins_env.split(",") if origin.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
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
    transcription_source: Optional[str] = Field("web_speech", description="web_speech or whisper")


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
    status: Optional[str] = None


# --- Helper Functions ---
def _format_item_response(item: ShoppingItem) -> Dict[str, Any]:
    data = item.to_dict()
    now = datetime.utcnow()
    
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
        seed_items = [
            ("Whole Milk", 1, "gallon", 4),     # running low (milk ~5 days)
            ("Organic Bananas", 1, "bunch", 3), # running low (bananas ~4 days)
            ("Whole Wheat Bread", 1, "loaf", 1),# fresh (bread ~6 days)
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
        "models": {
            "system1": "Sub-50ms local regex & keyword intent parser",
            "system2": "Groq LLaMA-3 (Conscious thought)",
            "whisper": "Hugging Face Whisper Large V3 (Careful listening)"
        },
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

    parsed = process_command(transcript, language=payload.language, db=db)
    intent = parsed.get("intent", "UNKNOWN")
    raw_items = parsed.get("items", [])
    
    items_to_process = []
    if raw_items:
        for it in raw_items:
            if isinstance(it, dict):
                items_to_process.append(it)
            elif isinstance(it, str) and it.strip():
                items_to_process.append({
                    "name": it.strip(),
                    "quantity": parsed.get("quantity", 1),
                    "unit": parsed.get("unit")
                })
    elif parsed.get("item"):
        items_to_process.append({
            "name": parsed.get("item"),
            "quantity": parsed.get("quantity", 1),
            "unit": parsed.get("unit")
        })

    action_summary = ""
    mutated_items = []

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

            existing = db.query(ShoppingItem).filter(
                ShoppingItem.name.ilike(raw_name),
                ShoppingItem.status == "active"
            ).first()

            if existing:
                existing.quantity += qty
                # Replenishing / adding item resets its freshness timestamp and estimated depletion
                existing.added_at = datetime.utcnow()
                existing.estimated_depletion = depletion_date
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
            found = db.query(ShoppingItem).filter(
                ShoppingItem.name.ilike(f"%{raw_name}%"),
                ShoppingItem.status == "active"
            ).all()

            for item in found:
                item.status = "removed"
                removed_names.append(item.name)
            db.commit()

        action_summary = f"Removed {', '.join(removed_names)} from your list." if removed_names else "Could not find matching item to remove."

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
        "transcription_source": payload.transcription_source,
        "items": items_to_process,
        "brand": parsed.get("brand"),
        "price_filter": parsed.get("price_filter"),
        "language_detected": parsed.get("language_detected", payload.language),
        "action_summary": action_summary,
        "mutated_items": mutated_items
    }


@app.post("/api/commands/transcribe-audio")
@app.post("/transcribe-audio")
async def transcribe_audio(
    file: UploadFile = File(...),
    language: str = Form("en"),
    db: Session = Depends(get_db)
):
    """
    Careful Transcription Path:
    Uses Hugging Face Whisper Large V3 for accurate multilingual and noisy audio transcription.
    The resulting text automatically cascades through the System 1 / System 2 pipeline.
    """
    hf_token = os.getenv("HF_API_TOKEN") or os.getenv("HUGGINGFACE_API_TOKEN")
    audio_bytes = await file.read()
    
    if not audio_bytes:
        raise HTTPException(status_code=400, detail="Empty audio file uploaded")

    transcribed_text = ""
    
    # 1. Primary Path: Hugging Face Inference API for Whisper Large V3
    if hf_token and hf_token.strip():
        hf_urls = [
            "https://router.huggingface.co/hf-inference/models/openai/whisper-large-v3",
            "https://api-inference.huggingface.co/models/openai/whisper-large-v3"
        ]
        headers = {
            "Authorization": f"Bearer {hf_token.strip()}",
            "Content-Type": file.content_type or "audio/webm"
        }
        
        for url in hf_urls:
            try:
                async with httpx.AsyncClient(timeout=12.0) as client:
                    resp = await client.post(url, headers=headers, content=audio_bytes)
                    if resp.status_code == 200:
                        data = resp.json()
                        transcribed_text = data.get("text", "").strip()
                        if transcribed_text:
                            break
            except Exception:
                continue

    # 2. Secondary Path: Groq Whisper Large V3 if HF endpoint is busy
    groq_key = os.getenv("GROQ_API_KEY")
    if not transcribed_text and groq_key and groq_key.strip():
        try:
            groq_url = "https://api.groq.com/openai/v1/audio/transcriptions"
            headers = {"Authorization": f"Bearer {groq_key.strip()}"}
            files = {"file": ("audio.webm", audio_bytes, file.content_type or "audio/webm")}
            data = {"model": "whisper-large-v3"}
            if language:
                data["language"] = language.split("-")[0]
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.post(groq_url, headers=headers, files=files, data=data)
                if resp.status_code == 200:
                    transcribed_text = resp.json().get("text", "").strip()
        except Exception:
            pass

    # 3. If no speech was recognized, return error instead of hallucinating random items
    if not transcribed_text:
        raise HTTPException(
            status_code=400,
            detail="No speech could be recognized in the audio recording. Please speak clearly and try again."
        )

    # Step 4: Run transcribed text through the dual-engine pipeline
    parse_req = CommandParseRequest(
        transcript=transcribed_text,
        language=language,
        transcription_source="whisper"
    )
    res = parse_and_execute_command(payload=parse_req, db=db)
    res["transcription_source"] = "whisper"
    res["audio_transcription_used"] = True
    return res


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
    """Manual item creation endpoint."""
    name = payload.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Item name cannot be empty")
        
    cat = payload.category or categorize_item(name)
    depletion_date, _ = calculate_depletion_date(name)

    existing = db.query(ShoppingItem).filter(
        ShoppingItem.name.ilike(name),
        ShoppingItem.status == "active"
    ).first()

    if existing:
        existing.quantity += payload.quantity
        existing.added_at = datetime.utcnow()
        existing.estimated_depletion = depletion_date
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
    item = db.query(ShoppingItem).filter(ShoppingItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Shopping item not found")

    item.status = "removed"
    db.commit()
    return {"success": True, "message": f"Removed '{item.name}'"}


@app.get("/api/suggestions")
def get_all_suggestions(db: Session = Depends(get_db)):
    """Returns Pantry Decay, Seasonal, and Substitute suggestions."""
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
    q: Optional[str] = Query(None),
    brand: Optional[str] = Query(None),
    min_price: Optional[float] = Query(None),
    max_price: Optional[float] = Query(None),
    category: Optional[str] = Query(None)
):
    products = _load_products()
    results = []
    query_tokens = q.lower().split() if q else []

    for p in products:
        if query_tokens:
            name_low = p["name"].lower()
            cat_low = p["category"].lower()
            brand_low = p["brand"].lower()
            if not any(token in name_low or token in cat_low or token in brand_low for token in query_tokens):
                continue

        if brand and brand.lower() not in p["brand"].lower():
            continue
        if min_price is not None and p["price"] < min_price:
            continue
        if max_price is not None and p["price"] > max_price:
            continue
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
    logs = db.query(CommandLog).order_by(CommandLog.timestamp.desc()).all()
    total = len(logs)
    instant_count = sum(1 for log in logs if log.reasoning_path == "instant")
    deliberated_count = sum(1 for log in logs if log.reasoning_path == "deliberated")

    instant_pct = round((instant_count / total) * 100, 1) if total > 0 else 100.0
    deliberated_pct = round((deliberated_count / total) * 100, 1) if total > 0 else 0.0

    return {
        "total_commands": total,
        "instant_count": instant_count,
        "deliberated_count": deliberated_count,
        "instant_pct": instant_pct,
        "deliberated_pct": deliberated_pct,
        "recent_logs": [log.to_dict() for log in logs[:10]]
    }

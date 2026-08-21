import json
import os
import re
import difflib
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
from suggestions.substitutes import get_substitute_suggestions, get_item_substitutes
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


# --- Item Search & Matching Utilities ---

def normalize_grocery_token(w: str) -> str:
    """Normalizes pluralization, punctuation, and casing for grocery item tokens."""
    w = re.sub(r"[^\w\s-]", "", w.lower().strip())
    if not w:
        return ""
    # Plural to singular normalization
    if w.endswith("ies") and len(w) > 4:
        return w[:-3] + "y"
    if w.endswith("oes") and len(w) > 4:
        return w[:-2]
    if w.endswith("es") and len(w) > 3 and not (w.endswith("less") or w.endswith("cheese")):
        return w[:-2]
    if w.endswith("s") and not w.endswith("ss") and len(w) > 2:
        return w[:-1]
    return w


STT_GROCERY_ALIASES: Dict[str, List[str]] = {
    "apply": ["apple", "apples", "apply"],
    "applies": ["apples", "apple", "applies"],
    "aple": ["apple", "apples"],
    "serial": ["cereal", "serial"],
    "cereal": ["cereal", "serial"],
    "flower": ["flour", "flower"],
    "flour": ["flour", "flower"],
    "meet": ["meat", "meet"],
    "meat": ["meat", "meet"],
    "batter": ["butter", "batter"],
    "better": ["butter", "better"],
    "yougurt": ["yogurt"],
    "yogart": ["yogurt"],
}


def is_clear_list_command(text: str) -> bool:
    """Detects if a query is a request to clear or delete the entire list."""
    lowered = text.lower().strip()
    clear_phrases = [
        "all", "everything", "whole list", "the whole list", "entire list",
        "the list", "all items", "list", "cart", "complete list", "my list",
        "whole shopping list", "shopping list", "all of it", "every item"
    ]
    return lowered in clear_phrases


def find_matching_shopping_items(db: Session, target_query: str) -> List[ShoppingItem]:
    """
    Intelligent shopping item finder for REMOVE / mutation commands.
    Features:
    1. Exact & case-insensitive match
    2. Substring matching in both directions (e.g. 'apple' in 'Organic Fuji Apples')
    3. Plural / Singular stemming (e.g. 'apples' <-> 'apple', 'tomatoes' <-> 'tomato')
    4. Speech-to-text soundalike / misrecognition mapping ('apply' -> 'apple' / 'apples')
    5. Token intersection matching
    6. Fuzzy string distance (difflib SequenceMatcher >= 0.65)
    """
    active_items = db.query(ShoppingItem).filter(ShoppingItem.status == "active").all()
    if not active_items or not target_query:
        return []

    target_raw = target_query.lower().strip()
    target_norm = normalize_grocery_token(target_raw)
    target_words = [normalize_grocery_token(w) for w in target_raw.split() if w]
    
    # Expand candidate aliases
    candidate_aliases = {target_raw, target_norm}
    if target_raw in STT_GROCERY_ALIASES:
        candidate_aliases.update(STT_GROCERY_ALIASES[target_raw])
    for w in target_raw.split():
        if w in STT_GROCERY_ALIASES:
            candidate_aliases.update(STT_GROCERY_ALIASES[w])

    matched_items = []
    seen_ids = set()

    # 1. Tier 1: Exact matches, Direct Substring, or Stemmed matching
    for item in active_items:
        item_raw = item.name.lower().strip()
        item_norm = normalize_grocery_token(item_raw)
        item_words = [normalize_grocery_token(w) for w in item_raw.split() if w]

        is_match = False
        for alias in candidate_aliases:
            alias_norm = normalize_grocery_token(alias)
            if alias == item_raw or alias_norm == item_norm:
                is_match = True
                break
            if alias in item_raw or item_raw in alias:
                is_match = True
                break
            if alias_norm and item_norm and (alias_norm in item_norm or item_norm in alias_norm):
                is_match = True
                break

        # Check word token overlap (e.g. "honeycrisp" in "Honeycrisp Apples", "apple" in "Organic Apple")
        if not is_match:
            for tw in target_words:
                if tw and any(tw == iw or tw in iw or iw in tw for iw in item_words if iw):
                    is_match = True
                    break

        if is_match and item.id not in seen_ids:
            matched_items.append(item)
            seen_ids.add(item.id)

    # 2. Tier 2: Fuzzy Similarity match if Tier 1 found nothing
    if not matched_items:
        for item in active_items:
            item_raw = item.name.lower().strip()
            item_norm = normalize_grocery_token(item_raw)
            
            best_ratio = 0.0
            for alias in candidate_aliases:
                r1 = difflib.SequenceMatcher(None, alias, item_raw).ratio()
                r2 = difflib.SequenceMatcher(None, normalize_grocery_token(alias), item_norm).ratio()
                best_ratio = max(best_ratio, r1, r2)

            for iw in item_raw.split():
                for alias in candidate_aliases:
                    best_ratio = max(best_ratio, difflib.SequenceMatcher(None, alias, iw).ratio())

            if best_ratio >= 0.65 and item.id not in seen_ids:
                matched_items.append(item)
                seen_ids.add(item.id)

    return matched_items


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
    2. Performs the corresponding list mutation (ADD, REMOVE, or CLEAR) or prepares search parameters.
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
                    "unit": parsed.get("unit"),
                    "has_explicit_quantity": parsed.get("has_explicit_quantity", False)
                })
    elif parsed.get("item"):
        items_to_process.append({
            "name": parsed.get("item"),
            "quantity": parsed.get("quantity", 1),
            "unit": parsed.get("unit"),
            "has_explicit_quantity": parsed.get("has_explicit_quantity", False)
        })

    action_summary = ""
    mutated_items = []

    # 1. CLEAR Intent (Clear entire shopping list)
    if intent in ["CLEAR", "CLEAR_ALL"]:
        active_items = db.query(ShoppingItem).filter(ShoppingItem.status == "active").all()
        removed_names = []
        for item in active_items:
            item.status = "removed"
            removed_names.append(item.name)
            mutated_items.append(_format_item_response(item))
        db.commit()

        if removed_names:
            action_summary = f"Cleared all {len(removed_names)} items from your shopping list."
        else:
            action_summary = "Your shopping list is already empty."

    # 2. ADD Intent
    elif intent == "ADD":
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

    # 3. REMOVE Intent
    elif intent == "REMOVE":
        # Check if entire list clear was requested as a remove command (e.g. "remove all", "delete whole list")
        is_clear_all_requested = False
        if not items_to_process:
            is_clear_all_requested = True
        elif any(is_clear_list_command(it.get("name", "")) for it in items_to_process):
            is_clear_all_requested = True

        if is_clear_all_requested:
            active_items = db.query(ShoppingItem).filter(ShoppingItem.status == "active").all()
            removed_names = []
            for item in active_items:
                item.status = "removed"
                removed_names.append(item.name)
                mutated_items.append(_format_item_response(item))
            db.commit()

            if removed_names:
                action_summary = f"Cleared all {len(removed_names)} items from your shopping list."
            else:
                action_summary = "Your shopping list is already empty."
        else:
            removed_names = []
            for item_data in items_to_process:
                raw_name = item_data.get("name", "").strip()
                if not raw_name:
                    continue
                qty = item_data.get("quantity", 1)
                has_explicit_qty = item_data.get("has_explicit_quantity", False)

                matching = find_matching_shopping_items(db, raw_name)
                for item in matching:
                    if has_explicit_qty and qty < item.quantity:
                        item.quantity -= qty
                        removed_names.append(f"{qty}x {item.name}")
                        mutated_items.append(_format_item_response(item))
                    else:
                        item.status = "removed"
                        removed_names.append(item.name)
                        mutated_items.append(_format_item_response(item))
                db.commit()

            action_summary = f"Removed {', '.join(removed_names)} from your list." if removed_names else "Could not find matching item to remove."

    elif intent == "SUBSTITUTE":
        target_name = parsed.get("item", "").strip() or (items_to_process[0]["name"] if items_to_process else "")
        alts = get_item_substitutes(target_name)
        if alts:
            alt_str = ", ".join(f"{a['name'].title()} ({a.get('reason', 'Great substitute')})" for a in alts[:3])
            action_summary = f"Substitutes for {target_name.title()}: {alt_str}."
        else:
            action_summary = f"No direct substitutes found for '{target_name}'. Try checking related items."

    elif intent == "RECOMMEND":
        running_low = get_running_low_suggestions(db)
        seasonal = get_seasonal_suggestions(db)
        recs = []
        if running_low:
            recs.append(f"Running low: {running_low[0]['item_name'].title()}")
        if seasonal:
            recs.append(f"In season & on sale: {', '.join(s['item_name'].title() for s in seasonal[:2])}")
        action_summary = f"Recommendations — {' | '.join(recs)}." if recs else "All items are well stocked!"

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


@app.post("/api/items/clear")
@app.delete("/api/items")
def clear_all_items(db: Session = Depends(get_db)):
    """Clears all active items from the shopping list."""
    active_items = db.query(ShoppingItem).filter(ShoppingItem.status == "active").all()
    count = len(active_items)
    for item in active_items:
        item.status = "removed"
    db.commit()
    return {
        "success": True,
        "message": f"Cleared {count} items from shopping list",
        "cleared_count": count
    }


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

import os
import json
import re
from pathlib import Path
from typing import Dict, Any, List, Optional
import httpx
from dotenv import load_dotenv

# Load env variables
env_path = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(dotenv_path=env_path)

SYSTEM_PROMPT = """You are a precise Natural Language Understanding (NLU) shopping assistant parser.
Parse the user's voice command transcript (which may be in English, Spanish, Hindi, or mixed language).
Return ONLY a valid JSON object with NO markdown code blocks, NO backticks, and NO conversational filler, matching this exact schema:
{
  "intent": "ADD" | "REMOVE" | "SEARCH" | "UNKNOWN",
  "items": [
    {
      "name": "item name in English (e.g. milk, eggs, apples, coffee)",
      "quantity": 1,
      "unit": "bottle | liter | lb | kg | dozen | pack | loaf | null"
    }
  ],
  "brand": "brand name if specified or null",
  "price_filter": {
    "max_price": float or null,
    "min_price": float or null
  },
  "language_detected": "en | hi | es | other"
}

Examples:
- "add milk and 2 dozen eggs" -> {"intent":"ADD","items":[{"name":"milk","quantity":1,"unit":null},{"name":"eggs","quantity":2,"unit":"dozen"}],"brand":null,"price_filter":{"max_price":null,"min_price":null},"language_detected":"en"}
- "we are completely out of olive oil and coffee" -> {"intent":"ADD","items":[{"name":"olive oil","quantity":1,"unit":null},{"name":"coffee","quantity":1,"unit":null}],"brand":null,"price_filter":{"max_price":null,"min_price":null},"language_detected":"en"}
- "find organic apples under 5 dollars" -> {"intent":"SEARCH","items":[{"name":"organic apples","quantity":1,"unit":null}],"brand":null,"price_filter":{"max_price":5.0,"min_price":null},"language_detected":"en"}
- "doodh aur andey add karo" -> {"intent":"ADD","items":[{"name":"milk","quantity":1,"unit":null},{"name":"eggs","quantity":1,"unit":null}],"brand":null,"price_filter":{"max_price":null,"min_price":null},"language_detected":"hi"}
- "necesito dos botellas de leche" -> {"intent":"ADD","items":[{"name":"milk","quantity":2,"unit":"bottle"}],"brand":null,"price_filter":{"max_price":null,"min_price":null},"language_detected":"es"}
"""


def _offline_fallback_system2(transcript: str, language: str) -> Dict[str, Any]:
    """
    Intelligent offline fallback parser for System 2 escalation when Groq API key is not configured or network drops.
    """
    raw = transcript.strip()
    lowered = raw.lower()
    
    # Multilingual intent detection
    intent = "ADD"
    if any(w in lowered for w in ["remove", "delete", "hatao", "quitar", "eliminar", "don't need", "cancel"]):
        intent = "REMOVE"
    elif any(w in lowered for w in ["find", "search", "dhoondo", "buscar", "where", "show"]):
        intent = "SEARCH"
    elif any(w in lowered for w in ["add", "need", "want", "buy", "lao", "jodo", "agregar", "comprar", "out of"]):
        intent = "ADD"

    # Multilingual translation dictionary for common items
    translations = {
        # Hindi
        "doodh": "milk", "dood": "milk", "andey": "eggs", "anda": "egg", "ande": "eggs",
        "seb": "apples", "kela": "bananas", "kele": "bananas", "pyaaz": "onions",
        "tamatar": "tomatoes", "aloo": "potatoes", "chawal": "rice", "chini": "sugar",
        "makhan": "butter", "paneer": "cheese", "chai": "tea", "tel": "oil", "paani": "water",
        # Spanish
        "leche": "milk", "huevos": "eggs", "huevo": "egg", "pan": "bread", "manzanas": "apples",
        "platanos": "bananas", "queso": "cheese", "mantequilla": "butter", "arroz": "rice",
        "aceite": "olive oil", "pollo": "chicken", "cafe": "coffee", "azucar": "sugar", "agua": "water"
    }

    # Detect language
    detected_lang = language
    for foreign_word in translations.keys():
        if foreign_word in lowered:
            detected_lang = "hi" if foreign_word in ["doodh", "andey", "seb", "kela", "pyaaz", "tamatar", "aloo", "chawal", "chini", "makhan", "paneer", "chai", "tel"] else "es"
            break

    # Price extraction e.g. "under 5 dollars", "less than $10"
    max_price = None
    min_price = None
    price_match = re.search(r"(?:under|below|less than|\$)\s*(\d+(?:\.\d+)?)\s*(?:dollars|\$)?", lowered)
    if price_match:
        try:
            max_price = float(price_match.group(1))
        except ValueError:
            pass

    # Extract brand hints
    known_brands = ["horizon", "silk", "oatly", "vital farms", "kerrygold", "cabot", "fage", "chiquita", "dave's", "tropicana", "starbucks", "bounty", "dawn", "tide"]
    detected_brand = None
    for b in known_brands:
        if b in lowered:
            detected_brand = b
            break

    # Clean text from triggers & filters
    working = lowered
    for remove_phrase in [
        "under 5 dollars", "less than", "add", "remove", "find", "search for",
        "we are out of", "we ran out of", "i need", "please", "karo", "chahiye",
        "por favor", "necesito", "lao", "lana", "jodo", "le aao", "daalo",
        "agregar", "comprar", "traer", "quitar"
    ]:
        working = working.replace(remove_phrase, " ")

    # Multi-item split
    item_chunks = re.split(r",|\band\b|\baur\b|\by\b|\balso\b|\bplus\b", working)
    parsed_items = []

    for chunk in item_chunks:
        chunk_clean = chunk.strip()
        if not chunk_clean:
            continue
            
        qty = 1
        num_m = re.search(r"\b(\d+)\b", chunk_clean)
        if num_m:
            qty = int(num_m.group(1))
            chunk_clean = re.sub(r"\b\d+\b", "", chunk_clean).strip()
            
        unit = None
        for u in ["bottle", "bottles", "botellas", "pack", "packs", "dozen", "carton", "lb", "lbs", "kg"]:
            if u in chunk_clean:
                unit = "bottle" if "botella" in u else u
                chunk_clean = chunk_clean.replace(u, "").strip()
                break

        for fw in ["of", "de", "the", "some", "my", "un", "una", "dos", "do", "ek", "kuch"]:
            chunk_clean = re.sub(rf"\b{fw}\b", "", chunk_clean).strip()

        words = chunk_clean.split()
        translated_words = [translations.get(w, w) for w in words]
        final_item_name = " ".join(translated_words).strip()
        final_item_name = re.sub(r"[^\w\s-]", "", final_item_name).strip()
        
        if final_item_name and len(final_item_name) >= 2:
            parsed_items.append({
                "name": final_item_name,
                "quantity": qty,
                "unit": unit
            })

    if not parsed_items:
        parsed_items = [{"name": "item", "quantity": 1, "unit": None}]

    return {
        "intent": intent,
        "items": parsed_items,
        "item": parsed_items[0]["name"] if parsed_items else "",
        "quantity": parsed_items[0]["quantity"] if parsed_items else 1,
        "unit": parsed_items[0]["unit"] if parsed_items else None,
        "brand": detected_brand,
        "price_filter": {
            "max_price": max_price,
            "min_price": min_price
        },
        "language_detected": detected_lang,
        "confidence": 0.95,
        "reasoning": "deliberated"
    }


def llm_parse_command(transcript: str, language: str = "en") -> Dict[str, Any]:
    """
    System 2: Conscious LLM-based Natural Language Understanding powered by Groq.
    Escalated to when System 1 confidence is low (< 0.75), multilingual, or complex multi-item input.
    """
    groq_key = os.getenv("GROQ_API_KEY")
    user_prompt = f"Transcript: \"{transcript}\"\nPreferred language: {language}"

    # 1. Primary Path: Call Groq API if key is present
    if groq_key and groq_key.strip():
        # List of candidate models available on Groq's high-speed infrastructure
        candidate_models = [
            "openai/gpt-oss-120b",
            "openai/gpt-oss-20b",
            "qwen/qwen3.6-27b",
            "llama-3.3-70b-versatile",
            "llama-3.1-8b-instant"
        ]

        for model_name in candidate_models:
            try:
                url = "https://api.groq.com/openai/v1/chat/completions"
                headers = {
                    "Authorization": f"Bearer {groq_key.strip()}",
                    "Content-Type": "application/json"
                }
                payload = {
                    "model": model_name,
                    "messages": [
                        {"role": "system", "content": SYSTEM_PROMPT},
                        {"role": "user", "content": user_prompt}
                    ],
                    "temperature": 0.1,
                    "response_format": {"type": "json_object"}
                }
                with httpx.Client(timeout=8.0) as client:
                    res = client.post(url, headers=headers, json=payload)
                    if res.status_code == 200:
                        content = res.json()["choices"][0]["message"]["content"]
                        parsed = json.loads(content)
                        return _format_system2_output(parsed)
            except Exception:
                continue

    # 2. Graceful offline fallback if Groq API key is unset or unreachable
    return _offline_fallback_system2(transcript, language)


def _format_system2_output(parsed: Dict[str, Any]) -> Dict[str, Any]:
    """Ensures standardized output format matching app schema."""
    items = parsed.get("items", [])
    if not items and parsed.get("item"):
        items = [{
            "name": parsed.get("item", ""),
            "quantity": parsed.get("quantity", 1),
            "unit": parsed.get("unit", None)
        }]

    primary_item = items[0]["name"] if items else ""
    primary_qty = items[0].get("quantity", 1) if items else 1
    primary_unit = items[0].get("unit", None) if items else None

    return {
        "intent": parsed.get("intent", "ADD"),
        "items": items,
        "item": primary_item,
        "quantity": primary_qty,
        "unit": primary_unit,
        "brand": parsed.get("brand"),
        "price_filter": parsed.get("price_filter", {"max_price": None, "min_price": None}),
        "language_detected": parsed.get("language_detected", "en"),
        "confidence": 0.95,
        "reasoning": "deliberated"
    }

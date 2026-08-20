import json
from pathlib import Path
from typing import List, Dict, Any
from sqlalchemy.orm import Session
from models import ShoppingItem

DATA_PATH = Path(__file__).resolve().parent.parent / "data" / "substitutes.json"

_SUBS_MAP = {}

def _load_substitutes():
    global _SUBS_MAP
    if not _SUBS_MAP and DATA_PATH.exists():
        with open(DATA_PATH, "r", encoding="utf-8") as f:
            _SUBS_MAP = json.load(f)
    return _SUBS_MAP


def get_item_substitutes(item_name: str) -> List[Dict[str, Any]]:
    """Returns direct alternative suggestions for a given item."""
    if not item_name:
        return []
    subs_map = _load_substitutes()
    name_clean = item_name.strip().lower()
    
    # 1. Exact match
    if name_clean in subs_map:
        return subs_map[name_clean]
    
    # 2. Substring match
    for key, alts in subs_map.items():
        if key in name_clean or name_clean in key:
            return alts
            
    # 3. Token match
    for token in name_clean.split():
        if token in subs_map:
            return subs_map[token]
            
    return []


def get_substitute_suggestions(db: Session, limit: int = 3) -> List[Dict[str, Any]]:
    """
    Finds active items on the shopping list that have known healthy/popular alternatives.
    """
    subs_map = _load_substitutes()
    active_items = db.query(ShoppingItem).filter(ShoppingItem.status == "active").order_by(ShoppingItem.added_at.desc()).limit(10).all()
    
    suggestions = []
    seen_alts = set()
    
    for item in active_items:
        alts = get_item_substitutes(item.name)
        for alt in alts:
            alt_name = alt["name"]
            if alt_name.lower() in seen_alts:
                continue
            seen_alts.add(alt_name.lower())
            
            suggestions.append({
                "id": f"sub-{item.id}-{alt_name.replace(' ', '-')}",
                "type": "substitute",
                "item_name": alt_name,
                "for_item": item.name,
                "category": alt.get("category", "other"),
                "reason": f"Alternative to {item.name}: {alt.get('reason', 'Great substitute')}"
            })
            if len(suggestions) >= limit:
                return suggestions
                
    return suggestions

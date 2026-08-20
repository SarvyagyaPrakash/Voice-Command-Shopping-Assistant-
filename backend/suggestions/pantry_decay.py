import json
from datetime import datetime, timedelta
from pathlib import Path
from typing import List, Dict, Any, Tuple
from sqlalchemy.orm import Session
from models import ShoppingItem

DATA_PATH = Path(__file__).resolve().parent.parent / "data" / "consumption_rates.json"

_RATES_MAP = {}

def _load_rates():
    global _RATES_MAP
    if not _RATES_MAP and DATA_PATH.exists():
        with open(DATA_PATH, "r", encoding="utf-8") as f:
            _RATES_MAP = json.load(f)
    return _RATES_MAP


def get_consumption_days(item_name: str) -> int:
    """Returns estimated days until depletion for a given item, defaulting to 7 days."""
    if not item_name:
        return 7
    rates = _load_rates()
    name_clean = item_name.strip().lower()
    
    # 1. Exact match
    if name_clean in rates:
        return rates[name_clean]
    
    # 2. Substring match
    for key, days in rates.items():
        if key in name_clean or name_clean in key:
            return days
            
    # 3. Token match
    for token in name_clean.split():
        if token in rates:
            return rates[token]
            
    return 7


def calculate_depletion_date(item_name: str, added_at: datetime | None = None) -> Tuple[datetime, int]:
    """Calculates estimated depletion datetime and depletion days."""
    base_time = added_at or datetime.utcnow()
    days = get_consumption_days(item_name)
    depletion_date = base_time + timedelta(days=days)
    return depletion_date, days


def get_running_low_suggestions(db: Session) -> List[Dict[str, Any]]:
    """
    Finds items added previously that are near depletion (within 1 day of depletion or past depletion).
    If an item was recently added/replenished, it is fresh and will NOT be suggested as running low.
    """
    now = datetime.utcnow()
    threshold = now + timedelta(days=1)
    
    # Query items ordered by newest added_at first
    items = db.query(ShoppingItem).filter(
        ShoppingItem.estimated_depletion.isnot(None),
        ShoppingItem.status.in_(["active", "purchased"])
    ).order_by(ShoppingItem.added_at.desc()).all()
    
    suggestions = []
    seen_names = set()
    fresh_names = set()

    # Step 1: Mark all items that are currently fresh (not near depletion)
    for item in items:
        name_clean = item.name.lower().strip()
        if item.estimated_depletion and item.estimated_depletion > threshold:
            fresh_names.add(name_clean)
            # Also add root tokens e.g. 'bananas' -> 'banana', 'organic bananas' -> 'bananas'
            for word in name_clean.split():
                if len(word) >= 4:
                    fresh_names.add(word)

    # Step 2: Surface running-low alerts only for items that are genuinely depleted and not restocked
    for item in items:
        name_clean = item.name.lower().strip()
        
        # If this item or its root product was recently restocked, skip it
        if name_clean in fresh_names or any(word in fresh_names for word in name_clean.split() if len(word) >= 4):
            continue

        if item.estimated_depletion and item.estimated_depletion <= threshold:
            if name_clean in seen_names:
                continue
            seen_names.add(name_clean)
            
            days_ago = max(1, (now - (item.added_at or now)).days)
            msg = f"You added {item.name} {days_ago} days ago — running low?"
            
            total_duration = max(1, ((item.estimated_depletion or now) - (item.added_at or now)).total_seconds())
            elapsed = (now - (item.added_at or now)).total_seconds()
            depletion_pct = min(100.0, max(0.0, (elapsed / total_duration) * 100.0))

            suggestions.append({
                "id": f"decay-{item.id}",
                "type": "running_low",
                "item_name": item.name,
                "category": item.category,
                "reason": msg,
                "days_ago": days_ago,
                "depletion_pct": round(depletion_pct, 1),
                "original_item_id": item.id
            })
            
    return suggestions

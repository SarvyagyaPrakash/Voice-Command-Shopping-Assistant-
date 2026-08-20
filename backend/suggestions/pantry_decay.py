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
    Surfaces explainable suggestions: 'You added milk X days ago — running low?'
    """
    now = datetime.utcnow()
    threshold = now + timedelta(days=1)
    
    # Query items that have estimated_depletion set
    items = db.query(ShoppingItem).filter(
        ShoppingItem.estimated_depletion.isnot(None),
        ShoppingItem.status.in_(["active", "purchased"])
    ).all()
    
    suggestions = []
    seen_names = set()

    for item in items:
        if item.estimated_depletion and item.estimated_depletion <= threshold:
            name_lower = item.name.lower()
            if name_lower in seen_names:
                continue
            seen_names.add(name_lower)
            
            days_ago = max(1, (now - (item.added_at or now)).days)
            msg = f"You added {item.name} {days_ago} days ago — running low?"
            
            # calculate depletion percentage
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

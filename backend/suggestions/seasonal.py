import json
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Any, Set
from sqlalchemy.orm import Session
from models import ShoppingItem

DATA_PATH = Path(__file__).resolve().parent.parent / "data" / "seasonal_calendar.json"

_CALENDAR_MAP = {}

def _load_calendar():
    global _CALENDAR_MAP
    if not _CALENDAR_MAP and DATA_PATH.exists():
        with open(DATA_PATH, "r", encoding="utf-8") as f:
            _CALENDAR_MAP = json.load(f)
    return _CALENDAR_MAP


def get_seasonal_suggestions(db: Session, active_items_set: Set[str] | None = None) -> List[Dict[str, Any]]:
    """
    Returns in-season recommendations for the current calendar month
    that are not currently on the active shopping list.
    """
    cal = _load_calendar()
    current_month = str(datetime.utcnow().month)
    
    if active_items_set is None:
        active_items = db.query(ShoppingItem.name).filter(ShoppingItem.status == "active").all()
        active_items_set = {item[0].lower() for item in active_items}
        
    seasonal_list = cal.get(current_month, [])
    suggestions = []
    
    for item in seasonal_list:
        name = item.get("name", "")
        if name.lower() not in active_items_set:
            suggestions.append({
                "id": f"seasonal-{name.replace(' ', '-')}",
                "type": "seasonal",
                "item_name": name,
                "category": item.get("category", "produce"),
                "reason": item.get("reason", f"{name.capitalize()} are in peak season and on seasonal sale this month!"),
                "month": current_month
            })
            
    return suggestions[:4]

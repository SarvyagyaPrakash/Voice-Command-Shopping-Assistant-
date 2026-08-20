import json
from pathlib import Path

DATA_PATH = Path(__file__).resolve().parent / "data" / "categories.json"

_CATEGORY_MAP = {}

def _load_categories():
    global _CATEGORY_MAP
    if not _CATEGORY_MAP and DATA_PATH.exists():
        with open(DATA_PATH, "r", encoding="utf-8") as f:
            _CATEGORY_MAP = json.load(f)
    return _CATEGORY_MAP


def categorize_item(item_name: str) -> str:
    """
    Keyword-based auto-categorization mapping to:
    dairy, produce, bakery, meat, beverages, snacks, pantry, household, or other.
    """
    if not item_name:
        return "other"
    
    cat_map = _load_categories()
    name_clean = item_name.strip().lower()
    
    # 1. Exact match
    if name_clean in cat_map:
        return cat_map[name_clean]
    
    # 2. Check for multi-word or single-word keyword contains
    for keyword, cat in cat_map.items():
        if keyword in name_clean:
            return cat
            
    # 3. Check individual tokens
    tokens = name_clean.split()
    for token in tokens:
        if token in cat_map:
            return cat_map[token]
            
    return "other"

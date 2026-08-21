import re
from typing import Dict, Any, Optional, Tuple

# Number word dictionary
WORD_TO_NUM = {
    "a": 1,
    "an": 1,
    "one": 1,
    "two": 2,
    "three": 3,
    "four": 4,
    "five": 5,
    "six": 6,
    "seven": 7,
    "eight": 8,
    "nine": 9,
    "ten": 10,
    "eleven": 11,
    "twelve": 12,
    "dozen": 12,
    "half dozen": 6,
    "half-dozen": 6,
    "pair": 2
}

UNITS = [
    "bottle", "bottles", "liter", "liters", "litre", "litres",
    "gallon", "gallons", "lb", "lbs", "pound", "pounds",
    "kg", "kgs", "kilo", "kilos", "gram", "grams",
    "pack", "packs", "package", "packages", "packet", "packets",
    "bag", "bags", "box", "boxes", "can", "cans",
    "loaf", "loaves", "carton", "cartons", "bunch", "bunches",
    "jar", "jars", "cup", "cups", "piece", "pieces", "bar", "bars"
]

CLEAR_PATTERNS = [
    r"\bclear\s+(?:the\s+)?(?:whole\s+|entire\s+)?(?:shopping\s+)?list\b",
    r"\bclear\s+all(?:\s+items)?\b",
    r"\bclear\s+everything\b",
    r"\bclear\s+list\b",
    r"\bempty\s+(?:the\s+)?(?:shopping\s+)?(?:list|cart)\b",
    r"\bempty\s+list\b",
    r"\bempty\s+cart\b",
    r"\bdelete\s+all(?:\s+items)?\b",
    r"\bdelete\s+everything\b",
    r"\bdelete\s+(?:the\s+)?(?:whole\s+|entire\s+)?(?:shopping\s+)?list\b",
    r"\bremove\s+all(?:\s+items)?\b",
    r"\bremove\s+everything\b",
    r"\bremove\s+(?:the\s+)?(?:whole\s+|entire\s+)?(?:shopping\s+)?list\b",
    r"\bwipe\s+(?:the\s+)?(?:whole\s+|entire\s+)?(?:shopping\s+)?list\b",
    r"\berase\s+all(?:\s+items)?\b",
    r"\berase\s+(?:the\s+)?(?:whole\s+|entire\s+)?(?:shopping\s+)?list\b",
    r"\breset\s+(?:the\s+)?(?:shopping\s+)?list\b",
]

# Intent regex patterns
INTENT_PATTERNS = {
    "CLEAR": CLEAR_PATTERNS,
    "ADD": [
        r"\badd\b",
        r"\bi need\b",
        r"\bi want\b",
        r"\bbuy\b",
        r"\bget me\b",
        r"\bget\b",
        r"\bput\b",
        r"\bpick up\b",
        r"\bneed to buy\b",
        r"\bpurchase\b"
    ],
    "REMOVE": [
        r"\bremove\b",
        r"\bdelete\b",
        r"\btake off\b",
        r"\btake out\b",
        r"\bdon't need\b",
        r"\bdont need\b",
        r"\bcancel\b",
        r"\bdrop\b",
        r"\bclear\b",
        r"\berase\b",
        r"\bget rid of\b",
        r"\beliminate\b",
        r"\bdiscard\b"
    ],
    "SUBSTITUTE": [
        r"\bsubstitutes?\s+(?:for|to|of)\b",
        r"\balternatives?\s+(?:for|to|of)\b",
        r"\bwhat\s+(?:can\s+i|to)\s+replace\b",
        r"\breplace\b",
        r"\bswap\s+for\b"
    ],
    "RECOMMEND": [
        r"\bwhat\s+(?:am\s+i|are\s+we)\s+running\s+low\s+on\b",
        r"\bwhat(?:'s|\s+is)\s+in\s+season\b",
        r"\bseasonal\s+recommendations?\b",
        r"\bproduct\s+recommendations?\b",
        r"\bwhat\s+should\s+i\s+buy\b",
        r"\bany\s+recommendations\b",
        r"\brecommend\b",
        r"\bsuggestions?\b"
    ],
    "SEARCH": [
        r"\bsearch for\b",
        r"\blook for\b",
        r"\bfind\b",
        r"\bshow me\b",
        r"\bwhere is\b",
        r"\bwhere are\b",
        r"\bsearch\b"
    ]
}

FILLER_WORDS = [
    "please", "can you", "could you", "would you", "on the list", "from the list",
    "to the list", "on my list", "from my list", "off my list", "off the list",
    "to my list", "in the list", "out of the list", "out of my list",
    "some", "the", "for me", "hey assistant", "assistant", "for dinner", "for breakfast"
]


def extract_quantity_and_unit(text: str) -> Tuple[int, Optional[str], str, bool]:
    """
    Extracts numerical or word quantity and unit, returning (quantity, unit, cleaned_text, has_explicit_quantity).
    """
    clean = text
    qty = 1
    unit = None
    has_explicit = False
    
    # 1. Check for compound word numbers like 'half dozen'
    if "half dozen" in clean or "half-dozen" in clean:
        qty = 6
        has_explicit = True
        clean = re.sub(r"\bhalf[- ]dozen\b", "", clean)
    elif "dozen" in clean:
        qty = 12
        has_explicit = True
        clean = re.sub(r"\bdozen\b", "", clean)

    # 2. Check for numeric digits + unit e.g. "2 bottles", "3 lbs"
    units_pattern = "|".join(UNITS)
    num_unit_match = re.search(rf"\b(\d+)\s*({units_pattern})\b", clean, re.IGNORECASE)
    if num_unit_match:
        qty = int(num_unit_match.group(1))
        unit = num_unit_match.group(2).lower()
        has_explicit = True
        clean = clean[:num_unit_match.start()] + clean[num_unit_match.end():]
        return qty, unit, clean.strip(), has_explicit
        
    # 3. Check for word quantity + unit e.g. "two bottles", "a loaf"
    word_nums_pattern = "|".join(WORD_TO_NUM.keys())
    word_unit_match = re.search(rf"\b({word_nums_pattern})\s+({units_pattern})\b", clean, re.IGNORECASE)
    if word_unit_match:
        w = word_unit_match.group(1).lower()
        qty = WORD_TO_NUM.get(w, 1)
        unit = word_unit_match.group(2).lower()
        has_explicit = True
        clean = clean[:word_unit_match.start()] + clean[word_unit_match.end():]
        return qty, unit, clean.strip(), has_explicit

    # 4. Check for standalone unit e.g. "bottle of milk", "a carton of eggs"
    unit_of_match = re.search(rf"\b(?:a|an|one)?\s*({units_pattern})\s+of\b", clean, re.IGNORECASE)
    if unit_of_match:
        unit = unit_of_match.group(1).lower()
        has_explicit = True
        clean = clean[:unit_of_match.start()] + clean[unit_of_match.end():]
        return qty, unit, clean.strip(), has_explicit

    # 5. Check for standalone digits e.g. "2 apples"
    num_match = re.search(r"\b(\d+)\b", clean)
    if num_match:
        qty = int(num_match.group(1))
        has_explicit = True
        clean = clean[:num_match.start()] + clean[num_match.end():]
        return qty, unit, clean.strip(), has_explicit

    # 6. Check for standalone word quantity e.g. "five apples", "two avocados"
    for word, val in WORD_TO_NUM.items():
        # Avoid treating 'a' or 'an' as strict explicit quantity unless followed by a noun
        if word in ["a", "an"]:
            continue
        word_match = re.search(rf"\b{word}\b", clean, re.IGNORECASE)
        if word_match:
            qty = val
            has_explicit = True
            clean = clean[:word_match.start()] + clean[word_match.end():]
            break

    return qty, unit, clean.strip(), has_explicit


def parse_system1(transcript: str) -> Dict[str, Any]:
    """
    System 1: Fast, local, rule-based intent and entity extractor.
    Returns:
    {
        "intent": "ADD" | "REMOVE" | "SEARCH" | "UNKNOWN",
        "item": str,
        "quantity": int,
        "unit": str | None,
        "confidence": float,
        "reasoning": "instant",
        "entities": Dict[str, Any]
    }
    
    Confidence Formula:
    - Base for clear intent trigger match: +0.40
    - Clean single item phrase found: +0.40
    - Unambiguous quantity (explicit or cleanly defaulted): +0.20
    - Multi-item conjunctives penalty ("and", "also", "plus"): -0.40 (forces escalation to System 2)
    - Ambiguous conversational phrasing penalty ("we are out of", "is there", "maybe"): -0.30
    """
    if not transcript or not transcript.strip():
        return {
            "intent": "UNKNOWN",
            "item": "",
            "quantity": 1,
            "unit": None,
            "confidence": 0.0,
            "reasoning": "instant",
            "entities": {}
        }
    
    raw = transcript.strip()
    lowered = raw.lower()
    
    # Check for multi-item phrasing ("and", "also", "plus", comma-separated lists)
    is_multi_item = bool(re.search(r"\b(and|also|as well as|plus)\b", lowered) or "," in lowered)
    
    # Check for complex conversational phrasing
    is_conversational = bool(re.search(r"\b(ran out of|out of|we don't have|are we out|think we need|maybe|if we need)\b", lowered))
    
    matched_intent = "UNKNOWN"
    clean_text = lowered
    intent_score = 0.0

    # 1. Match Intent
    for intent, patterns in INTENT_PATTERNS.items():
        for pat in patterns:
            match = re.search(pat, clean_text)
            if match:
                matched_intent = intent
                intent_score = 0.40
                # remove trigger phrase from working string
                clean_text = re.sub(pat, " ", clean_text, count=1)
                break
        if matched_intent != "UNKNOWN":
            break

    # If intent is CLEAR (e.g. 'clear whole list', 'empty list', 'clear all')
    if matched_intent == "CLEAR":
        return {
            "intent": "CLEAR",
            "item": "",
            "items": [],
            "quantity": 1,
            "unit": None,
            "confidence": 0.98,
            "reasoning": "instant",
            "entities": {
                "item": "",
                "quantity": 1,
                "unit": None,
                "is_clear_all": True,
                "is_multi_item": False,
                "has_explicit_quantity": False
            }
        }

    # 2. Extract Quantity & Unit
    qty, unit, clean_text, has_explicit_quantity = extract_quantity_and_unit(clean_text)
    qty_score = 0.20

    # 3. Clean fillers and stopwords
    for filler in FILLER_WORDS:
        clean_text = re.sub(rf"\b{re.escape(filler)}\b", " ", clean_text, flags=re.IGNORECASE)
    
    # Remove extra prepositions like 'of', 'for', 'from', 'to', 'in', 'off' at boundaries
    clean_text = re.sub(r"\b(of|for|from|to|in|on|with|off)\b", " ", clean_text, flags=re.IGNORECASE)
    
    # Clean whitespace and non-alphanumeric punctuation
    item = re.sub(r"[^\w\s-]", " ", clean_text).strip()
    item = re.sub(r"\s+", " ", item)

    # 4. Item Score & Multi-item Penalty
    item_score = 0.0
    if item and len(item) >= 2:
        item_score = 0.40

    # Calculate final confidence score
    confidence = intent_score + item_score + qty_score
    
    if is_multi_item:
        confidence -= 0.40  # Escalates multi-item sentences to System 2
    if is_conversational:
        confidence -= 0.30  # Escalates conversational questions to System 2
    if matched_intent == "UNKNOWN":
        confidence = 0.0
    if not item:
        confidence = min(confidence, 0.30)
        
    confidence = max(0.0, min(1.0, round(confidence, 2)))

    structured_items = [{
        "name": item,
        "quantity": qty,
        "unit": unit,
        "has_explicit_quantity": has_explicit_quantity
    }] if item and not is_multi_item else []

    return {
        "intent": matched_intent,
        "item": item,
        "items": structured_items,
        "quantity": qty,
        "unit": unit,
        "confidence": confidence,
        "reasoning": "instant",
        "has_explicit_quantity": has_explicit_quantity,
        "entities": {
            "item": item,
            "quantity": qty,
            "unit": unit,
            "has_explicit_quantity": has_explicit_quantity,
            "is_multi_item": is_multi_item
        }
    }

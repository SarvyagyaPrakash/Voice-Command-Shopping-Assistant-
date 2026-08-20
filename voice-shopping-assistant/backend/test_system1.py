import pytest
from nlp.system1_parser import parse_system1

# 20 test cases evaluating System 1 behavior
SAMPLE_PHRASES = [
    # 1. Simple ADD
    ("add milk", "ADD", "milk", 1, None, True),
    # 2. ADD with numeric quantity
    ("add 2 bottles of milk", "ADD", "milk", 2, "bottle", True),
    # 3. ADD with word quantity
    ("i need three apples", "ADD", "apples", 3, None, True),
    # 4. ADD with 'dozen'
    ("buy a dozen eggs", "ADD", "eggs", 12, None, True),
    # 5. ADD with 'half dozen'
    ("get me half dozen oranges", "ADD", "oranges", 6, None, True),
    # 6. ADD with unit 'lbs'
    ("put 5 lbs potatoes on the list", "ADD", "potatoes", 5, "lb", True),
    # 7. ADD with 'loaf'
    ("buy a loaf of bread", "ADD", "bread", 1, "loaf", True),
    # 8. ADD with 'i want'
    ("i want bananas", "ADD", "bananas", 1, None, True),
    # 9. ADD with 'pick up'
    ("pick up olive oil", "ADD", "olive oil", 1, None, True),
    # 10. ADD with 'need to buy'
    ("need to buy coffee", "ADD", "coffee", 1, None, True),
    # 11. Simple REMOVE
    ("remove eggs", "REMOVE", "eggs", 1, None, True),
    # 12. REMOVE with 'delete'
    ("delete bread", "REMOVE", "bread", 1, None, True),
    # 13. REMOVE with 'take off'
    ("take off bananas", "REMOVE", "bananas", 1, None, True),
    # 14. REMOVE with "don't need"
    ("don't need butter", "REMOVE", "butter", 1, None, True),
    # 15. Simple SEARCH
    ("find apples", "SEARCH", "apples", 1, None, True),
    # 16. SEARCH with 'search for'
    ("search for cereal", "SEARCH", "cereal", 1, None, True),
    # 17. SEARCH with 'show me'
    ("show me pasta", "SEARCH", "pasta", 1, None, True),
    # 18. Multi-item sentence (Should have LOWER confidence < 0.75 to escalate to System 2)
    ("add milk and eggs", "ADD", None, 1, None, False),
    # 19. Conversational ambiguous sentence (Should escalate to System 2)
    ("we ran out of coffee for breakfast", "UNKNOWN", None, 1, None, False),
    # 20. Another multi-item complex list
    ("buy bananas, apples, and Greek yogurt", "ADD", None, 1, None, False)
]


@pytest.mark.parametrize("phrase,expected_intent,expected_item,expected_qty,expected_unit,should_be_high_confidence", SAMPLE_PHRASES)
def test_system1_phrases(phrase, expected_intent, expected_item, expected_qty, expected_unit, should_be_high_confidence):
    res = parse_system1(phrase)
    
    if should_be_high_confidence:
        assert res["confidence"] >= 0.75, f"Expected high confidence for '{phrase}', got {res['confidence']}"
        assert res["intent"] == expected_intent, f"Expected intent {expected_intent}, got {res['intent']}"
        if expected_item:
            assert expected_item in res["item"], f"Expected '{expected_item}' in '{res['item']}'"
        if expected_qty:
            assert res["quantity"] == expected_qty, f"Expected quantity {expected_qty}, got {res['quantity']}"
        if expected_unit:
            assert res["unit"] == expected_unit or (res["unit"] and expected_unit in res["unit"]), f"Expected unit {expected_unit}, got {res['unit']}"
    else:
        # Multi-item or ambiguous phrasing should drop confidence below 0.75 for System 2 escalation
        assert res["confidence"] < 0.75, f"Expected low confidence (<0.75) for complex phrase '{phrase}', got {res['confidence']}"


def test_system1_empty_input():
    res = parse_system1("")
    assert res["intent"] == "UNKNOWN"
    assert res["confidence"] == 0.0

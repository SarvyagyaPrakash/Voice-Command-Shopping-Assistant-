# Voice Shopping Assistant (Thinking Fast & Slow Architecture)

An explainable, human-logic voice shopping assistant organized around two core ideas:
1. **System 1 / System 2 Dual-Engine NLP**: Local sub-50ms regex parser for predictable commands; conscious LLM fallback for ambiguous, multi-item, or multilingual queries.
2. **Pantry Decay Model**: Proactive, explainable "running low" suggestions calculated from shelf-life depletion rates rather than black-box recommender systems.

---

## ⚡ Architecture Overview

```
Voice / Text Input
        │
        ▼
[System 1: Fast Rule Parser] ──(Confidence >= 0.75 & English)──► [⚡ Instant Execution (<50ms, $0)]
        │
        └──(Confidence < 0.75 OR Multilingual)──► [🧠 System 2: LLM Escalation (Gemini/Groq/OpenAI)]
```

- **System 1 (Instant Reflex)**: Evaluates regex intent templates (`ADD`, `REMOVE`, `SEARCH`), extracts quantities/units (e.g. *"2 bottles"*, *"a dozen"*), cleans stopwords, and scores confidence.
- **System 2 (Conscious Thought)**: Awakens on multi-item phrasing (*"add milk and 2 dozen eggs"*), conversational phrasing (*"we are out of olive oil"*), or non-English input (*Hindi/Spanish*).
- **Reasoning Badge**: The UI transparently indicates `⚡ Instant (System 1)` vs `🧠 Deliberated (System 2)` along with live telemetry ratios.

---

## 🥦 Pantry Decay & Smart Suggestions

- **Depletion Date Calculation**: Items are stamped with estimated consumption rates on creation (e.g., `milk`: 5 days, `bananas`: 4 days, `bread`: 6 days, `olive oil`: 60 days).
- **Running Low Alert**: Automatically flags items approaching depletion in a dismissible card with a visual progress bar.
- **Seasonal Produce**: Month-aware recommendations for peak produce (e.g., mangoes, fresh berries).
- **Smart Substitutes**: Static category-to-alternative mappings (e.g. *Oat Milk* for *Milk*, *Honey* for *Sugar*).

---

## 🚀 Quickstart (Zero-Setup)

### 1. Start Backend

```bash
cd backend

# Create virtual environment and install dependencies
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Run FastAPI server
uvicorn main:app --reload --port 8000
```
- API Docs: `http://127.0.0.1:8000/docs`
- SQLite database is created automatically at `shopping_assistant.db`.

### 2. Start Frontend

```bash
cd frontend

# Install and run Vite dev server
npm install
npm run dev
```
- Open `http://localhost:5173` in Google Chrome or Microsoft Edge (for Web Speech API support).

---

## 🧪 Running System 1 Tests

Run the 20-phrase unit test suite:

```bash
cd backend
pytest test_system1.py -v
```

---

## 🎯 Scoping & Architectural Decisions

- **No Auth / Message Queues**: Kept strictly zero-setup and self-contained.
- **In-Browser Web Speech API**: Zero backend transcription cost and sub-second voice responsiveness.
- **English-Only System 1 by Design**: Non-English languages (Hindi, Spanish) route directly to System 2 LLM translation and extraction.
- **Simulated Store Catalog**: `products.json` simulates a local grocery catalog with brands and price filtering.

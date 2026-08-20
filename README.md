# Voice Shopping Assistant (Thinking Fast & Slow Architecture)

An explainable, human-logic voice shopping assistant organized around two core ideas:
1. **Fast & Slow Dual-Engine Architecture (Audio + NLU)**:
   - **Fast Path (System 1)**: Instant in-browser speech recognition + local sub-50ms regex parser for routine commands (`⚡ Instant`, $0 cost).
   - **Slow Path (System 2)**: Hugging Face Whisper Large V3 for accurate audio transcription (`🎧 Careful Listening`) + Groq LLaMA-3 for conscious natural-language understanding (`🧠 Thought it through`).
2. **Pantry Decay Model**: Proactive, explainable "running low" suggestions calculated from shelf-life depletion rates rather than black-box recommender systems.

---

## ⚡ Architecture Overview

```
Voice / Audio Input
        │
        ├──[English / Familiar]──► [Web Speech API (Browser STT)] ──► [System 1: Regex Parser (<50ms, $0)]
        │                                                                     │ (Confidence >= 0.75)
        │                                                                     ▼
        │                                                           [⚡ Instant Execution]
        │                                                                     │
        └──[Multilingual / Low Conf]──► [Whisper Large V3] ──► [System 2: Groq LLaMA-3]
                                         (🎧 Careful Listening)        (🧠 Thought it through)
```

- **Reasoning Badge**: The UI transparently indicates `⚡ Instant (System 1)`, `🎧 Careful Listening (Whisper V3)`, and `🧠 Thought it through (Groq LLaMA-3)` as small stackable tags with live architecture telemetry.

---

## 🔑 Environment Variables

Create a `backend/.env` file (copied from `backend/.env.example`):

| Variable | Description | Where to Get |
| :--- | :--- | :--- |
| `GROQ_API_KEY` | Free-tier API key powering System 2 conscious LLM understanding | [Groq Console API Keys](https://console.groq.com/keys) |
| `HF_API_TOKEN` | Free-tier token for Hugging Face Whisper Large V3 transcription | [Hugging Face Access Tokens](https://huggingface.co/settings/tokens) |
| `CORS_ORIGINS` | Comma-separated allowed frontend origins (defaults to `*` for local dev) | Custom domain if deploying |
| `DATABASE_URL` | SQLite database URI (defaults to `sqlite:///./shopping_assistant.db`) | Local file path |

*(Note: If API keys are omitted, the app gracefully falls back to local intelligent offline parsers without crashing).*

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
- API Documentation: `http://127.0.0.1:8000/docs`
- SQLite database is created automatically at `backend/shopping_assistant.db`.

### 2. Start Frontend

```bash
cd frontend

# Install dependencies and start Vite dev server
npm install
npm run dev
```
- Open `http://localhost:5173` in Google Chrome or Microsoft Edge (for Web Speech API support).

---

## 🧪 Running System 1 Tests

Run the unit test suite:

```bash
cd backend
pytest test_system1.py -v
```

# Architectural Approach: Human-Logic Voice Shopping Assistant

This assistant is organized around how humans naturally think ("thinking fast and slow"):

1. **Dual-Engine Audio & NLU**: Both transcription and intent parsing follow a fast/slow hierarchy. Common commands use instant browser speech recognition and local sub-50ms regex parsing (`⚡ instant`, $0 cost), while multilingual speech, noisy audio, or complex phrasing escalate to Hugging Face Whisper Large V3 (`🎧 careful listening`) and Groq LLaMA-3 (`🧠 thought it through`).
2. **Explainable UI Telemetry**: The UI transparently surfaces this cognitive split with interactive stackable reasoning badges and telemetry distribution counters.

Smart suggestions avoid black-box ML recommenders in favor of a human-logic **Pantry Decay Model**:
- Every grocery item is assigned an estimated shelf-life depletion date (milk ≈ 5d, bread ≈ 6d, bananas ≈ 4d).
- Items proactively resurface as "running low" alerts shortly before expiration, mirroring human grocery mental math.
- Seasonal produce and healthy substitutes use clean, explainable static lookups rather than opaque neural models.

This delivers a sub-50ms responsive experience that remains fully explainable, cost-effective, and capable of handling complex natural language.

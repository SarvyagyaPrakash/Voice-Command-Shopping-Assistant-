# Architectural Approach: Human-Logic Voice Shopping Assistant

This assistant is built around how humans naturally think ("thinking fast and slow"):

1. **System 1 (Fast & Reflexive)**: Familiar phrasing ("add milk", "remove eggs") is processed instantly by a local rule-based parser in sub-50ms with zero network or LLM costs.
2. **System 2 (Slow & Deliberated)**: Only when confidence drops below 0.75—due to multi-item sentences, conversational ambiguity, or language switching (Hindi/Spanish)—does the app escalate to a conscious LLM for deep natural-language understanding.

The UI transparently surfaces this cognitive split via an interactive badge (`⚡ instant` vs `🧠 deliberated`) and telemetry counters, showing reviewer-visible reasoning.

Smart suggestions avoid black-box ML recommenders in favor of an explainable **Pantry Decay Model**:
- Each item is assigned an estimated shelf-life depletion date (milk ≈ 5d, bread ≈ 6d, bananas ≈ 4d).
- Items proactively resurface as "running low" alerts shortly before expiration, mirroring human grocery mental math.
- Seasonal produce and healthy substitutes use clean, static lookups rather than opaque neural models.

This delivers a sub-50ms responsive experience that remains explainable, cost-effective, and capable of handling complex language.

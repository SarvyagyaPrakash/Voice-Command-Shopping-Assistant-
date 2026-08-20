from typing import Dict, Any, Optional
from sqlalchemy.orm import Session
from nlp.system1_parser import parse_system1
from nlp.system2_parser import llm_parse_command
from models import CommandLog

CONFIDENCE_THRESHOLD = 0.75


def process_command(transcript: str, language: str = "en", db: Optional[Session] = None) -> Dict[str, Any]:
    """
    Dual-engine command router implementing the 'Thinking Fast & Slow' architecture:
    1. System 1 (Fast / Reflexive / Sub-50ms): Evaluates local regex/rule patterns.
    2. Confidence Gate:
       - If language is English and confidence >= 0.75 -> resolve immediately via System 1.
       - If language is non-English OR confidence < 0.75 -> escalate to System 2 (Conscious LLM / NLU).
    3. Logs decision into CommandLog to track instant vs deliberated ratios.
    """
    lang_clean = (language or "en").lower().strip()
    
    # Non-English commands automatically route to System 2 by scoping design
    if lang_clean not in ["en", "en-us", "en-gb", "en-in"]:
        result = llm_parse_command(transcript, language=lang_clean)
        reasoning_path = "deliberated"
    else:
        # Evaluate System 1 first
        s1_result = parse_system1(transcript)
        
        if s1_result["confidence"] >= CONFIDENCE_THRESHOLD and s1_result["intent"] != "UNKNOWN":
            result = s1_result
            reasoning_path = "instant"
        else:
            # Escalate to System 2
            result = llm_parse_command(transcript, language=lang_clean)
            reasoning_path = "deliberated"
            
    result["reasoning_path"] = reasoning_path
    result["original_transcript"] = transcript

    # Log to database if session provided
    if db:
        try:
            log_entry = CommandLog(
                transcript=transcript,
                resolved_intent=result.get("intent", "UNKNOWN"),
                reasoning_path=reasoning_path,
                confidence=result.get("confidence", 0.0)
            )
            db.add(log_entry)
            db.commit()
            db.refresh(log_entry)
            result["log_id"] = log_entry.id
        except Exception:
            db.rollback()

    return result

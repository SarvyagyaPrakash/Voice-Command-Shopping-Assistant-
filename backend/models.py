from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, DateTime
from database import Base


class ShoppingItem(Base):
    __tablename__ = "shopping_items"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String, nullable=False, index=True)
    category = Column(String, default="other", index=True)
    quantity = Column(Integer, default=1)
    unit = Column(String, nullable=True)
    added_at = Column(DateTime, default=datetime.utcnow)
    estimated_depletion = Column(DateTime, nullable=True)
    status = Column(String, default="active", index=True)  # "active" | "purchased" | "removed"

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "category": self.category,
            "quantity": self.quantity,
            "unit": self.unit,
            "added_at": self.added_at.isoformat() if self.added_at else None,
            "estimated_depletion": self.estimated_depletion.isoformat() if self.estimated_depletion else None,
            "status": self.status
        }


class CommandLog(Base):
    __tablename__ = "command_logs"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    transcript = Column(String, nullable=False)
    resolved_intent = Column(String, nullable=False)
    reasoning_path = Column(String, nullable=False)  # "instant" | "deliberated"
    confidence = Column(Float, nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "transcript": self.transcript,
            "resolved_intent": self.resolved_intent,
            "reasoning_path": self.reasoning_path,
            "confidence": self.confidence,
            "timestamp": self.timestamp.isoformat() if self.timestamp else None
        }

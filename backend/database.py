import os
from pathlib import Path
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

# Load environment variables from .env
env_path = Path(__file__).resolve().parent / ".env"
load_dotenv(dotenv_path=env_path)

# Note for hosting readiness:
# When hosting on platforms with an ephemeral filesystem (e.g. Render/Railway free tiers without a persistent volume),
# the SQLite database file will be reset on every redeploy. This is an intentional and accepted limitation
# for this zero-setup assignment scope.
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./shopping_assistant.db")

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

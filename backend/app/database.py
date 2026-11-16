"""Connessione al database.

In locale usa SQLite (file accessbz.db). Su Render legge DATABASE_URL (PostgreSQL).
"""
import os
import time

from sqlalchemy import create_engine, event
from sqlalchemy.exc import IntegrityError, OperationalError, ProgrammingError
from sqlalchemy.orm import DeclarativeBase, sessionmaker

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./accessbz.db")

# Render fornisce "postgres://...", SQLAlchemy vuole "postgresql+psycopg://..."
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql+psycopg://", 1)
elif DATABASE_URL.startswith("postgresql://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+psycopg://", 1)

IS_SQLITE = DATABASE_URL.startswith("sqlite")
connect_args = {"check_same_thread": False, "timeout": 15} if IS_SQLITE else {}
engine = create_engine(DATABASE_URL, connect_args=connect_args, pool_pre_ping=True)

if IS_SQLITE:
    # Raspberry Pi / locale: WAL permette letture e scritture contemporanee senza blocchi,
    # foreign_keys fa rispettare i collegamenti tra tabelle.
    @event.listens_for(engine, "connect")
    def _sqlite_pragmas(dbapi_conn, _):
        cur = dbapi_conn.cursor()
        cur.execute("PRAGMA journal_mode=WAL")
        cur.execute("PRAGMA synchronous=NORMAL")
        cur.execute("PRAGMA foreign_keys=ON")
        cur.execute("PRAGMA busy_timeout=15000")
        cur.close()
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def create_tables(attempts: int = 10, wait_s: float = 3):
    """Crea le tabelle mancanti. Su Render server e popolamento partono insieme: se l'altro
    processo sta creando le stesse tabelle, PostgreSQL rifiuta la seconda creazione.
    In quel caso (o se il database non è ancora pronto) si aspetta e si riprova: al tentativo
    successivo le tabelle esistono già e non c'è niente da creare."""
    for attempt in range(1, attempts + 1):
        try:
            Base.metadata.create_all(bind=engine)
            return
        except (IntegrityError, ProgrammingError, OperationalError):
            if attempt == attempts:
                raise
            time.sleep(wait_s)

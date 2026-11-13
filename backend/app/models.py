"""Tabelle del database: utenti, segnalazioni (ostacoli) e voti della community."""
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, LargeBinary, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base
from .lifecycle import utcnow


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    # Nessuna email o password: l'utente è identificato da un ID casuale del dispositivo.
    device_id: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    nickname: Mapped[str] = mapped_column(String(40))
    profile: Mapped[str] = mapped_column(String(20), default="pedestrian")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class Report(Base):
    __tablename__ = "reports"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    category: Mapped[str] = mapped_column(String(20), index=True)
    lat: Mapped[float] = mapped_column(Float)
    lon: Mapped[float] = mapped_column(Float)
    description: Mapped[str] = mapped_column(Text, default="")
    # Durata stimata da chi segnala: minutes | hours | days | weeks | unknown
    duration_class: Mapped[str] = mapped_column(String(10), default="unknown")

    photo: Mapped[bytes | None] = mapped_column(LargeBinary, nullable=True, deferred=True)
    has_photo: Mapped[bool] = mapped_column(Boolean, default=False)

    # Indici: le query filtrano per data e autore invece di leggere tutta la tabella
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, index=True)
    last_confirmed_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, index=True)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True, index=True)

    created_by: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    is_demo: Mapped[bool] = mapped_column(Boolean, default=False)

    author: Mapped[User] = relationship()
    votes: Mapped[list["Vote"]] = relationship(
        back_populates="report", cascade="all, delete-orphan", order_by="Vote.created_at"
    )


class Vote(Base):
    """Risposta alla domanda "L'ostacolo è ancora presente?"."""

    __tablename__ = "votes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    report_id: Mapped[int] = mapped_column(ForeignKey("reports.id"), index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    present: Mapped[bool] = mapped_column(Boolean)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    report: Mapped[Report] = relationship(back_populates="votes")

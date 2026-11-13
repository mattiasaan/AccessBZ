"""Il cuore di AccessBZ: il ciclo di vita temporale di un ostacolo.

APPENA SEGNALATO -> CONFERMATO -> PERSISTENTE -> RISOLTO
                                              \\-> SCADUTO (nessuno lo riconferma)

Nessuna intelligenza artificiale: solo timestamp, durata stimata e conferme.
"""
from datetime import datetime, timedelta, timezone

# Durata prevista per ogni scelta dell'utente ("Quanto durerà?")
EXPECTED_DURATION = {
    "minutes": timedelta(minutes=30),
    "hours": timedelta(hours=3),
    "days": timedelta(days=3),
    "weeks": timedelta(weeks=3),
    "unknown": None,
}

# Dopo quanto tempo SENZA conferme la segnalazione scade
EXPIRY_WITHOUT_CONFIRMATION = {
    "minutes": timedelta(hours=1),
    "hours": timedelta(hours=6),
    "days": timedelta(days=4),
    "weeks": timedelta(weeks=4),
    "unknown": timedelta(days=3),
}

CONFIRMATIONS_FOR_PERSISTENT = 3   # conferme di altri utenti per diventare "persistente"
REMOVALS_FOR_RESOLVED = 2          # "non c'è più" di utenti diversi per chiudere

ACTIVE_STATUSES = {"new", "confirmed", "persistent"}


def utcnow() -> datetime:
    """Ora attuale in UTC (senza fuso, come viene salvata nel database)."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


def compute_status(report, now: datetime | None = None) -> str:
    now = now or utcnow()
    if report.resolved_at is not None:
        return "resolved"

    expiry = EXPIRY_WITHOUT_CONFIRMATION.get(report.duration_class, timedelta(days=3))
    if now - report.last_confirmed_at > expiry:
        return "expired"

    confirmations = count_confirmations(report)
    if confirmations == 0:
        return "new"

    expected = EXPECTED_DURATION.get(report.duration_class)
    lasted_longer_than_expected = expected is not None and now - report.created_at > expected
    if confirmations >= CONFIRMATIONS_FOR_PERSISTENT or lasted_longer_than_expected:
        return "persistent"
    return "confirmed"


def count_confirmations(report) -> int:
    """Utenti diversi dall'autore che hanno detto "è ancora presente"."""
    return len({v.user_id for v in report.votes if v.present and v.user_id != report.created_by})


def apply_vote(report, user_id: int, present: bool, now: datetime | None = None) -> None:
    """Aggiorna la segnalazione dopo un voto (il voto deve essere già in report.votes)."""
    now = now or utcnow()
    if present:
        report.last_confirmed_at = now
        report.resolved_at = None  # se qualcuno lo vede ancora, l'ostacolo torna attivo
        return

    if user_id == report.created_by:
        report.resolved_at = now  # chi l'ha segnalato può chiuderlo subito
        return

    # Conta i "non c'è più" arrivati DOPO l'ultima conferma
    removals = {
        v.user_id
        for v in report.votes
        if not v.present and v.created_at >= report.last_confirmed_at
    }
    if len(removals) >= REMOVALS_FOR_RESOLVED:
        report.resolved_at = now


def active_duration(report, now: datetime | None = None) -> timedelta:
    """Per quanto tempo l'ostacolo è rimasto (o è ancora) attivo."""
    now = now or utcnow()
    status = compute_status(report, now)
    if status == "resolved":
        end = report.resolved_at
    elif status == "expired":
        end = report.last_confirmed_at
    else:
        end = now
    return end - report.created_at

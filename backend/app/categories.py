"""Categorie di ostacoli e profili di mobilità.

"La città è la stessa. Il percorso non lo è.": AccessBZ è pensata per chi in città
trova un ostacolo come un problema vero. Il profilo decide che tipo di percorso
calcolare (per esempio senza scale) e quali ostacoli mostrare.
Chi vuole solo aiutare con le segnalazioni sceglie il profilo della persona che vuole aiutare.
"""

CATEGORIES = {
    "vehicle": "Veicolo sul marciapiede",
    "works": "Lavori",
    "construction": "Cantiere",
    "closed": "Passaggio chiuso",
    "elevator": "Ascensore fuori servizio",
    "obstacle": "Ostacolo fisico",
    "tables": "Tavolini sul passaggio",
    "bikes": "Bici o monopattini che bloccano",
    "snow": "Neve o ghiaccio",
    "other": "Altro problema",
}

ALL = set(CATEGORIES)

# ors: profilo di OpenRouteService; avoid: elementi da evitare nel percorso
PROFILES = {
    "wheelchair": {"label": "Carrozzina", "ors": "wheelchair", "categories": ALL},
    "blind": {"label": "Ipovedente", "ors": "foot-walking", "categories": ALL},
    # A piedi, ma senza scalinate: un gradino si fa, una rampa di scale no.
    "elderly": {"label": "Anziani", "ors": "foot-walking", "avoid": ["steps"], "categories": ALL},
    # Un passeggino ha quasi le stesse esigenze di una carrozzina: niente scale.
    "stroller": {"label": "Passeggino", "ors": "wheelchair", "categories": ALL},
}

DEFAULT_PROFILE = "wheelchair"

# Profili delle versioni precedenti dell'app (Pedone, Bicicletta): diventano "Anziani",
# il profilo a piedi più vicino. Così un'app non aggiornata continua a funzionare.
LEGACY_PROFILES = {"pedestrian": "elderly", "bike": "elderly"}


def normalize_profile(profile: str | None) -> str | None:
    return LEGACY_PROFILES.get(profile, profile)


def is_relevant(category: str, profile: str | None) -> bool:
    profile = normalize_profile(profile)
    if not profile or profile not in PROFILES:
        return True
    return category in PROFILES[profile]["categories"]

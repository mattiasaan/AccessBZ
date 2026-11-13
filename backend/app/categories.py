"""Categorie di ostacoli e profili di mobilità.

"La città è la stessa. Il percorso non lo è.": ogni profilo vede solo gli ostacoli
che per lui sono un problema.
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

PROFILES = {
    "pedestrian": {
        "label": "Pedone",
        "ors": "foot-walking",
        "categories": {"works", "construction", "closed", "obstacle", "snow", "other"},
    },
    "wheelchair": {"label": "Carrozzina", "ors": "wheelchair", "categories": ALL},
    "blind": {"label": "Ipovedente", "ors": "foot-walking", "categories": ALL},
    # Un passeggino ha quasi le stesse esigenze di una carrozzina: niente scale.
    "stroller": {"label": "Passeggino", "ors": "wheelchair", "categories": ALL},
    "bike": {
        "label": "Bicicletta",
        "ors": "cycling-regular",
        "categories": {"works", "construction", "closed", "obstacle", "snow", "other"},
    },
}


def is_relevant(category: str, profile: str | None) -> bool:
    if not profile or profile not in PROFILES:
        return True
    return category in PROFILES[profile]["categories"]

import json, re, os

# 1. Charger le dictionnaire existant
with open("locales/fr.json", "r", encoding="utf-8") as f:
    translations = json.load(f)

# Dictionnaire de secours pour les catégories structurelles que Kaptain a bloquées en anglais
MANUAL_TRANSLATIONS = {
    "Genres": "Genres",
    "Moods & Vibes": "Ambiances & Émotions",
    "Film Collections": "Sagas & Collections",
    "Spotlight": "À l'affiche",
    "Spotlights": "À l'affiche",
    "The Saga": "La Saga",
    "Streaming Services": "Plateformes de Streaming",
    "Networks": "Chaînes TV",
    "Actors": "Acteurs",
    "Legendary Directors": "Réalisateurs Légendaires",
    "Studios": "Studios",
    "By Decade": "Par Décennie",
    "Anime": "Animés",
    "Awards": "Récompenses",
    "International Cinema": "Cinéma International",
    "Documentaries": "Documentaires",
    "Kids and Family": "Enfants & Famille",
    "Reality TV": "Télé-Réalité",
    "Trending / New": "Tendances / Nouveautés",
    "For You": "Pour Vous",
    "Discover": "Découverte"
}
translations.update(MANUAL_TRANSLATIONS)

def translate_node(node):
    if isinstance(node, dict):
        for key, val in node.items():
            if key in ("title", "name", "genre") and isinstance(val, str):
                if val in translations:
                    node[key] = translations[val]
            else:
                translate_node(val)
    elif isinstance(node, list):
        for item in node:
            translate_node(item)

# 2. Fichiers cibles à écraser
TARGET_FILES = [
    ("collections/database.js", "js"),
    ("collections/database.mega092.js", "js"),
    ("collections/database.mega091.js", "js"),
    ("Kaptain_Nuvio_Native_mega092.json", "json"),
    ("Kaptain_Catalog_Template.mega092.json", "json")
]

for file_path, file_type in TARGET_FILES:
    if not os.path.exists(file_path):
        continue
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()

    if file_type == "js":
        match = re.search(r"(window\.NUVIO_DATABASE\s*=\s*)(\[[\s\S]*?\])(;\s*)$", content)
        if match:
            prefix, json_str, suffix = match.group(1), match.group(2), match.group(3)
            data = json.loads(json_str)
            translate_node(data)
            with open(file_path, "w", encoding="utf-8") as f:
                f.write(prefix + json.dumps(data, ensure_ascii=False, indent=2) + suffix)
            print(f"[OK] Traduit : {file_path}")
    else:
        data = json.loads(content)
        translate_node(data)
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        print(f"[OK] Traduit : {file_path}")

print("Tous les fichiers sources ont été mis à jour.")

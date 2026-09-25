import json

SOURCE_CATALOG = "Kaptain_Nuvio_Native_mega092.json"
LOCALE_FILE = "locales/fr.json"
OUTPUT_CATALOG = "Kaptain_Nuvio_Native_FR.json"

# 1. Chargement des traductions
with open(LOCALE_FILE, "r", encoding="utf-8") as f:
    translations = json.load(f)

# 2. Chargement du catalogue d'origine
with open(SOURCE_CATALOG, "r", encoding="utf-8") as f:
    catalog = json.load(f)

# 3. Remplacement récursif des titres et genres
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

translate_node(catalog)

# 4. Écriture du fichier final pour NuVio
with open(OUTPUT_CATALOG, "w", encoding="utf-8") as f:
    json.dump(catalog, f, ensure_ascii=False, indent=2)

print(f"Catalogue français généré avec succès : {OUTPUT_CATALOG}")

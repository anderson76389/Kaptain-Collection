import json, re, os

# Patterns de remplacement structurel (insensible à la casse)
REPLACEMENTS = [
    # 1. Nettoyage des suffixes de format
    (r"\s*\((?:Movies|Films)\)", " (Films)"),
    (r"\s*\((?:Series|Séries|TV Shows)\)", " (Séries)"),
    
    # 2. Qualificatifs principaux
    (r"\bTop 10\b", "Top 10"),
    (r"\bTop Rated\b", "Les mieux notés"),
    (r"\bPopular\b", "Populaires"),
    (r"\bNew Releases\b", "Nouveautés"),
    (r"\bNew Movies\b", "Nouveaux films"),
    (r"\bNew Series\b", "Nouvelles séries"),
    (r"\bTrending\b", "Tendances"),
    (r"\bAll-Time\b", "De tous les temps"),
    (r"\bBest of\b", "Le meilleur de"),
    (r"\bBox Office Hits\b", "Succès du Box-Office"),
    (r"\bAward Winners\b", "Films primés"),
    (r"\bOscar Winners\b", "Gagnants des Oscars"),
    
    # 3. Types de médias et termes récurrents
    (r"\bMovies\b", "Films"),
    (r"\bMovie\b", "Film"),
    (r"\bTV Shows\b", "Séries"),
    (r"\bTV Series\b", "Séries"),
    (r"\bSeries\b", "Séries"),
    (r"\bDocumentaries\b", "Documentaires"),
    (r"\bDocumentary\b", "Documentaire"),
    (r"\bAnimation\b", "Animation"),
    (r"\bCollection\b", "Collection"),
    (r"\bCinema\b", "Cinéma"),
    (r"\bClassics\b", "Classiques"),
    (r"\bShorts\b", "Courts-métrages"),
    
    # 4. Décennies
    (r"\b(\d{4})s\s+Films\b", r"Films des années \1"),
    (r"\b(\d{4})s\s+Séries\b", r"Séries des années \1"),
    (r"\b(\d{4})s\b", r"Années \1"),
]

def clean_string(s):
    if not isinstance(s, str):
        return s
    
    # Normalisation préalable
    res = s
    for pattern, repl in REPLACEMENTS:
        res = re.sub(pattern, repl, res, flags=re.IGNORECASE)
    
    # Nettoyage des doublons syntaxiques générés
    res = re.sub(r"Films \(Films\)", "Films", res)
    res = re.sub(r"Séries \(Séries\)", "Séries", res)
    res = re.sub(r"\s+", " ", res).strip()
    return res

def process_node(node):
    if isinstance(node, dict):
        for key in ("title", "name"):
            if key in node and isinstance(node[key], str):
                node[key] = clean_string(node[key])
        for val in node.values():
            process_node(val)
    elif isinstance(node, list):
        for item in node:
            process_node(item)

FILES = [
    ("collections/database.mega092.js", "js"),
    ("collections/database.js", "js"),
    ("Kaptain_Nuvio_Native_mega092.json", "json"),
    ("Kaptain_Catalog_Template.mega092.json", "json")
]

for file_path, file_type in FILES:
    if not os.path.exists(file_path):
        continue
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()

    if file_type == "js":
        match = re.search(r"(window\.NUVIO_DATABASE\s*=\s*)(\[[\s\S]*?\])(;\s*)$", content)
        if match:
            prefix, json_str, suffix = match.group(1), match.group(2), match.group(3)
            data = json.loads(json_str)
            process_node(data)
            with open(file_path, "w", encoding="utf-8") as f:
                f.write(prefix + json.dumps(data, ensure_ascii=False, indent=2) + suffix)
            print(f"[OK Traité] {file_path}")
    else:
        data = json.loads(content)
        process_node(data)
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        print(f"[OK Traité] {file_path}")

print("Traitement global de tous les catalogues achevé.")

import json, re

with open("collections/database.mega092.js", "r", encoding="utf-8") as f:
    content = f.read()

match = re.search(r"window\.NUVIO_DATABASE\s*=\s*(\[[\s\S]*?\]);\s*$", content)
if not match:
    print("Erreur : impossible de lire database.mega092.js")
    exit(1)

data = json.loads(match.group(1))

print("=== ÉCHANTILLON DES SOUS-CATÉGORIES ACTUELLES ===")
count = 0
for cat in data:
    for folder in cat.get("folders", []):
        f_title = folder.get("title", "")
        sources = folder.get("sources", [])
        
        # Filtre sur les dossiers de classements ou tendances
        if any(k in f_title.lower() for k in ["top", "week", "month", "trend", "popular", "new", "semaine", "populaire"]):
            print(f"\n[Dossier] {f_title}")
            for s in sources[:3]:
                s_title = s.get("title") or s.get("name") or "Sans titre"
                print(f"   └── [Source] {s_title}")
            count += 1
            if count >= 8:
                break
    if count >= 8:
        break

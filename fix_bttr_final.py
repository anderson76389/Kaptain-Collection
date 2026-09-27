import json, re, os

COL_MAP = {
    "Streaming Services": "Plateformes de Streaming",
    "TV Networks": "Chaînes TV",
    "Genres": "Genres",
    "Moods & Vibes": "Ambiances & Émotions",
    "Based on": "Basé sur",
    "Film Collections": "Sagas & Collections",
    "Actors": "Acteurs",
    "Legendary Directors": "Réalisateurs Légendaires",
    "Studios": "Studios",
    "By Decade": "Par Décennie",
    "Decades": "Par Décennie",
    "Anime": "Animés",
    "Awards": "Récompenses",
    "International Cinema": "Cinéma International",
    "Documentaries": "Documentaires",
    "Kids & Family": "Enfants & Famille",
    "Reality TV": "Télé-Réalité"
}

FOLDER_MAP = {
    "Action": "Action",
    "Adventure": "Aventure",
    "Animation": "Animation",
    "Comedy": "Comédie",
    "Crime": "Policier",
    "Documentary": "Documentaire",
    "Drama": "Drame",
    "Family": "Famille",
    "Fantasy": "Fantastique",
    "History": "Histoire",
    "Horror": "Horreur",
    "Music": "Musique",
    "Mystery": "Mystère",
    "Romance": "Romance",
    "Sci-Fi": "Science-Fiction",
    "Science Fiction": "Science-Fiction",
    "Thriller": "Thriller",
    "War": "Guerre",
    "Western": "Western",
    "Cozy & Comforting": "Douillet & Réconfortant",
    "Mind-Bending": "Casse-tête & Mystère",
    "Adrenaline Rush": "Montée d\u0027Adrénaline",
    "Epic & Sweeping": "Épique & Grandiose",
    "Dark & Gritty": "Sombre & Brut",
    "Heartwarming": "Chaleureux & Émouvant",
    "Laugh Out Loud": "Rires Garantis",
    "Chill & Relaxed": "Détente & Évasion",
    "Edge of Your Seat": "Tension Maximale",
    "Nostalgic": "Nostalgie",
    "True Stories": "Histoires Vraies",
    "Video Games": "Jeux Vidéo",
    "Books": "Livres",
    "Comics": "Bandes Dessinées",
    "Real Life Crimes": "Crimes Réels",
    "Historical Events": "Événements Historiques",
    "Legends & Myths": "Légendes & Mythes",
    "Stage Plays": "Pièces de Théâtre",
    "Biographies": "Biographies",
    "Articles & Podcasts": "Articles & Podcasts",
    "1950s": "Années 1950",
    "1960s": "Années 1960",
    "1970s": "Années 1970",
    "1980s": "Années 1980",
    "1990s": "Années 1990",
    "2000s": "Années 2000",
    "2010s": "Années 2010",
    "2020s": "Années 2020",
    "Nature & Wildlife": "Nature & Faune",
    "Science & Technology": "Science & Technologie",
    "True Crime": "Faits Divers & Crimes",
    "Sports Stories": "Histoires de Sport",
    "Music & Concerts": "Musique & Concerts",
    "Society & Culture": "Société & Culture"
}

REPLACEMENTS = [
    (r"\s*\((?:Movies|Films)\)", " (Films)"),
    (r"\s*\((?:Series|Séries|TV Shows)\)", " (Séries)"),
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
    (r"\b(\d{4})s\s+Films\b", r"Films des années \1"),
    (r"\b(\d{4})s\s+Séries\b", r"Séries des années \1"),
    (r"\b(\d{4})s\b", r"Années \1"),
]

def clean_source(s):
    if not isinstance(s, str):
        return s
    res = s
    for pattern, repl in REPLACEMENTS:
        res = re.sub(pattern, repl, res, flags=re.IGNORECASE)
    res = re.sub(r"Films \(Films\)", "Films", res)
    res = re.sub(r"Séries \(Séries\)", "Séries", res)
    return re.sub(r"\s+", " ", res).strip()

# 1. Mise à jour des templates AIO
templates = ["Kaptain_Catalog_Template.mega092.json", "Kaptain_Catalog_Template.json"]
for tpl_path in templates:
    if not os.path.exists(tpl_path):
        continue
    with open(tpl_path, "r", encoding="utf-8") as f:
        tpl_data = json.load(f)

    entries = tpl_data if isinstance(tpl_data, list) else tpl_data.get("catalogs", [])
    
    # Purge Discover et Spotlight
    filtered = []
    for e in entries:
        col = e.get("collectionTitle", "")
        if re.search(r"discover|découverte|spotlight", col, re.IGNORECASE):
            continue
        # Alignement des 3 champs de la clé composite
        if col in COL_MAP:
            e["collectionTitle"] = COL_MAP[col]
        f_title = e.get("folderTitle", "")
        if f_title in FOLDER_MAP:
            e["folderTitle"] = FOLDER_MAP[f_title]
        if "sourceTitle" in e and isinstance(e["sourceTitle"], str):
            e["sourceTitle"] = clean_source(e["sourceTitle"])
        filtered.append(e)

    out = filtered if isinstance(tpl_data, list) else dict(tpl_data, catalogs=filtered)
    with open(tpl_path, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)
    print(f"[SUCCÈS] {tpl_path} : {len(filtered)} entrées synchronisées.")

# 2. Mise à jour de collections/preview_posters.js
poster_file = "collections/preview_posters.js"
if os.path.exists(poster_file):
    with open(poster_file, "r", encoding="utf-8") as f:
        content = f.read()
    eq = content.find("=")
    semi = content.rfind(";")
    prefix = content[:eq + 1]
    posters = json.loads(content[eq + 1:semi].strip())

    new_posters = dict(posters)
    added = 0
    for k, v in list(posters.items()):
        if "::" in k:
            f_id, orig_title = k.split("::", 1)
            fr_title = clean_source(orig_title)
            fr_key = f"{f_id}::{fr_title}"
            if fr_key not in new_posters:
                new_posters[fr_key] = v
                added += 1

    with open(poster_file, "w", encoding="utf-8") as f:
        f.write(prefix + " " + json.dumps(new_posters, ensure_ascii=False) + ";\n")
    print(f"[SUCCÈS] preview_posters.js : {added} clés Bttr françaises ajoutées.")

# 3. Cache buster dans index.html
if os.path.exists("index.html"):
    with open("index.html", "r", encoding="utf-8") as f:
        html = f.read()
    import time
    v = int(time.time())
    html = re.sub(r"collections/preview_posters\.js\?v=\d+", f"collections/preview_posters.js?v={v}", html)
    with open("index.html", "w", encoding="utf-8") as f:
        f.write(html)

# 4. Contrôle mathématique de validation
def parse_js(p):
    with open(p, "r", encoding="utf-8") as f:
        c = f.read()
    return json.loads(c[c.find("=") + 1:c.rfind(";")].strip())

db = parse_js("collections/database.mega092.js")
posters_data = parse_js("collections/preview_posters.js")
with open("Kaptain_Catalog_Template.mega092.json", "utf8") as f:
    aio_raw = json.load(f)
aio_list = aio_raw if isinstance(aio_raw, list) else aio_raw["catalogs"]
aio_index = set(f"{e.get('collectionTitle')}|||{e.get('folderTitle')}|||{e.get('sourceTitle')}" for e in aio_list)

aio_match, web_match, total = 0, 0, 0
for col in db:
    c_t = col.get("title", "")
    for fol in col.get("folders", []):
        f_id = fol.get("id", "")
        f_t = fol.get("title", "")
        for s in fol.get("sources", []):
            total += 1
            s_t = s.get("title", "")
            if f"{f_id}::{s_t}" in posters_data:
                web_match += 1
            if f"{c_t}|||{f_t}|||{s_t}" in aio_index:
                aio_match += 1

print("\n" + "="*40)
print(f"RÉSULTAT DU CONTRÔLE TECHNIQUE :")
print(f"  - Catalogues Bttr AIO reconnus  : {aio_match} / {total}")
print(f"  - Affiches Web locales résolues : {web_match}")
print("="*40)

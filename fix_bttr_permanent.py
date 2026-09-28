import json, re, os, subprocess

print("\n=== RÉPARATION SYSTÈME BTTR POSTERS ===")

# 1. Lecture de database.mega092.js
db_path = "collections/database.mega092.js" if os.path.exists("collections/database.mega092.js") else "collections/database.js"
with open(db_path, "r", encoding="utf-8") as f:
    c = f.read()

eq = c.find("=")
semi = c.rfind(";")
db = json.loads(c[eq + 1:semi].strip())

# Extraction ordonnée des sources par dossier
db_folders = {}
for col in db:
    c_title = col.get("title", "")
    if re.search(r"discover|découverte|spotlight", c_title, re.IGNORECASE):
        continue
    for fol in col.get("folders", []):
        f_title = fol.get("title", "")
        norm_key = re.sub(r"[^a-z0-9]", "", f_title.lower())
        db_folders.setdefault(norm_key, []).append({
            "colTitle": c_title,
            "folderTitle": f_title,
            "sources": fol.get("sources", [])
        })

FOLDER_ALIASES = {
    "comedie": "comedy", "comdie": "comedy", "aventure": "adventure", "policier": "crime",
    "documentaire": "documentary", "drame": "drama", "famille": "family", "fantastique": "fantasy",
    "histoire": "history", "horreur": "horror", "musique": "music", "mystere": "mystery",
    "mystre": "mystery", "romance": "romance", "sciencefiction": "scifi", "guerre": "war",
    "western": "western", "annees1950": "1950s", "annees1960": "1960s", "annees1970": "1970s",
    "annees1980": "1980s", "annees1990": "1990s", "annees2000": "2000s", "annees2010": "2010s",
    "annees2020": "2020s", "naturefaune": "naturewildlife", "sciencetechnologie": "sciencetechnology",
    "faitsdiverscrimes": "truecrime", "histoiresdesport": "sportsstories", "musiqueconcerts": "musicconcerts",
    "societeculture": "societyculture", "socitculture": "societyculture"
}

# 2. Mise à jour des templates AIO
templates = ["Kaptain_Catalog_Template.json", "Kaptain_Catalog_Template.mega092.json"]
for tpl_path in templates:
    if not os.path.exists(tpl_path):
        continue
    with open(tpl_path, "r", encoding="utf-8") as f:
        tpl_raw = json.load(f)
    entries = tpl_raw if isinstance(tpl_raw, list) else tpl_raw.get("catalogs", [])

    # Groupement des templates par dossier
    tpl_by_folder = {}
    for e in entries:
        col = e.get("collectionTitle", "")
        if re.search(r"discover|découverte|spotlight", col, re.IGNORECASE):
            continue
        f_norm = re.sub(r"[^a-z0-9]", "", e.get("folderTitle", "").lower())
        tpl_by_folder.setdefault(f_norm, []).append(e)

    new_catalog_list = []
    matched = 0

    for norm_f, folder_list in db_folders.items():
        lookup_key = FOLDER_ALIASES.get(norm_f, norm_f)
        available_tpls = tpl_by_folder.get(lookup_key, tpl_by_folder.get(norm_f, []))

        tpl_idx = 0
        for group in folder_list:
            c_title = group["colTitle"]
            f_title = group["folderTitle"]
            for s in group["sources"]:
                s_title = s.get("title") or s.get("name")
                if tpl_idx < len(available_tpls):
                    base_entry = available_tpls[tpl_idx]
                    tpl_idx += 1
                    # Entrée avec les libellés de la base
                    fr_entry = dict(base_entry)
                    fr_entry["collectionTitle"] = c_title
                    fr_entry["folderTitle"] = f_title
                    fr_entry["sourceTitle"] = s_title
                    fr_entry["name"] = s.get("name") or s_title
                    new_catalog_list.append(fr_entry)

                    # Conservation de l'entrée d'origine pour compatibilité Nuvio
                    new_catalog_list.append(base_entry)
                    matched += 1

    out = new_catalog_list if isinstance(tpl_raw, list) else dict(tpl_raw, catalogs=new_catalog_list)
    with open(tpl_path, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)
    print(f"[OK] {tpl_path} : {len(new_catalog_list)} entrées configurées ({matched} sources liées).")

# 3. Sécurisation de wizard.js
wiz_path = "wizard.js"
if os.path.exists(wiz_path):
    with open(wiz_path, "r", encoding="utf-8") as f:
        wiz_code = f.read()

    new_lookup = """  function aioBuildTemplateIndex(template) {
    const index = new Map();
    const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    (Array.isArray(template) ? template : []).forEach((entry) => {
      if (!entry) return;
      index.set(`${entry.collectionTitle}|||${entry.folderTitle}|||${entry.sourceTitle}`, entry);
      const normKey = `${norm(entry.collectionTitle)}|||${norm(entry.folderTitle)}|||${norm(entry.sourceTitle)}`;
      index.set(normKey, entry);
      const partialKey = `${norm(entry.folderTitle)}|||${norm(entry.sourceTitle)}`;
      if (!index.has(partialKey)) index.set(partialKey, entry);
    });
    index._norm = norm;
    return index;
  }

  function aioTemplateLookup(templateIndex, colTitle, folderTitle, sourceTitle) {
    if (!templateIndex) return null;
    let hit = templateIndex.get(`${colTitle}|||${folderTitle}|||${sourceTitle}`);
    if (hit) return hit;
    if (templateIndex._norm) {
      const norm = templateIndex._norm;
      hit = templateIndex.get(`${norm(colTitle)}|||${norm(folderTitle)}|||${norm(sourceTitle)}`);
      if (hit) return hit;
      hit = templateIndex.get(`${norm(folderTitle)}|||${norm(sourceTitle)}`);
      if (hit) return hit;
    }
    return null;
  }"""

    pattern = r"function\s+aioBuildTemplateIndex\s*\(template\)\s*\{[\s\S]*?function\s+aioTemplateLookup\s*\(templateIndex,\s*colTitle,\s*folderTitle,\s*sourceTitle\)\s*\{[\s\S]*?return\s+templateIndex\.get\([^)]+\)\s*\|\|\s*null;\s*\}"
    if re.search(pattern, wiz_code):
        wiz_code = re.sub(pattern, new_lookup, wiz_code)
        with open(wiz_path, "w", encoding="utf-8") as f:
            f.write(wiz_code)
        print("[OK] wizard.js : aioTemplateLookup tolérant aux variantes injecté.")

# 4. Invalidation de cache index.html
if os.path.exists("index.html"):
    with open("index.html", "r", encoding="utf-8") as f:
        html = f.read()
    import time
    v = int(time.time())
    html = re.sub(r"(wizard\.js\?v=)[0-9]+", f"\\g<1>{v}", html)
    html = re.sub(r"(Kaptain_Catalog_Template\.json\?v=)[0-9]+", f"\\g<1>{v}", html)
    with open("index.html", "w", encoding="utf-8") as f:
        f.write(html)
    print(f"[OK] index.html : Cache buster actualisé sur v={v}.")

# 5. Déploiement Git avec affichage direct
print("\n--- SYNCHRONISATION GIT ---")
subprocess.run(["git", "add", "-A"])
res_commit = subprocess.run(["git", "commit", "-m", "Reparation definitive Bttr Posters et securisation Wizard"], text=True, capture_output=True)
print(res_commit.stdout.strip() if res_commit.stdout else res_commit.stderr.strip())
res_push = subprocess.run(["git", "push", "origin", "main"], text=True, capture_output=True)
print(res_push.stdout.strip() if res_push.stdout else res_push.stderr.strip())

print("\nOpération terminée.")

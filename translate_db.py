import json, re

with open("locales/fr.json", "r", encoding="utf-8") as f:
    translations = json.load(f)

with open("collections/database.js", "r", encoding="utf-8") as f:
    content = f.read()

match = re.search(r"window\.NUVIO_DATABASE\s*=\s*(\[[\s\S]*?\]);\s*$", content)
if not match:
    raise ValueError("Impossible de parser database.js")

data = json.loads(match.group(1))

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

translate_node(data)

with open("collections/database.js", "w", encoding="utf-8") as f:
    f.write(f"window.NUVIO_DATABASE = {json.dumps(data, ensure_ascii=False, indent=2)};\n")

print("Execution terminee : collections/database.js a ete traduit.")

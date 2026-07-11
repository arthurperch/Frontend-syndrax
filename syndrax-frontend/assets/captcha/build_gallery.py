import json, os
from pathlib import Path

# B2 security-cleanup 2026-06-23: replaced hardcoded absolute path with script-relative path
os.chdir(Path(__file__).parent)

with open("manifest.json") as f:
    manifest = json.load(f)

cats = manifest["categories"]

# Check files on disk vs manifest — include dirs not in manifest
extra = {}
all_dirs_with_images = set()
for d in sorted(os.listdir(".")):
    dpath = os.path.join(".", d)
    if os.path.isdir(dpath):
        on_disk = set(f for f in os.listdir(dpath) if f.endswith(('.png','.jpg','.jpeg')))
        if not on_disk:
            continue
        all_dirs_with_images.add(d)
        in_manifest = set(p.split("/")[-1] for p in cats.get(d, []))
        extras = sorted(on_disk - in_manifest)
        if extras:
            extra[d] = extras

# Merge: all dirs with images (manifest keys + disk-only dirs)
cat_names = sorted(all_dirs_with_images)
# Ensure manifest-only cats appear even if dir is missing
for c in cats:
    if c not in cat_names and cats[c]:
        cat_names.append(c)
        cat_names.sort()
total = 0

# Pre-compute
cat_images = {}
for cat in cat_names:
    manifest_paths = cats.get(cat, [])
    images = [p.split("/")[-1] for p in manifest_paths]
    if cat in extra:
        images.extend(extra[cat])
    images = sorted(set(images))
    cat_images[cat] = images
    total += len(images)

lines = []
lines.append("""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Captcha Image Gallery - by class</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: system-ui, -apple-system, sans-serif; background:#0f172a; color:#e2e8f0; padding:24px; }
  h1 { font-size:1.5rem; margin-bottom:4px; }
  .summary { color:#94a3b8; margin-bottom:20px; font-size:0.92rem; }
  .category { margin-bottom:32px; }
  .cat-header { display:flex; align-items:center; gap:10px; margin-bottom:12px; position:sticky; top:0; background:#0f172a; padding:8px 0; z-index:10; border-bottom:1px solid #1e293b; cursor:pointer; user-select:none; }
  .cat-header h2 { font-size:1.15rem; font-weight:600; text-transform:capitalize; }
  .cat-header .count { background:#334155; color:#94a3b8; font-size:0.78rem; padding:2px 10px; border-radius:10px; }
  .grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(150px, 1fr)); gap:10px; }
  .tile { background:#1e293b; border-radius:8px; overflow:hidden; aspect-ratio:1; display:flex; align-items:center; justify-content:center; position:relative; }
  .tile img { width:100%; height:100%; object-fit:cover; display:block; }
  .tile .label { position:absolute; bottom:0; left:0; right:0; background:rgba(0,0,0,0.6); color:#94a3b8; font-size:0.65rem; padding:2px 6px; text-align:center; }
  .filter-bar { margin-bottom:20px; }
  .filter-bar input { background:#1e293b; border:1px solid #334155; color:#e2e8f0; padding:6px 14px; border-radius:6px; font-size:0.88rem; width:240px; outline:none; }
  .filter-bar input:focus { border-color:#6366f1; }
  .collapsed .grid { display:none; }
</style>
</head>
<body>
<h1>Captcha Image Gallery</h1>
""")

lines.append(f'<div class="summary">{total} images across {len(cat_names)} classes - click a category header to collapse it</div>')
lines.append('<div class="filter-bar"><input type="text" id="filter" placeholder="Filter categories..." oninput="filterCats()"></div>')

for cat in cat_names:
    images = cat_images[cat]
    label = cat.replace('_', ' ')
    lines.append(f'<div class="category" data-cat="{cat}">')
    lines.append(f'  <div class="cat-header" onclick="this.parentElement.classList.toggle(\'collapsed\')">')
    lines.append(f'    <h2>{label}</h2>')
    lines.append(f'    <span class="count">{len(images)} images</span>')
    lines.append(f'  </div>')
    lines.append(f'  <div class="grid">')
    for img in images:
        src = f"{cat}/{img}"
        lines.append(f'    <div class="tile" title="{img}"><img src="{src}" loading="lazy"><div class="label">{img}</div></div>')
    lines.append(f'  </div>')
    lines.append(f'</div>')

lines.append("""
<script>
function filterCats() {
  var q = document.getElementById('filter').value.toLowerCase();
  document.querySelectorAll('.category').forEach(function(el) {
    var cat = el.dataset.cat.replace(/_/g, ' ');
    el.style.display = q && !cat.includes(q) ? 'none' : '';
  });
}
</script>
</body>
</html>""")

# B2 security-cleanup 2026-06-23: replaced hardcoded absolute path with script-relative path
outpath = Path(__file__).parent / "gallery.html"
with open(outpath, "w", encoding="utf-8") as f:
    f.write("\n".join(lines))

print(f"OK - {outpath}")
print(f"{total} images across {len(cat_names)} classes")
for cat in cat_names:
    print(f"  {cat}: {len(cat_images[cat])} images")

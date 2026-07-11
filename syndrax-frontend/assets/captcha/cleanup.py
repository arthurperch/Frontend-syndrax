import os, shutil, json
from pathlib import Path

# B2 security-cleanup 2026-06-23: replaced hardcoded absolute path with script-relative path
DEST = Path(__file__).parent
os.chdir(DEST)

# === RENAME MAP: long names -> short slugs ===
RENAME = {
    'find_unique_object': 'unique_object',
    'please_click_on_the_head_of_the_animal': 'animal_head_variants',
    'please_click_on_the_largest_animal': 'largest_animal',
    'please_click_on_the_object_that_appears_only_once': 'appears_once',
    'please_click_on_the_star_with_a_texture_of_bricks': 'star_bricks_variants',
    'please_click_the_center_of_a_circle_where_all_the_shapes_are_of_the_same_color': 'same_color_circle',
    'please_click_the_center_of_the_object_that_is_never_repeated': 'never_repeated',
    'select_the_most_accurate_description_of_the_image': 'image_description',
}

# === MERGE: these dirs get absorbed into another ===
MERGE = {
    'polarbearonthesnow': 'polar_bear',
    'zebraonthedesert': 'zebra',
    'star_bricks_variants': 'star_bricks',
    'animal_head_variants': 'animal_head',
    'largest_animal': 'rabbit',  # contains rabbit/hedgehog/raccoon pics
}

# Step 1: Rename
for old, new in RENAME.items():
    oldp = os.path.join(DEST, old)
    newp = os.path.join(DEST, new)
    if os.path.isdir(oldp) and not os.path.exists(newp):
        os.rename(oldp, newp)
        print(f"  renamed: {old} -> {new}")

# Step 2: Merge
for src, dst in MERGE.items():
    srcp = os.path.join(DEST, src)
    dstp = os.path.join(DEST, dst)
    if os.path.isdir(srcp):
        os.makedirs(dstp, exist_ok=True)
        merged = 0
        for f in os.listdir(srcp):
            if f.endswith(('.png','.jpg','.jpeg')):
                s = os.path.join(srcp, f)
                d = os.path.join(dstp, f)
                if not os.path.exists(d):
                    shutil.copy2(s, d)
                merged += 1
        print(f"  merged: {src} -> {dst} ({merged} files)")
        shutil.rmtree(srcp)

# Step 3: Remove empty dirs
for d in sorted(os.listdir('.')):
    dp = os.path.join('.', d)
    if os.path.isdir(dp):
        files = [f for f in os.listdir(dp) if f.endswith(('.png','.jpg','.jpeg'))]
        if not files:
            os.rmdir(dp)
            print(f"  removed empty: {d}")

print("\n=== FINAL STATE ===")
cats = {}
for d in sorted(os.listdir('.')):
    dp = os.path.join('.', d)
    if os.path.isdir(dp):
        files = sorted([f for f in os.listdir(dp) if f.endswith(('.png','.jpg','.jpeg'))])
        if files:
            cats[d] = [f"/assets/captcha/{d}/{f}" for f in files]
            print(f"  {d}: {len(files)} images")

total = sum(len(v) for v in cats.values())
print(f"\nTotal: {total} images across {len(cats)} classes")

# Step 4: Write manifest
manifest = {"categories": cats, "total_tiles": total}
with open("manifest.json", "w") as f:
    json.dump(manifest, f, indent=2)
print("manifest.json updated")

# Step 5: Rebuild gallery
from build_gallery import build_gallery  # nah just inline it
# We'll run build_gallery.py separately

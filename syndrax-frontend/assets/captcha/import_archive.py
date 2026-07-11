import os, shutil, json, re
from collections import defaultdict
from pathlib import Path

# B2 security-cleanup 2026-06-23: replaced hardcoded absolute paths with script-relative paths
ARCHIVE = Path(__file__).parent.parent.parent.parent / "hcaptcha-challenger-main" / "archive" / "assets"
DEST = Path(__file__).parent
os.chdir(DEST)

# 1. Walk archive and collect all images by leaf directory
archive_images = defaultdict(list)
for root, dirs, files in os.walk(ARCHIVE):
    imgs = [f for f in files if f.endswith(('.png','.jpg','.jpeg'))]
    if imgs:
        # Get relative path from ARCHIVE
        rel = os.path.relpath(root, ARCHIVE)
        archive_images[rel].extend(imgs)

print(f"Found {sum(len(v) for v in archive_images.values())} images in {len(archive_images)} leaf dirs")

# 2. Map archive paths to clean category names
# Strategy: use the deepest meaningful directory name
def clean_name(path):
    """Convert archive path to a clean category slug"""
    # Skip 'default' subdirs - use parent
    parts = [p for p in path.replace('\\', '/').split('/') if p and p != 'default']
    # Take the most specific part
    name = parts[-1] if parts else path
    # Clean up
    name = name.lower().strip()
    name = re.sub(r'[^a-z0-9]+', '_', name)
    name = name.strip('_')
    return name if name else 'unknown'

# Map: clean_name -> list of (source_abs_path, filename)
collected = defaultdict(list)
for rel_path, files in archive_images.items():
    cname = clean_name(rel_path)
    src_dir = os.path.join(ARCHIVE, rel_path)
    for f in files:
        collected[cname].append((os.path.join(src_dir, f), f))

# Filter out empty/synthetic categories we don't want
SKIP = {'number', 'default', 'record_json'}  # number is synthetic digits - bad for Gemini
# Also skip categories we already have enough of (>20 images)
EXISTING_GOOD_ENOUGH = {'bicycle', 'elephant', 'raccoon', 'diamond_bracelet', 
                         'streetlamp', 'off_road_vehicle', 'star_bricks'}

print(f"\nCategories to import:")
for name in sorted(collected):
    if name in SKIP:
        continue
    count = len(collected[name])
    status = "SKIP (enough)" if name in EXISTING_GOOD_ENOUGH else "IMPORT"
    print(f"  {name}: {count} images - {status}")

# 3. Copy to destination
imported = 0
for name, items in sorted(collected.items()):
    if name in SKIP or name in EXISTING_GOOD_ENOUGH:
        continue
    dest_dir = os.path.join(DEST, name)
    os.makedirs(dest_dir, exist_ok=True)
    for src_path, fname in items:
        dst_path = os.path.join(dest_dir, fname)
        if not os.path.exists(dst_path):
            shutil.copy2(src_path, dst_path)
            imported += 1

print(f"\nCopied {imported} new images")

# 4. Also grab larger-animal variants (polarbear, zebra - merge under existing dirs)
MERGE_MAP = {
    'polarbearonthesnow': 'polar_bear',
    'zebraonthedesert': 'zebra',
}
for src_name, dest_name in MERGE_MAP.items():
    if src_name in collected:
        dest_dir = os.path.join(DEST, dest_name)
        os.makedirs(dest_dir, exist_ok=True)
        for src_path, fname in collected[src_name]:
            dst_path = os.path.join(dest_dir, fname)
            if not os.path.exists(dst_path):
                shutil.copy2(src_path, dst_path)
                imported += 1
        print(f"  Merged {src_name} -> {dest_name}: {len(collected[src_name])} images")

print(f"\nTotal imported: {imported} images")

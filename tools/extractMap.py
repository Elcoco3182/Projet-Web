import json
import numpy as np
from PIL import Image
from scipy import ndimage
from collections import defaultdict

# 1. Chargement de l'image complète
img = Image.open('map.png')
arr = np.array(img)

# On applique le traitement sur toute la largeur de l'image (4000px)
region = arr[:, :] 

# 2. Masque pour isoler la couleur rouge des murs
red_mask = (region[:,:,0] > 150) & (region[:,:,1] < 80) & (region[:,:,2] < 80)
H, W = red_mask.shape

gs = 25
gH = H // gs + 1
gW = W // gs + 1
grid = np.zeros((gH, gW), dtype=bool)

# 3. Discrétisation dans la grille de 25x25
for gy in range(gH):
    for gx in range(gW):
        y0, x0 = gy*gs, gx*gs
        y1, x1 = min(y0+gs, H), min(x0+gs, W)
        cell = red_mask[y0:y1, x0:x1]
        if cell.size > 0 and cell.mean() > 0.3:
            grid[gy, gx] = True

# 4. Labellisation des formes connectées
labeled, num = ndimage.label(grid)
rects = []

for i in range(1, num+1):
    ys, xs = np.where(labeled == i)
    cells = set(zip(ys.tolist(), xs.tolist()))
        
    h_span = ys.max() - ys.min() + 1
    w_span = xs.max() - xs.min() + 1
        
    if h_span == 1:
        # Mur horizontal pur
        gx0, gx1 = xs.min(), xs.max()
        gy0 = ys.min()
        rects.append([int(gx0*gs), int(gy0*gs), int((gx1-gx0+1)*gs), gs])
    elif w_span == 1:
        # Mur vertical pur
        gy0, gy1 = ys.min(), ys.max()
        gx0 = xs.min()
        rects.append([int(gx0*gs), int(gy0*gs), gs, int((gy1-gy0+1)*gs)])
    else:
        # Forme complexe (angles, intersections) -> découpage par lignes de 25px
        unique_ys = sorted(set(ys.tolist()))
        for gy in unique_ys:
            row_xs = sorted([x for (y,x) in cells if y == gy])
            if not row_xs:
                continue
            run_start = row_xs[0]
            prev = row_xs[0]
            for gx in row_xs[1:] + [None]:
                if gx is None or gx > prev + 1:
                    rects.append([int(run_start*gs), int(gy*gs), int((prev-run_start+1)*gs), gs])
                    if gx is not None:
                        run_start = gx
                prev = gx if gx is not None else prev

# 5. Déduplication des rectangles bruts
unique_rects = []
seen = set()
for r in rects:
    key = tuple(r)
    if key not in seen:
        seen.add(key)
        unique_rects.append(r)

# 6. fusion verticale (Le "Merge Vertical" que tu avais planifié)
# On regroupe les rectangles par leurs propriétés (X, Largeur)
groups = defaultdict(list)
for r in unique_rects:
    x, y, w, h = r
    groups[(x, w)].append((y, h))

final_rects = []
for (x, w), y_h_list in groups.items():
    # On trie par coordonnée Y pour fusionner de haut en bas
    y_h_list.sort(key=lambda item: item[0])
    
    current_y, current_h = y_h_list[0]
    for next_y, next_h in y_h_list[1:]:
        # Si le rectangle suivant touche exactement le bas du rectangle actuel
        if next_y == current_y + current_h:
            current_h += next_h  # On l'agrandit verticalement
        else:
            final_rects.append([x, current_y, w, current_h])
            current_y, current_h = next_y, next_h
    final_rects.append([x, current_y, w, current_h])

# 7. Tri final pour la clarté (par Y puis par X)
final_rects.sort(key=lambda x: (x[1], x[0]))

# --- AFFICHAGE ET EXPORT ---
print(f"Nombre de rectangles après fusion : {len(final_rects)}")
print("\n[")
for r in final_rects:
    print(f"  {r},")
print("]")

# Optionnel : Sauvegarder dans un fichier JSON pour ton système de dessin
with open('rectangles.json', 'w') as f:
    json.dump(final_rects, f, indent=2)

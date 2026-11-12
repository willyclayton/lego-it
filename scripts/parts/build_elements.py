"""
Map the app's parts and colours to real LEGO elements, using Rebrickable's public
catalog (https://rebrickable.com/downloads/: parts.csv, colors.csv, elements.csv).

  python3 scripts/parts/build_elements.py <dir with the unzipped csv files>

Writes src/lego/elements.json:
  parts:  app part id -> catalog part number (Rebrickable / BrickLink style)
  colors: app colour key -> Rebrickable colour id
  el:     "part|colour" -> LEGO element id (the number Pick a Brick uses), for every
          combination LEGO has produced
  sub:    "part|colour" -> colour to order instead, for combinations never produced
"""
import csv, json, os, re, sys
from collections import defaultdict

D = sys.argv[1]
REPO = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
src = open(os.path.join(REPO, 'src/lego/parts.ts')).read()
our_parts = re.findall(r"^\s*P\('([0-9a-z]+)'", src, re.M)
csrc = open(os.path.join(REPO, 'src/lego/colors.ts')).read()
our_colors = [(m[0], int(m[1]), m[2]) for m in re.findall(r"C\('([a-z-]+)', '[^']*', '[^']*', (\d+), \d+, '#([0-9A-Fa-f]{6})'", csrc)]

parts = {r['part_num']: r for r in csv.DictReader(open(os.path.join(D, 'parts.csv')))}
cols = {int(r['id']): r for r in csv.DictReader(open(os.path.join(D, 'colors.csv')))}
el = defaultdict(dict)  # part -> colour -> [element ids]
for r in csv.DictReader(open(os.path.join(D, 'elements.csv'))):
    el[r['part_num']].setdefault(int(r['color_id']), []).append(r['element_id'])

# LDraw colour numbers are Rebrickable's colour ids except for these
COLOR_FIX = {324: 30, 330: 326}  # Medium Lavender, Olive Green
# parts whose plain number is not a catalog number: the current mould
PART_FIX = {'4073': '6141', '3794': '15573', '2454': '2454b', '3040': '3040b', '3044': '3044c', '3942': '3942c', '3957': '3957a', '4032': '4032a'}
# other moulds of the same part that build the same way, tried when the main one was never made in a colour
ALT = {'6141': ['4073'], '15573': ['3794b', '3794a'], '2454b': ['2454a'], '3044c': ['3044b'], '3957a': ['3957b'], '4032a': ['4032b'],
       '3069b': ['3069a'], '3070b': ['3070a'], '3068b': ['3068a'], '2412b': ['2412a'], '3062b': ['3062a'], '2453b': ['2453a']}

pmap, problems = {}, []
for p in our_parts:
    rb = PART_FIX.get(p, p)
    if rb not in parts: problems.append(p); continue
    pmap[p] = rb
cmap = {}
for key, ld, hexv in our_colors:
    cid = COLOR_FIX.get(ld, ld)
    if cid not in cols: problems.append(key); continue
    cmap[key] = cid

METAL = {'chrome-silver', 'flat-silver', 'pearl-gold'}
# what to order instead, in order of preference, when a colour was never made in that part
PREFER = {'chrome-silver': ['flat-silver', 'lbg'], 'flat-silver': ['lbg', 'dbg'], 'pearl-gold': ['dark-tan', 'tan', 'medium-nougat'],
          'trans-black': ['black', 'dbg'], 'trans-clear': ['white', 'lbg'], 'trans-light-blue': ['trans-clear', 'medium-azure', 'white'],
          'trans-dark-blue': ['dark-blue', 'blue'], 'trans-red': ['red'], 'trans-yellow': ['yellow'], 'trans-orange': ['orange'],
          'lbg': ['white', 'dbg', 'tan'], 'dbg': ['black', 'lbg'], 'reddish-brown': ['dark-brown', 'dark-red', 'dark-orange'],
          'dark-brown': ['reddish-brown', 'black'], 'dark-tan': ['tan', 'medium-nougat'], 'sand-blue': ['medium-blue', 'dbg'],
          'medium-azure': ['dark-azure', 'medium-blue'], 'dark-green': ['green', 'sand-green', 'black'], 'sand-green': ['lbg']}
def rgb(h): return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))
def dist(a, b):
    (r1, g1, b1), (r2, g2, b2) = rgb(a), rgb(b)
    rm = (r1 + r2) / 2
    return ((2 + rm / 256) * (r1 - r2) ** 2 + 4 * (g1 - g2) ** 2 + (2 + (255 - rm) / 256) * (b1 - b2) ** 2) ** 0.5

out_el, out_sub = {}, {}
key_of = {cid: key for key, cid in cmap.items()}
out_part = {}
for p, rb in pmap.items():
    moulds = [rb] + [m for m in ALT.get(rb, []) if m in el]
    for key, cid in cmap.items():
        found = next(((m, el[m][cid]) for m in moulds if cid in el.get(m, {})), None)
        if found:
            m, ids = found
            # the newest element id is the one still sold
            out_el[f'{p}|{key}'] = max(ids, key=int)
            if m != rb: out_part[f'{p}|{key}'] = m
            continue
        has = lambda c2: any(c2 in el.get(m, {}) for m in moulds)
        pref = next((k2 for k2 in PREFER.get(key, []) if k2 in cmap and has(cmap[k2])), None)
        if pref: out_sub[f'{p}|{key}'] = pref; continue
        trans = cols[cid]['is_trans'] == 'True'
        best = None
        for k2, c2 in cmap.items():
            if not has(c2) or (cols[c2]['is_trans'] == 'True') != trans: continue
            d = dist(cols[cid]['rgb'], cols[c2]['rgb'])
            if key in METAL: d *= 0.35 if k2 in METAL else 1.0       # a metal stays metal where it can
            elif k2 in METAL: d *= 3.0                               # and plain colours don't turn metallic
            if best is None or d < best[0]: best = (d, k2)
        if best: out_sub[f'{p}|{key}'] = best[1]

json.dump({'source': 'Rebrickable catalog downloads', 'parts': pmap, 'colors': cmap, 'el': out_el, 'sub': out_sub, 'mould': out_part},
          open(os.path.join(REPO, 'src/lego/elements.json'), 'w'), separators=(',', ':'), sort_keys=True)
print('parts mapped %d/%d, colours %d/%d, elements %d, substitutions %d, unknown: %s' % (len(pmap), len(our_parts), len(cmap), len(our_colors), len(out_el), len(out_sub), problems))

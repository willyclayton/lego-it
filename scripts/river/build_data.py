"""
Build the Chicago River tour world from OpenStreetMap data.

  python3 scripts/river/fetch_osm.py <data_dir>     # downloads map tiles (needs waterlines.json, see README)
  python3 scripts/river/build_data.py <data_dir>    # writes public/river/ground.png + src/river/data/*.json

The world is a grid of 4 m cells (one LEGO stud = 4 m, about 1:500), north up:
  column i = metres east of the west edge / 4,  row j = metres south of the north edge / 4.
Map data (c) OpenStreetMap contributors, ODbL. The files this script writes are a
derived database under the same licence.
"""
import glob, json, math, os, pickle, re, sys
from collections import defaultdict
import xml.etree.ElementTree as ET
import numpy as np
from PIL import Image, ImageDraw

DATA = sys.argv[1]
REPO = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
CELL = 4.0
LATN, LATS, LONW, LONE = 41.918, 41.846, -87.672, -87.584
LAT0 = 41.8864
KX = 111412.84 * math.cos(math.radians(LAT0)) - 93.5 * math.cos(3 * math.radians(LAT0)) + 0.118 * math.cos(5 * math.radians(LAT0))
KY = 111132.92 - 559.82 * math.cos(2 * math.radians(LAT0)) + 1.175 * math.cos(4 * math.radians(LAT0))
W = int(math.ceil((LONE - LONW) * KX / CELL))
H = int(math.ceil((LATN - LATS) * KY / CELL))

def px(lat, lon):
    """lat/lon -> fractional cell coordinates (x east, y south)."""
    return ((lon - LONW) * KX / CELL, (LATN - lat) * KY / CELL)

# ------------------------------------------------------------------ load
pk = os.path.join(DATA, 'all.pkl')
if os.path.exists(pk):
    nodes, ways, rels, nodetags = pickle.load(open(pk, 'rb'))
else:
    nodes, ways, rels, nodetags = {}, {}, {}, {}
    for f in sorted(glob.glob(os.path.join(DATA, 'tiles', '*.xml'))):
        for ev, el in ET.iterparse(f, events=('end',)):
            if el.tag == 'node':
                i = int(el.get('id')); nodes[i] = (float(el.get('lat')), float(el.get('lon')))
                if len(el):
                    t = {c.get('k'): c.get('v') for c in el if c.tag == 'tag'}
                    if t.get('name'): nodetags[i] = t
                el.clear()
            elif el.tag == 'way':
                i = int(el.get('id'))
                if i not in ways: ways[i] = ([int(c.get('ref')) for c in el if c.tag == 'nd'], {c.get('k'): c.get('v') for c in el if c.tag == 'tag'})
                el.clear()
            elif el.tag == 'relation':
                i = int(el.get('id'))
                if i not in rels: rels[i] = ([(c.get('type'), int(c.get('ref')), c.get('role')) for c in el if c.tag == 'member'], {c.get('k'): c.get('v') for c in el if c.tag == 'tag'})
                el.clear()
    pickle.dump((nodes, ways, rels, nodetags), open(pk, 'wb'))
print('loaded: nodes %d ways %d relations %d | grid %d x %d cells' % (len(nodes), len(ways), len(rels), W, H))

def wpts(wid):
    nd = ways[wid][0]
    return [px(*nodes[n]) for n in nd if n in nodes]
def complete(wid): return wid in ways and all(n in nodes for n in ways[wid][0])
def closed(wid): nd = ways[wid][0]; return len(nd) > 3 and nd[0] == nd[-1]

def rings_of(rid, roles=('outer', '')):
    """Assemble closed rings from a multipolygon's member ways (only complete rings are returned)."""
    segs = [list(ways[r][0]) for typ, r, role in rels[rid][0] if typ == 'way' and role in roles and complete(r)]
    rings = []
    while segs:
        cur = segs.pop(0)
        changed = True
        while cur[0] != cur[-1] and changed:
            changed = False
            for k, s in enumerate(segs):
                if s[0] == cur[-1]: cur += s[1:]; segs.pop(k); changed = True; break
                if s[-1] == cur[-1]: cur += s[-2::-1]; segs.pop(k); changed = True; break
                if s[-1] == cur[0]: cur = s[:-1] + cur; segs.pop(k); changed = True; break
                if s[0] == cur[0]: cur = s[:0:-1] + cur; segs.pop(k); changed = True; break
        if cur[0] == cur[-1] and len(cur) > 3: rings.append([px(*nodes[n]) for n in cur])
    return rings

# ------------------------------------------------------------------ coverage
cover = Image.new('L', (W, H), 0)
dc = ImageDraw.Draw(cover)
for f in glob.glob(os.path.join(DATA, 'tiles', '*.xml')):
    a = os.path.basename(f)[4:-4].split('_')
    lo0, la0, lo1, la1 = map(float, a)
    (x0, y1), (x1, y0) = px(la0, lo0), px(la1, lo1)
    dc.rectangle([x0, y0, x1 - 1, y1 - 1], fill=1)
cover = np.array(cover, dtype=np.uint8)

# ------------------------------------------------------------------ ground classes
VOID, LAKE, RIVER, LAND, ROAD, PARK, PLAZA, RAIL, SAND, STONE = range(10)
img = Image.fromarray(np.where(cover > 0, LAND, VOID).astype(np.uint8), 'L')
d = ImageDraw.Draw(img)

def fill_poly(pts, cls):
    if len(pts) >= 3: d.polygon(pts, fill=cls)

# parks, grass, beaches, rail yards
for wid, (nd, t) in ways.items():
    if not complete(wid) or not closed(wid): continue
    if t.get('leisure') in ('park', 'garden', 'pitch', 'dog_park', 'playground', 'golf_course') or t.get('landuse') in ('grass', 'cemetery', 'meadow', 'village_green', 'recreation_ground') or t.get('natural') in ('wood', 'grassland', 'scrub'):
        fill_poly(wpts(wid), PARK)
    elif t.get('natural') == 'beach': fill_poly(wpts(wid), SAND)
    elif t.get('landuse') == 'railway': fill_poly(wpts(wid), RAIL)
for rid, (m, t) in rels.items():
    if t.get('type') == 'multipolygon' and (t.get('leisure') in ('park', 'garden') or t.get('landuse') == 'grass'):
        for r in rings_of(rid): fill_poly(r, PARK)

# streets (bridges over water are 3D objects, drawn by the app; they are masked out by the water fill below)
ROADW = {'motorway': 5, 'trunk': 5, 'primary': 4, 'secondary': 4, 'tertiary': 3, 'residential': 3, 'unclassified': 3, 'motorway_link': 3, 'trunk_link': 3, 'primary_link': 3, 'secondary_link': 3, 'tertiary_link': 3, 'living_street': 2, 'busway': 2}
for wid, (nd, t) in ways.items():
    hw = t.get('highway')
    if not hw or t.get('tunnel') in ('yes', 'building_passage') or t.get('area') == 'yes' or not complete(wid): continue
    if hw == 'pedestrian' and closed(wid): fill_poly(wpts(wid), PLAZA); continue
    w = ROADW.get(hw)
    if w is None: continue
    if t.get('oneway') == 'yes' and hw in ('motorway', 'trunk', 'primary'): w = max(3, w - 1)
    d.line(wpts(wid), fill=ROAD, width=w)
for wid, (nd, t) in ways.items():
    if t.get('highway') in ('pedestrian', 'footway') and t.get('area') == 'yes' and complete(wid) and closed(wid): fill_poly(wpts(wid), PLAZA)
# ground-level railways
for wid, (nd, t) in ways.items():
    if t.get('railway') == 'rail' and t.get('tunnel') != 'yes' and complete(wid): d.line(wpts(wid), fill=RAIL, width=1)

# ---- water: draw every bank line as a barrier, then flood-fill from points known to be water
bar = Image.fromarray(np.where(cover > 0, 0, 254).astype(np.uint8), 'L')
db = ImageDraw.Draw(bar)
water_member = set()
for rid, (m, t) in rels.items():
    if t.get('natural') == 'water' and t.get('type') == 'multipolygon':
        for typ, r, role in m:
            if typ == 'way' and r in ways: water_member.add(r)
for wid in water_member:
    p = wpts(wid)
    if len(p) >= 2: db.line(p, fill=255, width=1)
closed_water = [wid for wid, (nd, t) in ways.items() if t.get('natural') == 'water' and complete(wid) and closed(wid) and wid not in water_member]
for wid in closed_water: db.line(wpts(wid), fill=255, width=1)

def flood(seeds, value):
    n = 0
    for (x, y) in seeds:
        xi, yi = int(x), int(y)
        if 0 <= xi < W and 0 <= yi < H and bar.getpixel((xi, yi)) == 0:
            ImageDraw.floodfill(bar, (xi, yi), value); n += 1
    return n
river_seeds = []
for wid, (nd, t) in ways.items():
    if t.get('waterway') in ('river', 'canal') and t.get('tunnel') != 'yes':
        p = [px(*nodes[n]) for n in nd if n in nodes]
        for a, b in zip(p, p[1:]):
            k = max(1, int(math.hypot(b[0] - a[0], b[1] - a[1]) / 3))
            river_seeds += [(a[0] + (b[0] - a[0]) * i / k, a[1] + (b[1] - a[1]) * i / k) for i in range(k + 1)]
flood([px(41.8890, -87.5870), px(41.8790, -87.6050), px(41.8960, -87.6000)], 1)   # open lake, harbor south, north of the pier
flood(river_seeds, 2)
for wid in closed_water:                                   # slips, basins, the lock chamber, fountains
    p = wpts(wid); cx, cy = sum(q[0] for q in p) / len(p), sum(q[1] for q in p) / len(p)
    t = ways[wid][1]
    if t.get('water') in ('reflecting_pool', 'fountain', 'pond', 'pool') or (t.get('name') or '').startswith(('Pool', 'Fountain')) or 'Fountain' in (t.get('name') or ''):
        continue
    db.polygon(p, fill=2)
# water multipolygons whose rings are complete (harbours, river sections) can be filled directly
for rid, (m, t) in rels.items():
    if t.get('natural') == 'water' and t.get('type') == 'multipolygon' and t.get('water') in ('harbour', 'river', 'canal', 'basin', 'lock'):
        val = 1 if t.get('water') == 'harbour' else 2
        for r in rings_of(rid, roles=('outer', '')): db.polygon(r, fill=val)
        for r in rings_of(rid, roles=('inner',)): db.polygon(r, fill=0)
barr = np.array(bar)
g = np.array(img)
g[barr == 1] = LAKE
g[barr == 2] = RIVER
print('water cells: lake %d, river %d (%.1f%% of covered area)' % ((g == LAKE).sum(), (g == RIVER).sum(), 100.0 * ((g == LAKE) | (g == RIVER)).sum() / max(1, (cover > 0).sum())))
img = Image.fromarray(g, 'L'); d = ImageDraw.Draw(img)

# piers, quays and breakwaters sit on top of the water
for wid, (nd, t) in ways.items():
    mm = t.get('man_made')
    if mm in ('pier', 'quay') and complete(wid):
        if closed(wid): fill_poly(wpts(wid), PLAZA)
        else:
            try: wm = float(re.match(r'[\d.]+', t.get('width', '')).group())
            except Exception: wm = 4.0
            d.line(wpts(wid), fill=PLAZA, width=max(1, int(round(wm / CELL))))
    elif mm in ('breakwater', 'groyne') and complete(wid):
        if closed(wid): fill_poly(wpts(wid), STONE)
        else: d.line(wpts(wid), fill=STONE, width=2)
for rid, (m, t) in rels.items():
    if t.get('type') == 'multipolygon' and t.get('man_made') in ('pier', 'quay'):
        for r in rings_of(rid): fill_poly(r, PLAZA)
g = np.array(img)
g[cover == 0] = VOID

PAL = [(20, 20, 24), (54, 174, 191), (58, 150, 150), (160, 165, 169), (108, 110, 104), (75, 159, 74), (228, 205, 158), (149, 138, 115), (240, 220, 170), (120, 120, 120)]
out = Image.fromarray(g, 'P'); out.putpalette(sum(PAL, ()) + (0,) * (768 - 3 * len(PAL)))
os.makedirs(os.path.join(REPO, 'public', 'river'), exist_ok=True)
out.save(os.path.join(REPO, 'public', 'river', 'ground.png'), optimize=True)
out.resize((W // 3, H // 3), Image.NEAREST).convert('RGB').save(os.path.join(DATA, 'ground-preview.png'))
print('ground.png written: %d KB' % (os.path.getsize(os.path.join(REPO, 'public', 'river', 'ground.png')) // 1024))
np.save(os.path.join(DATA, 'ground.npy'), g)

# ====================================================================== route
wl = json.load(open(os.path.join(DATA, 'waterlines.json')))
def cl(wid, rev=False):
    g_ = next(e for e in wl['elements'] if e['id'] == wid)['geometry']
    p = [px(q['lat'], q['lon']) for q in g_]
    return p[::-1] if rev else p
def chain(*parts):
    out = []
    for p in parts: out += p if not out else p[1:]
    return out
def plen(p): return sum(math.hypot(b[0] - a[0], b[1] - a[1]) for a, b in zip(p, p[1:]))
def cut(p, s_end):
    """Polyline from its start up to distance s_end (cells)."""
    out, acc = [p[0]], 0.0
    for a, b in zip(p, p[1:]):
        dseg = math.hypot(b[0] - a[0], b[1] - a[1])
        if acc + dseg >= s_end:
            t = (s_end - acc) / dseg
            out.append((a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)); return out
        out.append(b); acc += dseg
    return out
def nearest_index(p, q): return min(range(len(p)), key=lambda i: (p[i][0] - q[0]) ** 2 + (p[i][1] - q[1]) ** 2)

# Lake approach: open water NE of the harbor entrance -> through the gap beside the Chicago Harbor
# Lighthouse -> past the east end and south side of Navy Pier -> the lock (cell coordinates).
lake = [(1795, 705), (1740, 760), (1692, 818), (1640, 800), (1560, 772), (1524, 770), (1500, 786), (1462, 804), (1420, 813)]
main = chain(cl(164030677), cl(1503477152), cl(911629844), cl(1312070332), cl(407267816))
north_full = chain(cl(1317703968, True), cl(164125005, True), cl(1317723635, True), cl(1315569907, True))   # Wolf Point -> North Ave
basin_end = px(41.9103, -87.6568)
north_up = north_full[:nearest_index(north_full, basin_end) + 1]
canal = cl(1040130236)                                   # turning basin -> south tip of Goose Island
j = nearest_index(north_full, canal[-1])
north_down = north_full[:j + 1][::-1]                    # junction -> Wolf Point
south_full = chain(cl(1308480104), cl(1308480105), cl(1324492726), cl(1324492725))
south = cut(south_full, 3395 / CELL)                     # Ping Tom Memorial Park, Chinatown
LEGS = [('lake', 'Lake Michigan to the harbor lock', lake), ('main', 'Main Stem', main), ('north', 'North Branch', north_up),
        ('canal', 'North Branch Canal, around Goose Island', canal), ('north-return', 'North Branch, back to Wolf Point', north_down), ('south', 'South Branch to Chinatown', south)]
route, legs = [], []
for key, title, p in LEGS:
    legs.append({'key': key, 'title': title, 'start': len(route) if not route else len(route) - 1})
    route += p if not route else p[1:]
gnow = np.load(os.path.join(DATA, 'ground.npy'))
dry = [(round(x), round(y)) for x, y in route if gnow[int(y), int(x)] not in (LAKE, RIVER)]
print('route: %d points, %.1f km; vertices not on water: %d %s' % (len(route), plen(route) * CELL / 1000, len(dry), dry[:6]))

# ====================================================================== bridges
def seg_inter(p1, p2, p3, p4):
    dd = (p2[0] - p1[0]) * (p4[1] - p3[1]) - (p2[1] - p1[1]) * (p4[0] - p3[0])
    if abs(dd) < 1e-12: return None
    t = ((p3[0] - p1[0]) * (p4[1] - p3[1]) - (p3[1] - p1[1]) * (p4[0] - p3[0])) / dd
    u = ((p3[0] - p1[0]) * (p2[1] - p1[1]) - (p3[1] - p1[1]) * (p2[0] - p1[0])) / dd
    return (t, u) if 0 <= t <= 1 and 0 <= u <= 1 else None
centerlines = {'main': main, 'north': north_full, 'canal': canal, 'south': south_full}
hits = []     # (line, s_cells, way id, crossing point)
for wid, (nd, t) in ways.items():
    if not t.get('bridge') or t.get('bridge') == 'no' or not (t.get('highway') or t.get('railway')) or not complete(wid): continue
    p = wpts(wid)
    bx0, bx1 = min(q[0] for q in p), max(q[0] for q in p); by0, by1 = min(q[1] for q in p), max(q[1] for q in p)
    for lname, pl in centerlines.items():
        acc = 0.0
        for c, e in zip(pl, pl[1:]):
            dseg = math.hypot(e[0] - c[0], e[1] - c[1])
            if not (max(c[0], e[0]) < bx0 or min(c[0], e[0]) > bx1 or max(c[1], e[1]) < by0 or min(c[1], e[1]) > by1):
                for a, b in zip(p, p[1:]):
                    r = seg_inter(c, e, a, b)
                    if r: hits.append((lname, acc + r[0] * dseg, wid, (c[0] + (e[0] - c[0]) * r[0], c[1] + (e[1] - c[1]) * r[0])))
            acc += dseg
hits.sort(key=lambda h_: (h_[0], h_[1]))
clusters = []
for h_ in hits:
    if clusters and clusters[-1]['line'] == h_[0] and h_[1] - clusters[-1]['s1'] < 55 / CELL:
        clusters[-1]['ways'].add(h_[2]); clusters[-1]['pts'].append(h_[3]); clusters[-1]['s1'] = h_[1]
    else: clusters.append({'line': h_[0], 's0': h_[1], 's1': h_[1], 'ways': {h_[2]}, 'pts': [h_[3]]})
bridges = []
for c in clusters:
    tags = [ways[w][1] for w in c['ways']]
    roads = [t for t in tags if t.get('highway') not in (None, 'footway', 'cycleway', 'path', 'steps')]
    rails = [t for t in tags if t.get('railway')]
    if not roads and not rails and c['line'] == 'main' and c['s0'] * CELL < 300: continue          # lock gate walkways
    names = [t.get('bridge:name') or t.get('name') for t in roads + rails if t.get('bridge:name') or t.get('name')]
    label = max(set(names), key=names.count) if names else None
    # axis from the longest member way; extents from every member way's nodes
    longest = max(c['ways'], key=lambda w: plen(wpts(w)))
    lp = wpts(longest); ax = (lp[-1][0] - lp[0][0], lp[-1][1] - lp[0][1]); n_ = math.hypot(*ax); ax = (ax[0] / n_, ax[1] / n_)
    cx = sum(q[0] for q in c['pts']) / len(c['pts']); cy = sum(q[1] for q in c['pts']) / len(c['pts'])
    ts, us = [], []
    for w in c['ways']:
        for q in wpts(w):
            ts.append((q[0] - cx) * ax[0] + (q[1] - cy) * ax[1]); us.append(-(q[0] - cx) * ax[1] + (q[1] - cy) * ax[0])
    lanes = sum(int(re.match(r'\d+', t.get('lanes', '2')).group()) for t in roads if t.get('layer', '1') in ('1', '0')) if roads else 0
    width_m = max((max(us) - min(us)) * CELL + 5.0, lanes * 3.3 + 5.0, 9.0 if (roads or rails) else 4.0)
    layers = sorted({t.get('layer', '1') for t in roads + rails})
    # the span over the water itself: walk out from the centre along the axis until both banks are reached
    def bank(sign):
        k = 0.0
        while k < 80:
            x_, y_ = cx + ax[0] * k * sign, cy + ax[1] * k * sign
            if not (0 <= int(x_) < W and 0 <= int(y_) < H) or gnow[int(y_), int(x_)] not in (LAKE, RIVER): return k
            k += 0.5
        return k
    bridges.append({
        'line': c['line'], 's': round((c['s0'] + c['s1']) / 2 * CELL), 'label': label,
        'c': [round(cx, 2), round(cy, 2)], 'ax': [round(ax[0], 4), round(ax[1], 4)],
        't': [round(min(ts), 1), round(max(ts), 1)], 'span': [round(-bank(-1), 1), round(bank(1), 1)], 'w': round(width_m / CELL, 2),
        'movable': next((t.get('bridge:movable') for t in tags if t.get('bridge:movable')), None), 'fixed': all(t.get('bridge') != 'movable' for t in roads + rails) if (roads or rails) else True,
        'rail': bool(rails) and not roads, 'railOnTop': bool(rails) and bool(roads), 'layers': layers, 'foot': not roads and not rails,
        'status': 'construction' if any(t.get('highway') == 'construction' for t in tags) else ('disused' if any(t.get('railway') in ('disused', 'abandoned') for t in tags) and not any(t.get('railway') == 'rail' for t in tags) and not roads else None),
        'ways': sorted(c['ways']),
    })
print('bridges over the river and canal:', len(bridges))
for b in bridges: print('  %-6s %5d m  %-36s len %5.1f span %5.1f w %4.1f cells  %s%s%s' % (b['line'], b['s'], (b['label'] or ('footbridge' if b['foot'] else '?'))[:36], b['t'][1] - b['t'][0], b['span'][1] - b['span'][0], b['w'], b['movable'] or ('fixed' if b['fixed'] else 'movable'), ' +rail' if b['railOnTop'] else (' rail' if b['rail'] else ''), ' [' + b['status'] + ']' if b['status'] else ''))

# ====================================================================== buildings
def num(s):
    if not s: return None
    m_ = re.match(r'\s*([\d.,]+)\s*(m|ft|\'|feet)?', s)
    if not m_: return None
    try: v = float(m_.group(1).replace(',', ''))
    except ValueError: return None
    return v * 0.3048 if m_.group(2) in ('ft', "'", 'feet') else v

route_samples = []
for a, b in zip(route, route[1:]):
    k = max(1, int(math.hypot(b[0] - a[0], b[1] - a[1]) / 5))
    route_samples += [(a[0] + (b[0] - a[0]) * i / k, a[1] + (b[1] - a[1]) * i / k) for i in range(k)]
RS = np.array(route_samples)
def route_dist(x, y):
    return float(np.sqrt(((RS[:, 0] - x) ** 2 + (RS[:, 1] - y) ** 2).min())) * CELL

def is_b(t, key='building'): return t.get(key) not in (None, 'no')
shapes = []          # every outline and part: {key, tags, outer: [ring], inner: [ring], part: bool}
for wid, (nd, t) in ways.items():
    if (is_b(t) or is_b(t, 'building:part')) and complete(wid) and closed(wid):
        shapes.append({'key': ('w', wid), 'tags': t, 'outer': [wpts(wid)], 'inner': [], 'part': not is_b(t)})
for rid, (m, t) in rels.items():
    if t.get('type') == 'multipolygon' and (is_b(t) or is_b(t, 'building:part')):
        o = rings_of(rid)
        if o: shapes.append({'key': ('r', rid), 'tags': t, 'outer': o, 'inner': rings_of(rid, roles=('inner',)), 'part': not is_b(t)})
# explicit 3D-building relations: outline + parts
parent_of = {}
for rid, (m, t) in rels.items():
    if t.get('type') == 'building':
        outl = [(typ[0], r) for typ, r, role in m if role == 'outline']
        if outl:
            for typ, r, role in m:
                if role == 'part': parent_of[(typ[0], r)] = outl[0]

SS = 4                                             # supersampling for footprint rasterisation
def raster(sh):
    """Cells whose area is at least half covered by the shape: (x0, y0, bool mask)."""
    xs = [q[0] for r in sh['outer'] for q in r]; ys = [q[1] for r in sh['outer'] for q in r]
    x0, y0, x1, y1 = int(math.floor(min(xs))), int(math.floor(min(ys))), int(math.ceil(max(xs))), int(math.ceil(max(ys)))
    if x1 <= 0 or y1 <= 0 or x0 >= W or y0 >= H: return None
    w_, h_ = x1 - x0, y1 - y0
    if w_ <= 0 or h_ <= 0 or w_ > 600 or h_ > 600: return None
    im = Image.new('L', (w_ * SS, h_ * SS), 0); dd = ImageDraw.Draw(im)
    for r in sh['outer']: dd.polygon([((q[0] - x0) * SS - 0.5, (q[1] - y0) * SS - 0.5) for q in r], fill=1)
    for r in sh['inner']: dd.polygon([((q[0] - x0) * SS - 0.5, (q[1] - y0) * SS - 0.5) for q in r], fill=0)
    a = np.asarray(im, dtype=np.float32).reshape(h_, SS, w_, SS).sum(axis=(1, 3))
    return x0, y0, a >= SS * SS * 0.5

for sh in shapes:
    r = raster(sh); sh['r'] = r
    if r is None: sh['n'] = 0; continue
    x0, y0, mk = r
    sh['n'] = int(mk.sum())
    if sh['n']:
        jj, ii = np.nonzero(mk); sh['cx'] = x0 + ii.mean() + 0.5; sh['cy'] = y0 + jj.mean() + 0.5
outl = [s for s in shapes if not s['part'] and s['n'] > 0]
parts = [s for s in shapes if s['part'] and s['n'] > 0]
bykey = {s['key']: s for s in outl}
# outline id raster to find the parent of loose parts
oid = np.zeros((H, W), dtype=np.int32)
def clip(x0, y0, mk):
    xa, ya = max(0, x0), max(0, y0); xb, yb = min(W, x0 + mk.shape[1]), min(H, y0 + mk.shape[0])
    return xa, ya, xb, yb, mk[ya - y0:yb - y0, xa - x0:xb - x0]
for k, s in enumerate(outl):
    xa, ya, xb, yb, mk = clip(*s['r'])
    oid[ya:yb, xa:xb][mk] = k + 1
    s['parts'] = []
orphans = 0
for p in parts:
    par = bykey.get(parent_of.get(p['key']))
    if par is None:
        xa, ya, xb, yb, mk = clip(*p['r'])
        v = oid[ya:yb, xa:xb][mk]; v = v[v > 0]
        if len(v): par = outl[np.bincount(v).argmax() - 1]
    if par is None: orphans += 1; continue
    par['parts'].append(p)
print('buildings: %d outlines, %d parts (%d without a parent outline)' % (len(outl), len(parts), orphans))

def est_height(t, area_m2):
    h_ = num(t.get('height')) or num(t.get('building:height'))
    if h_: return h_, 0
    lv = num(t.get('building:levels'))
    if lv:
        return (lv * 3.3 + 1.5 if lv <= 4 else lv * 3.55 + 3.0), 1
    b_ = t.get('building')
    if b_ in ('garage', 'garages', 'shed', 'roof', 'kiosk', 'hut', 'carport', 'service'): return 3.5, 2
    if b_ in ('house', 'detached', 'semidetached_house', 'terrace', 'residential'): return 9.0, 2
    return (12.0 if area_m2 > 1500 else 9.0), 2

def shape_height(s):
    """(height m, source) for an outline: its own tag, else its tallest part, else levels, else a default."""
    t = s['tags']; area = s['n'] * CELL * CELL
    h_, src = est_height(t, area)
    ph = [est_height(p['tags'], 0) for p in s.get('parts', [])]
    ph = [q for q in ph if q[1] < 2]
    if ph:
        best = max(ph)
        if src > 0 or best[0] > h_: h_, src = best[0], min(q[1] for q in ph if q[0] == best[0])
    return h_, src


sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from curated import BUILDINGS as CUR, BRIDGES as CURB, POIS, PALETTE

for s in outl: s['h'], s['src'] = shape_height(s)
def cur_for(name):
    if not name: return None
    for k, v in CUR.items():
        if name == k or (k.endswith('*') and name.startswith(k[:-1])): return v
    return None

# ---- rasterise: height in plates (1 plate = 1.6 m) and building index per cell
PLATE_M = 1.6
hmap = np.zeros((H, W), dtype=np.uint16); imap = np.zeros((H, W), dtype=np.uint16)
def stamp(shape, plates, idx):
    xa, ya, xb, yb, mk = clip(*shape['r'])
    hv = hmap[ya:yb, xa:xb]; iv = imap[ya:yb, xa:xb]
    up = mk & (plates > hv)
    hv[up] = plates; iv[up] = idx
outl.sort(key=lambda s: (round(s['cy']), round(s['cx'])))
table = []
for s in outl:
    t = s['tags']; c = cur_for(t.get('name')) or {}
    if 'h' in c: s['h'], s['src'] = c['h'], 0
    if re.search(r'bridge ?house', t.get('name') or '', re.I) and s['src'] == 2: s['h'] = 11.0
    idx = len(table) + 1
    own = num(t.get('height'))
    if s['parts'] and 'flat' not in c:
        hs = []
        for p in s['parts']:
            ph, psrc = est_height(p['tags'], 0)
            if psrc == 2: ph = own or s['h']
            if 'h' in c: ph = min(ph, c['h']) if ph < s['h'] * 0.98 else c['h']
            hs.append(ph)
        base = min(min(hs), own) if own else min(hs)
        stamp(s, max(2, round(base / PLATE_M)), idx)
        for p, ph in zip(s['parts'], hs): stamp(p, max(2, round(ph / PLATE_M)), idx)
        if 'h' not in c: s['h'] = max(s['h'], max(hs))
    else:
        stamp(s, max(2, round(s['h'] / PLATE_M)), idx)
    table.append(s)
print('rasterised %d buildings; tallest %d plates; built cells %d' % (len(table), hmap.max(), (hmap > 0).sum()))

# ---- colours and facade styles
import hashlib
def hsh(s): return int(hashlib.md5(repr(s['key']).encode()).hexdigest()[:8], 16)
PI = {k: i for i, k in enumerate(PALETTE)}
GLASS = [('sand-blue', 1), ('medium-blue', 1), ('dark-blue', 1), ('lbg', 2), ('black', 2), ('dbg', 2), ('white', 2), ('tan', 2), ('sand-green', 1), ('dark-azure', 1)]
MASON = [('tan', 0), ('dark-tan', 0), ('reddish-brown', 0), ('dark-red', 0), ('lbg', 0), ('dark-orange', 0), ('medium-nougat', 0), ('white', 0), ('dbg', 0)]
HOUSE = [('dark-red', 0), ('reddish-brown', 0), ('tan', 0), ('lbg', 0), ('white', 0), ('dark-orange', 0), ('medium-nougat', 0), ('dark-tan', 0)]
def year_of(t):
    m_ = re.match(r'(\d{4})', t.get('start_date', '') or '')
    return int(m_.group(1)) if m_ else None
def look(s):
    t = s['tags']; c = cur_for(t.get('name')) or {}
    if 'c' in c: return c['c'], c.get('s', 2)
    k = hsh(s); y_ = year_of(t); b_ = t.get('building'); area = s['n'] * 16
    if re.search(r'bridge ?house', t.get('name') or '', re.I): return 'tan', 0
    if b_ in ('roof', 'shed', 'garage', 'garages', 'carport'): return 'lbg', 3
    if b_ in ('parking',) or 'Self Park' in (t.get('name') or ''): return 'lbg', 2
    if s['h'] >= 60 and not (y_ and y_ < 1945): return GLASS[k % len(GLASS)]
    if s['h'] >= 18 or (y_ and y_ < 1945): return MASON[k % len(MASON)]
    if b_ in ('industrial', 'warehouse', 'retail', 'commercial') or area > 3000: return [('lbg', 3), ('white', 3), ('tan', 3), ('dark-tan', 0), ('dark-red', 0)][k % 5]
    return HOUSE[k % len(HOUSE)]

B = {'h': [], 'src': [], 'c': [], 's': [], 'm': {}}
for i_, s in enumerate(table):
    t = s['tags']; c = cur_for(t.get('name')) or {}
    col, sty = look(s)
    B['h'].append(round(s['h'], 1)); B['src'].append(s['src']); B['c'].append(PI[col]); B['s'].append(sty)
    m_ = {}
    if t.get('name'): m_['n'] = t['name']
    ad = ' '.join(x for x in (t.get('addr:housenumber'), t.get('addr:street')) if x)
    if ad: m_['ad'] = ad
    lv = num(t.get('building:levels'))
    if lv: m_['lv'] = int(lv)
    y_ = c.get('y') or year_of(t)
    if y_: m_['y'] = y_
    a_ = c.get('a') or t.get('architect')
    if a_: m_['a'] = a_
    b_ = t.get('building')
    if b_ and b_ != 'yes': m_['t'] = b_
    for k_ in ('f', 'cat', 'fl', 'nm'):
        if k_ in c: m_[k_] = c[k_]
    if m_: B['m'][str(i_ + 1)] = m_

rgb = np.zeros((H, W, 3), dtype=np.uint8)
rgb[..., 0] = hmap & 255; rgb[..., 1] = imap & 255; rgb[..., 2] = ((hmap >> 8) & 1) | ((imap >> 8) << 1)
assert hmap.max() < 512 and imap.max() < 32768
Image.fromarray(rgb, 'RGB').save(os.path.join(REPO, 'public', 'river', 'city.png'), optimize=True)

# ---- bridges: attach names, years and structure
for b in bridges:
    info = None
    for line, pat, lo, hi, v in CURB:
        if line == b['line'] and lo <= b['s'] <= hi and (pat is None or re.search(pat, b['label'] or '', re.I)): info = v; break
    if info: b.update(info)
    else: b.update({'name': b['label'] or 'Footbridge', 'kind': 'beam'})
    b.pop('ways', None); b.pop('label', None); b.pop('layers', None); b.pop('movable', None); b.pop('fixed', None)
    print('  %-6s %5d  %-40s %s %s' % (b['line'], b['s'], b['name'], b['kind'], b.get('year', '')))
pois = [dict(p, x=round(px(p['lat'], p['lon'])[0], 1), y=round(px(p['lat'], p['lon'])[1], 1)) for p in POIS]
for p in pois: p.pop('lat'); p.pop('lon')
world = {
    'cell': CELL, 'plate': PLATE_M, 'w': W, 'h': H, 'geo': {'latN': LATN, 'lonW': LONW, 'kx': KX, 'ky': KY},
    'route': [[round(x, 1), round(y, 1)] for x, y in route], 'legs': legs, 'bridges': bridges, 'pois': pois, 'palette': PALETTE, 'b': B,
}
json.dump(world, open(os.path.join(REPO, 'public', 'river', 'world.json'), 'w'), separators=(',', ':'), ensure_ascii=False)
for f in ('ground.png', 'city.png', 'world.json'): print('%-11s %5d KB' % (f, os.path.getsize(os.path.join(REPO, 'public', 'river', f)) // 1024))

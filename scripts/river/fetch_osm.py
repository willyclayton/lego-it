import json, math, os, subprocess, sys, time
data_dir = sys.argv[1]
d = json.load(open(os.path.join(data_dir, 'waterlines.json')))
route_ids = {164030677, 911629844, 1312070332, 407267816, 1503477152, 911629843, 1317703968, 164125005, 1317723635, 1315569907, 1040130236, 1308480104, 1308480105, 1324492726, 1324492725, 1040239988}
pts = []
for e in d['elements']:
    if e['id'] in route_ids:
        g = e['geometry']
        for a, b in zip(g, g[1:]):
            n = max(1, int(math.hypot((a['lat'] - b['lat']) * 111000, (a['lon'] - b['lon']) * 82700) / 60))
            for i in range(n + 1):
                t = i / n
                la, lo = a['lat'] + (b['lat'] - a['lat']) * t, a['lon'] + (b['lon'] - a['lon']) * t
                if la > 41.8525 and la < 41.9125: pts.append((la, lo))
# lake approach: from open water east of Navy Pier to the lock
for i in range(40):
    t = i / 39
    pts.append((41.8935 + (41.8885 - 41.8935) * t, -87.5925 + (-87.6052 + 87.5925) * t))
DLAT, DLON = 0.006, 0.008
def dist_m(la, lo, p): return math.hypot((la - p[0]) * 111000, (lo - p[1]) * 82700)
tiles = []
lat = 41.846
while lat < 41.916:
    lon = -87.672
    while lon < -87.586:
        c = (lat + DLAT / 2, lon + DLON / 2)
        dmin = min(dist_m(c[0], c[1], p) for p in pts)
        lake = 41.879 <= c[0] <= 41.898 and -87.618 <= c[1] <= -87.588   # Navy Pier, harbor, breakwaters
        hancock = abs(c[0] - 41.8988) < DLAT / 2 + 0.0005 and abs(c[1] + 87.6232) < DLON / 2 + 0.0005
        if dmin < 640 + 450 or lake or hancock:
            tiles.append((round(lon, 4), round(lat, 4), round(lon + DLON, 4), round(lat + DLAT, 4)))
        lon += DLON
    lat += DLAT
print(len(tiles), 'tiles')
def fetch(t, depth=0):
    name = os.path.join(data_dir, 'tiles', 'map_%s_%s_%s_%s.xml' % t)
    if os.path.exists(name) and os.path.getsize(name) > 300: return
    url = 'https://api.openstreetmap.org/api/0.6/map?bbox=%s,%s,%s,%s' % t
    for attempt in range(5):
        r = subprocess.run(['curl', '-sS', '-m', '120', '-A', 'lego-it-river-tour/1.0', '-o', name, '-w', '%{http_code}', url], capture_output=True, text=True)
        code = r.stdout.strip()
        if code == '200': print('ok', t, os.path.getsize(name) // 1024, 'KB', flush=True); time.sleep(1.2); return
        body = open(name, 'rb').read(200).decode('utf8', 'replace') if os.path.exists(name) else ''
        if code == '400' and 'too many nodes' in body.lower() and depth < 3:
            os.remove(name)
            mx, my = (t[0] + t[2]) / 2, (t[1] + t[3]) / 2
            for s in [(t[0], t[1], mx, my), (mx, t[1], t[2], my), (t[0], my, mx, t[3]), (mx, my, t[2], t[3])]:
                fetch(tuple(round(v, 5) for v in s), depth + 1)
            return
        print('retry', t, code, body[:120].replace('\n', ' '), r.stderr.strip()[:100], flush=True)
        time.sleep(8 * (attempt + 1))
    if os.path.exists(name): os.remove(name)
    print('FAILED', t, flush=True)
for t in tiles: fetch(t)

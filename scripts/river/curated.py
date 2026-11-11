"""
Hand-checked facts layered on top of the OpenStreetMap data.

BUILDINGS: keyed by the OSM name (a trailing * matches a prefix).
  h    height in metres where OSM has none or only a floor count
  y    year completed        a  architect
  f    one-sentence fact     cat  id of the detailed model in the Chicago catalog
  c/s  LEGO colour and facade style (0 masonry with windows, 1 glass curtain wall, 2 window bands, 3 plain)
  nm   display name when the OSM name is not the common one
BRIDGES: (centerline, label pattern, from metres, to metres, info) in river order.
"""

PALETTE = ['white', 'black', 'lbg', 'dbg', 'tan', 'dark-tan', 'reddish-brown', 'dark-red', 'dark-orange', 'medium-nougat',
           'sand-blue', 'medium-blue', 'dark-blue', 'sand-green', 'dark-azure', 'dark-green', 'green', 'dark-brown', 'red', 'trans-light-blue']

BUILDINGS = {
    # ---- the lake and the mouth of the river
    'Chicago Harbor Lighthouse': dict(h=14.6, y=1893, c='white', s=3, f='Built in 1893 for the World\'s Columbian Exposition and moved out to the breakwater in 1919. It still marks the entrance to the harbor.'),
    'Aon Grand Ballroom': dict(h=24.0, y=1916, a='Charles Sumner Frost', c='dark-red', s=0, f='The domed hall at the east end of Navy Pier, more than half a mile out into the lake. The pier opened in 1916 as Municipal Pier.'),
    'Festival Hall': dict(c='white', s=3),
    'Chicago Shakespeare Theater': dict(y=1999, c='lbg', s=1),
    'Lake Point Tower': dict(y=1968, a='Schipporeit & Heinrich', c='dark-brown', s=1, cat='lake-point-tower', f='The only skyscraper east of Lake Shore Drive. Its three curved wings came from a 1920s glass-tower sketch by Mies van der Rohe, the architects\' teacher.'),
    '400 Lake Shore - North Tower': dict(y=2027, a='Skidmore, Owings & Merrill', c='sand-blue', s=1, f='Rising on the site where the 2,000-ft Chicago Spire was started and abandoned in 2008.'),
    'North Pier Tower': dict(y=1990, c='tan', s=2),
    'Swissotel Chicago': dict(y=1989, a='Harry Weese', c='sand-blue', s=1, nm='Swissôtel Chicago', f='A triangular glass prism, so nearly every room looks at the lake or the river.'),
    'St. Regis Chicago': dict(y=2020, a='Studio Gang (Jeanne Gang)', c='sand-blue', s=1, cat='st-regis', f='Three stepped towers of stacked frustums, 363 m to the top: the third-tallest building in Chicago and the tallest in the world designed by a woman.'),
    'Radisson Blu Aqua Hotel, Chicago': dict(y=2009, a='Studio Gang (Jeanne Gang)', c='white', s=2, cat='aqua', nm='Aqua', f='Every floor slab has a different outline, so the balconies ripple across the tower like water.'),
    'Aon Center': dict(y=1973, a='Edward Durell Stone', c='white', s=2, cat='aon-center', f='Opened as the Standard Oil Building, clad in Carrara marble. The marble warped and all 43,000 panels were replaced with granite by 1992.'),
    'Two Prudential Plaza': dict(y=1990, a='Loebl Schlossman & Hackl', c='lbg', s=2, cat='two-prudential'),
    'One Prudential Plaza': dict(y=1955, a='Naess & Murphy', c='lbg', s=2, f='The first skyscraper built in downtown Chicago after the Depression and the war, and the city\'s tallest roof when it opened.'),
    'Sheraton Grand Chicago': dict(h=110.0, y=1992, a='Solomon Cordwell Buenz', c='tan', s=0),
    'NBC Tower': dict(y=1989, a='Skidmore, Owings & Merrill (Adrian Smith)', c='tan', s=0, f='A limestone tower with setbacks and flying buttresses, a 1980s tribute to Rockefeller Center in New York.'),
    'University of Chicago Gleacher Center': dict(y=1994, c='tan', s=2),
    # ---- Michigan Avenue
    'Tribune Tower': dict(y=1925, a='Howells & Hood', c='tan', s=0, cat='tribune-tower', f='Winner of the Chicago Tribune\'s 1922 worldwide design competition. Stones from famous buildings around the world are set into its base.'),
    'Wrigley Building': dict(y=1924, a='Graham, Anderson, Probst & White', c='white', s=0, cat='wrigley-building', f='Clad in six shades of white glazed terra cotta that get brighter toward the top. The clock tower is modeled on the Giralda in Seville.'),
    'Apple Store': dict(h=9.0, y=2017, a='Foster + Partners', c='lbg', s=1, nm='Apple Michigan Avenue', f='A glass pavilion under a thin carbon-fibre roof, with steps leading down from Pioneer Court to the Riverwalk.'),
    '333 North Michigan': dict(y=1928, a='Holabird & Root', c='tan', s=0, f='One of the four 1920s towers around the Michigan Avenue bridge. Reliefs on the fifth floor show scenes from early Chicago.'),
    'London Guarantee Building': dict(y=1923, a='Alfred S. Alschuler', c='tan', s=0, f='Stands on part of the site of Fort Dearborn. The cupola on the roof is modeled on a monument in ancient Athens. Now the LondonHouse hotel.'),
    '35 East Wacker': dict(y=1927, a='Giaver & Dinkelberg with Thielbar & Fugard', c='tan', s=0, nm='35 East Wacker (Jewelers Building)', f='Built for the jewelry trade with a car elevator in the core, so jewelers could drive in and ride up to their floor without stepping onto the street.'),
    'Trump International Hotel & Tower Chicago': dict(y=2009, a='Skidmore, Owings & Merrill (Adrian Smith)', c='sand-blue', s=1, cat='trump-tower', f='423 m to the tip of the spire, the second-tallest building in Chicago. Its three setbacks line up with the Wrigley Building, Marina City and 330 North Wabash.'),
    'Kemper Building': dict(y=1962, a='Shaw, Metz & Associates', c='white', s=2, nm='One East Wacker (Kemper Building)'),
    # ---- the river canyon
    '330 North Wabash': dict(y=1973, a='Ludwig Mies van der Rohe', c='black', s=2, nm='330 North Wabash (IBM Building)', f='Mies van der Rohe\'s last American building, finished after his death: a black steel and bronze-glass slab built for IBM.'),
    'Marina City 1': dict(y=1964, a='Bertrand Goldberg', c='white', s=2, cat='marina-city', nm='Marina City (east tower)', f='The "corncobs": 19 floors of spiral parking below 40 floors of wedge-shaped apartments, with a marina at river level. The tallest apartment buildings in the world when finished.'),
    'Marina City 2': dict(y=1964, a='Bertrand Goldberg', c='white', s=2, cat='marina-city', nm='Marina City (west tower)', f='The "corncobs": 19 floors of spiral parking below 40 floors of wedge-shaped apartments, with a marina at river level. The tallest apartment buildings in the world when finished.'),
    'Leo Burnett Building': dict(y=1989, a='Kevin Roche John Dinkeloo & Associates', c='lbg', s=0),
    '77 West Wacker': dict(y=1992, a='Ricardo Bofill', c='white', s=1, f='A glass tower dressed as a classical temple, with white granite columns and a pediment on top.'),
    '321 North Clark': dict(y=1987, a='Skidmore, Owings & Merrill', c='medium-blue', s=1),
    '353 North Clark': dict(y=2009, a='Lohan Anderson', c='sand-blue', s=1),
    '300 North LaSalle': dict(y=2009, a='Pickard Chilton', c='sand-blue', s=1),
    'Reid-Murdoch Center': dict(h=49.0, y=1914, a='George C. Nimmons', c='dark-red', s=0, f='A red-brick grocery warehouse with a clock tower, one of the first buildings to follow the 1909 Plan of Chicago by facing the river.'),
    'LaSalle - Wacker Building': dict(y=1930, a='Holabird & Root', c='tan', s=0),
    '225 West Wacker': dict(y=1989, a='Kohn Pedersen Fox', c='lbg', s=0),
    'Merchandise Mart': dict(y=1930, a='Graham, Anderson, Probst & White', c='tan', s=0, cat='merchandise-mart', f='With 4 million square feet it was the largest building in the world when it opened, and for years it had its own ZIP code.'),
    '333 Wacker Drive': dict(y=1983, a='Kohn Pedersen Fox', c='sand-green', s=1, cat='333-wacker', f='The curved green-glass front follows the bend of the river and mirrors the water and sky.'),
    # ---- Wolf Point
    'Wolf Point East': dict(y=2020, a='Pelli Clarke Pelli', c='sand-blue', s=1),
    'Wolf Point West': dict(y=2016, a='bKL Architecture', c='lbg', s=1),
    'Salesforce Tower': dict(y=2023, a='Pelli Clarke & Partners', c='medium-blue', s=1, f='The last and tallest of the three towers at Wolf Point, where the Main Stem meets the North and South branches.'),
    'River Point': dict(y=2017, a='Pickard Chilton', c='medium-blue', s=1, f='Stands above active railroad tracks; the park at its foot is the roof of a tunnel around them.'),
    '150 N Riverside': dict(y=2017, a='Goettsch Partners', c='sand-blue', s=1, f='The base is only 39 feet wide, squeezed between the river and seven railroad tracks; the tower flares out above it to its full width.'),
    '110 North Wacker': dict(y=2020, a='Goettsch Partners', c='sand-blue', s=1, nm='110 North Wacker (Bank of America Tower)'),
    # ---- North Branch
    'Fulton House': dict(y=1908, a='Frank B. Abbott', c='reddish-brown', s=0, f='Built as the North American Cold Storage warehouse with almost windowless brick walls. The windows were cut in when it became condominiums around 1980.'),
    'Kingsbury Plaza': dict(h=158.0, y=2007, a='Solomon Cordwell Buenz', c='sand-blue', s=1),
    'East Bank Club': dict(y=1980, c='tan', s=3),
    '600 West': dict(y=1908, a='Schmidt, Garden & Martin', c='white', s=2, nm='Montgomery Ward & Co. Catalog House (600 West Chicago)', f='A reinforced-concrete warehouse that runs almost a quarter mile along the river. Mail orders for the whole Midwest were filled here.'),
    'Montgomery Ward Memorial Building': dict(c='tan', s=0),
    'The Salt Shed': dict(h=24.0, y=1930, a='Graham, Anderson, Probst & White', c='lbg', s=3, f='The Morton Salt warehouse, with the umbrella girl painted on its roof. Since 2022 it has been a concert venue.', flat=1),
    # ---- South Branch
    'Boeing World Headquarters': dict(y=1990, a='Perkins & Will', c='lbg', s=2, nm='100 North Riverside (Boeing Building)', f='Railroad tracks run under one side, so that part of the tower hangs from steel trusses you can see on the roof.'),
    'Civic Opera House': dict(h=169.0, y=1929, a='Graham, Anderson, Probst & White', c='tan', s=0, f='Seen from the river it looks like a giant armchair, nicknamed "Insull\'s Throne" after the utility magnate who built it. Home of the Lyric Opera.'),
    '2 Riverside Plaza': dict(y=1929, a='Holabird & Root', c='tan', s=0, nm='2 Riverside Plaza (Chicago Daily News Building)', f='The first building in Chicago built on air rights over railroad tracks, and the first with a public plaza facing the river.'),
    'Chicago Mercantile Exchange Center': dict(h=153.0, y=1987, a='Fujikawa Johnson & Associates', c='medium-nougat', s=2),
    '10 South Riverside Plaza': dict(y=1965, c='dbg', s=2),
    '120 Riverside Plaza': dict(h=85.0, y=1968, c='dbg', s=2),
    '200 South Wacker': dict(y=1981, a='Harry Weese & Associates', c='white', s=2),
    'Willis Tower': dict(y=1973, a='Skidmore, Owings & Merrill (Bruce Graham, Fazlur Khan)', c='black', s=2, cat='willis-tower', f='Nine square tubes bundled together, ending at different heights. At 442 m it was the tallest building in the world from 1973 to 1998. Built as the Sears Tower.'),
    '311 South Wacker Drive': dict(y=1990, a='Kohn Pedersen Fox', c='medium-nougat', s=0, f='The glass cylinder on top is lit by almost two thousand fluorescent tubes at night.'),
    'Chicago Union Station': dict(h=30.0, y=1925, a='Graham, Anderson, Probst & White', c='tan', s=0, f='The tracks run under the streets beside the river. The Great Hall is a block west.'),
    'Old Chicago Post Office': dict(y=1932, a='Graham, Anderson, Probst & White', c='tan', s=0, f='The Eisenhower Expressway runs straight through the middle of the building, which was planned with a gap for a road years before the highway was built.'),
    'River City': dict(h=50.0, y=1986, a='Bertrand Goldberg', c='lbg', s=2, f='A snaking concrete apartment block with its own marina, the built fragment of a much larger plan by the architect of Marina City.'),
    'River City Apartments': dict(y=1986, a='Bertrand Goldberg', c='lbg', s=2),
    'Ping Tom Pagoda': dict(h=9.0, y=1999, c='red', s=3, f='The riverside pavilion of Ping Tom Memorial Park, built on a former rail yard and named for the Chinatown civic leader who campaigned for it.'),
    'Ping Tom Boat House': dict(h=7.0, y=2013, c='dark-red', s=3),
    # ---- on the skyline
    '875 N Michigan': dict(y=1969, a='Skidmore, Owings & Merrill (Bruce Graham, Fazlur Khan)', c='black', s=2, cat='hancock-center', nm='875 North Michigan (John Hancock Center)', f='The X-braces on the outside carry the wind loads, which let a 100-story tower use about half the steel of a conventional frame.'),
    'Chicago Board of Trade Building': dict(y=1930, a='Holabird & Root', c='tan', s=0, cat='board-of-trade'),
    'Chicago Water Tower': dict(y=1869, a='William W. Boyington', c='tan', s=0, cat='water-tower'),
    'The Rookery': dict(y=1888, a='Burnham & Root', c='reddish-brown', s=0, cat='rookery'),
    'Monadnock Building': dict(y=1891, a='Burnham & Root', c='dark-brown', s=0, cat='monadnock'),
}

DR = 'dark-red'
def br(name, year, kind, typ, fact=None, color=DR, **kw):
    d = dict(name=name, year=year, kind=kind, type=typ, color=color)
    if fact: d['fact'] = fact
    d.update(kw)
    return d
BASC = 'Double-leaf trunnion bascule'
BRIDGES = [
    # Main Stem, lake to Wolf Point
    ('main', None, 600, 900, br('Outer Drive Bridge (DuSable Lake Shore Drive)', 1937, 'double', BASC + ', two decks', 'When it opened in 1937 it was the longest and widest bascule bridge in the world. President Franklin Roosevelt dedicated it.')),
    ('main', 'Columbus', 0, 9999, br('Columbus Drive Bridge', 1982, 'deck', BASC, 'One of the largest bascule bridges anywhere, with steel box girders instead of trusses.')),
    ('main', 'Michigan', 0, 9999, br('DuSable Bridge (Michigan Avenue)', 1920, 'double', BASC + ', two decks', 'The first double-deck bascule bridge with roadways on both levels. Its four bridgehouses carry sculptures of scenes from Chicago history; one houses the bridgehouse museum.')),
    ('main', 'Wabash', 0, 9999, br('Wabash Avenue Bridge (Irv Kupcinet Bridge)', 1930, 'pony', BASC)),
    ('main', 'State', 0, 9999, br('State Street Bridge (Bataan-Corregidor Memorial Bridge)', 1949, 'pony', BASC)),
    ('main', 'Dearborn', 0, 9999, br('Dearborn Street Bridge', 1963, 'pony', BASC, 'Chicago\'s first movable bridge, a rope-drawn drawbridge, was built at this crossing in 1834.')),
    ('main', 'Clark', 0, 9999, br('Clark Street Bridge', 1929, 'pony', BASC)),
    ('main', 'LaSalle|La Salle', 0, 9999, br('La Salle Street Bridge (Marshall Suloway Bridge)', 1928, 'pony', BASC)),
    ('main', 'Wells', 0, 9999, br('Wells Street Bridge', 1922, 'double', BASC + ', two decks', 'Cars and pedestrians cross on the lower deck, Brown and Purple Line trains on the upper deck.', top='L')),
    ('main', 'Orleans|Franklin', 0, 9999, br('Franklin-Orleans Street Bridge', 1920, 'pony', BASC)),
    # North Branch
    ('north', None, 200, 310, br('Kinzie Street Railroad Bridge', 1908, 'raised', 'Single-leaf Strauss bascule, railroad', 'The Chicago & North Western bridge, the longest and heaviest bascule leaf in the world when built. The last train crossed in 2000 and it has stood locked upright since. A Chicago Landmark.', color='reddish-brown')),
    ('north', 'Kinzie', 311, 500, br('Kinzie Street Bridge', 1909, 'pony', BASC, 'In 1992 pilings driven into the riverbed beside this bridge broke into an old freight tunnel and flooded basements across the Loop.')),
    ('north', 'Grand', 0, 9999, br('Grand Avenue Bridge', 1913, 'pony', BASC)),
    ('north', None, 700, 900, br('Ohio Street Bridge', 1961, 'deck', BASC, 'Carries the feeder ramps of the Kennedy Expressway.')),
    ('north', 'Chicago', 0, 9999, br('Chicago Avenue Bridge', 2018, 'beam', 'Fixed span', 'The 1914 bascule bridge was removed in 2018. A fixed bridge carries the street while a permanent replacement is planned.', color='lbg')),
    ('north', 'Halsted', 0, 9999, br('Halsted Street Bridge (North Branch)', 1955, 'pony', BASC)),
    ('north', 'Division', 0, 9999, br('Division Street Bridge (river)', 1904, 'pony', BASC, 'The west crossing of Goose Island, among the oldest bascule bridges left in the city.')),
    # North Branch Canal
    ('canal', 'Cherry|Goose', 0, 400, br('Cherry Avenue Bridge', 1902, 'swing', 'Asymmetric "bobtail" swing bridge, railroad', 'A rare bobtail swing bridge that pivots on the bank. It carries a rail spur, cyclists and pedestrians onto Goose Island. A Chicago Landmark.', color='black')),
    ('canal', 'Division', 0, 9999, br('Division Street Bridge (canal)', 2015, 'beam', 'Fixed span', color='lbg')),
    ('canal', 'Halsted', 0, 9999, br('Halsted Street Bridge (canal)', 2011, 'arch', 'Tied arch, fixed', 'A steel tied arch that replaced a 1908 bascule bridge. The canal it crosses was dug in the 1850s and turned this land into Goose Island.', color='white')),
    # South Branch
    ('south', 'Lake', 0, 150, br('Lake Street Bridge', 1916, 'double', BASC + ', two decks', 'The first double-deck bascule bridge in the city: the street below, Green and Pink Line trains above.', top='L')),
    ('south', 'Randolph', 0, 9999, br('Randolph Street Bridge', 1984, 'deck', BASC)),
    ('south', 'Washington', 0, 9999, br('Washington Boulevard Bridge', 1913, 'pony', BASC)),
    ('south', 'Madison', 0, 9999, br('Madison Street Bridge (Lyric Opera Bridge)', 1922, 'pony', BASC)),
    ('south', 'Monroe', 0, 9999, br('Monroe Street Bridge', 1919, 'pony', BASC)),
    ('south', 'Adams', 0, 9999, br('Adams Street Bridge', 1927, 'pony', BASC)),
    ('south', 'Jackson', 0, 9999, br('Jackson Boulevard Bridge', 1916, 'pony', BASC)),
    ('south', 'Van Buren', 0, 9999, br('Van Buren Street Bridge', 1956, 'pony', BASC)),
    ('south', None, 1150, 1290, br('Ida B. Wells Drive Bridge', 1956, 'deck', 'Twin double-leaf trunnion bascules', 'Two parallel bridges carrying the road that becomes the Eisenhower Expressway.')),
    ('south', 'Harrison', 0, 9999, br('Harrison Street Bridge', 1960, 'pony', BASC)),
    ('south', 'Roosevelt', 0, 9999, br('Roosevelt Road Bridge', 1928, 'deck', BASC, 'Built when this stretch of the river was straightened, between 1928 and 1930, to make room for rail yards and streets.')),
    ('south', None, 2700, 3000, br('St. Charles Air Line Bridge', 1919, 'through', 'Single-leaf Strauss bascule, railroad', 'When finished it was the longest single-leaf bascule in the world. It was shortened and moved here when the river was straightened. Beside it stands the Baltimore & Ohio bridge, locked upright.', color='black', twin='raised')),
    ('south', '18th', 0, 9999, br('18th Street Bridge', 1967, 'pony', BASC)),
    ('south', None, 3400, 3600, br('Canal Street Railroad Bridge', 1914, 'lift', 'Vertical-lift bridge, railroad', 'The only vertical-lift bridge on the river. Amtrak and Metra trains cross between towers 195 feet high. A Chicago Landmark.', color='black')),
    ('south', 'Canal', 3601, 3800, br('Canal Street Bridge', 1949, 'pony', BASC)),
    ('south', 'Cermak', 0, 9999, br('Cermak Road Bridge', 1906, 'through', 'Scherzer rolling-lift bascule', 'The last Scherzer rolling-lift bridge still working on the river: the leaves rock back on curved girders like a rocking chair.')),
]

POIS = [
    dict(name='Lake Michigan', lat=41.8935, lon=-87.5885, f='The tour starts on the open lake, outside the breakwaters that shelter Chicago Harbor.'),
    dict(name='Navy Pier', lat=41.8917, lon=-87.6030, f='Opened in 1916 as Municipal Pier, 3,300 feet long. It has been a freight and passenger dock, a Navy training base in both world wars and a university campus. The Centennial Wheel stands near its landward end.'),
    dict(name='Chicago Harbor Lock', lat=41.8885, lon=-87.6064, f='Finished in 1938. The river was reversed in 1900 to flow away from the lake, and the lock keeps lake water from pouring into it. It is one of the busiest locks in the country.'),
    dict(name='Centennial Fountain', lat=41.8892, lon=-87.6177, f='In summer it shoots an arc of water across the river once an hour. It marks the centennial of the agency that reversed the river.'),
    dict(name='Chicago Riverwalk', lat=41.8877, lon=-87.6265, f='A pedestrian path along the south bank of the Main Stem, running from the lake to Lake Street.'),
    dict(name='Wolf Point', lat=41.8872, lon=-87.6378, f='The fork where the Main Stem meets the North and South branches. The city\'s first taverns and hotel stood here in the 1820s and 30s. The Y of the three branches is the symbol on Chicago\'s municipal device.'),
    dict(name='Goose Island', lat=41.9040, lon=-87.6545, f='An artificial island, created in the 1850s when the North Branch Canal was dug along its east side. Long an industrial district, now also offices and breweries.'),
    dict(name='North Avenue Turning Basin', lat=41.9103, lon=-87.6568, f='The wide water at the north tip of Goose Island, where ships could turn around. The tour turns back here and comes down the canal.'),
    dict(name='Ping Tom Memorial Park', lat=41.8573, lon=-87.6347, f='Chinatown\'s riverfront park, on a former rail yard. The water taxi from downtown lands here. End of the tour.'),
]

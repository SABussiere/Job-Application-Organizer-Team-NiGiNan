# lib/geo-data

Bundled geography that has no small, official npm package of its own,
unlike `world-atlas` (countries) and `us-atlas` (US states).

## canada-provinces-10m.json

Canada's 10 provinces and 3 territories, in plain WGS84 longitude/latitude
(so it composes with the same `d3-geo` projections as everything else on the
map), simplified to 60KB.

**Source:** Statistics Canada cartographic boundary files, republished (and
already simplified once, to 4.9MB) by
[sachijay/canada_maps](https://github.com/sachijay/canada_maps) under the
MIT license. That file is in Statistics Canada Lambert (EPSG:3347), not
lon/lat, so it was reprojected to WGS84 with `proj4` before this file was
built — using coordinates alone without reprojecting would have produced
plausible-looking but wrong province borders, since a Lambert
easting/northing pair for a place in Canada resembles a very large,
out-of-range "longitude/latitude".

**Rebuilding it**, if the source ever needs updating:

```js
const proj4 = require("proj4");
const STATCAN_LAMBERT =
  "+proj=lcc +lat_0=63.390675 +lon_0=-91.8666666666667 +lat_1=49 +lat_2=77 " +
  "+x_0=6200000 +y_0=3000000 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs";
const toWgs84 = proj4(STATCAN_LAMBERT, "WGS84");
// reproject every coordinate pair with toWgs84.forward([x, y]), then:
```
```bash
npx mapshaper reprojected.geojson -simplify 3% -clean \
  -o format=topojson quantization=1e5 canada-provinces-10m.json
```

Verified against 14 major cities (one per province/territory) landing in the
right region after simplification — see the project history for the check.

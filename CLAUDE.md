# CLAUDE.md — CASH RULES NYC: WANTED

> **Design authority:** `docs/GAME_MASTER.md` (Master Game File v2.0). Order of authority: owner's instructions > master file > code > this file. This file covers implementation detail only.

An arcade police-chase game set on a real, drivable map of all five NYC boroughs (plus the Jersey waterfront): survive as the heat climbs, grab cash, nitro and repair gears, hit the ramps. Owner: DJ / CASH RULES NYC LLC. Everything here was written from scratch: no Smashy Road code or assets, no third-party engine, so it is 100% owned IP.

## Hard rules
- **The output is one self-contained file: `dist/index.html`.** Don't add JS libraries or CDN scripts. External JS is unreliable in Claude artifacts and it complicates ownership. The renderer is hand-written WebGL2. The only outside request is the Google Fonts stylesheet (Bungee + Russo One), and the game falls back cleanly without it.
- **Design for mobile first** (iPhone portrait), then phone landscape and desktop. Touch: hold the left or right half of the screen to steer, both halves to brake. Keys: ←/A, →/D, ↓/S/Space, P/Esc pauses, M opens the map.
- **Hosting is static on Netlify**: `netlify.toml` runs `python3 build.py` and publishes `dist/`.
- **PWA extras are optional siblings**: build.py also writes `dist/manifest.webmanifest`, `dist/sw.js` (from `src/sw.js`, versioned by a hash of index.html) and `dist/icons/` (from `assets/icons/`). The game still runs from `index.html` alone. The service worker registers only on https or localhost. It is network-first for the page (new deploys show up on the next online launch) and caches Google Fonts for offline.
- **Edit only `src/`**, then run `python3 build.py`. Never hand-edit `dist/index.html`. Commit the rebuilt dist so Netlify Drop also works.

## Build
`python3 build.py` stitches the source into `src/index.html`:
- **SHARED** = `data.js`, `map.js`, `chunkgen.js`. This goes into `<script id="shared">`, which runs on the main thread. At startup the same text is also loaded into a **Web Worker** (Blob URL) that generates chunks. So SHARED code must stay pure: no DOM, no `GFX`, no references to anything in MAIN.
- **MAIN** = `gl.js`, `world.js`, `vehicles.js`, `game.js`, in that order. These are plain globals, not ES modules, so load order matters.
- Source files must never contain the literal `</script` (the build checks for it).

## File map
| File | What it does |
|---|---|
| `src/data.js` | `GEO`: hand-traced lat/lon polygons for MAN/BRX/BKN/QNS/SI/NJ, islands, zones (parks, beaches, airports, cemeteries, plazas), highways and runways, 25 bridges, spawn points, 114 neighborhood labels |
| `src/map.js` | Projection `P(lat,lon)`, the master raster (`BORO`/`ZONE` at 2 units/px via scanline `fillPoly`), smooth coastline lookup (`LANDB` blurred land mask → `landVal`/`landIdx`; `boroAt`/`zoneAt`/`tileAt` all go through it), shore band mask `NEARL`, per-borough street grids (`GRIDS`, `gLocal`/`gWorld`), segment buckets + `segHit`, `tileAt()`, `texel()` ground painter (anti-aliased markings via `cov`/`paint`/`dash`), `bridgeH()` deck profile |
| `src/chunkgen.js` | `genChunk(cx,cz)` builds the 256px ground texture, building/prop box instances, colliders, props and billboards. Building styles live in `tower()`: glass or masonry tiered towers with deco crowns/penthouses, cornices, storefront bands + awnings, fire escapes, brownstone stoops, roof caps. `faceZ` is the lot's street-facing local-z side. Also landmarks (`LM`), `initWorldData`, palettes, `box()`/`lbox()` helpers |
| `src/gl.js` | `GFX` renderer: instanced **chamfered** cube (world-size bevel `GFX.bevel`), plain cube for the shadow pass, shadow map (`sampler2DShadow`, PCF), chunk ground quads, billboard quads, **building slicing** (see below), hemisphere ambient + ground-contact AO, player silhouette pass, `M4` math |
| `src/world.js` | `WORLD`: chunk streaming via workers (main-thread fallback), spatial cells, `forCols`/`forProps`/`pointBlocked`/`killProp`. Also quaternions, bridge 3D geometry, boats (Staten Island Ferry etc.) |
| `src/vehicles.js` | `MODELS` (player cars, cops, ESU SUV/heavy, bus, heli), arcade physics `stepVehicle`, OBB collisions `collideWorld`, car-vs-car `collideVehicles`, cop AI, grid-following civilian AI, particles |
| `src/game.js` | State machine (`boot → title → play ⇄ pause → over`), heat/stars, spawning, damage, pickups (cash, nitro, gears), missions, HUD, minimap and big map, synth audio (`AUD`), saves, input, camera, main loop, debug hooks |
| `src/index.html` | All CSS and the DOM overlays (minimal title + dock, borough/settings sheets, garage panel, missions sheet, HUD, pause map, game over) |

## Coordinates and conventions (read before touching the math)
- **1 world unit = 18 m.** X points east, **Z points south (north = −Z)**, Y is up. `P(lat,lon)` → `[x,z]`, origin at 40.71, −73.98. World bounds `WX0..WX1`, `WZ0..WZ1` (about 2860×2750 units).
- **Heading `h`** is an azimuth: 0 = north, clockwise. forward = `(sin h, −cos h)`, right = `(cos h, sin h)`.
- **Box rotation** is a quaternion. A pure yaw is `qYaw(φ)` = Ry(φ). Vehicles use `φ = π − h` and models are built with the **front at local +Z**. Grid-aligned objects use `φ = −grid.th`, which maps local +X to the avenue-crossing axis `e`.
- **Street grid**: `mkGrid(boro, thDeg, A, S, wa, ws, originLat, originLon, style)`. Avenue lines are constant `u` (spacing A, width wa) and run along `d` (azimuth th). Street lines are constant `v` (spacing S, width ws). Manhattan is th=29°, A=15.5, S=9, and Central Park is fitted exactly to that grid.
- **Tiles** (`tileAt`): `T_WATER, T_ROAD, T_WALK, T_LOT, T_PARK, T_SAND, T_TARMAC, T_HWY, T_BRIDGE, T_CEM, T_PLAZA, T_RUNWAY`. Water anywhere that isn't a bridge or highway sinks the car.

## Data formats
- **Box instance** (`INST` = 14 floats): `x y z  sx sy sz  qx qy qz qw  r g b  mat`
- **Material** (`mat`): 0 lit · 1 tower windows · 2 emissive · 3 unlit flat · 4 small residential windows · 5 lamp (glows at night) · 6 glass (specular) · 7 glass curtain wall (mullions, sky reflection, lit floors at night) · 8 storefront band (shop glass below, coloured fascia above, glows at night) · 9 art-deco vertical window strips (ESB/Chrysler). **+16** on any mat = landmark flag (set in `genChunk`), which makes slicing lenient so landmarks keep their silhouette; the shader subtracts it.
- **Collider** (`COLF` = 7): `cx cz ax az ha hb h`. Axis a = `(ax,az)` = local X, b = `(−az, ax)` = local Z, with half-extents `ha`/`hb`.
- **Prop** (`PROPF` = 8): `x z radius type instStart instCount yaw mass`. Types are in `PT` (tree, lamp, hydrant, trash, news box, bench, parked car, halal cart, tombstone, umbrella, bush, cone).
- **Vehicle meshes (new standard, Street Sedan first)**: a model with `build(M)` gets a dedicated triangle mesh (`buildVehicleMeshes()` at boot → `GFX.addMesh('car_'+k)`), drawn instanced by `pushVehicleMesh` (game.js) in the main, shadow and silhouette passes (`MESH_VS/FS`, `MINST` = 16 floats: pos, quat, scale, rgb, siren/dim/brake). Builder (`MeshBuilder` in vehicles.js): `loft` (cross-section stations along z, `sec()` lower-body and `gsec()` glasshouse helpers), `box` (optional chamfer), `beam` (pillars), `revolve` (around x), `arc` (wheel arches), `hexa`. Style `{c, m, p}`: `p > 0` = instance colour × p (paint, rims). Mesh materials add 10/11 siren red/blue, 12 headlight, 13 taillight (brighter while braking). Wheels are one shared `wheel` mesh (radius 1, axle x) listed per model in `m.wheels` `[x,y,z,r,width,front]`; they spin with road speed and front wheels steer (−steer × 0.45 rad). Models without `build` still use `parts` (boxes). Garage and gameplay use the same mesh.
- **Benchmark (frozen once approved): `buildSedan` (vehicles.js).** Fleet standard: beltline about 0.62 (real body above the arches), wheels r ≈ 0.25, dark wheel wells + flush body-colour lips, flat roof with upright pillars and a C-pillar *sail panel* (`hexa` on the glass side; avoid thick `beam` pillars, which poke above the roof), lights on the outermost faces (anything inside the loft is hidden), smoked housings behind red lenses, chrome = mat 14, glass = mat 6. Check new models with a true side view and a front view before the 3/4 shots. Garage renders with `studio: true` (softbox reflections, `uStudio`).
- **Vehicle part** (`MODELS[k].parts`, legacy boxes): `[x y z  sx sy sz  color|'body'|'bodyDk'  mat  flag  pitch]`. `pitch` tilts the part about the car's X axis (used for raked glass; build these with `rake(y0,z0,y1,z1,w,col,mat)`). `wheels(xs,zs,r,w)` adds tyre + rim + hub. Keep the player car ≤ 64 parts (silhouette buffer).
- **Billboard**: `[x y z w h nx nz atlasIndex]`. Atlas: 0 CASH RULES NYC · 1 BLUESCREENU · 2 AI BEEN HERE · 3 GAS GADGETS · 4 NYC DJ · 5 MINITECH101 · 6 CASH RULES RECORDS · 7 WANTED. Edit `makeBillboards()` in game.js to change them.
- **Ground texture alpha**: `32 × borough` where the street grid decides the tile (road/sidewalk/lot), 255 elsewhere. For grid tiles, `GROUND_FS` draws roads, sidewalks, curbs, crosswalks, stop bars, lane dashes and double yellows **analytically per pixel** (`gridColor`, derivative AA), so they stay sharp at any screen resolution. Grid params come from `GRIDS` via `uGa`/`uGb`. Alpha 224 marks highway/avenue/runway texels: `segColor()` draws those analytically from the 32 nearest non-bridge `SEGS`, uploaded as `uSegA`/`uSegB` and refreshed when the view moves 8+ units. Bridges, zones and water still come from the texture. If you change marking positions in `texel()`, mirror them in `gridColor()`.
- **Chunks**: `CH` = 48 units, `CTEX` = 256 px (0.19 units/texel; keep markings ≥ 1 texel wide), stream radius `WORLD.wantR` = 2.4 chunks, spatial cells of 6 units.

## Camera and tall buildings (no see-through)
- Camera pitch is `CAM_PITCH` (66°, game.js), steeper than a typical chase cam so towers lean away from the car, like the classic top-down city games.
- Anything still between the camera and the car is **sliced**: `BOX_VS` in gl.js caps the height of chunk boxes in front of the player at `minH + distance × tan(pitch)`. The cut top renders as a solid, slightly darker roof, and boxes that sit fully above the cut are dropped. Billboards follow the same rule in `BILL_VS`. Shadows still use the full-height city. Tune it via the `slice` object passed in `render()` (game.js): `minH` 2.7 and `slope`. The lateral factor (2.2) and the margins (1.6) live in the shader.
- Only chunk geometry is sliced. Bridges (`statics`), vehicles, particles and the player are not.

## Landmarks
- Defined in `initWorldData()` (chunkgen.js) with `name` (shown as the location label when you're within `nr` or `r + 9` units; see `hoodName` in game.js) and built in `buildLandmark()`. Flatiron, Washington Square Arch, Madison Square Garden, Grand Central, MetLife and Rockefeller Center (30 Rock + rink + Christmas tree) are anchored to their Manhattan grid block. The Vessel and 30 Hudson Yards (Edge) are placed by lat/lon.
- Helpers: `lb` (part in the landmark frame), `lr` (frame position + its own yaw; use it whenever a part's yaw differs from the frame yaw), `beam(a,b,th)` (bar between two 3D points), `qy/qa/qm` quaternions.
- Heights are deliberately exaggerated (ESB antenna ≈ 29, One WTC spire ≈ 34) so they read over the generic skyline. `r` also clears generic lots and park props around them.
- The Brooklyn Bridge Gothic towers and cable web live in `buildBridgeGeometry()` (world.js, style `gothic`).

## Roads, ramps, missions
- **Road width**: `mkGrid` adds `ROAD_WA` (1.2) to every avenue and `ROAD_WS` (0.8) to every street, taken out of the blocks. Sidewalks are `GRID_SW` (0.6, baked into `GROUND_FS`). Highways ×`HWY_K` (1.25), bridges ×`BRIDGE_K` (1.2). Manhattan blocks are now 9.5×4.2, so landmarks must fit 4.2 deep.
- **Jump ramps** (chunkgen.js): `rampValid(g,i,j)` (pure, cached, ~13% of mid-blocks on avenues that are road the whole way) and `rampHeight(x,z)` drive both the visuals (`buildRamp`) and the physics. `stepVehicle` (vehicles.js) follows the hump and launches when it starts dropping away at > 6 u/s (`vy = 0.62 × speed`, max 17, gravity `AIR_G` 30). In the air: ballistic, no grip; `collideWorld` only checks colliders taller than the car and skips props above 1.2. Landing sets `v.landed` (air time). game.js pays the big-air bonus (≥ 0.45 s), and hard landings damage cops. Block force fields are 40 tall, so you can't jump into backyards. Chunk `maxH` ignores colliders ≥ 39.
- **Side missions + gifts** (game.js, `MISSIONS`, `GIFTS`): tiered ladders over lifetime `SAVE.stats` (cops, cash, airs, nitros, gears, dist km, runs), plus `SAVE.maxStars` and `SAVE.best`. Tier progress is in `SAVE.mis`, gift timestamps in `SAVE.gift` (daily 20 h $1,500, hourly $150). `stat(k, n)` increments a stat and toasts newly completed tiers. UI: `#misBtn` on the title (badge = `claimable()`) opens `#missions`.

## Gameplay tuning (game.js unless noted)
- Stars: `STAR_HEAT = [1,16,40,80,140]`. Chasing cops per star level: `COPS_FOR = [0,2,3,5,6,8]`. The helicopter appears at 4★ and up.
- Heat sources: smashing a prop +1.2 (parked car +3), hitting a cop +2 + 0.15×impact, hitting a civilian +1.5, wrecking a cop +10. Heat also rises +0.45/s while you're wanted.
- Cash: floating bill stacks $50–$150 (briefcase $500, 10%), $2×stars per second while wanted, +$100 per cop wrecked or drowned. **High-speed bonus**: above 88% of top speed you earn $20 + $10×stars per second (+$20 during nitro).
- **Nitro power-ups** (`spawnPowerup`, `G.powerups`): floating lightning bolts on roads ahead, up to 3 at a time. Pickup gives `NITRO_T` = 4.5 s of `P.boost = NITRO_BOOST` (1.5× top speed and acceleration via `v.boost` in `stepVehicle`), with flames.
- **Player damage comes only from live cops** (car-vs-car in `onVehHit`) **and water** (sinking). Walls and buildings (`collideWorld` impacts), props, parked cars, civilians and wrecks don't hurt the player. NPC damage is unchanged, so cops still wreck on walls and on you.
- **Solid blocks**: `blockFence()` (chunkgen.js) makes each block's whole lot area one collider, so cars can't squeeze between buildings or through yards. Blocks cut by water, parks, highways, Broadway or landmark plazas get per-cell colliders, and only for cells that are entirely lot. Every chunk a block overlaps adds the block's barrier, because collision lookups are per chunk. Times Square towers are built from lot cells so Broadway stays open. ESB, Chrysler, One WTC and MSG are snapped to their blocks and sized to fit them.
- **Busted**: speed < 2.4 with a cop within 4.2 units for 2.4 s. **No bail and no money loss on any ending** (permanent economy, master file §8/§21). `addCash` credits `SAVE.bank` immediately, and the game autosaves every 5 s during play when the bank changes, plus on pagehide/hidden.
- **No Customs/shops** (removed). Heat only goes up during a run. **Repair gears** (`spawnGear`, `G.gears`): floating steel cogs on roads ahead, up to 2 at a time, spawning 2.5× faster when you're below 60% HP. Driving through one is an instant full repair. **Engine/armor upgrades** are bought in the Garage (`#engineBtn`/`#armorBtn` → `buyUpgrade`).
- **Garage** (game.js, state `garage`): a 3D showroom built from dynamic boxes off the map at `GX/GZ` (−3200, −3200, where no chunks exist). `openGarage`/`closeGarage`, `garStep`, `garAction` (buy/select), `garUpgrade`, `renderGarage` (DOM), `renderGarage3D` (camera + `GFX.render` with no chunks), `garageScene` (room for `SAVE.gar` level 0–3 + pedestals + floating cars via `pushVehicle`; locked cars use `v.dim`). Levels/prices are in `GARAGES`. Swipe on `#touch`, arrow keys, Enter, Esc.
- Upgrades (in the Garage): engine `[700,1500,3000]` (+6% top speed per level), armor `[500,1100,2400]` (+22% HP per level). Car stats and prices live in `MODELS` (vehicles.js). The player garage is `PLAYER_CARS`.
- Cop rubber-banding is `v.boost` in `copAI` (vehicles.js).
- Saves go to localStorage key `crnyc_wanted_v1`: bank, owned cars, current car, paint, upgrades, best time and settings.

## Testing
- `node test/maptest.js` renders the master map and close-up ground crops to `test/out/*.png`. Use it to check coastlines, grids and bridges after editing `data.js`/`map.js`.
- `node test/chunktest.js` reports per-chunk generation time and counts.
- Browser tests need Playwright (`pip install playwright && playwright install chromium`; set `CHROME_PATH` to use a system Chrome). Run them from the repo root:
  - `node test/flow_node.js` runs flow + chaos + night screenshots with Node Playwright (no Python needed).
  - `python3 test/flow.py` covers drive → wanted → chase → drive into the Hudson.
  - `python3 test/chaos.py` does 20 s of random driving at 5★ in every borough (catches NaNs and exceptions).
  - `python3 test/bridge.py`, `test/quick.py W H tag` and `test/shots.py W H tag` take screenshots.
- **Phone perf**: open the game with `?fps=1` (e.g. `https://hotcarnyc.netlify.app/?fps=1`) for an overlay with fps, worst frame, render size, shadow size, boxes drawn, draw calls and chunks.
- Headless software WebGL (SwiftShader) runs at about 2 fps. For game logic, use **`window.__sim(seconds, steer)`**, which steps physics/AI/rules without rendering. Debug flags: `G.noBust`, `G.godT` (god-mode seconds), `G.noAdapt` (freezes auto-quality). The state object is `window.__G`.

## Known limitations / honest TODOs
- Coastlines, bridges, parks and landmarks are real, but streets are a **per-borough procedural grid**, not every real street. Buildings are procedural, and heights are compressed and sliced near the car so it stays visible.
- The coastline blur removes water channels and land strips narrower than ~1 raster cell (2 units ≈ 36 m).
- The Bronx/Westchester and Queens/Nassau edges are treated as water. Newtown Creek and the Gowanus Canal are left out on purpose.
- Frame rate on a real iPhone hasn't been measured yet. Adaptive quality (end of `frame()` in game.js) starts at `min(dpr, 2)`. Below 50 fps it first cuts shadows to 1024, then render scale down to 1.5 on retina; it goes under 1.5 only below 26 fps, so a 30 fps Low Power cap stays sharp. It scales back up after three fast windows.
- Audio is all WebAudio synthesis (engine, siren, crashes). There are no audio files.

## Roadmap ideas
- Real street geometry baked from OpenStreetMap into a compact binary (Broadway is already a special case).
- More heat at 5★: roadblocks, spike strips, an armored "tank" tier, police boats on the rivers.
- Missions and deliveries per borough. Daily challenges. Online leaderboard (needs a backend, e.g. Netlify Functions).
- More rides and cosmetic packs: wraps, rims, neon underglow.
- Possibly a shared lobby with the Shaolin City multiplayer project later.

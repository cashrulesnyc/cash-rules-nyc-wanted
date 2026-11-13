# CASH RULES NYC: WANTED — Master Game File

> **Purpose of this document:** one complete explanation of the game (what it is, how it plays, every feature, the numbers behind it, how the code is built, and the rules for changing it), so any AI assistant (ChatGPT, Claude, etc.) or developer can understand the project fully before suggesting or making changes.
>
> **Owner:** DJ / CASH RULES NYC LLC · **Live:** https://hotcarnyc.netlify.app · **Code:** https://github.com/cashrulesnyc/cash-rules-nyc-wanted (branch `main`, auto-deploys to Netlify)
>
> **Last updated:** November 2026 (after the "Remove Customs, add repair gears" update).

---

## 1. The game in one paragraph

**CASH RULES NYC: WANTED** is a blocky, arcade police-chase driving game played on a **real map of all five New York City boroughs** (plus the New Jersey waterfront). You pick a car and a starting borough, then drive. Smashing things and hitting cars builds **heat**, and heat becomes **wanted stars (1–5)**. More stars bring more and tougher NYPD units and a helicopter. Your goal is to **survive as long as possible** while grabbing **floating cash**, **nitro boosts** and **repair gears**, and launching off **jump ramps** for big-air bonuses. A run ends when you get **WASTED** (your car is destroyed), **BUSTED** (cops box you in while you're stopped), or **SLEEPING WITH THE FISHES** (you drove into the water). Money carries over between runs and buys new cars and upgrades. **Side Hustles** (tiered missions) and daily and hourly gifts give extra rewards.

- **Genre:** endless arcade chase / survival (the same genre as popular top-down voxel chase games), with a fully **original** NYC-themed implementation.
- **Platform:** web browser. Built **mobile-first for iPhone portrait**; also works in phone landscape and on desktop. Can be installed to the home screen (PWA) and plays offline after the first load.
- **Art style:** low-poly "voxel" look made of beveled boxes, bright daytime colors, an optional night mode ("After Dark").
- **Tech:** 100% hand-written JavaScript + WebGL2 in **one HTML file**. No game engine, no libraries. That keeps it fully owned IP.

---

## 2. Brand & IP

- The game belongs to **CASH RULES NYC LLC** and promotes the owner's brand ecosystem through **in-game billboards** (Times Square and elsewhere):
  - **CASH RULES NYC** (record label / merch)
  - **NYC DJ** (artist identity), with the tagline "LIVE ALL 5 BOROUGHS"
  - **BLUESCREENU** (trading brand: NAS100 · GOLD · S&P)
  - **AI BEEN HERE** (OG wisdom content)
  - **GAS GADGETS** (lifestyle accessories), with the tagline "ELEVATE YOUR SESSION"
  - **MINITECH101** (apps), with the tagline "APPS THAT MOVE"
  - **CASH RULES RECORDS**
  - **WANTED ★★★★★**
- **Originality rule:** all code, models and art are original. It is *inspired by* the arcade chase genre, but it must **never copy** another game's code, assets, characters, UI art, level layouts or exact look. Take ideas (wide roads, ramps, missions), never assets.

---

## 3. How to play

### Controls
| Action | Phone (touch) | Keyboard |
|---|---|---|
| Steer left / right | Hold the **left** or **right** half of the screen | ← → or A D |
| Brake / reverse | Hold **both** halves at once | ↓ / S / Space |
| Pause + full map | Tap the **minimap** or the ❚❚ button | P / Esc / M |

The car **accelerates automatically**. You only steer and brake.

### The loop
1. On the **title screen**, choose a car (◀ ▶), a borough (Manhattan, Brooklyn, Queens, The Bronx or Staten Island) and options. Buy upgrades, claim missions and gifts, then press **PLAY**.
2. Drive around. Smashing props and ramming cars raises your **heat**, and heat turns into **stars**.
3. The cops chase you, and the higher your stars, the harder the chase.
4. Grab **cash ($)**, **nitro (⚡)** and **repair gears (⚙)**, and hit **jump ramps** for air-time cash.
5. Survive as long as you can. When the run ends, your cash is already banked. Spend it on cars and upgrades and go again.

### Ways a run ends
| Ending | Cause | Penalty |
|---|---|---|
| **WASTED** | Your car's health hits 0 (only cops damage you, see §5) | None |
| **BUSTED** | You're nearly stopped (speed under ~2.4) with a cop within ~4.2 units for 2.4 seconds | Bail: **$50 + $25 × stars** |
| **SLEEPING WITH THE FISHES** | You drove into the water (river, bay, ocean) | None |

The game-over screen shows the time survived, cash earned this run, max stars, cops wrecked and your best time.

---

## 4. The world: real NYC

- **Map:** all five boroughs (**Manhattan, Brooklyn, Queens, The Bronx, Staten Island**) plus the **New Jersey waterfront** (Jersey City area). Coastlines, rivers and bays are hand-traced from real latitude/longitude and smoothed, so shorelines are clean curves.
- **Scale:** 1 game unit ≈ 18 meters. The world is about 2,860 × 2,750 units.
- **Streets:** each borough has its own **street grid** at its real angle (Manhattan's grid is tilted 29° like the real one). The streets are a procedural grid, not every real street. **Broadway** is a special diagonal avenue. **Central Park** fits the Manhattan grid exactly.
- **Wide arcade roads:** avenues and streets are deliberately wide, with 2+ lanes each way, double-yellow center lines, lane dashes, crosswalks, stop bars and curbs. Roads are drawn by the graphics shader, so they stay **razor-sharp at any screen resolution**.
- **Highways:** FDR Drive, West Side Highway, BQE, Belt Parkway, LIE, Cross Bronx and more, plus airport runways at **JFK** and **LaGuardia**.
- **25 bridges**, including the Brooklyn Bridge (Gothic stone arch towers and diagonal cable web), Manhattan, Williamsburg, Queensboro, RFK (3 spans), George Washington, Verrazzano, Whitestone, Throgs Neck, Bayonne, Goethals, Outerbridge, Marine Parkway, Cross Bay, Henry Hudson, Washington, Macombs Dam, Third Ave, Broadway, University Heights and Roosevelt Island. Bridges are elevated, with railings.
- **Zones:** parks (grass, slower driving), beaches (sand), cemeteries, plazas and airports.
- **Boats:** the Staten Island Ferry runs both ways, plus a tug, a barge and a harbor cruise boat.
- **114 neighborhood names** (Financial District, Harlem, Park Slope, Astoria, the Concourse, St. George…) pop up at the bottom of the screen as you drive. Rivers and bays are named too, as are bridges while you're on them.
- **Solid blocks ("force field"):** every city block is solid from sidewalk edge to sidewalk edge, so you can't squeeze between buildings or through backyards, even in the air. Roads, sidewalks, parks and plazas are always drivable.

### Buildings (procedural, by borough style)
- **Manhattan / Jersey City downtowns:** tall towers in two styles, **glass curtain-wall** (blue glass with a window-frame grid, sky reflections and sun glints) or **masonry with windows**. They step back in tiers, and the tallest get **Art Deco stepped crowns with spires**, mechanical penthouses with antennas, or helipads.
- **Walk-ups:** brick and stone with cornices, **fire escapes** on the street side, and colored **storefronts with awnings** that glow warm at night.
- **Brooklyn brownstones:** rows with cornices and stoops.
- **Queens and Staten Island suburbs:** small houses with pitched roofs and yards.
- **Rooftops:** AC units and the classic NYC **wooden water towers**.
- **Street props:** trees, street lamps (lit at night), fire hydrants (they spray water when hit), trash cans, newspaper boxes, benches, parked cars, halal carts, beach umbrellas, bushes, cones and tombstones. Props are **smashable**.

### Landmarks
Each landmark is a custom model, with heights exaggerated so it stands out. Its name pops up when you drive near it.

| Landmark | Notes |
|---|---|
| **Empire State Building** | Setbacks, Art Deco window stripes, lit crown, mooring mast, antenna |
| **Chrysler Building** | Silver stacked crown with sunburst points (glow at night), needle spire, eagles |
| **One World Trade Center** | Twisting glass taper, white ringed spire |
| **Flatiron Building** | Wedge shape at Broadway & 5th |
| **Washington Square Arch** | Marble arch + fountain |
| **Madison Square Garden** | Round ribbed drum with a window band |
| **Grand Central Terminal + MetLife Building** | Three arched windows, copper roof, clock; the MetLife slab behind |
| **Rockefeller Center** | 30 Rock, the skating rink, the gold Prometheus statue, flags, a lit Christmas tree |
| **Times Square** | Towers covered in the owner's brand billboards; Broadway runs through it |
| **Hudson Yards** | The copper Vessel + 30 Hudson Yards with the Edge sky deck |
| **Statue of Liberty** | On Liberty Island, with a star-shaped Fort Wood base |
| **Brooklyn Bridge** | Gothic arches and cable web |
| **Barclays Center** | Rusty oval, steel bands, green roof, entrance canopy |
| **Coney Island** | Wonder Wheel + Parachute Jump |
| **Yankee Stadium** | Field, seating and the white frieze |
| **Citi Field** | Ballpark |
| **Unisphere** (Flushing Meadows) | Steel globe, orbit rings, pool and fountain jets |
| **JFK / LaGuardia** | Runways + parked airliners |
| **Staten Island Ferry terminals** | Both ends of the ferry route |

---

## 5. Health, damage & the cops

### Damage rules (important design decision)
- **Only two things hurt the player:** **live cop cars** (ramming you or being rammed) and **water** (instant run end).
- **Do NOT hurt the player:** walls, buildings, props, parked cars, civilian cars and **wrecked** cop cars. Smash through anything.
- Cops *do* take damage from walls, from you and from hard ramp landings, so you can wreck them.
- **Repair gears (⚙)** instantly restore full health (see §6).

### Heat & wanted stars
| Stars | Heat needed | Max cops chasing | What shows up |
|---|---|---|---|
| ★ | 1 | 2 | NYPD cruisers |
| ★★ | 16 | 3 | More cruisers |
| ★★★ | 40 | 5 | + ESU SUVs |
| ★★★★ | 80 | 6 | + ESU Heavy (armored) + **helicopter** |
| ★★★★★ | 140 | 8 | More armored units |

**Heat sources:** smashing a prop +1.2 (a parked car +3), hitting a cop +2 (more for harder hits), hitting a civilian +1.5, wrecking a cop +10. While you're wanted, heat also climbs on its own (+0.45 per second).

**Heat only goes up during a run.** There's no way to lose the cops. The game is about surviving the escalating chase (the old "Cash Rules Customs" garages that cleared your stars were **removed on purpose**, see §11).

### Police units
| Unit | Top speed | Health | Notes |
|---|---|---|---|
| NYPD cruiser | 23.5 | 45 | Push bar, light bar |
| ESU SUV | 25.5 | 75 | 3★+ |
| ESU Heavy (armored) | 22 | 170 | 4★+, very heavy |
| Helicopter | — | — | 4★+, circles above you (visual pressure) |

Cops catch up when they fall behind (rubber-banding) and get slightly faster with each star. Cops that drown or get wrecked pay you **$100**.

### Civilians
Traffic follows the street grid: sedans, yellow cabs, trucks and MTA buses. Hitting them adds heat and stuns them briefly.

---

## 6. Pickups, power-ups & bonuses (all float above the road)

| Pickup | Look | Effect |
|---|---|---|
| **Cash stack** | Big tilted stack of green bills | **$50–$150** |
| **Briefcase** (10% of cash spawns) | Black case with gold trim | **$500** |
| **Nitro ⚡** | Spinning yellow lightning bolt with a blue ring | **4.5 seconds of boost:** ~50% more top speed and acceleration, with flames from the exhaust |
| **Repair gear ⚙** | Spinning steel gear with an orange hub | **Instant full repair** |

- Pickups spawn on the roads **ahead of you**: up to 7 cash, 3 nitro and 2 gears at a time. Gears spawn **2.5× faster when your health is under 60%**, and below 35% health a "LOW HEALTH — GRAB A ⚙ GEAR" hint appears.
- **Minimap colors:** green = cash, blue = nitro, orange = gears, flashing red/blue = cops.
- **Other income:**
  - **Wanted income:** +$2 × stars every second while wanted.
  - **High-speed bonus:** stay above 88% of top speed for **$20 + $10 × stars per second** (+$20 more during nitro). The HUD shows "HIGH-SPEED BONUS".
  - **Big air:** ramp jumps with 0.45 s or more of air time pay roughly **$150 per second of air + $25 × stars**, with "BIG AIR!" or "HUGE AIR!" (see §7).
  - **Wrecking or drowning a cop:** +$100.

---

## 7. Jump ramps

- Yellow-and-black **two-sided hump ramps** sit across avenues at the middle of a block, on about 13% of avenue blocks: roughly 100 in Manhattan, 260 in the Bronx and Staten Island each, and 600+ each in Brooklyn and Queens.
- Hit one at speed and you **launch**. Takeoff speed is about 0.62 × your speed, so at full speed you get ~1 second of air and ~3–4 units of height. Nitro means longer jumps.
- **In the air:** you fly ballistically with no steering grip. You clear small props and low things, but tall buildings and the block force fields still stop you.
- **Landing:** camera shake + dust. Air time of **0.45 s or more pays a cash bonus** and counts toward the "Big Airs" mission.
- Cops and civilians can fly off ramps too, and **hard landings damage cops**.
- Ramps are placed deterministically, so the same spots always have ramps.

---

## 8. Cars, upgrades & progression

### Player cars (garage)
| Car | Price | Top speed | Turning | Grip | Health | Feel |
|---|---|---|---|---|---|---|
| **Street Sedan** | Free | 24 | 2.7 | 7 | 100 | Balanced starter |
| **Yellow Cab** | $1,500 | 25.5 | 2.85 | 7.5 | 100 | Quicker, nimble, roof sign + checker stripe |
| **Electric Crossover** | $3,000 | 27 | 2.95 | 8 | 120 | Fast, grippy, roof rails |
| **Muscle Coupe** | $5,000 | 29 | 2.55 | 5.5 (drifty) | 90 | Fastest, hood scoop, stripes, spoiler, chrome |
| **Box Truck** | $8,000 | 21 | 2.25 | 8 | 220 | Slow tank, heavy (bullies cops) |

All cars have angled glass, hood/trunk/roof panels, bumpers, grilles, mirrors and wheels with rims.

### Upgrades (bought on the title screen, apply to all cars)
| Upgrade | Levels | Cost per level | Effect |
|---|---|---|---|
| **ENGINE** | 3 | $700 → $1,500 → $3,000 | +6% top speed per level |
| **ARMOR** | 3 | $500 → $1,100 → $2,400 | +22% max health per level |

### Side Hustles (missions & gifts)
Open them from the gold **MISSIONS & GIFTS** button on the title screen. A red badge shows how many rewards are ready to claim, and a pop-up appears mid-run when you complete one.

**Gifts**
- **Daily gift:** $1,500, every 20 hours
- **Hourly gift:** $150, every hour

**Mission ladders** (lifetime progress; claim a tier to unlock the next one)
| Mission | Tier targets | Rewards |
|---|---|---|
| Wreck cops | 3 → 10 → 25 → 60 → 150 → 400 | $400 → $20,000 |
| Collect cash | $2K → $10K → $40K → $120K → $400K → $1M | $300 → $60,000 |
| Big airs off ramps | 3 → 12 → 35 → 80 → 200 → 500 | $400 → $25,000 |
| Grab nitro | 3 → 12 → 35 → 80 → 200 → 500 | $400 → $25,000 |
| Grab repair gears | 2 → 8 → 20 → 50 → 120 → 300 | $300 → $20,000 |
| Drive (km) | 5 → 25 → 80 → 200 → 500 → 1,200 | $300 → $30,000 |
| Hit max heat | 2★ → 3★ → 4★ → 5★ | $500 → $5,000 |
| Survive one run | 1:00 → 2:00 → 3:00 → 5:00 → 7:30 → 10:00 | $400 → $15,000 |

### Saving
Everything saves on the device (browser localStorage, key `crnyc_wanted_v1`): bank, owned cars, current car, paint, upgrades, best run, max stars, lifetime stats, mission tiers, gift timers and settings. There are **no accounts and no server**.

---

## 9. Screens & UI

- **Title screen:**
  - Logo, best run, bank
  - Car selector with stat bars (Speed / Grip / Armor), plus a **BUY** button for locked cars
  - Borough picker
  - **PLAY** button
  - **ENGINE / ARMOR** upgrade buttons
  - **MISSIONS & GIFTS** button with a badge
  - Toggles: **AFTER DARK** (night mode), **SOUND**, **SHADOWS**
  - Control tips
- **In-game HUD:**
  - Stars, bank, health bar and run timer (top left)
  - Rotating **minimap** (top right; tap it to pause)
  - Pause button
  - Hint line: bust warning, nitro meter, low health, high-speed bonus
  - Big center messages (stars, NITRO!, BIG AIR!, FULL REPAIR)
  - Small toasts (cash, cop wrecked, mission complete)
  - Neighborhood / landmark label at the bottom
  - On phones, left/right touch indicators
- **Pause screen:** full city map with your position, resume, quit, and a night toggle.
- **Game over screen:** ending title, run stats, best time, **RUN IT BACK** and **GARAGE** buttons.
- **Camera:** steep ~66° top-down angle, rotated slightly, that looks ahead in the direction you're driving and zooms out with speed. **Building slicing:** any building between the camera and your car is cut down to a solid roof, so you can always see your car. There's no see-through effect. Landmarks get cut less so they keep their shape. If a landmark still covers your car, a yellow car outline shows through.
- **Audio:** all sound is synthesized live (engine pitch follows speed, police siren, crashes, smashes, cash blips, nitro whoosh). There are **no audio files and no music yet**.

---

## 10. Tech architecture (for developers / AI assistants)

### Hard rules (don't break these)
1. **The whole game ships as ONE self-contained file:** `dist/index.html`. **No JavaScript libraries, no CDNs, no game engines.** The renderer is hand-written **WebGL2**. The only external request is Google Fonts (Bungee + Russo One), and the game falls back cleanly without it.
2. **Edit only the `src/` files**, then run `python3 build.py` to rebuild `dist/`. Never hand-edit `dist/index.html`. Commit the rebuilt `dist/` too.
3. **Mobile first** (iPhone portrait). Every UI change must work at 390×844 with safe areas.
4. **Hosting:** Netlify, linked to GitHub `main`. Every push to `main` auto-deploys to hotcarnyc.netlify.app. `netlify.toml` runs `python3 build.py` and publishes `dist/`.
5. Source files must never contain the literal text `</script` (the build checks for it).

### Files
| File | Role |
|---|---|
| `src/index.html` | All CSS and the HTML overlays (title, missions sheet, HUD, pause/map, game over). The build injects the JS into it. |
| `src/data.js` | **Map data:** hand-traced coastline polygons for each borough, islands, parks/beaches/airports/cemeteries, highways, runways, 25 bridges, spawn points, 114 neighborhood labels. |
| `src/map.js` | Lat/lon → world projection, the rasterized borough/zone map, **street grids**, road widths, highway/bridge segments, `tileAt()` (what surface is at a point), smooth coastline math, the ground-texture painter. |
| `src/chunkgen.js` | **World generation:** builds each 48×48-unit chunk (ground texture, buildings, props, colliders, billboards, landmarks, ramps, solid block force fields). Runs inside a **Web Worker** so it doesn't stutter the game. |
| `src/gl.js` | **Renderer:** instanced beveled boxes (everything is a box), shadow mapping, ground shader (draws roads analytically, so they're always sharp), materials (windows, glass towers, storefronts, Art Deco, lamps), building slicing, billboards. |
| `src/world.js` | Chunk streaming around the player, collision lookups, bridge 3D geometry, boats. |
| `src/vehicles.js` | Car models (built from parts), arcade driving physics, **ramp/air physics**, collisions, cop AI, civilian AI, particles. |
| `src/game.js` | Game rules: heat/stars, spawning, damage, pickups (cash/nitro/gears), big-air bonus, missions/gifts, HUD, minimap and big map, sound, saving, input, camera, main loop, adaptive quality, `?fps=1` overlay. |
| `src/sw.js` | Service worker for **Add to Home Screen + offline play** (network-first, so updates still arrive). |
| `build.py` | Stitches `src/` into `dist/index.html`, writes the PWA manifest, icons and service worker. |
| `assets/icons/` | App icons (green "CR" + gold stars + red WANTED badge on dark). |
| `test/` | Node/Playwright test scripts (gameplay flow, chaos runs, map render, chunk timing). |
| `CLAUDE.md` | Detailed developer notes: formats, coordinates, tuning knobs, testing. |

### Key technical ideas
- **Everything visible is a box:** buildings, cars, trees and even gears are instanced, beveled (rounded-edge) cubes with a color and a "material" number. That's what makes thousands of objects cheap to draw on a phone.
- **Streaming:** only chunks within ~2.4 chunks of the player are generated and kept. Generation happens in Web Workers.
- **Deterministic:** the same street always has the same buildings, props and ramps (hash-based randomness), so the world is consistent between runs.
- **Ground:** roads, sidewalks and markings are computed per pixel in the shader from the grid math, so there's no blurry texture stretching on retina screens.
- **Adaptive quality:** starts at the device's full resolution (up to 2×). If FPS drops it first lowers shadow quality, then resolution, but keeps at least 1.5× on iPhones unless the game is really struggling. It scales back up when things run smoothly.
- **Debug:** add `?fps=1` to the URL for a live FPS / resolution / draw-count overlay. `window.__sim(seconds, steer)` steps the game logic without rendering (used by the tests).

### How to run locally
```bash
python3 build.py                      # build src/ -> dist/
python3 -m http.server 8080 -d dist   # play at http://localhost:8080
node test/flow_node.js                # gameplay flow + chaos test (needs Playwright)
```

---

## 11. Version history (what changed and why)

1. **Original build:** the five-borough map, cops, stars, 17 "Cash Rules Customs" garages (a respray or repair cleared your stars), 5 cars, landmarks, night mode.
2. **Visual overhaul:** removed the "see-through building" effect and replaced it with a steeper camera + solid building slicing. Rounded box edges, sharper roads and smooth coastlines, detailed car models.
3. **More building styles + PWA:** glass towers, Art Deco crowns, storefronts, fire escapes, brownstones. Add to Home Screen, offline mode, `?fps=1` overlay.
4. **Sharper picture + recognizable landmarks:** roads drawn by the shader, a better resolution policy, rebuilt landmarks, the Flatiron and Washington Square Arch added, landmark name pop-ups.
5. **Damage rules:** only cops and water hurt you. Sharp highways. MSG, Grand Central, MetLife, Rockefeller Center and Hudson Yards added.
6. **Solid blocks:** no squeezing through backyards. Landmarks snapped to their blocks, and Broadway opened through Times Square.
7. **Pickups & power-ups:** bigger cash, nitro boosts, the high-speed bonus. (Customs briefly became ~178 open drive-on pads.)
8. **Arcade layout:** wider roads, **jump ramps** with air physics and the big-air bonus, **Side Hustles** missions + daily/hourly gifts.
9. **Current:** **Cash Rules Customs removed completely** (garages, pads, menu, compass, minimap icons, the related mission). **Repair gears** added for instant full repair. Engine/armor upgrades moved to the title screen. Paint/respray was removed with the shop.

**Deliberately removed, so don't re-add without the owner asking:** Cash Rules Customs (any form of shop or garage that clears wanted level), the see-through building dither, damage from walls/props/civilians/wrecks.

---

## 12. Known limitations & ideas for the future

**Limitations**
- Streets are a procedural grid per borough, not every real NYC street. Buildings are procedural, and their heights are compressed.
- The Bronx/Westchester and Queens/Nassau edges are treated as water. Very narrow channels (under ~36 m) are smoothed away.
- Real-iPhone frame rate hasn't been formally measured yet (use `?fps=1`).
- No music tracks yet (only synthesized sound effects).
- No way to change paint color right now (the respray left with the shop).
- The helicopter is visual pressure only. It doesn't attack.

**Roadmap ideas**
- **Music:** in-game radio with CASH RULES NYC / NYC DJ tracks (great brand tie-in).
- **More 5★ heat:** roadblocks, spike strips, an armored "tank" tier, police boats on the rivers.
- **Main missions / deliveries** per borough, daily challenges.
- **Online leaderboard** (needs a small backend, e.g. Netlify Functions).
- **Cosmetics:** paint colors on the title screen, wraps, rims, neon underglow, more cars.
- **Real street geometry** baked from OpenStreetMap.
- Possible shared lobby with the owner's **Shaolin City** multiplayer project.
- Monetization ideas: brand billboards, merch links, unlockable cars/cosmetics.

---

## 13. Notes for an AI assistant reading this

- Treat **§10's hard rules** as non-negotiable: one HTML file, no libraries, edit `src/` and rebuild, mobile-first.
- Before proposing a gameplay change, check **§11** for features that were removed on purpose.
- Numbers in this file come from the code as of the date above. If you have the repo, `src/game.js` and `src/vehicles.js` are the source of truth for tuning, and `CLAUDE.md` has developer-level detail (data formats, coordinate system, shader notes).
- The owner prefers **practical, execution-focused** suggestions that improve fun, retention and brand monetization.

# Audit & Roadmap: code vs. Master Game File v2.0

**Date:** November 13, 2026 · **Code audited:** `main` after commit `9287434` (+ the Phase 0 changes below)
**Method:** read the source, ran the automated tests, measured police behavior and render load in a headless browser.
**Not done:** testing on a real iPhone. I have no device access; see §4.

---

## 1. Conflicts between the code and the master file

| # | Master file says | Code does | Status |
|---|---|---|---|
| C1 | §8/§21: no money loss on any ending | BUSTED deducted bail ($50 + $25 × stars) | **Fixed in Phase 0** (see §6) |
| C2 | §21: interrupted sessions can't erase rewards | Saved only on game over, menus, pagehide/hidden. A crash or OOM kill mid-run could lose recent earnings | **Fixed in Phase 0** (5 s autosave) |
| C3 | §26: game over shows the permanent bank balance + personal records | Showed run cash, max stars, wrecks, best time; no bank, no records | Bank **added in Phase 0**; records are planned (Phase 5) |
| C4 | §6: camera "rotates with the vehicle" | Camera keeps a **fixed** compass direction (rotated −16°); it follows, looks ahead and zooms with speed, but does **not** turn with the car. The minimap is fixed the same way | **Owner decision needed** (see §7) |
| C5 | §1, §47: "steal a vehicle", §10.3/§19 "vehicle changes" | No in-run vehicle switching exists; you keep the car you picked | Not implemented (planned, needs design, see §7) |
| C6 | §10.4: police must not ignore road geometry | Cops steer straight at you (with lead aim); solid blocks keep them on roads (97–99%), but they **jam on block corners 18–27% of the time** (§3) | Weakness; Phase 3 |
| C7 | §10.4: police must not know your exact position through obstacles | Every cop always targets your exact live position | Phase 3 (last-known-position) |
| C8 | §19/§20 mention "businesses interacted with / robbed" | No business system exists | Future only; nothing to fix |
| C9 | §22: saved "paint" | Paint is still saved, but there's no way to change it since the respray shop was removed | Harmless; becomes useful if cosmetics return (§40) |
| C10 | §44 lists Python tests | `test/flow.py`/`chaos.py` need Python Playwright (not installed here) and were only lightly maintained; `test/flow_node.js` is the maintained, passing suite | Keep Node suite as primary |
| C11 | §4.4 "25 bridges" | `GEO.BRIDGES` has 25 entries, counting the RFK as 3 spans and the Governors Island ferry ramp | Documentation nuance only |

Everything else checked out against the code: control scheme, damage rules, heat sources and star thresholds, unit stats, spawn caps (7 cash / 3 nitro / 2 gears), nitro (4.5 s, 1.5×), gears (2.5× spawn below 60%, hint below 35%), bonuses, ramps (0.62× takeoff), vehicle stats and prices, upgrade costs, mission ladders and gifts, save key, the PWA, single-file build, no libraries, deterministic world.

## 2. Incomplete systems (described in the file, partly or not built)

| System | Exists today | Missing |
|---|---|---|
| Run statistics (§19) | Time, run cash, max stars, cops wrecked; lifetime: cops, cash, airs, nitros, gears, km, runs | Per-run distance, boroughs visited, landmarks discovered, airtime, jumps, speed-bonus earnings, longest 5★ pursuit, per-run pickups |
| Personal record book (§20) | Best survival time only | Everything else |
| Save reliability (§22, §33D) | Defaults merged on load (`Object.assign`) | Version field, explicit migrations, validation of corrupt/NaN values |
| Economy centralization (§33B) | All earnings go through `addCash` | Purchases (car, upgrade, gift/mission claims) write `SAVE.bank` directly; no single spend/credit API |
| Perf overlay (§33F) | fps, worst frame, resolution, shadow, boxes, draw calls, chunks | Police/traffic counts, frame-time graph, memory |
| Distance-based simulation (§33E) | Cops/civilians despawn beyond range | Lower-rate simulation for far units |
| Adaptive police (§10.3) | Rubber-banding + slight speed-up per star | Roles, route awareness, behavior tracking, interception, roadblocks |
| Helicopter (§10.1) | Follows you (visual) | Any gameplay effect |

## 3. Biggest technical and gameplay weaknesses (measured)

1. **Police get stuck (gameplay, highest impact).** In 25-second runs at 5★, the share of cop samples where a cop was nearly stopped more than 8 units from you: **Manhattan 20%, Brooklyn 27%, Queens 18%**. Cause: `copAI` aims straight at you, and when a block is in between it grinds along the force field until the unstick routine kicks in. This makes 5★ easier and less dramatic than the numbers suggest, and it breaks the §10.4 fairness rules.
2. **Five-star pressure is mostly "more cars".** Heat only rises (correct per §9), but there are no tactics: no interception, roadblocks or helicopter effect. 5★ arrives within a few minutes in every run, and after that the chase doesn't escalate.
3. **Render load on iPhone is unmeasured and significant.** Per frame in dense areas (main pass, plus a shadow pass of the same objects with simpler boxes):

   | Area | Boxes | Triangles (main pass) | Draw calls | Loaded chunks | Ground textures |
   |---|---|---|---|---|---|
   | Midtown | 8,811 | ~388K | 7 | 26 | ~9 MB |
   | FiDi | 8,923 | ~393K | 9 | 25 | ~9 MB |
   | Brooklyn | 13,338 | ~587K | 9 | 27 | ~9 MB |
   | Queens | 12,509 | ~550K | 10 | 24 | ~9 MB |

   Draw calls are very low (good). Triangle count is the risk: Brooklyn/Queens rowhouse blocks are the heaviest, not Manhattan. Recent iPhones should handle this. Older ones (and Low Power Mode) may not, which is why device numbers come first.
4. **Streaming at nitro speed is untested.** Nitro is ~35 units/s, and the stream radius is ~115 units (~3 s of lookahead). Workers generate a chunk in roughly 10–40 ms on desktop, which should keep up, but it's unverified on a phone.
5. **Save robustness.** No schema version, and corrupt values (e.g. NaN bank) aren't repaired.
6. **No vehicle switching**, even though "steal a faster vehicle" is in the product definition (§47).

## 4. iPhone performance evaluation

**Honest status: not measured on a device.** Headless software rendering (about 2 fps) can't stand in for an iPhone, and the master file (§36) requires real-device testing. What I can say from the numbers above is that draw calls are not a concern, triangle count is the main cost, and adaptive quality will drop shadows first, then resolution (never below 1.5× on retina unless under 26 fps).

**Baseline test for the owner (10 minutes, this unlocks Phase 1):**
1. Open `https://hotcarnyc.netlify.app/?fps=1` in Safari (not the home-screen app, so the address bar parameter works). Low Power Mode **off**.
2. Note the top line (fps · worst ms) and the second line (resolution · shadow) in these spots:
   - a) Midtown at 0★, b) Midtown at 5★, c) Brooklyn (Park Slope) at 5★, d) Queens at 5★.
3. Drive for 10 minutes straight and note whether the phone gets hot and whether fps drops over time.
4. Repeat (b) with Low Power Mode **on**.
5. Send the numbers (or screenshots) plus the iPhone model.

## 5. Prioritized roadmap (small, testable phases)

| Phase | What | Why (master file) | How we'll know it worked |
|---|---|---|---|
| **0 (done now)** | Master file v2.0 in repo; no bail; 5 s autosave; bank on game-over | §8, §21, §26 required changes | Tests below (§6) |
| **1** | iPhone baseline (owner, §4 above) → then targeted perf work **only where the numbers say**: e.g. plain (unbeveled) boxes for small/far objects, lighter rowhouse rooftops, perf overlay additions (§33F) | §35/§36 | ≥ 60 fps on a modern iPhone in all four test spots, stable over 10 min |
| **2** | Save reliability: schema version + migration + value validation + single credit/spend API for all money movement | §21, §22, §33B/D | Old saves load unchanged; corrupt values repaired; tests for every credit/spend path |
| **3** | Police AI step 1: **road-aware pursuit** (route via grid intersections when a block is in the way), better unstick, **last-known-position** when you're out of sight | §10.3B, §10.4 | Stuck rate from **18–27% → under 5%**, measured with the same test |
| **4** | Police AI step 2: **roles** (chaser / flanker / interceptor ahead of you) and **4–5★ roadblocks**; then light behavior tracking (speed, highway use) to pick tactics | §10.3A/D/E, §39 P2 | 5★ survival time drops in tests, and chases visibly use flanks and blocks; still fair (no spawns in view, no teleports) |
| **5** | Run statistics + **personal record book** (local), records on the game-over screen | §19, §20, §26 | All §19 stats tracked; records persist |
| **6** | **Vehicle stealing** (design needed, see §7) | §1, §47 | Owner sign-off on the design first |
| Later | Living city (traffic density/behavior, events), more landmarks/discovery, cosmetics (paint returns here), radio/music, police expansion (spike strips, boats, helicopter role) | §39 P3–P5, §40 | Evaluated one at a time |

## 6. Phase 0: change report

**What changed**
- Replaced `docs/GAME_MASTER.md` with Master Game File v2.0 (verbatim) and added this audit.
- BUSTED no longer charges bail. No ending removes money.
- During a run, the game saves every 5 seconds whenever the bank changed (in addition to the existing saves on game over, menus and app hide).
- The game-over screen shows "BANK $X · ALL EARNINGS KEPT".
- `CLAUDE.md` now points to the master file as design authority, and documents the new economy rule.

**Files modified:** `src/game.js`, `src/index.html`, `CLAUDE.md`, `docs/GAME_MASTER.md`, `docs/AUDIT_ROADMAP.md`, `dist/*` (rebuilt).

**Existing behavior preserved:** busted detection (same thresholds), every reward value, purchases, missions/gifts, controls, camera, rendering, world, police and damage rules.

**Testing (headless Chromium, actual results)**
- BUSTED: bank 250 → 250, stored save 250, message shown. WASTED and SLEEPING WITH THE FISHES: change 0.
- Autosave: earned $777 + bonuses mid-run, and after 6 s the stored save held $1,076 of the $1,080 live balance (within one 5 s window).
- `test/flow_node.js`: drive, wanted (4★), gear repair 20 → 100 HP, water ending, 5★ chaos in all five boroughs with no errors or NaNs.
- Damage check: all player damage came from live cops. Missions/gifts claim test: $250 → $2,150, correct.

**Known limitations:** not tested on an iPhone. Up to 5 seconds of earnings can still be lost if the app is killed without iOS firing a hide event.

**Next recommended task:** the iPhone baseline test in §4. Its numbers decide whether Phase 1 perf work is needed before police AI.

## 7. Decisions needed from the owner

1. **Camera rotation (C4).** The file says the camera rotates with the vehicle, but it currently keeps a fixed orientation. A fixed view is easier to read on a phone, keeps the map and minimap stable, and is how most top-down chase games work. A rotating camera can cause motion sickness and makes the minimap harder to use. **Recommendation:** keep it fixed and update §6 of the master file. If you want rotation, it can be an option in settings.
2. **Vehicle stealing (C5).** Proposal: at 0–2★, roll up next to a civilian car and hold brake for 1 second to jack it. It's a temporary ride for that run only, and doesn't add to your garage, so purchases still matter. Confirm or adjust.
3. **Paint (C9).** Fold it into Phase "Later" cosmetics (title-screen paint picker), or drop it from the save.

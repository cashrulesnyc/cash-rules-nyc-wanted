# CASH RULES NYC: WANTED

## MASTER GAME FILE & DEVELOPMENT DIRECTIVE

- **Document version:** 2.0
- **Updated:** November 12, 2026
- **Owner:** DJ / CASH RULES NYC LLC
- **Live game:** https://hotcarnyc.netlify.app
- **Repository:** https://github.com/cashrulesnyc/cash-rules-nyc-wanted
- **Branch:** main
- **Hosting:** Netlify, automatic deployment from GitHub
- **Status:** Existing playable prototype, active development

> **DOCUMENT AUTHORITY:** This document supersedes previous general game briefs and design proposals. It combines the existing implementation, verified gameplay rules, approved design decisions, technical requirements and future development direction.

---

# PART I: PRODUCT IDENTITY

## 1. THE GAME

CASH RULES NYC: WANTED is an endless, open-city arcade driving and police pursuit sandbox built around a stylized recreation of New York City.

Players select a vehicle and starting borough, enter the city, explore freely, smash objects, collide with traffic, accumulate heat, attract increasingly aggressive NYPD units, collect cash and power-ups, and attempt to survive increasingly dangerous police pursuits.

The game combines:

- The freedom of GTA-style open-world exploration.
- The immediate accessibility of arcade pursuit games.
- The colorful, readable voxel presentation of miniature city games.
- The replayability of endless survival games.
- The geographic identity of New York City.

The primary attraction is not completing a traditional story campaign.

It is the freedom to enter a massive NYC environment, steal a vehicle, cause chaos, reach five wanted stars, and see how long you can survive.

A player should be able to open the game, immediately start driving, and create an entirely different experience every session.

**Core tagline: RUN THE CITY. BEAT THE ODDS.**

## 2. OFFICIAL DESIGN DECISIONS

These decisions are locked and must guide all future development.

| Category | Official decision |
|---|---|
| Camera | Elevated, angled 3D perspective |
| World | One seamless, connected NYC map |
| Sessions | Endless sandbox |
| Police | Adaptive tactical AI |
| Economy | Fully permanent progression |
| Platform | iOS first |
| Controls | Mobile-first touch |
| Visual style | Stylized voxel / low-poly |
| Multiplayer | Not part of initial release |
| Campaign | No mandatory story campaign |
| Primary objective | Open-city exploration and survival pursuits |

### Important distinction: Existing versus intended features

The existing implementation is the foundation.

Future design improvements must be identified as planned improvements rather than falsely represented as existing functionality.

The game is not being restarted. It is being developed forward.

---

# PART II: GAMEPLAY AND WORLD

## 3. CORE GAMEPLAY LOOP

1. Open the title screen.
2. Select a vehicle.
3. Select a starting borough.
4. Purchase available upgrades.
5. Claim available Side Hustles and gifts.
6. Press PLAY.
7. Drive freely.
8. Smash environmental objects and collide with traffic to build heat.
9. Attract police and accumulate wanted stars.
10. Collect floating cash, nitro and repair gears.
11. Hit ramps for airtime bonuses.
12. Survive as long as possible.
13. Get WASTED, BUSTED or SLEEPING WITH THE FISHES.
14. Review the session statistics.
15. Keep all earned money.
16. Purchase vehicles or upgrades.
17. Start again.

The game must remain enjoyable without completing missions.

Players should be able to spend an entire session simply driving around NYC and escalating their wanted level.

There is no mandatory mission progression.

There is no traditional ending.

## 4. THE NYC WORLD

### 4.1 Geography

The playable environment includes:

- Manhattan.
- Brooklyn.
- Queens.
- The Bronx.
- Staten Island.
- The New Jersey waterfront, including Jersey City.

The world is a single connected environment.

Boroughs are geographic regions, not separate levels.

The player should be able to travel between them without conventional loading screens.

The existing map is based on hand-traced geographic coastline data and procedural street grids.

Preserve the current map and its established coordinate system.

### 4.2 World dimensions

- Approximate world size: 2,860 × 2,750 game units.
- Scale: approximately 1 game unit = 18 meters.
- Manhattan street grid angle: approximately 29 degrees.
- Broadway: special diagonal avenue.
- Central Park: aligned to the Manhattan grid.

The street system is an arcade-friendly procedural representation, not a complete reproduction of every real NYC street.

Preserve this distinction.

### 4.3 Roads and highways

Existing road systems include:

- FDR Drive.
- West Side Highway.
- Brooklyn-Queens Expressway.
- Belt Parkway.
- Long Island Expressway.
- Cross Bronx Expressway.
- JFK airport runways.
- LaGuardia airport runways.
- Major avenues and neighborhood streets.

Roads have wide arcade-oriented driving surfaces, lane markings, double-yellow center lines, crosswalks, stop bars and curbs.

Roads are analytically rendered through the ground shader to maintain sharpness at different resolutions.

### 4.4 Bridges

Preserve the existing 25 bridge structures, including:

- Brooklyn Bridge.
- Manhattan Bridge.
- Williamsburg Bridge.
- Queensboro Bridge.
- RFK Bridge.
- George Washington Bridge.
- Verrazzano-Narrows Bridge.
- Whitestone Bridge.
- Throgs Neck Bridge.
- Bayonne Bridge.
- Goethals Bridge.
- Outerbridge Crossing.
- Marine Parkway Bridge.
- Cross Bay Bridge.
- Henry Hudson Bridge.
- Washington Bridge.
- Macombs Dam Bridge.
- Third Avenue Bridge.
- Broadway Bridge.
- University Heights Bridge.
- Roosevelt Island connections.

Bridges must remain physically elevated with appropriate railings and road connectivity.

### 4.5 Neighborhoods

Preserve the 114 existing neighborhood labels.

Display neighborhood names dynamically as the player travels.

Also identify:

- Rivers.
- Bays.
- Bridges.
- Landmarks.
- Borough boundaries.

### 4.6 City blocks and collision

Every city block has a solid force-field collision boundary.

Players cannot squeeze through buildings or backyards.

Roads, sidewalks, parks and plazas remain drivable.

Preserve this system unless the owner explicitly approves a different environmental collision design.

### 4.7 Procedural architecture

Maintain distinct borough building styles.

**Manhattan and Jersey City**

- Glass curtain-wall skyscrapers.
- Masonry towers.
- Art Deco crowns.
- Antennas and helipads.
- Mechanical rooftops.
- Stepped building silhouettes.

**Brooklyn**

- Brick walk-ups.
- Brownstones.
- Stoops.
- Cornices.
- Fire escapes.
- Commercial storefronts.

**Queens and Staten Island**

- Smaller residential houses.
- Pitched roofs.
- Yards.
- Suburban blocks.

**Common rooftop and street details**

- Water towers.
- Air-conditioning units.
- Streetlights.
- Fire hydrants.
- Trees.
- Trash cans.
- Newspaper boxes.
- Benches.
- Halal carts.
- Parked vehicles.
- Beach umbrellas.
- Cones.
- Tombstones.

Environmental props are smashable.

### 4.8 Landmarks

Preserve existing custom landmark models:

- Empire State Building.
- Chrysler Building.
- One World Trade Center.
- Flatiron Building.
- Washington Square Arch.
- Madison Square Garden.
- Grand Central Terminal.
- MetLife Building.
- Rockefeller Center.
- Times Square.
- Hudson Yards.
- Vessel.
- Statue of Liberty.
- Brooklyn Bridge.
- Barclays Center.
- Coney Island.
- Yankee Stadium.
- Citi Field.
- Unisphere.
- JFK.
- LaGuardia.
- Staten Island Ferry terminals.

Landmarks should remain recognizable and should not be replaced with generic procedural buildings.

The landmark discovery system should be expanded over time.

---

# PART III: THE PLAYER EXPERIENCE

## 5. VEHICLE CONTROLS

The car accelerates automatically.

The player primarily controls steering and braking.

| Action | Touch | Keyboard |
|---|---|---|
| Steer left | Hold left half | Left arrow / A |
| Steer right | Hold right half | Right arrow / D |
| Brake/reverse | Hold both halves | Down arrow / S / Space |
| Pause/map | Minimap or pause | P / Esc / M |

Preserve the current control scheme.

Do not introduce unnecessary buttons that make the mobile screen crowded.

Nitro and repair pickups activate automatically when collected.

## 6. CAMERA

The current camera is an elevated, steeply angled perspective of approximately 66 degrees.

It:

- Tracks the player's vehicle.
- Looks ahead in the direction of travel.
- Rotates with the vehicle.
- Zooms out with speed.
- Maintains visibility during driving.

Building slicing is essential.

Buildings between the camera and player are cut down to solid roof representations.

There is no transparent see-through building effect.

Landmarks receive less aggressive slicing.

If a landmark still obscures the player, a yellow vehicle outline provides visibility.

Future camera improvements:

- Smoother camera acceleration.
- Better predictive positioning.
- More consistent zoom transitions.
- Reduced visual obstruction at intersections.
- Optional camera sensitivity settings.

Do not replace the established camera with a traditional behind-the-car perspective.

---

# PART IV: DAMAGE, HEAT AND POLICE

## 7. PLAYER DAMAGE RULES

These are established gameplay rules and must be preserved.

Only two things can endanger the player:

1. Active police vehicles.
2. Water.

### Damage exceptions

The following do NOT hurt the player:

- Walls.
- Buildings.
- Environmental props.
- Parked civilian vehicles.
- Moving civilian vehicles.
- Wrecked police vehicles.

The player can smash through these objects without losing health.

Police vehicles can take damage from:

- Collisions with the player.
- Walls.
- Other environmental collisions.
- Hard ramp landings.

Preserve these asymmetrical damage rules.

Do not introduce realistic collision damage to the player from ordinary traffic or buildings without explicit approval.

## 8. RUN ENDINGS

There are three official run-ending states.

### WASTED

The player's vehicle health reaches zero.

Cause: damage from active police vehicles.

### BUSTED

The player is nearly stopped while a police vehicle is within arrest range.

Existing thresholds:

- Player speed below approximately 2.4 units.
- Police distance within approximately 4.2 units.
- Condition persists for approximately 2.4 seconds.

### SLEEPING WITH THE FISHES

The player enters water.

Water is an immediate run-ending hazard.

### NEW ECONOMY RULE

All three endings have zero financial confiscation.

The previous BUSTED bail deduction of $50 + $25 per wanted star is removed.

This supersedes the previous implementation.

A run ending can affect the session score, but it cannot deduct permanent earnings.

## 9. HEAT AND WANTED STARS

Heat accumulates during a run.

It converts into wanted stars.

| Stars | Heat threshold | Maximum pursuing cops | Response |
|---|---|---|---|
| ★ | 1 | 2 | NYPD cruisers |
| ★★ | 16 | 3 | Additional cruisers |
| ★★★ | 40 | 5 | ESU SUVs |
| ★★★★ | 80 | 6 | ESU heavy units and helicopter |
| ★★★★★ | 140 | 8 | Maximum armored response |

Heat sources:

| Action | Heat |
|---|---|
| Smash ordinary prop | +1.2 |
| Hit parked car | +3 |
| Hit civilian | +1.5 |
| Hit police | +2, modified by impact |
| Wreck police vehicle | +10 |
| Remain wanted | +0.45 per second |

Heat only increases.

There is no wanted-level escape or cooldown mechanic.

The player is expected to survive an escalating pursuit until the run ends.

Do not reintroduce Cash Rules Customs or any garage, service station or shop that clears wanted stars.

## 10. POLICE SYSTEM: CURRENT AND FUTURE

### 10.1 Existing implementation

Current police units:

| Unit | Top speed | Health | Availability |
|---|---|---|---|
| NYPD cruiser | 23.5 | 45 | 1★+ |
| ESU SUV | 25.5 | 75 | 3★+ |
| ESU Heavy | 22 | 170 | 4★+ |
| Helicopter | N/A | N/A | 4★+ |

The helicopter currently provides visual pursuit pressure only.

Police cars use rubber-banding when falling behind.

Police become slightly faster as wanted stars increase.

Wrecked or drowned police vehicles reward $100.

### 10.2 Approved police design direction

The police system should evolve from basic pursuit spawning into coordinated, adaptive tactical AI.

However, this does NOT mean changing the fundamental endless chase rules.

Heat continues increasing. Wanted status never clears during a run. The police never simply give up.

Adaptive AI means that the police respond more intelligently to the player's behavior.

### 10.3 Adaptive police intelligence

Future improvements should include:

**A. Pursuit coordination**

Police units should have different roles.

Examples:

- Primary pursuing unit.
- Secondary pursuing unit.
- Flanking unit.
- Interception unit.
- Roadblock unit.
- Support unit.

They should not all follow the same exact path.

**B. Route awareness**

Police should use the existing road network to make better pursuit decisions.

They should anticipate:

- Intersections.
- Road exits.
- Bridge approaches.
- Narrow streets.
- Highway connections.
- Likely player routes.

**C. Player behavior tracking**

The game can track simple behavioral tendencies during the active run:

- Preferred driving speed.
- Frequency of hard turns.
- Highway usage.
- Ramp usage.
- Off-road movement.
- Repeated escape routes.
- Vehicle changes.
- Collision behavior.

Police tactics should adjust based on this information.

**D. Tactical interception**

Higher wanted levels should introduce:

- Coordinated roadblocks.
- Multiple interception angles.
- Better pursuit formations.
- Strategic unit placement.
- More aggressive attempts to box in the player.

**E. Resource escalation**

Police response should feel progressively more serious.

The highest wanted level should introduce genuinely challenging tactical pressure.

### 10.4 Fairness rules

Police must not:

- Spawn directly on top of the player.
- Teleport through buildings.
- Ignore road geometry.
- Make impossible turns.
- Have unlimited speed.
- Instantly know the player's exact location through obstacles.

Adaptive behavior must remain fair and grounded in the game's simulation.

### 10.5 Future police expansion

Possible future units:

- More specialized ESU vehicles.
- Armored response vehicles.
- Additional helicopter behavior.
- Spike-strip deployment.
- More advanced roadblocks.
- Police boats.
- More varied pursuit formations.

These are expansion ideas, not existing features.

Implement them only after the current pursuit system is stable.

---

# PART V: PICKUPS AND SPECIAL MECHANICS

## 11. CASH PICKUPS

Cash stacks float above the road.

- Value: $50–$150.
- Briefcases: 10% of cash spawns.
- Briefcase value: $500.

Pickups spawn ahead of the player.

Maximum simultaneous pickups:

- 7 cash.
- 3 nitro.
- 2 repair gears.

## 12. NITRO

Nitro is represented by a spinning yellow lightning bolt with a blue ring.

Effect:

- 4.5 seconds of boost.
- Approximately 50% additional top speed and acceleration.
- Exhaust flames.
- Distinctive audio effect.

Nitro is a temporary gameplay resource.

## 13. REPAIR GEARS

Repair gears are represented by a spinning steel gear with an orange center.

Effect:

- Instant full vehicle repair.

Spawn behavior:

- Normal spawn rate under ordinary health conditions.
- 2.5× spawn rate when player health falls below 60%.
- At below 35% health, display the LOW HEALTH hint.

Repair gears replaced the old customization/shop mechanics.

They must remain part of the core game.

## 14. ADDITIONAL EARNING MECHANICS

**Wanted income**

$2 × current wanted stars per second while wanted.

**High-speed bonus**

When driving above 88% of maximum speed:

- $20 + $10 × wanted stars per second.
- Additional $20 during nitro.

Display HIGH-SPEED BONUS.

**Big-air bonus**

Ramp jumps lasting at least 0.45 seconds earn approximately:

$150 per second of airtime + $25 × wanted stars.

**Police destruction**

Wrecking or drowning a police vehicle rewards $100.

**Permanent currency rule**

Every earned reward immediately contributes to the player's permanent currency balance.

A separate session-earnings counter may display how much was earned during the current run.

The session counter is for statistics only.

There is no vulnerable wallet, cash confiscation or financial reset.

---

# PART VI: RAMPS AND PHYSICS

## 15. JUMP RAMPS

The existing two-sided yellow-and-black hump ramps must remain.

They are positioned deterministically on selected avenue blocks.

Existing approximate distribution:

- Manhattan: 100.
- Bronx: 260.
- Staten Island: 260.
- Brooklyn: 600+.
- Queens: 600+.

Takeoff speed is approximately 0.62 × current speed.

At full speed, a typical jump produces approximately:

- 1 second of airtime.
- 3–4 units of height.

Nitro can extend jump distance and airtime.

In the air:

- Ballistic movement.
- No normal steering grip.
- Small props and low objects can be cleared.
- Tall buildings and solid block force fields remain obstacles.

Landing effects:

- Camera shake.
- Dust.
- Big-air rewards.
- Mission progression.

Police and civilian vehicles can also use ramps.

Hard landings can damage police vehicles.

Ramp placement should remain deterministic.

---

# PART VII: VEHICLES AND PROGRESSION

## 16. CURRENT VEHICLE GARAGE

Preserve the current five-vehicle lineup.

| Vehicle | Price | Speed | Turning | Grip | Health |
|---|---|---|---|---|---|
| Street Sedan | Free | 24 | 2.7 | 7 | 100 |
| Yellow Cab | $1,500 | 25.5 | 2.85 | 7.5 | 100 |
| Electric Crossover | $3,000 | 27 | 2.95 | 8 | 120 |
| Muscle Coupe | $5,000 | 29 | 2.55 | 5.5 | 90 |
| Box Truck | $8,000 | 21 | 2.25 | 8 | 220 |

Each vehicle has its own driving identity.

- **Street Sedan:** balanced starter.
- **Yellow Cab:** nimble urban vehicle.
- **Electric Crossover:** fast and grippy.
- **Muscle Coupe:** high-speed, drift-oriented.
- **Box Truck:** heavy, durable, slower vehicle.

Preserve the detailed car models, body panels, glass, bumpers, grilles, mirrors and wheel assemblies.

## 17. VEHICLE UPGRADES

Current upgrades:

**ENGINE**

- Level 1: $700.
- Level 2: $1,500.
- Level 3: $3,000.
- Approximately +6% top speed per level.

**ARMOR**

- Level 1: $500.
- Level 2: $1,100.
- Level 3: $2,400.
- Approximately +22% maximum health per level.

Upgrades apply to all player vehicles.

Preserve the current shared-upgrade behavior.

**Future upgrade opportunities**

Additional upgrade categories may eventually include:

- Grip.
- Braking.
- Handling.
- Nitro capacity.
- Repair efficiency.

Do not introduce these until the current upgrade system is properly tested and balanced.

---

# PART VIII: MISSIONS, GIFTS AND LONG-TERM PROGRESSION

## 18. SIDE HUSTLES

The current Missions & Gifts system is retained.

All mission progress is permanent and accumulates across sessions.

Tier rewards are claimed to unlock the next tier.

**Gifts**

Daily gift:

- $1,500.
- Every 20 hours.

Hourly gift:

- $150.
- Every hour.

**Mission ladders**

| Mission | Tier targets | Reward range |
|---|---|---|
| Wreck cops | 3 / 10 / 25 / 60 / 150 / 400 | $400–$20,000 |
| Collect cash | $2K / $10K / $40K / $120K / $400K / $1M | $300–$60,000 |
| Big airs | 3 / 12 / 35 / 80 / 200 / 500 | $400–$25,000 |
| Grab nitro | 3 / 12 / 35 / 80 / 200 / 500 | $400–$25,000 |
| Grab repair gears | 2 / 8 / 20 / 50 / 120 / 300 | $300–$20,000 |
| Drive distance | 5 / 25 / 80 / 200 / 500 / 1,200 km | $300–$30,000 |
| Hit maximum heat | 2★ / 3★ / 4★ / 5★ | $500–$5,000 |
| Survive one run | 1:00 / 2:00 / 3:00 / 5:00 / 7:30 / 10:00 | $400–$15,000 |

All existing reward values and thresholds should be verified against the source code before modification.

**Future mission expansion**

Potential future activities:

- Borough exploration.
- Landmark discoveries.
- Vehicle-specific challenges.
- Special pursuit challenges.
- High-speed records.
- Long-distance driving.
- Random city events.
- Delivery activities.

These should supplement, not replace, the existing Side Hustles.

---

# PART IX: SESSION STATISTICS AND RECORDS

## 19. RUN TRACKING

The current game-over screen displays:

- Survival duration.
- Cash earned during the run.
- Maximum stars.
- Police vehicles wrecked.
- Best time.

Expand the statistics system to track:

- Total distance.
- Boroughs visited.
- Landmarks discovered.
- Businesses interacted with.
- Cash collected.
- Nitro pickups.
- Repair gears collected.
- Ramp jumps.
- Total airtime.
- High-speed bonus earnings.
- Police vehicles destroyed.
- Vehicle changes.
- Longest five-star pursuit.
- Highest wanted level.
- Total session earnings.

## 20. PERSONAL RECORD BOOK

Introduce a permanent personal records section when practical.

Potential records:

- Longest survival.
- Longest five-star pursuit.
- Highest session earnings.
- Most police vehicles destroyed.
- Most landmarks discovered in one run.
- Most businesses robbed.
- Greatest distance traveled.
- Most ramp airtime.

Records should encourage repeat play.

Do not introduce online leaderboards as a dependency for this feature.

Local records can be implemented first.

---

# PART X: MONEY AND SAVE SYSTEM

## 21. PERMANENT ECONOMY: NON-NEGOTIABLE

This is an approved design change.

All money earned is permanent.

There is no money-loss mechanic when a run ends.

There is no bank transfer requirement.

There is no separate vulnerable cash wallet.

The bank balance shown in the current HUD represents the player's permanent total currency.

The run summary may show current-session earnings, but these are already included in the permanent total.

**Required changes to the existing system**

- Remove the arrest bail deduction.
- Remove any cash confiscation logic.
- Ensure all pickups credit permanent currency.
- Ensure all wanted and high-speed bonuses credit permanent currency.
- Ensure police destruction rewards credit permanent currency.
- Ensure mission and gift rewards credit permanent currency.
- Ensure vehicle purchases deduct currency correctly.
- Ensure interrupted sessions cannot erase completed rewards.

The player should always feel that time spent playing contributes to permanent progress.

## 22. LOCAL SAVE DATA

Current save location:

`localStorage`

Current key:

`crnyc_wanted_v1`

Saved information:

- Bank balance.
- Owned vehicles.
- Current vehicle.
- Paint.
- Upgrades.
- Best run.
- Maximum stars.
- Lifetime statistics.
- Mission tiers.
- Gift timers.
- Settings.

Preserve backward compatibility.

If the save schema changes, introduce a migration process rather than resetting player progress.

**Future persistence opportunities**

Cloud backup and cross-device synchronization may be considered later.

They are not initial release requirements.

Do not introduce accounts or a server dependency without explicit approval.

---

# PART XI: USER INTERFACE

## 23. TITLE SCREEN

Preserve the existing title screen design.

Current elements:

- CASH RULES NYC branding.
- WANTED badge.
- Best run.
- Permanent bank balance.
- Vehicle carousel.
- Vehicle statistics.
- Borough selection.
- PLAY button.
- ENGINE upgrade.
- ARMOR upgrade.
- MISSIONS & GIFTS.
- AFTER DARK.
- SOUND.
- SHADOWS.
- Control instructions.

The visual identity should remain recognizable.

Use the current green, yellow, black and red palette.

Avoid unnecessary interface redesign.

> **Revision 2.1 (owner instruction, November 13, 2026):** the title screen was judged too crowded and the old garage carousel was rejected. The title screen is now minimal: branding, WANTED badge, best run, bank, a single **START IN [borough]** selector, the **PLAY** button, and a three-button dock: **GARAGE**, **HUSTLES** (Missions & Gifts, with badge) and **SETTINGS** (After Dark, Sound, Shadows, control instructions). Vehicle selection and the Engine/Armor upgrades moved into the 3D Garage (§23.1).

### 23.1 GARAGE (added in revision 2.1)

- A dedicated 3D garage environment, rendered with the game's own engine.
- All five vehicles float and slowly rotate above glowing pedestals. Swipe (or ◀ ▶ / arrow keys) to move between them. The camera glides to the selected car.
- Locked vehicles appear dimmed with a red pedestal ring and a BUY button. Owned vehicles can be set as your ride.
- Engine and Armor upgrades are purchased here.
- **The garage itself is upgradable** with permanent currency:

| Level | Garage | Price |
|---|---|---|
| 1 | Street Lot | Free |
| 2 | Brooklyn Garage | $5,000 |
| 3 | Cash Rules Showroom | $20,000 |
| 4 | Penthouse Garage | $60,000 |

- Each level changes the environment (floor, walls, lighting, props, brand boards, pedestal style). The owned level is saved permanently.
- The game-over GARAGE button opens the Garage directly.

## 24. GAMEPLAY HUD

Existing elements:

- Wanted stars.
- Permanent cash balance.
- Health bar.
- Run timer.
- Minimap.
- Pause button.
- Mission notifications.
- Nitro notifications.
- Low-health warnings.
- High-speed bonus.
- Neighborhood and landmark labels.
- Touch indicators.

Keep the screen readable on iPhone portrait.

## 25. PAUSE AND MAP

The minimap can be tapped to pause.

The pause interface displays the full city map with the player's position.

Available actions:

- Resume.
- Quit.
- Night toggle.

The map should preserve the player's geographic context.

## 26. GAME OVER

Three ending screens:

- WASTED.
- BUSTED.
- SLEEPING WITH THE FISHES.

Display:

- Run duration.
- Run earnings.
- Permanent bank balance.
- Highest stars.
- Police destroyed.
- Best time.
- Personal records.

Buttons:

- RUN IT BACK.
- GARAGE.

The player keeps all earned money.

---

# PART XII: TECHNICAL ARCHITECTURE

## 27. NON-NEGOTIABLE TECHNOLOGY RULES

The current architecture is intentional.

The game is:

- Hand-written JavaScript.
- Hand-written WebGL2.
- No external game engine.
- No JavaScript libraries.
- No external rendering frameworks.
- No CDN dependencies.
- One self-contained generated HTML file.

The entire game ships as:

`dist/index.html`

The only existing external requests are Google Fonts (Bungee and Russo One), with local fallback behavior.

Do not migrate to Unity, Unreal, Three.js, Babylon.js, React, or another framework without a demonstrated technical necessity and explicit owner approval.

The existing architecture is an asset, not a problem to solve.

## 28. SOURCE FILE ORGANIZATION

| File | Responsibility |
|---|---|
| `src/index.html` | CSS and HTML overlays |
| `src/data.js` | Geographic map data |
| `src/map.js` | Geographic projection, grids, surfaces, ground rendering data |
| `src/chunkgen.js` | Procedural chunk generation |
| `src/gl.js` | WebGL2 rendering |
| `src/world.js` | Chunk streaming, collision lookups, bridges, boats |
| `src/vehicles.js` | Vehicles, physics, police AI, civilian AI, particles |
| `src/game.js` | Game rules, heat, stars, economy, pickups, missions, HUD, input, saves, camera, main loop |
| `src/sw.js` | PWA and offline service worker |
| `build.py` | Generates the final distribution |
| `assets/icons/` | Application icons |
| `test/` | Automated testing |
| `CLAUDE.md` | Developer notes and implementation guidance |

This is the existing source structure.

Future refactoring should be incremental.

Do not split or reorganize everything merely for aesthetic reasons.

## 29. BUILD PROCESS

The official build process:

```bash
python3 build.py
```

The official local test server:

```bash
python3 -m http.server 8080 -d dist
```

Gameplay flow:

```bash
node test/flow_node.js
```

The project must rebuild into `dist/index.html`.

Never hand-edit `dist/index.html`.

Always commit the rebuilt distribution file alongside source changes.

**Critical build rule**

Source files must never contain the literal text:

`</script`

The build process checks for this.

Maintain this restriction.

## 30. RENDERER

The existing renderer uses WebGL2.

Everything visible is represented through beveled, instanced boxes with material identifiers.

Objects include:

- Buildings.
- Vehicles.
- Trees.
- Props.
- Pickups.
- Landmarks.
- Environmental details.

The renderer uses:

- Instanced geometry.
- Material identifiers.
- Shadow mapping.
- Ground shaders.
- Window materials.
- Glass tower materials.
- Storefront materials.
- Art Deco details.
- Streetlight materials.
- Building slicing.
- Billboard rendering.

Roads and markings are computed analytically in the ground shader.

This is a key performance and visual-quality feature.

Preserve it.

## 31. WORLD GENERATION

The world is generated using 48 × 48-unit chunks.

Chunk generation runs inside a Web Worker.

Each chunk can contain:

- Ground texture.
- Buildings.
- Props.
- Colliders.
- Billboards.
- Landmarks.
- Ramps.
- Solid block force fields.

Generation is deterministic.

The same location should produce the same buildings, props and ramps across sessions.

Current streaming range is approximately 2.4 chunks around the player.

**Future improvements**

Evaluate:

- Smarter chunk preloading.
- Reduced unnecessary chunk regeneration.
- Improved memory cleanup.
- More efficient object reuse.
- Better performance during high-speed driving.

Do not break deterministic world generation.

## 32. VEHICLE AND GAME LOGIC

`src/vehicles.js` handles:

- Car construction.
- Arcade driving physics.
- Ramp physics.
- Air movement.
- Collisions.
- Police AI.
- Civilian AI.
- Particles.

`src/game.js` handles:

- Game state.
- Heat.
- Wanted stars.
- Spawning.
- Player damage.
- Pickups.
- Economy.
- Mission progression.
- Gifts.
- HUD.
- Minimap.
- Big map.
- Audio.
- Saving.
- Input.
- Camera.
- Main game loop.
- Adaptive quality.
- Debug overlay.

Maintain clear responsibilities.

If systems become too large, refactor only when there is a clear maintenance or performance benefit.

## 33. FUTURE ARCHITECTURAL IMPROVEMENTS

The existing architecture can be made more maintainable without changing the technology stack.

Priority improvements:

**A. Police AI separation**

Separate pursuit coordination from individual vehicle movement where this improves clarity and testing.

**B. Economy centralization**

Ensure all rewards and purchases pass through one consistent currency-management interface.

**C. Session statistics**

Create consistent tracking for run-based and lifetime statistics.

**D. Save reliability**

Add save versioning, migration and transaction validation.

**E. World simulation**

Use distance-based simulation for distant traffic and police.

**F. Performance diagnostics**

Expand the existing FPS overlay to include:

- Active chunk count.
- Active object count.
- Active police count.
- Active traffic count.
- Draw calls.
- Resolution scale.
- Frame time.
- Memory information where available.

Do not introduce architectural complexity without a measurable reason.

---

# PART XIII: iOS-FIRST DEVELOPMENT

## 34. PLATFORM STRATEGY

The current product is a mobile-first web game and installable PWA.

The immediate development priority is iPhone portrait.

The game should also remain functional in:

- iPhone landscape.
- Desktop browsers.
- Other mobile browsers.

The current PWA provides:

- Add to Home Screen.
- Offline play after the first load.
- Service-worker caching.
- Network-first update behavior.

**Important distinction**

iOS-first does not automatically mean abandoning the existing browser-based implementation.

The first objective is a polished, reliable, optimized iPhone experience.

A future App Store distribution strategy can be evaluated separately.

Do not initiate a native migration without evaluating:

- Performance.
- Rendering compatibility.
- Touch behavior.
- WebGL2 support.
- Offline operation.
- PWA limitations.
- App Store packaging options.

## 35. PERFORMANCE TARGETS

Target:

- 60 FPS on supported modern iPhones.
- Stable 30 FPS fallback when necessary.
- Responsive controls.
- No unnecessary loading interruptions.
- Controlled memory consumption.
- Stable extended sessions.

Current adaptive quality:

1. Begin at device resolution, up to 2×.
2. Reduce shadow quality if performance declines.
3. Reduce rendering resolution when necessary.
4. Maintain at least 1.5× on iPhones unless the device is struggling significantly.
5. Restore quality when performance improves.

Preserve the existing adaptive quality system and improve it based on real-device measurements.

## 36. DEVICE TESTING

Actual iPhone testing is required.

Desktop browser success is not sufficient.

Test:

- Initial loading.
- Touch responsiveness.
- Long sessions.
- High-speed movement.
- Maximum wanted level.
- High traffic density.
- Maximum active police.
- Chunk streaming.
- Background/foreground transitions.
- Save recovery.
- Offline play.
- Device thermal behavior.

The game must remain enjoyable during extended waiting-room-style sessions.

---

# PART XIV: BRAND AND INTELLECTUAL PROPERTY

## 37. BRAND INTEGRATION

The game is owned by CASH RULES NYC LLC.

Existing in-world brand billboards include:

- CASH RULES NYC.
- NYC DJ.
- BLUESCREENU.
- AI BEEN HERE.
- GAS GADGETS.
- MINITECH101.
- CASH RULES RECORDS.
- WANTED ★★★★★.

Preserve the existing branded billboard system.

Future opportunities include:

- More in-world advertisements.
- Optional music integration.
- Branded vehicles.
- Cosmetic content.
- Merch links.
- Optional brand experiences.

Brand integration should feel natural.

Do not turn the entire game into a storefront.

## 38. ORIGINALITY

All game code, models, textures, characters, art and branding must remain original.

The game may draw inspiration from the general mechanics of established arcade and open-world genres.

Never copy:

- Proprietary code.
- Existing game assets.
- Characters.
- Exact UI artwork.
- Protected level layouts.
- Distinctive proprietary designs.

CASH RULES NYC must establish its own recognizable identity.

---

# PART XV: APPROVED FUTURE ROADMAP

## 39. DEVELOPMENT PRIORITIES

The next stages must focus on improving the existing game, not endlessly expanding its feature list.

**PRIORITY 1: POLISH THE CORE EXPERIENCE**

- Driving physics.
- Camera responsiveness.
- Touch controls.
- Collision consistency.
- Performance.
- Save reliability.

**PRIORITY 2: POLICE AI**

- Coordinated pursuit behavior.
- Smarter interception.
- Better road navigation.
- More varied police tactics.
- Improved high-star escalation.
- More interesting five-star survival.

**PRIORITY 3: LIVING CITY**

- Improved traffic behavior.
- Better vehicle density.
- More environmental interactions.
- Additional business locations.
- Improved landmark discovery.
- More dynamic city events.

**PRIORITY 4: LONG-TERM PROGRESSION**

- Additional vehicles.
- Cosmetic customization.
- More missions.
- Better statistics.
- Landmark achievements.
- Personal records.

**PRIORITY 5: CONTENT EXPANSION**

- Additional police units.
- Roadblocks.
- Spike strips.
- Police boats.
- More random events.
- Borough-specific challenges.
- Optional music/radio.

## 40. FUTURE IDEAS, NOT CURRENT REQUIREMENTS

These features are approved as ideas to investigate, not automatic implementation tasks.

**Music and radio**

- Optional in-game radio.
- Original CASH RULES NYC / NYC DJ music.
- Radio stations and independent tracks.
- Music toggle and volume control.

**Advanced police response**

- Roadblocks.
- Spike strips.
- Additional armored units.
- Police boats.
- More complex helicopter behavior.

**City activities**

- Deliveries.
- Borough-specific activities.
- Additional business interactions.
- Exploration challenges.
- Special events.

**Cosmetics**

- Paint colors.
- Vehicle wraps.
- Rims.
- Neon underglow.
- Additional vehicle designs.

**Online functionality**

- Online leaderboards.
- Cloud saves.
- Optional shared experiences.
- Potential connection with the separate Shaolin City multiplayer project.

**Map expansion**

- Improved real-world street geometry.
- OpenStreetMap-derived road data.
- Additional geographic details.

Do not automatically implement all future ideas.

Evaluate each feature against performance, gameplay value, complexity and development cost.

---

# PART XVI: FEATURES THAT MUST NOT RETURN

## 41. DELIBERATELY REMOVED SYSTEMS

These are explicit owner decisions.

Do not reintroduce them without direct approval.

**Cash Rules Customs**

Removed completely.

Do not recreate:

- Customs garages.
- Repair garages that clear wanted stars.
- Drive-on customization pads.
- Respray shops.
- Wanted-level-clearing service locations.
- Related menus.
- Related mission objectives.
- Related minimap icons.
- Related compass functionality.

**See-through building rendering**

Removed in favor of solid building slicing.

Do not restore the previous dithering or transparent-building effect.

**Damage from ordinary collisions**

Do not introduce player damage from:

- Walls.
- Buildings.
- Props.
- Civilian vehicles.
- Wrecked police vehicles.

**Financial penalties**

Do not reintroduce:

- Arrest bail deductions.
- Confiscation of session earnings.
- Money loss after WASTED.
- Money loss after SLEEPING WITH THE FISHES.

**Mandatory campaign**

Do not convert the game into a mission-driven campaign that restricts free exploration.

---

# PART XVII: DEVELOPMENT WORKFLOW AND AI INSTRUCTIONS

## 42. SOURCE OF TRUTH

When working on this project, use the following order of authority:

1. Explicit new instructions from the owner.
2. This master game file.
3. Current source-code implementation.
4. CLAUDE.md developer documentation.
5. Existing tests and build configuration.
6. Previous discussions and proposals.

If documentation conflicts with actual code, identify the conflict rather than silently assuming either is correct.

If a feature is described here as an approved future improvement, do not represent it as already implemented.

## 43. REQUIRED DEVELOPMENT BEHAVIOR

Before making substantial changes:

1. Inspect the relevant source files.
2. Identify existing implementation.
3. Identify dependencies.
4. Determine which existing functionality could be affected.
5. Propose the smallest coherent implementation.
6. Implement.
7. Build.
8. Test.
9. Report results.

Never replace functioning systems with mock implementations.

Never create a second version of an existing system without explaining why.

Avoid unnecessary dependencies.

Do not rewrite the project simply to make the architecture look cleaner.

## 44. TESTING REQUIREMENTS

After meaningful gameplay changes, run relevant tests.

Existing testing tools include:

- `test/flow_node.js`
- Gameplay flow tests.
- Chaos-run tests.
- Map-render tests.
- Chunk-timing tests.

Also use:

`?fps=1`

for live performance diagnostics.

The simulation testing hook:

`window.__sim(seconds, steer)`

should remain available for deterministic gameplay testing where supported.

Verify:

- Game launches.
- Main menu works.
- Vehicle selection works.
- Borough selection works.
- Driving works.
- Wanted levels increase correctly.
- Police behavior works.
- Pickups work.
- Cash is saved.
- Upgrades work.
- Missions progress.
- Run endings work.
- Money remains permanent.
- Offline operation works.

## 45. CHANGE MANAGEMENT

For every meaningful development task, provide:

- **What changed:** A plain-language explanation.
- **Files modified:** Exact source paths.
- **Existing behavior preserved:** Identify what was not changed.
- **Testing:** List tests executed and actual results.
- **Known limitations:** Identify incomplete or unverified behavior.
- **Next recommended task:** One logical next step.

Do not claim something was tested when it was not.

Do not claim something works on iPhone without actual device testing.

## 46. BUILD AND DEPLOYMENT

Official build:

```bash
python3 build.py
```

Official distribution:

`dist/index.html`

Hosting:

- GitHub main branch.
- Netlify automatic deployment.
- Live site: https://hotcarnyc.netlify.app

Workflow:

1. Edit `src/`.
2. Build.
3. Test locally.
4. Verify mobile layout.
5. Commit source and rebuilt distribution.
6. Push to main when authorized.
7. Verify deployment.

Never hand-edit the generated distribution file.

Do not push unfinished or untested work simply to trigger deployment.

---

# PART XVIII: FINAL PRODUCT DEFINITION

## 47. WHAT WE ARE ACTUALLY BUILDING

CASH RULES NYC: WANTED is not a racing game.

It is not a traditional GTA clone.

It is not a mission-based driving simulator.

It is an endless, open-city arcade survival sandbox.

The entire purpose is to give players an accessible, entertaining New York City environment where they can explore freely, collect vehicles, earn money, cause escalating chaos and test how long they can survive the NYPD.

The city is the playground.

The police are the pressure.

The vehicles are the tools.

The economy provides progression.

The player's decisions create the experience.

A player should be able to:

- Drive peacefully through Manhattan.
- Explore Brooklyn.
- Cross into Queens.
- Discover landmarks.
- Steal a faster vehicle.
- Smash through traffic.
- Reach five stars.
- Survive an extended police chase.
- Earn money.
- Unlock new vehicles.
- Beat personal records.

There should always be another reason to start a new run.

## 48. THE FINAL DESIGN PHILOSOPHY

Keep the game simple to enter, difficult to master, and entertaining to replay.

Do not overcomplicate the experience.

Do not sacrifice performance for decorative features.

Do not add mechanics that undermine the endless sandbox.

Do not remove established features without owner approval.

Do not allow the game to lose its NYC identity.

Every development decision should improve at least one of these:

- Fun.
- Responsiveness.
- Replayability.
- Progression.
- Exploration.
- Performance.
- Visual identity.

If a proposed feature does not meaningfully improve the game, it does not need to be built.

---

## FINAL DIRECTIVE TO CLAUDE CODE

You are working on an existing, playable game with an established technical architecture, map, vehicle system, economy, progression and visual identity.

This document is the consolidated design authority for the project.

Do not start over. Do not migrate frameworks. Do not blindly rewrite existing systems.

Your first assignment after receiving this document is to:

1. Inspect the current repository and all relevant source files.
2. Compare the implementation against this master file.
3. Identify conflicts between current code and approved design decisions.
4. Identify incomplete systems.
5. Identify the most important technical and gameplay weaknesses.
6. Evaluate actual iPhone performance.
7. Produce a prioritized development roadmap.

Pay particular attention to:

- The permanent economy change.
- Adaptive police intelligence.
- Existing five-star pursuit mechanics.
- Seamless NYC world streaming.
- Vehicle physics.
- iPhone performance.
- Save reliability.

Do not implement a massive collection of features in one operation.

Work in small, testable development phases.

Preserve everything that already works.

When a change is proposed, explain what it improves and why it belongs in the game.

The objective is to evolve the existing prototype into a polished, distinctive, commercially viable iOS-first game.

---

**CASH RULES NYC: WANTED**

**RUN THE CITY. BEAT THE ODDS.**

*END OF MASTER GAME FILE — VERSION 2.0*

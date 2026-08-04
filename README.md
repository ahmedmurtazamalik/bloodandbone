# BLOOD & BONE

A strategic local browser card battler built around sacrifices, Bones, four combat lanes, a shared damage scale, face-up enemy intent, creature stats, and sigils. Its original sixteen-turn contest structure is designed for longer matches with an opening, midgame, and endgame.

This project contains **only the card-game loop**. It does not reproduce the cabin, story, puzzles, characters, map, later acts, original art, or original audio.

## Run locally

```bash
cd "/home/murtaza/Murtaza/Game/Blood and Bone"
npm install
npm run serve
```

Open:

- Game: <http://127.0.0.1:4174/>
- Test/debug seam: <http://127.0.0.1:4174/?debug=1>

## First-run tutorial

The first run opens with an eleven-step guided hand that uses the real battle state. It teaches enemy intent, free placement, Blood costs, marking and confirming a sacrifice, Bone generation, lane combat, the brass balance, and the later-turn deck choice.

- Only the correct real action is accepted at each step.
- **Skip tutorial** immediately releases the normal game.
- **Replay guided hand** is available from the in-game rulebook.
- Completion persists locally under `bb_tutorial_completed`.

## Turn ledger

The paper **Turn ledger** beside the hand explains the battle in chronological, player-readable prose. Each numbered turn is divided into **Your phase** and **Opponent phase**. It records:

- Opening hand, incoming previews, Squirrel draws, and Scout choices
- Played cards and destination lanes
- Every sacrificed creature, Blood provided, Bones gained, and Bones spent
- Bell timing and left-to-right attack order
- Blocked attacks, damage, remaining Health, deaths, and generated Bones
- Airborne bypasses, open-lane scale damage, and the resulting balance
- Enemy deployments, failed deployments into occupied lanes, and quiet phases
- Fledgling maturation, exhausted draw piles, trial victory, and defeat

Combat playback is deliberately staged instead of applying the final board immediately. Each attacker winds up, impact updates the struck card's Health, deaths receive their own readable hold, and direct hits move the scale one event at a time before the board settles. Reduced-motion preferences shorten the physical motion and pauses without removing chronological event order.

The ledger retains the latest eight turns, scrolls to each new event as it occurs, and can be collapsed. On tablet and mobile it moves below the hand rather than covering the felt or tutorial. Its DOM uses a live `role="log"` region, and the same structured entries are available through the query-gated debug snapshot for E2E verification.

## How to play

### Opening

You begin each trial with:

- Three cards from your creature deck
- One Squirrel
- Nine Squirrels remaining in the side deck
- A Marrow Reserve of 1, 2, or 3 Bones in trials I–III
- A balanced scale

The first turn uses the opening hand directly. On every later turn, choose exactly one draw:

- **Scout creatures:** reveal the top three main-deck cards, choose one, and cycle the other two to the bottom
- **Squirrels:** a dependable free 0/1 sacrifice

### Playing cards

1. Select a card in your hand.
2. For a Blood card, select enough friendly creatures and press **Offer Blood**.
3. Select a highlighted destination lane. A sacrificed creature's lane may be reused.
4. For a Bone card, have enough Bones and select an empty lane.
5. You may play multiple cards before ringing the bell.

Blood is paid immediately and cannot be saved. Every friendly creature that actually dies gives one Bone. Bone cards spend that accumulated pool. The **Marrow Reserve** starts trials I–III with 1, 2, and 3 Bones respectively, making low-cost Bone plays available early while expensive creatures still require deaths.

The first loss in a run triggers **Broken Bones** instead of immediate defeat: retry the same trial once with 2 emergency Bones added to its normal reserve. The deck and encounter do not change. A second loss ends the run, extending a close campaign without removing its stakes.

### Combat

Press **Ring the Bell** to end your action phase.

1. Your creatures attack from lane 1 to lane 4.
2. A creature damages the opposing card in its lane.
3. If no valid blocker exists, its Power tips the scale directly.
4. Telegraph cards descend into open enemy lanes.
5. Enemy creatures attack from lane 1 to lane 4.
6. The opponent always answers before the round is judged.
7. Trials cannot end before turn 12. From turn 12 onward, lead by 20 to win by domination.
8. If nobody dominates, the turn-16 leader wins regulation; ties continue into sudden death.

Enemy cards in **Next Turn** are public information. Plan sacrifices and blockers around them.

Each player turn also offers one shared **Tactical Action**: **Maneuver** a creature into an adjacent empty lane, or spend **2 Bones** to **Mend** up to 2 Health. This creates a recurring choice between answering telegraphed lanes, preserving an engine creature, and saving Bones for cards.

Each opponent follows a sixteen-turn authored arc that moves through opening probes, midgame pressure, recovery windows, and endgame threats. Reinforcements often contest an occupied lane instead of filling all four lanes immediately, preserving choices between racing the scale, trading creatures, and preparing a later defense.

### Rewards

Winning the first two trials offers three illustrated creatures. Offers are seeded per run, exclude cards already in your deck when possible, and remember all three presented choices so rejected cards do not immediately repeat at the next reward. Choose one; it joins your draw pile for the remaining trials.

## Included sigils

- **Airborne** — bypasses an ordinary blocker for direct scale damage.
- **Mighty Leap** — blocks Airborne.
- **Touch of Death** — any positive hit to a creature kills it.
- **Many Lives** — survives sacrifice.
- **Worthy Sacrifice** — provides three Blood.
- **Bifurcated Strike** — attacks the two diagonal lanes.
- **Trifurcated Strike** — attacks left, forward, and right.
- **Fledgling** — matures at the beginning of its owner's next turn.
- **Rabbit Hole** — playing Warren creates a free 0/1 Rabbit in your hand, giving you another sacrifice or emergency blocker.
- **Fecundity** — playing Field Mice adds one matching copy to your hand; the copy loses Fecundity to prevent an infinite loop.
- **Unkillable** — when your creature dies in combat or as a sacrifice, it returns to your hand at printed Health; the death still produces a Bone.
- **Stinky** — reduces the directly opposing creature's Power by 1 for its entire attack sequence, to a minimum of 0.

Open **Rules & Sigils** in the game for a quick reference.

## Presentation

The visual redesign follows an original **Ritualist's Oak & Linocut Hearth** direction:

- 32 unique local two-tone SVG creature illustrations
- Unbleached rag-paper card stock and printed/debossed frames
- Wax Blood seals, carved Bone costs, stamped sigils, and distinct Power/Health plates
- Worn green felt mounted in dark oak
- Articulated brass balance with animated pans and damage weights
- Live physical Bone pile, stacked decks, brass service bell, and shadowed opponent presence
- Responsive four-lane board with an explicit mobile swipe cue
- Reduced-motion support

The design consultation and before/after rationale are recorded in `GEMINI_DESIGN_REVIEW.md`.

## Audio

The soundtrack is **The Hamlet** from *Darkest Dungeon*, composed by Stuart Chatwood, supplied locally by the user at `artifacts/hamlet.mp3`.

- Music begins only after the player presses **Take your seat**, satisfying browser autoplay policy.
- The track loops continuously and remains active across battles and reward screens.
- Victory and defeat lower the music smoothly without stopping it.
- The Sound book beside Rules provides independent Music and Effects & Creatures sliders plus a global mute toggle.
- Audio preferences persist locally under `bb_audio_settings`.

Original synthesized effects cover card draw, selection, placement, sacrifice, Bone gain/spending, bell, creature hits, direct damage, balance movement, rewards, defeat, victory, and invalid actions. Every one of the 32 card templates also has a deliberate short creature voice profile, including chirps, croaks, growls, hisses, hoofbeats, insect clicks, buzzes, and supernatural drones.

## Run structure

- Three escalating opponents
- Two between-battle card rewards
- Nine-card starter deck
- Ten-card reward pool
- Defeat/retry and completed-run screens

## Intentional omissions

To keep the card game focused, this version does not include:

- Cabin/story/ARG content
- Map nodes
- Items
- Teeth, pelts, or trading
- Candles/lives
- Campfires, totems, boons, card merging, or deathcards
- Starvation
- Boss-specific phase gimmicks
- Movement, terrain, spawning, search, recursive-copy, or rare trigger-order sigils

See `DESIGN.md` for the production boundary and `RESEARCH.md` for the comprehensive Act I mechanics/card/sigil reference that informed it.

## Testing

```bash
npm test
npm run test:simulate
npm run test:e2e
node --check src/core.js
node --check src/cards.js
node --check src/encounters.js
node --check src/run.js
node --check src/game.js
node --check src/tutorial.js
node --check src/illustrations.js
node --check src/audio.js
node --check scripts/e2e.mjs
```

The deterministic simulation plays all three encounter scripts through real draws, sacrifices, Bone spending, lane placement, and combat. The E2E script waits for a healthy local server, fetches the supplied MP3, verifies post-gesture playback and exact `currentSrc`, performs the entire first-run tutorial through real clicks, checks semantic SFX activity, verifies volume/mute persistence and SVG art coverage, runs Chromium through all three encounters and rewards to victory, checks mobile containment, captures screenshots under `artifacts/`, and fails on browser-console errors.

## Project structure

```text
index.html              Browser structure and overlays
styles.css              Oak, felt, rag-paper, brass, and responsive visual system
src/core.js             Pure card-game rules
src/cards.js            Card templates and instances
src/illustrations.js    32 local linocut SVG card illustrations
src/tutorial.js         Gated first-run tutorial and persistence
src/audio.js            Soundtrack, tactile SFX, voices, and audio settings
src/turn-log.js         Semantic event prose and bounded phase ledger
src/encounters.js       Telegraph/deployment scripts
src/run.js              Three-trial progression
src/game.js             Browser controller and rendering
tests/                  Node unit tests
scripts/e2e.mjs         Playwright Chromium journey
RESEARCH.md             Source-backed Act I implementation reference
DESIGN.md               Scoped production brief
GEMINI_DESIGN_REVIEW.md Antigravity/Gemini audit and redesign record
artifacts/               Verified screenshots
artifacts/hamlet.mp3    User-supplied looping soundtrack
```

## Research sources

The detailed source index is in `RESEARCH.md`. Primary references include:

- [Inscryption Wiki — Cards](https://inscryption.fandom.com/wiki/Cards)
- [Inscryption Wiki — Sigils](https://inscryption.fandom.com/wiki/Sigils)
- [Inscryption Wiki — Blood](https://inscryption.fandom.com/wiki/Blood)
- [Inscryption Wiki — Bones](https://inscryption.fandom.com/wiki/Bones)
- [Inscryption Wiki — Act I](https://inscryption.fandom.com/wiki/Act_I)
- [Inscryption Wiki — Variable Stats](https://inscryption.fandom.com/wiki/Variable_Stats)
- [Inscryption official site](https://www.inscryption.com/)
- [Wikipedia — Inscryption](https://en.wikipedia.org/wiki/Inscryption)

Community sources are detailed but are not official engine specifications. Obscure simultaneous-trigger ordering is therefore documented as implementation guidance rather than claimed as frame-perfect internal behavior.

## Presentation note

This is a mechanics-focused local homage with original code and presentation. No proprietary art, music, dialogue, story text, or audiovisual assets from *Inscryption* are included.

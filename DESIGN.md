# BLOOD & BONE — Production Brief

## Product statement

**Blood & Bone** is a local, single-player browser card battler built from the self-contained mechanical core of *Inscryption* Act I. It recreates the strategic grammar—four lanes, telegraphed enemies, blood sacrifices, bones, creature statistics, direct scale damage, and sigils—without recreating the cabin, story, puzzles, characters, map, audiovisual assets, or late-game genre changes.

The presentation is original: abstract creature runes, dark woodland-table styling, generated interface sound, original opponent identities, and no copied artwork or audio.

## Design goals

1. A new player can understand the entire loop from the table itself.
2. Sacrifice decisions create short-term loss for long-term lane advantage.
3. Bones make deaths useful and support a second card economy.
4. Face-up incoming cards make each turn a positional puzzle rather than a guessing game.
5. The shared scale produces reversals instead of two independent health totals.
6. A full run is short enough to replay but long enough for two deckbuilding decisions.
7. Included sigils must be readable, deterministic, and meaningfully distinct.

## Complete loop

1. Start with a nine-card creature deck.
2. Enter one of three escalating trials.
3. Begin with three main-deck cards and one Squirrel.
4. On later turns, choose one main-deck card or one Squirrel.
5. Play any affordable cards:
   - Blood cards consume friendly creatures as sacrifices.
   - Bone cards spend Bones accumulated from friendly deaths.
6. Read the enemy's face-up incoming row.
7. Ring the bell:
   - Player cards attack left-to-right.
   - Incoming enemy cards descend into open lanes.
   - Enemy cards attack left-to-right.
8. Win when the scale reaches +5; lose when it reaches −5.
9. After trials one and two, choose one of three creatures for the deck.
10. Defeat the third opponent to complete the run.

## Rules retained from Act I

- Four active lanes per side and a four-lane enemy queue.
- One card per active lane.
- Normal attacks hit the opposing creature; open lanes damage the scale.
- Damage persists while a creature remains on the board.
- Blood cannot be banked.
- Ordinary valid sacrifices provide one Blood.
- Worthy Sacrifice provides three Blood.
- Many Lives provides Blood but survives and awards no Bone.
- Each friendly creature that actually dies normally awards one Bone.
- Bone costs spend the accumulated battle pool.
- First side to lead the shared scale by five wins.
- Multi-strike targets and lanes resolve left-to-right.
- Fledgling resolves at the beginning of its owner's next turn.
- Opponent plays are visible before deployment.

## Included sigils

| Sigil | Implemented behavior |
|---|---|
| Airborne | Bypasses ordinary blockers and damages the scale directly. |
| Mighty Leap | Intercepts Airborne attacks. |
| Touch of Death | Positive creature damage is lethal regardless of remaining Health. |
| Many Lives | Survives being sacrificed. |
| Worthy Sacrifice | Counts as three Blood. |
| Bifurcated Strike | Attacks diagonal-left and diagonal-right, not forward. |
| Trifurcated Strike | Attacks left, forward, and right. |
| Fledgling | Matures at the beginning of the owner's next turn. Wolf Cub becomes Wolf. |

## Content scope

### Starter deck

Stoat, Bullfrog, Wolf Cub, Sparrow, Black Goat, Wolf, River Snapper, Opossum, and Coyote.

### Reward pool

Cat, Black Goat, Mantis, Adder, Raven, River Snapper, Grizzly, Rattler, Turkey Vulture, and Mantis God.

### Encounters

- **The Woodsman:** introductory blood, blockers, and open-lane pressure.
- **The Ossuary:** Bone bodies, defensive lanes, Airborne pressure, and Touch of Death.
- **The Horned Crown:** mixed counters, multi-strike, and heavy finishers.

All enemy placements follow deterministic sixteen-turn arcs. Incoming cards keep their authored lane while it remains legal. A blocked reinforcement deterministically flanks into the stronger adjacent open lane; without one, deployment fails rather than replacing a survivor.

## Deliberate simplifications

These systems are researched in `RESEARCH.md` but excluded from this version:

- Cabin exploration, puzzles, ARG content, talking cards, and narrative transformations.
- Map routing and region traversal.
- Candles/lives and boss phase candles.
- Consumable items and item inventory.
- Teeth, overkill currency, pelts, Trapper, and Trader.
- Campfires, card merging, sigil transfer, totems, boons, and deathcards.
- Terrain-heavy starting boards.
- Starvation escalation after deck exhaustion.
- Boss-only cards and rule-changing boss phases.
- Waterborne, movement, interception, reactive damage, card-spawning, search, copy-loop, and death-return sigils.
- Variable-power cards, Ant counting, and permanent Ouroboros growth.
- Tribes as a drafting or totem system; tribe remains metadata only.

The 32-card data catalog contains additional researched templates for future expansion, but only cards whose native mechanics are supported enter the starter deck, reward pool, or enemy scripts.

## Interaction model

- Mouse/touch buttons for all game actions.
- First-time players receive a skippable eleven-step guided hand using real actions and state.
- Tutorial completion persists locally and can be replayed from the rulebook.
- Draw piles are physical stacks labeled with both deck identity and purpose.
- Costs use distinct wax Blood seals or ivory Bone medallions.
- Legal target lanes gain a warm brass outline and felt glow.
- Selected sacrifices gain a crimson felt wash labeled `Marked`.
- A separate confirmation step prevents accidental sacrifices.
- Sigil icons expose descriptions through native tooltips and the Rules & Sigils dialog.
- Enemy cards are positioned in a distinct dashed queue row with a descent arrow.
- Scale state is shown by beam angle, pan weights, and text rather than color alone.
- Mobile keeps the four-lane relationship intact inside an explicitly labeled horizontal felt scroller.
- A compact Sound book exposes independent music/effects levels and mute without competing with the board.
- Music unlocks from the first real game-start click; all assigned volumes remain clamped to `[0, 1]`.
- Creature calls occur on placement/deployment or reward choice rather than noisy hand browsing.
- A paper turn ledger remains visible beside the hand, groups events by player/opponent phase, and keeps the newest explanation in view.
- Ledger copy uses card display names, one-based lane numbers, resource changes, remaining Health, and scale outcomes—never internal keys.
- The latest eight turns are retained; mobile moves the ledger below the hand and keeps collapse available.

## Architecture

- `src/core.js` — pure battle state, payment, draws, combat, and maturation.
- `src/cards.js` — immutable card templates and unique runtime instances.
- `src/illustrations.js` — 32 original local linocut SVG compositions.
- `src/tutorial.js` — deterministic action gate, skip/replay, and local persistence.
- `src/audio.js` — looping MP3 soundtrack, synthesized physical SFX, 32 creature voices, and persistent levels.
- `src/turn-log.js` — bounded turn/phase history and semantic event-to-prose formatting.
- `src/encounters.js` — deterministic telegraph scripts and deployment.
- `src/run.js` — encounter/reward/victory progression.
- `src/game.js` — browser interaction, rendering, feedback, and debug seam.
- `tests/` — deterministic unit tests.
- `scripts/e2e.mjs` — Chromium journey through the entire run.
- `RESEARCH.md` — detailed Act I card/sigil/rules reference and sources.
- `GEMINI_DESIGN_REVIEW.md` — Antigravity/Gemini design audit and redesign record.

## Definition of done

- Complete three-battle run can be played without debug tools.
- Blood, Bones, draws, sacrifices, lanes, scale, combat, and all included sigils work.
- Every incoming threat is telegraphed.
- Rewards modify later battle decks.
- Defeat and replay work.
- UI is readable at desktop and narrow responsive widths.
- Every card template has unique local creature artwork rather than a letter placeholder.
- First-run tutorial can be completed through real production actions and stays dismissed afterward.
- Automated unit, static, and Chromium journey checks pass.
- No browser-console errors.

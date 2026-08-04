# Inscryption Act I — Practical Card & Sigil Implementation Reference

**Scope:** Leshy's Cabin / base-game Act I, not Act II, Act III, or Kaycee's Mod. This is a mechanics reference for a polished local adaptation, not a content dump. Use original names only as internal research labels; create original art, icons, flavor text, UI, sound, and presentation.

## Card-stat baseline audit

The curated creature numbers were audited against publicly available Act I card definitions, including the open `inscrybe-with-friends` print registry at commit `fd6b1eba8d2623a42b1949dd34a805fcbbee4b7b`:

- <https://github.com/Vap0r1ze/inscrybe-with-friends/blob/fd6b1eba8d2623a42b1949dd34a805fcbbee4b7b/lib/defs/prints.ts>

The audit confirmed that Blood & Bone already uses the intended baseline for the cards called out in playtesting: Wolf costs 2 Blood and is 3/2; Black Goat is a 0/1 resource specialist with Worthy Sacrifice; Mantis and Mantis God are both fragile 1/1 creatures but use Bifurcated and Trifurcated Strike respectively. Balance work should change encounter pressure and resource access before casually rewriting these identity-defining bodies. Automated assertions in `tests/cards.test.js` protect these baselines.

## 1. Recommended adaptation scope

### Core/high-value — implement first

1. Four lanes per side, a visible enemy queue, scale damage, draw choice (main deck or side deck), Blood sacrifice, and Bones.
2. Roughly 25–35 regular cards covering the five tribes, Bone cards, variable Power, and cheap/large bodies.
3. The combat-critical sigils: Airborne, Mighty Leap, Waterborne, Touch of Death, Sharp Quills, Fledgling, Bifurcated Strike, Trifurcated Strike, Stinky, Unkillable, Many Lives, Worthy Sacrifice, Guardian, and Burrower.
4. The card-economy sigils: Rabbit Hole, Bees Within, Ant Spawner, Fecundity, Corpse Eater, Bone King, Hoarder, Dam Builder, and Trinket Bearer.
5. A smaller rare pool: Geck, Mantis God, Mole Man, Amalgam, Pack Rat, Ouroboros, and Strange Larva provide most of the interesting rare-card space.
6. Common terrain: Stump, Boulder, Grand/Snowy Fir, Dam, plus spawned Rabbit/Bee/Tail tokens.

### Polish/high-value after the core

- Sprinter, Hefty, Loose Tail, Ants and Tentacle variable-Power cards.
- The Daus/Chimes, Long Elk/Vertebrae, Child 13, Cat's hidden transformation, and boss-specific terrain.
- Campfire/stat upgrades, transferred sigils, tribal totems, and inherited sigils on spawned cards. These systems create much of Act I's build variety, but they multiply interaction testing.

### Safe omissions for a simpler adaptation

- Talking-card narrative transformations, deathcards, the glitch card, cabin puzzle rewards, pelts/trader economy, permanent Ouroboros progression, starvation escalation, and exact boss gimmicks.
- Moon-only Tidal Lock and Omni Strike, Pack Mule loot, Bait Bucket transformation, Leaping Trap/Pelt creation, Caged Wolf puzzle behavior, Long Elk's Vertebrae trail, and the ninth/thirteenth-sacrifice easter eggs.
- Kaycee's Mod changes such as Made of Stone and the one-use version of Fecundity. Base Act I Fecundity can repeat indefinitely.

---

## 2. Core battle contract

- Each side has **4 active lanes**. Enemy cards may also be telegraphed in a queue behind their destination lane.
- Opening hand: **3 main-deck cards + 1 Squirrel**. At the start of each later player turn, choose exactly one card from the main deck or Squirrel side deck before other actions. The side deck initially has ten Squirrels.
- **Blood is not banked.** To play a Blood-cost card, select enough valid cards already on your board and sacrifice them as part of that play. Most valid sacrifices are worth 1 Blood; Worthy Sacrifice is worth 3. Each sacrificed card that actually dies awards a Bone.
- **Bones persist during an encounter.** A friendly card dying for any reason normally awards 1 Bone; Bone King awards 4 instead. Bone costs are paid from the pool and do not require emptying lanes through sacrifice.
- Cards need an empty destination lane after costs resolve. A practical implementation should validate both payment and destination before committing the action.
- Ringing the bell starts player combat. Resolve attacking cards **left to right**. Multi-strike targets also resolve left to right. After player combat, the opponent advances/plays queued cards, then performs its combat. Movement sigils resolve after that side's attacks.
- A normal attack damages the opposing card. If there is no valid blocker, Power becomes direct scale damage. The encounter ends when one side leads the scale by 5; excess winning damage becomes teeth in the original campaign.
- Health damage persists while a card remains on the board. Cards return to their printed/max Health between encounters.
- Tribes in base Act I are **Avian, Canine, Hooved, Insect, Reptile**, plus Squirrel. Tribe has no intrinsic combat effect; it is a tag used by card-choice events and totems. Amalgam counts as every tribe.

**Engineering caution:** community descriptions are consistent about lane combat and triggers, but are not a formal specification for every simultaneous-trigger order. Use a deterministic event queue and lock it with interaction tests rather than trying to reproduce undocumented engine internals.

Suggested event phases:

```text
START_OWNER_TURN
  -> beginning-of-turn effects (Fledgling; boss-only Tidal Lock)
  -> mandatory player draw (player turns only)
  -> main actions (play cards/items)

PLAY_CARD
  -> validate destination and total cost
  -> sacrifice/payment events, deaths, Bones, death triggers
  -> enter lane
  -> on-play triggers (spawn/search/copy/item)

COMBAT
  -> for each attacker lane left-to-right
       build strike target list left-to-right
       for each strike while attacker remains alive
         resolve direct-vs-blocked target
         Guardian/Burrower interception where applicable
         Loose Tail pre-hit replacement
         damage
         on-damaged effects (Bees Within, Sharp Quills)
         lethal/Touch of Death
         immediate death effects (Bones, Unkillable, Frozen Away,
                                  Steel Trap, Corpse Eater)
  -> end-owner-turn movement (Sprinter/Hefty), left-to-right
```

Sources: [Cards mechanics](https://inscryption.fandom.com/wiki/Cards), [Blood](https://inscryption.fandom.com/wiki/Blood), [Bones](https://inscryption.fandom.com/wiki/Bones), [Tribes](https://inscryption.fandom.com/wiki/Tribe).

---

## 3. Regular Act I card catalog

Notation: **B** = Blood, **N** = Bones, **free** = no cost. `—` means no tribe or no native sigil. Rows marked **generated/story** should not be put into the ordinary draft pool.

### Avian

| Card | Cost | P/H | Tribe | Native sigil(s) | Implementation note |
|---|---:|---:|---|---|---|
| Kingfisher | 1B | 1/1 | Avian | Airborne, Waterborne | Evades blockers both offensively and defensively. |
| Raven Egg | 1B | 0/2 | Avian | Fledgling | Becomes Raven on its owner's next turn. |
| Raven | 2B | 2/3 | Avian | Airborne | Straightforward flying finisher. |
| Sparrow | 1B | 1/2 | Avian | Airborne | Basic flyer. |
| Magpie | 2B | 1/1 | Avian | Airborne, Hoarder | Searches the main deck on play. |
| Turkey Vulture | 8N | 3/3 | Avian | Airborne | High-end Bone payoff. |

### Canine

| Card | Cost | P/H | Tribe | Native sigil(s) | Implementation note |
|---|---:|---:|---|---|---|
| Wolf Cub | 1B | 1/1 | Canine | Fledgling | Becomes Wolf. |
| Wolf | 2B | 3/2 | Canine | — | Baseline high-Power attacker. |
| Bloodhound | 2B | 2/3 | Canine | Guardian | Moves opposite a newly played enemy. |
| Coyote | 4N | 2/1 | Canine | — | Basic Bone attacker. |
| Alpha | 4N | 1/2 | Canine | Leader | Adjacent friendly cards gain +1 Power. |
| Stoat | 1B | 1/3 | — | — | Story starting card; omit dialogue without affecting combat. |
| Stunted Wolf | 1B | 2/2 | Canine | — | Story unlock; efficient body. |
| Caged Wolf | 2B | 0/6 | Canine | — | Story terrain-like card; puzzle behavior is optional. |

### Hooved

| Card | Cost | P/H | Tribe | Native sigil(s) | Implementation note |
|---|---:|---:|---|---|---|
| Black Goat | 1B | 0/1 | Hooved | Worthy Sacrifice | Worth 3 Blood when sacrificed. |
| Elk Fawn | 1B | 1/1 | Hooved | Sprinter, Fledgling | Becomes Elk; movement can alter its lane first. |
| Elk | 2B | 2/4 | Hooved | Sprinter | Durable moving attacker. |
| Pronghorn | 2B | 1/3 | Hooved | Sprinter, Bifurcated Strike | Attacks diagonal lanes, not opposite lane. |
| Moose Buck | 3B | 3/7 | Hooved | Hefty | Pushes a row at end of owner's turn. |

### Insect

| Card | Cost | P/H | Tribe | Native sigil(s) | Implementation note |
|---|---:|---:|---|---|---|
| Beehive | 1B | 0/2 | Insect | Bees Within | Each damaging hit creates a Bee in owner's hand. |
| Bee | free | 1/1 | Insect | Airborne | Generated token; also replaces Squirrels after an optional puzzle. |
| Mantis | 1B | 1/1 | Insect | Bifurcated Strike | Two diagonal attacks where lanes exist. |
| Ring Worm | 1B | 0/1 | Insect | — | Mostly event utility; ordinary weak body in combat. |
| Worker Ant | 1B | Ants/2 | Insect | — | Power equals friendly Ant-trait cards currently in play. |
| Ant Queen | 2B | Ants/3 | Insect | Ant Spawner | Creates a Worker Ant in hand on play. |
| Stinkbug | 2N | 1/2 | Insect | Stinky | Story card; debuffs opposing Power by 1. |
| Cockroach | 4N | 1/1 | Insect | Unkillable | Returns a copy to hand whenever it dies. |
| Corpse Maggots | 5N | 1/2 | Insect | Corpse Eater | Auto-plays from hand into a friendly combat death's lane for free. |

### Reptile

| Card | Cost | P/H | Tribe | Native sigil(s) | Implementation note |
|---|---:|---:|---|---|---|
| Bullfrog | 1B | 1/2 | Reptile | Mighty Leap | Basic anti-Airborne blocker. |
| Skink | 1B | 1/2 | Reptile | Loose Tail | Evades its first direct strike if an adjacent lane is free. |
| Adder | 2B | 1/1 | Reptile | Touch of Death | Any positive damage to a card is lethal. |
| River Snapper | 2B | 1/6 | Reptile | — | Defensive body. |
| Rattler | 6N | 3/1 | Reptile | — | Bone-powered glass cannon. |

### No ordinary tribe / miscellaneous

| Card | Cost | P/H | Native sigil(s) | Implementation note |
|---|---:|---:|---|---|
| Cat | 1B | 0/1 | Many Lives | Survives sacrifices; optional ninth-sacrifice transformation below. |
| Mole | 1B | 0/4 | Burrower | Moves to block an otherwise direct ground attack. |
| Porcupine | 1B | 1/2 | Sharp Quills | Returns 1 damage after being struck. |
| River Otter | 1B | 1/1 | Waterborne | Submerges while opponent attacks. |
| Skunk | 1B | 0/3 | Stinky | Defensive debuffer. |
| Warren | 1B | 0/2 | Rabbit Hole | Creates a free 0/1 Rabbit in hand. |
| Beaver | 2B | 1/4 | Dam Builder | Creates adjacent 0/2 Dams on empty lanes. |
| Field Mice | 2B | 2/2 | Fecundity | Creates a full copy in hand each time played in base Act I. |
| Rat King | 2B | 2/1 | Bone King | Gives 4 Bones on death. |
| Great White | 3B | 4/2 | Waterborne | Large submerged attacker. |
| Grizzly | 3B | 4/6 | — | Baseline heavy card. |
| Opossum | 2N | 1/1 | — | Cheapest ordinary Bone card. |
| Bat | 4N | 2/1 | Airborne | Basic Bone flyer. |
| Hand Tentacle | 1B | hand/1 | — | Power = current number of cards in owner's hand. |
| Mirror Tentacle | 1B | mirror/3 | — | Power = current Power of opposing creature. |
| Bell Tentacle | 2B | bell/3 | — | Power is lane-dependent; see variable stats. |

Direct card source: [Act I visual list and individual card links](https://inscryption.fandom.com/wiki/Cards). The individual pages expose the card infobox stats, e.g. [Wolf](https://inscryption.fandom.com/wiki/Wolf), [Black Goat](https://inscryption.fandom.com/wiki/Black_Goat), [Worker Ant](https://inscryption.fandom.com/wiki/Worker_Ant), and [Bell Tentacle](https://inscryption.fandom.com/wiki/Bell_Tentacle).

---

## 4. Variable Power (not transferable sigils)

Recompute these values at attack time and whenever the UI previews damage.

| Symbol | Rule | Natural card(s) | Scope recommendation |
|---|---|---|---|
| Ants | Number of friendly cards on the board with the Ant trait. Worker Ant and Ant Queen themselves count. | Worker Ant, Ant Queen | High-value. |
| Card Counter | Number of cards in the owner's hand. | Hand Tentacle | Polish. |
| Mirror | Current Power of the opposing card. | Mirror Tentacle | Polish; define mirror-vs-mirror as 0 to avoid recursion. |
| Bell Ringer | 4 minus distance from the combat bell; in the standard orientation this produces 4/3/2/1 from nearest to farthest lane. It gains +1 per adjacent Chime or Bell Tentacle. | Bell Tentacle | Polish; the adjacency bonus is easy to omit. |

Source: [Variable Stats](https://inscryption.fandom.com/wiki/Variable_Stats).

---

## 5. Sigil implementation dictionary

### 5.1 Core combat, payment, and lifecycle sigils

| Sigil | Trigger / timing | Exact practical effect | Priority |
|---|---|---|---|
| Airborne | Each strike, during targeting | Ignore an opposing card and deal direct scale damage, unless that target has Mighty Leap. Does not make the bearer immune to normal attacks. | Core |
| Mighty Leap | When an Airborne strike targets its lane | Converts that strike from direct damage into a normal hit against this blocker. | Core |
| Waterborne | During the opponent's attack phase | Bearer submerges and is treated as absent for opposing targeting; attack goes direct. It resurfaces for its owner's turn. | Core |
| Touch of Death | After bearer deals positive damage to a card | Kill that damaged card regardless of remaining Health. No effect on direct damage or when bearer has 0 Power. | Core |
| Sharp Quills | Immediately after bearer is struck | Deal 1 damage to the striker. If that kills a multi-strike attacker, later strikes do not occur. | Core |
| Fledgling | Beginning of owner's next turn after surviving one turn | Transform into a specific evolved form. Generic fallback: prefix “Elder”, +1 Power and +2 Health, then remove Fledgling. Preserve transferred sigils and stat modifications. | Core |
| Unkillable | On bearer death, after it leaves board | Put a copy of the dead card into its owner's hand. Sacrifice counts as death. | Core |
| Many Lives | When selected as a Blood sacrifice | It provides Blood but does not die, leave the lane, or award a Bone. | Core |
| Worthy Sacrifice | During Blood payment | Bearer counts as 3 Blood rather than 1. Blood cannot be banked. | Core |
| Stinky | Continuous while opposing a card | Opposing card has −1 Power, to a minimum of 0. At 0 it does not attack. | Core |
| Bifurcated Strike | When bearer attacks | Strike diagonal-left then diagonal-right; do **not** strike directly opposite. Skip targets outside board. Stop if attacker dies. | Core |
| Trifurcated Strike | When bearer attacks | Strike diagonal-left, opposite, then diagonal-right. Skip off-board targets. Stop if attacker dies. Overrides Bifurcated if both exist. | Core/rare |
| Burrower | Before an otherwise direct grounded enemy strike | Bearer may move from anywhere on its side to the empty attacked lane and take the hit. Can move repeatedly in one turn if alive; does not intercept Airborne. | Core |
| Guardian | Immediately when an enemy card is played opposite an empty active lane | Move bearer to that opposing lane. Trigger is enemy **play**, not attack. | Core |
| Loose Tail | Before first direct strike that would hit bearer | If possible, move bearer right; if blocked, try left. Leave a Tail in old lane. If neither is free, take hit and do not create Tail. One tail per creature. Quills/Trap effect damage does not trigger it. | Polish |
| Sprinter | End of owner's turn, after attacks | Move one lane in arrow direction. If blocked/edge, reverse direction before moving; if blocked both ways, stay. Process movers left to right. | Polish |
| Hefty | End of owner's turn, after attacks | Move in arrow direction while pushing adjacent cards as a contiguous row. Reverse if no room in that direction; stay if no direction has room. | Polish |

### 5.2 On-play, resource, and spawning sigils

| Sigil | Trigger / timing | Exact practical effect | Priority |
|---|---|---|---|
| Rabbit Hole | On play | Create a free 0/1 Rabbit in owner's hand. Auto-play via Corpse Eater still triggers it. | Core |
| Bees Within | Every time bearer takes damage | Create a free 1/1 Airborne Bee in owner's hand, even if the damage is lethal. | Core |
| Dam Builder | On play | Create 0/2 Dams in each empty adjacent lane. Dams are terrain and normally cannot be sacrificed. | Core |
| Hoarder | On play | Let owner inspect main draw pile, choose one card, put it in hand, and reshuffle/close pile. No side-deck search; no effect if empty. | Core |
| Fecundity | On play | Put a copy of the played card into owner's hand. In base Act I the copy retains Fecundity, enabling repeated use. | Core |
| Corpse Eater | Friendly card dies **by combat**, while bearer is in hand | Auto-play bearer for free into the vacated lane. Its on-play effects trigger. If replacing an attacker that died mid-multi-strike, it can perform remaining strikes. | Core |
| Bone King | On death from any cause | Award 4 Bones total instead of the normal 1. | Core |
| Ant Spawner | On play | Create a Worker Ant in owner's hand. | Core |
| Trinket Bearer | On play | If an item slot is open, grant a random allowed item. No effect if inventory is full. | Core/rare |
| Leader | Continuous aura | Friendly cards immediately adjacent to bearer gain +1 Power. The bearer does not buff itself. | Core |

### 5.3 Rare, terrain, and boss sigils

| Sigil | Trigger / timing | Exact practical effect | Recommendation |
|---|---|---|---|
| Amorphous | When card is drawn | Replace Amorphous with one random eligible sigil for that drawn instance. | Keep with Amoeba or omit both. |
| Frozen Away | On bearer death | Replace it in the same lane with its contained card; Frozen Opossum contains Opossum. | Useful terrain polish. |
| Bellist | On play | Create 0/1 Chimes in empty adjacent lanes. The Daus separately retaliates against a card that directly damages one of its Chimes; that retaliation is not part of transferable Bellist. | Rare polish. |
| Steel Trap | Immediately when bearer dies | Kill the opposing card, then create a Wolf Pelt in owner's hand in Act I. It is effect death, so Loose Tail/Repulsive do not avoid it. If no card opposes it, no kill. | Boss-only; omit unless implementing Trapper. |
| Repulsive | When an opposing card would directly attack bearer | Cancel that attack. Non-attack effects can still damage it. | Boss/starvation edge case. |
| Tidal Lock | Beginning of owner's turn | Remove all Squirrels and Rabbits from the board. Bees are unaffected. | Moon-only; omit outside final boss. |
| Omni Strike | When bearer attacks | Strike every occupied opposing lane left to right; if none is occupied, make one direct strike. | Moon-only; omit outside final boss. |

Primary source: [Act I sigil table](https://inscryption.fandom.com/wiki/Sigils). Behavior/timing cross-checks: [Sprinter](https://inscryption.fandom.com/wiki/Sprinter), [Burrower](https://inscryption.fandom.com/wiki/Burrower), [Loose Tail](https://inscryption.fandom.com/wiki/Loose_Tail), [Corpse Eater](https://inscryption.fandom.com/wiki/Corpse_Eater), [Airborne](https://inscryption.fandom.com/wiki/Airborne), [Bifurcated Strike](https://inscryption.fandom.com/wiki/Bifurcated_Strike), [Trifurcated Strike](https://inscryption.fandom.com/wiki/Trifurcated_Strike), [Steel Trap](https://inscryption.fandom.com/wiki/Steel_Trap), and [Fledgling](https://inscryption.fandom.com/wiki/Fledgling).

---

## 6. Rare cards

Ordinarily, beating a boss offers one of three rare cards. Golden Pelts can also buy rares, but that economy is optional for an adaptation.

| Rare card | Cost | P/H | Tribe | Native sigil(s) / special behavior | Scope |
|---|---:|---:|---|---|---|
| Geck | free | 1/1 | Reptile | None; a free card that becomes excellent with upgrades. | Core rare |
| Mantis God | 1B | 1/1 | Insect | Trifurcated Strike. | Core rare |
| Mole Man | 1B | 0/6 | — | Burrower, Mighty Leap. | Core rare |
| Amalgam | 2B | 3/3 | all | Counts as Avian, Canine, Hooved, Reptile, Insect, and Squirrel. | Core rare |
| Pack Rat | 2B | 2/2 | — | Trinket Bearer. Also awarded at an item node if inventory is already full. | Core rare |
| Ouroboros | 2B | 1/1+ | Reptile | Unkillable; each death permanently gives all Ouroboros copies +1/+1 in the base campaign. One per deck. | Core stats; persistence optional |
| Strange Larva | 1B | 0/3 | Insect | Fledgling → Strange Pupa (0/3, Fledgling) → Mothman (7/3, Airborne). | Core rare or polish |
| Amoeba | 2N | 1/2 | — | Amorphous. | Polish |
| Child 13 | 1B | 0/1 | Hooved | Many Lives. Each sacrifice alternates dormant 0/1 and awakened 2/1 Airborne; after 13 sacrifices becomes Hungry Child and no longer survives sacrifice. | Polish/easter egg |
| Long Elk | 4N | 1/2 | Hooved | Sprinter, Touch of Death; leaves a free 0/1 Vertebrae in the lane it vacates whenever it moves. | Polish |
| The Daus | 2B | 2/2 | none in base Act I | Bellist; directly retaliates against a card that damages one of its Chimes. | Polish |
| Urayuli | 4B | 7/7 | — | No sigil; extreme four-sacrifice body. | Easy optional rare |

Sources: [rare-card category](https://inscryption.fandom.com/wiki/Category:Rare_card), [Ouroboros](https://inscryption.fandom.com/wiki/Ouroboros), [Mothman / Strange Larva chain](https://inscryption.fandom.com/wiki/Mothman), [Child 13](https://inscryption.fandom.com/wiki/Child_13), [Long Elk](https://inscryption.fandom.com/wiki/Long_Elk), and [The Daus](https://inscryption.fandom.com/wiki/The_Daus).

---

## 7. Terrain, support, generated, and boss cards

Terrain generally cannot be sacrificed, occupies a lane, can receive damage, and awards a Bone when a friendly one dies. Worthy Sacrifice is an explicit exception that can make otherwise invalid sacrifices valid.

### Common/high-value pieces

| Card/token | Cost | P/H | Sigil(s) | How it appears / behavior |
|---|---:|---:|---|---|
| Squirrel | free | 0/1 | — | Drawn from side deck; primary sacrifice resource. |
| Rabbit | free | 0/1 | — | Created in hand by Rabbit Hole; sacrificable. |
| Bee | free | 1/1 | Airborne | Created in hand by Bees Within. |
| Tail | free | 0/2 | inherited | Created in old lane by Loose Tail; inherits non-native sigils from parent. |
| Dam | — | 0/2 | inherited | Spawned adjacent by Dam Builder; terrain, not normally sacrificable. |
| Chime | — | 0/1 | inherited | Spawned adjacent by Bellist; terrain. The Daus can retaliate for its own Chimes. |
| Boulder | — | 0/5 | — | Neutral lane blocker; terrain. No Made of Stone in base Act I. |
| Stump | — | 0/3 | — | Neutral lane blocker; terrain. |
| Grand Fir | — | 0/3 | Mighty Leap | Woodlands terrain; blocks Airborne. |
| Snowy Fir | — | 0/4 | Mighty Leap | Snow Line terrain; blocks Airborne. |
| Frozen Opossum | — | 0/5 | Frozen Away | On death, replace with Opossum (1/1). |
| The Smoke | free | 0/1 | Bone King | Given before boss when player has a spare candle. |
| Greater Smoke | free | 1/3 | Bone King | Optional cabin-puzzle upgrade to Smoke. |

### Boss/story pieces — optional

| Card | P/H | Sigil(s) / special behavior | Encounter use |
|---|---:|---|---|
| Gold Nugget | 0/2 | Terrain | Prospector replaces player's cards with Gold at phase change. |
| Pack Mule | 0/5 | Sprinter; special loot payload | Prospector support; on death gives its carried cards. |
| Strange Frog | 1/2 | Mighty Leap; special death replacement | Trapper support; leaves a Leaping Trap when killed. |
| Leaping Trap | 0/1 | Mighty Leap, Steel Trap | On death kills opposing card and gives Wolf Pelt. |
| Bait Bucket | 0/1 | On death becomes Great White | Angler phase-two terrain. |
| Rabbit/Wolf/Golden Pelt | 0/1, 0/2, 0/3 | Cannot normally be sacrificed | Campaign trade currency that can be used as blockers. |
| Starvation | 1+/1+ | Fifth and later gain Airborne; Repulsive | Enters enemy queue when player main deck is exhausted; scales upward. |
| The Moon | 1/40 | Mighty Leap, Omni Strike, Tidal Lock | Final-boss giant occupying all four lanes. Base Act I does not give it Made of Stone. |

Sources: [Boulder](https://inscryption.fandom.com/wiki/Boulder), [Trees](https://inscryption.fandom.com/wiki/Trees), [Pelts](https://inscryption.fandom.com/wiki/Pelts), [The Smoke](https://inscryption.fandom.com/wiki/The_Smoke), [The Moon](https://inscryption.fandom.com/wiki/The_Moon), and the [Act I card visual list](https://inscryption.fandom.com/wiki/Cards).

---

## 8. Important interactions and test cases

These should become automated engine tests.

1. **Airborne vs Mighty Leap:** Airborne attacks directly through an ordinary blocker, but damages a Mighty Leap blocker. A non-Airborne attacker can still hit an Airborne creature normally.
2. **Airborne vs Waterborne:** both avoid opposing cards during their respective attack windows, so two such cards can repeatedly deal direct damage without hitting each other.
3. **Burrower targeting:** it intercepts a ground attack into an empty lane, can move across occupied intervening lanes, and can move again later in the same combat if alive. It does not intercept Airborne.
4. **Multi-strike interruption:** Bifurcated/Trifurcated strikes resolve left to right. Sharp Quills can kill the attacker after an early strike, cancelling remaining strikes.
5. **Touch of Death:** only after positive card damage. A 0-Power Adder does nothing; Airborne direct damage does not kill the skipped blocker.
6. **Loose Tail:** pre-hit movement chooses right, then left. If both occupied, no Tail appears. Steel Trap and Sharp Quills affect the original card directly rather than triggering the Tail.
7. **Waterborne:** because the submerged card is not a blocker on the enemy turn, opposing damage is direct rather than dealt to it. It can still die by attacking Sharp Quills on its own turn.
8. **Many Lives and Bones:** sacrificing Cat provides Blood but no Bone because the Cat did not die. Ordinary sacrifice does award a Bone. Worthy Sacrifice provides 3 Blood but still only one death/Bone.
9. **Unkillable and sacrifice:** sacrificing Cockroach pays Blood, awards its death Bone, and returns it to hand. Ouroboros additionally gains +1/+1 before/with the returned copy.
10. **On-play via Corpse Eater:** a Corpse Eater card enters without paying its cost and still triggers Rabbit Hole/Fecundity/Hoarder/etc. It only reacts to a friendly **combat** death.
11. **Spawn inheritance:** Dams, Chimes, Rabbits, Bees, and Tails inherit relevant added/totem sigils from their source in the original. Native spawning sigils should be excluded to prevent accidental recursive spawning unless explicitly desired. This is a major combo surface; implement with a `copyInheritableSigils()` policy.
12. **Fecundity:** in base Act I, generated copies retain Fecundity, allowing loops. If this is too easy to break, intentionally adopt Kaycee's later one-use behavior and disclose the change.
13. **Fledgling:** transform at the beginning of the owner's next turn, preserving damage/stat buffs and added sigils. Use card-specific forms before generic Elder fallback.
14. **Movement order:** attacks finish first; then Sprinter/Hefty resolve left to right. Direction reverses when blocked. Test two movers competing for the same opening.
15. **Ant Power:** update immediately as Ant-trait cards enter and leave. Ant Queen creates a Worker Ant in hand but gains no Power from it until that Ant reaches the board.
16. **Leader and variable Power:** calculate continuous modifiers after base variable Power. Adjacent 0-Power terrain can attack for 1 if it participates in an attack phase.
17. **Daus split behavior:** Bellist merely creates Chimes. Retaliation belongs to The Daus card's special behavior and should not transfer with the sigil.
18. **Steel Trap immediacy:** its death effect kills the opposing attacker before any supposed excess attack consequence; Unkillable can return the killed attacker afterward.
19. **Repulsive is attack-only:** it does not stop Quills, Trap, pickaxe, or other non-attack damage.
20. **Board-lock risk:** Dams, Chimes, terrain, and Many Lives cards consume lanes and are not freely removable. Preserve this drawback; it balances powerful spawning/sacrifice engines.

---

## 9. Minimal polished roster recommendation

For a smaller adaptation, ship these **33 regular draftable cards** (counting each evolution chain by its draftable first form), **7 rares**, and the listed tokens/terrain:

- **Avian:** Kingfisher, Raven Egg/Raven, Magpie, Turkey Vulture
- **Canine:** Wolf Cub/Wolf, Bloodhound, Coyote, Alpha
- **Hooved:** Black Goat, Elk Fawn/Elk, Pronghorn, Moose Buck
- **Insect:** Beehive/Bee, Mantis, Worker Ant, Ant Queen, Cockroach, Corpse Maggots
- **Reptile:** Bullfrog, Skink, Adder, River Snapper, Rattler
- **Misc:** Cat, Mole, Porcupine, Skunk, Warren, Beaver, Field Mice, Rat King, Grizzly, Bat
- **Rares:** Geck, Mantis God, Mole Man, Amalgam, Pack Rat, Ouroboros, Strange Larva
- **Support:** Squirrel, Rabbit, Tail, Dam, Boulder, Stump, Grand Fir, Snowy Fir

This roster exercises nearly every high-value mechanic without requiring story cards, pelts, boss scripts, Tentacle variable stats, or obscure transformations.

---

## 10. Source index and reliability notes

- [Inscryption Wiki — Cards](https://inscryption.fandom.com/wiki/Cards): Act I list, opening hand/draw rules, card links, acquisition overview.
- [Inscryption Wiki — Sigils](https://inscryption.fandom.com/wiki/Sigils): Act I rulebook wording for all 34 base sigils.
- [Inscryption Wiki — Variable Stats](https://inscryption.fandom.com/wiki/Variable_Stats): Ant, hand, mirror, and bell formulas.
- [Inscryption Wiki — Blood](https://inscryption.fandom.com/wiki/Blood) and [Bones](https://inscryption.fandom.com/wiki/Bones): payment/death-resource behavior.
- [Inscryption Wiki — Act I](https://inscryption.fandom.com/wiki/Act_I): campaign and boss scope.
- [Purefunc card database](https://inscryption.purefunc.org/cards.html): useful independent card-stat index, but its displayed ability names appeared mismatched during this research; do **not** use it as the only sigil source.
- [Steam community Act I card guide](https://steamcommunity.com/sharedfiles/filedetails/?id=2640799540): secondary visual checklist; automated retrieval was rate-limited during research.

The Fandom wiki is community-maintained rather than official engine documentation. Card infoboxes and rulebook text are strong for content coverage; very obscure ordering combinations should be verified against gameplay before claiming frame-perfect fidelity. The reference above deliberately calls out deterministic implementation choices where exact internal order is not documented.

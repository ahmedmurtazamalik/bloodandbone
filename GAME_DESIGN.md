# Blood & Bone — Match Design

## Target experience

Blood & Bone is a competitive solo lane battler with a target successful-run duration of roughly **20–35 minutes**. Duration should come from consequential decisions and shifting board states, not from slow animations or inflated Health.

A good turn asks at least two questions:

1. What does the public enemy intent require me to answer?
2. What am I willing to spend or expose to answer it?

## Why the original matches ended too quickly

The previous structure had three compounding problems:

- The player could win after attacking before the opponent replied.
- A five-point scale threshold allowed one strong open-lane hit to decide a trial.
- The opponent only had eight authored turns, so extending the clock alone would repeat the same sequence.

Card-stat tuning could not solve those structural problems.

## Match structure

Each trial is now a sixteen-turn contest.

- Both sides attack before the round is judged.
- Turns 1–11 are protected; they establish engines, damage, lane ownership, and resource reserves.
- From turn 12 onward, a 20-point lead wins by domination.
- If neither side dominates, the leader after turn 16 wins regulation.
- A turn-16 tie continues into full-round sudden death.

The scale still matters every turn, but early tempo no longer skips the midgame.

## Recurring decisions

### Draw economy

The Squirrel deck is reliable fuel. The creature deck is a **Scout 3, choose 1** decision. Unchosen cards cycle to the bottom, allowing players to plan future draws instead of gambling on an unknown top card.

### Tactical opportunity

Once each turn, the player may choose one:

- **Maneuver** — move a creature into an adjacent empty lane.
- **Mend** — spend 2 Bones to restore up to 2 Health.

Maneuver answers public lane intent; Mend protects an engine creature; doing neither preserves flexibility and Bones. The shared opportunity prevents both actions from becoming automatic upkeep.

### Card play

Blood, Bones, lane occupancy, persistent damage, sigils, and sacrifices remain the primary card engine. The longer clock gives delayed value cards and durable blockers enough time to matter.

## Opponent arcs

Each opponent has sixteen authored turns rather than an eight-turn loop. Every arc contains:

- opening probes;
- durable blockers;
- midgame pressure;
- at least three breathing turns;
- multi-lane endgame threats.

Public previews keep difficult waves strategic rather than surprising.

## Current balance evidence

The deterministic production bot uses Scout, card play, Maneuver, and Mend. Its successful campaign currently resolves as:

| Trial | Result | Turn | Final lead |
|---|---:|---:|---:|
| I | Domination | 12 | 30 |
| II | Domination | 13 | 23 |
| III | Regulation | 16 | 4 |

This creates a 41-round baseline. Trial III is intentionally close instead of relying on excessive creature stats.

## Tuning guardrails

Future changes should preserve these principles:

- Do not reduce the minimum match turn below 12 without measured playtest evidence.
- Do not create duration by adding animation delay alone.
- Every new card should have a distinct role, not merely a larger stat line.
- Every strong strategy needs at least one lane, timing, resource, or deck-building counterplay axis.
- Add cards from the broader beast list in role-based packages after playtesting identifies missing strategies.
- Technology/Energy cards should become a separate coherent archetype or encounter ruleset, not be mixed into Blood/Bones without an economy design.
- Keep enemy intent public enough that losses can be traced to decisions.
- Validate balance with multiple deterministic policies and human playtests; one greedy bot is a regression baseline, not proof of perfect balance.

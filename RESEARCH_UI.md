# Blood & Bone: UI reference study and redesign constraints

Research date: 14 October 2026. This document records the rejected interface and the reasoning for its replacement. It concerns presentation and interaction; it does not propose changes to combat, card costs, encounter progression, or victory rules.

The rejected title, battle capture, generated backdrop, and its prompt are preserved under `artifacts/rejected-ui/` for comparison. None of those assets is used by the rebuilt game.

## Evidence and limits

The team visually inspected publisher-provided gameplay screenshots, the rejected title and battle captures, `index.html`, `styles.css`, and the generated backdrop with its saved prompt. Observations describe visible evidence. Inferences are our proposed application to this project. “AI slop” is a subjective association with generic, interchangeable presentation, not a reliable test of authorship. A still screenshot cannot establish hover behavior, transition timing, or usability across every game state.

[NN/G's AI prototype evaluation](https://www.nngroup.com/articles/ai-prototyping/) found that superficially plausible outputs could miss hierarchy, grouping, contrast, and context. Its wrong-pattern examples are pertinent: choosing a familiar layout can give secondary content attention that belongs to the user's actual task. Our inference is that a playable game needs a game composition before decorative web styling.

## Gameplay screenshot study

| Reference and inspected primary screenshot | Observation | Application to Blood & Bone |
| --- | --- | --- |
| [Inscryption](https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1092790/ss_0191a69b0e94a9a7784f5b81e27f06379910645a.1920x1080.jpg) | The board is a physical table viewed in perspective. A scale sits to the left; overlapping cards occupy the foreground. The antagonist and surrounding objects belong to the same scene. | Use a coherent table with visible objects and a foreground hand. Preserve the four-lane relationship without reproducing the cabin or its artwork. |
| [Slay the Spire](https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/646570/ss_01aa3e7759e457bfbf2422f31c325d7b3ba8a6eb.1920x1080.jpg) | A shallow top HUD leaves the encounter central. The hand sits along the bottom; energy and piles occupy lower corners; End Turn sits low on the right. A large active Zap+ card is visible. | Keep metadata shallow, actions stable, and cards prominent. Contextual hover/focus enlargement is a proposed interaction; this still does not prove its trigger. |
| [Monster Train](https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1102190/ss_edce778e9006c559cc347542ba2a61ed1461c945.1920x1080.jpg) | Train floors structure the combat space. Units have nearby statistics. A fanned hand, corner resources, and right-side End Turn surround that structure. | The field should express the game's spatial rules. Resources should be close to their associated objects and actions. |
| [Wildfrost](https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1811990/ss_d7ed2146d858a0abd02a8256befe264328595537.1920x1080.jpg) | Repeated ground slots establish placement. Card corners consistently carry health, attack, and countdown information. A raised Big Berry card displays readable ability text. | Use predictable statistic positions and a generous inspection state. Do not solve narrow layouts by shrinking every detail together. |
| [Balatro battle](https://www.playbalatro.com/press-kit/Screenshots/Balatro_ui_3840x2160_3.png) and [deck overlay](https://www.playbalatro.com/press-kit/Screenshots/Balatro_ui_3840x2160_1.png), from its [official press kit](https://www.playbalatro.com/press-kit/) | The left rail holds the objective and scoring arithmetic. Jokers occupy the top, played cards the middle, and hand the bottom. Deck inspection uses an overlay. | A sidebar can be appropriate when its information is central to each decision. Judge space by purpose; do not impose a blanket ban on sidebars. |

These references differ strongly in medium and layout. The shared lesson is to give gameplay a clear spatial grammar. A fan hand, shallow HUD, or object display is useful because it communicates the player's situation, not because it is fashionable.

In a [first-person interview about Inscryption](https://www.gamedeveloper.com/design/how-game-jam-sacrifices-became-inscryption), Daniel Mullins describes deliberately reducing card text and allowing icons to occupy portrait space to preserve legibility. That supports prioritizing readable game information over decorative completeness.

## Audit of the rejected interface

The rejected interface used the following elements and selectors:

- **Marketing composition:** `#titleScreen`, `.title-masthead`, `.title-plaque`, `.title-showcase`, and `.title-footer` form a brand masthead, eyebrow, split display headline, product showcase, and three numbered benefits. This is a substantial landing page around a Start action. The title does not need to sell the player a game they have already opened.
- **Repeated slogans:** `.title-copy`, `.title-description`, `.showcase-caption`, and the footer repeat compact promises and imperative triplets. They consume hierarchy while practical game information remains small. `#startButton` adds an upward-right arrow associated with web navigation rather than a clear game action.
- **Unassigned ornament:** `.brand-mark`, `.footer-seal`, `.panel-heading`, `.table-note`, and `.field-divider` scatter crosses, diamonds, and sparkle-like marks across unrelated functions. They do not establish a consistent symbol language.
- **Dashboard framing:** `.battle-layout`, `.battle-sidebar`, `.scale-stage`, `.turn-ledger`, `.felt-board`, and `.lane` place several similarly bordered, rounded containers beside one another. Separate panels make the table feel like a collection of widgets rather than one place where creatures battle.
- **Disconnected imagery:** `assets/woodland-altar.webp` depicts painted cards, scale, raven, and lantern; the playable scene uses flat creature illustrations and CSS objects. Its saved prompt asks for cinematic atmosphere and negative space for text. Attractive wallpaper cannot resolve that mismatch of media.
- **Tiny detail:** narrow-screen rules shrink lane names to 6–7px and preview sigils to 4px. Helpers and metadata frequently use 7–9px. These are concrete legibility concerns, independently of any aesthetic label.

[The New Yorker's designer interviews](https://www.newyorker.com/culture/infinite-scroll/the-ai-design-aesthetic-thats-taking-over-the-internet) associate current AI output with oversized accented serifs, tracked captions, warm desaturated palettes, and repeated rounded outlines. These traits overlap our rejected treatment. Their combination and lack of contextual justification matter; none is inherently defective.

[Jim Nielsen's critique](https://blog.jim-nielsen.com/2026/ai-aesthetic/) discusses sparkle associations, small thin icons, and recognizable AI-product aesthetics. Our decorative glyphs are an analogous association, not the exact sparkle emoji he examines.

For games, the relevant problem also includes inconsistent art direction. A [2024 CHI PLAY study of indie developers](https://guof.people.clemson.edu/papers/chiplay24.pdf) records concerns about generated variations drifting from a game's intended style, and about assets failing to fit together. These are reported developer perceptions, not a universal verdict on generated art. A [Dagstuhl game-development workshop](https://drops.dagstuhl.de/storage/04dagstuhl-reports/volume14/issue06/24261/DagRep.14.6.130/DagRep.14.6.130.pdf), section 3.11, separately treats visual cues for gameplay and consistency between sprites as requirements; its experiments found similar-looking outputs could still fail to convincingly represent the same character. Our inference for this game is concrete: retain the existing woodcut creature set, draw interface symbols in one style, and keep paper, wood, and metal consistent across the title, table, cards, and controls. The rejected painted wallpaper alongside unrelated flat widgets failed that test.

## Constraints for the replacement

1. Build one viewport-sized gameplay scene with a central four-lane field, incoming threats, and a foreground fan hand. Responsive sizing must preserve reachable actions and inspectable cards.
2. Give the scale, Bones, draw piles, and bell visible object roles. Use a compact HUD for trial, opponent, turn, and phase; make essential numbers easy to read.
3. Offer card inspection on pointer hover and keyboard focus, with an equivalent touch path. Keep the full card legible above overlapping neighbors.
4. Keep the ledger available through an optional log control and rules/audio through a compact menu. Opening secondary information must preserve selection, focus, and game context.
5. Remove the hero, feature footer, marketing taglines, arrow CTA decoration, arbitrary sparkle marks, repeated dashboard panels, and generated cinematic wallpaper. Use original local artwork consistently.
6. Retain semantic color and redundant state cues: Blood, Bones, current Health, legal targets, selected offerings, and combat progress. Palette changes must not erase meaning.

[Game Accessibility Guidelines](https://gameaccessibilityguidelines.com/use-an-easily-readable-default-font-size/) recommends a readable default size and identifies small-screen viewing as a common difficulty. Review actual rendered text; a mechanically contained viewport is insufficient. Verification must include crowded hands, card inspection, sacrifice confirmation, tutorial actions, modal focus return, reduced motion, and both portrait phones and desktop battle scenes.

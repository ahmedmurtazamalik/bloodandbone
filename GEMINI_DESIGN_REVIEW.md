# Gemini Design Consultation — August 3, 2026

## Consultation method

The existing project, source files, and four baseline screenshots were reviewed through the local Antigravity CLI using **Gemini 3.6 Flash High** in plan mode. Gemini was instructed to critique the accepted mechanics without editing them, avoid copying *Inscryption* artwork or screens, and provide an implementable plain-HTML/CSS/JavaScript redesign with local SVG art and a real first-run tutorial.

## Baseline diagnosis

Gemini scored the former presentation **22/100** for anti-AI-slop quality. Its main criticisms were:

- Single letters standing in for creature portraits
- A flat slider standing in for the damage scale
- A rectangular gradient button standing in for the bell
- Flat deck boxes without card thickness or backs
- Bones represented only by counter text
- Tiny tracked all-caps typography across nearly every component
- Repeated dark rectangles and thin borders that made the game resemble a web dashboard
- Insufficient material, lighting, and physical tabletop presence

## Adopted direction

**The Ritualist's Oak & Linocut Hearth**

- Heavy unbleached rag-paper cards
- Two-tone hand-carved linocut creature illustrations
- Worn green felt mounted in dark oak
- Antique brass balance and service bell
- Carved Bone tokens
- Printed deck backs with visible stack thickness
- Warm serif typography with restrained small-caps
- Low candlelight and subtle paper/wood/felt texture
- Physical, short motion used only to clarify card selection, targeting, combat, and bell states

## Implemented changes

- Replaced letter portraits with 32 unique local SVG compositions in `src/illustrations.js`
- Rebuilt card anatomy around printed names, recessed portrait windows, wax/bone costs, stamped sigils, brass Power discs, and red Health shields
- Replaced the horizontal scale track with an articulated balance whose beam tilts and whose pans gain weight tokens
- Added a live physical Bone pile
- Rebuilt both decks as stacked cards with printed backs
- Rebuilt the combat button as a brass service bell
- Added an opponent silhouette and reorganized gameplay as an Operate surface
- Reworked title, rules, reward, result, desktop, and mobile layouts
- Added a mobile-only swipe cue for the internally scrolling four-lane board
- Added `prefers-reduced-motion` handling

## Interactive tutorial

The first run now uses a deterministic opening hand and gates actual production actions:

1. Read enemy intent
2. Select Squirrel
3. Place it in lane one
4. Select Stoat
5. Mark the Squirrel as an offering
6. Confirm the offering
7. Place Stoat in the vacated lane
8. Observe the Bone earned by death
9. Ring the bell and resolve real combat
10. Choose a Squirrel draw on turn two
11. Continue normal play

Completion is stored as `bb_tutorial_completed` in `localStorage`. Players may skip from the coach panel or replay the guided hand from the rulebook at any time.

## Final anti-slop audit

The final primary gameplay surface no longer triggers the original audit's compositional failures:

- No tech gradient or generic indigo accent
- No feature-tile grid
- No glassmorphism
- No icon-topper component pattern
- No letter-placeholder artwork
- No dashboard-style stat monuments
- No wrong-surface hero framing during gameplay
- Centered compositions are limited to valid title/reward/result Learn or Compare surfaces

The remaining gradients are material highlights on brass and candlelight—not generic software decoration.

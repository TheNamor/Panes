# Panes

A color-matching puzzle prototype. Click or drag the glass panes from the tray
onto the board, layering them to recreate the color reference. Board size
depends on difficulty. Click overlapping cells to cycle through panes, then
click a board cell or drag to move the selected pane. Pieces of the same color
cannot overlap; a rejected placement briefly outlines the conflicting pane in
red. Click the tray or drop a pane off the board to return it to the bank. Use
**Undo** to reverse the last successful move or **Reset** to start over. Bank
pieces are held from the occupied square nearest their center, with ties
resolved toward the bottom-right square. Triple overlaps are shown with a
rainbow gradient. Use the Yellow, Red, and Blue buttons above the board to
isolate a color; other colors are dimmed but remain movable. Clicking an
overlapping cell picks up highlighted panes before dimmed panes while a color
filter is active, preserving most-recently-placed order within each group.
Repeated clicks cycle through the full stack.

Daily progress for all difficulties is saved in tab-scoped session storage for
the current New York date and restored when switching difficulties or
reloading the tab. Placements are restored without Undo history. Random progress
is kept only for the current app session, across difficulty switches, and is
cleared when generating a new random puzzle or returning to Daily. Completed
puzzles show the victory dialog again when revisited.

Puzzles are generated at runtime. **Daily** uses puzzles keyed to the current
calendar date in New York; **Random** creates a fresh seed, and **New random
puzzle** generates another set. Each seed has Easy, Medium, Hard, Extreme, and
Impossible versions. Difficulty scales the board, pane count, average pane size,
and same-color adjacency:

| Difficulty | Board | Pieces | Mixed pieces | Target average pane size | Adjacency |
| --- | ---: | ---: | ---: | ---: | ---: |
| Easy | 5×5 | 8–9 | — | 4.1–5.0 | 4–7 |
| Medium | 6×6 | 15–17 | — | 3.8–4.2 | 9–14 |
| Hard | 6×6 | 15–17 | ⅓ | 3.8–4.2 | 9–14 |
| Extreme | 7×7 | 18–20 | ⅓ | 4.0–4.4 | 12–18 |
| Impossible | 7×7 | 18–20 | ⅓ | 4.0–4.4 | 12–18 |

Each puzzle also reports a `difficultyScore` from 0 to 100. It is the equally
weighted average of normalized adjacency, piece-count, and average-pane-size
scores; higher values indicate harder puzzles.

Puzzles use connected red, blue, and yellow pieces that combine into purple,
green, orange, and mixed colors. Generated puzzles are not checked for unique
solutions, and identical piece shapes may occur. Every generated piece still
overlaps at least one other piece in the intended solution.

Hard, Extreme, and Impossible puzzles include mixed-color pieces in their
listed total piece counts. About one-third are mixed (5, 5, or 6 pieces for
totals of 15, 16, or 17; 6, 6, or 7 pieces for totals of 18, 19, or 20); each
has one square in a different primary color, chosen randomly. Impossible
currently uses the same generation parameters as Extreme. Overlap restrictions
are enforced per square color, so same-color squares cannot overlap.

## Project setup
```
npm install
```

### Compiles and hot-reloads for development
```
npm run serve
```

### Compiles and minifies for production
```
npm run build
```

### Lints and fixes files
```
npm run lint
```

### Check puzzle generation
```
npm run test:generation
npm run test:generation:experimental
```



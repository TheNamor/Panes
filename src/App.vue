<template>
  <v-app>
    <main class="game-shell">
      <div class="puzzle-toolbar" aria-label="Puzzle modes">
        <div class="puzzle-mode-switch" role="group" aria-label="Choose puzzle mode">
          <button
            type="button"
            :disabled="isGenerating"
            :class="{ 'puzzle-mode-button--active': mode === 'daily' }"
            :aria-pressed="mode === 'daily'"
            @click="selectDaily"
          >Daily</button>
          <button
            type="button"
            :disabled="isGenerating"
            :class="{ 'puzzle-mode-button--active': mode === 'random' }"
            :aria-pressed="mode === 'random'"
            @click="loadRandomPuzzle"
          >Random</button>
        </div>
        <div class="difficulty-switch" role="group" aria-label="Choose puzzle difficulty">
          <button
            v-for="level in difficultyOptions"
            :key="'difficulty-' + level"
            type="button"
            :disabled="isGenerating"
            :class="{ 'difficulty-button--active': difficulty === level }"
            :aria-pressed="difficulty === level"
            @click="selectDifficulty(level)"
          >{{ level }}</button>
        </div>
        <span class="puzzle-mode-label" role="status" aria-live="polite">
          <template v-if="isGenerating">{{ generationStatus }}</template>
          <template v-else>{{ mode === 'daily' ? 'Daily · ' + dailySeed : 'Random puzzle' }}</template>
          <v-chip color="orange" small style="margin-left: 10px">Beta</v-chip>
        </span>
        <button
          v-if="mode === 'random'"
          type="button"
          class="new-puzzle-button"
          :disabled="isGenerating"
          @click="loadRandomPuzzle"
        >New random puzzle</button>
      </div>
      <p v-if="generationError" class="generation-error" role="alert">{{ generationError }}</p>
      <p v-if="saveError" class="save-error" role="alert">{{ saveError }}</p>
      <div
        class="game-layout"
        :class="{ 'game-layout--generating': isGenerating }"
        :aria-busy="isGenerating"
      >
        <section class="board-section" aria-labelledby="board-heading">
          <div class="section-label board-label">
            <div>
              <span class="section-kicker">THE CANVAS</span>
            </div>
          </div>

          <div class="color-filters board-label" role="group" aria-label="Isolate a pane color">
            <button
              v-for="color in colorFilterOptions"
              :key="'filter-' + color.key"
              type="button"
              class="color-filter-button"
              :class="{ 'color-filter-button--active': activeColorFilter === color.key }"
              :style="{ '--filter-color': color.value }"
              :aria-pressed="activeColorFilter === color.key"
              @click="toggleColorFilter(color.key)"
            >{{ color.label }}</button>
            <v-spacer/>
            <div class="board-actions">
              <v-btn
                text
                x-small
                rounded
                color="#8a8e86"
                class="reset-button"
                :disabled="moveHistory.length === 0 || isSolved"
                @click="undoMove"
              >
                Undo
            </v-btn>
              <v-btn
                text
                x-small
                rounded
                color="#8a8e86"
                class="reset-button"
                :disabled="placedCount === 0 || isSolved"
                @click="resetBoard"
              >
                <v-icon small>mdi-refresh</v-icon> Reset
            </v-btn>
            </div>
          </div>

          <div
            ref="board"
            class="board"
            :class="{
              'board--dragging': Boolean(drag),
              'board--solved': isSolved,
            }"
            :style="{ aspectRatio: boardColumns + ' / ' + boardRows }"
            role="group"
            aria-label="Puzzle board. Drop panes here to arrange them."
            :aria-disabled="isSolved"
            @pointerdown="onBoardPointerDown"
          >
            <div class="board-grid" :style="boardGridStyle" aria-hidden="true">
              <div
                v-for="(cell, index) in boardCells"
                :key="'board-cell-' + index"
                class="board-cell"
                :class="{
                  'board-cell--filled': cell.occupied,
                }"
                :style="boardCellStyle(cell)"
                @mouseenter="setHoveredCell(index)"
                @mouseleave="clearHoveredCell"
              ></div>
            </div>

            <div
              v-for="piece in placedPieces"
              :key="'placed-' + piece.id"
              class="piece-shape placed-piece"
              :class="{
                'piece-shape--hidden': isDragging(piece.id),
                'placed-piece--selected': selectedPieceId === piece.id,
                'placed-piece--collision': collisionPieceId === piece.id,
                'placed-piece--dimmed': activeColorFilter && !pieceHasColor(piece, activeColorFilter),
              }"
              :style="placedStyle(piece)"
              :aria-label="piece.name + ', placed on the board'"
            >
              <button
                v-for="cell in piece.cells"
                :key="piece.id + '-' + cell.row + '-' + cell.col"
                type="button"
                class="pane-cell pane-cell--placed"
                :class="{ 'pane-cell--selected': selectedPieceId === piece.id }"
                :disabled="isSolved"
                :style="cellStyle(cell, piece)"
                :aria-label="cellAriaLabel(cell, piece)"
                @pointerdown="startPlacedPress($event, piece, cell.row, cell.col)"
                @mouseenter="hoverPieceCell(piece, cell)"
                @mouseleave="clearHoveredCell"
              ></button>
              <svg
                v-if="selectedPieceId === piece.id || collisionPieceId === piece.id"
                class="selection-outline"
                :viewBox="'0 0 ' + piece.cols + ' ' + piece.rows"
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                <path
                  class="selection-outline-halo"
                  :class="{ 'selection-outline-halo--collision': collisionPieceId === piece.id }"
                  :d="pieceOutlinePath(piece)"
                  fill="none"
                  stroke-linejoin="round"
                  vector-effect="non-scaling-stroke"
                ></path>
                <path
                  class="selection-outline-ink"
                  :class="{ 'selection-outline-ink--collision': collisionPieceId === piece.id }"
                  :d="pieceOutlinePath(piece)"
                  fill="none"
                  stroke-linejoin="round"
                  vector-effect="non-scaling-stroke"
                ></path>
              </svg>
            </div>

            <div
              v-if="hoveredCellIndex !== null && !drag"
              class="board-cell-highlight"
              :style="hoveredBoardCellStyle"
              aria-hidden="true"
            ></div>

            <div v-if="placedCount === 0 && !drag" class="board-empty-message">
              <span class="empty-sparkle" aria-hidden="true">☐</span>
              <span>Drop a pane to begin</span>
            </div>

            <div v-if="drag" class="drag-preview" :style="dragStyle">
              <div
                class="piece-shape preview-shape"
                :style="previewShapeStyle(drag.piece)"
                aria-hidden="true"
              >
                <span
                  v-for="cell in drag.piece.cells"
                  :key="'preview-' + cell.row + '-' + cell.col"
                  class="pane-cell pane-cell--preview"
                  :style="previewCellStyle(cell, drag.piece)"
                ></span>
              </div>
            </div>
          </div>
        </section>

        <aside class="side-panel" aria-label="Goal and panes">
          <section class="goal-section" aria-label="Color reference">
            <div class="section-label">
              <span class="section-kicker">THE REFERENCE</span>
            </div>
            <div class="goal-frame">
              <div class="goal-display">
                <div
                  class="goal-grid"
                  :style="goalGridStyle"
                  role="img"
                  :aria-label="'Goal color pattern, ' + boardRows + ' by ' + boardColumns"
                >
                  <span
                    v-for="(color, index) in goalCells"
                    :key="'goal-' + index"
                    class="goal-cell"
                    :class="{
                      'goal-cell--hidden': isHiddenCell(index),
                      'grid-cell--hovered': hoveredCellIndex === index,
                    }"
                    :style="goalCellStyle(color)"
                    @mouseenter="setHoveredCell(index)"
                    @mouseleave="clearHoveredCell"
                  >{{ isHiddenCell(index) ? '?' : '' }}</span>
                </div>
                <span class="goal-display-label">Goal</span>
              </div>
              <div class="goal-display">
                <div class="goal-progress-grid" :style="goalGridStyle" role="group" aria-label="Puzzle progress by cell">
                  <span
                    v-for="(cell, index) in progressCells"
                    :key="'progress-' + index"
                    class="goal-progress-cell"
                    :class="[
                      'goal-progress-cell--' + cell.status,
                      { 'goal-progress-cell--hidden': cell.hidden },
                      { 'grid-cell--hovered': hoveredCellIndex === index },
                    ]"
                    role="img"
                    :aria-label="'Row ' + (cell.row + 1) + ', column ' + (cell.col + 1) + ': ' + (cell.hidden ? 'hidden' : cell.status)"
                    @mouseenter="setHoveredCell(index)"
                    @mouseleave="clearHoveredCell"
                  >{{ cell.hidden ? '?' : cell.status === 'correct' ? '✓' : cell.status === 'incorrect' ? '×' : '' }}</span>
                </div>
                <span class="goal-display-label">Progress</span>
              </div>
            </div>
          </section>

          <section class="pieces-section" aria-labelledby="pieces-heading">
            <div class="section-label pieces-label">
              <div>
                <span class="section-kicker">THE PANES</span>
                <span id="pieces-heading" class="section-caption">Pick up a piece</span>
              </div>
              <span class="pieces-count">{{ remainingCount }} remaining</span>
            </div>

            <div
              class="pieces-tray"
              :class="{
                'pieces-tray--return-target': drag && drag.fromBoard,
                'pieces-tray--disabled': isSolved,
              }"
              :aria-disabled="isSolved"
              role="region"
              aria-label="Available panes"
              tabindex="0"
              @pointerdown="onTrayPointerDown"
            >
              <div
                v-for="piece in availablePieces"
                :key="'tray-' + piece.id"
                class="piece-card"
                :class="{
                  'piece-card--dragging': isDragging(piece.id),
                  'piece-card--selected': selectedPieceId === piece.id,
                }"
                :aria-label="piece.name"
                @pointerdown="startBankPress($event, piece)"
              >
                <div class="piece-card-body">
                  <div class="piece-shape tray-shape" :style="trayShapeStyle(piece)">
                    <span
                      v-for="cell in piece.cells"
                      :key="piece.id + '-tray-' + cell.row + '-' + cell.col"
                      class="pane-cell pane-cell--tray"
                      :style="trayCellStyle(piece, cell)"
                    ></span>
                  </div>
                </div>
              </div>
              <div v-if="remainingCount === 0" class="tray-complete">
                Drag a pane off the board to return it to the bank.
              </div>
            </div>
            <p class="tray-tip"><span aria-hidden="true">↗</span> Click or drag a pane to place; click the bank or release off the board to return it.</p>
          </section>
        </aside>
      </div>
    </main>
    <v-dialog v-model="victoryDialog" max-width="420">
      <v-card class="victory-dialog">
        <v-card-title class="victory-dialog-title">
          <div style="margin-left: auto">Puzzle complete!</div>
          <div style="margin-left: auto"><v-btn
            icon
            small
            @click="victoryDialog = false"
          ><v-icon>mdi-close</v-icon></v-btn></div>
        </v-card-title>
        <v-card-text class="victory-dialog-message">
          Congrats on completing the {{ difficultyLabel }} puzzle.
        </v-card-text>
      </v-card>
    </v-dialog>
  </v-app>
</template>

<script>
const seedrandom = require('seedrandom');
const {
  COLORS,
  MIXES,
  generateExperimentalPuzzle,
  getPieceCellColor,
  getDailySeed,
} = require('./puzzleGenerator');

const DAILY_PROGRESS_STORAGE_KEY = 'panes.daily-progress.v1';

function getHiddenCellIndices(seed, difficulty, rows, columns) {
  const rng = seedrandom(seed + ':hidden-cells:' + difficulty);
  const hidden = new Set();
  while (hidden.size < 2) {
    hidden.add(Math.floor(rng() * rows * columns));
  }
  return Array.from(hidden);
}

function getPieces(definitions) {
  return definitions.map((definition) => {
    const cells = definition.cells.map((cell) => ({ ...cell }));
    return {
      ...definition,
      cells,
      rows: Math.max(...cells.map((cell) => cell.row)) + 1,
      cols: Math.max(...cells.map((cell) => cell.col)) + 1,
      name: definition.mixed
        ? 'Mixed ' + COLORS[definition.color].name + ' pane'
        : COLORS[definition.color].name + ' pane',
      colorName: COLORS[definition.color].name,
    };
  });
}

function shufflePieces(pieces) {
  const shuffled = pieces.slice();
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    const currentPiece = shuffled[index];
    shuffled[index] = shuffled[swapIndex];
    shuffled[swapIndex] = currentPiece;
  }
  return shuffled;
}

export default {
  name: 'PanesGame',
  data() {
    const dailySeed = getDailySeed(new Date());
    const initialPuzzle = generateExperimentalPuzzle(dailySeed, 'easy');
    const puzzles = {
      easy: initialPuzzle,
      medium: initialPuzzle,
      hard: initialPuzzle,
      extreme: initialPuzzle,
      impossible: initialPuzzle,
    };
    const puzzle = puzzles.easy;
    const pieces = getPieces(puzzle.startingPieces);
    return {
      puzzles,
      puzzle,
      pieces,
      trayPieces: shufflePieces(pieces),
      goal: puzzle.goal,
      mode: 'daily',
      difficulty: 'easy',
      difficultyOptions: ['easy', 'medium', 'hard', 'extreme', 'impossible'],
      colorFilterOptions: ['y', 'r', 'b'].map((key) => ({
        key,
        label: COLORS[key].name,
        value: COLORS[key].value,
      })),
      activeColorFilter: null,
      dailySeed,
      dailyProgress: {},
      randomProgress: {},
      generationError: '',
      saveError: '',
      generationStatus: '',
      isGenerating: false,
      hasGeneratedPuzzle: false,
      randomPuzzleCount: 0,
      placed: {},
      placementOrder: {},
      placementSequence: 0,
      lastStackSelection: null,
      drag: null,
      pendingPress: null,
      clickDrop: null,
      selectedPieceId: null,
      moveHistory: [],
      collisionPieceId: null,
      collisionTimeout: null,
      hoveredCellIndex: null,
      victoryDialog: false,
      hiddenCellIndices: [],
    };
  },
  computed: {
    boardRows() {
      return this.puzzle.dimensions.rows;
    },
    boardColumns() {
      return this.puzzle.dimensions.columns;
    },
    boardCellCount() {
      return this.boardRows * this.boardColumns;
    },
    boardGridStyle() {
      return {
        gridTemplateColumns: 'repeat(' + this.boardColumns + ', 1fr)',
        gridTemplateRows: 'repeat(' + this.boardRows + ', 1fr)',
      };
    },
    goalGridStyle() {
      return {
        gridTemplateColumns: 'repeat(' + this.boardColumns + ', 1fr)',
        gridTemplateRows: 'repeat(' + this.boardRows + ', 1fr)',
      };
    },
    goalCells() {
      return this.goal.reduce((cells, row) => cells.concat(row), []);
    },
    placedPieces() {
      return this.pieces.filter((piece) => this.placed[piece.id]);
    },
    availablePieces() {
      return this.trayPieces.filter((piece) => !this.placed[piece.id]);
    },
    placedCount() {
      return this.placedPieces.length;
    },
    remainingCount() {
      return this.pieces.length - this.placedCount;
    },
    boardCells() {
      return this.goal.reduce((cells, row, rowIndex) => {
        row.forEach((goalColor, colIndex) => {
          const colors = [];
          this.pieces.forEach((piece) => {
            const position = this.placed[piece.id];
            const pieceCell = position && piece.cells.find((cell) => (
              position.row + cell.row === rowIndex
              && position.col + cell.col === colIndex
            ));
            if (
              position
              && !this.isDragging(piece.id)
              && pieceCell
            ) {
              colors.push(getPieceCellColor(piece, pieceCell));
            }
          });
          cells.push({
            row: rowIndex,
            col: colIndex,
            occupied: colors.length > 0,
            colors: colors.slice(),
            color: colors.length ? this.mixColors(colors) : null,
            goalColor,
          });
        });
        return cells;
      }, []);
    },
    matchedCount() {
      return this.boardCells.filter((cell) => cell.color === cell.goalColor).length;
    },
    progressCells() {
      return this.boardCells.map((cell, index) => ({
        ...cell,
        hidden: this.isHiddenCell(index),
        status: !cell.occupied
          ? 'empty'
          : cell.color === cell.goalColor ? 'correct' : 'incorrect',
      }));
    },
    tripleOverlapGradient() {
      const colors = ['r', 'o', 'y', 'g', 'b', 'p', 'r'];
      const stops = colors.map((color, index) => (
        this.colorValue(color) + ' ' + (index * 100 / (colors.length - 1)) + '%'
      ));
      return 'linear-gradient(135deg, ' + stops.join(', ') + ')';
    },
    isSolved() {
      return this.matchedCount === this.boardCellCount;
    },
    difficultyLabel() {
      return this.difficulty.charAt(0).toUpperCase() + this.difficulty.slice(1);
    },
    dragStyle() {
      if (!this.drag) return {};
      return {
        left: this.drag.x - this.drag.grabX + 'px',
        top: this.drag.y - this.drag.grabY + 'px',
        '--board-cell': this.drag.cellSize + 'px',
      };
    },
    hoveredBoardCellStyle() {
      if (this.hoveredCellIndex === null) return {};
      const row = Math.floor(this.hoveredCellIndex / this.boardColumns);
      const col = this.hoveredCellIndex % this.boardColumns;
      return {
        left: (col / this.boardColumns) * 100 + '%',
        top: (row / this.boardRows) * 100 + '%',
        width: (1 / this.boardColumns) * 100 + '%',
        height: (1 / this.boardRows) * 100 + '%',
        borderTopLeftRadius: row === 0 && col === 0 ? '7px' : '4px',
        borderTopRightRadius: row === 0 && col === this.boardColumns - 1 ? '7px' : '4px',
        borderBottomRightRadius: row === this.boardRows - 1 && col === this.boardColumns - 1 ? '7px' : '4px',
        borderBottomLeftRadius: row === this.boardRows - 1 && col === 0 ? '7px' : '4px',
      };
    },
  },
  mounted() {
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
    window.addEventListener('pointercancel', this.onPointerCancel);
    this.loadDailyProgress();
    this.createPuzzleSet(this.dailySeed);
  },
  beforeDestroy() {
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
    window.removeEventListener('pointercancel', this.onPointerCancel);
    this.clearCollisionOutline();
  },
  methods: {
    activatePuzzle(difficulty) {
      const puzzle = this.puzzles[difficulty];
      this.difficulty = difficulty;
      this.puzzle = puzzle;
      this.hiddenCellIndices = difficulty === 'impossible'
        ? getHiddenCellIndices(
          puzzle.seed,
          difficulty,
          puzzle.dimensions.rows,
          puzzle.dimensions.columns,
        )
        : [];
      const pieces = getPieces(puzzle.startingPieces);
      this.pieces = pieces;
      this.trayPieces = shufflePieces(pieces);
      this.goal = puzzle.goal;
      const progress = this.mode === 'daily'
        ? this.dailyProgress[difficulty]
        : this.randomProgress[difficulty];
      const restored = this.restoreProgress(pieces, progress);
      this.placed = restored.placed;
      this.placementOrder = restored.placementOrder;
      this.placementSequence = restored.placementSequence;
      this.lastStackSelection = null;
      this.drag = null;
      this.pendingPress = null;
      this.clickDrop = null;
      this.selectedPieceId = null;
      this.moveHistory = [];
      this.clearCollisionOutline();
      this.hoveredCellIndex = null;
      this.victoryDialog = this.isSolved;
    },
    createPuzzleSet(seed) {
      if (this.isGenerating) return;
      this.isGenerating = true;
      this.generationError = '';
      this.generationStatus = 'Generating puzzles for all five difficulties…';
      window.setTimeout(() => {
        const generatedPuzzles = {};
        try {
          this.difficultyOptions.forEach((difficulty) => {
            const puzzle = generateExperimentalPuzzle(seed, difficulty);
            if (!puzzle) {
              throw new Error('The generator returned no ' + difficulty + ' puzzle.');
            }
            generatedPuzzles[difficulty] = puzzle;
          });
        } catch (error) {
          this.isGenerating = false;
          this.generationStatus = '';
          const fallbackMessage = this.hasGeneratedPuzzle
            ? 'The previous puzzle set remains loaded.'
            : 'Showing the reference puzzle instead.';
          this.generationError = 'Could not generate the puzzle set. '
            + fallbackMessage + ' ' + error.message;
          return;
        }

        this.puzzles = generatedPuzzles;
        this.hasGeneratedPuzzle = true;
        this.isGenerating = false;
        this.generationStatus = '';
        this.activatePuzzle('easy');
      }, 0);
    },
    selectDifficulty(difficulty) {
      if (this.isGenerating || this.difficulty === difficulty || !this.puzzles[difficulty]) return;
      this.activatePuzzle(difficulty);
    },
    loadDailyProgress() {
      let serialized;
      try {
        serialized = window.sessionStorage.getItem(DAILY_PROGRESS_STORAGE_KEY);
      } catch (error) {
        this.saveError = 'Could not read saved daily progress. ' + error.message;
        return;
      }
      if (!serialized) return;

      try {
        const saved = JSON.parse(serialized);
        if (!saved || saved.seed !== this.dailySeed) {
          this.clearStoredDailyProgress();
          return;
        }
        if (!saved.difficulties || typeof saved.difficulties !== 'object') {
          this.saveError = 'Saved daily progress is invalid and was ignored.';
          return;
        }
        this.dailyProgress = saved.difficulties;
      } catch (error) {
        this.saveError = 'Could not restore saved daily progress. ' + error.message;
      }
    },
    clearStoredDailyProgress() {
      try {
        window.sessionStorage.removeItem(DAILY_PROGRESS_STORAGE_KEY);
      } catch (error) {
        this.saveError = 'Could not clear previous daily progress. ' + error.message;
      }
    },
    restoreProgress(pieces, progress) {
      const restored = {
        placed: {},
        placementOrder: {},
        placementSequence: 0,
      };
      if (!progress || !progress.placed || typeof progress.placed !== 'object') {
        return restored;
      }

      pieces.forEach((piece) => {
        const position = progress.placed[piece.id];
        if (
          !position
          || !Number.isInteger(position.row)
          || !Number.isInteger(position.col)
          || position.row < 0
          || position.col < 0
          || position.row + piece.rows > this.boardRows
          || position.col + piece.cols > this.boardColumns
        ) {
          return;
        }
        restored.placed[piece.id] = { row: position.row, col: position.col };
        const savedOrder = progress.placementOrder
          && progress.placementOrder[piece.id];
        const order = Number.isInteger(savedOrder) && savedOrder > 0
          ? savedOrder
          : restored.placementSequence + 1;
        restored.placementOrder[piece.id] = order;
        restored.placementSequence = Math.max(restored.placementSequence, order);
      });
      return restored;
    },
    saveActiveProgress() {
      const progress = {
        placed: { ...this.placed },
        placementOrder: { ...this.placementOrder },
        placementSequence: this.placementSequence,
      };
      if (this.mode === 'random') {
        this.$set(this.randomProgress, this.difficulty, progress);
        return;
      }

      this.$set(this.dailyProgress, this.difficulty, progress);
      try {
        window.sessionStorage.setItem(
          DAILY_PROGRESS_STORAGE_KEY,
          JSON.stringify({
            seed: this.dailySeed,
            difficulties: this.dailyProgress,
          }),
        );
        this.saveError = '';
      } catch (error) {
        this.saveError = 'Could not save daily puzzle progress. ' + error.message;
      }
    },
    selectDaily() {
      if (this.isGenerating) return;
      this.mode = 'daily';
      const dailySeed = getDailySeed(new Date());
      if (this.dailySeed !== dailySeed) {
        this.dailySeed = dailySeed;
        this.dailyProgress = {};
        this.clearStoredDailyProgress();
      }
      this.randomProgress = {};
      this.victoryDialog = false;
      this.createPuzzleSet(this.dailySeed);
    },
    loadRandomPuzzle() {
      if (this.isGenerating) return;
      this.mode = 'random';
      this.randomPuzzleCount += 1;
      this.randomProgress = {};
      this.victoryDialog = false;
      const seed = 'random-' + Date.now() + '-' + Math.random().toString(36).slice(2)
        + '-' + this.randomPuzzleCount;
      this.createPuzzleSet(seed);
    },
    colorValue(color) {
      return COLORS[color].value;
    },
    isHiddenCell(index) {
      return this.hiddenCellIndices.includes(index);
    },
    pieceHasColor(piece, color) {
      return piece.cells.some((cell) => getPieceCellColor(piece, cell) === color);
    },
    cellAriaLabel(cell, piece) {
      const color = getPieceCellColor(piece, cell);
      return 'Move ' + COLORS[color].name + ' square of ' + piece.name;
    },
    goalCellStyle(color) {
      return color === 'x'
        ? { background: this.tripleOverlapGradient }
        : { backgroundColor: this.colorValue(color) };
    },
    boardCellStyle(cell) {
      const style = {
        borderRight: cell.col === this.boardColumns - 1 ? 0 : null,
        borderBottom: cell.row === this.boardRows - 1 ? 0 : null,
      };
      if (this.activeColorFilter) {
        style.backgroundColor = cell.colors.includes(this.activeColorFilter)
          ? this.colorValue(this.activeColorFilter)
          : cell.occupied ? '#d5d7d2' : null;
      } else if (cell.color === 'x') {
        style.background = this.tripleOverlapGradient;
      } else if (cell.color) {
        style.backgroundColor = this.colorValue(cell.color);
      }
      return style;
    },
    mixColors(colors) {
      const key = Array.from(new Set(colors)).sort().join('+');
      return MIXES[key];
    },
    isDragging(pieceId) {
      return Boolean(this.drag && this.drag.piece.id === pieceId);
    },
    setHoveredCell(index) {
      if (this.drag) return;
      this.hoveredCellIndex = index;
    },
    clearHoveredCell() {
      this.hoveredCellIndex = null;
    },
    hoverPieceCell(piece, cell) {
      const position = this.placed[piece.id];
      this.setHoveredCell(
        (position.row + cell.row) * this.boardColumns + position.col + cell.col,
      );
    },
    onBoardPointerDown(event) {
      if (this.isSolved || event.button !== 0 || this.drag || this.pendingPress || this.clickDrop) return;
      if (this.selectedPieceId) {
        const bounds = this.$refs.board.getBoundingClientRect();
        const col = Math.floor(((event.clientX - bounds.left) / bounds.width) * this.boardColumns);
        const row = Math.floor(((event.clientY - bounds.top) / bounds.height) * this.boardRows);
        this.clickDrop = { type: 'board', pieceId: this.selectedPieceId, row, col };
        event.preventDefault();
        return;
      }
      if (!event.target.closest('.pane-cell--placed')) this.selectedPieceId = null;
    },
    onTrayPointerDown(event) {
      if (
        event.button === 0
        && !this.isSolved
        && !this.drag
        && !this.pendingPress
        && !this.clickDrop
        && this.selectedPieceId
        && this.placed[this.selectedPieceId]
      ) {
        this.clickDrop = { type: 'bank', pieceId: this.selectedPieceId };
        event.preventDefault();
      }
    },
    getStackAt(row, col) {
      return this.placedPieces
        .filter((piece) => {
          const position = this.placed[piece.id];
          return piece.cells.some((cell) => (
            position.row + cell.row === row
            && position.col + cell.col === col
          ));
        })
        .sort((first, second) => {
          const firstMatchesFilter = this.activeColorFilter
            && this.pieceHasColor(first, this.activeColorFilter);
          const secondMatchesFilter = this.activeColorFilter
            && this.pieceHasColor(second, this.activeColorFilter);
          if (firstMatchesFilter !== secondMatchesFilter) {
            return secondMatchesFilter ? 1 : -1;
          }
          return this.placementOrder[second.id] - this.placementOrder[first.id];
        });
    },
    selectAtCell(row, col) {
      const stack = this.getStackAt(row, col);
      if (!stack.length) return;
      const isSameCell = this.lastStackSelection
        && this.lastStackSelection.row === row
        && this.lastStackSelection.col === col;
      const previousIndex = isSameCell
        ? stack.findIndex((piece) => piece.id === this.lastStackSelection.pieceId)
        : -1;
      const piece = stack[(previousIndex + 1) % stack.length];
      this.lastStackSelection = { row, col, pieceId: piece.id };
      this.selectedPieceId = piece.id;
    },
    toggleColorFilter(color) {
      this.activeColorFilter = this.activeColorFilter === color ? null : color;
    },
    placementCellStyle(cell, piece) {
      const position = this.placed[piece.id];
      const boardCell = this.boardCells[
        (position.row + cell.row) * this.boardColumns + position.col + cell.col
      ];
      return !this.activeColorFilter && boardCell.color === 'x'
        ? { background: this.tripleOverlapGradient }
        : {};
    },
    startPlacedPress(event, piece, cellRow, cellCol) {
      if (this.isSolved || event.button !== 0 || this.drag || this.pendingPress || this.clickDrop) return;
      event.preventDefault();
      const position = this.placed[piece.id];
      const row = position.row + cellRow;
      const col = position.col + cellCol;
      if (this.selectedPieceId) {
        if (this.getStackAt(row, col).some((entry) => entry.id === this.selectedPieceId)) {
          this.pendingPress = {
            type: 'board',
            piece: this.pieces.find((entry) => entry.id === this.selectedPieceId) || piece,
            row,
            col,
            x: event.clientX,
            y: event.clientY,
          };
          return;
        }
        this.clickDrop = { type: 'board', pieceId: this.selectedPieceId, row, col };
        return;
      }
      const stack = this.getStackAt(row, col);
      const selected = stack.find((entry) => entry.id === this.selectedPieceId);
      this.pendingPress = {
        type: 'board',
        piece: selected || stack[0] || piece,
        row,
        col,
        x: event.clientX,
        y: event.clientY,
      };
    },
    startBankPress(event, piece) {
      if (this.isSolved || event.button !== 0 || this.drag || this.pendingPress || this.clickDrop) return;
      event.preventDefault();
      if (this.selectedPieceId && this.placed[this.selectedPieceId]) {
        this.clickDrop = { type: 'bank', pieceId: this.selectedPieceId };
        return;
      }
      this.clearHoveredCell();
      this.pendingPress = {
        type: 'bank',
        piece,
        x: event.clientX,
        y: event.clientY,
      };
    },
    beginBankDrag(piece, startX, startY) {
      const bounds = this.$refs.board.getBoundingClientRect();
      const cellSize = bounds.width / this.boardColumns;
      const center = piece.cells.reduce((point, cell) => ({
        row: point.row + (cell.row + 0.5) / piece.cells.length,
        col: point.col + (cell.col + 0.5) / piece.cells.length,
      }), { row: 0, col: 0 });
      const grabCell = piece.cells.reduce((closest, cell) => {
        const rowDistance = cell.row + 0.5 - center.row;
        const colDistance = cell.col + 0.5 - center.col;
        const distance = rowDistance * rowDistance + colDistance * colDistance;
        const tied = Math.abs(distance - closest.distance) < 1e-9;
        const isLowerRight = cell.row > closest.cell.row
          || (cell.row === closest.cell.row && cell.col > closest.cell.col);
        return distance < closest.distance - 1e-9 || (tied && isLowerRight)
          ? { cell, distance }
          : closest;
      }, { cell: piece.cells[0], distance: Infinity }).cell;
      this.drag = {
        piece,
        fromBoard: false,
        grabX: (grabCell.col + 0.5) * cellSize,
        grabY: (grabCell.row + 0.5) * cellSize,
        grabRow: grabCell.row,
        grabCol: grabCell.col,
        cellSize,
        x: startX,
        y: startY,
      };
    },
    onPointerMove(event) {
      if (this.isSolved) return;
      if (this.pendingPress) {
        const deltaX = event.clientX - this.pendingPress.x;
        const deltaY = event.clientY - this.pendingPress.y;
        if (Math.hypot(deltaX, deltaY) < 6) return;

        const press = this.pendingPress;
        const piece = press.piece;
        if (press.type === 'bank') {
          this.pendingPress = null;
          this.selectedPieceId = null;
          this.beginBankDrag(piece, press.x, press.y);
          this.drag.x = event.clientX;
          this.drag.y = event.clientY;
          return;
        }
        this.pendingPress = null;
        this.selectedPieceId = piece.id;
        this.clearHoveredCell();
        this.beginPlacedDrag(press, piece);
        this.drag.x = event.clientX;
        this.drag.y = event.clientY;
      }

      if (!this.drag) return;
      this.drag.x = event.clientX;
      this.drag.y = event.clientY;
    },
    onPointerUp(event) {
      if (this.pendingPress) {
        const press = this.pendingPress;
        this.pendingPress = null;
        if (press.type === 'bank') {
          this.selectedPieceId = null;
          this.beginBankDrag(press.piece, press.x, press.y);
        } else {
          this.selectAtCell(press.row, press.col);
          const piece = this.pieces.find((entry) => entry.id === this.selectedPieceId);
          if (piece) {
            this.selectedPieceId = null;
            this.beginPlacedDrag(press, piece);
          }
        }
        if (this.drag) {
          this.drag.x = event.clientX;
          this.drag.y = event.clientY;
        }
        return;
      }
      if (this.clickDrop) {
        const drop = this.clickDrop;
        this.clickDrop = null;
        const piece = this.pieces.find((entry) => entry.id === drop.pieceId);
        if (piece && drop.type === 'board') {
          this.commitPlacement(piece, { row: drop.row, col: drop.col });
        } else if (piece && drop.type === 'bank') {
          this.returnPieceToBank(piece);
        }
        return;
      }
      if (!this.drag) return;
      const drag = this.drag;
      this.drag = null;
      const board = this.$refs.board;
      const bounds = board.getBoundingClientRect();
      const insideBoard = (
        event.clientX >= bounds.left
        && event.clientX <= bounds.right
        && event.clientY >= bounds.top
        && event.clientY <= bounds.bottom
      );
      if (insideBoard) {
        const col = Math.floor(((event.clientX - bounds.left) / bounds.width) * this.boardColumns);
        const row = Math.floor(((event.clientY - bounds.top) / bounds.height) * this.boardRows);
        this.commitPlacement(drag.piece, {
          row: row - drag.grabRow,
          col: col - drag.grabCol,
        });
      } else if (drag.fromBoard) {
        this.returnPieceToBank(drag.piece);
      }
    },
    onPointerCancel() {
      this.pendingPress = null;
      this.clickDrop = null;
      this.selectedPieceId = null;
      this.clearHoveredCell();
      this.drag = null;
    },
    beginPlacedDrag(press, piece) {
      const position = this.placed[piece.id];
      const bounds = this.$refs.board.getBoundingClientRect();
      const cellSize = bounds.width / this.boardColumns;
      const grabCol = press.col - position.col;
      const grabRow = press.row - position.row;
      const fractionX = (press.x - bounds.left) / cellSize - press.col;
      const fractionY = (press.y - bounds.top) / cellSize - press.row;
      this.drag = {
        piece,
        fromBoard: true,
        grabX: (grabCol + fractionX) * cellSize,
        grabY: (grabRow + fractionY) * cellSize,
        grabRow,
        grabCol,
        cellSize,
        x: press.x,
        y: press.y,
      };
    },
    commitPlacement(piece, position) {
      if (this.isSolved) return false;
      const maxRow = this.boardRows - piece.rows;
      const maxCol = this.boardColumns - piece.cols;
      const nextPosition = {
        row: Math.max(0, Math.min(maxRow, position.row)),
        col: Math.max(0, Math.min(maxCol, position.col)),
      };
      const collision = this.placedPieces.find((other) => (
        other.id !== piece.id
        && this.piecesOverlap(piece, nextPosition, other, this.placed[other.id])
      ));
      if (collision) {
        this.showCollisionOutline(collision.id);
        this.selectedPieceId = null;
        return false;
      }

      this.clearCollisionOutline();
      const previousPosition = this.placed[piece.id]
        ? { ...this.placed[piece.id] }
        : null;
      if (
        !previousPosition
        || previousPosition.row !== nextPosition.row
        || previousPosition.col !== nextPosition.col
      ) {
        const previousOrder = this.placementOrder[piece.id];
        this.placementSequence += 1;
        const nextOrder = this.placementSequence;
        this.moveHistory.push({
          pieceId: piece.id,
          from: previousPosition,
          to: { ...nextPosition },
          fromOrder: previousOrder === undefined ? null : previousOrder,
          toOrder: nextOrder,
        });
        this.$set(this.placed, piece.id, nextPosition);
        this.$set(this.placementOrder, piece.id, nextOrder);
        this.lastStackSelection = null;
        this.saveActiveProgress();
        if (this.isSolved) {
          this.victoryDialog = true;
          this.clearHoveredCell();
        }
      }
      this.selectedPieceId = null;
      return true;
    },
    piecesOverlap(firstPiece, firstPosition, secondPiece, secondPosition) {
      return firstPiece.cells.some((firstCell) => {
        const row = firstPosition.row + firstCell.row;
        const col = firstPosition.col + firstCell.col;
        return secondPiece.cells.some((secondCell) => (
          row === secondPosition.row + secondCell.row
          && col === secondPosition.col + secondCell.col
          && getPieceCellColor(firstPiece, firstCell)
            === getPieceCellColor(secondPiece, secondCell)
        ));
      });
    },
    returnPieceToBank(piece) {
      if (this.isSolved) return;
      const previousPosition = this.placed[piece.id];
      if (!previousPosition) {
        this.selectedPieceId = null;
        return;
      }
      this.clearCollisionOutline();
      this.moveHistory.push({
        pieceId: piece.id,
        from: { ...previousPosition },
        to: null,
        fromOrder: this.placementOrder[piece.id],
        toOrder: null,
      });
      this.$delete(this.placed, piece.id);
      this.$delete(this.placementOrder, piece.id);
      this.lastStackSelection = null;
      this.selectedPieceId = null;
      this.saveActiveProgress();
      this.victoryDialog = this.isSolved;
    },
    undoMove() {
      if (this.isSolved) return;
      const move = this.moveHistory.pop();
      if (!move) return;
      this.clearCollisionOutline();
      if (move.from) {
        this.$set(this.placed, move.pieceId, { ...move.from });
        this.$set(this.placementOrder, move.pieceId, move.fromOrder);
      } else {
        this.$delete(this.placed, move.pieceId);
        this.$delete(this.placementOrder, move.pieceId);
      }
      this.lastStackSelection = null;
      this.selectedPieceId = null;
      this.saveActiveProgress();
      this.victoryDialog = this.isSolved;
    },
    showCollisionOutline(pieceId) {
      this.clearCollisionOutline();
      this.collisionPieceId = pieceId;
      this.collisionTimeout = window.setTimeout(() => {
        this.collisionPieceId = null;
        this.collisionTimeout = null;
      }, 900);
    },
    clearCollisionOutline() {
      if (this.collisionTimeout !== null) {
        window.clearTimeout(this.collisionTimeout);
        this.collisionTimeout = null;
      }
      this.collisionPieceId = null;
    },
    resetBoard() {
      if (this.isSolved) return;
      this.placed = {};
      this.placementOrder = {};
      this.placementSequence = 0;
      this.lastStackSelection = null;
      this.selectedPieceId = null;
      this.pendingPress = null;
      this.clickDrop = null;
      this.moveHistory = [];
      this.clearCollisionOutline();
      this.victoryDialog = false;
      this.saveActiveProgress();
    },
    placedStyle(piece) {
      const position = this.placed[piece.id];
      return {
        left: (position.col / this.boardColumns) * 100 + '%',
        top: (position.row / this.boardRows) * 100 + '%',
        width: (piece.cols / this.boardColumns) * 100 + '%',
        height: (piece.rows / this.boardRows) * 100 + '%',
        gridTemplateColumns: 'repeat(' + piece.cols + ', 1fr)',
        gridTemplateRows: 'repeat(' + piece.rows + ', 1fr)',
      };
    },
    trayShapeStyle(piece) {
      return {
        gridTemplateColumns: 'repeat(' + piece.cols + ', var(--tray-cell))',
        gridTemplateRows: 'repeat(' + piece.rows + ', var(--tray-cell))',
      };
    },
    previewShapeStyle(piece) {
      return {
        gridTemplateColumns: 'repeat(' + piece.cols + ', var(--board-cell))',
        gridTemplateRows: 'repeat(' + piece.rows + ', var(--board-cell))',
      };
    },
    cellStyle(cell, piece) {
      const style = {
        gridRow: cell.row + 1,
        gridColumn: cell.col + 1,
        '--pane-color': this.colorValue(getPieceCellColor(piece, cell)),
      };
      Object.assign(style, this.placementCellStyle(cell, piece));
      return style;
    },
    pieceOutlinePath(piece) {
      const occupied = (row, col) => piece.cells.some((cell) => (
        cell.row === row && cell.col === col
      ));
      const edges = [];
      piece.cells.forEach((cell) => {
        if (!occupied(cell.row - 1, cell.col)) {
          edges.push({ x: cell.col, y: cell.row, direction: 0 });
        }
        if (!occupied(cell.row, cell.col + 1)) {
          edges.push({ x: cell.col + 1, y: cell.row, direction: 1 });
        }
        if (!occupied(cell.row + 1, cell.col)) {
          edges.push({ x: cell.col + 1, y: cell.row + 1, direction: 2 });
        }
        if (!occupied(cell.row, cell.col - 1)) {
          edges.push({ x: cell.col, y: cell.row + 1, direction: 3 });
        }
      });

      const outgoingEdges = {};
      edges.forEach((edge, index) => {
        edge.id = index;
        edge.endX = edge.x + [1, 0, -1, 0][edge.direction];
        edge.endY = edge.y + [0, 1, 0, -1][edge.direction];
        const key = edge.x + ',' + edge.y;
        if (!outgoingEdges[key]) outgoingEdges[key] = [];
        outgoingEdges[key].push(edge);
      });

      const used = new Set();
      const paths = [];
      edges.forEach((start) => {
        if (used.has(start.id)) return;
        const points = [];
        let edge = start;

        while (edge && !used.has(edge.id)) {
          used.add(edge.id);
          points.push([edge.x, edge.y]);
          if (edge.endX === start.x && edge.endY === start.y) break;

          const candidates = (outgoingEdges[edge.endX + ',' + edge.endY] || [])
            .filter((candidate) => !used.has(candidate.id));
          candidates.sort((a, b) => {
            const turnA = (a.direction - edge.direction + 4) % 4;
            const turnB = (b.direction - edge.direction + 4) % 4;
            const priority = { 1: 0, 0: 1, 3: 2, 2: 3 };
            return priority[turnA] - priority[turnB];
          });
          edge = candidates[0];
        }

        if (points.length > 2) {
          paths.push(
            'M ' + points.map((point) => point.join(' ')).join(' L ') + ' Z',
          );
        }
      });

      return paths.join(' ');
    },
    trayCellStyle(piece, cell) {
      return {
        gridRow: cell.row + 1,
        gridColumn: cell.col + 1,
        '--pane-color': this.colorValue(getPieceCellColor(piece, cell)),
      };
    },
    previewCellStyle(cell, piece) {
      return {
        gridRow: cell.row + 1,
        gridColumn: cell.col + 1,
        '--pane-color': this.colorValue(getPieceCellColor(piece, cell)),
      };
    },
  },
};
</script>

<style>
:root {
  --ink: #292e2a;
  --muted: #8d9189;
  --paper: #f8f8f4;
  --line: #e8e9e2;
  --green: #607d66;
  --board-cell: min(13.8vw, 58px);
  --tray-cell: 20px;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  background: var(--paper);
  color: var(--ink);
  font-family: 'Avenir Next', Avenir, 'Segoe UI', sans-serif;
  -webkit-font-smoothing: antialiased;
}

button {
  font: inherit;
}

.v-application {
  background: var(--paper) !important;
  font-family: 'Avenir Next', Avenir, 'Segoe UI', sans-serif !important;
}

.game-shell {
  width: min(100% - 48px, 1180px);
  margin: 0 auto;
  padding: 16px 0;
}

.puzzle-toolbar {
  display: flex;
  min-height: 32px;
  align-items: center;
  gap: 10px;
}

.puzzle-mode-switch {
  display: inline-flex;
  gap: 2px;
  padding: 3px;
  border: 1px solid var(--line);
  border-radius: 7px;
  background: rgba(255, 255, 255, .55);
}

.difficulty-switch {
  display: inline-flex;
  gap: 2px;
  padding: 3px;
  border: 1px solid var(--line);
  border-radius: 7px;
  background: rgba(255, 255, 255, .55);
}

.puzzle-mode-switch button,
.difficulty-switch button {
  padding: 5px 10px;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: #777d74;
  cursor: pointer;
  font-size: 10px;
}

.puzzle-mode-switch .puzzle-mode-button--active,
.difficulty-switch .difficulty-button--active {
  background: white;
  color: var(--ink);
  box-shadow: 0 1px 3px rgba(57, 61, 52, .12);
}

.difficulty-switch button {
  text-transform: capitalize;
}

.puzzle-mode-switch button:disabled,
.difficulty-switch button:disabled,
.new-puzzle-button:disabled {
  cursor: wait;
  opacity: .55;
}

.puzzle-mode-label {
  flex: 1;
  color: #858980;
  font-size: 10px;
}

.new-puzzle-button {
  padding: 6px 9px;
  border: 1px solid var(--line);
  border-radius: 5px;
  background: white;
  color: #4a504a;
  cursor: pointer;
  font-size: 10px;
}

.puzzle-mode-switch button:focus-visible,
.difficulty-switch button:focus-visible,
.new-puzzle-button:focus-visible {
  outline: 2px solid var(--green);
  outline-offset: 2px;
}

.generation-error,
.save-error {
  margin: -4px 0 10px;
  color: #a64e47;
  font-size: 11px;
}

.victory-dialog {
  position: relative;
  padding-top: 10px;
  padding-bottom: 10px;
  border-radius: 12px !important;
}

.victory-dialog-title {
  display: flex;
  padding-top: 0px !important;
  color: var(--ink);
  font-size: 20px;
  font-weight: 600;
}

.victory-dialog-message {
  padding-bottom: 24px;
  color: #73796f;
  font-size: 14px;
  text-align: center;
}

.section-kicker {
  color: var(--muted);
  font-size: 9px;
  font-weight: 700;
  letter-spacing: .15em;
}

.game-layout {
  display: grid;
  grid-template-columns: minmax(0, 620px) minmax(260px, 1fr);
  align-items: start;
  gap: clamp(20px, 3vw, 36px);
}

.game-layout--generating {
  opacity: .62;
  pointer-events: none;
}

.game-layout--generating * {
  pointer-events: none !important;
}

.side-panel {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 16px;
}

.section-label {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  margin-bottom: 8px;
}

.section-kicker,
.section-caption {
  display: block;
}

.section-kicker {
  margin-bottom: 4px;
  font-size: 8px;
}

.section-caption {
  color: #4a504a;
  font-size: 12px;
  font-weight: 600;
}

.goal-frame {
  display: flex;
  min-height: 104px;
  align-items: center;
  justify-content: center;
  gap: clamp(14px, 2vw, 24px);
  border: 1px solid var(--line);
  border-radius: 9px;
  background: rgba(255, 255, 255, .53);
}

.goal-display {
  display: flex;
  min-width: 0;
  flex: 1 1 0;
  flex-direction: column;
  align-items: center;
  gap: 5px;
}

.goal-grid {
  display: grid;
  width: min(100%, 160px);
  aspect-ratio: 1;
  margin-top: 10px;
  padding: 3px;
  gap: 2px;
  border: 1px solid rgba(49, 56, 49, .08);
  border-radius: 6px;
  background: white;
  box-shadow: 0 3px 12px rgba(49, 56, 49, .06);
}

.goal-progress-grid {
  display: grid;
  width: min(100%, 160px);
  aspect-ratio: 1;
  margin-top: 10px;
  padding: 3px;
  gap: 2px;
  border: 1px solid rgba(49, 56, 49, .08);
  border-radius: 6px;
  background: white;
  box-shadow: 0 3px 12px rgba(49, 56, 49, .06);
}

.goal-cell {
  display: block;
  border-radius: 2px;
  box-shadow: inset 0 1px 2px rgba(255, 255, 255, .38), inset 0 -1px 1px rgba(53, 56, 48, .08);
}

.goal-progress-cell {
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 2px;
  background: rgba(49, 56, 49, .035);
  font-size: 10px;
  font-weight: 700;
  line-height: 1;
}

.goal-progress-cell--correct {
  background: rgba(96, 125, 102, .12);
  color: #52745a;
}

.goal-progress-cell--incorrect {
  background: rgba(184, 91, 82, .12);
  color: #a64e47;
}

.goal-cell--hidden,
.goal-progress-cell--hidden {
  display: flex;
  align-items: center;
  justify-content: center;
  background: #2e2e2e !important;
  color: #fff;
  font-size: 10px;
  font-weight: 700;
  line-height: 1;
  box-shadow: none;
}

.grid-cell--hovered {
  outline: 2px solid #292e2a;
  outline-offset: -2px;
}

.goal-display-label {
  color: #858980;
  font-size: 9px;
}

.board-section {
  min-width: 0;
}

.color-filters {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
  margin: -4px 0 9px;
}

.color-filter-button {
  min-width: 62px;
  padding: 5px 10px;
  border: 1px solid rgba(41, 46, 42, .1);
  border-radius: 6px;
  background: var(--filter-color);
  color: #292e2a;
  cursor: pointer;
  font-size: 10px;
  font-weight: 600;
  opacity: .7;
  transition: box-shadow .15s ease, opacity .15s ease, transform .15s ease;
}

.color-filter-button:hover {
  opacity: .9;
}

.color-filter-button--active {
  box-shadow: 0 0 0 2px white, 0 0 0 4px var(--filter-color);
  opacity: 1;
}

.color-filter-button:focus-visible {
  outline: 2px solid var(--ink);
  outline-offset: 3px;
}

.board-actions {
  display: flex;
  align-items: center;
  float: right;
}

.reset-button {
  color: #8a8e86;
}

.board {
  position: relative;
  width: 100%;
  aspect-ratio: 1;
  overflow: visible;
  border: 1px solid #dedfd8;
  border-radius: 8px;
  background:
    radial-gradient(ellipse at 18% 0%, rgba(255, 255, 255, .9), transparent 56%),
    #f1f2ed;
  box-shadow: 0 8px 26px rgba(57, 61, 52, .07), inset 0 1px 3px rgba(255, 255, 255, .9);
  touch-action: none;
}

.board--dragging {
  cursor: grabbing;
}

.board--solved,
.pieces-tray--disabled {
  pointer-events: none;
}

.board--solved .pane-cell--placed {
  pointer-events: none;
}

.board-grid {
  position: absolute;
  inset: 0;
  display: grid;
  overflow: hidden;
  border-radius: 7px;
}

.board-cell-highlight {
  position: absolute;
  z-index: 4;
  border: 2px solid #292e2a;
  pointer-events: none;
}

.board-cell {
  min-width: 0;
  border-right: 1px solid rgba(92, 100, 87, .1);
  border-bottom: 1px solid rgba(92, 100, 87, .1);
  background: rgba(255, 255, 255, .23);
  transition: background-color .15s ease;
}

.board-cell--filled {
  border-radius: 4px;
  box-shadow: inset 0 1px 5px rgba(255, 255, 255, .45), inset 0 -2px 6px rgba(52, 55, 49, .09);
}

.piece-shape {
  display: grid;
}

.placed-piece {
  position: absolute;
  z-index: 1;
  pointer-events: none;
}

.placed-piece--selected {
  z-index: 2;
}

.placed-piece--dimmed {
  opacity: .24;
}

.piece-shape--hidden {
  visibility: hidden;
}

.pane-cell {
  min-width: 0;
  min-height: 0;
  padding: 0;
  border: 0;
  cursor: grab;
  -webkit-tap-highlight-color: transparent;
  touch-action: none;
}

.pane-cell--placed {
  position: relative;
  z-index: 1;
  pointer-events: auto;
  border: 1px solid rgba(255, 255, 255, .65);
  border-radius: 4px;
  background:
    linear-gradient(145deg, rgba(255, 255, 255, .36), transparent 45%, rgba(255, 255, 255, .12)),
    linear-gradient(90deg, rgba(255, 255, 255, .12), transparent 35%, rgba(255, 255, 255, .08));
  box-shadow: inset 0 0 0 1px rgba(49, 56, 49, .13), inset 2px 2px 4px rgba(255, 255, 255, .24);
  cursor: grab;
}

.pane-cell--selected {
  border-color: transparent;
  border-radius: 0;
  box-shadow: none;
}

.selection-outline {
  position: absolute;
  z-index: 3;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: visible;
  pointer-events: none;
}

.selection-outline-halo {
  stroke: rgba(255, 255, 255, .86);
  stroke-width: 3px;
}

.selection-outline-ink {
  stroke: #283129;
  stroke-width: 1.5px;
}

.selection-outline-halo--collision {
  stroke: rgba(255, 255, 255, .92);
  stroke-width: 4px;
}

.selection-outline-ink--collision {
  stroke: #d33b32;
  stroke-width: 2.5px;
}

.placed-piece--collision {
  z-index: 3;
}

.pane-cell--placed:active,
.pane-cell--tray:active {
  cursor: grabbing;
}

.board-empty-message {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: #9a9e95;
  font-size: 11px;
  pointer-events: none;
}

.empty-sparkle {
  color: #b7a577;
  font-size: 15px;
}

.drag-preview {
  position: fixed;
  z-index: 20;
  pointer-events: none;
  --board-cell: min(13.8vw, 58px);
}

.preview-shape {
  filter: drop-shadow(0 8px 9px rgba(39, 43, 37, .2));
}

.pane-cell--preview {
  border: 1px solid rgba(255, 255, 255, .8);
  border-radius: 4px;
  background:
    linear-gradient(145deg, rgba(255, 255, 255, .52), transparent 58%),
    var(--pane-color);
  box-shadow: inset 0 0 0 1px rgba(65, 69, 60, .12), inset 0 2px 5px rgba(255, 255, 255, .44);
  opacity: .58;
}

.board-footer {
  display: flex;
  margin-top: 5px;
  align-items: center;
  justify-content: flex-end;
  color: #888d84;
  font-size: 10px;
}

.board-hint {
  color: #a0a49b;
}

.solved-note {
  color: var(--green);
  font-weight: 600;
}

.solved-note span {
  margin-left: 3px;
  color: #b7a577;
}

.pieces-section {
  min-width: 0;
}

.pieces-label {
  margin-bottom: 11px;
}

.pieces-count {
  color: #9a9e96;
  font-size: 10px;
}

.pieces-tray {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  grid-auto-rows: max-content;
  align-content: start;
  min-height: 0;
  overflow-y: auto;
  padding: 4px;
  gap: 9px;
  touch-action: pan-y;
}

@media (min-width: 1120px) {
  .pieces-tray {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}

.pieces-tray--return-target {
  outline: 1px dashed #9aa68f;
  outline-offset: 4px;
  border-radius: 8px;
}

.piece-card {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 88px;
  overflow: hidden;
  cursor: grab;
  touch-action: none;
  border: 1px solid var(--line);
  border-radius: 7px;
  background: rgba(255, 255, 255, .57);
  transition: border-color .15s ease, box-shadow .15s ease, opacity .15s ease;
}

.piece-card:hover {
  border-color: #d3d8cd;
  box-shadow: 0 3px 12px rgba(52, 59, 49, .06);
}

.piece-card--selected {
  border-color: var(--green);
  box-shadow: 0 0 0 2px rgba(96, 125, 102, .16);
}

.piece-card:active {
  cursor: grabbing;
}

.piece-card--dragging {
  opacity: .28;
}

.piece-card-body {
  display: flex;
  flex: 1;
  min-height: 60px;
  align-items: center;
  justify-content: center;
  padding: 5px;
}

.pane-cell--tray {
  position: relative;
  border: 1px solid rgba(255, 255, 255, .78);
  border-radius: 4px;
  background:
    linear-gradient(143deg, rgba(255, 255, 255, .57), transparent 54%, rgba(255, 255, 255, .1)),
    var(--pane-color);
  box-shadow: inset 0 0 0 1px rgba(68, 71, 62, .12), inset 1px 1px 3px rgba(255, 255, 255, .45), 0 1px 2px rgba(45, 50, 42, .09);
}

.tray-complete {
  grid-column: 1 / -1;
  padding: 24px 12px;
  border: 1px dashed #dfe1d9;
  border-radius: 7px;
  color: #888d84;
  font-size: 11px;
  text-align: center;
}

.tray-tip {
  margin: 6px 0 0;
  color: #969a92;
  font-size: 9px;
}

.tray-tip span {
  margin-right: 4px;
  color: #b7a577;
}

@media (min-width: 960px) {
  .game-shell {
    display: flex;
    height: calc(100vh - 32px);
    flex-direction: column;
  }

  .game-layout {
    min-height: 0;
    flex: 1 1 auto;
    align-items: stretch;
  }

  .side-panel {
    height: 100%;
    min-height: 0;
  }

  .goal-section {
    display: flex;
    min-height: 0;
    flex: 0 0 auto;
    flex-direction: column;
  }

  .goal-frame {
    min-height: 104px;
    flex: 0 0 auto;
  }

  .pieces-section {
    display: flex;
    min-height: 0;
    flex: 1 1 0;
    flex-direction: column;
  }

  .pieces-tray {
    flex: 1 1 auto;
  }

  .board-label,
  .board,
  .board-footer {
    width: min(100%, calc(100vh - 124px));
  }
}

@media (max-width: 959px) {
  .game-layout {
    grid-template-columns: minmax(0, 1fr);
  }

  .side-panel {
    gap: 16px;
  }

  .puzzle-toolbar {
    flex-wrap: wrap;
  }

  .pieces-tray {
    max-height: 50vh;
  }
}

@media (min-width: 960px) and (max-height: 850px) {
  .goal-frame {
    min-height: 84px;
  }
}

@media (max-width: 520px) {
  .game-shell {
    width: calc(100% - 32px);
    padding-top: 18px;
  }

  .puzzle-mode-label {
    font-size: 9px;
  }

  .goal-frame {
    min-height: 104px;
  }

}
</style>

const assert = require('assert');
const { performance } = require('perf_hooks');
const {
  COLORS,
  EXPERIMENTAL_DIFFICULTIES,
  generateExperimentalPuzzle,
  getPieceCellColor,
  getDailySeed,
} = require('../src/puzzleGenerator');

assert.strictEqual(
  getDailySeed(new Date('2026-01-01T04:30:00Z')),
  '2025-12-31',
  'daily seeds should follow the New York calendar date',
);

const difficulties = ['easy', 'medium', 'hard', 'extreme', 'impossible'];
const seeds = Array.from({ length: 20 }, (value, index) => 'experiment-seed-' + (index + 1));
const results = {};

const hardSettings = { ...EXPERIMENTAL_DIFFICULTIES.hard };
delete hardSettings.mixedPieceFraction;
assert.deepStrictEqual(
  EXPERIMENTAL_DIFFICULTIES.medium,
  hardSettings,
  'medium should retain hard’s board, count, size, and adjacency settings',
);
assert.deepStrictEqual(
  EXPERIMENTAL_DIFFICULTIES.impossible,
  EXPERIMENTAL_DIFFICULTIES.extreme,
  'impossible should duplicate the extreme generation settings',
);

for (const difficulty of difficulties) {
  const config = EXPERIMENTAL_DIFFICULTIES[difficulty];
  const samples = [];
  const started = performance.now();
  const rejectionStatistics = {
    pieceSetRejected: 0,
    placementRejected: 0,
    isolatedRejected: 0,
    coverageRejected: 0,
    adjacencyRejected: 0,
    repairFailures: {
      isolated: 0,
      uncovered: 0,
      adjacency: 0,
      trimmed: 0,
      banked: 0,
      expanded: 0,
    },
  };

  for (const seed of seeds) {
    const puzzle = generateExperimentalPuzzle(seed, difficulty, rejectionStatistics);
    if (!puzzle) continue;

    assert.strictEqual(puzzle.dimensions.rows, config.boardSize);
    assert.strictEqual(puzzle.dimensions.columns, config.boardSize);
    assert(puzzle.initialPieceCount >= config.pieceCount.minimum);
    assert(puzzle.initialPieceCount <= config.pieceCount.maximum);
    assert(puzzle.initialAverageSize >= config.averagePieceSize.minimum);
    assert(puzzle.initialAverageSize <= config.averagePieceSize.maximum);
    assert.strictEqual(puzzle.startingPieces.length, puzzle.initialPieceCount);
    assert.strictEqual(puzzle.sameColorDuplicateCount, 0);
    const mixedPieces = puzzle.startingPieces.filter((piece) => piece.mixed);
    assert.strictEqual(
      mixedPieces.length,
      ['hard', 'extreme', 'impossible'].includes(difficulty)
        ? Math.round(puzzle.initialPieceCount / 3)
        : 0,
      difficulty + ' should have the configured number of mixed pieces',
    );
    mixedPieces.forEach((piece) => {
      assert(piece.cells.length >= 2, 'mixed pieces should contain at least two cells');
      assert.strictEqual(
        piece.cells.filter((cell) => getPieceCellColor(piece, cell) !== piece.color).length,
        1,
        'mixed pieces should have exactly one square of a different color',
      );
      assert(
        piece.cells.every((cell) => COLORS[getPieceCellColor(piece, cell)]),
        'mixed piece cells should use renderable colors',
      );
    });
    assert(
      puzzle.goal.every((row) => row.every((color) => (
        Object.prototype.hasOwnProperty.call(COLORS, color)
      ))),
      difficulty + ' goal should have a renderable color in every cell',
    );

    puzzle.startingPieces.forEach((piece) => {
      assert(piece.cells.length >= 1 && piece.cells.length <= 6);
      const reached = new Set([piece.cells[0].row + ',' + piece.cells[0].col]);
      let changed = true;
      while (changed) {
        changed = false;
        piece.cells.forEach((cell) => {
          const key = cell.row + ',' + cell.col;
          if (reached.has(key)) return;
          const adjacent = [
            (cell.row - 1) + ',' + cell.col,
            (cell.row + 1) + ',' + cell.col,
            cell.row + ',' + (cell.col - 1),
            cell.row + ',' + (cell.col + 1),
          ];
          if (adjacent.some((neighbor) => reached.has(neighbor))) {
            reached.add(key);
            changed = true;
          }
        });
      }
      if (reached.size !== piece.cells.length) {
        assert.fail(
          'piece should remain connected: ' + difficulty + ' ' + seed
          + ' ' + JSON.stringify(piece),
        );
      }
      assert.strictEqual(reached.size, piece.cells.length);
    });

    samples.push({
      elapsedMilliseconds: 0,
      difficultyScore: puzzle.difficultyScore,
      adjacencyScore: puzzle.adjacencyScore,
      averagePieceSize: puzzle.averagePieceSize,
      pieceCount: puzzle.startingPieces.length,
      repairStats: puzzle.repairStats,
    });
  }

  const elapsed = performance.now() - started;
  const successCount = samples.length;
  assert.strictEqual(
    successCount,
    seeds.length,
    difficulty + ' should repair every attempted seed',
  );
  const averageElapsed = successCount ? elapsed / successCount : null;
  const averageScore = successCount
    ? samples.reduce((total, sample) => total + sample.difficultyScore, 0) / successCount
    : null;
  const averageAdjacency = successCount
    ? samples.reduce((total, sample) => total + sample.adjacencyScore, 0) / successCount
    : null;

  results[difficulty] = {
    successCount,
    attemptedCount: seeds.length,
    successRate: successCount / seeds.length,
    totalElapsedMilliseconds: elapsed,
    averageElapsedMilliseconds: averageElapsed,
    averageDifficultyScore: averageScore,
    averageAdjacencyScore: averageAdjacency,
    repairTotals: samples.reduce((totals, sample) => ({
      trimmedPieces: totals.trimmedPieces + (sample.repairStats?.trimmedPieces || 0),
      bankedCells: totals.bankedCells + (sample.repairStats?.bankedCells || 0),
      expandedPieces: totals.expandedPieces + (sample.repairStats?.expandedPieces || 0),
    }), {
      trimmedPieces: 0,
      bankedCells: 0,
      expandedPieces: 0,
    }),
  };

  console.log(
    difficulty + ':'
    + ' success=' + successCount + '/' + seeds.length
    + ' total=' + elapsed.toFixed(1) + 'ms'
    + ' avg=' + (averageElapsed === null ? 'n/a' : averageElapsed.toFixed(2) + 'ms')
    + ' score=' + (averageScore === null ? 'n/a' : averageScore.toFixed(1))
    + ' adjacency=' + (averageAdjacency === null ? 'n/a' : averageAdjacency.toFixed(1))
    + ' rejected=' + JSON.stringify(rejectionStatistics),
  );
}

console.log(JSON.stringify(results, null, 2));
console.log('Experimental piece-first checks passed.');

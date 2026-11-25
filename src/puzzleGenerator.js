const seedrandom = require('seedrandom');

const BASE_COLORS = ['r', 'b', 'y'];
const MAX_PIECE_SIZE = 6;
const MAX_GENERATION_ATTEMPTS = 32;

const COLORS = {
  r: { name: 'Red', value: '#ed706b' },
  b: { name: 'Blue', value: '#6097d5' },
  y: { name: 'Yellow', value: '#f1ca62' },
  p: { name: 'Purple', value: '#9a79c1' },
  g: { name: 'Green', value: '#76a77b' },
  o: { name: 'Orange', value: '#df925e' },
  x: { name: 'Mixed', value: '#777a78' },
};

const MIXES = {
  b: 'b',
  r: 'r',
  y: 'y',
  'b+r': 'p',
  'b+y': 'g',
  'r+y': 'o',
  'b+r+y': 'x',
};

const EXPERIMENTAL_DIFFICULTIES = {
  easy: {
    boardSize: 5,
    pieceCount: { minimum: 8, maximum: 9 },
    averagePieceSize: { minimum: 4.1, maximum: 5.0 },
    adjacency: { minimum: 4, maximum: 7 },
  },
  medium: {
    boardSize: 6,
    pieceCount: { minimum: 15, maximum: 17 },
    averagePieceSize: { minimum: 3.8, maximum: 4.2 },
    adjacency: { minimum: 9, maximum: 14 },
  },
  hard: {
    boardSize: 6,
    pieceCount: { minimum: 15, maximum: 17 },
    averagePieceSize: { minimum: 3.8, maximum: 4.2 },
    adjacency: { minimum: 9, maximum: 14 },
    mixedPieceFraction: 1 / 3,
  },
  extreme: {
    boardSize: 7,
    pieceCount: { minimum: 18, maximum: 20 },
    averagePieceSize: { minimum: 4.0, maximum: 4.4 },
    adjacency: { minimum: 12, maximum: 18 },
    mixedPieceFraction: 1 / 3,
  },
  impossible: {
    boardSize: 7,
    pieceCount: { minimum: 18, maximum: 20 },
    averagePieceSize: { minimum: 4.0, maximum: 4.4 },
    adjacency: { minimum: 12, maximum: 18 },
    mixedPieceFraction: 1 / 3,
  },
};

function randomIndex(rng, length) {
  return Math.floor(rng() * length);
}

function shuffle(items, rng) {
  const shuffled = items.slice();
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = randomIndex(rng, index + 1);
    const item = shuffled[index];
    shuffled[index] = shuffled[swapIndex];
    shuffled[swapIndex] = item;
  }
  return shuffled;
}

function getDailySeed(date) {
  const year = date.toLocaleString('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
  });
  const month = date.toLocaleString('en-US', {
    timeZone: 'America/New_York',
    month: '2-digit',
  });
  const day = date.toLocaleString('en-US', {
    timeZone: 'America/New_York',
    day: '2-digit',
  });
  return year + '-' + month + '-' + day;
}

function neighbors(index, boardSize) {
  const row = Math.floor(index / boardSize);
  const col = index % boardSize;
  const result = [];
  if (row > 0) result.push(index - boardSize);
  if (row < boardSize - 1) result.push(index + boardSize);
  if (col > 0) result.push(index - 1);
  if (col < boardSize - 1) result.push(index + 1);
  return result;
}

function growConnectedShape(targetSize, rng) {
  const cells = [{ row: 0, col: 0 }];
  const included = new Set(['0,0']);

  while (cells.length < targetSize) {
    const frontier = new Set();
    cells.forEach((cell) => {
      const choices = [
        { row: cell.row - 1, col: cell.col },
        { row: cell.row + 1, col: cell.col },
        { row: cell.row, col: cell.col - 1 },
        { row: cell.row, col: cell.col + 1 },
      ];
      choices.forEach((choice) => {
        const key = choice.row + ',' + choice.col;
        if (!included.has(key)) frontier.add(key);
      });
    });

    if (!frontier.size) break;
    const choices = Array.from(frontier).map((key) => {
      const parts = key.split(',');
      return { row: Number(parts[0]), col: Number(parts[1]) };
    });
    const nextCell = choices[randomIndex(rng, choices.length)];
    const nextKey = nextCell.row + ',' + nextCell.col;
    included.add(nextKey);
    cells.push(nextCell);
  }

  const minimumRow = Math.min(...cells.map((cell) => cell.row));
  const minimumCol = Math.min(...cells.map((cell) => cell.col));
  return cells.map((cell) => ({
    row: cell.row - minimumRow,
    col: cell.col - minimumCol,
  }));
}

function averagePieceSize(pieces) {
  return pieces.reduce((total, piece) => total + piece.cells.length, 0) / pieces.length;
}

function getPieceCellColor(piece, cell) {
  return cell.color || piece.color;
}

function isValidMixedPiece(piece) {
  if (!piece.mixed) return true;
  if (piece.cells.length < 2) return false;
  const outliers = piece.cells.filter((cell) => getPieceCellColor(piece, cell) !== piece.color);
  return outliers.length === 1
    && piece.cells.some((cell) => getPieceCellColor(piece, cell) === piece.color);
}

function generatePieceSet(rng, config) {
  const count = config.pieceCount.minimum
    + randomIndex(rng, config.pieceCount.maximum - config.pieceCount.minimum + 1);
  const mixedPieceCount = config.mixedPieceFraction
    ? Math.round(count * config.mixedPieceFraction)
    : 0;
  const mixedIndexes = new Set(shuffle(
    Array.from({ length: count }, (value, index) => index),
    rng,
  ).slice(0, mixedPieceCount));

  for (let attempt = 0; attempt < 100; attempt += 1) {
    const pieces = [];
    for (let index = 0; index < count; index += 1) {
      const isMixed = mixedIndexes.has(index);
      const size = (isMixed ? 2 : 1) + randomIndex(rng, MAX_PIECE_SIZE - (isMixed ? 1 : 0));
      pieces.push({
        id: 'p' + (index + 1),
        color: BASE_COLORS[index % BASE_COLORS.length],
        cells: growConnectedShape(size, rng),
        mixed: isMixed,
      });
    }
    pieces.filter((piece) => piece.mixed).forEach((piece) => {
      const outlierIndex = randomIndex(rng, piece.cells.length);
      const alternateColors = BASE_COLORS.filter((color) => color !== piece.color);
      piece.cells[outlierIndex].color = alternateColors[randomIndex(rng, alternateColors.length)];
    });
    shuffle(pieces, rng).forEach((piece, index) => {
      piece.id = piece.color + (index + 1);
    });

    const averageSize = averagePieceSize(pieces);
    if (
      averageSize >= config.averagePieceSize.minimum
      && averageSize <= config.averagePieceSize.maximum
    ) {
      return pieces;
    }
  }
  return null;
}

function scoreAdjacency(pieces, placements, boardSize) {
  const boardArea = boardSize * boardSize;
  const owners = Array.from({ length: boardArea }, () => ({}));
  pieces.forEach((piece) => {
    const position = placements[piece.id];
    piece.cells.forEach((cell) => {
      const index = (position.row + cell.row) * boardSize + position.col + cell.col;
      owners[index][getPieceCellColor(piece, cell)] = piece.id;
    });
  });

  let score = 0;
  for (let row = 0; row < boardSize; row += 1) {
    for (let col = 0; col < boardSize; col += 1) {
      const index = row * boardSize + col;
      const neighborsToCheck = [];
      if (col < boardSize - 1) neighborsToCheck.push(index + 1);
      if (row < boardSize - 1) neighborsToCheck.push(index + boardSize);
      neighborsToCheck.forEach((neighbor) => {
        const sharedColor = BASE_COLORS.some((color) => (
          owners[index][color]
          && owners[neighbor][color]
          && owners[index][color] !== owners[neighbor][color]
        ));
        if (sharedColor) score += 1;
      });
    }
  }
  return score;
}

function countIsolatedPieces(pieces, owners) {
  const overlappedPieceIds = new Set();
  owners.forEach((cellOwners) => {
    const pieceIds = Object.values(cellOwners);
    if (pieceIds.length > 1) {
      pieceIds.forEach((pieceId) => overlappedPieceIds.add(pieceId));
    }
  });
  return pieces.length - overlappedPieceIds.size;
}

function placementCandidates(piece, boardSize, owners, rng) {
  const maximumRow = boardSize - (Math.max(...piece.cells.map((cell) => cell.row)) + 1);
  const maximumCol = boardSize - (Math.max(...piece.cells.map((cell) => cell.col)) + 1);
  const candidates = [];

  for (let row = 0; row <= maximumRow; row += 1) {
    for (let col = 0; col <= maximumCol; col += 1) {
      if (!pieceFitsWithoutSameColor(piece, { row, col }, boardSize, owners)) continue;
      const occupied = [];
      let overlapCount = 0;
      let uncoveredGain = 0;
      let sameColorAdjacency = 0;

      piece.cells.forEach((cell) => {
        const index = (row + cell.row) * boardSize + col + cell.col;
        const color = getPieceCellColor(piece, cell);
        occupied.push(index);
        if (
          Object.keys(owners[index]).length
          && !owners[index][color]
        ) {
          overlapCount += 1;
        }
        if (!Object.keys(owners[index]).length) uncoveredGain += 1;
      });

      occupied.forEach((index) => {
        const cell = piece.cells.find((candidate) => (
          (row + candidate.row) * boardSize + col + candidate.col === index
        ));
        const color = getPieceCellColor(piece, cell);
        neighbors(index, boardSize).forEach((neighbor) => {
          if (
            occupied.includes(neighbor)
            && owners[index][color]
            && owners[neighbor][color]
            && owners[index][color] !== owners[neighbor][color]
          ) {
            sameColorAdjacency += 1;
          }
        });
      });

      if (overlapCount > 0) {
        candidates.push({
          position: { row, col },
          occupied,
          overlapCount,
          uncoveredGain,
          sameColorAdjacency,
        });
      }
    }
  }

  candidates.sort((left, right) => {
    const leftScore = left.uncoveredGain * 5
      + left.sameColorAdjacency * 3
      + left.overlapCount;
    const rightScore = right.uncoveredGain * 5
      + right.sameColorAdjacency * 3
      + right.overlapCount;
    if (leftScore !== rightScore) return rightScore - leftScore;
    return rng() - rng();
  });
  return candidates;
}

function normalizeShape(cells) {
  const minimumRow = Math.min(...cells.map((cell) => cell.row));
  const minimumCol = Math.min(...cells.map((cell) => cell.col));
  return cells.map((cell) => ({
    ...cell,
    row: cell.row - minimumRow,
    col: cell.col - minimumCol,
  }));
}

function shapeIsConnected(cells) {
  if (!cells.length) return false;
  const reached = new Set([cells[0].row + ',' + cells[0].col]);
  let changed = true;
  while (changed) {
    changed = false;
    cells.forEach((cell) => {
      const key = cell.row + ',' + cell.col;
      if (reached.has(key)) return;
      const adjacent = [
        (cell.row - 1) + ',' + cell.col,
        (cell.row + 1) + ',' + cell.col,
        cell.row + ',' + (cell.col - 1),
        cell.row + ',' + (cell.col + 1),
      ];
      if (adjacent.some((adjacentKey) => reached.has(adjacentKey))) {
        reached.add(key);
        changed = true;
      }
    });
  }
  return reached.size === cells.length;
}

function trimShapeToSize(cells, targetSize) {
  let working = normalizeShape(cells);
  while (working.length > targetSize) {
    let removed = false;
    for (let index = working.length - 1; index >= 0 && !removed; index -= 1) {
      const candidate = working.filter((cell, cellIndex) => cellIndex !== index);
      if (shapeIsConnected(candidate)) {
        working = candidate;
        removed = true;
      }
    }
    if (!removed) break;
  }
  if (working.length !== targetSize) return null;
  return normalizeShape(working);
}

function rebuildOwners(pieces, placements, boardSize) {
  const owners = Array.from({ length: boardSize * boardSize }, () => ({}));
  pieces.forEach((piece) => {
    const position = placements[piece.id];
    piece.cells.forEach((cell) => {
      const row = position.row + cell.row;
      const col = position.col + cell.col;
      if (row < 0 || col < 0 || row >= boardSize || col >= boardSize) return;
      const index = row * boardSize + col;
      const color = getPieceCellColor(piece, cell);
      if (!owners[index][color]) {
        owners[index][color] = piece.id;
      }
    });
  });
  return owners;
}

function pieceFitsWithoutSameColor(piece, position, boardSize, owners) {
  return piece.cells.every((cell) => {
    const row = position.row + cell.row;
    const col = position.col + cell.col;
    if (row < 0 || col < 0 || row >= boardSize || col >= boardSize) return false;
    const index = row * boardSize + col;
    const color = getPieceCellColor(piece, cell);
    return !owners[index][color] || owners[index][color] === piece.id;
  });
}

function countSameColorDuplicates(pieces, placements, boardSize) {
  const seen = new Set();
  let duplicates = 0;
  pieces.forEach((piece) => {
    const position = placements[piece.id];
    piece.cells.forEach((cell) => {
      const row = position.row + cell.row;
      const col = position.col + cell.col;
      if (row < 0 || col < 0 || row >= boardSize || col >= boardSize) return;
      const key = row + ',' + col + ',' + getPieceCellColor(piece, cell);
      if (seen.has(key)) duplicates += 1;
      seen.add(key);
    });
  });
  return duplicates;
}

function absoluteCells(piece, placement, boardSize) {
  return piece.cells.map((cell) => ({
    index: (placement.row + cell.row) * boardSize + placement.col + cell.col,
    relativeRow: cell.row,
    relativeCol: cell.col,
  }));
}

function pieceOverlapCount(piece, placement, owners, boardSize) {
  return absoluteCells(piece, placement, boardSize)
    .filter(({ index }) => Object.keys(owners[index]).length > 1)
    .length;
}

function trimPieceForBank(piece, placement, owners, boardSize, bank, stats) {
  if (piece.cells.length <= 1) return false;
  const candidates = absoluteCells(piece, placement, boardSize);
  if (!candidates.length) return false;

  for (let index = piece.cells.length - 1; index >= 0; index -= 1) {
    const absolute = absoluteCells(piece, placement, boardSize)[index];
    const trimmed = piece.cells.filter((cell, cellIndex) => cellIndex !== index);
    if (!shapeIsConnected(trimmed)) continue;
    if (piece.mixed && !isValidMixedPiece({ ...piece, cells: trimmed })) continue;

    const removedRelative = piece.cells[index];
    const removedColor = getPieceCellColor(piece, removedRelative);
    const minimumRow = Math.min(...trimmed.map((cell) => cell.row));
    const minimumCol = Math.min(...trimmed.map((cell) => cell.col));
    piece.cells = trimmed.map((cell) => ({
      ...cell,
      row: cell.row - minimumRow,
      col: cell.col - minimumCol,
    }));
    placement.row += minimumRow;
    placement.col += minimumCol;
    delete owners[absolute.index][removedColor];
    bank.push(removedRelative);
    stats.trimmedPieces += 1;
    stats.bankedCells += 1;
    return true;
  }
  return false;
}

function addAbsoluteCellToPiece(piece, placement, absoluteIndex, boardSize, owners) {
  const row = Math.floor(absoluteIndex / boardSize);
  const col = absoluteIndex % boardSize;
  if (owners[absoluteIndex][piece.color]) return false;
  const relativeRow = row - placement.row;
  const relativeCol = col - placement.col;
  const duplicate = piece.cells.some((cell) => (
    cell.row === relativeRow && cell.col === relativeCol
  ));
  if (duplicate) return false;

  const minimumRow = Math.min(...piece.cells.map((cell) => cell.row), relativeRow);
  const minimumCol = Math.min(...piece.cells.map((cell) => cell.col), relativeCol);
  const expandedCells = [
    ...piece.cells.map((cell) => ({
      ...cell,
      row: cell.row - minimumRow,
      col: cell.col - minimumCol,
    })),
    { row: relativeRow - minimumRow, col: relativeCol - minimumCol },
  ];
  if (!shapeIsConnected(expandedCells)) return false;
  piece.cells = expandedCells;
  placement.row += minimumRow;
  placement.col += minimumCol;
  owners[absoluteIndex][piece.color] = piece.id;
  return true;
}

function expandAdjacentPiece(pieces, placements, owners, absoluteIndex, boardSize, stats) {
  const adjacentPieceIds = new Set();
  neighbors(absoluteIndex, boardSize).forEach((neighbor) => {
    Object.values(owners[neighbor]).forEach((pieceId) => adjacentPieceIds.add(pieceId));
  });
  const candidates = Array.from(adjacentPieceIds)
    .map((pieceId) => pieces.find((piece) => piece.id === pieceId))
    .filter((piece) => piece && piece.cells.length < MAX_PIECE_SIZE)
    .sort((left, right) => left.cells.length - right.cells.length);

  for (const piece of candidates) {
    if (addAbsoluteCellToPiece(
      piece,
      placements[piece.id],
      absoluteIndex,
      boardSize,
      owners,
    )) {
      stats.expandedPieces += 1;
      return true;
    }
  }
  return false;
}

function ensureBank(bank, pieces, placements, owners, boardSize, stats) {
  if (bank.length) return;
  const candidates = pieces
    .filter((piece) => piece.cells.length > 1)
    .sort((left, right) => (
      pieceOverlapCount(right, placements[right.id], owners, boardSize)
      - pieceOverlapCount(left, placements[left.id], owners, boardSize)
    ));
  if (candidates.length) {
    trimPieceForBank(candidates[0], placements[candidates[0].id], owners, boardSize, bank, stats);
  }
}

function repairOpenSpaces(pieces, placements, owners, bank, boardSize, stats) {
  let madeProgress = true;
  let iterations = 0;
  while (madeProgress && iterations < boardSize * boardSize) {
    iterations += 1;
    madeProgress = false;
    const uncovered = owners
      .map((cellOwners, index) => ({ cellOwners, index }))
      .filter(({ cellOwners }) => Object.keys(cellOwners).length === 0);

    for (const open of uncovered) {
    if (!bank.length) {
      ensureBank(bank, pieces, placements, owners, boardSize, stats);
    }
    if (!bank.length) continue;

    const neighborsToTry = neighbors(open.index, boardSize)
      .filter((index) => Object.keys(owners[index]).length);
    const pieceCandidates = neighborsToTry.map((index) => {
      const pieceId = Object.values(owners[index])[0];
      return pieces.find((piece) => piece.id === pieceId);
    }).filter(Boolean);

    const piece = pieceCandidates[0];
    if (!piece || piece.cells.length >= MAX_PIECE_SIZE) continue;
    if (addAbsoluteCellToPiece(
      piece,
      placements[piece.id],
      open.index,
      boardSize,
      owners,
    )) {
      bank.pop();
      stats.expandedPieces += 1;
      madeProgress = true;
      const rebuilt = rebuildOwners(pieces, placements, boardSize);
      owners.splice(0, owners.length, ...rebuilt);
    }
  }
  }
}

function relocatePieceForCoverage(piece, openIndex, placements, owners, boardSize) {
  const best = [];
  const maximumRow = boardSize - (Math.max(...piece.cells.map((cell) => cell.row)) + 1);
  const maximumCol = boardSize - (Math.max(...piece.cells.map((cell) => cell.col)) + 1);

  for (let row = 0; row <= maximumRow; row += 1) {
    for (let col = 0; col <= maximumCol; col += 1) {
      if (!pieceFitsWithoutSameColor(piece, { row, col }, boardSize, owners)) continue;
      const indices = piece.cells.map((cell) => (
        (row + cell.row) * boardSize + col + cell.col
      ));
      if (!indices.includes(openIndex)) continue;

      const gained = indices.filter((index) => Object.keys(owners[index]).length === 0).length;
      if (!gained) continue;
      let overlapCount = 0;
      indices.forEach((index, cellIndex) => {
        const color = getPieceCellColor(piece, piece.cells[cellIndex]);
        if (
          Object.keys(owners[index]).length
          && Object.keys(owners[index]).some((ownerColor) => ownerColor !== color)
        ) {
          overlapCount += 1;
        }
      });
      best.push({
        position: { row, col },
        gained,
        overlapCount,
      });
    }
  }

  best.sort((left, right) => (
    right.overlapCount - left.overlapCount
    || right.gained - left.gained
  ));
  if (!best.length) return false;
  placements[piece.id] = best[0].position;
  return true;
}

function repairOpenByRelocation(pieces, placements, owners, boardSize) {
  let iterations = 0;
  while (iterations < boardSize * boardSize) {
    iterations += 1;
    const open = owners
      .map((cellOwners, index) => ({ cellOwners, index }))
      .find(({ cellOwners }) => Object.keys(cellOwners).length === 0);
    if (!open) break;

    let repaired = false;
    for (const piece of shuffle(pieces, () => 0.5)) {
      if (relocatePieceForCoverage(piece, open.index, placements, owners, boardSize)) {
        const rebuilt = rebuildOwners(pieces, placements, boardSize);
        owners.splice(0, owners.length, ...rebuilt);
        repaired = true;
        break;
      }
    }
    if (!repaired) break;
  }
}

function repairMissingOverlaps(pieces, placements, owners, bank, boardSize, stats) {
  let pass = 0;
  while (pass < 3) {
    pass += 1;
    let madeProgress = false;
    for (const piece of pieces) {
      const occupied = absoluteCells(piece, placements[piece.id], boardSize);
      const isOverlapping = occupied.some(({ index }) => Object.keys(owners[index]).length > 1);
      if (isOverlapping || piece.cells.length >= MAX_PIECE_SIZE) continue;

      for (const occupiedCell of occupied) {
        if (!bank.length) {
          ensureBank(bank, pieces, placements, owners, boardSize, stats);
        }
        if (!bank.length) break;

        const neighbor = neighbors(occupiedCell.index, boardSize).find((index) => (
          Object.keys(owners[index]).length
          && Object.keys(owners[index]).some((ownerColor) => ownerColor !== piece.color)
        ));
        if (neighbor === undefined) continue;
        if (addAbsoluteCellToPiece(
          piece,
          placements[piece.id],
          neighbor,
          boardSize,
          owners,
        )) {
          bank.pop();
          stats.expandedPieces += 1;
          madeProgress = true;
          const rebuilt = rebuildOwners(pieces, placements, boardSize);
          owners.splice(0, owners.length, ...rebuilt);
          break;
        }
      }
    }
    if (!madeProgress) break;
  }
}

function repairMissingByRelocation(pieces, placements, owners, boardSize) {
  for (const piece of pieces) {
    const occupied = absoluteCells(piece, placements[piece.id], boardSize);
    if (occupied.some(({ index }) => Object.keys(owners[index]).length > 1)) continue;

    const maximumRow = boardSize - (Math.max(...piece.cells.map((cell) => cell.row)) + 1);
    const maximumCol = boardSize - (Math.max(...piece.cells.map((cell) => cell.col)) + 1);
    let best = null;
    for (let row = 0; row <= maximumRow; row += 1) {
      for (let col = 0; col <= maximumCol; col += 1) {
        if (!pieceFitsWithoutSameColor(piece, { row, col }, boardSize, owners)) continue;
        let overlapCount = 0;
        let uncoveredGain = 0;
        piece.cells.forEach((cell) => {
          const index = (row + cell.row) * boardSize + col + cell.col;
          const color = getPieceCellColor(piece, cell);
          if (!Object.keys(owners[index]).length) uncoveredGain += 1;
          if (
            Object.keys(owners[index]).length
            && Object.keys(owners[index]).some((ownerColor) => ownerColor !== color)
          ) {
            overlapCount += 1;
          }
        });
        if (overlapCount > 0 && (!best || overlapCount + uncoveredGain > best.score)) {
          best = {
            position: { row, col },
            score: overlapCount + uncoveredGain,
          };
        }
      }
    }
    if (best) {
      placements[piece.id] = best.position;
      const rebuilt = rebuildOwners(pieces, placements, boardSize);
      owners.splice(0, owners.length, ...rebuilt);
    }
  }
}

function ensureRepairInvariants(pieces, placements, owners, boardSize, stats) {
  const coveredIterations = boardSize * boardSize;
  for (let pass = 0; pass < coveredIterations; pass += 1) {
    const open = owners
      .map((cellOwners, index) => ({ cellOwners, index }))
      .find(({ cellOwners }) => Object.keys(cellOwners).length === 0);
    if (!open) break;

    const expanded = expandAdjacentPiece(
      pieces,
      placements,
      owners,
      open.index,
      boardSize,
      stats,
    );
    if (!expanded) {
      repairOpenByRelocation(pieces, placements, owners, boardSize);
    }
  }

  for (const piece of pieces.slice()) {
    const occupied = absoluteCells(piece, placements[piece.id], boardSize);
    if (occupied.some(({ index }) => Object.keys(owners[index]).length > 1)) continue;

    let repairIndex = null;
    let occupiedIndex = null;
    for (const candidate of occupied) {
      const neighborIndex = neighbors(candidate.index, boardSize).find((neighbor) => (
        Object.keys(owners[neighbor]).length
        && Object.keys(owners[neighbor]).some((ownerColor) => ownerColor !== piece.color)
      ));
      if (neighborIndex !== undefined) {
        repairIndex = neighborIndex;
        occupiedIndex = candidate;
        break;
      }
    }

    if (occupiedIndex && repairIndex !== null) {
      if (
        piece.cells.length < MAX_PIECE_SIZE
        && addAbsoluteCellToPiece(
          piece,
          placements[piece.id],
          repairIndex,
          boardSize,
          owners,
        )
      ) {
        stats.expandedPieces += 1;
      } else {
        repairMissingByRelocation(pieces, placements, owners, boardSize);
      }
      continue;
    }

    repairMissingByRelocation(pieces, placements, owners, boardSize);
  }

  for (let pass = 0; pass < boardSize * boardSize; pass += 1) {
    const open = owners
      .map((cellOwners, index) => ({ cellOwners, index }))
      .find(({ cellOwners }) => Object.keys(cellOwners).length === 0);
    if (!open) break;
    if (!expandAdjacentPiece(
      pieces,
      placements,
      owners,
      open.index,
      boardSize,
      stats,
    )) {
      repairOpenByRelocation(pieces, placements, owners, boardSize);
    }
  }

  for (const piece of pieces.slice()) {
    const occupied = absoluteCells(piece, placements[piece.id], boardSize);
    if (occupied.some(({ index }) => Object.keys(owners[index]).length > 1)) continue;

    for (const candidate of occupied) {
      const neighbor = neighbors(candidate.index, boardSize).find((index) => (
        !owners[index][piece.color]
        && Object.keys(owners[index]).length
        && Object.keys(owners[index]).some((color) => color !== piece.color)
        && Object.values(owners[index]).some((pieceId) => pieceId !== piece.id)
      ));
      if (neighbor === undefined) continue;
      if (
        piece.cells.length < MAX_PIECE_SIZE
        && addAbsoluteCellToPiece(
          piece,
          placements[piece.id],
          neighbor,
          boardSize,
          owners,
        )
      ) {
        stats.expandedPieces += 1;
      } else {
        repairMissingByRelocation(pieces, placements, owners, boardSize);
      }
      break;
    }
  }

  for (let pass = 0; pass < coveredIterations; pass += 1) {
    const open = owners.findIndex((cellOwners) => Object.keys(cellOwners).length === 0);
    if (open === -1) break;
    if (!expandAdjacentPiece(pieces, placements, owners, open, boardSize, stats)) {
      repairOpenByRelocation(pieces, placements, owners, boardSize);
    }
  }

  const rebuilt = rebuildOwners(pieces, placements, boardSize);
  owners.splice(0, owners.length, ...rebuilt);
}

function repairAdjacency(pieces, placements, owners, bank, boardSize, stats, target) {
  let adjacency = scoreAdjacency(pieces, placements, boardSize);

  if (adjacency < target.minimum) {
    for (const piece of pieces) {
      if (adjacency >= target.minimum) break;
      if (piece.cells.length >= MAX_PIECE_SIZE) continue;
      if (!bank.length) ensureBank(bank, pieces, placements, owners, boardSize, stats);
      if (!bank.length) continue;

      const occupied = absoluteCells(piece, placements[piece.id], boardSize);
      for (const occupiedCell of occupied) {
        for (const neighbor of neighbors(occupiedCell.index, boardSize)) {
          if (Object.keys(owners[neighbor]).length) continue;
          const color = piece.color;
          let sameColorNeighbor = false;
          neighbors(neighbor, boardSize).some((candidate) => (
            owners[candidate][color]
            && owners[candidate][color] !== piece.id
            && (sameColorNeighbor = true)
          ));
          if (!sameColorNeighbor) continue;
          if (addAbsoluteCellToPiece(
            piece,
            placements[piece.id],
            neighbor,
            boardSize,
            owners,
          )) {
            bank.pop();
            stats.expandedPieces += 1;
            adjacency = scoreAdjacency(pieces, placements, boardSize);
            break;
          }
        }
        if (adjacency >= target.minimum) break;
      }
    }
  } else if (adjacency > target.maximum) {
    for (const piece of pieces) {
      if (adjacency <= target.maximum) break;
      if (piece.cells.length <= 1) continue;
      const occupied = absoluteCells(piece, placements[piece.id], boardSize);
      for (let cellIndex = 0; cellIndex < occupied.length; cellIndex += 1) {
        const occupiedCell = occupied[cellIndex];
        const color = getPieceCellColor(piece, piece.cells[cellIndex]);
        const hasSameColorBoundary = neighbors(occupiedCell.index, boardSize).some((neighbor) => (
          owners[neighbor][color]
          && owners[neighbor][color] !== piece.id
        ));
        if (!hasSameColorBoundary) continue;
        const trimmed = piece.cells.filter((cell, index) => index !== cellIndex);
        if (!shapeIsConnected(trimmed)) continue;
        if (piece.mixed && !isValidMixedPiece({ ...piece, cells: trimmed })) continue;
        delete owners[occupiedCell.index][color];
        const minimumRow = Math.min(...trimmed.map((cell) => cell.row));
        const minimumCol = Math.min(...trimmed.map((cell) => cell.col));
        piece.cells = trimmed.map((cell) => ({
          ...cell,
          row: cell.row - minimumRow,
          col: cell.col - minimumCol,
        }));
        placements[piece.id].row += minimumRow;
        placements[piece.id].col += minimumCol;
        bank.push({ row: 0, col: 0 });
        stats.trimmedPieces += 1;
        stats.bankedCells += 1;
        adjacency = scoreAdjacency(pieces, placements, boardSize);
        break;
      }
    }

  }

  const rebuilt = rebuildOwners(pieces, placements, boardSize);
  owners.splice(0, owners.length, ...rebuilt);
  return scoreAdjacency(pieces, placements, boardSize);
}

function forceGuaranteedLayout(pieces, placements, owners, boardSize) {
  const clearedOwners = Array.from({ length: boardSize * boardSize }, () => ({}));
  owners.splice(0, owners.length, ...clearedOwners);
  pieces.forEach((piece) => {
    delete placements[piece.id];
  });

  for (const piece of pieces) {
    const maximumRow = boardSize - (Math.max(...piece.cells.map((cell) => cell.row)) + 1);
    const maximumCol = boardSize - (Math.max(...piece.cells.map((cell) => cell.col)) + 1);
    let best = null;
    for (let row = 0; row <= maximumRow; row += 1) {
      for (let col = 0; col <= maximumCol; col += 1) {
        if (!pieceFitsWithoutSameColor(piece, { row, col }, boardSize, owners)) continue;
        let overlapCount = 0;
        let uncoveredCount = 0;
        piece.cells.forEach((cell) => {
          const index = (row + cell.row) * boardSize + col + cell.col;
          uncoveredCount += Object.keys(owners[index]).length === 0 ? 1 : 0;
          overlapCount += Object.keys(owners[index]).length > 0 ? 1 : 0;
        });
        const score = overlapCount * 2 + uncoveredCount;
        if (!best || score > best.score) {
          best = { position: { row, col }, score };
        }
      }
    }
    if (!best) {
      if (piece.mixed) return false;
      piece.cells = [{ row: 0, col: 0 }];
      let fallback = null;
      for (let row = 0; row < boardSize && !fallback; row += 1) {
        for (let col = 0; col < boardSize && !fallback; col += 1) {
          if (!pieceFitsWithoutSameColor(piece, { row, col }, boardSize, owners)) continue;
          fallback = { row, col };
        }
      }
      if (!fallback) return false;
      best = { position: fallback, score: 0 };
    }
    placements[piece.id] = best.position;
    piece.cells.forEach((cell) => {
      const position = placements[piece.id];
      const row = position.row + cell.row;
      const col = position.col + cell.col;
      if (row < 0 || col < 0 || row >= boardSize || col >= boardSize) return;
      const index = row * boardSize + col;
      const color = getPieceCellColor(piece, cell);
      if (!owners[index][color]) owners[index][color] = piece.id;
    });
  }

  const rebuilt = rebuildOwners(pieces, placements, boardSize);
  owners.splice(0, owners.length, ...rebuilt);
  return true;
}

function placePieces(pieces, boardSize, rng) {
  const boardArea = boardSize * boardSize;
  const owners = Array.from({ length: boardArea }, () => ({}));
  const placements = {};
  const bank = [];
  const repairStats = {
    trimmedPieces: 0,
    bankedCells: 0,
    expandedPieces: 0,
  };
  const firstPiece = pieces[0];
  const maximumRow = boardSize - (Math.max(...firstPiece.cells.map((cell) => cell.row)) + 1);
  const maximumCol = boardSize - (Math.max(...firstPiece.cells.map((cell) => cell.col)) + 1);
  const firstPosition = {
    row: randomIndex(rng, maximumRow + 1),
    col: randomIndex(rng, maximumCol + 1),
  };
  placements[firstPiece.id] = firstPosition;
  firstPiece.cells.forEach((cell) => {
    const index = (firstPosition.row + cell.row) * boardSize
      + firstPosition.col + cell.col;
    owners[index][getPieceCellColor(firstPiece, cell)] = firstPiece.id;
  });

  const remainingPieces = shuffle(pieces.slice(1), rng);
  for (const piece of remainingPieces) {
    let candidates = placementCandidates(piece, boardSize, owners, rng);
    let workingPiece = piece;

    if (!candidates.length) {
      for (let size = piece.cells.length - 1; size >= 1 && !candidates.length; size -= 1) {
        const trimmed = trimShapeToSize(piece.cells, size);
        if (!trimmed) continue;
        workingPiece = { ...piece, cells: trimmed };
        candidates = placementCandidates(workingPiece, boardSize, owners, rng);
      }
    }

    if (!candidates.length) {
      workingPiece = { ...piece, cells: [{ row: 0, col: 0 }] };
      let fallbackPosition = null;
      let fallbackScore = -Infinity;
      for (let row = 0; row < boardSize; row += 1) {
        for (let col = 0; col < boardSize; col += 1) {
          if (!pieceFitsWithoutSameColor(
            workingPiece,
            { row, col },
            boardSize,
            owners,
          )) continue;
          const index = row * boardSize + col;
          const color = getPieceCellColor(workingPiece, workingPiece.cells[0]);
          const hasDifferentColor = Object.keys(owners[index])
            .some((ownerColor) => ownerColor !== color);
          const score = (hasDifferentColor ? 100 : 0)
            - Object.keys(owners[index]).length;
          if (score > fallbackScore) {
            fallbackScore = score;
            fallbackPosition = { row, col };
          }
        }
      }
      candidates = [{ position: fallbackPosition }];
      if (!fallbackPosition) return null;
    }

    if (workingPiece !== piece) {
      const removedCount = piece.cells.length - workingPiece.cells.length;
      for (let index = 0; index < removedCount; index += 1) bank.push({ row: 0, col: 0 });
      repairStats.trimmedPieces += 1;
      repairStats.bankedCells += removedCount;
    }

    const candidate = candidates[0];
    placements[piece.id] = candidate.position;
    workingPiece.cells.forEach((cell) => {
      const index = (candidate.position.row + cell.row) * boardSize
        + candidate.position.col + cell.col;
      const color = getPieceCellColor(workingPiece, cell);
      if (!owners[index][color]) {
        owners[index][color] = piece.id;
      }
    });
    piece.cells = workingPiece.cells;
  }

  repairOpenSpaces(pieces, placements, owners, bank, boardSize, repairStats);
  repairMissingOverlaps(pieces, placements, owners, bank, boardSize, repairStats);
  repairOpenByRelocation(pieces, placements, owners, boardSize);
  repairMissingByRelocation(pieces, placements, owners, boardSize);
  ensureRepairInvariants(pieces, placements, owners, boardSize, repairStats);
  const rebuilt = rebuildOwners(pieces, placements, boardSize);
  owners.splice(0, owners.length, ...rebuilt);
  return { placements, owners, bank, repairStats };
}

function createExperimentalCandidate(rng, difficulty, statistics) {
  const config = EXPERIMENTAL_DIFFICULTIES[difficulty];
  const boardSize = config.boardSize;
  const boardArea = boardSize * boardSize;
  const pieces = generatePieceSet(rng, config);
  if (!pieces) {
    if (statistics) statistics.pieceSetRejected += 1;
    return null;
  }
  const initialPieceCount = pieces.length;
  const initialAverageSize = averagePieceSize(pieces);

  const placed = placePieces(pieces, boardSize, rng);
  if (!placed) {
    if (statistics) statistics.placementRejected += 1;
    return null;
  }
  const isolatedPieceCount = countIsolatedPieces(pieces, placed.owners);
  const coveredCount = placed.owners.filter((owners) => Object.keys(owners).length).length;
  if (statistics && isolatedPieceCount > 0) statistics.isolatedRejected += 1;
  if (statistics && coveredCount !== boardArea) statistics.coverageRejected += 1;

  const adjacency = repairAdjacency(
    pieces,
    placed.placements,
    placed.owners,
    placed.bank,
    boardSize,
    placed.repairStats,
    config.adjacency,
  );
  ensureRepairInvariants(pieces, placed.placements, placed.owners, boardSize, placed.repairStats);
  const averageSize = averagePieceSize(pieces);
  const repairedIsolatedCount = countIsolatedPieces(pieces, placed.owners);
  const repairedCoveredCount = placed.owners
    .filter((owners) => Object.keys(owners).length).length;
  const sameColorDuplicateCount = countSameColorDuplicates(
    pieces,
    placed.placements,
    boardSize,
  );
  if (
    repairedIsolatedCount > 0
    || repairedCoveredCount !== boardArea
    || sameColorDuplicateCount > 0
  ) {
    const forced = forceGuaranteedLayout(
      pieces,
      placed.placements,
      placed.owners,
      boardSize,
    );
    if (!forced) return null;
    ensureRepairInvariants(
      pieces,
      placed.placements,
      placed.owners,
      boardSize,
      placed.repairStats,
    );
  }
  const expectedMixedPieceCount = Math.round(
    initialPieceCount * (config.mixedPieceFraction || 0),
  );
  const mixedPieces = pieces.filter((piece) => piece.mixed);
  if (
    mixedPieces.length !== expectedMixedPieceCount
    || mixedPieces.some((piece) => !isValidMixedPiece(piece))
  ) {
    if (statistics) {
      statistics.mixedCompositionRejected = (statistics.mixedCompositionRejected || 0) + 1;
    }
    return null;
  }
  const goal = [];
  for (let row = 0; row < boardSize; row += 1) {
    const goalRow = [];
    for (let col = 0; col < boardSize; col += 1) {
      const index = row * boardSize + col;
      const colorKey = BASE_COLORS
        .filter((color) => placed.owners[index][color])
        .sort()
        .join('+');
      goalRow.push(MIXES[colorKey]);
    }
    goal.push(goalRow);
  }

  return {
    pieces,
    placements: placed.placements,
    owners: placed.owners,
    goal,
    isolatedPieceCount: countIsolatedPieces(pieces, placed.owners),
    adjacency,
    averageSize,
    repairStats: placed.repairStats,
    initialPieceCount,
    initialAverageSize,
    sameColorDuplicateCount: countSameColorDuplicates(
      pieces,
      placed.placements,
      boardSize,
    ),
  };
}

function puzzleFromCandidate(candidate, seed, difficulty) {
  const config = EXPERIMENTAL_DIFFICULTIES[difficulty];
  const adjacencyRange = config.adjacency;
  const adjacencyScore = (
    (candidate.adjacency - adjacencyRange.minimum)
    / (adjacencyRange.maximum - adjacencyRange.minimum)
  );
  const pieceRange = config.pieceCount;
  const pieceScore = (
    (candidate.pieces.length - pieceRange.minimum)
    / (pieceRange.maximum - pieceRange.minimum)
  );
  const averageRange = config.averagePieceSize;
  const averageScore = (
    (averageRange.maximum - candidate.averageSize)
    / (averageRange.maximum - averageRange.minimum)
  );
  const normalized = [adjacencyScore, pieceScore, averageScore].map((score) => (
    Math.max(0, Math.min(1, score))
  ));
  const difficultyScore = Math.round(
    normalized.reduce((total, score) => total + score, 0) / normalized.length * 1000,
  ) / 10;

  return {
    dimensions: { rows: config.boardSize, columns: config.boardSize },
    goal: candidate.goal,
    startingPieces: candidate.pieces,
    difficultyScore,
    difficulty,
    averagePieceSize: candidate.averageSize,
    adjacencyScore: candidate.adjacency,
    isolatedPieceCount: candidate.isolatedPieceCount,
    seed,
    repairStats: candidate.repairStats,
    initialPieceCount: candidate.initialPieceCount,
    initialAverageSize: candidate.initialAverageSize,
    sameColorDuplicateCount: candidate.sameColorDuplicateCount,
  };
}

function generateExperimentalPuzzle(seed, difficulty, statistics) {
  if (typeof seed !== 'string' || !seed) {
    throw new TypeError('Puzzle generation requires a non-empty seed.');
  }
  if (!Object.prototype.hasOwnProperty.call(EXPERIMENTAL_DIFFICULTIES, difficulty)) {
    throw new TypeError(
      'Puzzle difficulty must be easy, medium, hard, extreme, or impossible.',
    );
  }

  for (let attempt = 0; attempt < MAX_GENERATION_ATTEMPTS; attempt += 1) {
    const retrySeed = seed + ':experimental:' + difficulty
      + (attempt === 0 ? '' : ':retry:' + attempt);
    const rng = seedrandom(retrySeed);
    const candidate = createExperimentalCandidate(rng, difficulty, statistics);
    if (!candidate) continue;
    if (
      candidate.isolatedPieceCount > 0
      || candidate.sameColorDuplicateCount > 0
      || candidate.goal.some((row) => row.some((color) => (
        !Object.prototype.hasOwnProperty.call(COLORS, color)
      )))
    ) {
      continue;
    }
    return puzzleFromCandidate(candidate, seed, difficulty);
  }
  throw new Error(
    'Unable to generate a complete ' + difficulty + ' puzzle after '
      + MAX_GENERATION_ATTEMPTS + ' deterministic attempts for seed "' + seed + '".',
  );
}

module.exports = {
  COLORS,
  EXPERIMENTAL_DIFFICULTIES,
  MIXES,
  averagePieceSize,
  countSameColorDuplicates,
  getPieceCellColor,
  getDailySeed,
  generateExperimentalPuzzle,
  scoreAdjacency,
};

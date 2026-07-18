// Card dimensions must match CardNode.jsx's rendered size.
const CARD_W = 320;
const CARD_H = 200;

/**
 * Lay items out in a 3-column grid centered at (centerX, centerY).
 * centerX/centerY are the CENTER of the resulting grid — use for viewport-centering (Surface 2 happy path).
 * For below-existing placement, use gridLayoutFromTopLeft instead.
 * ±jitter on the origin prevents back-to-back batches stacking pixel-perfectly.
 */
export function gridLayout(
  items,
  centerX = 0,
  centerY = 0,
  { cols = 3, colW = CARD_W, rowH = CARD_H, jitter = 16 } = {},
) {
  if (!items.length) return [];

  const jx = (Math.random() - 0.5) * jitter * 2;
  const jy = (Math.random() - 0.5) * jitter * 2;

  const usedCols = Math.min(items.length, cols);
  const totalW = usedCols * colW;
  const totalH = Math.ceil(items.length / cols) * rowH;

  const startX = centerX - totalW / 2 + jx;
  const startY = centerY - totalH / 2 + jy;

  return items.map((item, i) => ({
    ...item,
    position: {
      x: startX + (i % cols) * colW,
      y: startY + Math.floor(i / cols) * rowH,
    },
  }));
}

/**
 * Lay items out in a 3-column grid whose TOP-LEFT corner is at (startX, startY).
 * startX/startY are a TOP-LEFT anchor — use when placing below existing cards via findClearOrigin.
 * ±jitter prevents back-to-back batches stacking pixel-perfectly.
 */
export function gridLayoutFromTopLeft(
  items,
  startX = 0,
  startY = 0,
  { cols = 3, colW = CARD_W, rowH = CARD_H, jitter = 16 } = {},
) {
  if (!items.length) return [];

  const jx = (Math.random() - 0.5) * jitter * 2;
  const jy = (Math.random() - 0.5) * jitter * 2;

  return items.map((item, i) => ({
    ...item,
    position: {
      x: startX + jx + (i % cols) * colW,
      y: startY + jy + Math.floor(i / cols) * rowH,
    },
  }));
}

/**
 * Find a clear origin for a new batch: directly below the lowest existing card,
 * left-aligned with the leftmost existing card, plus an 80px gutter.
 * Returns a TOP-LEFT anchor — pass to gridLayoutFromTopLeft, not gridLayout.
 *
 * Accepts any objects with `position: { x, y }` — both raw API item docs and
 * React Flow node objects work.
 *
 * Empty canvas → returns { x: 0, y: 0 }.
 */
export function findClearOrigin(
  existingItems,
  { cardW = CARD_W, cardH = CARD_H, gutter = 80 } = {},
) {
  if (!existingItems.length) return { x: 0, y: 0 };

  let minX = Infinity;
  let maxBottomY = -Infinity;

  for (const item of existingItems) {
    const x = item.position?.x ?? 0;
    const y = item.position?.y ?? 0;
    if (x < minX) minX = x;
    if (y + cardH > maxBottomY) maxBottomY = y + cardH;
  }

  return { x: minX, y: maxBottomY + gutter };
}

/**
 * Return true if placing a grid centered at `center` would land on top of
 * any existing card. Used by Surface 2 to decide whether to use the viewport
 * center or fall back to findClearOrigin.
 *
 * The check is a proximity heuristic: any existing card whose center falls
 * within one card-width/height of the proposed grid center is considered
 * overlapping.
 */
export function wouldOverlapExisting(
  center,
  existingItems,
  { cardW = CARD_W, cardH = CARD_H } = {},
) {
  return existingItems.some((item) => {
    const px = item.position?.x ?? 0;
    const py = item.position?.y ?? 0;
    const dx = Math.abs(px + cardW / 2 - center.x);
    const dy = Math.abs(py + cardH / 2 - center.y);
    return dx < cardW && dy < cardH;
  });
}

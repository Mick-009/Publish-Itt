/**
 * Lay canvas items out in a 3-column grid centered at (centerX, centerY)
 * in React Flow's coordinate space.
 *
 * Returns a copy of items with `position` added/overwritten.
 * Small ±jitter on the grid origin prevents back-to-back extractions
 * from stacking pixel-perfectly.
 */
export function gridLayout(
  items,
  centerX = 0,
  centerY = 0,
  { cols = 3, colW = 320, rowH = 200, jitter = 16 } = {},
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

import test from 'node:test';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { getCardLayout, createCardsPdf } from '../src/cardsPdf.js';

test('93 × 58 mm cards fit two columns and four rows per A4 within printer margins', () => {
  const layout = getCardLayout(9.3, 5.8);
  assert.equal(layout.perPage, 8);
  assert.equal(layout.columns, 2);
  assert.equal(layout.rows, 4);
  assert.equal(layout.width, 93);
  assert.equal(layout.height, 58);
  for (const [w, h] of [[9.3, 5.8], [9, 6], [8.56, 5.398], [19, 27.7], [1, 1]]) {
    const l = getCardLayout(w, h);
    assert.ok(l.left >= 10 && l.top >= 10);
    assert.ok(l.left + l.columns * l.width + (l.columns - 1) * l.gap <= 200);
    assert.ok(l.top + l.rows * l.height + (l.rows - 1) * l.gap <= 287);
  }
});

test('rejects empty, nonfinite, too small and oversized dimensions', () => {
  for (const [w, h] of [[0, 6], [9, NaN], [Infinity, 6], [-1, 6], [0.9, 6], [19.01, 6], [9, 27.71]]) {
    assert.equal(getCardLayout(w, h), null);
  }
});

test('PDF alternates front and back sheets with matching duplex positions', async () => {
  const png = new Uint8Array(readFileSync(new URL('../src/assets/bashkimtours_logo.png', import.meta.url)));
  const back = new Uint8Array(readFileSync(new URL('../bashkimtours_kartela_prapa.png', import.meta.url)));
  for (const count of [1, 8, 9, 16, 17]) {
    const seen = [];
    const pdf = await createCardsPdf(Array.from({ length: count }, (_, i) => i), getCardLayout(9.3, 5.8), async (student) => {
      seen.push(student);
      return png;
    }, back);
    assert.equal(pdf.getNumberOfPages(), 2 * Math.ceil(count / 8));
    assert.deepEqual(seen, Array.from({ length: count }, (_, i) => i));
    for (let page = 1; page <= pdf.getNumberOfPages(); page += 2) {
      const matrices = (p) => pdf.internal.pages[p].filter((command) => command.endsWith(' cm')).map((command) => command.split(' ').map(Number));
      const fronts = matrices(page);
      const backs = matrices(page + 1);
      assert.equal(fronts.length, Math.min(8, count - ((page - 1) / 2) * 8));
      assert.equal(backs.length, fronts.length);
      fronts.forEach((front, i) => {
        const rear = backs[i];
        assert.equal(front[0], rear[0]);
        assert.equal(front[3], rear[3]);
        assert.equal(front[5], rear[5]);
        assert.ok(Math.abs((front[4] + rear[4] + front[0]) * 25.4 / 72 - 210) < 0.001);
      });
    }
    assert.ok(Math.abs(pdf.internal.pageSize.getWidth() - 210) < 0.01);
    assert.ok(Math.abs(pdf.internal.pageSize.getHeight() - 297) < 0.01);
    const matrix = pdf.internal.pages[1].find((command) => command.endsWith(' cm')).split(' ').map(Number);
    assert.ok(Math.abs(matrix[0] * 25.4 / 72 - 93) < 0.001);
    assert.ok(Math.abs(matrix[3] * 25.4 / 72 - 58) < 0.001);
  }
});

test('single student PDF centers both sides at the same position', async () => {
  const front = new Uint8Array(readFileSync(new URL('../src/assets/bashkimtours_logo.png', import.meta.url)));
  const back = new Uint8Array(readFileSync(new URL('../bashkimtours_kartela_prapa.png', import.meta.url)));
  const layout = getCardLayout(9, 5.5);
  const pdf = await createCardsPdf([1], layout, async () => front, back, undefined, { centerSingle: true });
  assert.equal(pdf.getNumberOfPages(), 2);
  for (const page of [1, 2]) {
    const matrix = pdf.internal.pages[page].find((command) => command.endsWith(' cm')).split(' ').map(Number);
    assert.ok(Math.abs(matrix[4] * 25.4 / 72 - (210 - layout.width) / 2) < 0.001);
    assert.ok(Math.abs(matrix[5] * 25.4 / 72 - (297 - layout.height) / 2) < 0.001);
  }
});

import { test } from 'node:test';
import assert from 'node:assert';
import { generateQRCode, getQrSvg } from '../src/utils/qrCode';

test('QR Code: generates valid matrix for standard host URL', () => {
  const url = 'http://192.168.0.132:5173/?view=admin';
  const { matrix, size } = generateQRCode(url);

  assert.strictEqual(size, 29); // Version 3 is 29x29
  assert.strictEqual(matrix.length, 29);
  assert.strictEqual(matrix[0].length, 29);

  // Top-left finder center is dark
  assert.strictEqual(matrix[3][3], true);
  // Top-left finder border is dark
  assert.strictEqual(matrix[0][0], true);
  // Top-left finder separator is light
  assert.strictEqual(matrix[7][7], false);
});

test('QR Code: generates SVG markup with rect tags', () => {
  const url = 'http://192.168.0.132:5173/?view=admin';
  const svg = getQrSvg(url);

  assert.ok(svg.includes('<svg'));
  assert.ok(svg.includes('viewBox="0 0 37 37"'));
  assert.ok(svg.includes('<rect'));
  assert.ok(svg.includes('fill="#000"'));
});

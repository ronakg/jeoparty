import { test } from 'node:test';
import assert from 'node:assert';
import { generateQRCode, getQrSvg, getStyledQrSvg } from '../src/utils/qrCode';

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

test('QR Code: generates styled JeoPARTY SVG markup', () => {
  const url = 'http://192.168.0.132:5173/?view=admin';
  const svg = getStyledQrSvg(url);

  assert.ok(svg.includes('<svg'));
  // Outer frame and card rects
  assert.ok(svg.includes('fill="#07164F"'));
  assert.ok(svg.includes('fill="#FAF6EE"'));
  // Amber gold finder center circle
  assert.ok(svg.includes('fill="#C88200"'));
  // Module dots and finder squircles
  assert.ok(svg.includes('<circle'));
  assert.ok(svg.includes('<rect'));
  assert.ok(svg.includes('stroke="#07164F"'));
});

test('QR Code: getStyledQrSvg respects custom palette options', () => {
  const url = 'http://10.0.0.1:5173';
  const svg = getStyledQrSvg(url, {
    mainColor: '#1E4EF2',
    accentColor: '#F5C242',
    bgColor: '#FFFFFF',
    frameColor: '#020412',
  });

  assert.ok(svg.includes('fill="#020412"'));
  assert.ok(svg.includes('fill="#FFFFFF"'));
  assert.ok(svg.includes('fill="#F5C242"'));
  assert.ok(svg.includes('stroke="#1E4EF2"'));
});

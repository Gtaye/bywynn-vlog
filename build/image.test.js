'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { inspectImage } = require('./image');
const { jpeg, png, webpX } = require('./fixtures/images');

test('jpeg width/height and no exif', () => {
  assert.deepEqual(inspectImage(jpeg({ width: 1600, height: 1200 })), { type: 'jpeg', width: 1600, height: 1200, hasExif: false });
});
test('jpeg with APP1 Exif segment is flagged', () => {
  assert.equal(inspectImage(jpeg({ width: 10, height: 10, exif: true })).hasExif, true);
});
test('png dimensions', () => {
  assert.deepEqual(inspectImage(png({ width: 800, height: 600 })), { type: 'png', width: 800, height: 600, hasExif: false });
});
test('webp VP8X dimensions', () => {
  assert.deepEqual(inspectImage(webpX({ width: 1601, height: 900 })), { type: 'webp', width: 1601, height: 900, hasExif: false });
});
test('garbage is not an image', () => {
  assert.equal(inspectImage(Buffer.from('hello world, not an image at all')), null);
  assert.equal(inspectImage(Buffer.alloc(0)), null);
});


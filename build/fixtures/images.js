'use strict';
/* Test-only: synthesize minimal image headers. */
function jpeg({ width, height, exif = false }) {
  const parts = [Buffer.from([0xff, 0xd8])];
  if (exif) { const body = Buffer.concat([Buffer.from('Exif\0\0'), Buffer.alloc(10)]); const len = Buffer.alloc(2); len.writeUInt16BE(body.length + 2); parts.push(Buffer.from([0xff, 0xe1]), len, body); }
  const sof = Buffer.alloc(2 + 1 + 2 + 2 + 1); sof.writeUInt16BE(sof.length); sof[2] = 8; sof.writeUInt16BE(height, 3); sof.writeUInt16BE(width, 5); sof[7] = 3;
  parts.push(Buffer.from([0xff, 0xc0]), sof, Buffer.from([0xff, 0xd9]));
  return Buffer.concat(parts);
}
function png({ width, height }) {
  const b = Buffer.alloc(8 + 4 + 4 + 13);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(b, 0);
  b.writeUInt32BE(13, 8); b.write('IHDR', 12); b.writeUInt32BE(width, 16); b.writeUInt32BE(height, 20);
  return b;
}
function webpX({ width, height }) {
  const b = Buffer.alloc(30); b.write('RIFF', 0); b.writeUInt32LE(22, 4); b.write('WEBP', 8); b.write('VP8X', 12); b.writeUInt32LE(10, 16);
  b.writeUIntLE(width - 1, 24, 3); b.writeUIntLE(height - 1, 27, 3); return b;
}

module.exports = { jpeg, png, webpX };

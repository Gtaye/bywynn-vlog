'use strict';
/* Dependency-free image header reader: type, dimensions, and whether a JPEG carries an Exif segment. */

function jpeg(buf) {
  let i = 2;
  let hasExif = false;
  while (i + 4 <= buf.length) {
    if (buf[i] !== 0xff) return null;
    const marker = buf[i + 1];
    if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01 || marker === 0xff) { i += marker === 0xff ? 1 : 2; continue; }
    if (marker === 0xd9 || marker === 0xda) break;
    const len = buf.readUInt16BE(i + 2);
    if (len < 2 || i + 2 + len > buf.length) return null;
    if (marker === 0xe1 && buf.subarray(i + 4, i + 10).toString('latin1') === 'Exif\0\0') hasExif = true;
    const isSOF = (marker >= 0xc0 && marker <= 0xcf) && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isSOF) {
      if (len < 7) return null;
      return { type: 'jpeg', width: buf.readUInt16BE(i + 7), height: buf.readUInt16BE(i + 5), hasExif };
    }
    i += 2 + len;
  }
  return null;
}

function png(buf) {
  if (buf.length < 24 || buf.toString('latin1', 12, 16) !== 'IHDR') return null;
  return { type: 'png', width: buf.readUInt32BE(16), height: buf.readUInt32BE(20), hasExif: false };
}

function webp(buf) {
  if (buf.length < 30) return null;
  const chunk = buf.toString('latin1', 12, 16);
  if (chunk === 'VP8X') return { type: 'webp', width: buf.readUIntLE(24, 3) + 1, height: buf.readUIntLE(27, 3) + 1, hasExif: false };
  if (chunk === 'VP8 ') return { type: 'webp', width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff, hasExif: false };
  if (chunk === 'VP8L') {
    const b = buf.readUInt32LE(21);
    return { type: 'webp', width: (b & 0x3fff) + 1, height: ((b >> 14) & 0x3fff) + 1, hasExif: false };
  }
  return null;
}

/** inspectImage(buffer) -> { type, width, height, hasExif } | null */
function inspectImage(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8) return jpeg(buf);
  if (buf.readUInt32BE(0) === 0x89504e47) return png(buf);
  if (buf.toString('latin1', 0, 4) === 'RIFF' && buf.toString('latin1', 8, 12) === 'WEBP') return webp(buf);
  return null;
}

module.exports = { inspectImage };

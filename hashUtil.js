const crypto = require('crypto');
const sharp = require('sharp');

// Exact hash - catches identical files instantly (fast path)
function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

// Perceptual hash (aHash + dHash combined, 128 bits total as hex)
// Catches images that were re-saved, resized, lightly cropped, or re-compressed.
async function pHash(buffer) {
  const size = 9; // 9x8 needed for dHash (size x (size-1))
  const raw = await sharp(buffer)
    .grayscale()
    .resize(size, size, { fit: 'fill' })
    .raw()
    .toBuffer();

  // aHash: compare each pixel to the average
  let sum = 0;
  for (let i = 0; i < raw.length; i++) sum += raw[i];
  const avg = sum / raw.length;
  let aHashBits = '';
  for (let i = 0; i < raw.length; i++) {
    aHashBits += raw[i] >= avg ? '1' : '0';
  }

  // dHash: compare each pixel to the one to its right
  let dHashBits = '';
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size - 1; col++) {
      const left = raw[row * size + col];
      const right = raw[row * size + col + 1];
      dHashBits += left > right ? '1' : '0';
    }
  }

  return bitsToHex(aHashBits) + bitsToHex(dHashBits);
}

function bitsToHex(bits) {
  let hex = '';
  for (let i = 0; i < bits.length; i += 4) {
    hex += parseInt(bits.slice(i, i + 4).padEnd(4, '0'), 2).toString(16);
  }
  return hex;
}

function hexToBits(hex) {
  let bits = '';
  for (const ch of hex) {
    bits += parseInt(ch, 16).toString(2).padStart(4, '0');
  }
  return bits;
}

// Hamming distance between two hex hash strings
function hammingDistance(hexA, hexB) {
  const a = hexToBits(hexA);
  const b = hexToBits(hexB);
  const len = Math.min(a.length, b.length);
  let dist = 0;
  for (let i = 0; i < len; i++) {
    if (a[i] !== b[i]) dist++;
  }
  return dist;
}

module.exports = { sha256, pHash, hammingDistance };

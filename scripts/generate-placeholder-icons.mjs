// Generates placeholder PWA icon PNGs (192x192, 512x512, 96x96 for shortcuts,
// and 180x180 for apple-touch). Solid brand background with a white "I" glyph.
//
// Intentionally dependency-free: writes valid PNGs using Node's built-in zlib
// and a tiny hand-rolled encoder. These are PLACEHOLDERS — swap in real brand
// art before launch.
import { writeFileSync, mkdirSync } from "node:fs";
import { deflateSync } from "node:zlib";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(__dirname, "..", "public", "icons");
mkdirSync(OUT_DIR, { recursive: true });

// Brand color — matches --color-brand in globals.css
const BRAND = [0x0f, 0x17, 0x2a]; // #0f172a
const ON_BRAND = [0xff, 0xff, 0xff]; // #ffffff

// Simple 5x7 bitmap for the capital letter "I" (rows top→bottom).
// 1 = on, 0 = off
const GLYPH_I = [
  [1, 1, 1, 1, 1],
  [0, 0, 1, 0, 0],
  [0, 0, 1, 0, 0],
  [0, 0, 1, 0, 0],
  [0, 0, 1, 0, 0],
  [0, 0, 1, 0, 0],
  [1, 1, 1, 1, 1],
];

function makeImage(size) {
  // Each pixel: RGB. Start with brand fill.
  const pixels = Buffer.alloc(size * size * 3);
  for (let i = 0; i < pixels.length; i += 3) {
    pixels[i] = BRAND[0];
    pixels[i + 1] = BRAND[1];
    pixels[i + 2] = BRAND[2];
  }
  // Paint a big "I" glyph centered, occupying ~50% of the canvas.
  const gW = GLYPH_I[0].length;
  const gH = GLYPH_I.length;
  const cell = Math.floor((size * 0.5) / gW); // glyph width ≈ 50% of canvas
  const glyphW = cell * gW;
  const glyphH = cell * gH;
  const offX = Math.floor((size - glyphW) / 2);
  const offY = Math.floor((size - glyphH) / 2);
  for (let gy = 0; gy < gH; gy++) {
    for (let gx = 0; gx < gW; gx++) {
      if (!GLYPH_I[gy][gx]) continue;
      for (let dy = 0; dy < cell; dy++) {
        for (let dx = 0; dx < cell; dx++) {
          const x = offX + gx * cell + dx;
          const y = offY + gy * cell + dy;
          const idx = (y * size + x) * 3;
          pixels[idx] = ON_BRAND[0];
          pixels[idx + 1] = ON_BRAND[1];
          pixels[idx + 2] = ON_BRAND[2];
        }
      }
    }
  }
  return pixels;
}

function crc32(buf) {
  let c;
  const table = crc32.table || (crc32.table = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })());
  c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = table[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

function encodePNG(size, rgb) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;    // bit depth
  ihdr[9] = 2;    // color type: RGB
  ihdr[10] = 0;   // compression
  ihdr[11] = 0;   // filter
  ihdr[12] = 0;   // interlace
  // Scanline with filter byte 0 prepended per row
  const rowStride = size * 3;
  const raw = Buffer.alloc((rowStride + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (rowStride + 1)] = 0;
    rgb.subarray(y * rowStride, (y + 1) * rowStride).copy(
      raw,
      y * (rowStride + 1) + 1,
    );
  }
  const idat = deflateSync(raw);
  return Buffer.concat([
    signature,
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const sizes = [
  { size: 192, name: "icon-192.png" },
  { size: 512, name: "icon-512.png" },
  { size: 96, name: "icon-96.png" },           // shortcut icon
  { size: 180, name: "apple-touch-icon.png" }, // iOS home screen
];

for (const { size, name } of sizes) {
  const pixels = makeImage(size);
  const png = encodePNG(size, pixels);
  writeFileSync(resolve(OUT_DIR, name), png);
  console.log(`wrote ${name} (${size}×${size}, ${png.length} bytes)`);
}

import sharp from 'sharp';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const LOGO_PATH = path.join(path.dirname(fileURLToPath(import.meta.url)), 'assets', 'logo.svg');
const LOGO_WIDTH_PX = 288;

let cachedBuffer = null;

export async function getLogoEscPosBuffer() {
  if (cachedBuffer) return cachedBuffer;

  const { data, info } = await sharp(LOGO_PATH)
    .resize({ width: LOGO_WIDTH_PX })
    .flatten({ background: '#ffffff' })
    .greyscale()
    .threshold(128)
    .raw()
    .toBuffer({ resolveWithObject: true });

  const widthBytes = Math.ceil(info.width / 8);
  const heightPx = info.height;
  const imageData = Buffer.alloc(widthBytes * heightPx);

  for (let y = 0; y < heightPx; y++) {
    for (let x = 0; x < info.width; x++) {
      const pixelEscuro = data[y * info.width + x] < 128;
      if (pixelEscuro) {
        const byteIndex = y * widthBytes + Math.floor(x / 8);
        const bitIndex = 7 - (x % 8);
        imageData[byteIndex] |= 1 << bitIndex;
      }
    }
  }

  const header = Buffer.from([
    0x1d, 0x76, 0x30, 0x00,
    widthBytes & 0xff, (widthBytes >> 8) & 0xff,
    heightPx & 0xff, (heightPx >> 8) & 0xff,
  ]);

  cachedBuffer = Buffer.concat([header, imageData]);
  return cachedBuffer;
}
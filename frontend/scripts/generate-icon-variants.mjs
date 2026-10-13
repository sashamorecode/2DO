import { mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const assetsDir = join(dirname(scriptDir), 'assets');
const sourcePath = join(assetsDir, 'icon.png');

const SIZE = 1024;
const BACKGROUND = [31, 10, 29];
const VARIANTS = [
  { file: 'icon-yellow.png', silhouette: [229, 184, 104] },
  { file: 'icon-red.png', silhouette: [224, 122, 145] },
];

function blendChannel(alpha, silhouette, background) {
  return Math.round((silhouette * alpha + background * (255 - alpha)) / 255);
}

async function readSourceAlpha() {
  const metadata = await sharp(sourcePath).metadata();
  if (metadata.width !== SIZE || metadata.height !== SIZE || !metadata.hasAlpha) {
    throw new Error(`Expected a ${SIZE}x${SIZE} source alpha mask: ${sourcePath}`);
  }
  const { data, info } = await sharp(sourcePath)
    .toColourspace('srgb')
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  if (info.channels !== 4 || info.width !== SIZE || info.height !== SIZE) {
    throw new Error(`Unexpected source shape ${info.width}x${info.height}x${info.channels} for ${sourcePath}`);
  }

  const alpha = Buffer.alloc(SIZE * SIZE);
  for (let i = 0; i < alpha.length; i += 1) {
    alpha[i] = data[i * 4 + 3];
  }
  return alpha;
}

async function writeVariant(alpha, silhouette, outputPath) {
  const pixels = Buffer.alloc(SIZE * SIZE * 4);
  for (let i = 0; i < SIZE * SIZE; i += 1) {
    const a = alpha[i];
    const offset = i * 4;
    pixels[offset] = blendChannel(a, silhouette[0], BACKGROUND[0]);
    pixels[offset + 1] = blendChannel(a, silhouette[1], BACKGROUND[1]);
    pixels[offset + 2] = blendChannel(a, silhouette[2], BACKGROUND[2]);
    pixels[offset + 3] = 255;
  }

  await sharp(pixels, { raw: { width: SIZE, height: SIZE, channels: 4 } })
    .png({ compressionLevel: 9 })
    .toFile(outputPath);
}

async function main() {
  await mkdir(assetsDir, { recursive: true });
  const alpha = await readSourceAlpha();
  const written = [];

  for (const variant of VARIANTS) {
    const outputPath = join(assetsDir, variant.file);
    await writeVariant(alpha, variant.silhouette, outputPath);
    written.push(outputPath);
  }

  for (const outputPath of written) {
    console.log(outputPath);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

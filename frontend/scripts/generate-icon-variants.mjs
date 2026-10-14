import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const frontendRoot = dirname(scriptDir);
const assetsDir = join(frontendRoot, 'assets');
const sourcePath = join(assetsDir, 'icon.png');
const androidResDir = join(frontendRoot, 'android', 'app', 'src', 'main', 'res');

const SIZE = 1024;
const BACKGROUND = [31, 10, 29];
const VARIANTS = [
  { name: 'yellow', file: 'icon-yellow.png', silhouette: [255, 138, 0] },
  { name: 'red', file: 'icon-red.png', silhouette: [255, 59, 48] },
];

const ANDROID_DENSITIES = [
  ['mdpi', 108],
  ['hdpi', 162],
  ['xhdpi', 216],
  ['xxhdpi', 324],
  ['xxxhdpi', 432],
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

async function writeAdaptiveForeground(sourceRgba, outputPath, size) {
  await sharp(sourceRgba, { raw: { width: SIZE, height: SIZE, channels: 4 } })
    .resize(size, size, { fit: 'fill' })
    .png({ compressionLevel: 9 })
    .toFile(outputPath);
}

function recolorPreservingAlpha(sourceRgba, [r, g, b]) {
  const pixels = Buffer.from(sourceRgba);
  for (let i = 0; i < pixels.length; i += 4) {
    pixels[i] = r;
    pixels[i + 1] = g;
    pixels[i + 2] = b;
  }
  return pixels;
}

function adaptiveIconXml(foregroundName) {
  return [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">',
    '    <background android:drawable="@color/iconBackground"/>',
    `    <foreground android:drawable="@mipmap/${foregroundName}"/>`,
    '</adaptive-icon>',
    '',
  ].join('\n');
}

async function writeAndroidAdaptiveIcons(sourceRgba) {
  if (!existsSync(androidResDir)) {
    console.log(`Skipping Android adaptive icons; ${androidResDir} not found (run prebuild first).`);
    return;
  }

  const anydpiDir = join(androidResDir, 'mipmap-anydpi-v26');
  await mkdir(anydpiDir, { recursive: true });

  for (const variant of VARIANTS) {
    const recolored = recolorPreservingAlpha(sourceRgba, variant.silhouette);
    const foregroundName = `ic_launcher_foreground_${variant.name}`;

    for (const [density, size] of ANDROID_DENSITIES) {
      const densityDir = join(androidResDir, `mipmap-${density}`);
      await mkdir(densityDir, { recursive: true });
      await writeAdaptiveForeground(recolored, join(densityDir, `${foregroundName}.png`), size);
    }

    await writeFile(join(anydpiDir, `${variant.name}.xml`), adaptiveIconXml(foregroundName));
  }
}

async function main() {
  await mkdir(assetsDir, { recursive: true });
  const alpha = await readSourceAlpha();
  const { data: sourceRgba } = await sharp(sourcePath)
    .toColourspace('srgb')
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const written = [];

  for (const variant of VARIANTS) {
    const outputPath = join(assetsDir, variant.file);
    await writeVariant(alpha, variant.silhouette, outputPath);
    written.push(outputPath);
  }

  await writeAndroidAdaptiveIcons(sourceRgba);

  for (const outputPath of written) {
    console.log(outputPath);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

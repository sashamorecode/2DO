import { mkdir, writeFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const frontendRoot = dirname(scriptDir);
const assetsDir = join(frontendRoot, 'assets');
const sourcePath = join(assetsDir, 'icon-source.png');
const androidResDir = join(frontendRoot, 'android', 'app', 'src', 'main', 'res');

const SIZE = 1024;
const BACKGROUND = [31, 10, 29]; // #1F0A1D
const SAFE_ZONE = Math.round((SIZE * 66) / 108); // 626px: the region every launcher mask keeps
const VARIANTS = [
  { name: 'yellow', file: 'icon-yellow.png', silhouette: [255, 138, 0] },
  { name: 'red', file: 'icon-red.png', silhouette: [255, 59, 48] },
];

const LEGACY_DENSITIES = [
  ['mdpi', 48],
  ['hdpi', 72],
  ['xhdpi', 96],
  ['xxhdpi', 144],
  ['xxxhdpi', 192],
];

const FOREGROUND_DENSITIES = [
  ['mdpi', 108],
  ['hdpi', 162],
  ['xhdpi', 216],
  ['xxhdpi', 324],
  ['xxxhdpi', 432],
];

async function readSource() {
  const metadata = await sharp(sourcePath).metadata();
  if (metadata.width !== SIZE || metadata.height !== SIZE || !metadata.hasAlpha) {
    throw new Error(`Expected a ${SIZE}x${SIZE} RGBA source logo: ${sourcePath}`);
  }

  const { data, info } = await sharp(sourcePath)
    .toColourspace('srgb')
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  if (info.channels !== 4 || info.width !== SIZE || info.height !== SIZE) {
    throw new Error(`Unexpected source shape ${info.width}x${info.height}x${info.channels}`);
  }

  let minX = SIZE;
  let minY = SIZE;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < SIZE; y += 1) {
    for (let x = 0; x < SIZE; x += 1) {
      if (data[(y * SIZE + x) * 4 + 3] <= 8) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }

  if (maxX < minX || maxY < minY) {
    throw new Error('Source logo has no visible pixels.');
  }

  return {
    data,
    bbox: { left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1 },
  };
}

async function composeSafeZone({ bbox }) {
  const scale = SAFE_ZONE / Math.max(bbox.width, bbox.height);
  const width = Math.max(1, Math.round(bbox.width * scale));
  const height = Math.max(1, Math.round(bbox.height * scale));
  const left = Math.round((SIZE - width) / 2);
  const top = Math.round((SIZE - height) / 2);

  const resized = await sharp(sourcePath)
    .extract({
      left: bbox.left,
      top: bbox.top,
      width: bbox.width,
      height: bbox.height,
    })
    .resize(width, height, { fit: 'fill' })
    .ensureAlpha()
    .raw()
    .toBuffer();

  const canvas = Buffer.alloc(SIZE * SIZE * 4, 0);
  for (let y = 0; y < height; y += 1) {
    resized.copy(canvas, ((top + y) * SIZE + left) * 4, y * width * 4, (y + 1) * width * 4);
  }

  return canvas;
}

function recolor(rgba, [r, g, b]) {
  const out = Buffer.from(rgba);
  for (let i = 0; i < SIZE * SIZE; i += 1) {
    out[i * 4] = r;
    out[i * 4 + 1] = g;
    out[i * 4 + 2] = b;
  }
  return out;
}

function flatten(rgba, background) {
  const out = Buffer.alloc(SIZE * SIZE * 4);
  for (let i = 0; i < SIZE * SIZE; i += 1) {
    const alpha = rgba[i * 4 + 3];
    out[i * 4] = Math.round((rgba[i * 4] * alpha + background[0] * (255 - alpha)) / 255);
    out[i * 4 + 1] = Math.round((rgba[i * 4 + 1] * alpha + background[1] * (255 - alpha)) / 255);
    out[i * 4 + 2] = Math.round((rgba[i * 4 + 2] * alpha + background[2] * (255 - alpha)) / 255);
    out[i * 4 + 3] = 255;
  }
  return out;
}

function bufferOf(rgba) {
  return sharp(rgba, { raw: { width: SIZE, height: SIZE, channels: 4 } });
}

async function writePng(rgba, outputPath) {
  await bufferOf(rgba).png({ compressionLevel: 9 }).toFile(outputPath);
}

async function writeResizedPng(rgba, outputPath, size) {
  await bufferOf(rgba)
    .resize(size, size, { fit: 'fill' })
    .png({ compressionLevel: 9 })
    .toFile(outputPath);
}

async function writeResizedWebp(rgba, outputPath, size) {
  await bufferOf(rgba)
    .resize(size, size, { fit: 'fill' })
    .webp({ lossless: true })
    .toFile(outputPath);
}

async function cleanSiblings(dir, baseName, keepExt) {
  for (const ext of ['png', 'webp', 'jpg', 'jpeg']) {
    if (ext === keepExt) continue;
    await rm(join(dir, `${baseName}.${ext}`), { force: true });
  }
}

async function writeAndroidBitmap(dir, baseName, ext, rgba, size, writer) {
  await mkdir(dir, { recursive: true });
  const outputPath = join(dir, `${baseName}.${ext}`);
  await writer(rgba, outputPath, size);
  await cleanSiblings(dir, baseName, ext);
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

async function main() {
  if (!existsSync(sourcePath)) {
    throw new Error(
      `Missing ${sourcePath}. Keep the transparent logo master there and re-run \`npm run icons\`.`,
    );
  }

  await mkdir(assetsDir, { recursive: true });

  const source = await readSource();
  const safeRgba = await composeSafeZone(source);

  const defaultLegacy = flatten(safeRgba, BACKGROUND);
  const defaultForeground = safeRgba;
  const notification = recolor(safeRgba, [255, 255, 255]);

  const written = [];

  const assetJobs = [
    [defaultLegacy, join(assetsDir, 'icon.png')],
    [defaultForeground, join(assetsDir, 'adaptive-icon.png')],
    [defaultForeground, join(assetsDir, 'splash-icon.png')],
    [notification, join(assetsDir, 'notification-icon.png')],
  ];

  for (const variant of VARIANTS) {
    const silhouette = recolor(safeRgba, variant.silhouette);
    assetJobs.push([flatten(silhouette, BACKGROUND), join(assetsDir, variant.file)]);
    variant.silhouetteRgba = silhouette;
  }

  for (const [rgba, outputPath] of assetJobs) {
    await writePng(rgba, outputPath);
    written.push(outputPath);
  }

  await writeResizedPng(defaultLegacy, join(assetsDir, 'favicon.png'), 48);
  written.push(join(assetsDir, 'favicon.png'));

  if (!existsSync(androidResDir)) {
    console.log(`Skipping Android mipmaps; ${androidResDir} not found (run prebuild first).`);
  } else {
    const anydpiDir = join(androidResDir, 'mipmap-anydpi-v26');
    await mkdir(anydpiDir, { recursive: true });

    for (const [density, size] of LEGACY_DENSITIES) {
      const densityDir = join(androidResDir, `mipmap-${density}`);
      await writeAndroidBitmap(densityDir, 'ic_launcher', 'webp', defaultLegacy, size, writeResizedWebp);
      await writeAndroidBitmap(densityDir, 'ic_launcher_round', 'webp', defaultLegacy, size, writeResizedWebp);
      for (const variant of VARIANTS) {
        await writeAndroidBitmap(
          densityDir,
          variant.name,
          'png',
          flatten(variant.silhouetteRgba, BACKGROUND),
          size,
          writeResizedPng,
        );
      }
    }

    for (const [density, size] of FOREGROUND_DENSITIES) {
      const densityDir = join(androidResDir, `mipmap-${density}`);
      await writeAndroidBitmap(
        densityDir,
        'ic_launcher_foreground',
        'webp',
        defaultForeground,
        size,
        writeResizedWebp,
      );
      for (const variant of VARIANTS) {
        await writeAndroidBitmap(
          densityDir,
          `ic_launcher_foreground_${variant.name}`,
          'png',
          variant.silhouetteRgba,
          size,
          writeResizedPng,
        );
      }
    }

    await writeFile(join(anydpiDir, 'ic_launcher.xml'), adaptiveIconXml('ic_launcher_foreground'));
    await writeFile(join(anydpiDir, 'ic_launcher_round.xml'), adaptiveIconXml('ic_launcher_foreground'));
    for (const variant of VARIANTS) {
      await writeFile(
        join(anydpiDir, `${variant.name}.xml`),
        adaptiveIconXml(`ic_launcher_foreground_${variant.name}`),
      );
    }
    written.push(join(androidResDir, 'mipmap-anydpi-v26'));
  }

  for (const outputPath of written) {
    console.log(outputPath);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

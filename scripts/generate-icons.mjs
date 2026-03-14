/**
 * Generates PWA PNG icons from the SVG source.
 * Requires: npm install --save-dev sharp
 * Run:      node scripts/generate-icons.mjs
 */
import sharp from "sharp";
import { readFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const srcSvg = join(__dirname, "../public/icons/icon.svg");
const outDir = join(__dirname, "../public/icons");

const sizes = [72, 96, 128, 144, 152, 192, 384, 512];

mkdirSync(outDir, { recursive: true });

for (const size of sizes) {
  await sharp(srcSvg)
    .resize(size, size)
    .png()
    .toFile(join(outDir, `icon-${size}x${size}.png`));
  console.log(`Generated icon-${size}x${size}.png`);
}

console.log("All icons generated.");

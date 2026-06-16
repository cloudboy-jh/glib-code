#!/usr/bin/env bun
/**
 * make-appx-assets.ts
 * ──────────────────────────────────────────────────────────────────────────
 * Generates all required MSIX (appx) logo assets from the master 1024×1024
 * source icon, then writes a placeholder DMG background if one doesn't exist.
 *
 * Requires: sharp  (bun add -d sharp)
 * Run:      bun run scripts/make-appx-assets.ts
 * ──────────────────────────────────────────────────────────────────────────
 */

import sharp from "sharp";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dir, "..");
const SRC = join(ROOT, "desktop", "assets", "icon.iconset", "icon_1024x1024.png");
const OUT_APPX = join(ROOT, "desktop", "assets", "appx");
const OUT_ASSETS = join(ROOT, "desktop", "assets");

mkdirSync(OUT_APPX, { recursive: true });

// ── MSIX required sizes ───────────────────────────────────────────────────
// electron-builder's appx target looks for these exact filenames.
const appxTargets: Array<{ file: string; w: number; h: number; pad?: number }> = [
  // Small square — taskbar & small Start tile
  { file: "Square44x44Logo.png",           w: 44,  h: 44,  pad: 6  },
  { file: "Square44x44Logo.scale-200.png", w: 88,  h: 88,  pad: 12 },
  // 71×71 — used by some shell surfaces
  { file: "Square71x71Logo.png",           w: 71,  h: 71,  pad: 8  },
  // Medium Start tile
  { file: "Square150x150Logo.png",          w: 150, h: 150, pad: 18 },
  { file: "Square150x150Logo.scale-200.png",w: 300, h: 300, pad: 36 },
  // Store listing
  { file: "StoreLogo.png",                 w: 50,  h: 50,  pad: 6  },
  // Large Start tile
  { file: "Square310x310Logo.png",         w: 310, h: 310, pad: 38 },
  // Wide Start tile — icon left-centered on dark bg
  { file: "Wide310x150Logo.png",           w: 310, h: 150, pad: 18 },
  // Splash screen
  { file: "SplashScreen.png",             w: 620, h: 300, pad: 60 },
];

console.log("⬛  Generating MSIX appx assets...");

for (const t of appxTargets) {
  const outPath = join(OUT_APPX, t.file);
  const iconSize = Math.min(t.w, t.h) - (t.pad ?? 0) * 2;

  await sharp(SRC)
    .resize(iconSize, iconSize, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .extend({
      top:    Math.floor((t.h - iconSize) / 2),
      bottom: Math.ceil((t.h - iconSize) / 2),
      left:   Math.floor((t.w - iconSize) / 2),
      right:  Math.ceil((t.w - iconSize) / 2),
      background: { r: 11, g: 15, b: 20, alpha: 1 }, // #0b0f14
    })
    .png()
    .toFile(outPath);

  console.log(`  ✓ ${t.file} (${t.w}×${t.h})`);
}

// ── DMG background ────────────────────────────────────────────────────────
// 660×400 dark background. If you have a designed PNG, replace this file.
// This script only generates a placeholder so the build doesn't fail.
const dmgBgPath = join(OUT_ASSETS, "dmg-background.png");
if (!existsSync(dmgBgPath)) {
  console.log("\n🍎  Generating placeholder DMG background (660×400)...");

  // Dark gradient background with a subtle logo watermark centered
  const logoSize = 120;
  const logoLeft = Math.floor((660 - logoSize) / 2);
  const logoTop  = Math.floor((400 - logoSize) / 2) - 20; // slightly above center

  const logoResized = await sharp(SRC)
    .resize(logoSize, logoSize, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  await sharp({
    create: {
      width: 660,
      height: 400,
      channels: 4,
      background: { r: 11, g: 15, b: 20, alpha: 1 },
    },
  })
    .composite([
      {
        input: logoResized,
        left: logoLeft,
        top: logoTop,
        blend: "over",
      },
    ])
    .png()
    .toFile(dmgBgPath);

  console.log(`  ✓ dmg-background.png (660×400) — placeholder, replace with designed version`);
} else {
  console.log("\n🍎  DMG background already exists — skipping.");
}

console.log("\n✅  All assets generated.");

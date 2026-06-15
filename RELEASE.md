# Release Plan

## Distribution model

GitHub Releases. Both platform artifacts are attached to a version tag. Users download directly — no auto-update, no telemetry, no app store.

---

## Targets

### Mac — DMG
- electron-builder `dmg` target
- Produces a standard `.dmg` with an Applications symlink
- User opens DMG, drags `.app` to Applications, done
- No signing, no notarization (local/internal distribution only for now)

### Windows — ZIP
- electron-builder `zip` target
- Produces a flat zip of the unpacked app directory
- User unzips anywhere, double-clicks the `.exe`
- Zero UAC, zero registry, zero wizard, no admin rights required
- No NSIS, no Squirrel

---

## Scripts

| Command | What it does |
|---|---|
| `bun run build:local` | Mac: tsc + electron-builder dir (local test, no publish) |
| `bun run build:local:win` | Windows: tsc + electron-builder dir (local test, no publish) |
| `bun run build:release` | Mac: tsc + electron-builder dmg + publish to GitHub Release |
| `bun run build:release:win` | Windows: tsc + electron-builder zip + publish to GitHub Release |

---

## electron-builder config changes needed

```json
"mac": {
  "identity": null,
  "icon": "assets/icon.iconset/icon_1024x1024.png",
  "target": [{ "target": "dmg" }]
},
"win": {
  "icon": "assets/icon.iconset/icon_256x256.png",
  "target": [{ "target": "zip" }]
},
"publish": {
  "provider": "github",
  "owner": "cloudboy-jh",
  "repo": "glib-code"
}
```

`build:local` and `build:local:win` keep `--dir` and skip publish entirely — safe to run anytime without touching GitHub.

---

## Release flow

```bash
# 1. tag the release
git tag v0.1.0
git push --tags

# 2. on Mac
bun run build:release

# 3. on Windows
bun run build:release:win
```

Both commands require `GH_TOKEN` set in the environment with `repo` scope so electron-builder can upload artifacts to the GitHub Release created by the tag.

```bash
export GH_TOKEN=ghp_...   # mac/linux
$env:GH_TOKEN="ghp_..."   # windows powershell
```

---

## What's not in scope (yet)

- Auto-update (electron-updater)
- Code signing / notarization
- Mac App Store / Microsoft Store
- DMG background image / custom window layout
- Linux builds

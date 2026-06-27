// electron-builder afterPack hook.
//
// Without a paid Apple Developer ID we can't notarize, but we CAN ad-hoc sign.
// On Apple Silicon an UNSIGNED, quarantined app fails with the misleading
// "is damaged and can't be opened" error and there is no right-click → Open
// escape hatch. A valid ad-hoc signature (codesign --sign -) turns that hard
// failure into a recoverable state so the documented `xattr` workaround works.
//
// We sign with --deep --force so every nested binary/framework inside the
// .app bundle gets a fresh signature, overriding whatever electron-builder
// produced.

const { execFileSync } = require("node:child_process");
const path = require("node:path");

exports.default = async function adhocSign(context) {
  const { electronPlatformName, appOutDir, packager } = context;

  if (electronPlatformName !== "darwin") return;

  const appName = `${packager.appInfo.productFilename}.app`;
  const appPath = path.join(appOutDir, appName);

  // If real signing credentials are present, don't clobber them — let
  // electron-builder's normal signing/notarization path run instead.
  if (process.env.CSC_LINK || process.env.CSC_NAME) {
    console.log("[adhoc-sign] real cert detected, skipping ad-hoc signing");
    return;
  }

  console.log(`[adhoc-sign] ad-hoc signing ${appPath}`);
  try {
    execFileSync(
      "codesign",
      ["--deep", "--force", "--sign", "-", "--timestamp=none", appPath],
      { stdio: "inherit" }
    );
    // Verify the signature is at least structurally valid.
    execFileSync("codesign", ["--verify", "--verbose=2", appPath], {
      stdio: "inherit",
    });
    console.log("[adhoc-sign] done");
  } catch (err) {
    console.error("[adhoc-sign] failed:", err.message);
    throw err;
  }
};

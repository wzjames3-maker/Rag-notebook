/**
 * Postinstall script: patches CSS package exports for Turbopack compatibility.
 *
 * Turbopack's enhanced-resolve does not support the "style" export condition,
 * which causes it to fail when resolving CSS-only packages like tw-animate-css
 * and shadcn/tailwind.css. This script adds a "default" fallback to their
 * exports field so Turbopack can resolve them correctly.
 *
 * See: https://github.com/vercel/next.js/issues (Turbopack + "style" condition)
 */

const fs = require("fs");
const path = require("path");

const patches = [
  {
    packageDir: "tw-animate-css",
    exportsPatch: {
      ".": {
        style: "./dist/tw-animate.css",
        default: "./dist/tw-animate.css",
      },
      "./prefix": {
        style: "./dist/tw-animate-prefix.css",
        default: "./dist/tw-animate-prefix.css",
      },
    },
  },
  {
    packageDir: "shadcn",
    exportKey: "./tailwind.css",
    exportsPatch: {
      "./tailwind.css": {
        style: "./dist/tailwind.css",
        default: "./dist/tailwind.css",
      },
    },
  },
];

for (const { packageDir, exportsPatch } of patches) {
  const pkgPath = path.join(__dirname, "..", "node_modules", packageDir, "package.json");
  if (!fs.existsSync(pkgPath)) {
    console.log(`[postinstall] Skipping ${packageDir}: package.json not found`);
    continue;
  }

  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
  let changed = false;

  for (const [key, value] of Object.entries(exportsPatch)) {
    const current = JSON.stringify(pkg.exports?.[key]);
    const patched = JSON.stringify(value);
    if (current !== patched) {
      pkg.exports[key] = value;
      changed = true;
    }
  }

  if (changed) {
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
    console.log(`[postinstall] Patched ${packageDir} exports for Turbopack compatibility`);
  } else {
    console.log(`[postinstall] ${packageDir} already patched`);
  }
}

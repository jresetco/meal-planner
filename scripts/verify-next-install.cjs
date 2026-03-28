/**
 * Fails fast when node_modules/next is incomplete (e.g. interrupted install,
 * sync tools deleting files under node_modules). Prevents cryptic MODULE_NOT_FOUND on ../server/require-hook.
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const marker = path.join(
  root,
  "node_modules",
  "next",
  "dist",
  "server",
  "require-hook.js"
);

if (!fs.existsSync(marker)) {
  console.error(
    "\n[x] Next.js install looks incomplete (missing dist/server/require-hook.js).\n" +
      "    Common causes: interrupted npm install, iCloud/sync touching node_modules, or a bad cache.\n" +
      "    Fix: rm -rf node_modules && npm install\n"
  );
  process.exit(1);
}

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

// Verify all @prisma/* packages are on the same major.minor.patch version.
// Mismatched versions cause "Module not found: query_compiler_fast_bg" at startup.
const prismaPackages = [
  { name: "prisma", dev: true },
  { name: "@prisma/client" },
  { name: "@prisma/adapter-pg" },
  { name: "@prisma/adapter-neon" },
];

const versions = {};
for (const pkg of prismaPackages) {
  const pkgJsonPath = path.join(root, "node_modules", ...pkg.name.split("/"), "package.json");
  if (fs.existsSync(pkgJsonPath)) {
    const { version } = JSON.parse(fs.readFileSync(pkgJsonPath, "utf8"));
    versions[pkg.name] = version;
  }
}

const uniqueVersions = [...new Set(Object.values(versions))];
if (uniqueVersions.length > 1) {
  console.error(
    "\n[x] Prisma version mismatch detected! All @prisma/* packages must be the same version.\n" +
      "    Installed versions:\n" +
      Object.entries(versions).map(([k, v]) => `      ${k}: ${v}`).join("\n") +
      "\n\n    Fix: npm install prisma@<VERSION> @prisma/client@<VERSION> @prisma/adapter-pg@<VERSION> @prisma/adapter-neon@<VERSION>\n" +
      "    Then: npx prisma generate\n"
  );
  process.exit(1);
}

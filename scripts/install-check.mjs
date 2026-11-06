// Install a packed tarball into a fresh project, with the peers at the
// lockfile's versions, then load it and run a query through Knex.
//
// build.yml runs this on every supported OS against the tarball that
// scripts/pack-verify.sh produced.
//
// Usage: node scripts/install-check.mjs TARBALL
import { execFileSync, execSync } from "node:child_process";
import {
  copyFileSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const [tarball] = process.argv.slice(2);
if (tarball == null) {
  console.error("usage: node scripts/install-check.mjs TARBALL");
  process.exit(2);
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const lock = JSON.parse(readFileSync(join(root, "package-lock.json"), "utf8"));
const lockedVersion = (name) => lock.packages[`node_modules/${name}`].version;

const dir = mkdtempSync(join(tmpdir(), "knex-sqlite-install-"));
try {
  // Same lifecycle-script and dependency-age policy as the repository.
  copyFileSync(join(root, ".npmrc"), join(dir, ".npmrc"));
  writeFileSync(
    join(dir, "package.json"),
    JSON.stringify({
      private: true,
      dependencies: {
        "@photostructure/knex-sqlite": `file:${resolve(tarball).replaceAll("\\", "/")}`,
        "@photostructure/sqlite": lockedVersion("@photostructure/sqlite"),
        knex: lockedVersion("knex"),
      },
    })
  );
  writeFileSync(
    join(dir, "check.cjs"),
    `const knex = require("knex");
const Client = require("@photostructure/knex-sqlite");
(async () => {
  const db = knex({
    client: Client,
    connection: { filename: ":memory:" },
    useNullAsDefault: true,
  });
  const rows = await db.raw("SELECT 1 AS v");
  await db.destroy();
  if (rows[0]?.v !== 1) {
    throw new Error("Unexpected query result: " + JSON.stringify(rows));
  }
  console.log("Loaded the packed @photostructure/knex-sqlite and ran a query");
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
`
  );
  // execSync runs through a shell, which Windows needs to start npm.cmd.
  execSync("npm install --ignore-scripts --no-audit --no-fund", {
    cwd: dir,
    stdio: "inherit",
  });
  execFileSync(process.execPath, ["check.cjs"], { cwd: dir, stdio: "inherit" });
} finally {
  rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}

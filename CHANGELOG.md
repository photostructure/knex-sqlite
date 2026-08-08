# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0](https://github.com/photostructure/knex-sqlite/releases/tag/v1.0.0) - 2026-08-08

The stable public release of the existing API, with the raised platform
requirements below.

### Breaking

- Dropped Node.js 20, which reached end of life in April 2026. The minimum is
  now Node.js 22.
- Raised the `@photostructure/sqlite` peer floor to 2.0.0. Releases before that
  finalize prepared statements when the garbage collector reaches them rather
  than when the database closes, so `sqlite3_close()` reports `SQLITE_BUSY` and
  falls back to the deferred `sqlite3_close_v2()`. The OS file handle then
  outlives `knex.destroy()`, which on Windows leaves the database file
  undeletable.

### Changed

- Replaced direct npm publishing with signed, exact-tag staged releases that
  require maintainer 2FA approval.
- Added 14-day dependency and GitHub Action cooldowns.
- Tests write their database to a per-run temp directory instead of the
  repository root, and deleting it now doubles as a check that `destroy()`
  really closed the connection.

## [0.1.1](https://github.com/photostructure/knex-sqlite/releases/tag/v0.1.1) - 2026-02-09

- Added index.d.ts for TypeScript support

## [0.1.0](https://github.com/photostructure/knex-sqlite/releases/tag/v0.1.0) - 2026-02-09

- Initial release
- Knex.js dialect extending `Client_BetterSQLite3` to use `@photostructure/sqlite`
- `.reader` property shim via `stmt.columns().length > 0` (handles `RETURNING` clauses)
- Binding format adaptation (variadic args instead of array)
- `setReadBigInts()` / `safeIntegers()` bridging
- CI workflow testing Node.js 20/22/24/25 on Linux/macOS/Windows
- OIDC-based npm publishing via workflow dispatch

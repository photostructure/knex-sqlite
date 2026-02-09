# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-02-09

### Added

- Initial release
- Knex.js dialect extending `Client_BetterSQLite3` to use `@photostructure/sqlite`
- `.reader` property shim via `stmt.columns().length > 0` (handles `RETURNING` clauses)
- Binding format adaptation (variadic args instead of array)
- `setReadBigInts()` / `safeIntegers()` bridging
- CI workflow testing Node.js 20/22/24/25 on Linux/macOS/Windows
- OIDC-based npm publishing via workflow dispatch

[0.1.0]: https://github.com/photostructure/knex-sqlite/releases/tag/v0.1.0

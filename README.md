# @photostructure/knex-sqlite

[![npm version](https://img.shields.io/npm/v/@photostructure/knex-sqlite.svg)](https://www.npmjs.com/package/@photostructure/knex-sqlite)
[![CI](https://github.com/photostructure/knex-sqlite/actions/workflows/build.yml/badge.svg)](https://github.com/photostructure/knex-sqlite/actions/workflows/build.yml)

[Knex.js](https://knexjs.org/) dialect for
[@photostructure/sqlite](https://github.com/photostructure/node-sqlite).

Uses `@photostructure/sqlite` as the SQLite driver instead of `better-sqlite3`
or `sqlite3` -- no Python, no build tools, just pre-built binaries that work out
of the box.

## Installation

```bash
npm install @photostructure/knex-sqlite @photostructure/sqlite knex
```

## Usage

```javascript
const knex = require("knex");
const Client = require("@photostructure/knex-sqlite");

const db = knex({
  client: Client,
  connection: {
    filename: "./mydb.sqlite",
  },
  useNullAsDefault: true,
});
```

### Connection options

```javascript
const db = knex({
  client: Client,
  connection: {
    filename: "./mydb.sqlite",
    options: {
      readonly: false, // open as read-only
      safeIntegers: false, // return BigInt for large integers
    },
  },
  useNullAsDefault: true,
});
```

### All Knex features work

```javascript
// Schema
await db.schema.createTable("users", (table) => {
  table.increments("id");
  table.string("name");
  table.integer("age");
});

// Queries
const users = await db("users").select("*");
await db("users").insert({ name: "Alice", age: 30 });
await db("users").where("age", ">", 25).update({ active: true });

// Transactions
await db.transaction(async (trx) => {
  await trx("users").insert({ name: "Bob", age: 25 });
  await trx("posts").insert({ user_id: 1, title: "Hello" });
});

// Joins
const results = await db("users")
  .join("posts", "users.id", "posts.user_id")
  .select("users.name", "posts.title");

// Raw queries
const stats = await db.raw("SELECT COUNT(*) as count FROM users");
```

## How it works

This package extends Knex's built-in `Client_BetterSQLite3` class and adapts
three things:

1. **Driver**: loads `@photostructure/sqlite` and calls `enhance()` to add
   better-sqlite3-style convenience methods (`.pragma()`, `.transaction()`,
   `.pluck()`, `.raw()`, `.expand()`)

2. **The `.reader` property**: better-sqlite3 exposes `.reader` on prepared
   statements so Knex knows whether to call `.all()` (SELECT) or `.run()`
   (INSERT/UPDATE/DELETE). Since `@photostructure/sqlite` doesn't provide this,
   the dialect adds it via `stmt.columns().length > 0`, which correctly handles
   `RETURNING` clauses too.

3. **Binding format and BigInt**: better-sqlite3 takes bindings as a single
   array; `@photostructure/sqlite` takes variadic arguments. And
   `safeIntegers()` becomes `setReadBigInts()`.

| better-sqlite3              | @photostructure/sqlite       |
| --------------------------- | ---------------------------- |
| `statement.safeIntegers()`  | `statement.setReadBigInts()` |
| `statement.all(bindings)`   | `statement.all(...bindings)` |
| `statement.run(bindings)`   | `statement.run(...bindings)` |

## Requirements

- Node.js >= 20.0.0
- `knex` >= 3.0.0
- `@photostructure/sqlite` >= 0.5.0

## License

MIT

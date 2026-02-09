const { describe, test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { unlink } = require("node:fs/promises");
const { existsSync } = require("node:fs");
const knex = require("knex");
const Client_PhotoStructureSQLite = require("./index");

const dbPath = "./test.db";

async function cleanup() {
  if (!existsSync(dbPath)) return;

  // Retry logic for Windows file locking issues
  const maxRetries = 5;
  for (let i = 0; i < maxRetries; i++) {
    try {
      await unlink(dbPath);
      return;
    } catch (err) {
      if (err.code === 'EBUSY' && i < maxRetries - 1) {
        // Wait before retry, with exponential backoff
        await new Promise(resolve => setTimeout(resolve, 50 * Math.pow(2, i)));
        continue;
      }
      throw err;
    }
  }
}

describe("@photostructure/knex-sqlite", () => {
  let db;

  before(async () => {
    await cleanup();
    db = knex({
      client: Client_PhotoStructureSQLite,
      connection: { filename: dbPath },
      useNullAsDefault: true,
      debug: false,
    });
  });

  after(async () => {
    await db.destroy();
    // Small delay to ensure database file is fully released on Windows
    await new Promise(resolve => setTimeout(resolve, 100));
    await cleanup();
  });

  describe("Schema & CRUD", () => {
    test("create table", async () => {
      await db.schema.dropTableIfExists("users");
      await db.schema.createTable("users", (table) => {
        table.increments("id").primary();
        table.string("name").notNullable();
        table.string("email").unique();
        table.integer("age");
        table.timestamps(true, true);
      });
      const hasUsers = await db.schema.hasTable("users");
      assert.equal(hasUsers, true);
    });

    test("insert single row", async () => {
      const [id] = await db("users").insert({
        name: "Alice",
        email: "alice@example.com",
        age: 30,
      });
      assert.equal(id, 1);
    });

    test("insert another row", async () => {
      const [id] = await db("users").insert({
        name: "Bob",
        email: "bob@example.com",
        age: 25,
      });
      assert.equal(id, 2);
    });

    test("batch insert", async () => {
      await db("users").insert([
        { name: "Charlie", email: "charlie@example.com", age: 35 },
        { name: "Diana", email: "diana@example.com", age: 28 },
      ]);
      const count = await db("users").count("* as count").first();
      assert.equal(count.count, 4);
    });

    test("select all", async () => {
      const users = await db("users").select("*");
      assert.equal(users.length, 4);
      assert.equal(users[0].name, "Alice");
    });

    test("select with where", async () => {
      const young = await db("users")
        .where("age", "<", 30)
        .select("name", "age");
      assert.equal(young.length, 2);
      const names = young.map((u) => u.name).sort();
      assert.deepEqual(names, ["Bob", "Diana"]);
    });

    test("first()", async () => {
      const alice = await db("users").where("name", "Alice").first();
      assert.equal(alice.name, "Alice");
      assert.equal(alice.age, 30);
    });

    test("update", async () => {
      const count = await db("users")
        .where("name", "Alice")
        .update({ age: 31 });
      assert.equal(count, 1);
      const alice = await db("users").where("name", "Alice").first();
      assert.equal(alice.age, 31);
    });

    test("delete", async () => {
      await db("users").insert({
        name: "Temp",
        email: "temp@example.com",
        age: 99,
      });
      const count = await db("users").where("name", "Temp").del();
      assert.equal(count, 1);
    });
  });

  describe("Joins", () => {
    test("join across tables", async () => {
      await db.schema.dropTableIfExists("posts");
      await db.schema.createTable("posts", (table) => {
        table.increments("id").primary();
        table.integer("user_id").notNullable();
        table.string("title").notNullable();
        table.text("content");
        table.foreign("user_id").references("users.id");
      });

      await db("posts").insert([
        { user_id: 1, title: "First Post", content: "Hello World" },
        { user_id: 1, title: "Second Post", content: "Another post" },
        { user_id: 2, title: "Bob's Post", content: "Bob says hi" },
      ]);

      const rows = await db("users")
        .join("posts", "users.id", "posts.user_id")
        .select("users.name", "posts.title")
        .orderBy("posts.title");

      assert.equal(rows.length, 3);
      assert.equal(rows[0].title, "Bob's Post");
      assert.equal(rows[0].name, "Bob");
    });
  });

  describe("Transactions", () => {
    test("successful transaction", async () => {
      const countBefore = (await db("users").count("* as count").first()).count;
      await db.transaction(async (trx) => {
        await trx("users").insert({
          name: "Eve",
          email: "eve@example.com",
          age: 22,
        });
        await trx("users").where("name", "Bob").update({ age: 26 });
      });
      const countAfter = (await db("users").count("* as count").first()).count;
      assert.equal(countAfter, countBefore + 1);
      const bob = await db("users").where("name", "Bob").first();
      assert.equal(bob.age, 26);
    });

    test("rolled-back transaction", async () => {
      const countBefore = (await db("users").count("* as count").first()).count;
      try {
        await db.transaction(async (trx) => {
          await trx("users").insert({
            name: "Frank",
            email: "frank@example.com",
            age: 40,
          });
          // Duplicate email triggers unique constraint violation
          await trx("users").insert({
            name: "Fake",
            email: "alice@example.com",
            age: 50,
          });
        });
        assert.fail("Transaction should have thrown");
      } catch (err) {
        // Expected
      }
      const countAfter = (await db("users").count("* as count").first()).count;
      assert.equal(countAfter, countBefore, "rollback should restore count");
    });
  });

  describe("Aggregations", () => {
    test("aggregate functions", async () => {
      const stats = await db("users")
        .select(
          db.raw("COUNT(*) as total"),
          db.raw("AVG(age) as avg_age"),
          db.raw("MIN(age) as min_age"),
          db.raw("MAX(age) as max_age")
        )
        .first();
      assert.equal(typeof stats.total, "number");
      assert.ok(stats.total > 0);
      assert.ok(stats.min_age <= stats.max_age);
    });
  });

  describe("Raw queries", () => {
    test("raw select with bindings", async () => {
      const rows = await db.raw(
        "SELECT name, age FROM users WHERE age > ? ORDER BY age DESC",
        [25]
      );
      assert.ok(Array.isArray(rows));
      assert.ok(rows.length > 0);
      assert.ok(rows[0].age > 25);
    });

    test("raw select with no bindings", async () => {
      const rows = await db.raw("SELECT 1 as val");
      assert.equal(rows.length, 1);
      assert.equal(rows[0].val, 1);
    });
  });

  describe("RETURNING clause", () => {
    test("insert with returning", async () => {
      const rows = await db("users")
        .insert({ name: "Returning1", email: "ret1@example.com", age: 40 })
        .returning(["id", "name"]);
      assert.ok(Array.isArray(rows));
      assert.equal(rows.length, 1);
      assert.equal(rows[0].name, "Returning1");
      assert.equal(typeof rows[0].id, "number");
    });

    test("update with returning", async () => {
      const rows = await db("users")
        .where("name", "Returning1")
        .update({ age: 41 })
        .returning(["id", "name", "age"]);
      assert.ok(Array.isArray(rows));
      assert.equal(rows.length, 1);
      assert.equal(rows[0].age, 41);
      assert.equal(rows[0].name, "Returning1");
    });

    test("delete with returning (knex limitation: returns change count)", async () => {
      // NOTE: knex's SQLite dialect does not append RETURNING to DELETE SQL,
      // so del().returning() returns the change count, not rows.
      const result = await db("users").where("name", "Returning1").del();
      assert.equal(result, 1);
      const check = await db("users").where("name", "Returning1").first();
      assert.equal(check, undefined);
    });
  });

  describe("PRAGMA", () => {
    test("pragma via raw query", async () => {
      const rows = await db.raw("PRAGMA table_info(users)");
      assert.ok(Array.isArray(rows));
      assert.ok(rows.length > 0);
      const nameCol = rows.find((r) => r.name === "name");
      assert.ok(nameCol, "should find the name column");
    });
  });

  describe("Error handling", () => {
    test("malformed SQL throws", async () => {
      await assert.rejects(
        () => db.raw("SELEC broken syntax"),
        /near "SELEC"/
      );
    });

    test("unique constraint violation throws", async () => {
      await assert.rejects(
        () =>
          db("users").insert({
            name: "Dup",
            email: "alice@example.com",
            age: 1,
          }),
        /UNIQUE constraint failed/
      );
    });
  });
});

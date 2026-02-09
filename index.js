/**
 * @module @photostructure/knex-sqlite
 *
 * Knex.js dialect for @photostructure/sqlite. Extends the built-in
 * better-sqlite3 client, adapting the connection and query layer to use
 * @photostructure/sqlite's DatabaseSync driver.
 *
 * @see https://github.com/photostructure/knex-sqlite
 * @see https://github.com/photostructure/node-sqlite
 * @license MIT
 */

const Client_BetterSQLite3 = require('knex/lib/dialects/better-sqlite3');

class Client_PhotoStructureSQLite extends Client_BetterSQLite3 {
  _driver() {
    // Load @photostructure/sqlite instead of better-sqlite3
    return require('@photostructure/sqlite');
  }

  async acquireRawConnection() {
    const driver = this.driver;
    const options = this.connectionSettings.options || {};

    // Create the database connection with @photostructure/sqlite
    const db = new driver.DatabaseSync(
      this.connectionSettings.filename,
      {
        readonly: !!options.readonly,
        readBigInts: !!options.safeIntegers,
      }
    );

    // Enhance the database with better-sqlite3-style methods
    // (adds .pragma(), .transaction(), .pluck(), .raw(), .expand())
    const enhancedDb = driver.enhance(db);

    // Wrap prepare() to add the .reader property that better-sqlite3 provides.
    // Knex uses .reader to decide between .all() (for SELECTs) and .run()
    // (for INSERT/UPDATE/DELETE). We use stmt.columns().length > 0 which
    // matches better-sqlite3's native behavior (sqlite3_column_count >= 1)
    // and correctly handles RETURNING clauses.
    const originalPrepare = enhancedDb.prepare.bind(enhancedDb);
    enhancedDb.prepare = (sql, prepareOptions) => {
      const stmt = originalPrepare(sql, prepareOptions);

      Object.defineProperty(stmt, 'reader', {
        value: stmt.columns().length > 0,
        enumerable: true,
        configurable: true,
        writable: false
      });

      return stmt;
    };

    return enhancedDb;
  }

  // Override _query to handle the difference between better-sqlite3's safeIntegers()
  // and @photostructure/sqlite's setReadBigInts()
  async _query(connection, obj) {
    if (!obj.sql) throw new Error('The query is empty');

    if (!connection) {
      throw new Error('No connection provided');
    }

    const statement = connection.prepare(obj.sql);

    const safeIntegers = this._optSafeIntegers(obj.options);
    if (safeIntegers !== undefined) {
      // @photostructure/sqlite uses setReadBigInts() instead of safeIntegers()
      if (typeof statement.setReadBigInts === 'function') {
        statement.setReadBigInts(safeIntegers);
      } else if (typeof statement.safeIntegers === 'function') {
        // Fallback for better-sqlite3 compatibility
        statement.safeIntegers(safeIntegers);
      }
    }

    const bindings = this._formatBindings(obj.bindings);

    if (statement.reader) {
      // @photostructure/sqlite expects variadic arguments, not an array
      const response = await statement.all(...bindings);
      obj.response = response;
      return obj;
    }

    // @photostructure/sqlite expects variadic arguments, not an array
    const response = await statement.run(...bindings);
    obj.response = response;
    obj.context = {
      lastID: response.lastInsertRowid,
      changes: response.changes,
    };

    return obj;
  }

  _optSafeIntegers(options) {
    if (
      options &&
      typeof options === 'object' &&
      typeof options.safeIntegers === 'boolean'
    ) {
      return options.safeIntegers;
    }
    return undefined;
  }
}

Object.assign(Client_PhotoStructureSQLite.prototype, {
  driverName: '@photostructure/sqlite',
});

module.exports = Client_PhotoStructureSQLite;

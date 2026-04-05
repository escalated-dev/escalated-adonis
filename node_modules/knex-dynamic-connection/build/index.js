"use strict";
/*
 * knex-dynamic-connection
 *
 * (c) Harminder Virk <virk@adonisjs.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.patchKnex = void 0;
const helpers_1 = require("knex/lib/util/helpers");
/**
 * Dialects with their `acquireRawConnection` implementation
 */
const dialects = {
    mssql: 'mssql',
    mysql: 'mysql',
    mysql2: 'mysql',
    oracledb: 'oracledb',
    postgres: 'pg',
    pgnative: 'pg',
    redshift: 'pg',
};
/**
 * Patches the knex client so that it makes use of a resolver function to
 * resolve the config before making a SQL query.
 */
function patchKnex(knex, configFn) {
    const client = knex.client;
    const clientName = (0, helpers_1.resolveClientNameWithAliases)(client.config.client);
    /**
     * Do not patch for sqlite3 or unknown clients registers as classes
     */
    if (typeof clientName !== 'string' || ['sqlite3', 'better-sqlite3'].includes(clientName)) {
        return;
    }
    /**
     * Do not patch for oracle. The dialect is dead in the knex code as
     * well.
     * https://github.com/knex/knex/blob/master/lib/dialects/oracle/DEAD_CODE.md
     */
    if (clientName === 'oracle') {
        return;
    }
    /**
     * This function is the exact copy of acquire connection from the knex code
     * base, with just handful of following changes.
     *
     * 1. Uses `client.getRuntimeConnectionSettings` vs `client.connectionSettings`
     *    to get a new connection host for read replicas.
     */
    client.acquireRawConnection = require(`./src/dialects/${dialects[clientName]}`).acquireRawConnection;
    /**
     * Returns a dynamic connection to be used for each query
     */
    client.getRuntimeConnectionSettings =
        function getRuntimeConnectionSettings() {
            return configFn(this.config);
        };
}
exports.patchKnex = patchKnex;

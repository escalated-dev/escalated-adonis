/*
 * @adonisjs/lucid
 *
 * (c) Harminder Virk <virk@adonisjs.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */
export class OracleDialect {
    client;
    name = 'oracledb';
    supportsAdvisoryLocks = false;
    supportsViews = false;
    supportsTypes = false;
    supportsDomains = false;
    supportsReturningStatement = true;
    /**
     * Reference to the database version. Knex.js fetches the version after
     * the first database query, so it will be set to undefined initially
     */
    version;
    /**
     * The default format for datetime column. The date formats is
     * valid for luxon date parsing library
     */
    dateTimeFormat = 'yyyy-MM-dd HH:mm:ss';
    constructor(client) {
        this.client = client;
        this.version = this.client.getReadClient()['context']['client'].version;
    }
    /**
     * Not implemented yet
     */
    async getAllTables() {
        throw new Error('"getAllTables" method is not implemented for oracledb. Create a PR to add the feature');
    }
    /**
     * Truncate pg table with option to cascade and restart identity
     */
    async truncate(table, cascade = false) {
        return cascade
            ? this.client.rawQuery(`TRUNCATE ${table} CASCADE;`)
            : this.client.rawQuery(`TRUNCATE ${table};`);
    }
    /**
     * Not implemented yet
     */
    async dropAllTables() {
        throw new Error('"dropAllTables" method is not implemented for oracledb. Create a PR to add the feature');
    }
    async getAllViews() {
        throw new Error('"getAllViews" method is not implemented for oracledb. Create a PR to add the feature.');
    }
    async getAllTypes() {
        throw new Error('"getAllTypes" method is not implemented for oracledb. Create a PR to add the feature.');
    }
    async getAllDomains() {
        throw new Error('"getAllDomains" method is not implemented for oracledb. Create a PR to add the feature.');
    }
    async dropAllViews() {
        throw new Error('"dropAllViews" method is not implemented for oracledb. Create a PR to add the feature.');
    }
    async dropAllTypes() {
        throw new Error('"dropAllTypes" method is not implemented for oracledb. Create a PR to add the feature.');
    }
    async dropAllDomains() {
        throw new Error('"dropAllDomains" method is not implemented for oracledb. Create a PR to add the feature.');
    }
    getAdvisoryLock() {
        throw new Error('Support for advisory locks is not implemented for oracledb. Create a PR to add the feature');
    }
    releaseAdvisoryLock() {
        throw new Error('Support for advisory locks is not implemented for oracledb. Create a PR to add the feature');
    }
}

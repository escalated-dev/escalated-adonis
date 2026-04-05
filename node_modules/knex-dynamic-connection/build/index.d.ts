/**
 * ------------------------------------------------------------------
 * Source of truth
 * ------------------------------------------------------------------
 *
 * Since, we are patching a part of the knex codebase, let's keep this
 * block as a source of truth around what is happening
 *
 * Last modified: 25th Feb, 2021
 *
 * The MYSQL2 dialect of knex instead the MYSQL dialect. Therefore the patch
 * function for both the dialects is same. ('./src/dialects/mysql.ts')
 * https://github.com/knex/knex/blob/master/lib/dialects/mysql2/index.js
 *
 * MSSQL needs a little more changes. 99% code is still a copy/paste. It's
 * just we have to copy/paste more code.
 *
 * PostgreSQL is simple and just requires one line of change. Redshit extends
 * PostgreSQL, so the patch function for both is same
 *
 * SQLITE doesn't have a concept of read/write replicas
 *
 * OracleDB is a beast. We have literally copy a lot of code. The good thing is,
 * we still have one line of code change. Rest is just a copy/paste
 */
import { Knex } from 'knex';
/**
 * Patches the knex client so that it makes use of a resolver function to
 * resolve the config before making a SQL query.
 */
export declare function patchKnex(knex: Knex, configFn: (config: Knex.Config) => Knex.ConnectionConfig): void;

import { Knex } from 'knex';
import { RawBuilderContract } from '../../types/querybuilder.js';
/**
 * Exposes the API to construct raw queries. If you want to execute
 * raw queries, you can use the RawQueryBuilder
 */
export declare class RawBuilder implements RawBuilderContract {
    private sql;
    private bindings?;
    private wrapBefore?;
    private wrapAfter?;
    constructor(sql: string, bindings?: any | undefined);
    /**
     * Wrap the query with before/after strings.
     */
    wrap(before: string, after: string): this;
    /**
     * Converts the raw query to knex raw query instance
     */
    toKnex(client: Knex.Client): Knex.Raw;
}

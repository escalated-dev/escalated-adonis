import { Knex } from 'knex';
import { ReferenceBuilderContract } from '../../types/querybuilder.js';
/**
 * Reference builder to create SQL reference values
 */
export declare class ReferenceBuilder implements ReferenceBuilderContract {
    private ref;
    private client;
    private schema?;
    private alias?;
    constructor(ref: string, client: Knex.Client);
    /**
     * Define schema
     */
    withSchema(schema: string): this;
    /**
     * Define alias
     */
    as(alias: string): this;
    /**
     * Converts reference to knex
     */
    toKnex(client?: Knex.Client): Knex.Ref<any, any>;
}

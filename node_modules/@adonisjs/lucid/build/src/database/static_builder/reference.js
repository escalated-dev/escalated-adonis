/*
 * @adonisjs/lucid
 *
 * (c) Harminder Virk <virk@adonisjs.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */
/**
 * Reference builder to create SQL reference values
 */
export class ReferenceBuilder {
    ref;
    client;
    schema;
    alias;
    constructor(ref, client) {
        this.ref = ref;
        this.client = client;
    }
    /**
     * Define schema
     */
    withSchema(schema) {
        this.schema = schema;
        return this;
    }
    /**
     * Define alias
     */
    as(alias) {
        this.alias = alias;
        return this;
    }
    /**
     * Converts reference to knex
     */
    toKnex(client) {
        const ref = (client || this.client).ref(this.ref);
        this.schema && ref.withSchema(this.schema);
        this.alias && ref.as(this.alias);
        return ref;
    }
}

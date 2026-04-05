/*
 * @adonisjs/lucid
 *
 * (c) Harminder Virk <virk@adonisjs.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */
/**
 * Base relation to be extended by other factory relations
 */
export class BaseRelation {
    factory;
    ctx;
    attributes = {};
    constructor(factory) {
        this.factory = factory;
    }
    /**
     * Instantiates the relationship factory
     */
    compile(relation, parent, callback) {
        this.parent = parent;
        const builder = this.factory().query(undefined, relation);
        if (typeof callback === 'function') {
            callback(builder);
        }
        if (this.ctx) {
            builder.useCtx(this.ctx);
        }
        builder.mergeRecursive(this.attributes);
        return builder;
    }
    /**
     * Merge attributes with the relationship and its children
     */
    merge(attributes) {
        this.attributes = attributes;
        return this;
    }
    /**
     * Use custom ctx. This must always be called by the factory, otherwise
     * `make` and `create` calls will fail.
     */
    useCtx(ctx) {
        this.ctx = ctx;
        return this;
    }
}

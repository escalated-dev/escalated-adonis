/*
 * @adonisjs/lucid
 *
 * (c) Harminder Virk <virk@adonisjs.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */
import { BaseRelation } from './base.js';
/**
 * Has one to factory relation
 */
export class HasOne extends BaseRelation {
    relation;
    constructor(relation, factory) {
        super(factory);
        this.relation = relation;
        this.relation.boot();
    }
    /**
     * Make relationship and set it on the parent model instance
     */
    async make(parent, callback) {
        const factory = this.compile(this, parent, callback);
        const customAttributes = {};
        this.relation.hydrateForPersistance(parent, customAttributes);
        const instance = await factory.tap((related) => related.merge(customAttributes)).makeStubbed();
        parent.$setRelated(this.relation.relationName, instance);
    }
    /**
     * Persist relationship and set it on the parent model instance
     */
    async create(parent, callback) {
        const factory = this.compile(this, parent, callback);
        const customAttributes = {};
        this.relation.hydrateForPersistance(parent, customAttributes);
        const instance = await factory.tap((related) => related.merge(customAttributes)).create();
        parent.$setRelated(this.relation.relationName, instance);
    }
}

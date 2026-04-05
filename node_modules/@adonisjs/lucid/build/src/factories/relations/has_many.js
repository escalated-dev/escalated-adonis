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
 * Has many to factory relation
 */
export class HasMany extends BaseRelation {
    relation;
    constructor(relation, factory) {
        super(factory);
        this.relation = relation;
        this.relation.boot();
    }
    /**
     * Make relationship and set it on the parent model instance
     */
    async make(parent, callback, count) {
        const factory = this.compile(this, parent, callback);
        const customAttributes = {};
        this.relation.hydrateForPersistance(parent, customAttributes);
        const instances = await factory
            .tap((related) => {
            related.merge(customAttributes);
        })
            .makeStubbedMany(count || 1);
        parent.$pushRelated(this.relation.relationName, instances);
    }
    /**
     * Persist relationship and set it on the parent model instance
     */
    async create(parent, callback, count) {
        const factory = this.compile(this, parent, callback);
        const customAttributes = {};
        this.relation.hydrateForPersistance(parent, customAttributes);
        const instance = await factory
            .tap((related) => {
            related.merge(customAttributes);
        })
            .createMany(count || 1);
        parent.$pushRelated(this.relation.relationName, instance);
    }
}

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
 * A belongs to factory relation
 */
export class BelongsTo extends BaseRelation {
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
        const related = await factory.makeStubbed();
        this.relation.hydrateForPersistance(parent, related);
        parent.$setRelated(this.relation.relationName, related);
    }
    /**
     * Persist relationship and set it on the parent model instance
     */
    async create(parent, callback) {
        const factory = this.compile(this, parent, callback);
        const related = await factory.create();
        this.relation.hydrateForPersistance(parent, related);
        parent.$setRelated(this.relation.relationName, related);
    }
}

import { HooksDecorator, ColumnDecorator, ComputedDecorator, DateColumnDecorator, DateTimeColumnDecorator } from '../../types/model.js';
import { HasOneDecorator, HasManyDecorator, BelongsToDecorator, ManyToManyDecorator, HasManyThroughDecorator } from '../../types/relations.js';
/**
 * Define property on a model as a column. The decorator needs a
 * proper model class inheriting the base model
 */
export declare const column: ColumnDecorator & {
    date: DateColumnDecorator;
    dateTime: DateTimeColumnDecorator;
};
/**
 * Define computed property on a model. The decorator needs a
 * proper model class inheriting the base model
 */
export declare const computed: ComputedDecorator;
/**
 * Define belongsTo relationship
 */
export declare const belongsTo: BelongsToDecorator;
/**
 * Define hasOne relationship
 */
export declare const hasOne: HasOneDecorator;
/**
 * Define hasMany relationship
 */
export declare const hasMany: HasManyDecorator;
/**
 * Define manyToMany relationship
 */
export declare const manyToMany: ManyToManyDecorator;
/**
 * Define hasManyThrough relationship
 */
export declare const hasManyThrough: HasManyThroughDecorator;
/**
 * Before/After save hook
 */
export declare const beforeSave: HooksDecorator;
export declare const afterSave: HooksDecorator;
/**
 * Before/After create hook
 */
export declare const beforeCreate: HooksDecorator;
export declare const afterCreate: HooksDecorator;
/**
 * Before/After update hook
 */
export declare const beforeUpdate: HooksDecorator;
export declare const afterUpdate: HooksDecorator;
/**
 * Before/After delete hook
 */
export declare const beforeDelete: HooksDecorator;
export declare const afterDelete: HooksDecorator;
/**
 * Before/After find hook
 */
export declare const beforeFind: HooksDecorator;
export declare const afterFind: HooksDecorator;
/**
 * Before/After fetchs hook
 */
export declare const beforeFetch: HooksDecorator;
export declare const afterFetch: HooksDecorator;
/**
 * Before/After paginate hook
 */
export declare const beforePaginate: HooksDecorator;
export declare const afterPaginate: HooksDecorator;

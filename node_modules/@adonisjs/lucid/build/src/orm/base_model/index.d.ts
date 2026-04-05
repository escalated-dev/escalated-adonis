import { LucidModel, QueryScopeCallback, QueryScope } from '../../types/model.js';
export declare const BaseModel: LucidModel;
/**
 * Helper to mark a function as query scope
 */
export declare function scope<Model extends LucidModel, Callback extends QueryScopeCallback<Model>>(callback: Callback): QueryScope<Model, Callback>;

import { ModelPaginatorContract, CherryPick } from '../../types/model.js';
import { SimplePaginator } from '../../database/paginator/simple_paginator.js';
/**
 * Model paginator extends the simple paginator and adds support for
 * serializing models as well
 */
export declare class ModelPaginator extends SimplePaginator implements ModelPaginatorContract<any> {
    /**
     * Serialize models
     */
    serialize(cherryPick?: CherryPick): {
        meta: any;
        data: any[];
    };
}

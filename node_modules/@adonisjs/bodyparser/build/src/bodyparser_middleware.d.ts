import type { HttpContext } from '@adonisjs/http-server';
import type { NextFn } from '@adonisjs/http-server/types';
import type { FeatureFlags } from '@adonisjs/application';
import type { ExperimentalFlagsList } from '@adonisjs/application/types';
import type { BodyParserConfig } from './types.js';
/**
 * Bindings to extend request
 */
import './bindings/request.js';
/**
 * BodyParser middleware parses the incoming request body and set it as
 * request body to be read later in the request lifecycle.
 */
export declare class BodyParserMiddleware {
    #private;
    constructor(config: BodyParserConfig, featureFlags?: FeatureFlags<ExperimentalFlagsList>);
    /**
     * Handle HTTP request body by parsing it as per the user
     * config
     */
    handle(ctx: HttpContext, next: NextFn): Promise<any>;
}

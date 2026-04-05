import type { FeatureFlags } from '@adonisjs/application';
import type { ExperimentalFlagsList } from '@adonisjs/application/types';
import { BodyParserMiddleware } from '../src/bodyparser_middleware.js';
import type { BodyParserOptionalConfig } from '../src/types.js';
/**
 * Factory to create bodyparser middleware instance
 */
export declare class BodyParserMiddlewareFactory {
    #private;
    merge(config: BodyParserOptionalConfig): this;
    /**
     * Specify the feature flags to share with the bodyparser
     */
    withFeatureFlags(featureFlags: FeatureFlags<ExperimentalFlagsList>): this;
    create(): BodyParserMiddleware;
}

import { BodyParserConfig, BodyParserOptionalConfig } from './types.js';
/**
 * Define config for the bodyparser middleware. Your defined config will be
 * merged with the default config
 */
export declare function defineConfig(config: BodyParserOptionalConfig): BodyParserConfig;

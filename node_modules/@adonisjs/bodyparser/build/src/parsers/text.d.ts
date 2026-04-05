import type { IncomingMessage } from 'node:http';
import { BodyParserRawConfig } from '../types.js';
/**
 * Inflates request body
 */
export declare function parseText(req: IncomingMessage, options: Partial<BodyParserRawConfig>): Promise<string>;

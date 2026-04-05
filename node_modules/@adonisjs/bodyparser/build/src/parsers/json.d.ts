import type { IncomingMessage } from 'node:http';
import { BodyParserJSONConfig } from '../types.js';
/**
 * Parses JSON request body
 */
export declare function parseJSON(req: IncomingMessage, options: Partial<BodyParserJSONConfig>): Promise<{
    parsed: any;
    raw: string;
}>;

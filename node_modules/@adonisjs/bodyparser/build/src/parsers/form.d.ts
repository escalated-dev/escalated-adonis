import type { IncomingMessage } from 'node:http';
import { BodyParserFormConfig } from '../types.js';
/**
 * Parse x-www-form-urlencoded request body
 */
export declare function parseForm(req: IncomingMessage, options: Partial<BodyParserFormConfig>): Promise<{
    parsed: {
        [key: string]: unknown;
    };
    raw: string;
}>;

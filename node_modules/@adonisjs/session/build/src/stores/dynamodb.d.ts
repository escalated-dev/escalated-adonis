/**
 * @adonisjs/session
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import type { SessionStoreContract, SessionData } from '../types.js';
/**
 * DynamoDB store to read/write session to DynamoDB
 */
export declare class DynamoDBStore implements SessionStoreContract {
    #private;
    constructor(client: DynamoDBClient, age: string | number, options?: {
        /**
         * Defaults to "Session"
         */
        tableName?: string;
        /**
         * Defaults to "key"
         */
        keyAttribute?: string;
    });
    /**
     * Returns session data. A new item will be created if it's
     * missing.
     */
    read(sessionId: string): Promise<SessionData | null>;
    /**
     * Write session values to DynamoDB
     */
    write(sessionId: string, values: Object): Promise<void>;
    /**
     * Cleanup session item by removing it
     */
    destroy(sessionId: string): Promise<void>;
    /**
     * Updates the value expiry
     */
    touch(sessionId: string): Promise<void>;
}

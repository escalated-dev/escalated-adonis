/**
 * @adonisjs/session
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */
import type { FileStoreConfig, SessionData, SessionStoreContract } from '../types.js';
/**
 * File store writes the session data on the file system as. Each session
 * id gets its own file.
 *
 */
export declare class FileStore implements SessionStoreContract {
    #private;
    /**
     * @param {FileStoreConfig} config
     * @param {string|number}   The age must be in seconds or a time expression
     */
    constructor(config: FileStoreConfig, age: string | number);
    /**
     * Reads the session data from the disk.
     */
    read(sessionId: string): Promise<SessionData | null>;
    /**
     * Writes the session data to the disk as a string
     */
    write(sessionId: string, values: SessionData): Promise<void>;
    /**
     * Removes the session file from the disk
     */
    destroy(sessionId: string): Promise<void>;
    /**
     * Updates the session expiry by rewriting it to the
     * persistence store
     */
    touch(sessionId: string): Promise<void>;
}

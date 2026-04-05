import { randomUUID, type RandomUUIDOptions, type UUID } from 'node:crypto';
/**
 * Generate a UUID v4 string
 */
export declare function uuid(options?: RandomUUIDOptions): UUID;
export declare namespace uuid {
    var use: (generator: typeof randomUUID) => void;
    var restore: () => void;
}

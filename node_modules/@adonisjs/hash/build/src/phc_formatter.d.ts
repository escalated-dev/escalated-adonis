import { PhcNode } from './types.js';
/**
 * Phc formatter is used to serialize a hash to a phc string and
 * deserialize it back to a PHC object.
 */
export declare class PhcFormatter<Params extends Record<string, string | number> = Record<string, string | number>> {
    /**
     * Serialize salt and hash with predefined options.
     */
    serialize(salt: Buffer, hash: Buffer, options: {
        id: string;
        params?: Params;
        version?: number | string;
    }): string;
    /**
     * Deserialize a PHC string to an object
     */
    deserialize(phcString: string): PhcNode<Params>;
}

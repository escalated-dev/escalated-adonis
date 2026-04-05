import { Secret } from '@adonisjs/core/helpers';
/**
 * Access token represents a token created for a user to authenticate
 * using the auth module.
 *
 * It encapsulates the logic of creating an opaque token, generating
 * its hash and verifying its hash.
 */
export declare class AccessToken {
    /**
     * Decodes a publicly shared token and return the series
     * and the token value from it.
     *
     * Returns null when unable to decode the token because of
     * invalid format or encoding.
     */
    static decode(prefix: string, value: string): null | {
        identifier: string;
        secret: Secret<string>;
    };
    /**
     * Creates a transient token that can be shared with the persistence
     * layer.
     */
    static createTransientToken(userId: string | number | BigInt, size: number, expiresIn?: string | number): {
        secret: Secret<string>;
        hash: string;
        userId: string | number | BigInt;
        expiresAt: Date | undefined;
    };
    /**
     * Creates a secret opaque token and its hash. The secret is
     * suffixed with a crc32 checksum for secret scanning tools
     * to easily identify the token.
     */
    static seed(size: number): {
        secret: Secret<string>;
        hash: string;
    };
    /**
     * Identifer is a unique sequence to identify the
     * token within database. It should be the
     * primary/unique key
     */
    identifier: string | number | BigInt;
    /**
     * Reference to the user id for whom the token
     * is generated.
     */
    tokenableId: string | number | BigInt;
    /**
     * The value is a public representation of a token. It is created
     * by combining the "identifier"."secret"
     */
    value?: Secret<string>;
    /**
     * Recognizable name for the token
     */
    name: string | null;
    /**
     * A unique type to identify a bucket of tokens inside the
     * storage layer.
     */
    type: string;
    /**
     * Hash is computed from the seed to later verify the validity
     * of seed
     */
    hash: string;
    /**
     * Date/time when the token instance was created
     */
    createdAt: Date;
    /**
     * Date/time when the token was updated
     */
    updatedAt: Date;
    /**
     * Timestamp at which the token was used for authentication
     */
    lastUsedAt: Date | null;
    /**
     * Timestamp at which the token will expire
     */
    expiresAt: Date | null;
    /**
     * An array of abilities the token can perform. The abilities
     * is an array of abritary string values
     */
    abilities: string[];
    constructor(attributes: {
        identifier: string | number | BigInt;
        tokenableId: string | number | BigInt;
        type: string;
        hash: string;
        createdAt: Date;
        updatedAt: Date;
        lastUsedAt: Date | null;
        expiresAt: Date | null;
        name: string | null;
        prefix?: string;
        secret?: Secret<string>;
        abilities?: string[];
    });
    /**
     * Check if the token allows the given ability.
     */
    allows(ability: string): boolean;
    /**
     * Check if the token denies the ability.
     */
    denies(ability: string): boolean;
    /**
     * Authorize ability access using the current access token
     */
    authorize(ability: string): void;
    /**
     * Check if the token has been expired. Verifies
     * the "expiresAt" timestamp with the current
     * date.
     *
     * Tokens with no expiry never expire
     */
    isExpired(): boolean;
    /**
     * Verifies the value of a token against the pre-defined hash
     */
    verify(secret: Secret<string>): boolean;
    toJSON(): {
        type: string;
        name: string | null;
        token: string | undefined;
        abilities: string[];
        lastUsedAt: Date | null;
        expiresAt: Date | null;
    };
}

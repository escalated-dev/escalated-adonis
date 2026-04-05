import { Secret } from '@adonisjs/core/helpers';
/**
 * Remember me token represents an opaque token that can be
 * used to automatically login a user without asking them
 * to re-login
 */
export declare class RememberMeToken {
    /**
     * Decodes a publicly shared token and return the series
     * and the token value from it.
     *
     * Returns null when unable to decode the token because of
     * invalid format or encoding.
     */
    static decode(value: string): null | {
        identifier: string;
        secret: Secret<string>;
    };
    /**
     * Creates a transient token that can be shared with the persistence
     * layer.
     */
    static createTransientToken(userId: string | number | BigInt, size: number, expiresIn: string | number): {
        secret: Secret<string>;
        hash: string;
        userId: string | number | BigInt;
        expiresAt: Date;
    };
    /**
     * Creates a secret opaque token and its hash.
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
     * Timestamp at which the token will expire
     */
    expiresAt: Date;
    constructor(attributes: {
        identifier: string | number | BigInt;
        tokenableId: string | number | BigInt;
        hash: string;
        createdAt: Date;
        updatedAt: Date;
        expiresAt: Date;
        secret?: Secret<string>;
    });
    /**
     * Check if the token has been expired. Verifies
     * the "expiresAt" timestamp with the current
     * date.
     */
    isExpired(): boolean;
    /**
     * Verifies the value of a token against the pre-defined hash
     */
    verify(secret: Secret<string>): boolean;
}

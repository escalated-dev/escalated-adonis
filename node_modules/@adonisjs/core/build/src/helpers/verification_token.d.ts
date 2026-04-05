import { Secret } from '@poppinss/utils';
/**
 * Verification token class can be used to create tokens publicly
 * shareable tokens while storing the token hash within the database.
 *
 * This class is used by the Auth and the Persona packages to manage
 * tokens
 */
export declare abstract class VerificationToken {
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
     * Hash is computed from the seed to later verify the validity
     * of seed
     */
    hash: string;
    /**
     * Timestamp at which the token will expire
     */
    expiresAt: Date;
    /**
     * The value is a public representation of a token. It is created
     * by combining the "identifier"."secret" via the "computeValue"
     * method
     */
    value?: Secret<string>;
    /**
     * Compute the value property using the given secret. You can
     * get secret via the static "createTransientToken" method.
     */
    protected computeValue(secret: Secret<string>): void;
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

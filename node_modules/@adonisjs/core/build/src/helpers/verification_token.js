/*
 * @adonisjs/core
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */
import { createHash } from 'node:crypto';
import string from '@poppinss/utils/string';
import { base64, safeEqual, Secret } from '@poppinss/utils';
/**
 * Verification token class can be used to create tokens publicly
 * shareable tokens while storing the token hash within the database.
 *
 * This class is used by the Auth and the Persona packages to manage
 * tokens
 */
export class VerificationToken {
    /**
     * Decodes a publicly shared token and return the series
     * and the token value from it.
     *
     * Returns null when unable to decode the token because of
     * invalid format or encoding.
     */
    static decode(value) {
        /**
         * Ensure value is a string and starts with the prefix.
         */
        if (typeof value !== 'string') {
            return null;
        }
        /**
         * Remove prefix from the rest of the token.
         */
        if (!value) {
            return null;
        }
        const [identifier, ...tokenValue] = value.split('.');
        if (!identifier || tokenValue.length === 0) {
            return null;
        }
        const decodedIdentifier = base64.urlDecode(identifier);
        const decodedSecret = base64.urlDecode(tokenValue.join('.'));
        if (!decodedIdentifier || !decodedSecret) {
            return null;
        }
        return {
            identifier: decodedIdentifier,
            secret: new Secret(decodedSecret),
        };
    }
    /**
     * Creates a transient token that can be shared with the persistence
     * layer.
     */
    static createTransientToken(userId, size, expiresIn) {
        const expiresAt = new Date();
        expiresAt.setSeconds(expiresAt.getSeconds() + string.seconds.parse(expiresIn));
        return {
            userId,
            expiresAt,
            ...this.seed(size),
        };
    }
    /**
     * Creates a secret opaque token and its hash.
     */
    static seed(size) {
        const seed = string.random(size);
        const secret = new Secret(seed);
        const hash = createHash('sha256').update(secret.release()).digest('hex');
        return { secret, hash };
    }
    /**
     * Compute the value property using the given secret. You can
     * get secret via the static "createTransientToken" method.
     */
    computeValue(secret) {
        this.value = new Secret(`${base64.urlEncode(String(this.identifier))}.${base64.urlEncode(secret.release())}`);
    }
    /**
     * Check if the token has been expired. Verifies
     * the "expiresAt" timestamp with the current
     * date.
     */
    isExpired() {
        return this.expiresAt < new Date();
    }
    /**
     * Verifies the value of a token against the pre-defined hash
     */
    verify(secret) {
        const newHash = createHash('sha256').update(secret.release()).digest('hex');
        return safeEqual(this.hash, newHash);
    }
}

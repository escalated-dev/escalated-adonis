import { type Secret } from '@adonisjs/core/helpers';
import { type RememberMeToken } from '../remember_me_token.js';
import { PROVIDER_REAL_USER } from '../../../src/symbols.js';
import type { SessionGuardUser, LucidAuthenticatable, SessionLucidUserProviderOptions, SessionUserProviderContract } from '../types.js';
/**
 * Uses a lucid model to verify access tokens and find a user during
 * authentication
 */
export declare class SessionLucidUserProvider<UserModel extends LucidAuthenticatable> implements SessionUserProviderContract<InstanceType<UserModel>> {
    /**
     * Lucid provider options
     */
    protected options: SessionLucidUserProviderOptions<UserModel>;
    [PROVIDER_REAL_USER]: InstanceType<UserModel>;
    /**
     * Reference to the lazily imported model
     */
    protected model?: UserModel;
    constructor(
    /**
     * Lucid provider options
     */
    options: SessionLucidUserProviderOptions<UserModel>);
    /**
     * Imports the model from the provider, returns and caches it
     * for further operations.
     */
    protected getModel(): Promise<UserModel>;
    /**
     * Returns the tokens provider associated with the user model
     */
    protected getTokensProvider(): Promise<import("../types.js").RememberMeTokensProviderContract<import("@adonisjs/lucid/types/model").LucidModel>>;
    /**
     * Creates an adapter user for the guard
     */
    createUserForGuard(user: InstanceType<UserModel>): Promise<SessionGuardUser<InstanceType<UserModel>>>;
    /**
     * Finds a user by their primary key value
     */
    findById(identifier: string | number | BigInt): Promise<SessionGuardUser<InstanceType<UserModel>> | null>;
    /**
     * Creates a remember token for a given user
     */
    createRememberToken(user: InstanceType<UserModel>, expiresIn: string | number): Promise<RememberMeToken>;
    /**
     * Verify a token by its publicly shared value
     */
    verifyRememberToken(tokenValue: Secret<string>): Promise<RememberMeToken | null>;
    /**
     * Delete a token for a user by the token identifier
     */
    deleteRemeberToken(user: InstanceType<UserModel>, identifier: string | number | BigInt): Promise<number>;
    /**
     * Recycle a token for a user by the token identifier
     */
    recycleRememberToken(user: InstanceType<UserModel>, identifier: string | number | BigInt, expiresIn: string | number): Promise<RememberMeToken>;
}

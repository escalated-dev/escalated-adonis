import { type Secret } from '@adonisjs/core/helpers';
import { type AccessToken } from '../access_token.js';
import { PROVIDER_REAL_USER } from '../../../src/symbols.js';
import type { LucidTokenable, AccessTokensGuardUser, AccessTokensUserProviderContract, AccessTokensLucidUserProviderOptions } from '../types.js';
/**
 * Uses a lucid model to verify access tokens and find a user during
 * authentication
 */
export declare class AccessTokensLucidUserProvider<TokenableProperty extends string, UserModel extends LucidTokenable<TokenableProperty>> implements AccessTokensUserProviderContract<InstanceType<UserModel>> {
    /**
     * Lucid provider options
     */
    protected options: AccessTokensLucidUserProviderOptions<TokenableProperty, UserModel>;
    [PROVIDER_REAL_USER]: InstanceType<UserModel>;
    /**
     * Reference to the lazily imported model
     */
    protected model?: UserModel;
    constructor(
    /**
     * Lucid provider options
     */
    options: AccessTokensLucidUserProviderOptions<TokenableProperty, UserModel>);
    /**
     * Imports the model from the provider, returns and caches it
     * for further operations.
     */
    protected getModel(): Promise<UserModel>;
    /**
     * Returns the tokens provider associated with the user model
     */
    protected getTokensProvider(): Promise<UserModel[TokenableProperty]>;
    /**
     * Creates an adapter user for the guard
     */
    createUserForGuard(user: InstanceType<UserModel>): Promise<AccessTokensGuardUser<InstanceType<UserModel>>>;
    /**
     * Create a token for a given user
     */
    createToken(user: InstanceType<UserModel>, abilities?: string[] | undefined, options?: {
        name?: string;
        expiresIn?: string | number;
    }): Promise<AccessToken>;
    /**
     * Invalidates a token identified by its publicly shared token
     */
    invalidateToken(tokenValue: Secret<string>): Promise<boolean>;
    /**
     * Finds a user by the user id
     */
    findById(identifier: string | number | BigInt): Promise<AccessTokensGuardUser<InstanceType<UserModel>> | null>;
    /**
     * Verifies a publicly shared access token and returns an
     * access token for it.
     */
    verifyToken(tokenValue: Secret<string>): Promise<AccessToken | null>;
}

import type { Secret } from '@adonisjs/core/helpers';
import type { LucidModel } from '@adonisjs/lucid/types/model';
import { AccessToken } from '../access_token.js';
import type { AccessTokenDbColumns, AccessTokensProviderContract, DbAccessTokensProviderOptions } from '../types.js';
/**
 * DbAccessTokensProvider uses lucid database service to fetch and
 * persist tokens for a given user.
 *
 * The user must be an instance of the associated user model.
 */
export declare class DbAccessTokensProvider<TokenableModel extends LucidModel> implements AccessTokensProviderContract<TokenableModel> {
    #private;
    protected options: DbAccessTokensProviderOptions<TokenableModel>;
    /**
     * Create tokens provider instance for a given Lucid model
     */
    static forModel<TokenableModel extends LucidModel>(model: DbAccessTokensProviderOptions<TokenableModel>['tokenableModel'], options?: Omit<DbAccessTokensProviderOptions<TokenableModel>, 'tokenableModel'>): DbAccessTokensProvider<TokenableModel>;
    /**
     * A unique type for the value. The type is used to identify a
     * bucket of tokens within the storage layer.
     *
     * Defaults to auth_token
     */
    protected type: string;
    /**
     * A unique prefix to append to the publicly shared token value.
     *
     * Defaults to oat
     */
    protected prefix: string;
    /**
     * Database table to use for querying access tokens
     */
    protected table: string;
    /**
     * The length for the token secret. A secret is a cryptographically
     * secure random string.
     */
    protected tokenSecretLength: number;
    constructor(options: DbAccessTokensProviderOptions<TokenableModel>);
    /**
     * Maps a database row to an instance token instance
     */
    protected dbRowToAccessToken(dbRow: AccessTokenDbColumns): AccessToken;
    /**
     * Returns a query client instance from the parent model
     */
    protected getDb(): Promise<import("@adonisjs/lucid/types/database").QueryClientContract>;
    /**
     * Create a token for a user
     */
    create(user: InstanceType<TokenableModel>, abilities?: string[], options?: {
        name?: string;
        expiresIn?: string | number;
    }): Promise<AccessToken>;
    /**
     * Find a token for a user by the token id
     */
    find(user: InstanceType<TokenableModel>, identifier: string | number | BigInt): Promise<AccessToken | null>;
    /**
     * Delete a token by its id
     */
    delete(user: InstanceType<TokenableModel>, identifier: string | number | BigInt): Promise<number>;
    /**
     * Delete all tokens for a given user
     *
     * @param user - The user instance to delete tokens for
     *
     * @example
     * const deletedCount = await provider.deleteAll(user)
     * console.log('Deleted tokens:', deletedCount)
     */
    deleteAll(user: InstanceType<TokenableModel>): Promise<number>;
    /**
     * Returns all the tokens for a given user
     *
     * @param user - The user instance to get tokens for
     *
     * @example
     * const tokens = await provider.all(user)
     * console.log('User has', tokens.length, 'tokens')
     * tokens.forEach(token => console.log(token.name))
     */
    all(user: InstanceType<TokenableModel>): Promise<AccessToken[]>;
    /**
     * Verifies a publicly shared access token and returns an
     * access token for it.
     *
     * Returns null when unable to verify the token or find it
     * inside the storage
     */
    verify(tokenValue: Secret<string>): Promise<AccessToken | null>;
    /**
     * Invalidates a token identified by its publicly shared token
     */
    invalidate(tokenValue: Secret<string>): Promise<boolean>;
}

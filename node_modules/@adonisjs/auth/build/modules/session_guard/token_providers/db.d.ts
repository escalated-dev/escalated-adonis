import type { Secret } from '@adonisjs/core/helpers';
import type { LucidModel } from '@adonisjs/lucid/types/model';
import { RememberMeToken } from '../remember_me_token.js';
import type { RememberMeTokenDbColumns, RememberMeTokensProviderContract, DbRememberMeTokensProviderOptions } from '../types.js';
/**
 * DbRememberMeTokensProvider uses lucid database service to fetch and
 * persist tokens for a given user.
 *
 * The user must be an instance of the associated user model.
 */
export declare class DbRememberMeTokensProvider<TokenableModel extends LucidModel> implements RememberMeTokensProviderContract<TokenableModel> {
    #private;
    protected options: DbRememberMeTokensProviderOptions<TokenableModel>;
    /**
     * Create tokens provider instance for a given Lucid model
     */
    static forModel<TokenableModel extends LucidModel>(model: DbRememberMeTokensProviderOptions<TokenableModel>['tokenableModel'], options?: Omit<DbRememberMeTokensProviderOptions<TokenableModel>, 'tokenableModel'>): DbRememberMeTokensProvider<TokenableModel>;
    /**
     * Database table to use for querying remember me tokens
     */
    protected table: string;
    /**
     * The length for the token secret. A secret is a cryptographically
     * secure random string.
     */
    protected tokenSecretLength: number;
    constructor(options: DbRememberMeTokensProviderOptions<TokenableModel>);
    /**
     * Maps a database row to an instance token instance
     */
    protected dbRowToRememberMeToken(dbRow: RememberMeTokenDbColumns): RememberMeToken;
    /**
     * Returns a query client instance from the parent model
     */
    protected getDb(): Promise<import("@adonisjs/lucid/types/database").QueryClientContract>;
    /**
     * Create a token for a user
     */
    create(user: InstanceType<TokenableModel>, expiresIn: string | number): Promise<RememberMeToken>;
    /**
     * Find a token for a user by the token id
     */
    find(user: InstanceType<TokenableModel>, identifier: string | number | BigInt): Promise<RememberMeToken | null>;
    /**
     * Delete a token by its id
     */
    delete(user: InstanceType<TokenableModel>, identifier: string | number | BigInt): Promise<number>;
    /**
     * Returns all the tokens a given user
     */
    all(user: InstanceType<TokenableModel>): Promise<RememberMeToken[]>;
    /**
     * Verifies a publicly shared remember me token and returns an
     * RememberMeToken for it.
     *
     * Returns null when unable to verify the token or find it
     * inside the storage
     */
    verify(tokenValue: Secret<string>): Promise<RememberMeToken | null>;
    /**
     * Recycles a remember me token by deleting the old one and
     * creates a new one.
     *
     * Ideally, the recycle should update the existing token, but we
     * skip that for now and come back to it later and handle race
     * conditions as well.
     */
    recycle(user: InstanceType<TokenableModel>, identifier: string | number | BigInt, expiresIn: string | number): Promise<RememberMeToken>;
}

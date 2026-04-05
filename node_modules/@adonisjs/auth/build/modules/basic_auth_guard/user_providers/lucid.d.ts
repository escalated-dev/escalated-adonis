import { PROVIDER_REAL_USER } from '../../../src/symbols.js';
import type { BasicAuthGuardUser, LucidAuthenticatable, BasicAuthUserProviderContract, BasicAuthLucidUserProviderOptions } from '../types.js';
/**
 * Uses a Lucid model to verify access tokens and find a user during
 * authentication
 */
export declare class BasicAuthLucidUserProvider<UserModel extends LucidAuthenticatable> implements BasicAuthUserProviderContract<InstanceType<UserModel>> {
    /**
     * Lucid provider options
     */
    protected options: BasicAuthLucidUserProviderOptions<UserModel>;
    [PROVIDER_REAL_USER]: InstanceType<UserModel>;
    /**
     * Reference to the lazily imported model
     */
    protected model?: UserModel;
    constructor(
    /**
     * Lucid provider options
     */
    options: BasicAuthLucidUserProviderOptions<UserModel>);
    /**
     * Imports the model from the provider, returns and caches it
     * for further operations.
     */
    protected getModel(): Promise<UserModel>;
    /**
     * Creates an adapter user for the guard
     */
    createUserForGuard(user: InstanceType<UserModel>): Promise<BasicAuthGuardUser<InstanceType<UserModel>>>;
    /**
     * Verifies credentials using the underlying model
     */
    verifyCredentials(uid: string, password: string): Promise<BasicAuthGuardUser<InstanceType<UserModel>> | null>;
}

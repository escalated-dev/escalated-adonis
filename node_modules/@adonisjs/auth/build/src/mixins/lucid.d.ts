import type { Hash } from '@adonisjs/core/hash';
import { type BaseModel } from '@adonisjs/lucid/orm';
import type { NormalizeConstructor } from '@adonisjs/core/types/helpers';
type UserWithUserFinderRow = {
    verifyPassword(plainPassword: string): Promise<boolean>;
};
type UserWithUserFinderClass<Model extends NormalizeConstructor<typeof BaseModel> = NormalizeConstructor<typeof BaseModel>> = Model & {
    hashPassword<T extends UserWithUserFinderClass>(this: T, user: InstanceType<T>): Promise<void>;
    findForAuth<T extends UserWithUserFinderClass>(this: T, uids: string[], value: string): Promise<InstanceType<T> | null>;
    verifyCredentials<T extends UserWithUserFinderClass>(this: T, uid: string, password: string): Promise<InstanceType<T>>;
    new (...args: any[]): UserWithUserFinderRow;
};
/**
 * Mixing to add user lookup and password verification methods
 * on a model.
 *
 * Under the hood, this mixin defines following methods and hooks
 *
 * - beforeSave hook to hash user password
 * - findForAuth method to find a user during authentication
 * - verifyCredentials method to verify user credentials and prevent
 *   timing attacks.
 */
export declare function withAuthFinder(hash: () => Hash, options: {
    uids: string[];
    passwordColumnName: string;
}): <Model extends NormalizeConstructor<typeof BaseModel>>(superclass: Model) => UserWithUserFinderClass<Model>;
export {};

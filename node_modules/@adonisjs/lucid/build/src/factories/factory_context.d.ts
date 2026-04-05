import { FactoryContextContract } from '../types/factory.js';
import { TransactionClientContract } from '../types/database.js';
export declare class FactoryContext implements FactoryContextContract {
    isStubbed: boolean;
    $trx: TransactionClientContract | undefined;
    faker: import("@faker-js/faker").Faker;
    constructor(isStubbed: boolean, $trx: TransactionClientContract | undefined);
}

import { QueryClientContract } from '../types/database.js';
export declare class BaseSeeder {
    client: QueryClientContract;
    static environment: string[];
    constructor(client: QueryClientContract);
    run(): Promise<void>;
}

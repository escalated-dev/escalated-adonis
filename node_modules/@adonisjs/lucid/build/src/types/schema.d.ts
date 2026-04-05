import { QueryClientContract } from './database.js';
/**
 * Shape of callback to defer database calls
 */
export type DeferCallback = (client: QueryClientContract) => void | Promise<void>;

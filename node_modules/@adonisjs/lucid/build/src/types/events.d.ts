import { DbQueryEventNode } from './database.js';
export interface EventsList {
    'db:query': DbQueryEventNode;
}

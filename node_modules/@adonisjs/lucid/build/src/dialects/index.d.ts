import { DialectContract, SharedConfigNode, QueryClientContract, ConnectionContract } from '../types/database.js';
export declare const clientsToDialectsMapping: {
    [K in ConnectionContract['clientName']]: {
        new (client: QueryClientContract, config: SharedConfigNode): DialectContract;
    };
};
export declare const clientsNames: ConnectionContract["clientName"][];

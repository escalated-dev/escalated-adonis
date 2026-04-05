import { IncomingMessage, Server, ServerResponse } from 'node:http';
export declare const httpServer: {
    create(handler: (req: IncomingMessage, res: ServerResponse) => any | Promise<any>): Promise<{
        server: Server;
        url: string;
        port: number;
    }>;
};

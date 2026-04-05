import { BaseCommand } from '../modules/ace/main.js';
/**
 * The generate key command is used to generate the app key
 * and write it inside the .env file.
 */
export default class GenerateKey extends BaseCommand {
    static commandName: string;
    static description: string;
    show: boolean;
    force: boolean;
    run(): Promise<void>;
}

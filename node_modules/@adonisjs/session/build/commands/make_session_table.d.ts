import { BaseCommand } from '@adonisjs/core/ace';
/**
 * Command to create the sessions table migration
 */
export default class MakeSessionTable extends BaseCommand {
    static commandName: string;
    static description: string;
    run(): Promise<void>;
}

import type { CommandOptions as BaseCommandOptions } from '@adonisjs/ace/types';
export type CommandOptions = BaseCommandOptions & {
    startApp?: boolean;
};
export * from '@adonisjs/ace/types';

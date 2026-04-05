import { Configuration } from 'yargs-parser';
/**
 * The fixed config used to parse command line arguments using yargs. We
 * do not allow changing these options, since some of the internal
 * checks and features rely on this specific config
 */
export declare const yarsConfig: Partial<Configuration>;

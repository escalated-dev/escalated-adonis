import type { ApplicationService } from '../src/types.js';
declare let app: ApplicationService;
/**
 * Set the application instance the app service should
 * be using. Other services relies on the same app
 * instance as well.
 *
 * app service is an instance of the "Application" exported from
 * the "modules/app.ts" file.
 */
export declare function setApp(appService: ApplicationService): void;
export { app as default };

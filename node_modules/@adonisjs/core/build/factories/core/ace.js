/*
 * @adonisjs/core
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */
import { IgnitorFactory } from './ignitor.js';
import { Ignitor } from '../../src/ignitor/main.js';
import { createAceKernel } from '../../modules/ace/create_kernel.js';
/**
 * Creates an instance of Ace kernel
 */
export class AceFactory {
    async make(ignitorOrAppRoot, options) {
        if (ignitorOrAppRoot instanceof Ignitor) {
            const app = ignitorOrAppRoot.createApp('console');
            await app.init();
            return createAceKernel(app);
        }
        const app = new IgnitorFactory()
            .withCoreConfig()
            .withCoreProviders()
            .create(ignitorOrAppRoot, options)
            .createApp('console');
        await app.init();
        return createAceKernel(app);
    }
}

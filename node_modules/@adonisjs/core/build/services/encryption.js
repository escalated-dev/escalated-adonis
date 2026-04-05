/*
 * @adonisjs/core
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */
import app from './app.js';
let encryption;
/**
 * Returns a singleton instance of the encryption class
 * from the container
 */
await app.booted(async () => {
    encryption = await app.container.make('encryption');
});
export { encryption as default };

/*
 * @adonisjs/core
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */
/**
 * Helper to create config provider and resolve config from
 * them
 */
export const configProvider = {
    create(resolver) {
        return {
            type: 'provider',
            resolver,
        };
    },
    async resolve(app, provider) {
        if (provider && typeof provider === 'object' && 'type' in provider) {
            return provider.resolver(app);
        }
        return null;
    },
};

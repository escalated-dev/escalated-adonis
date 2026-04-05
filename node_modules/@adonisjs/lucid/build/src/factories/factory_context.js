/*
 * @adonisjs/lucid
 *
 * (c) Harminder Virk <virk@adonisjs.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */
import { faker } from '@faker-js/faker';
export class FactoryContext {
    isStubbed;
    $trx;
    faker = faker;
    constructor(isStubbed, $trx) {
        this.isStubbed = isStubbed;
        this.$trx = $trx;
    }
}

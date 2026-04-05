/*
 * @adonisjs/core
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import stringHelpers from '../../src/helpers/string.js';
import { args, BaseCommand, flags } from '../../modules/ace/main.js';
const ALLOWED_TYPES = ['string', 'boolean', 'number', 'enum'];
/**
 * The env:add command is used to add a new environment variable to the
 * `.env`, `.env.example` and `start/env.ts` files.
 */
export default class EnvAdd extends BaseCommand {
    static commandName = 'env:add';
    static description = 'Add a new environment variable';
    static options = {
        allowUnknownFlags: true,
    };
    /**
     * Validate the type flag passed by the user
     */
    #isTypeFlagValid() {
        return ALLOWED_TYPES.includes(this.type);
    }
    async run() {
        /**
         * Prompt for missing name
         */
        if (!this.name) {
            this.name = await this.prompt.ask('Enter the variable name', {
                validate: (value) => !!value,
                format: (value) => stringHelpers.snakeCase(value).toUpperCase(),
            });
        }
        /**
         * Prompt for missing value
         */
        if (!this.value) {
            this.value = await this.prompt.ask('Enter the variable value');
        }
        /**
         * Prompt for missing type
         */
        if (!this.type) {
            this.type = await this.prompt.choice('Select the variable type', ALLOWED_TYPES);
        }
        /**
         * Prompt for missing enum values if the selected env type is `enum`
         */
        if (this.type === 'enum' && !this.enumValues) {
            this.enumValues = await this.prompt.ask('Enter the enum values separated by a comma', {
                result: (value) => value.split(',').map((one) => one.trim()),
            });
        }
        /**
         * Validate inputs
         */
        if (!this.#isTypeFlagValid()) {
            this.logger.error(`Invalid type "${this.type}". Must be one of ${ALLOWED_TYPES.join(', ')}`);
            return;
        }
        /**
         * Add the environment variable to the `.env` and `.env.example` files
         */
        const codemods = await this.createCodemods();
        const transformedName = stringHelpers.snakeCase(this.name).toUpperCase();
        await codemods.defineEnvVariables({ [transformedName]: this.value }, { omitFromExample: [transformedName] });
        /**
         * Add the environment variable to the `start/env.ts` file
         */
        const validation = {
            string: 'Env.schema.string()',
            number: 'Env.schema.number()',
            boolean: 'Env.schema.boolean()',
            enum: `Env.schema.enum(['${this.enumValues.join("','")}'] as const)`,
        }[this.type];
        await codemods.defineEnvValidations({ variables: { [transformedName]: validation } });
        this.logger.success('Environment variable added successfully');
    }
}
__decorate([
    args.string({
        description: 'Variable name. Will be converted to screaming snake case',
        required: false,
    })
], EnvAdd.prototype, "name", void 0);
__decorate([
    args.string({ description: 'Variable value', required: false })
], EnvAdd.prototype, "value", void 0);
__decorate([
    flags.string({ description: 'Type of the variable' })
], EnvAdd.prototype, "type", void 0);
__decorate([
    flags.array({
        description: 'Allowed values for the enum type in a comma-separated list',
        default: [''],
        required: false,
    })
], EnvAdd.prototype, "enumValues", void 0);

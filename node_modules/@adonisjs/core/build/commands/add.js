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
import { detectPackageManager, installPackage } from '@antfu/install-pkg';
import { args, BaseCommand, flags } from '../modules/ace/main.js';
const KNOWN_PACKAGE_MANAGERS = ['npm', 'pnpm', 'bun', 'yarn', 'yarn@berry', 'pnpm@6'];
/**
 * The install command is used to `npm install` and `node ace configure` a new package
 * in one go.
 */
export default class Add extends BaseCommand {
    static commandName = 'add';
    static description = 'Install and configure a package';
    static options = {
        allowUnknownFlags: true,
    };
    /**
     * Detect the package manager to use
     */
    async #getPackageManager() {
        const packageManager = this.packageManager || (await detectPackageManager(this.app.makePath())) || 'npm';
        if (KNOWN_PACKAGE_MANAGERS.some((knownPackageManager) => knownPackageManager === packageManager)) {
            return packageManager;
        }
        throw new Error('Invalid package manager. Must be one of npm, pnpm, bun or yarn');
    }
    /**
     * Configure the package by delegating the work to the `node ace configure` command
     */
    async #configurePackage() {
        /**
         * Sending unknown flags to the configure command
         */
        const flagValueArray = this.parsed.unknownFlags
            .filter((flag) => !!this.parsed.flags[flag])
            .map((flag) => [`--${flag}`, this.parsed.flags[flag].toString()]);
        const configureArgs = [
            this.name,
            this.force ? '--force' : undefined,
            this.verbose ? '--verbose' : undefined,
            ...flagValueArray.flat(),
        ].filter(Boolean);
        return await this.kernel.exec('configure', configureArgs);
    }
    /**
     * Install the package using the selected package manager
     */
    async #installPackage(npmPackageName) {
        const colors = this.colors;
        const spinner = this.logger
            .await(`installing ${colors.green(this.name)} using ${colors.grey(this.packageManager)}`)
            .start();
        spinner.start();
        try {
            await installPackage(npmPackageName, {
                dev: this.dev,
                silent: this.verbose === true ? false : true,
                cwd: this.app.makePath(),
                packageManager: this.packageManager,
            });
            spinner.update('package installed successfully');
            spinner.stop();
            return true;
        }
        catch (error) {
            spinner.update('unable to install the package');
            spinner.stop();
            this.logger.fatal(error);
            this.exitCode = 1;
            return false;
        }
    }
    /**
     * Run method is invoked by ace automatically
     */
    async run() {
        const colors = this.colors;
        this.packageManager = await this.#getPackageManager();
        /**
         * Handle special packages to configure
         */
        let npmPackageName = this.name;
        if (this.name === 'vinejs') {
            npmPackageName = '@vinejs/vine';
        }
        else if (this.name === 'edge') {
            npmPackageName = 'edge.js';
        }
        /**
         * Prompt the user to confirm the installation
         */
        const cmd = colors.grey(`${this.packageManager} add ${this.dev ? '-D ' : ''}${this.name}`);
        this.logger.info(`Installing the package using the following command : ${cmd}`);
        const shouldInstall = await this.prompt.confirm('Continue ?', {
            name: 'install',
            default: true,
        });
        if (!shouldInstall) {
            this.logger.info('Installation cancelled');
            return;
        }
        /**
         * Install package
         */
        const pkgWasInstalled = await this.#installPackage(npmPackageName);
        if (!pkgWasInstalled) {
            return;
        }
        /**
         * Configure package
         */
        const { exitCode } = await this.#configurePackage();
        this.exitCode = exitCode;
        if (exitCode === 0) {
            this.logger.success(`Installed and configured ${colors.green(this.name)}`);
        }
        else {
            this.logger.fatal(`Unable to configure ${colors.green(this.name)}`);
        }
    }
}
__decorate([
    args.string({ description: 'Package name' })
], Add.prototype, "name", void 0);
__decorate([
    flags.boolean({ description: 'Display logs in verbose mode' })
], Add.prototype, "verbose", void 0);
__decorate([
    flags.string({ description: 'Select the package manager you want to use' })
], Add.prototype, "packageManager", void 0);
__decorate([
    flags.boolean({ description: 'Should we install the package as a dev dependency', alias: 'D' })
], Add.prototype, "dev", void 0);
__decorate([
    flags.boolean({ description: 'Forcefully overwrite existing files' })
], Add.prototype, "force", void 0);

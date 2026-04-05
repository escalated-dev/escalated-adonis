import { PluginOption } from 'vite';

type InertiaPluginOptions = {
    ssr?: {
        /**
         * Whether or not to enable server-side rendering
         */
        enabled: true;
        /**
         * The entrypoint for the server-side rendering
         */
        entrypoint: string;
        /**
         * The output directory for the server-side rendering bundle
         */
        output?: string;
    } | {
        enabled: false;
    };
};
/**
 * Inertia plugin for Vite that is tailored for AdonisJS
 */
declare function inertia(options?: InertiaPluginOptions): PluginOption;

export { type InertiaPluginOptions, inertia as default };

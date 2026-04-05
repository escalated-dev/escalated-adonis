import { PluginFn } from 'edge.js/types';

/**
 * Register the Inertia tags and globals within Edge
 */
declare const edgePluginInertia: () => PluginFn<undefined>;

export { edgePluginInertia };

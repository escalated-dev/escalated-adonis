import { type Edge } from 'edge.js';
import { type Dumper } from '../dumper.js';
/**
 * Returns an edge plugin that integrates with a given
 * dumper instance
 */
export declare function pluginEdgeDumper(dumper: Dumper): (edge: Edge) => void;

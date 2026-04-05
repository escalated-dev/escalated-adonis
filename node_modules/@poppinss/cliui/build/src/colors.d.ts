import type { Colors } from '@poppinss/colors/types';
/**
 * Returns the colors instance based upon the environment.
 *
 * - The "raw" option returns the colors instance that prefix the color
 *   transformations as raw text
 * - The "silent" option returns the colors instance that performs no
 *   color transformations
 */
export declare function useColors(options?: {
    raw?: boolean;
    silent?: boolean;
}): Colors;

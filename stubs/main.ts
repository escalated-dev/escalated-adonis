/*
|--------------------------------------------------------------------------
| Stubs
|--------------------------------------------------------------------------
|
| Stubs are used by the configure command to copy files into the host
| application during package setup.
|
*/

import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Path to the stubs directory
 */
export const stubsRoot = join(dirname(fileURLToPath(import.meta.url)))

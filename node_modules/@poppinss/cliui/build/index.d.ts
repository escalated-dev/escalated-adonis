import { type Colors } from '@poppinss/colors/types';
import { default as poppinssColors } from '@poppinss/colors';
import { icons } from './src/icons.js';
import { Table } from './src/table.js';
import { Steps } from './src/steps.js';
import { Logger } from './src/logger/main.js';
import { Instructions } from './src/instructions.js';
import { TaskManager } from './src/tasks/manager.js';
import { MemoryRenderer } from './src/renderers/memory.js';
import { ConsoleRenderer } from './src/renderers/console.js';
import type { RendererContract, TableOptions, TaskManagerOptions } from './src/types.js';
export { icons, Table, Steps, Logger, TaskManager, Instructions, MemoryRenderer, ConsoleRenderer, poppinssColors as colors, };
/**
 * Create a new CLI UI instance.
 *
 * - The "raw" mode is tailored for testing
 * - The "silent" mode should be used when the terminal does not support colors. We
 *   automatically perform the detection
 */
export declare function cliui(options?: Partial<{
    mode: 'raw' | 'silent' | 'normal';
}>): {
    colors: Colors;
    logger: Logger;
    table: (tableOptions?: Partial<TableOptions>) => Table;
    tasks: (tasksOptions?: Partial<TaskManagerOptions>) => TaskManager;
    steps: () => Steps;
    icons: {
        tick: string;
        cross: string;
        bullet: string;
        nodejs: string;
        pointer: string;
        info: string;
        warning: string;
        squareSmallFilled: string;
        borderVertical: string;
    };
    sticker: () => Instructions;
    instructions: () => Instructions;
    switchMode(modeToUse: "raw" | "silent" | "normal"): void;
    useRenderer(rendererToUse: RendererContract): void;
    useColors(colorsToUse: Colors): void;
};

type AIAgent = 'claude' | 'cursor' | 'opencode' | 'gemini' | 'copilot' | 'windsurf' | 'codex';
/**
 * Detects which AI coding agent the code is running under.
 * Checks for environment variables set by different AI coding assistants:
 * - CLAUDECODE='1' for Claude Code
 * - GEMINI_CLI='1' for Gemini
 * - GITHUB_COPILOT_CLI_MODE='1' for GitHub Copilot
 * - WINDSURF_SESSION='1' or TERM_PROGRAM='windsurf' for Windsurf
 * - CODEX_CLI='1' or CODEX_SANDBOX='1' for Codex
 * - OPENCODE='1' for OpenCode
 * - CURSOR_AGENT='1' for Cursor
 */
export declare function detectAIAgent(): AIAgent | null;
/**
 * Returns true if the code is running within any AI coding agent.
 */
export declare function isRunningInAIAgent(): boolean;
export {};

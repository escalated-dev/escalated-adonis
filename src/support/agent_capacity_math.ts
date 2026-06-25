/**
 * Pure capacity math shared by the AgentCapacity model and CapacityService.
 * Kept free of Lucid/DB imports so it can be unit-tested in isolation.
 */

/** Whether an agent at the given load has headroom for another ticket. */
export function hasCapacity(currentCount: number, maxConcurrent: number): boolean {
  return currentCount < maxConcurrent
}

/**
 * Current load as a percentage of the ceiling, rounded to one decimal. A
 * zero (or negative) ceiling is treated as fully loaded.
 */
export function loadPercentage(currentCount: number, maxConcurrent: number): number {
  if (maxConcurrent <= 0) {
    return 100
  }

  return Math.round((currentCount / maxConcurrent) * 1000) / 10
}

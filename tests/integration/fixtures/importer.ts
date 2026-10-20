/**
 * Plays the importer a host passes to its Ignitor in `bin/server.ts`.
 *
 * It lives beside this directory's package.json, whose `imports` map plays the
 * host's (`#models/*`, `#start/*`). A bare `import()` here resolves those
 * aliases the way a host's own `import()` does; the same specifier imported
 * from inside the package does not resolve, because the package has no
 * `imports` of its own.
 */
export function hostImporter(specifier: string) {
  return import(specifier)
}

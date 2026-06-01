import { resolve, sep } from 'node:path'

export function collectSafeArchiveRootFolder(entryNames: string[], pluginsPath: string): string {
  const rootFolders = new Set<string>()

  for (const entryName of entryNames) {
    const parts = safeArchiveEntryParts(entryName)
    if (parts.length === 0) continue

    rootFolders.add(parts[0])
    resolveWithinBasePath(pluginsPath, ...parts)
  }

  if (rootFolders.size !== 1) {
    throw new Error('Invalid plugin archive: expected exactly one root plugin folder')
  }

  const rootFolder = [...rootFolders][0]
  assertSafePluginSlug(rootFolder)

  return rootFolder
}

export function safeArchiveEntryParts(entryName: string): string[] {
  const normalizedName = entryName.replace(/\\/g, '/')

  if (
    normalizedName.startsWith('/') ||
    /^[A-Za-z]:/.test(normalizedName) ||
    normalizedName.includes('\0')
  ) {
    throw new Error('Invalid plugin archive: unsafe entry path')
  }

  const parts = normalizedName.split('/').filter(Boolean)

  if (parts.some((part) => part === '.' || part === '..')) {
    throw new Error('Invalid plugin archive: unsafe entry path')
  }

  return parts
}

export function assertSafePluginSlug(slug: string): void {
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(slug)) {
    throw new Error('Invalid plugin archive: unsafe root plugin folder name')
  }
}

export function resolveWithinBasePath(basePath: string, ...parts: string[]): string {
  const target = resolve(basePath, ...parts)
  const resolvedBasePath = resolve(basePath)
  const base = resolvedBasePath.endsWith(sep) ? resolvedBasePath : `${resolvedBasePath}${sep}`

  if (target !== resolvedBasePath && !target.startsWith(base)) {
    throw new Error('Invalid plugin archive: entry escapes plugins directory')
  }

  return target
}

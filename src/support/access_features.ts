/*
|--------------------------------------------------------------------------
| Access features
|--------------------------------------------------------------------------
|
| The install-level switches for roles & permissions, two-factor
| authentication and single sign-on (ADR 2026-10-29-configurable-access-features).
|
| They are read from configuration only (`access` in config/escalated.ts, or
| the ESCALATED_* environment variables when the config file does not set
| them), never from the settings table: each one changes who may sign in or
| what they may do, so it must not be something a stored setting can flip.
| All default to off.
|
| Off: the feature's screens and routes answer 404 (EnsureFeatureEnabled) and
| nothing is enforced. On: the feature is enforced.
|
*/

import { getConfig } from '../helpers/config.js'

export type AccessFeature = 'roles_permissions' | 'two_factor' | 'sso'

export const ACCESS_FEATURES: readonly AccessFeature[] = ['roles_permissions', 'two_factor', 'sso']

/** The `access` block of config/escalated.ts. */
export interface AccessConfig {
  /** Enforce roles & permissions on every admin, agent and staff API route. */
  rolesPermissions?: boolean
  /**
   * Two-factor authentication. Not enforced by this release yet, so it stays
   * off whatever is configured (see `twoFactor()` below).
   */
  twoFactor?: boolean
  /**
   * Single sign-on. Not enforced by this release yet, so it stays off whatever
   * is configured (see `sso()` below).
   */
  sso?: boolean
}

/** `true`, `1`, `yes` or `on` (any case) in an environment variable. */
function envFlag(name: string): boolean {
  const value = process.env[name]
  return (
    typeof value === 'string' && ['true', '1', 'yes', 'on'].includes(value.trim().toLowerCase())
  )
}

/** The configured value, or the environment variable when config leaves it unset. */
function configured(key: keyof AccessConfig, envName: string): boolean {
  const access = (getConfig() as { access?: AccessConfig }).access
  const value = access?.[key]
  if (value === undefined || value === null) return envFlag(envName)
  return value === true || value === ('true' as unknown)
}

export function rolesPermissionsEnabled(): boolean {
  return configured('rolesPermissions', 'ESCALATED_ROLES_PERMISSIONS')
}

/**
 * Two-factor authentication is not enforced by this port yet (no challenge
 * after sign-in), and a port must not show a screen for a feature it does not
 * enforce. It stays off, so its screens answer 404, until the release that
 * enforces it reads `access.twoFactor` / ESCALATED_TWO_FACTOR here.
 */
export function twoFactorEnabled(): boolean {
  return false
}

/**
 * Single sign-on is not enforced by this port yet (no sign-in routes). It
 * stays off until the release that adds them reads `access.sso` /
 * ESCALATED_SSO here.
 */
export function ssoEnabled(): boolean {
  return false
}

export function accessFeatureEnabled(feature: AccessFeature): boolean {
  switch (feature) {
    case 'roles_permissions':
      return rolesPermissionsEnabled()
    case 'two_factor':
      return twoFactorEnabled()
    case 'sso':
      return ssoEnabled()
    default:
      throw new Error(`Unknown Escalated access feature "${feature as string}".`)
  }
}

/** The access switches as the shared `escalated.features` prop carries them. */
export function sharedAccessFeatures(): Record<AccessFeature, boolean> {
  return {
    roles_permissions: rolesPermissionsEnabled(),
    two_factor: twoFactorEnabled(),
    sso: ssoEnabled(),
  }
}

/*
|--------------------------------------------------------------------------
| AdminImportController
|--------------------------------------------------------------------------
|
| The admin import wizard, after escalated-laravel's Admin\ImportController,
| on its routes (escalated.admin.import.*) and with its props:
|
|   GET  /import                            Index     adapters, recent jobs
|   GET  /import/:platform/connect          Connect   credential form
|   POST /import/:platform/test-connection  JSON { success[, error] }
|   GET  /import/:platform/mapping          Mapping   defaults + source fields
|   POST /import/:platform/review           Review    echo of the choices; writes nothing
|   POST /import/:platform/start            creates the job and queues the run
|   GET  /import/progress/:jobId            Progress  the job
|   GET  /import/status/:jobId              JSON poll
|   POST /import/{pause,resume,cancel}/:jobId
|
| Sources come from the `import.adapters` filter; core ships none. Tested
| credentials wait in the session, encrypted, until the import starts, and
| are never sent to the browser.
|
| The earlier job-first routes (`/import/create`, `POST /import`,
| `/import/:id/...` with a uuid) still answer for existing callers.
|
*/

import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import ImportJob, { decryptJson, encryptJson } from '../models/import_job.js'
import ImportService from '../services/import_service.js'
import { dispatchImport } from '../services/import_runner.js'
import type { ImportAdapter } from '../contracts/import_adapter.js'
import { getRenderer } from '../rendering/renderer.js'
import { redirectToRoute } from '../support/routing.js'

export default class AdminImportController {
  protected importService = new ImportService()

  // --------------------------------------------------------------------------
  // Wizard
  // --------------------------------------------------------------------------

  /** GET /admin/import — the registered sources and the 20 most recent jobs. */
  async index(ctx: HttpContext) {
    const adapters = await this.importService.availableAdapters()
    const jobs = await ImportJob.query().orderBy('created_at', 'desc').limit(20)

    return getRenderer().render(ctx, 'Escalated/Admin/Import/Index', {
      adapters: adapters.map((a) => this.serializeAdapter(a)),
      jobs: jobs.map((j) => j.toPageProps()),
    })
  }

  /** GET /admin/import/:platform/connect — the credential form. */
  async connect(ctx: HttpContext) {
    const adapter = await this.adapterOr404(ctx)
    if (!adapter) return

    return getRenderer().render(ctx, 'Escalated/Admin/Import/Connect', {
      platform: adapter.name(),
      display_name: adapter.displayName(),
      credential_fields: adapter.credentialFields(),
    })
  }

  /** POST /admin/import/:platform/test-connection — try the credentials; keep them when they work. */
  async testConnection(ctx: HttpContext) {
    const adapter = await this.adapterOr404(ctx)
    if (!adapter) return

    const posted = ctx.request.input('credentials')
    const credentials: Record<string, string> = {}
    if (posted && typeof posted === 'object' && !Array.isArray(posted)) {
      for (const [key, value] of Object.entries(posted)) {
        credentials[key] = value === null || value === undefined ? '' : String(value)
      }
    }

    let success: boolean
    try {
      success = Boolean(await adapter.testConnection(credentials))
    } catch (error: any) {
      return ctx.response
        .status(422)
        .json({ success: false, error: error?.message ?? String(error) })
    }

    if (success) {
      ctx.session.put(this.sessionKey(adapter), encryptJson(credentials) as string)
    }

    return ctx.response.json({ success })
  }

  /** GET /admin/import/:platform/mapping — defaults and source fields per entity type. */
  async mapping(ctx: HttpContext) {
    const adapter = await this.adapterOr404(ctx)
    if (!adapter) return

    const credentials = this.storedCredentials(ctx, adapter)
    if (!credentials) return this.toConnect(ctx, adapter)

    return this.renderMapping(ctx, adapter, credentials)
  }

  /** POST /admin/import/:platform/review — the dry run: shows the choices, writes nothing. */
  async review(ctx: HttpContext) {
    const entityTypes = ctx.request.input('entity_types')

    return getRenderer().render(ctx, 'Escalated/Admin/Import/Review', {
      platform: ctx.params.platform,
      field_mappings: this.objectInput(ctx, 'field_mappings'),
      entity_types: Array.isArray(entityTypes) ? entityTypes.map(String) : [],
    })
  }

  /** POST /admin/import/:platform/start — create the job from the tested credentials and queue it. */
  async begin(ctx: HttpContext) {
    const adapter = await this.adapterOr404(ctx)
    if (!adapter) return

    const credentials = this.storedCredentials(ctx, adapter)
    if (!credentials) return this.toConnect(ctx, adapter)

    const job = await ImportJob.create({
      userId: (ctx as any).auth?.user?.id ?? null,
      platform: adapter.name(),
      status: 'mapping',
      credentials,
      fieldMappings: this.objectInput(ctx, 'field_mappings'),
    })

    // The job holds them now, encrypted.
    ctx.session.forget(this.sessionKey(adapter))

    await dispatchImport(job)

    return redirectToRoute(ctx.response, 'escalated.admin.import.progress', { jobId: job.id })
  }

  /** GET /admin/import/progress/:jobId — the job the Progress screen polls. */
  async progress(ctx: HttpContext) {
    const job = await this.jobOr404(ctx)
    if (!job) return

    return getRenderer().render(ctx, 'Escalated/Admin/Import/Progress', {
      job: job.toPageProps(),
    })
  }

  /** GET /admin/import/status/:jobId — the Progress screen's poll. */
  async status(ctx: HttpContext) {
    const job = await this.jobOr404(ctx)
    if (!job) return

    return ctx.response.json({
      status: job.status,
      progress: job.progress ?? {},
      error_log: (job.errorLog ?? []).slice(-50),
      started_at: job.startedAt?.toISO() ?? null,
      completed_at: job.completedAt?.toISO() ?? null,
    })
  }

  /** POST /admin/import/pause/:jobId — the run stops between batches. */
  async pauseJob(ctx: HttpContext) {
    const job = await this.jobOr404(ctx)
    if (!job) return

    if (job.status === 'importing') {
      job.status = 'paused'
      await job.save()
    }

    return this.toProgress(ctx, job)
  }

  /** POST /admin/import/resume/:jobId — queue a paused or failed job again. */
  async resume(ctx: HttpContext) {
    const job = await this.jobOr404(ctx)
    if (!job) return

    if (job.isResumable()) {
      if (job.status === 'failed') await job.transitionTo('mapping')
      await dispatchImport(job)
    }

    return this.toProgress(ctx, job)
  }

  /** POST /admin/import/cancel/:jobId — stop for good and drop the credentials. */
  async cancel(ctx: HttpContext) {
    const job = await this.jobOr404(ctx)
    if (!job) return

    job.status = 'failed'
    job.completedAt = DateTime.now()
    await job.save()
    await job.purgeCredentials()

    return this.toProgress(ctx, job)
  }

  // --------------------------------------------------------------------------
  // The earlier job-first flow, kept for existing callers
  // --------------------------------------------------------------------------

  /** GET /admin/import/create — the Index screen lists the sources. */
  async create(ctx: HttpContext) {
    return this.index(ctx)
  }

  /** POST /admin/import — create a job from posted credentials and test them. */
  async store(ctx: HttpContext) {
    const { platform, credentials, fieldMappings } = ctx.request.only([
      'platform',
      'credentials',
      'fieldMappings',
    ])

    const adapter = await this.importService.resolveAdapter(platform)

    if (!adapter) {
      ctx.session.flash('error', `No import adapter found for platform '${platform}'.`)
      return ctx.response.redirect().back()
    }

    const job = await ImportJob.create({
      userId: (ctx as any).auth?.user?.id ?? null,
      platform,
      status: 'pending',
      credentials: credentials ?? null,
      fieldMappings: fieldMappings ?? null,
    })

    await job.transitionTo('authenticating')

    try {
      const ok = await this.importService.testConnection(job)

      if (!ok) {
        await job.transitionTo('failed')
        ctx.session.flash('error', 'Could not connect to the platform. Check your credentials.')
        return ctx.response.redirect().back()
      }
    } catch (err: any) {
      await job.transitionTo('failed')
      ctx.session.flash('error', `Connection error: ${err.message}`)
      return ctx.response.redirect().back()
    }

    await job.transitionTo('mapping')

    return redirectToRoute(ctx.response, 'escalated.admin.import.job_mapping', { id: job.id })
  }

  /** GET /admin/import/:id/mapping — the Mapping screen for a job made by store(). */
  async jobMapping(ctx: HttpContext) {
    const job = await this.legacyJob(ctx)
    if (!job) return

    const adapter = await this.importService.resolveAdapter(job.platform)

    if (!adapter) {
      ctx.session.flash('error', `Adapter for '${job.platform}' is no longer available.`)
      return redirectToRoute(ctx.response, 'escalated.admin.import.index')
    }

    return this.renderMapping(ctx, adapter, job.credentials ?? {})
  }

  /** POST /admin/import/:id/mapping — save field mappings. */
  async saveMapping(ctx: HttpContext) {
    const job = await this.legacyJob(ctx)
    if (!job) return

    const { fieldMappings } = ctx.request.only(['fieldMappings'])

    job.fieldMappings = fieldMappings ?? null
    await job.save()

    ctx.session.flash('success', 'Field mappings saved. You can now start the import.')
    return this.toProgress(ctx, job)
  }

  /** GET /admin/import/:id — the Progress screen. */
  async show(ctx: HttpContext) {
    const job = await this.legacyJob(ctx)
    if (!job) return

    return getRenderer().render(ctx, 'Escalated/Admin/Import/Progress', {
      job: job.toPageProps(),
    })
  }

  /** POST /admin/import/:id/start — start or resume a job made by store(). */
  async start(ctx: HttpContext) {
    const job = await this.legacyJob(ctx)
    if (!job) return

    if (!['mapping', 'paused', 'failed'].includes(job.status)) {
      ctx.session.flash('error', `Cannot start import in status '${job.status}'.`)
      return ctx.response.redirect().back()
    }

    if (job.status === 'failed') await job.transitionTo('mapping')
    await dispatchImport(job)

    ctx.session.flash('success', 'Import started. Refresh this page to track progress.')
    return this.toProgress(ctx, job)
  }

  /** POST /admin/import/:id/pause */
  async pause(ctx: HttpContext) {
    const job = await this.legacyJob(ctx)
    if (!job) return

    if (job.status !== 'importing') {
      ctx.session.flash('error', 'Only a running import can be paused.')
      return ctx.response.redirect().back()
    }

    await job.transitionTo('paused')

    ctx.session.flash('success', 'Import will pause after the current batch completes.')
    return this.toProgress(ctx, job)
  }

  /** DELETE /admin/import/:id — delete a job (only if not actively running). */
  async destroy(ctx: HttpContext) {
    const job = await this.legacyJob(ctx)
    if (!job) return

    if (job.status === 'importing') {
      ctx.session.flash('error', 'Cannot delete a running import. Pause it first.')
      return ctx.response.redirect().back()
    }

    await job.delete()

    ctx.session.flash('success', 'Import job deleted.')
    return redirectToRoute(ctx.response, 'escalated.admin.import.index')
  }

  // --------------------------------------------------------------------------
  // Helpers
  // --------------------------------------------------------------------------

  private async renderMapping(
    ctx: HttpContext,
    adapter: ImportAdapter,
    credentials: Record<string, any>
  ) {
    const entityTypes = adapter.entityTypes()
    const mappings: Record<string, { defaults: Record<string, string>; source_fields: any[] }> = {}

    for (const entityType of entityTypes) {
      mappings[entityType] = {
        defaults: adapter.defaultFieldMappings(entityType),
        source_fields: await adapter.availableSourceFields(entityType, credentials),
      }
    }

    return getRenderer().render(ctx, 'Escalated/Admin/Import/Mapping', {
      platform: adapter.name(),
      display_name: adapter.displayName(),
      entity_types: entityTypes,
      mappings,
    })
  }

  private async adapterOr404(ctx: HttpContext): Promise<ImportAdapter | null> {
    const adapter = await this.importService.resolveAdapter(String(ctx.params.platform ?? ''))
    if (!adapter) {
      ctx.response.notFound({ error: `Import adapter not found: ${ctx.params.platform}` })
      return null
    }
    return adapter
  }

  private async jobOr404(ctx: HttpContext): Promise<ImportJob | null> {
    const job = await ImportJob.find(ctx.params.jobId)
    if (!job) {
      ctx.response.notFound({ error: 'Import job not found.' })
      return null
    }
    return job
  }

  private async legacyJob(ctx: HttpContext): Promise<ImportJob | null> {
    const job = await ImportJob.find(ctx.params.id)

    if (!job) {
      ctx.session.flash('error', 'Import job not found.')
      redirectToRoute(ctx.response, 'escalated.admin.import.index')
      return null
    }

    return job
  }

  private sessionKey(adapter: ImportAdapter): string {
    return `escalated.import.${adapter.name()}.credentials`
  }

  private storedCredentials(ctx: HttpContext, adapter: ImportAdapter): Record<string, any> | null {
    const credentials = decryptJson(ctx.session.get(this.sessionKey(adapter)) ?? null)
    return credentials && typeof credentials === 'object' && !Array.isArray(credentials)
      ? credentials
      : null
  }

  private toConnect(ctx: HttpContext, adapter: ImportAdapter) {
    ctx.session.flash('error', 'Credentials expired. Please reconnect.')
    return redirectToRoute(ctx.response, 'escalated.admin.import.connect', {
      platform: adapter.name(),
    })
  }

  private toProgress(ctx: HttpContext, job: ImportJob) {
    return redirectToRoute(ctx.response, 'escalated.admin.import.progress', { jobId: job.id })
  }

  private objectInput(ctx: HttpContext, key: string): Record<string, any> {
    const value = ctx.request.input(key)
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
  }

  private serializeAdapter(adapter: ImportAdapter) {
    return {
      name: adapter.name(),
      display_name: adapter.displayName(),
      credential_fields: adapter.credentialFields(),
    }
  }
}

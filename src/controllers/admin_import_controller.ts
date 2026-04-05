/*
|--------------------------------------------------------------------------
| AdminImportController
|--------------------------------------------------------------------------
|
| Handles the admin import wizard UI. All responses use Inertia.
|
| Routes (registered in start/routes.ts under the admin prefix):
|
|   GET  /import              — List all import jobs
|   GET  /import/create       — Step 1: choose platform
|   POST /import              — Step 1: save credentials, create job, test connection
|   GET  /import/:id/mapping  — Step 2: configure field mappings
|   POST /import/:id/mapping  — Step 2: save mappings, advance to importing
|   POST /import/:id/start    — Begin / resume the import
|   POST /import/:id/pause    — Pause a running import
|   GET  /import/:id          — Show job detail / progress
|   DELETE /import/:id        — Delete a job (only if not running)
|
*/

import type { HttpContext } from '@adonisjs/core/http'
import ImportJob from '../models/import_job.js'
import ImportService from '../services/import_service.js'
import { getRenderer } from '../rendering/renderer.js'

export default class AdminImportController {
  protected importService = new ImportService()

  // --------------------------------------------------------------------------
  // Index
  // --------------------------------------------------------------------------

  /**
   * GET /admin/import — list all import jobs
   */
  async index(ctx: HttpContext) {
    const jobs = await ImportJob.query().orderBy('created_at', 'desc')

    return getRenderer().render(ctx, 'Escalated/Admin/Import/Index', {
      jobs: jobs.map((j) => this.serializeJob(j)),
    })
  }

  // --------------------------------------------------------------------------
  // Create — Step 1: choose platform + enter credentials
  // --------------------------------------------------------------------------

  /**
   * GET /admin/import/create — render the "choose platform" page
   */
  async create(ctx: HttpContext) {
    const adapters = await this.importService.availableAdapters()

    return getRenderer().render(ctx, 'Escalated/Admin/Import/Create', {
      adapters: adapters.map((a) => ({
        name: a.name(),
        displayName: a.displayName(),
        credentialFields: a.credentialFields(),
      })),
    })
  }

  /**
   * POST /admin/import — create a new import job and test the connection
   */
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
      id: crypto.randomUUID(),
      platform,
      status: 'pending',
      credentials: credentials ?? null,
      fieldMappings: fieldMappings ?? null,
    })

    // Test connection
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

    return ctx.response.redirect().toRoute('escalated.admin.import.mapping', { id: job.id })
  }

  // --------------------------------------------------------------------------
  // Mapping — Step 2: configure field mappings
  // --------------------------------------------------------------------------

  /**
   * GET /admin/import/:id/mapping — render the field-mapping page
   */
  async mapping(ctx: HttpContext) {
    const job = await this.findJobOrFail(ctx)
    if (!job) return

    const adapter = await this.importService.resolveAdapter(job.platform)

    if (!adapter) {
      ctx.session.flash('error', `Adapter for '${job.platform}' is no longer available.`)
      return ctx.response.redirect().toRoute('escalated.admin.import.index')
    }

    // Fetch available source fields for each entity type
    const entityTypes = adapter.entityTypes()
    const sourceFields: Record<string, string[]> = {}
    const defaultMappings: Record<string, Record<string, string>> = {}

    for (const entityType of entityTypes) {
      try {
        sourceFields[entityType] = await adapter.availableSourceFields(
          entityType,
          job.credentials ?? {}
        )
      } catch {
        sourceFields[entityType] = []
      }
      defaultMappings[entityType] = adapter.defaultFieldMappings(entityType)
    }

    return getRenderer().render(ctx, 'Escalated/Admin/Import/Mapping', {
      job: this.serializeJob(job),
      entityTypes,
      sourceFields,
      defaultMappings,
      currentMappings: job.fieldMappings ?? {},
    })
  }

  /**
   * POST /admin/import/:id/mapping — save field mappings and advance status
   */
  async saveMapping(ctx: HttpContext) {
    const job = await this.findJobOrFail(ctx)
    if (!job) return

    const { fieldMappings } = ctx.request.only(['fieldMappings'])

    job.fieldMappings = fieldMappings ?? null
    await job.save()

    ctx.session.flash('success', 'Field mappings saved. You can now start the import.')
    return ctx.response.redirect().toRoute('escalated.admin.import.show', { id: job.id })
  }

  // --------------------------------------------------------------------------
  // Show — job detail / progress
  // --------------------------------------------------------------------------

  /**
   * GET /admin/import/:id — show job detail
   */
  async show(ctx: HttpContext) {
    const job = await this.findJobOrFail(ctx)
    if (!job) return

    return getRenderer().render(ctx, 'Escalated/Admin/Import/Show', {
      job: this.serializeJob(job),
    })
  }

  // --------------------------------------------------------------------------
  // Start / resume
  // --------------------------------------------------------------------------

  /**
   * POST /admin/import/:id/start — kick off or resume the import
   */
  async start(ctx: HttpContext) {
    const job = await this.findJobOrFail(ctx)
    if (!job) return

    if (!['mapping', 'paused', 'failed'].includes(job.status)) {
      ctx.session.flash('error', `Cannot start import in status '${job.status}'.`)
      return ctx.response.redirect().back()
    }

    // Fire and forget — the actual run happens asynchronously so the HTTP
    // response returns immediately. In production, dispatch a background job.
    this.importService.run(job).catch((err) => {
      console.error(`[Escalated] Import job ${job.id} failed:`, err)
    })

    ctx.session.flash('success', 'Import started. Refresh this page to track progress.')
    return ctx.response.redirect().toRoute('escalated.admin.import.show', { id: job.id })
  }

  // --------------------------------------------------------------------------
  // Pause
  // --------------------------------------------------------------------------

  /**
   * POST /admin/import/:id/pause — pause a running import
   */
  async pause(ctx: HttpContext) {
    const job = await this.findJobOrFail(ctx)
    if (!job) return

    if (job.status !== 'importing') {
      ctx.session.flash('error', 'Only a running import can be paused.')
      return ctx.response.redirect().back()
    }

    await job.transitionTo('paused')

    ctx.session.flash('success', 'Import will pause after the current batch completes.')
    return ctx.response.redirect().toRoute('escalated.admin.import.show', { id: job.id })
  }

  // --------------------------------------------------------------------------
  // Destroy
  // --------------------------------------------------------------------------

  /**
   * DELETE /admin/import/:id — delete a job (only if not actively running)
   */
  async destroy(ctx: HttpContext) {
    const job = await this.findJobOrFail(ctx)
    if (!job) return

    if (job.status === 'importing') {
      ctx.session.flash('error', 'Cannot delete a running import. Pause it first.')
      return ctx.response.redirect().back()
    }

    await job.delete()

    ctx.session.flash('success', 'Import job deleted.')
    return ctx.response.redirect().toRoute('escalated.admin.import.index')
  }

  // --------------------------------------------------------------------------
  // Helpers
  // --------------------------------------------------------------------------

  private async findJobOrFail(ctx: HttpContext): Promise<ImportJob | null> {
    const job = await ImportJob.find(ctx.params.id)

    if (!job) {
      ctx.session.flash('error', 'Import job not found.')
      ctx.response.redirect().toRoute('escalated.admin.import.index')
      return null
    }

    return job
  }

  private serializeJob(job: ImportJob) {
    return {
      id: job.id,
      platform: job.platform,
      status: job.status,
      fieldMappings: job.fieldMappings,
      progress: job.progress,
      errorLog: job.errorLog,
      startedAt: job.startedAt?.toISO() ?? null,
      completedAt: job.completedAt?.toISO() ?? null,
      createdAt: job.createdAt.toISO(),
      updatedAt: job.updatedAt.toISO(),
      isResumable: job.isResumable(),
    }
  }
}

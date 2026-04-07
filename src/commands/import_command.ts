/*
|--------------------------------------------------------------------------
| escalated:import — CLI command
|--------------------------------------------------------------------------
|
| Run a data import from an external platform.
|
|   node ace escalated:import zendesk --token=abc123
|   node ace escalated:import zendesk --token=abc123 --subdomain=myco
|   node ace escalated:import <jobId> --resume
|   node ace escalated:import --list
|
| Flags
| -----
|   --resume            Resume a paused or failed import by job ID
|                       (pass the job UUID as the platform argument)
|   --list              List all import jobs and exit
|   --mapping <json>    Override field mappings as a JSON string
|   --token <value>     Auth token credential shorthand
|   --subdomain <val>   Subdomain / base URL credential shorthand
|   --email <value>     Email credential shorthand
|   --api-key <value>   API key credential shorthand
|
*/

import { BaseCommand, args, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import ImportJob from '../models/import_job.js'
import ImportService from '../services/import_service.js'

export default class ImportCommand extends BaseCommand {
  static commandName = 'escalated:import'

  static description =
    'Run a data import from an external platform (Zendesk, Freshdesk, Intercom, Help Scout…)'

  static help = [
    'Start a new import:',
    '  node ace escalated:import zendesk --token=abc123',
    '',
    'Resume a paused or failed import:',
    '  node ace escalated:import <jobId> --resume',
    '',
    'List all import jobs:',
    '  node ace escalated:import --list',
  ]

  static options: CommandOptions = {
    startApp: true,
  }

  // ---- Positional argument ----

  @args.string({
    description: 'Platform slug (e.g. "zendesk") or job UUID when using --resume',
    required: false,
  })
  declare platform: string | undefined

  // ---- Flags ----

  @flags.boolean({
    description: 'Resume a paused or failed import (platform arg must be the job UUID)',
    alias: 'r',
  })
  declare resume: boolean

  @flags.boolean({
    description: 'List all import jobs and exit',
    alias: 'l',
  })
  declare list: boolean

  @flags.string({
    description:
      'Field mapping overrides as a JSON string (e.g. \'{"tickets":{"subject":"title"}}\')',
  })
  declare mapping: string | undefined

  // Credential shorthands
  @flags.string({ description: 'Auth token credential' })
  declare token: string | undefined

  @flags.string({ description: 'Subdomain or base URL credential' })
  declare subdomain: string | undefined

  @flags.string({ description: 'Email credential' })
  declare email: string | undefined

  @flags.string({ description: 'API key credential', name: 'api-key' })
  declare apiKey: string | undefined

  // ---- Run ----

  async run() {
    const importService = new ImportService()

    // ---- --list ----
    if (this.list) {
      await this.handleList()
      return
    }

    // ---- --resume ----
    if (this.resume) {
      if (!this.platform) {
        this.logger.error('Pass the job UUID as the first argument when using --resume.')
        this.exitCode = 1
        return
      }
      await this.handleResume(importService, this.platform)
      return
    }

    // ---- Fresh import ----
    if (!this.platform) {
      this.logger.error(
        'Provide a platform slug (e.g. "zendesk"). Use --list to see available adapters.'
      )
      this.exitCode = 1
      return
    }

    await this.handleFreshImport(importService, this.platform)
  }

  // --------------------------------------------------------------------------
  // Handlers
  // --------------------------------------------------------------------------

  private async handleList() {
    const jobs = await ImportJob.query().orderBy('created_at', 'desc').limit(50)

    if (jobs.length === 0) {
      this.logger.info('No import jobs found.')
      return
    }

    this.logger.info('Recent import jobs:')
    this.logger.info('')

    for (const job of jobs) {
      const progress = job.progress
        ? Object.entries(job.progress)
            .map(([type, p]) => `${type}: ${p.processed}/${p.total ?? '?'}`)
            .join(', ')
        : 'no progress'

      this.logger.info(`  ${job.id}  platform=${job.platform}  status=${job.status}  [${progress}]`)
    }
  }

  private async handleResume(importService: ImportService, jobId: string) {
    const job = await ImportJob.find(jobId)

    if (!job) {
      this.logger.error(`Import job '${jobId}' not found.`)
      this.exitCode = 1
      return
    }

    if (!job.isResumable()) {
      this.logger.error(`Import job '${jobId}' cannot be resumed (current status: ${job.status}).`)
      this.exitCode = 1
      return
    }

    this.logger.info(`Resuming import job ${job.id} (platform: ${job.platform})…`)
    await this.runJob(importService, job)
  }

  private async handleFreshImport(importService: ImportService, platform: string) {
    // Verify adapter exists
    const adapter = await importService.resolveAdapter(platform)

    if (!adapter) {
      const adapters = await importService.availableAdapters()
      const names = adapters.map((a) => a.name()).join(', ') || 'none registered'
      this.logger.error(`No import adapter found for platform '${platform}'. Available: ${names}`)
      this.exitCode = 1
      return
    }

    // Build credentials from flags
    const credentials: Record<string, string> = {}
    if (this.token) credentials['token'] = this.token
    if (this.subdomain) credentials['subdomain'] = this.subdomain
    if (this.email) credentials['email'] = this.email
    if (this.apiKey) credentials['api_key'] = this.apiKey

    // Parse field mapping overrides
    let fieldMappings: Record<string, any> | null = null
    if (this.mapping) {
      try {
        fieldMappings = JSON.parse(this.mapping)
      } catch {
        this.logger.error('--mapping must be valid JSON.')
        this.exitCode = 1
        return
      }
    }

    // Create the job
    const job = await ImportJob.create({
      id: crypto.randomUUID(),
      platform,
      status: 'pending',
      credentials: Object.keys(credentials).length > 0 ? credentials : null,
      fieldMappings,
      progress: null,
      errorLog: null,
    })

    this.logger.info(`Created import job ${job.id} for platform '${platform}'.`)

    // Test connection
    this.logger.info('Testing connection…')
    await job.transitionTo('authenticating')

    try {
      const ok = await importService.testConnection(job)
      if (!ok) {
        await job.transitionTo('failed')
        this.logger.error('Connection test failed. Check your credentials.')
        this.exitCode = 1
        return
      }
    } catch (err: any) {
      await job.transitionTo('failed')
      this.logger.error(`Connection test error: ${err.message}`)
      this.exitCode = 1
      return
    }

    this.logger.success('Connection OK.')
    await job.transitionTo('mapping')

    await this.runJob(importService, job)
  }

  private async runJob(importService: ImportService, job: ImportJob) {
    this.logger.info('Starting import…')
    this.logger.info('')

    try {
      await importService.run(job, (entityType, progress) => {
        const pct =
          progress.total > 0 ? ` (${Math.round((progress.processed / progress.total) * 100)}%)` : ''
        this.logger.info(
          `  ${entityType}: processed=${progress.processed}  skipped=${progress.skipped}  failed=${progress.failed}${pct}`
        )
      })

      await job.refresh()

      if (job.status === 'completed') {
        this.logger.success(`\nImport completed successfully. Job ID: ${job.id}`)

        if (job.errorLog && job.errorLog.length > 0) {
          this.logger.warning(
            `  ${job.errorLog.length} record(s) failed. Review the error log on the import job.`
          )
        }
      } else if (job.status === 'paused') {
        this.logger.warning(
          `\nImport paused. Resume with: node ace escalated:import ${job.id} --resume`
        )
      }
    } catch (err: any) {
      this.logger.error(`\nImport failed: ${err.message}`)
      this.exitCode = 1
    }
  }
}

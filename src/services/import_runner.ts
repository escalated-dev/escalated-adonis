/*
|--------------------------------------------------------------------------
| ImportRunner
|--------------------------------------------------------------------------
|
| Runs an import outside the request that started it, as escalated-laravel
| queues ImportService::run. By default the run continues in this process
| after the response is sent. A host with a job queue takes it over by
| registering the `import.run_async` action:
|
|   escalated_addAction('import.run_async', (job) => queue.dispatch('import', job.id))
|
| and calling `runImportJob(id)` from its worker.
|
| A paused run returns early and is queued again by resume; the source maps
| make the second run skip whatever the first one already wrote.
|
*/

import ImportJob from '../models/import_job.js'
import ImportService from './import_service.js'
import { escalated_doAction, escalated_hasAction } from '../support/helpers.js'

const pending = new Set<Promise<void>>()

/** Run (or resume) the import job with this id. A failure marks it failed. */
export async function runImportJob(id: string): Promise<void> {
  const job = await ImportJob.find(id)
  if (!job || job.status === 'completed') return

  try {
    await new ImportService().run(job)
  } catch (error: any) {
    console.error(`[Escalated] Import job ${id} failed:`, error?.message ?? error)
    await ImportJob.query().where('id', id).update({ status: 'failed' })
  }
}

/** Queue `job` to run in the background. */
export async function dispatchImport(job: ImportJob): Promise<void> {
  if (escalated_hasAction('import.run_async')) {
    await escalated_doAction('import.run_async', job)
    return
  }

  const run = runImportJob(job.id).finally(() => pending.delete(run))
  pending.add(run)
}

/** Resolves once every in-process run started so far has finished. */
export async function importsSettled(): Promise<void> {
  while (pending.size > 0) await Promise.allSettled([...pending])
}

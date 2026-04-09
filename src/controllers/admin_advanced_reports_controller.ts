import { DateTime } from 'luxon'
import type { HttpContext } from '@adonisjs/core/http'
import { getRenderer } from '../rendering/renderer.js'
import AdvancedReportingService from '../services/advanced_reporting_service.js'
import ExportService from '../services/export_service.js'

export default class AdminAdvancedReportsController {
  private parsePeriod(request: HttpContext['request']) {
    const fromStr = request.input('from')
    const toStr = request.input('to')
    const from = fromStr ? DateTime.fromISO(fromStr) : DateTime.now().minus({ days: 30 })
    const to = toStr ? DateTime.fromISO(toStr) : DateTime.now()
    return {
      from: from.isValid ? from : DateTime.now().minus({ days: 30 }),
      to: to.isValid ? to : DateTime.now(),
    }
  }

  private getService(request: HttpContext['request']) {
    const { from, to } = this.parsePeriod(request)
    return { service: new AdvancedReportingService(from, to), from, to }
  }

  async slaBreachTrends(ctx: HttpContext) {
    const { service, from, to } = this.getService(ctx.request)
    const data = await service.slaBreachTrends()
    return getRenderer().render(ctx, 'Escalated/Admin/Reports/SlaTrends', {
      data,
      filters: { from: from.toISO(), to: to.toISO() },
    })
  }

  async frtDistribution(ctx: HttpContext) {
    const { service, from, to } = this.getService(ctx.request)
    const data = await service.frtDistribution()
    return getRenderer().render(ctx, 'Escalated/Admin/Reports/FrtDistribution', {
      data,
      filters: { from: from.toISO(), to: to.toISO() },
    })
  }

  async frtTrends(ctx: HttpContext) {
    const { service, from, to } = this.getService(ctx.request)
    const data = await service.frtTrends()
    return getRenderer().render(ctx, 'Escalated/Admin/Reports/FrtTrends', {
      data,
      filters: { from: from.toISO(), to: to.toISO() },
    })
  }

  async frtByAgent(ctx: HttpContext) {
    const { service, from, to } = this.getService(ctx.request)
    const data = await service.frtByAgent()
    return getRenderer().render(ctx, 'Escalated/Admin/Reports/FrtByAgent', {
      data,
      filters: { from: from.toISO(), to: to.toISO() },
    })
  }

  async resolutionDistribution(ctx: HttpContext) {
    const { service, from, to } = this.getService(ctx.request)
    const data = await service.resolutionTimeDistribution()
    return getRenderer().render(ctx, 'Escalated/Admin/Reports/ResolutionDistribution', {
      data,
      filters: { from: from.toISO(), to: to.toISO() },
    })
  }

  async resolutionTrends(ctx: HttpContext) {
    const { service, from, to } = this.getService(ctx.request)
    const data = await service.resolutionTimeTrends()
    return getRenderer().render(ctx, 'Escalated/Admin/Reports/ResolutionTrends', {
      data,
      filters: { from: from.toISO(), to: to.toISO() },
    })
  }

  async agentRanking(ctx: HttpContext) {
    const { service, from, to } = this.getService(ctx.request)
    const data = await service.agentPerformanceRanking()
    return getRenderer().render(ctx, 'Escalated/Admin/Reports/AgentRanking', {
      data,
      filters: { from: from.toISO(), to: to.toISO() },
    })
  }

  async cohort(ctx: HttpContext) {
    const dimension = ctx.request.input('dimension', 'department')
    const { service, from, to } = this.getService(ctx.request)
    const data = await service.cohortAnalysis(dimension)
    return getRenderer().render(ctx, 'Escalated/Admin/Reports/Cohort', {
      data,
      dimension,
      filters: { from: from.toISO(), to: to.toISO() },
    })
  }

  async comparison(ctx: HttpContext) {
    const { service, from, to } = this.getService(ctx.request)
    const data = await service.periodComparison()
    return getRenderer().render(ctx, 'Escalated/Admin/Reports/Comparison', {
      data,
      filters: { from: from.toISO(), to: to.toISO() },
    })
  }

  async export(ctx: HttpContext) {
    const { from, to } = this.parsePeriod(ctx.request)
    const reportType = ctx.request.input('report_type')
    const format = ctx.request.input('export_format', 'csv')
    const dimension = ctx.request.input('dimension')
    const svc = new ExportService(from, to)

    let content: string
    if (dimension) {
      content =
        format === 'json'
          ? await svc.exportCohortJson(dimension)
          : await svc.exportCohortCsv(dimension)
    } else {
      content =
        format === 'json' ? await svc.exportJson(reportType) : await svc.exportCsv(reportType)
    }

    const contentType = format === 'json' ? 'application/json' : 'text/csv'
    const filename = `${reportType || 'cohort'}_${DateTime.now().toFormat('yyyyMMdd')}.${format}`
    ctx.response.header('Content-Type', contentType)
    ctx.response.header('Content-Disposition', `attachment; filename="${filename}"`)
    return ctx.response.send(content)
  }
}

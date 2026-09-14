import { DateTime } from 'luxon'
import type { HttpContext } from '@adonisjs/core/http'
import { getRenderer } from '../rendering/renderer.js'
import AdvancedReportingService from '../services/advanced_reporting_service.js'
import ExportService from '../services/export_service.js'
import ReportScreenMetrics from '../services/report_screen_metrics.js'

/**
 * The advanced report screens.
 *
 * Each action renders a component from @escalated-dev/escalated, and Inertia
 * passes props by name: a name the component does not declare is not passed at
 * all. Every action here used to send `{ data, filters }`, which no report
 * component reads, so each screen rendered its defaults -- zeroes and empty
 * charts, on a 200. That is indistinguishable from a quiet period, which is why
 * it went unnoticed.
 *
 * The frontend also has one first-response screen and one resolution screen,
 * where this had three and two. The old paths redirect rather than 404, having
 * been in the routes long enough to be linked.
 */
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
    const service = new AdvancedReportingService(from, to)

    return {
      service,
      screen: new ReportScreenMetrics(service, from, to),
      from,
      to,
      // The screens take a day count and send one back when the period changes;
      // this controller works in timestamps.
      days: Math.max(Math.round(to.diff(from, 'days').days), 1),
    }
  }

  async slaBreachTrends(ctx: HttpContext) {
    const { service, screen, days } = this.getService(ctx.request)
    const counts = await screen.slaBreachCounts()
    const trend = await service.slaBreachTrends()

    return getRenderer().render(ctx, 'Escalated/Admin/Reports/SlaTrends', {
      period_days: days,
      breach_trend: trend.map((row) => ({
        label: row.date,
        value: row.frt_breaches + row.resolution_breaches,
      })),
      breach_by_type_trend: trend.map((row) => ({
        label: row.date,
        values: [row.frt_breaches, row.resolution_breaches],
      })),
      breach_by_department: await screen.slaBreachByDepartment(),
      breach_by_priority: await screen.slaBreachByPriority(),
      at_risk_tickets: await screen.atRiskTickets(),
      total_breaches: counts.total,
      breach_rate: counts.rate,
      first_response_breaches: counts.first_response,
      resolution_breaches: counts.resolution,
    })
  }

  async responseTimes(ctx: HttpContext) {
    const { service, screen, days } = this.getService(ctx.request)
    const summary = await screen.frtSummary()

    return getRenderer().render(ctx, 'Escalated/Admin/Reports/ResponseTimes', {
      period_days: days,
      avg_frt: summary.avg,
      median_frt: summary.median,
      p90_frt: summary.p90,
      pct_under_target: summary.pct_under_target,
      target_hours: ReportScreenMetrics.FIRST_RESPONSE_TARGET_HOURS,
      distribution: ReportScreenMetrics.distributionSeries(await service.frtDistribution()),
      trend: ReportScreenMetrics.chartSeries(await service.frtTrends(), 'date', 'avg_hours'),
      by_agent: ReportScreenMetrics.agentTimeRows(await service.frtByAgent()),
      by_department: await screen.frtByDepartment(),
      by_priority: await screen.frtByPriority(),
    })
  }

  async resolutionTimes(ctx: HttpContext) {
    const { service, screen, days } = this.getService(ctx.request)
    const summary = await screen.resolutionSummary()

    return getRenderer().render(ctx, 'Escalated/Admin/Reports/ResolutionTimes', {
      period_days: days,
      avg_resolution: summary.avg,
      median_resolution: summary.median,
      p90_resolution: summary.p90,
      pct_under_target: summary.pct_under_target,
      target_hours: ReportScreenMetrics.RESOLUTION_TARGET_HOURS,
      distribution: ReportScreenMetrics.distributionSeries(
        await service.resolutionTimeDistribution()
      ),
      trend: ReportScreenMetrics.chartSeries(
        await service.resolutionTimeTrends(),
        'date',
        'avg_hours'
      ),
      by_agent: ReportScreenMetrics.agentTimeRows(await screen.resolutionByAgent()),
      by_department: await screen.resolutionByDepartment(),
      by_channel: await screen.resolutionByChannel(),
    })
  }

  async agentRanking(ctx: HttpContext) {
    const { service, days } = this.getService(ctx.request)

    return getRenderer().render(ctx, 'Escalated/Admin/Reports/AgentRanking', {
      period_days: days,
      agents: ReportScreenMetrics.agentRankingRows(await service.agentPerformanceRanking()),
    })
  }

  async cohorts(ctx: HttpContext) {
    const { service, days } = this.getService(ctx.request)

    // The screen shows every dimension at once, in tabs. This served one at a
    // time, chosen by a query parameter the screen does not send.
    return getRenderer().render(ctx, 'Escalated/Admin/Reports/Cohorts', {
      period_days: days,
      by_tag: ReportScreenMetrics.cohortRows(await service.cohortAnalysis('tag')),
      by_department: ReportScreenMetrics.cohortRows(await service.cohortAnalysis('department')),
      by_channel: ReportScreenMetrics.cohortRows(await service.cohortAnalysis('channel')),
      by_type: ReportScreenMetrics.cohortRows(await service.cohortAnalysis('type')),
      by_priority: ReportScreenMetrics.cohortRows(await service.cohortAnalysis('priority')),
    })
  }

  async comparison(ctx: HttpContext) {
    const { service, screen, from, to, days } = this.getService(ctx.request)
    const data = await service.periodComparison()
    const duration = to.diff(from, 'milliseconds').milliseconds

    return getRenderer().render(ctx, 'Escalated/Admin/Reports/Comparison', {
      period_days: days,
      current: ReportScreenMetrics.comparisonSide(
        data.current,
        await screen.volumeByDate(from, to)
      ),
      previous: ReportScreenMetrics.comparisonSide(
        data.previous,
        await screen.volumeByDate(from.minus({ milliseconds: duration }), from)
      ),
    })
  }

  /**
   * Where a retired report path now leads, under whatever prefix the host
   * mounted Escalated on.
   */
  private screenPath(ctx: HttpContext, screen: string) {
    return ctx.request.url().replace(/\/reports\/advanced\/[a-z-]+$/, `/reports/advanced/${screen}`)
  }

  // The first-response screen was three paths and the resolution screen two.
  // Both are one screen in the frontend; these keep the old links working.
  async frtDistribution(ctx: HttpContext) {
    return ctx.response.redirect(this.screenPath(ctx, 'response-times'))
  }

  async frtTrends(ctx: HttpContext) {
    return ctx.response.redirect(this.screenPath(ctx, 'response-times'))
  }

  async frtByAgent(ctx: HttpContext) {
    return ctx.response.redirect(this.screenPath(ctx, 'response-times'))
  }

  async resolutionDistribution(ctx: HttpContext) {
    return ctx.response.redirect(this.screenPath(ctx, 'resolution-times'))
  }

  async resolutionTrends(ctx: HttpContext) {
    return ctx.response.redirect(this.screenPath(ctx, 'resolution-times'))
  }

  async cohort(ctx: HttpContext) {
    return ctx.response.redirect(this.screenPath(ctx, 'cohorts'))
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

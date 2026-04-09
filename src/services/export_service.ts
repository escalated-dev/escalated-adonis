import { type DateTime } from 'luxon'
import AdvancedReportingService from './advanced_reporting_service.js'

export default class ExportService {
  static EXPORTABLE_REPORTS = [
    'slaBreachTrends',
    'frtDistribution',
    'frtTrends',
    'frtByAgent',
    'resolutionTimeDistribution',
    'resolutionTimeTrends',
    'agentPerformanceRanking',
    'periodComparison',
  ] as const

  private reporting: AdvancedReportingService

  constructor(from: DateTime, to: DateTime) {
    this.reporting = new AdvancedReportingService(from, to)
  }

  async exportCsv(reportType: string): Promise<string> {
    this.validateReportType(reportType)
    const data = await (this.reporting as any)[reportType]()
    const rows = this.flattenForCsv(data, reportType)
    return this.generateCsv(rows)
  }

  async exportJson(reportType: string): Promise<string> {
    this.validateReportType(reportType)
    const data = await (this.reporting as any)[reportType]()
    return JSON.stringify(data, null, 2)
  }

  async exportCohortCsv(dimension: string): Promise<string> {
    const data = await this.reporting.cohortAnalysis(dimension)
    const rows = this.flattenForCsv(data, 'cohort')
    return this.generateCsv(rows)
  }

  async exportCohortJson(dimension: string): Promise<string> {
    const data = await this.reporting.cohortAnalysis(dimension)
    return JSON.stringify(data, null, 2)
  }

  private validateReportType(reportType: string) {
    if (!ExportService.EXPORTABLE_REPORTS.includes(reportType as any)) {
      throw new Error(`Unknown report type: ${reportType}`)
    }
  }

  private flattenForCsv(data: any, _reportType: string): Record<string, any>[] {
    if (Array.isArray(data)) return data.map((row: any) => this.flattenHash(row))
    if (typeof data === 'object' && data !== null) {
      if (data.stats) {
        return [{ ...this.flattenHash(data.stats), ...this.flattenHash(data.percentiles || {}) }]
      }
      if (data.current) {
        return [
          {
            ...this.flattenHash(data.current, 'current'),
            ...this.flattenHash(data.previous || {}, 'previous'),
            ...this.flattenHash(data.changes || {}, 'change'),
          },
        ]
      }
      return [this.flattenHash(data)]
    }
    return []
  }

  private flattenHash(obj: any, prefix?: string): Record<string, any> {
    const result: Record<string, any> = {}
    if (!obj || typeof obj !== 'object') return result
    for (const [key, value] of Object.entries(obj)) {
      const fullKey = prefix ? `${prefix}_${key}` : key
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        Object.assign(result, this.flattenHash(value, fullKey))
      } else {
        result[fullKey] = value
      }
    }
    return result
  }

  private generateCsv(rows: Record<string, any>[]): string {
    if (rows.length === 0) return ''
    const headers = [...new Set(rows.flatMap((r) => Object.keys(r)))]
    const lines = [headers.join(',')]
    for (const row of rows) {
      lines.push(headers.map((h) => this.escapeCsv(row[h])).join(','))
    }
    return lines.join('\n')
  }

  private escapeCsv(val: any): string {
    if (val === null || val === undefined) return ''
    const str = String(val)
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`
    }
    return str
  }
}

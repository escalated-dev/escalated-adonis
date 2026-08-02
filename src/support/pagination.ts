/*
|--------------------------------------------------------------------------
| Laravel-shaped pagination
|--------------------------------------------------------------------------
|
| The Escalated Inertia pages are shared verbatim with the Laravel reference
| plugin, so list endpoints must hand the Vue components a Laravel paginator
| (`{ data, current_page, last_page, per_page, total, links, ... }`) rather
| than the Adonis `{ meta, data }` shape.
|
| `admin_users_controller.ts` shipped a private version of this shim; this is
| the shared, reusable extraction so other admin list controllers (audit log,
| ...) render against the same contract without duplicating the mapping.
|
*/

/** Minimal slice of an Adonis Lucid paginator this shim reads. */
export interface PaginatorLike {
  currentPage?: number
  lastPage?: number
  perPage?: number
  total?: number
  getTotal?: () => number
}

/** A single Laravel-style pagination link. */
export interface PaginationLink {
  url: string | null
  label: string
  active: boolean
}

/**
 * Build a Laravel-paginator-shaped payload from an Adonis paginator, the mapped
 * page rows, a base URL, and any extra query params to preserve across pages.
 */
export function laravelPaginatorShape<T>(
  paginator: PaginatorLike,
  data: T[],
  baseUrl: string,
  extraQuery: Record<string, string | number | undefined> = {}
): Record<string, any> {
  const currentPage = paginator.currentPage ?? 1
  const lastPage = paginator.lastPage ?? 1
  const perPage = paginator.perPage ?? data.length
  const total =
    paginator.total ??
    (typeof paginator.getTotal === 'function' ? paginator.getTotal() : data.length)

  const buildUrl = (page: number | null): string | null => {
    if (page === null) return null
    const params = new URLSearchParams()
    for (const [k, v] of Object.entries(extraQuery)) {
      if (v !== undefined && v !== null && v !== '') {
        params.set(k, String(v))
      }
    }
    params.set('page', String(page))
    const qs = params.toString()
    return qs ? `${baseUrl}?${qs}` : baseUrl
  }

  const links: PaginationLink[] = []
  links.push({
    url: currentPage > 1 ? buildUrl(currentPage - 1) : null,
    label: '&laquo; Previous',
    active: false,
  })
  for (let p = 1; p <= lastPage; p++) {
    links.push({ url: buildUrl(p), label: String(p), active: p === currentPage })
  }
  links.push({
    url: currentPage < lastPage ? buildUrl(currentPage + 1) : null,
    label: 'Next &raquo;',
    active: false,
  })

  return {
    data,
    current_page: currentPage,
    last_page: lastPage,
    per_page: perPage,
    total,
    from: data.length > 0 ? (currentPage - 1) * perPage + 1 : null,
    to: data.length > 0 ? (currentPage - 1) * perPage + data.length : null,
    first_page_url: buildUrl(1),
    last_page_url: buildUrl(lastPage),
    next_page_url: currentPage < lastPage ? buildUrl(currentPage + 1) : null,
    prev_page_url: currentPage > 1 ? buildUrl(currentPage - 1) : null,
    path: baseUrl,
    links,
  }
}

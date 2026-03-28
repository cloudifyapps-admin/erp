/**
 * Normalize paginated API response to a consistent format.
 * Backend APIs may return { items: [...] } or { data: [...] }.
 */
export function normalizePaginated<T>(response: any): {
  items: T[]
  total: number
  page: number
  per_page: number
  pages: number
} {
  const items = response.items ?? response.data ?? response.results ?? []
  return {
    items: Array.isArray(items) ? items : [],
    total: response.total ?? response.count ?? 0,
    page: response.page ?? 1,
    per_page: response.per_page ?? 25,
    pages: response.pages ?? response.total_pages ?? 1,
  }
}

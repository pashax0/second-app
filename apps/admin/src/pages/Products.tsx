import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useRealtimeInvalidation } from '../lib/useRealtimeInvalidation'

interface ProductImage {
  storage_path: string
  position: number
}

interface Product {
  id: string
  name: string
  brand: string | null
  size: string | null
  item_number: string | null
  price: number
  status: 'in_stock' | 'listed' | 'sold' | 'written_off'
  is_scheduled: boolean
  is_returned_to_stock: boolean
  is_in_cart: boolean
  has_pending_return: boolean
  product_images: ProductImage[]
}

type Tab = 'all' | 'in_stock' | 'listed' | 'sold' | 'written_off'
type SubFilter = 'scheduled' | 'returned' | 'in_cart' | 'pending_return' | null

const SUB_FILTERS_BY_TAB: Record<Tab, SubFilter[]> = {
  all:         ['scheduled', 'returned', 'in_cart'],
  in_stock:    ['scheduled', 'returned'],
  listed:      ['in_cart'],
  sold:        ['pending_return'],
  written_off: [],
}

const SUB_FILTER_LABEL: Record<NonNullable<SubFilter>, string> = {
  scheduled:      'Scheduled',
  returned:       'Returned',
  in_cart:        'In cart',
  pending_return: 'Pending return',
}

const SUB_FILTER_COLUMN: Record<NonNullable<SubFilter>, keyof Product> = {
  scheduled:      'is_scheduled',
  returned:       'is_returned_to_stock',
  in_cart:        'is_in_cart',
  pending_return: 'has_pending_return',
}

const PAGE_SIZE = 30

interface ProductsQuery {
  tab: Tab
  search: string
  page: number
  subFilter: SubFilter
}

interface ProductsResult {
  rows: Product[]
  total: number
}

async function fetchProducts({ tab, search, page, subFilter }: ProductsQuery): Promise<ProductsResult> {
  let query = supabase
    .from('products_with_flags')
    .select(
      'id, name, brand, size, item_number, price, status, is_scheduled, is_returned_to_stock, is_in_cart, has_pending_return, product_images(storage_path, position)',
      { count: 'exact' },
    )
    .order('created_at', { ascending: false })

  if (tab === 'all') query = query.not('status', 'in', '(sold,written_off)')
  else query = query.eq('status', tab)

  if (subFilter) {
    query = query.eq(SUB_FILTER_COLUMN[subFilter], true)
  }

  const term = search.trim()
  if (term) {
    const like = `%${term}%`
    query = query.or(
      `name.ilike.${like},brand.ilike.${like},item_number.ilike.${like}`,
    )
  }

  const from = page * PAGE_SIZE
  const to = from + PAGE_SIZE - 1
  const { data, error, count } = await query.range(from, to)

  if (error) throw error
  return {
    rows: (data ?? []) as unknown as Product[],
    total: count ?? 0,
  }
}

async function deleteProduct(id: string) {
  const { error } = await supabase.rpc('delete_product', { p_id: id })
  if (error) throw error
}

const STATUS_LABEL: Record<Product['status'], string> = {
  in_stock: 'In stock',
  listed: 'Listed',
  sold: 'Sold',
  written_off: 'Written off',
}

const STATUS_CLS: Record<Product['status'], string> = {
  in_stock: 'bg-gray-100 text-gray-600',
  listed: 'bg-green-100 text-green-700',
  sold: 'bg-red-100 text-red-600',
  written_off: 'bg-gray-200 text-gray-500',
}

const TABS: { value: Tab; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'in_stock', label: 'In stock' },
  { value: 'listed', label: 'Listed' },
  { value: 'sold', label: 'Sold' },
  { value: 'written_off', label: 'Written off' },
]

function useDebounced<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(id)
  }, [value, delay])
  return debounced
}

export default function Products() {
  const queryClient = useQueryClient()
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('all')
  const [subFilter, setSubFilter] = useState<SubFilter>(null)
  const [searchInput, setSearchInput] = useState('')
  const search = useDebounced(searchInput, 300)
  const [page, setPage] = useState(0)

  useEffect(() => {
    setPage(0)
  }, [tab, search, subFilter])

  // Reset sub-filter when switching to a tab where it doesn't apply
  useEffect(() => {
    if (subFilter && !SUB_FILTERS_BY_TAB[tab].includes(subFilter)) {
      setSubFilter(null)
    }
  }, [tab, subFilter])

  const queryKey = useMemo(
    () => ['products', { tab, search, page, subFilter }] as const,
    [tab, search, page, subFilter],
  )

  const { data, isLoading, error, isFetching } = useQuery({
    queryKey,
    queryFn: () => fetchProducts({ tab, search, page, subFilter }),
    placeholderData: keepPreviousData,
  })

  useRealtimeInvalidation(
    [
      { table: 'products' },
      { table: 'drop_items' },
      { table: 'reservations' },
      { table: 'product_images' },
    ],
    [['products']],
  )

  const rows = data?.rows ?? []
  const total = data?.total ?? 0
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const rangeFrom = total === 0 ? 0 : page * PAGE_SIZE + 1
  const rangeTo = Math.min(total, page * PAGE_SIZE + rows.length)

  const deleteMutation = useMutation({
    mutationFn: deleteProduct,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['products'] }),
  })

  async function handleDelete(id: string) {
    if (!confirm('Delete this product?')) return
    setDeletingId(id)
    try {
      await deleteMutation.mutateAsync(id)
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Products</h1>
        <Link
          to="/products/new"
          className="px-4 py-2 bg-gray-900 text-white text-sm rounded hover:bg-gray-700"
        >
          New Product
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div role="tablist" className="inline-flex rounded border border-gray-200 overflow-hidden">
          {TABS.map((t) => {
            const active = tab === t.value
            return (
              <button
                key={t.value}
                role="tab"
                aria-selected={active}
                onClick={() => setTab(t.value)}
                className={`px-3 py-1.5 text-sm border-r border-gray-200 last:border-r-0 ${
                  active ? 'bg-gray-900 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                {t.label}
              </button>
            )
          })}
        </div>

        <input
          type="search"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search by name, brand or #"
          className="flex-1 min-w-[220px] border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
        />
      </div>

      {SUB_FILTERS_BY_TAB[tab].length > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-4">
          {SUB_FILTERS_BY_TAB[tab].map((f) => {
            if (f === null) return null
            const active = subFilter === f
            return (
              <button
                key={f}
                onClick={() => setSubFilter(active ? null : f)}
                className={`px-2.5 py-1 text-xs rounded-full border ${
                  active
                    ? 'bg-gray-900 text-white border-gray-900'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
              >
                {SUB_FILTER_LABEL[f]}
              </button>
            )
          })}
        </div>
      )}

      {isLoading && <p className="text-sm text-gray-500">Loading…</p>}

      {error && (
        <p className="text-sm text-red-600">{(error as Error).message}</p>
      )}

      {!isLoading && !error && rows.length === 0 && (
        <p className="text-sm text-gray-500">No products match your filters.</p>
      )}

      {rows.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500">
                <th className="pb-2 pr-4 w-14">Photo</th>
                <th className="pb-2 pr-4">Brand</th>
                <th className="pb-2 pr-4">Size</th>
                <th className="pb-2 pr-4">Price</th>
                <th className="pb-2 pr-4">Status</th>
                <th className="pb-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((p) => {
                const thumb = [...p.product_images]
                  .sort((a, b) => a.position - b.position)[0]

                return (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="py-2 pr-4">
                      {thumb ? (
                        <img
                          src={supabase.storage.from('product-images').getPublicUrl(thumb.storage_path).data.publicUrl}
                          alt=""
                          className="h-12 w-12 object-cover rounded border border-gray-200"
                        />
                      ) : (
                        <div className="h-12 w-12 rounded border border-gray-200 bg-gray-100" />
                      )}
                    </td>
                    <td className="py-2 pr-4 font-medium text-gray-900">
                      {p.brand ?? '—'}
                    </td>
                    <td className="py-2 pr-4 text-gray-600">{p.size ?? '—'}</td>
                    <td className="py-2 pr-4 text-gray-900">{p.price} ₴</td>
                    <td className="py-2 pr-4">
                      <div className="flex flex-wrap gap-1">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${STATUS_CLS[p.status]}`}
                        >
                          {STATUS_LABEL[p.status]}
                        </span>
                        {p.is_in_cart && (
                          <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                            In cart
                          </span>
                        )}
                        {p.is_scheduled && (
                          <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">
                            Scheduled
                          </span>
                        )}
                        {p.is_returned_to_stock && p.status === 'in_stock' && (
                          <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-gray-200 text-gray-700">
                            Returned
                          </span>
                        )}
                        {p.has_pending_return && (
                          <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-700">
                            Pending return
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-2 text-right whitespace-nowrap">
                      <Link
                        to={`/products/${p.id}/edit`}
                        className="text-xs text-gray-600 hover:text-gray-900 mr-3"
                      >
                        Edit
                      </Link>
                      {p.status === 'in_stock' && (
                        <button
                          onClick={() => handleDelete(p.id)}
                          disabled={deletingId === p.id}
                          className="text-xs text-red-500 hover:text-red-700 disabled:opacity-40"
                        >
                          {deletingId === p.id ? 'Deleting…' : 'Delete'}
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {total > PAGE_SIZE && (
        <div className="flex items-center justify-between mt-4 text-sm text-gray-600">
          <span>
            {rangeFrom}–{rangeTo} of {total}
            {isFetching && <span className="ml-2 text-gray-400">updating…</span>}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="px-3 py-1 border border-gray-300 rounded disabled:opacity-40 hover:bg-gray-50"
            >
              Prev
            </button>
            <button
              onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
              disabled={page >= pageCount - 1}
              className="px-3 py-1 border border-gray-300 rounded disabled:opacity-40 hover:bg-gray-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

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
  product_images: ProductImage[]
}

type Tab = 'all' | 'in_stock' | 'listed' | 'sold' | 'written_off'

const PAGE_SIZE = 30

interface ProductsQuery {
  tab: Tab
  search: string
  page: number
}

interface ProductsResult {
  rows: Product[]
  total: number
}

async function fetchProducts({ tab, search, page }: ProductsQuery): Promise<ProductsResult> {
  let query = supabase
    .from('products')
    .select(
      'id, name, brand, size, item_number, price, status, product_images(storage_path, position)',
      { count: 'exact' },
    )
    .order('created_at', { ascending: false })

  if (tab === 'all') query = query.not('status', 'in', '(sold,written_off)')
  else query = query.eq('status', tab)

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
  const { error } = await supabase.from('products').delete().eq('id', id)
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
  const [searchInput, setSearchInput] = useState('')
  const search = useDebounced(searchInput, 300)
  const [page, setPage] = useState(0)

  useEffect(() => {
    setPage(0)
  }, [tab, search])

  const queryKey = useMemo(
    () => ['products', { tab, search, page }] as const,
    [tab, search, page],
  )

  const { data, isLoading, error, isFetching } = useQuery({
    queryKey,
    queryFn: () => fetchProducts({ tab, search, page }),
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
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${STATUS_CLS[p.status]}`}
                      >
                        {STATUS_LABEL[p.status]}
                      </span>
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

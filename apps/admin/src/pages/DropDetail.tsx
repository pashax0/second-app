import { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Drop {
  id: string
  title: string | null
  description: string | null
  status: 'scheduled' | 'active' | 'archived'
  scheduled_at: string
  published_at: string | null
}

interface ProductImage {
  storage_path: string
  position: number
}

interface DropItemRow {
  id: string
  position: number
  override_price: number | null
  compare_at_price: number | null
  product: {
    id: string
    name: string
    brand: string | null
    size: string | null
    price: number
    status: 'in_stock' | 'listed' | 'sold' | 'written_off'
    product_images: ProductImage[]
  }
}

interface OrderItemRow {
  product_id: string
  price_at_purchase: number
  order: { drop_id: string | null }
}

interface ReservationRow {
  product_id: string
  expires_at: string
}

// ── Data fetching ─────────────────────────────────────────────────────────────

async function fetchDrop(dropId: string): Promise<Drop> {
  const { data, error } = await supabase
    .from('drops')
    .select('id, title, description, status, scheduled_at, published_at')
    .eq('id', dropId)
    .single()
  if (error) throw error
  return data as Drop
}

async function fetchDropItems(dropId: string): Promise<DropItemRow[]> {
  const { data, error } = await supabase
    .from('drop_items')
    .select(`
      id, position, override_price, compare_at_price,
      product:products(
        id, name, brand, size, price, status,
        product_images(storage_path, position)
      )
    `)
    .eq('drop_id', dropId)
    .order('position')
  if (error) throw error
  return (data ?? []) as unknown as DropItemRow[]
}

async function fetchOrderItems(productIds: string[]): Promise<OrderItemRow[]> {
  if (productIds.length === 0) return []
  const { data, error } = await supabase
    .from('order_items')
    .select('product_id, price_at_purchase, order:orders(drop_id)')
    .in('product_id', productIds)
  if (error) throw error
  return (data ?? []) as unknown as OrderItemRow[]
}

async function fetchReservations(productIds: string[]): Promise<ReservationRow[]> {
  if (productIds.length === 0) return []
  const { data, error } = await supabase
    .from('reservations')
    .select('product_id, expires_at')
    .in('product_id', productIds)
    .gt('expires_at', new Date().toISOString())
  if (error) throw error
  return data ?? []
}

interface AvailableProduct {
  id: string
  name: string
  brand: string | null
  size: string | null
  item_number: string | null
  price: number
  product_images: ProductImage[]
}

async function fetchAvailableProducts(): Promise<AvailableProduct[]> {
  const { data, error } = await supabase
    .from('products_with_flags')
    .select('id, name, brand, size, item_number, price, product_images(storage_path, position)')
    .eq('status', 'in_stock')
    .eq('is_scheduled', false)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as unknown as AvailableProduct[]
}

function useDebounced<T>(value: T, delay = 250): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(id)
  }, [value, delay])
  return debounced
}

// ── Item status logic ─────────────────────────────────────────────────────────

type DisplayStatus =
  | { kind: 'listed' }
  | { kind: 'reserved'; expiresAt: string }
  | { kind: 'sold_here'; price: number }
  | { kind: 'sold_elsewhere' }
  | { kind: 'withdrawn' }
  | { kind: 'returned' }

function resolveStatus(
  item: DropItemRow,
  dropId: string,
  orderMap: Map<string, OrderItemRow>,
  reservationMap: Map<string, ReservationRow>,
): DisplayStatus {
  const { status } = item.product
  const pid = item.product.id

  if (status === 'sold') {
    const oi = orderMap.get(pid)
    if (oi) {
      const orderDrop = (oi.order as unknown as { drop_id: string | null }).drop_id
      return orderDrop === dropId
        ? { kind: 'sold_here', price: oi.price_at_purchase }
        : { kind: 'sold_elsewhere' }
    }
    return { kind: 'sold_elsewhere' }
  }

  if (status === 'listed') {
    const res = reservationMap.get(pid)
    return res ? { kind: 'reserved', expiresAt: res.expires_at } : { kind: 'listed' }
  }

  // in_stock here = was in this drop but not sold when archived
  return { kind: 'returned' }
}

const STATUS_LABEL: Record<DisplayStatus['kind'], string> = {
  listed: 'Listed',
  reserved: 'Reserved',
  sold_here: 'Sold here',
  sold_elsewhere: 'Sold elsewhere',
  withdrawn: 'Withdrawn',
  returned: 'Returned',
}

const STATUS_CLS: Record<DisplayStatus['kind'], string> = {
  listed: 'bg-green-100 text-green-700',
  reserved: 'bg-yellow-100 text-yellow-700',
  sold_here: 'bg-blue-100 text-blue-700',
  sold_elsewhere: 'bg-gray-100 text-gray-400',
  withdrawn: 'bg-gray-100 text-gray-400',
  returned: 'bg-gray-100 text-gray-400',
}

const DROP_STATUS_CLS: Record<Drop['status'], string> = {
  scheduled: 'bg-gray-100 text-gray-600',
  active: 'bg-green-100 text-green-700',
  archived: 'bg-gray-100 text-gray-400',
}

function canRemove(dropStatus: Drop['status'], ds: DisplayStatus): boolean {
  if (dropStatus === 'scheduled') return true
  if (dropStatus === 'active') return ds.kind === 'listed' || ds.kind === 'reserved'
  return false
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function DropDetail() {
  const { id: dropId } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data: drop, isLoading: loadingDrop, error: dropError } = useQuery({
    queryKey: ['drop', dropId],
    queryFn: () => fetchDrop(dropId!),
    enabled: !!dropId,
  })

  const { data: items = [], isLoading: loadingItems } = useQuery({
    queryKey: ['drop-items', dropId],
    queryFn: () => fetchDropItems(dropId!),
    enabled: !!dropId,
  })

  const isScheduled = drop?.status === 'scheduled'

  const { data: availableProducts = [], isLoading: loadingAvailable } = useQuery({
    queryKey: ['available-products-for-drop'],
    queryFn: fetchAvailableProducts,
    enabled: isScheduled,
  })

  const [searchInput, setSearchInput] = useState('')
  const search = useDebounced(searchInput, 250)
  const [addingId, setAddingId] = useState<string | null>(null)
  const [addError, setAddError] = useState<string | null>(null)

  const filteredAvailable = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return availableProducts
    return availableProducts.filter((p) => {
      const haystack = [p.name, p.brand, p.item_number]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return haystack.includes(term)
    })
  }, [availableProducts, search])

  async function handleAdd(productId: string) {
    if (!dropId) return
    setAddError(null)
    setAddingId(productId)
    try {
      const { error } = await supabase.rpc('publish_product', {
        p_id: productId,
        p_drop_id: dropId,
      })
      if (error) throw error
      await queryClient.invalidateQueries({ queryKey: ['drop-items', dropId] })
      await queryClient.invalidateQueries({ queryKey: ['available-products-for-drop'] })
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'Failed to add product')
    } finally {
      setAddingId(null)
    }
  }

  const [removingId, setRemovingId] = useState<string | null>(null)
  const [removeError, setRemoveError] = useState<string | null>(null)

  const [priceError, setPriceError] = useState<string | null>(null)

  async function handleOverridePrice(item: DropItemRow, raw: string) {
    if (!dropId) return
    const trimmed = raw.trim()
    const next = trimmed && Number(trimmed) > 0 ? Number(trimmed) : null
    if (next === item.override_price) return
    setPriceError(null)
    try {
      const { error } = await supabase
        .from('drop_items')
        .update({ override_price: next })
        .eq('id', item.id)
      if (error) throw error
      await queryClient.invalidateQueries({ queryKey: ['drop-items', dropId] })
    } catch (err) {
      setPriceError(err instanceof Error ? err.message : 'Failed to save price')
    }
  }

  async function handleCompareAtPrice(item: DropItemRow, raw: string) {
    if (!dropId) return
    const trimmed = raw.trim()
    const next = trimmed && Number(trimmed) > 0 ? Number(trimmed) : null
    if (next === item.compare_at_price) return
    setPriceError(null)
    try {
      const { error } = await supabase
        .from('drop_items')
        .update({ compare_at_price: next })
        .eq('id', item.id)
      if (error) throw error
      await queryClient.invalidateQueries({ queryKey: ['drop-items', dropId] })
    } catch (err) {
      setPriceError(err instanceof Error ? err.message : 'Failed to save price')
    }
  }

  const [archiving, setArchiving] = useState(false)
  const [archiveError, setArchiveError] = useState<string | null>(null)

  const [movingId, setMovingId] = useState<string | null>(null)
  const [moveError, setMoveError] = useState<string | null>(null)

  async function handleMove(item: DropItemRow, direction: 'up' | 'down') {
    if (!dropId || drop?.status !== 'scheduled') return
    const idx = items.findIndex((i) => i.id === item.id)
    if (idx < 0) return
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1
    if (targetIdx < 0 || targetIdx >= items.length) return
    const target = items[targetIdx]
    setMoveError(null)
    setMovingId(item.id)
    try {
      const { error: e1 } = await supabase
        .from('drop_items')
        .update({ position: target.position })
        .eq('id', item.id)
      if (e1) throw e1
      const { error: e2 } = await supabase
        .from('drop_items')
        .update({ position: item.position })
        .eq('id', target.id)
      if (e2) throw e2
      await queryClient.invalidateQueries({ queryKey: ['drop-items', dropId] })
    } catch (err) {
      setMoveError(err instanceof Error ? err.message : 'Failed to reorder')
    } finally {
      setMovingId(null)
    }
  }

  async function handleArchive() {
    if (!dropId || !drop || drop.status !== 'active') return
    const unsold = items.filter((i) => i.product.status === 'listed').length
    const msg = unsold > 0
      ? `Archive this drop? ${unsold} unsold item${unsold === 1 ? '' : 's'} will return to stock.`
      : 'Archive this drop?'
    if (!confirm(msg)) return
    setArchiveError(null)
    setArchiving(true)
    try {
      const { error } = await supabase.rpc('archive_drop', { p_drop_id: dropId })
      if (error) throw error
      await queryClient.invalidateQueries({ queryKey: ['drop', dropId] })
      await queryClient.invalidateQueries({ queryKey: ['drop-items', dropId] })
      await queryClient.invalidateQueries({ queryKey: ['drops'] })
      await queryClient.invalidateQueries({ queryKey: ['products'] })
    } catch (err) {
      setArchiveError(err instanceof Error ? err.message : 'Failed to archive')
    } finally {
      setArchiving(false)
    }
  }

  async function handleRemove(item: DropItemRow) {
    if (!dropId || !drop) return
    if (!confirm('Remove this product from the drop?')) return
    setRemoveError(null)
    setRemovingId(item.id)
    try {
      if (drop.status === 'active') {
        const { error } = await supabase.rpc('withdraw_product', {
          p_id: item.product.id,
        })
        if (error) throw error
      } else if (drop.status === 'scheduled') {
        const { error } = await supabase
          .from('drop_items')
          .delete()
          .eq('id', item.id)
        if (error) throw error
      } else {
        return
      }
      await queryClient.invalidateQueries({ queryKey: ['drop-items', dropId] })
      await queryClient.invalidateQueries({ queryKey: ['available-products-for-drop'] })
      await queryClient.invalidateQueries({ queryKey: ['products'] })
    } catch (err) {
      setRemoveError(err instanceof Error ? err.message : 'Failed to remove')
    } finally {
      setRemovingId(null)
    }
  }

  const soldIds = items.filter(i => i.product.status === 'sold').map(i => i.product.id)
  const listedIds = items.filter(i => i.product.status === 'listed').map(i => i.product.id)

  const { data: orderItems = [] } = useQuery({
    queryKey: ['order-items-for-drop', dropId, soldIds],
    queryFn: () => fetchOrderItems(soldIds),
    enabled: soldIds.length > 0,
  })

  const { data: reservations = [] } = useQuery({
    queryKey: ['reservations-for-drop', dropId, listedIds],
    queryFn: () => fetchReservations(listedIds),
    enabled: listedIds.length > 0,
  })

  const orderMap = new Map(orderItems.map(oi => [oi.product_id, oi]))
  const reservationMap = new Map(reservations.map(r => [r.product_id, r]))

  const isLoading = loadingDrop || loadingItems

  // Summary stats
  const soldHereItems = items.filter(i => {
    if (i.product.status !== 'sold') return false
    const oi = orderMap.get(i.product.id)
    const orderDrop = oi ? (oi.order as unknown as { drop_id: string | null }).drop_id : null
    return orderDrop === dropId
  })
  const revenue = soldHereItems.reduce((sum, i) => {
    const oi = orderMap.get(i.product.id)
    return sum + (oi?.price_at_purchase ?? 0)
  }, 0)

  if (dropError) {
    return <p className="text-sm text-red-600">{(dropError as Error).message}</p>
  }

  return (
    <div>
      <button
        onClick={() => navigate('/drops')}
        className="text-sm text-gray-500 hover:text-gray-900 mb-4 inline-block"
      >
        ← Drops
      </button>

      {isLoading && <p className="text-sm text-gray-500">Loading…</p>}

      {drop && (
        <>
          <div className="flex items-start justify-between gap-4 mb-6">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-2xl font-bold text-gray-900">
                  {drop.title ?? '(untitled)'}
                </h1>
                <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${DROP_STATUS_CLS[drop.status]}`}>
                  {drop.status.charAt(0).toUpperCase() + drop.status.slice(1)}
                </span>
              </div>
              {drop.description && (
                <p className="text-sm text-gray-500 mb-2">{drop.description}</p>
              )}
              <p className="text-sm text-gray-500">
                {items.length} items
                {soldHereItems.length > 0 && (
                  <> · <span className="text-blue-600 font-medium">{soldHereItems.length} sold here</span>
                  {' '}· <span className="font-medium text-gray-900">{revenue.toLocaleString()} ₴ revenue</span></>
                )}
                {drop.status === 'scheduled' && (
                  <> · scheduled for {new Date(drop.scheduled_at).toLocaleString()}</>
                )}
                {drop.published_at && (
                  <> · published {new Date(drop.published_at).toLocaleDateString()}</>
                )}
              </p>
            </div>
            {drop.status === 'scheduled' && (
              <Link
                to={`/drops/${dropId}/edit`}
                className="shrink-0 px-3 py-1.5 text-sm border border-gray-300 text-gray-700 rounded hover:bg-gray-50"
              >
                Edit
              </Link>
            )}
            {drop.status === 'active' && (
              <button
                type="button"
                onClick={handleArchive}
                disabled={archiving}
                className="shrink-0 px-3 py-1.5 text-sm border border-rose-300 text-rose-700 rounded hover:bg-rose-50 disabled:opacity-40"
              >
                {archiving ? 'Archiving…' : 'Archive'}
              </button>
            )}
          </div>

          {archiveError && (
            <p className="mb-3 text-xs text-red-600">{archiveError}</p>
          )}

          {removeError && (
            <p className="mb-3 text-xs text-red-600">{removeError}</p>
          )}

          {priceError && (
            <p className="mb-3 text-xs text-red-600">{priceError}</p>
          )}

          {moveError && (
            <p className="mb-3 text-xs text-red-600">{moveError}</p>
          )}

          {items.length === 0 && !loadingItems && (
            <p className="text-sm text-gray-500">No items in this drop.</p>
          )}

          {items.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500">
                    <th className="pb-2 pr-4 w-14">#</th>
                    <th className="pb-2 pr-4 w-14">Photo</th>
                    <th className="pb-2 pr-4">Brand</th>
                    <th className="pb-2 pr-4">Size</th>
                    <th className="pb-2 pr-4" title="Effective price — what customer pays">Price</th>
                    <th className="pb-2 pr-4" title="Compare-at — strikethrough + promo badge if &gt; price">Compare-at</th>
                    <th className="pb-2 pr-4">Sold price</th>
                    <th className="pb-2 pr-4">Status</th>
                    {drop.status !== 'archived' && <th className="pb-2 w-10" />}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {items.map((item, idx) => {
                    const ds = resolveStatus(item, dropId!, orderMap, reservationMap)
                    const thumb = [...item.product.product_images]
                      .sort((a, b) => a.position - b.position)[0]
                    const effectivePrice = item.override_price ?? item.product.price
                    const isPromo = item.compare_at_price != null && item.compare_at_price > effectivePrice
                    const canReorder = drop.status === 'scheduled'
                    const moving = movingId === item.id

                    return (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="py-2 pr-4 text-gray-400 text-xs">
                          {canReorder ? (
                            <div className="flex flex-col items-center leading-none">
                              <button
                                type="button"
                                onClick={() => handleMove(item, 'up')}
                                disabled={idx === 0 || moving}
                                aria-label="Move up"
                                className="px-1 text-gray-500 hover:text-gray-900 disabled:opacity-30 disabled:cursor-not-allowed"
                              >
                                ▲
                              </button>
                              <span className="text-[10px]">{idx + 1}</span>
                              <button
                                type="button"
                                onClick={() => handleMove(item, 'down')}
                                disabled={idx === items.length - 1 || moving}
                                aria-label="Move down"
                                className="px-1 text-gray-500 hover:text-gray-900 disabled:opacity-30 disabled:cursor-not-allowed"
                              >
                                ▼
                              </button>
                            </div>
                          ) : (
                            item.position
                          )}
                        </td>
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
                          {item.product.brand ?? item.product.name}
                        </td>
                        <td className="py-2 pr-4 text-gray-600">{item.product.size ?? '—'}</td>
                        <td className="py-2 pr-4 text-gray-900">
                          {drop.status === 'scheduled' ? (
                            <input
                              key={`${item.id}:override:${item.override_price ?? ''}`}
                              type="number"
                              min={1}
                              step={1}
                              defaultValue={item.override_price ?? ''}
                              placeholder={`${item.product.price}`}
                              onBlur={(e) => handleOverridePrice(item, e.target.value)}
                              title={`Base ${item.product.price} ₴`}
                              className="w-24 border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-gray-900"
                            />
                          ) : (
                            <>{effectivePrice} ₴</>
                          )}
                        </td>
                        <td className="py-2 pr-4 text-gray-600">
                          {drop.status === 'scheduled' ? (
                            <input
                              key={`${item.id}:compare:${item.compare_at_price ?? ''}`}
                              type="number"
                              min={1}
                              step={1}
                              defaultValue={item.compare_at_price ?? ''}
                              placeholder="—"
                              onBlur={(e) => handleCompareAtPrice(item, e.target.value)}
                              title="Compare-at — strikethrough + promo badge if > price"
                              className="w-24 border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-gray-900"
                            />
                          ) : isPromo ? (
                            <span className="inline-flex items-center gap-1.5">
                              <s className="text-gray-400">{item.compare_at_price} ₴</s>
                              <span className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 text-xs font-medium">
                                −{Math.round((1 - effectivePrice / item.compare_at_price!) * 100)}%
                              </span>
                            </span>
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </td>
                        <td className="py-2 pr-4 text-gray-900">
                          {ds.kind === 'sold_here' ? `${ds.price} ₴` : '—'}
                        </td>
                        <td className="py-2 pr-4">
                          <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${STATUS_CLS[ds.kind]}`}>
                            {STATUS_LABEL[ds.kind]}
                            {ds.kind === 'reserved' && (
                              <> · {Math.max(0, Math.ceil((new Date(ds.expiresAt).getTime() - Date.now()) / 60000))}m</>
                            )}
                          </span>
                        </td>
                        {drop.status !== 'archived' && (
                          <td className="py-2 text-right">
                            {canRemove(drop.status, ds) && (
                              <button
                                type="button"
                                onClick={() => handleRemove(item)}
                                disabled={removingId === item.id || ds.kind === 'reserved'}
                                title={ds.kind === 'reserved' ? 'Item is in cart' : 'Remove from drop'}
                                aria-label="Remove"
                                className="px-2 py-0.5 text-xs text-red-600 border border-red-200 rounded hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed"
                              >
                                {removingId === item.id ? '…' : '×'}
                              </button>
                            )}
                          </td>
                        )}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {isScheduled && (
            <section className="mt-8 border-t border-gray-200 pt-6">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-3">
                Add product
              </h2>

              <input
                type="search"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search by name, brand or #"
                className="w-full max-w-md border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400 mb-3"
              />

              {addError && (
                <p className="text-xs text-red-600 mb-2">{addError}</p>
              )}

              {loadingAvailable && (
                <p className="text-sm text-gray-500">Loading products…</p>
              )}

              {!loadingAvailable && availableProducts.length === 0 && (
                <p className="text-sm text-gray-500">No in-stock products available.</p>
              )}

              {!loadingAvailable && availableProducts.length > 0 && filteredAvailable.length === 0 && (
                <p className="text-sm text-gray-500">No products match your search.</p>
              )}

              {filteredAvailable.length > 0 && (
                <div className="border border-gray-200 rounded divide-y divide-gray-100 max-h-80 overflow-y-auto">
                  {filteredAvailable.map((p) => {
                    const thumb = [...p.product_images].sort((a, b) => a.position - b.position)[0]
                    const busy = addingId === p.id
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => handleAdd(p.id)}
                        disabled={!!addingId}
                        className="w-full flex items-center gap-3 px-4 py-2 text-left hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {thumb ? (
                          <img
                            src={supabase.storage.from('product-images').getPublicUrl(thumb.storage_path).data.publicUrl}
                            alt=""
                            className="h-10 w-10 object-cover rounded border border-gray-200 flex-shrink-0"
                          />
                        ) : (
                          <div className="h-10 w-10 rounded border border-gray-200 bg-gray-100 flex-shrink-0 flex items-center justify-center text-[9px] uppercase tracking-wide text-gray-400">
                            no photo
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {p.brand ?? p.name}
                          </p>
                          <p className="text-xs text-gray-500">
                            {p.size ?? '—'} · {p.price} ₴
                            {p.item_number && <> · #{p.item_number}</>}
                          </p>
                        </div>
                        <span className="shrink-0 text-xs text-gray-500">
                          {busy ? 'Adding…' : '+ Add'}
                        </span>
                      </button>
                    )
                  })}
                </div>
              )}
            </section>
          )}
        </>
      )}
    </div>
  )
}

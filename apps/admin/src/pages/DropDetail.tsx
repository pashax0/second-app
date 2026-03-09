import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Drop {
  id: string
  title: string | null
  description: string | null
  status: 'draft' | 'active' | 'archived'
  published_at: string | null
}

interface ProductImage {
  url: string
  position: number
}

interface DropItemRow {
  id: string
  position: number
  override_price: number | null
  product: {
    id: string
    name: string
    brand: string | null
    size: string | null
    price: number
    status: 'draft' | 'available' | 'sold'
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
    .select('id, title, description, status, published_at')
    .eq('id', dropId)
    .single()
  if (error) throw error
  return data as Drop
}

async function fetchDropItems(dropId: string): Promise<DropItemRow[]> {
  const { data, error } = await supabase
    .from('drop_items')
    .select(`
      id, position, override_price,
      product:products(
        id, name, brand, size, price, status,
        product_images(url, position)
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

// ── Item status logic ─────────────────────────────────────────────────────────

type DisplayStatus =
  | { kind: 'available' }
  | { kind: 'reserved'; expiresAt: string }
  | { kind: 'sold_here'; price: number }
  | { kind: 'sold_elsewhere' }
  | { kind: 'withdrawn' }
  | { kind: 'draft' }

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

  if (status === 'available') {
    const res = reservationMap.get(pid)
    return res ? { kind: 'reserved', expiresAt: res.expires_at } : { kind: 'available' }
  }

  // draft: was in this drop but not sold when archived
  return { kind: 'withdrawn' }
}

const STATUS_LABEL: Record<DisplayStatus['kind'], string> = {
  available: 'Available',
  reserved: 'Reserved',
  sold_here: 'Sold here',
  sold_elsewhere: 'Sold elsewhere',
  withdrawn: 'Withdrawn',
  draft: 'Draft',
}

const STATUS_CLS: Record<DisplayStatus['kind'], string> = {
  available: 'bg-green-100 text-green-700',
  reserved: 'bg-yellow-100 text-yellow-700',
  sold_here: 'bg-blue-100 text-blue-700',
  sold_elsewhere: 'bg-gray-100 text-gray-400',
  withdrawn: 'bg-gray-100 text-gray-400',
  draft: 'bg-gray-100 text-gray-400',
}

const DROP_STATUS_CLS: Record<Drop['status'], string> = {
  draft: 'bg-gray-100 text-gray-600',
  active: 'bg-green-100 text-green-700',
  archived: 'bg-gray-100 text-gray-400',
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function DropDetail() {
  const { id: dropId } = useParams<{ id: string }>()
  const navigate = useNavigate()

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

  const soldIds = items.filter(i => i.product.status === 'sold').map(i => i.product.id)
  const availableIds = items.filter(i => i.product.status === 'available').map(i => i.product.id)

  const { data: orderItems = [] } = useQuery({
    queryKey: ['order-items-for-drop', dropId, soldIds],
    queryFn: () => fetchOrderItems(soldIds),
    enabled: soldIds.length > 0,
  })

  const { data: reservations = [] } = useQuery({
    queryKey: ['reservations-for-drop', dropId, availableIds],
    queryFn: () => fetchReservations(availableIds),
    enabled: availableIds.length > 0,
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
          <div className="flex items-start justify-between mb-6">
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
                {drop.published_at && (
                  <> · published {new Date(drop.published_at).toLocaleDateString()}</>
                )}
              </p>
            </div>
          </div>

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
                    <th className="pb-2 pr-4">Listed</th>
                    <th className="pb-2 pr-4">Sold price</th>
                    <th className="pb-2">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {items.map((item) => {
                    const ds = resolveStatus(item, dropId!, orderMap, reservationMap)
                    const thumb = [...item.product.product_images]
                      .sort((a, b) => a.position - b.position)[0]
                    const displayPrice = item.override_price ?? item.product.price

                    return (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="py-2 pr-4 text-gray-400 text-xs">{item.position}</td>
                        <td className="py-2 pr-4">
                          {thumb ? (
                            <img
                              src={thumb.url}
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
                        <td className="py-2 pr-4 text-gray-900">{displayPrice} ₴</td>
                        <td className="py-2 pr-4 text-gray-900">
                          {ds.kind === 'sold_here' ? `${ds.price} ₴` : '—'}
                        </td>
                        <td className="py-2">
                          <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${STATUS_CLS[ds.kind]}`}>
                            {STATUS_LABEL[ds.kind]}
                            {ds.kind === 'reserved' && (
                              <> · {Math.max(0, Math.ceil((new Date(ds.expiresAt).getTime() - Date.now()) / 60000))}m</>
                            )}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}

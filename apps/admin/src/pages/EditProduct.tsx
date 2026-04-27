import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import ProductForm, {
  ProductFormValues,
  parseOptionalNumber,
  sanitizeFileName,
} from '../components/ProductForm'
import { useRealtimeInvalidation } from '../lib/useRealtimeInvalidation'

interface ProductImage {
  storage_path: string
  position: number
}

interface Measurements {
  chest?: number | null
  waist?: number | null
  hips?: number | null
  length?: number | null
}

interface Product {
  id: string
  name: string
  brand: string | null
  size: string | null
  price: number
  description: string | null
  item_number: string | null
  measurements: Measurements | null
  status: 'in_stock' | 'listed' | 'sold' | 'written_off'
  product_images: ProductImage[]
}

type PhotoItem =
  | { kind: 'existing'; path: string }
  | { kind: 'new'; file: File; previewUrl: string }

interface ActiveReservation {
  expires_at: string
}

interface ActiveDropItem {
  drop_id: string
}

interface ActiveDrop {
  id: string
}

interface ProductFull {
  product: Product
  reservation: ActiveReservation | null
  activeDropItem: ActiveDropItem | null
  activeDrop: ActiveDrop | null
}

async function fetchProductFull(id: string): Promise<ProductFull> {
  const [productRes, reservationRes, dropItemRes, activeDropRes] = await Promise.all([
    supabase
      .from('products')
      .select(
        'id, name, brand, size, price, description, item_number, measurements, status, product_images(storage_path, position)',
      )
      .eq('id', id)
      .single(),
    supabase
      .from('reservations')
      .select('expires_at')
      .eq('product_id', id)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle(),
    supabase
      .from('drop_items')
      .select('drop_id, drops!inner(status)')
      .eq('product_id', id)
      .eq('drops.status', 'active')
      .maybeSingle(),
    supabase
      .from('drops')
      .select('id')
      .eq('status', 'active')
      .maybeSingle(),
  ])

  if (productRes.error) throw productRes.error
  if (reservationRes.error) throw reservationRes.error
  if (dropItemRes.error) throw dropItemRes.error
  if (activeDropRes.error) throw activeDropRes.error

  return {
    product: productRes.data as unknown as Product,
    reservation: reservationRes.data as ActiveReservation | null,
    activeDropItem: dropItemRes.data
      ? { drop_id: (dropItemRes.data as { drop_id: string }).drop_id }
      : null,
    activeDrop: activeDropRes.data as ActiveDrop | null,
  }
}

function toFormValues(p: Product): ProductFormValues {
  const m = p.measurements ?? {}
  const num = (v: number | null | undefined) =>
    v === null || v === undefined ? '' : String(v)

  return {
    name: p.name,
    brand: p.brand ?? '',
    size: p.size ?? '',
    price: String(p.price),
    chest: num(m.chest),
    waist: num(m.waist),
    hips: num(m.hips),
    length: num(m.length),
    description: p.description ?? '',
    item_number: p.item_number ?? '',
  }
}

function photoPublicUrl(path: string) {
  return supabase.storage.from('product-images').getPublicUrl(path).data.publicUrl
}

export default function EditProduct() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data, isLoading, error } = useQuery({
    queryKey: ['product', id],
    queryFn: () => fetchProductFull(id!),
    enabled: !!id,
  })

  const product = data?.product
  const reservation = data?.reservation ?? null
  const activeDropItem = data?.activeDropItem ?? null
  const activeDrop = data?.activeDrop ?? null
  const [withdrawing, setWithdrawing] = useState(false)
  const [withdrawError, setWithdrawError] = useState<string | null>(null)
  const [publishing, setPublishing] = useState(false)
  const [publishError, setPublishError] = useState<string | null>(null)

  useRealtimeInvalidation(
    id
      ? [
          { table: 'products', filter: `id=eq.${id}` },
          { table: 'product_images', filter: `product_id=eq.${id}` },
          { table: 'drop_items', filter: `product_id=eq.${id}` },
          { table: 'reservations', filter: `product_id=eq.${id}` },
          { table: 'drops' },
        ]
      : [],
    [['product', id], ['products']],
  )

  useEffect(() => {
    if (!reservation || !id) return
    const delay = Math.max(0, new Date(reservation.expires_at).getTime() - Date.now())
    const timer = setTimeout(() => {
      queryClient.invalidateQueries({ queryKey: ['product', id] })
    }, delay + 1000)
    return () => clearTimeout(timer)
  }, [reservation, id, queryClient])

  const [items, setItems] = useState<PhotoItem[]>([])
  const [originalPaths, setOriginalPaths] = useState<string[]>([])

  useEffect(() => {
    if (!product) return
    const sorted = [...product.product_images].sort((a, b) => a.position - b.position)
    setItems(sorted.map((img) => ({ kind: 'existing', path: img.storage_path })))
    setOriginalPaths(sorted.map((img) => img.storage_path))
  }, [product])

  useEffect(() => {
    return () => {
      for (const item of items) {
        if (item.kind === 'new') URL.revokeObjectURL(item.previewUrl)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function moveItem(i: number, dir: -1 | 1) {
    const j = i + dir
    if (j < 0 || j >= items.length) return
    setItems((arr) => {
      const copy = [...arr]
      ;[copy[i], copy[j]] = [copy[j], copy[i]]
      return copy
    })
  }

  function removeItem(i: number) {
    setItems((arr) => {
      const target = arr[i]
      if (target.kind === 'new') URL.revokeObjectURL(target.previewUrl)
      return arr.filter((_, idx) => idx !== i)
    })
  }

  function addFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    const newItems: PhotoItem[] = Array.from(files).map((f) => ({
      kind: 'new',
      file: f,
      previewUrl: URL.createObjectURL(f),
    }))
    setItems((arr) => [...arr, ...newItems])
  }

  async function commitPhotos(productId: string) {
    if (items.length === 0) throw new Error('Add at least one photo')

    const uploadedPaths: string[] = []
    const resolved: { path: string; kind: 'existing' | 'new' }[] = []

    try {
      for (const item of items) {
        if (item.kind === 'existing') {
          resolved.push({ path: item.path, kind: 'existing' })
        } else {
          const path = `${productId}/${Date.now()}-${uploadedPaths.length}-${sanitizeFileName(item.file.name)}`
          const { error: uploadError } = await supabase.storage
            .from('product-images')
            .upload(path, item.file)
          if (uploadError) throw uploadError
          uploadedPaths.push(path)
          resolved.push({ path, kind: 'new' })
        }
      }
    } catch (err) {
      if (uploadedPaths.length) {
        await supabase.storage.from('product-images').remove(uploadedPaths)
      }
      throw err
    }

    const keptPaths = new Set(
      items.filter((i) => i.kind === 'existing').map((i) => i.path),
    )
    const removedPaths = originalPaths.filter((p) => !keptPaths.has(p))
    if (removedPaths.length) {
      const { error: delErr } = await supabase
        .from('product_images')
        .delete()
        .in('storage_path', removedPaths)
      if (delErr) throw delErr
      await supabase.storage.from('product-images').remove(removedPaths)
    }

    for (let i = 0; i < resolved.length; i++) {
      const r = resolved[i]
      if (r.kind === 'existing') {
        const { error: updErr } = await supabase
          .from('product_images')
          .update({ position: i })
          .eq('product_id', productId)
          .eq('storage_path', r.path)
        if (updErr) throw updErr
      } else {
        const { error: insErr } = await supabase
          .from('product_images')
          .insert({ product_id: productId, storage_path: r.path, position: i })
        if (insErr) throw insErr
      }
    }
  }

  async function onSubmit(values: ProductFormValues) {
    if (!id) return

    await commitPhotos(id)

    const chest = parseOptionalNumber(values.chest)
    const waist = parseOptionalNumber(values.waist)
    const hips = parseOptionalNumber(values.hips)
    const length = parseOptionalNumber(values.length)

    const measurements =
      chest || waist || hips || length ? { chest, waist, hips, length } : null

    const { error: updateError } = await supabase
      .from('products')
      .update({
        name: values.name,
        brand: values.brand || null,
        size: values.size || null,
        price: parseFloat(values.price),
        measurements,
        description: values.description || null,
        item_number: values.item_number || null,
      })
      .eq('id', id)

    if (updateError) throw updateError

    await queryClient.invalidateQueries({ queryKey: ['products'] })
    await queryClient.invalidateQueries({ queryKey: ['product', id] })
    navigate('/products')
  }

  async function handlePublish() {
    if (!id || !activeDrop) return

    setPublishError(null)
    setPublishing(true)
    try {
      const { data: maxRow, error: maxErr } = await supabase
        .from('drop_items')
        .select('position')
        .eq('drop_id', activeDrop.id)
        .order('position', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (maxErr) throw maxErr
      const nextPosition = (maxRow?.position ?? -1) + 1

      const { error: insErr } = await supabase
        .from('drop_items')
        .insert({ drop_id: activeDrop.id, product_id: id, position: nextPosition })
      if (insErr) throw insErr

      const { error: updErr } = await supabase
        .from('products')
        .update({ status: 'listed' })
        .eq('id', id)
      if (updErr) throw updErr

      await queryClient.invalidateQueries({ queryKey: ['products'] })
      await queryClient.invalidateQueries({ queryKey: ['product', id] })
      navigate('/products')
    } catch (err) {
      setPublishError(err instanceof Error ? err.message : 'Publish failed')
    } finally {
      setPublishing(false)
    }
  }

  async function handleWithdraw() {
    if (!id || !activeDropItem) return
    if (reservation) return
    if (!confirm('Убрать этот товар с витрины? Он вернётся в In stock.')) return

    setWithdrawError(null)
    setWithdrawing(true)
    try {
      const { error: delErr } = await supabase
        .from('drop_items')
        .delete()
        .eq('product_id', id)
        .eq('drop_id', activeDropItem.drop_id)
      if (delErr) throw delErr

      const { error: updErr } = await supabase
        .from('products')
        .update({ status: 'in_stock' })
        .eq('id', id)
      if (updErr) throw updErr

      await queryClient.invalidateQueries({ queryKey: ['products'] })
      await queryClient.invalidateQueries({ queryKey: ['product', id] })
      navigate('/products')
    } catch (err) {
      setWithdrawError(err instanceof Error ? err.message : 'Withdraw failed')
    } finally {
      setWithdrawing(false)
    }
  }

  if (isLoading) {
    return <p className="text-sm text-gray-500">Loading…</p>
  }

  if (error || !product) {
    return (
      <p className="text-sm text-red-600">
        {error ? (error as Error).message : 'Product not found'}
      </p>
    )
  }

  const reservationExpiresText = reservation
    ? new Date(reservation.expires_at).toLocaleString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null

  return (
    <div className="max-w-xl">
      <div className="flex items-start justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Edit Product</h1>
        {product.status === 'listed' && activeDropItem && (
          <button
            type="button"
            onClick={handleWithdraw}
            disabled={withdrawing || !!reservation}
            title={reservation ? `В корзине до ${reservationExpiresText}` : undefined}
            className="shrink-0 px-3 py-1.5 text-sm border border-red-300 text-red-600 rounded hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {withdrawing ? 'Убираем…' : 'Убрать с витрины'}
          </button>
        )}
        {product.status === 'in_stock' && activeDrop && (
          <button
            type="button"
            onClick={handlePublish}
            disabled={publishing}
            className="shrink-0 px-3 py-1.5 text-sm border border-green-400 text-green-700 rounded hover:bg-green-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {publishing ? 'Публикуем…' : 'Добавить на витрину'}
          </button>
        )}
        {product.status === 'in_stock' && !activeDrop && (
          <span className="shrink-0 text-xs text-gray-500 self-center">
            Нет активного дропа
          </span>
        )}
      </div>

      {publishError && (
        <p className="mb-4 text-sm text-red-600">{publishError}</p>
      )}

      {product.status === 'sold' && (
        <div className="mb-4 p-3 rounded border border-amber-300 bg-amber-50 text-sm text-amber-900">
          Товар продан. Правки видны в истории заказов клиента;{' '}
          <code className="text-xs">order_items.price_at_purchase</code> зафиксирован.
        </div>
      )}

      {reservation && (
        <div className="mb-4 p-3 rounded border border-blue-300 bg-blue-50 text-sm text-blue-900">
          В корзине у пользователя до <strong>{reservationExpiresText}</strong>.
          Правки будут видны ему при обновлении страницы.
        </div>
      )}

      {withdrawError && (
        <p className="mb-4 text-sm text-red-600">{withdrawError}</p>
      )}

      <ProductForm
        defaultValues={toFormValues(product)}
        submitLabel="Save"
        onSubmit={onSubmit}
        onCancel={() => navigate('/products')}
      >
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Photos <span className="text-red-500">*</span>
          </label>

          {items.length === 0 ? (
            <p className="text-xs text-gray-500 mb-2">No photos. Add at least one below.</p>
          ) : (
            <div className="grid grid-cols-4 gap-2 mb-2">
              {items.map((item, i) => {
                const src = item.kind === 'existing' ? photoPublicUrl(item.path) : item.previewUrl
                const key = item.kind === 'existing' ? item.path : item.previewUrl
                const atStart = i === 0
                const atEnd = i === items.length - 1
                return (
                  <div
                    key={key}
                    className="relative border border-gray-200 rounded overflow-hidden"
                    data-testid="photo-item"
                  >
                    <img src={src} alt="" className="h-24 w-full object-cover" />
                    {item.kind === 'new' && (
                      <span className="absolute top-1 left-1 text-[10px] bg-green-500 text-white px-1.5 rounded">
                        new
                      </span>
                    )}
                    <div className="absolute bottom-1 left-1 right-1 flex justify-between gap-1">
                      <button
                        type="button"
                        onClick={() => moveItem(i, -1)}
                        disabled={atStart}
                        aria-label="Move up"
                        className="w-6 h-6 text-xs bg-white/90 border border-gray-300 rounded disabled:opacity-30"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        onClick={() => moveItem(i, 1)}
                        disabled={atEnd}
                        aria-label="Move down"
                        className="w-6 h-6 text-xs bg-white/90 border border-gray-300 rounded disabled:opacity-30"
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        onClick={() => removeItem(i)}
                        aria-label="Remove"
                        className="w-6 h-6 text-xs bg-white/90 border border-red-300 text-red-600 rounded"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          <input
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => {
              addFiles(e.target.files)
              e.target.value = ''
            }}
            className="block w-full text-sm text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-sm file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200"
          />
        </div>
      </ProductForm>
    </div>
  )
}

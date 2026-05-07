import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import DatePicker from 'react-datepicker'
import { supabase } from '../../lib/supabase'
import { CONDITION_OPTIONS } from '../components/ProductForm'

interface ProductImage {
  storage_path: string
  position: number
}

type Condition = (typeof CONDITION_OPTIONS)[number]['value']

interface Product {
  id: string
  name: string
  brand: string | null
  size: string | null
  item_number: string | null
  condition: Condition | null
  price: number
  is_returned_to_stock: boolean
  product_images: ProductImage[]
}

function useDebounced<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(id)
  }, [value, delay])
  return debounced
}

const schema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  scheduled_at: z.date({ message: 'Scheduled date is required' }),
})

type FormValues = z.infer<typeof schema>

function nextHour(): Date {
  const d = new Date()
  d.setMinutes(0, 0, 0)
  d.setHours(d.getHours() + 1)
  return d
}

async function fetchInStockProducts(): Promise<Product[]> {
  const { data, error } = await supabase
    .from('products_with_flags')
    .select(
      'id, name, brand, size, item_number, condition, price, is_returned_to_stock, product_images(storage_path, position)',
    )
    .eq('status', 'in_stock')
    .eq('is_scheduled', false)
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data ?? []) as unknown as Product[]
}

export default function CreateDrop() {
  const navigate = useNavigate()
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [overridePrices, setOverridePrices] = useState<Record<string, string>>({})
  const [compareAtPrices, setCompareAtPrices] = useState<Record<string, string>>({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const [searchInput, setSearchInput] = useState('')
  const search = useDebounced(searchInput, 300)
  const [conditionFilter, setConditionFilter] = useState<Condition | ''>('')
  const [sizeFilter, setSizeFilter] = useState<string>('')
  const [returnedOnly, setReturnedOnly] = useState(false)

  const { data: products = [], isLoading } = useQuery({
    queryKey: ['products', 'in_stock'],
    queryFn: fetchInStockProducts,
  })

  const sizeOptions = useMemo(() => {
    const set = new Set<string>()
    for (const p of products) if (p.size) set.add(p.size)
    return Array.from(set).sort()
  }, [products])

  const filteredProducts = useMemo(() => {
    const term = search.trim().toLowerCase()
    return products.filter((p) => {
      if (returnedOnly && !p.is_returned_to_stock) return false
      if (conditionFilter && p.condition !== conditionFilter) return false
      if (sizeFilter && p.size !== sizeFilter) return false
      if (term) {
        const haystack = [p.name, p.brand, p.item_number]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        if (!haystack.includes(term)) return false
      }
      return true
    })
  }, [products, search, conditionFilter, sizeFilter, returnedOnly])

  const hasActiveFilters =
    Boolean(search.trim()) || Boolean(conditionFilter) || Boolean(sizeFilter) || returnedOnly

  function clearFilters() {
    setSearchInput('')
    setConditionFilter('')
    setSizeFilter('')
    setReturnedOnly(false)
  }

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { scheduled_at: nextHour() },
  })

  function toggleProduct(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
        setOverridePrices((p) => {
          if (!(id in p)) return p
          const { [id]: _, ...rest } = p
          return rest
        })
        setCompareAtPrices((p) => {
          if (!(id in p)) return p
          const { [id]: _, ...rest } = p
          return rest
        })
      } else {
        next.add(id)
      }
      return next
    })
  }

  async function onSubmit(values: FormValues) {
    if (selectedIds.size === 0) {
      setSubmitError('Select at least one product')
      return
    }
    setSubmitError(null)
    setSaving(true)

    try {
      const { data: drop, error: dropError } = await supabase
        .from('drops')
        .insert({
          title: values.title,
          description: values.description || null,
          scheduled_at: values.scheduled_at.toISOString(),
          status: 'scheduled',
        })
        .select('id')
        .single()

      if (dropError) throw dropError

      const items = Array.from(selectedIds).map((productId, i) => {
        const overrideRaw = overridePrices[productId]?.trim()
        const compareRaw = compareAtPrices[productId]?.trim()
        return {
          drop_id: drop.id,
          product_id: productId,
          position: i,
          override_price: overrideRaw && Number(overrideRaw) > 0 ? Number(overrideRaw) : null,
          compare_at_price: compareRaw && Number(compareRaw) > 0 ? Number(compareRaw) : null,
        }
      })

      const { error: itemsError } = await supabase.from('drop_items').insert(items)
      if (itemsError) throw itemsError

      navigate('/drops')
    } catch (err) {
      const e = err as { code?: string; message: string }
      setSubmitError(
        e.code === '23505'
          ? 'Another drop is already scheduled for this time'
          : e.message,
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">New Drop</h1>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Title <span className="text-red-500">*</span>
          </label>
          <input
            {...register('title')}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-900"
            placeholder="Drop #1"
          />
          {errors.title && (
            <p className="text-xs text-red-500 mt-1">{errors.title.message}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Description
          </label>
          <textarea
            {...register('description')}
            rows={3}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-900"
            placeholder="Optional header shown above the item grid"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Scheduled date <span className="text-red-500">*</span>
          </label>
          <Controller
            control={control}
            name="scheduled_at"
            render={({ field }) => (
              <DatePicker
                selected={field.value}
                onChange={(d: Date | null) => field.onChange(d)}
                showTimeSelect
                timeIntervals={5}
                calendarStartDay={1}
                minDate={new Date()}
                dateFormat="dd.MM.yyyy, HH:mm"
                timeFormat="HH:mm"
                portalId="datepicker-portal"
                popperPlacement="bottom-start"
                className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-900"
              />
            )}
          />
          {errors.scheduled_at && (
            <p className="text-xs text-red-500 mt-1">{errors.scheduled_at.message}</p>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-gray-700">
              Products <span className="text-red-500">*</span>
            </label>
            {selectedIds.size > 0 && (
              <span className="text-xs text-gray-500">{selectedIds.size} selected</span>
            )}
          </div>

          {products.length > 0 && (
            <div className="space-y-2 mb-3">
              <div className="flex flex-wrap gap-2">
                <input
                  type="search"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Search by name, brand or #"
                  className="flex-1 min-w-[200px] border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
                />
                <select
                  value={conditionFilter}
                  onChange={(e) => setConditionFilter(e.target.value as Condition | '')}
                  className="border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
                >
                  <option value="">Any condition</option>
                  {CONDITION_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <select
                  value={sizeFilter}
                  onChange={(e) => setSizeFilter(e.target.value)}
                  disabled={sizeOptions.length === 0}
                  className="border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400 disabled:opacity-40"
                >
                  <option value="">Any size</option>
                  {sizeOptions.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setReturnedOnly((v) => !v)}
                  className={`px-2.5 py-1 text-xs rounded-full border ${
                    returnedOnly
                      ? 'bg-gray-900 text-white border-gray-900'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  Returned
                </button>
                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="text-xs text-gray-500 hover:text-gray-900"
                  >
                    Clear filters
                  </button>
                )}
                <span className="ml-auto text-xs text-gray-500">
                  {filteredProducts.length} of {products.length}
                </span>
              </div>
            </div>
          )}

          {isLoading && <p className="text-sm text-gray-500">Loading products…</p>}

          {!isLoading && products.length === 0 && (
            <p className="text-sm text-gray-500">No in-stock products available.</p>
          )}

          {!isLoading && products.length > 0 && filteredProducts.length === 0 && (
            <p className="text-sm text-gray-500">No products match your filters.</p>
          )}

          {filteredProducts.length > 0 && (
            <div className="border border-gray-200 rounded divide-y divide-gray-100 max-h-96 overflow-y-auto">
              {filteredProducts.map((p) => {
                const thumb = [...p.product_images].sort((a, b) => a.position - b.position)[0]
                const checked = selectedIds.has(p.id)

                return (
                  <label
                    key={p.id}
                    className={`flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 ${
                      checked ? 'bg-blue-50' : ''
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleProduct(p.id)}
                      className="h-4 w-4 rounded border-gray-300"
                    />
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
                      <p className="text-xs text-gray-500">{p.size ?? '—'} · {p.price} ₴</p>
                    </div>
                    {checked && (
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={1}
                          step={1}
                          value={overridePrices[p.id] ?? ''}
                          onChange={(e) =>
                            setOverridePrices((prev) => ({ ...prev, [p.id]: e.target.value }))
                          }
                          onClick={(e) => e.stopPropagation()}
                          placeholder={`${p.price}`}
                          title="Drop price (overrides product price). Empty = use base."
                          className="w-20 border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-gray-900"
                        />
                        <input
                          type="number"
                          min={1}
                          step={1}
                          value={compareAtPrices[p.id] ?? ''}
                          onChange={(e) =>
                            setCompareAtPrices((prev) => ({ ...prev, [p.id]: e.target.value }))
                          }
                          onClick={(e) => e.stopPropagation()}
                          placeholder="—"
                          title="Compare-at price. If set and > drop price → shown as strikethrough + promo badge."
                          className="w-20 border border-gray-300 rounded px-2 py-1 text-sm text-gray-600 focus:outline-none focus:ring-1 focus:ring-gray-900"
                        />
                      </div>
                    )}
                  </label>
                )
              })}
            </div>
          )}

          {submitError && (
            <p className="text-xs text-red-500 mt-1">{submitError}</p>
          )}
        </div>

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 bg-gray-900 text-white text-sm rounded hover:bg-gray-700 disabled:opacity-40"
          >
            {saving ? 'Saving…' : 'Save Drop'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/drops')}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}

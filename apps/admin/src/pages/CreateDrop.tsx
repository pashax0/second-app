import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { supabase } from '../../lib/supabase'

interface ProductImage {
  url: string
  position: number
}

interface Product {
  id: string
  name: string
  brand: string | null
  size: string | null
  price: number
  product_images: ProductImage[]
}

const schema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

async function fetchDraftProducts(): Promise<Product[]> {
  const { data, error } = await supabase
    .from('products')
    .select('id, name, brand, size, price, product_images(url, position)')
    .eq('status', 'draft')
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data ?? []) as unknown as Product[]
}

export default function CreateDrop() {
  const navigate = useNavigate()
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const { data: products = [], isLoading } = useQuery({
    queryKey: ['products', 'draft'],
    queryFn: fetchDraftProducts,
  })

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  function toggleProduct(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
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
          scheduled_at: new Date().toISOString(),
          status: 'draft',
        })
        .select('id')
        .single()

      if (dropError) throw dropError

      const items = Array.from(selectedIds).map((productId, i) => ({
        drop_id: drop.id,
        product_id: productId,
        position: i,
      }))

      const { error: itemsError } = await supabase.from('drop_items').insert(items)
      if (itemsError) throw itemsError

      navigate('/drops')
    } catch (err) {
      setSubmitError((err as Error).message)
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
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-gray-700">
              Products <span className="text-red-500">*</span>
            </label>
            {selectedIds.size > 0 && (
              <span className="text-xs text-gray-500">{selectedIds.size} selected</span>
            )}
          </div>

          {isLoading && <p className="text-sm text-gray-500">Loading products…</p>}

          {!isLoading && products.length === 0 && (
            <p className="text-sm text-gray-500">No draft products available.</p>
          )}

          {products.length > 0 && (
            <div className="border border-gray-200 rounded divide-y divide-gray-100 max-h-96 overflow-y-auto">
              {products.map((p) => {
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
                        src={thumb.url}
                        alt=""
                        className="h-10 w-10 object-cover rounded border border-gray-200 flex-shrink-0"
                      />
                    ) : (
                      <div className="h-10 w-10 rounded border border-gray-200 bg-gray-100 flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {p.brand ?? p.name}
                      </p>
                      <p className="text-xs text-gray-500">{p.size ?? '—'} · {p.price} ₴</p>
                    </div>
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

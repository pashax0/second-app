import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

const schema = z.object({
  name: z.string().min(1, 'Required'),
  brand: z.string().optional(),
  size: z.string().optional(),
  price: z
    .string()
    .min(1, 'Required')
    .refine((v) => !isNaN(parseFloat(v)) && parseFloat(v) > 0, 'Must be > 0'),
  chest: z.string().optional(),
  waist: z.string().optional(),
  hips: z.string().optional(),
  length: z.string().optional(),
  description: z.string().optional(),
  item_number: z.string().optional(),
})

type FormData = z.infer<typeof schema>

function parseOptionalNumber(v: string | undefined) {
  if (!v || v.trim() === '') return null
  const n = parseFloat(v)
  return isNaN(n) ? null : n
}

export default function CreateProduct() {
  const navigate = useNavigate()
  const [photos, setPhotos] = useState<File[]>([])
  const [previews, setPreviews] = useState<string[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) })

  function handlePhotosChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    setPhotos(files)
    setPreviews(files.map((f) => URL.createObjectURL(f)))
  }

  async function onSubmit(data: FormData) {
    if (photos.length === 0) {
      setError('Add at least one photo')
      return
    }
    setIsSubmitting(true)
    setError(null)

    try {
      const chest = parseOptionalNumber(data.chest)
      const waist = parseOptionalNumber(data.waist)
      const hips = parseOptionalNumber(data.hips)
      const length = parseOptionalNumber(data.length)

      const measurements =
        chest || waist || hips || length
          ? { chest, waist, hips, length }
          : null

      // Insert product first to get the ID
      const { data: product, error: insertError } = await supabase
        .from('products')
        .insert({
          name: data.name,
          brand: data.brand || null,
          size: data.size || null,
          price: parseFloat(data.price),
          measurements,
          description: data.description || null,
          item_number: data.item_number || null,
          stock_quantity: 1,
          status: 'draft',
        })
        .select('id')
        .single()

      if (insertError || !product) throw insertError ?? new Error('Insert failed')

      // Upload photos and insert product_images
      for (let i = 0; i < photos.length; i++) {
        const file = photos[i]
        const path = `${product.id}/${i}-${file.name}`

        const { error: uploadError } = await supabase.storage
          .from('product-images')
          .upload(path, file)

        if (uploadError) throw uploadError

        const { data: { publicUrl } } = supabase.storage
          .from('product-images')
          .getPublicUrl(path)

        const { error: imgError } = await supabase
          .from('product_images')
          .insert({ product_id: product.id, url: publicUrl, position: i })

        if (imgError) throw imgError
      }

      navigate('/products')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">New Product</h1>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        {/* Photos */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Photos <span className="text-red-500">*</span>
          </label>
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={handlePhotosChange}
            className="block w-full text-sm text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-sm file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200"
          />
          {previews.length > 0 && (
            <div className="flex gap-2 mt-2 flex-wrap">
              {previews.map((src, i) => (
                <img key={i} src={src} alt="" className="h-20 w-20 object-cover rounded border border-gray-200" />
              ))}
            </div>
          )}
        </div>

        {/* Name */}
        <Field label="Name" required error={errors.name?.message}>
          <input {...register('name')} className={inputCls(!!errors.name)} />
        </Field>

        {/* Brand + Size */}
        <div className="grid grid-cols-2 gap-4">
          <Field label="Brand" error={errors.brand?.message}>
            <input {...register('brand')} className={inputCls(!!errors.brand)} />
          </Field>
          <Field label="Size" error={errors.size?.message}>
            <input {...register('size')} className={inputCls(!!errors.size)} />
          </Field>
        </div>

        {/* Price */}
        <Field label="Price" required error={errors.price?.message}>
          <input
            type="number"
            step="0.01"
            min="0"
            {...register('price')}
            className={inputCls(!!errors.price)}
          />
        </Field>

        {/* Measurements */}
        <div>
          <p className="block text-sm font-medium text-gray-700 mb-1">Measurements (cm)</p>
          <div className="grid grid-cols-4 gap-2">
            {(['chest', 'waist', 'hips', 'length'] as const).map((key) => (
              <div key={key}>
                <label className="block text-xs text-gray-500 mb-0.5 capitalize">{key}</label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  {...register(key)}
                  className={inputCls(!!errors[key])}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Item number */}
        <Field label="Item #" error={errors.item_number?.message}>
          <input {...register('item_number')} className={inputCls(!!errors.item_number)} />
        </Field>

        {/* Description */}
        <Field label="Description" error={errors.description?.message}>
          <textarea {...register('description')} rows={3} className={inputCls(!!errors.description)} />
        </Field>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex gap-3 pt-1">
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-4 py-2 bg-gray-900 text-white text-sm rounded hover:bg-gray-700 disabled:opacity-50"
          >
            {isSubmitting ? 'Saving…' : 'Save as Draft'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/products')}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}

function inputCls(hasError: boolean) {
  return `w-full px-3 py-1.5 text-sm border rounded focus:outline-none focus:ring-1 ${
    hasError ? 'border-red-400 focus:ring-red-400' : 'border-gray-300 focus:ring-gray-400'
  }`
}

interface FieldProps {
  label: string
  required?: boolean
  error?: string
  children: React.ReactNode
}

function Field({ label, required, error, children }: FieldProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
      {error && <p className="mt-0.5 text-xs text-red-600">{error}</p>}
    </div>
  )
}

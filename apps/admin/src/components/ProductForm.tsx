import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

export const productFormSchema = z.object({
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

export type ProductFormValues = z.infer<typeof productFormSchema>

export function parseOptionalNumber(v: string | undefined | null) {
  if (!v || v.trim() === '') return null
  const n = parseFloat(v)
  return isNaN(n) ? null : n
}

export function sanitizeFileName(name: string) {
  const cleaned = name.replace(/[^a-zA-Z0-9._-]/g, '-').replace(/-+/g, '-')
  return cleaned.replace(/^-+|-+$/g, '') || 'file'
}

interface ProductFormProps {
  defaultValues?: Partial<ProductFormValues>
  submitLabel?: string
  onSubmit: (values: ProductFormValues) => Promise<void>
  onCancel: () => void
  children?: React.ReactNode
}

export default function ProductForm({
  defaultValues,
  submitLabel = 'Save',
  onSubmit,
  onCancel,
  children,
}: ProductFormProps) {
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ProductFormValues>({
    resolver: zodResolver(productFormSchema),
    defaultValues,
  })

  async function submit(values: ProductFormValues) {
    setSubmitError(null)
    setIsSubmitting(true)
    try {
      await onSubmit(values)
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-5">
      {children}

      <Field label="Name" required error={errors.name?.message}>
        <input {...register('name')} className={inputCls(!!errors.name)} />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Brand" error={errors.brand?.message}>
          <input {...register('brand')} className={inputCls(!!errors.brand)} />
        </Field>
        <Field label="Size" error={errors.size?.message}>
          <input {...register('size')} className={inputCls(!!errors.size)} />
        </Field>
      </div>

      <Field label="Price" required error={errors.price?.message}>
        <input
          type="number"
          step="0.01"
          min="0"
          {...register('price')}
          className={inputCls(!!errors.price)}
        />
      </Field>

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

      <Field label="Item #" error={errors.item_number?.message}>
        <input {...register('item_number')} className={inputCls(!!errors.item_number)} />
      </Field>

      <Field label="Description" error={errors.description?.message}>
        <textarea {...register('description')} rows={3} className={inputCls(!!errors.description)} />
      </Field>

      {submitError && <p className="text-sm text-red-600">{submitError}</p>}

      <div className="flex gap-3 pt-1">
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-4 py-2 bg-gray-900 text-white text-sm rounded hover:bg-gray-700 disabled:opacity-50"
        >
          {isSubmitting ? 'Saving…' : submitLabel}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
        >
          Cancel
        </button>
      </div>
    </form>
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

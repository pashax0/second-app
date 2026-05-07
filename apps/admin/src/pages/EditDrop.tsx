import { useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import DatePicker from 'react-datepicker'
import { supabase } from '../../lib/supabase'

interface Drop {
  id: string
  title: string
  description: string | null
  status: 'scheduled' | 'active' | 'archived'
  scheduled_at: string
}

const schema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  scheduled_at: z.date({ message: 'Scheduled date is required' }),
})

type FormValues = z.infer<typeof schema>

async function fetchDrop(dropId: string): Promise<Drop> {
  const { data, error } = await supabase
    .from('drops')
    .select('id, title, description, status, scheduled_at')
    .eq('id', dropId)
    .single()
  if (error) throw error
  return data as Drop
}

export default function EditDrop() {
  const { id: dropId } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data: drop, isLoading, error } = useQuery({
    queryKey: ['drop', dropId],
    queryFn: () => fetchDrop(dropId!),
    enabled: !!dropId,
  })

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { title: '', description: '', scheduled_at: new Date() },
  })

  useEffect(() => {
    if (!drop) return
    reset({
      title: drop.title,
      description: drop.description ?? '',
      scheduled_at: new Date(drop.scheduled_at),
    })
  }, [drop, reset])

  async function onSubmit(values: FormValues) {
    if (!dropId) return

    const { error: updateError } = await supabase
      .from('drops')
      .update({
        title: values.title,
        description: values.description || null,
        scheduled_at: values.scheduled_at.toISOString(),
      })
      .eq('id', dropId)

    if (updateError) {
      setError('root', {
        message:
          updateError.code === '23505'
            ? 'Another drop is already scheduled for this time'
            : updateError.message,
      })
      return
    }

    await queryClient.invalidateQueries({ queryKey: ['drop', dropId] })
    await queryClient.invalidateQueries({ queryKey: ['drops'] })
    navigate(`/drops/${dropId}`)
  }

  if (isLoading) return <p className="text-sm text-gray-500">Loading…</p>

  if (error || !drop) {
    return (
      <p className="text-sm text-red-600">
        {error ? (error as Error).message : 'Drop not found'}
      </p>
    )
  }

  if (drop.status !== 'scheduled') {
    return (
      <div className="max-w-2xl">
        <button
          onClick={() => navigate(`/drops/${dropId}`)}
          className="text-sm text-gray-500 hover:text-gray-900 mb-4 inline-block"
        >
          ← Drop
        </button>
        <p className="text-sm text-gray-700">
          Only scheduled drops can be edited. This drop is <strong>{drop.status}</strong>.
        </p>
      </div>
    )
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Edit Drop</h1>

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

        {errors.root && (
          <p className="text-xs text-red-500">{errors.root.message}</p>
        )}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-4 py-2 bg-gray-900 text-white text-sm rounded hover:bg-gray-700 disabled:opacity-40"
          >
            {isSubmitting ? 'Saving…' : 'Save'}
          </button>
          <button
            type="button"
            onClick={() => navigate(`/drops/${dropId}`)}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}

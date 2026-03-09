import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'

interface DropRow {
  id: string
  title: string | null
  status: 'draft' | 'active' | 'archived'
  published_at: string | null
  created_at: string
  drop_items: { count: number }[]
}

async function fetchDrops(): Promise<DropRow[]> {
  const { data, error } = await supabase
    .from('drops')
    .select('id, title, status, published_at, created_at, drop_items(count)')
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data ?? []) as unknown as DropRow[]
}

async function publishDrop(dropId: string) {
  // Archive current active drop + reset its unsold products to draft
  const { data: activeDrop } = await supabase
    .from('drops')
    .select('id')
    .eq('status', 'active')
    .maybeSingle()

  if (activeDrop) {
    const { data: activeItems } = await supabase
      .from('drop_items')
      .select('product_id')
      .eq('drop_id', activeDrop.id)

    const productIds = (activeItems ?? []).map((i) => i.product_id)

    if (productIds.length > 0) {
      const { error } = await supabase
        .from('products')
        .update({ status: 'draft' })
        .in('id', productIds)
        .neq('status', 'sold')

      if (error) throw error
    }

    const { error: archiveError } = await supabase
      .from('drops')
      .update({ status: 'archived' })
      .eq('id', activeDrop.id)

    if (archiveError) throw archiveError
  }

  // Set new drop's products to available
  const { data: newItems } = await supabase
    .from('drop_items')
    .select('product_id')
    .eq('drop_id', dropId)

  const newProductIds = (newItems ?? []).map((i) => i.product_id)

  if (newProductIds.length > 0) {
    const { error } = await supabase
      .from('products')
      .update({ status: 'available' })
      .in('id', newProductIds)

    if (error) throw error
  }

  // Activate drop
  const { error } = await supabase
    .from('drops')
    .update({ status: 'active', published_at: new Date().toISOString() })
    .eq('id', dropId)

  if (error) throw error
}

const STATUS_LABEL: Record<DropRow['status'], string> = {
  draft: 'Draft',
  active: 'Active',
  archived: 'Archived',
}

const STATUS_CLS: Record<DropRow['status'], string> = {
  draft: 'bg-gray-100 text-gray-600',
  active: 'bg-green-100 text-green-700',
  archived: 'bg-gray-100 text-gray-400',
}

export default function Drops() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [publishingId, setPublishingId] = useState<string | null>(null)

  const { data: drops = [], isLoading, error } = useQuery({
    queryKey: ['drops'],
    queryFn: fetchDrops,
  })

  const publishMutation = useMutation({
    mutationFn: publishDrop,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drops'] })
      queryClient.invalidateQueries({ queryKey: ['products'] })
    },
  })

  async function handlePublish(drop: DropRow) {
    const itemCount = drop.drop_items[0]?.count ?? 0
    if (itemCount === 0) {
      alert('Cannot publish a drop with no products.')
      return
    }
    if (!confirm(`Publish "${drop.title}"? This will archive the current active drop.`)) return

    setPublishingId(drop.id)
    try {
      await publishMutation.mutateAsync(drop.id)
    } finally {
      setPublishingId(null)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Drops</h1>
        <Link
          to="/drops/new"
          className="px-4 py-2 bg-gray-900 text-white text-sm rounded hover:bg-gray-700"
        >
          New Drop
        </Link>
      </div>

      {isLoading && <p className="text-sm text-gray-500">Loading…</p>}

      {error && (
        <p className="text-sm text-red-600">{(error as Error).message}</p>
      )}

      {!isLoading && !error && drops.length === 0 && (
        <p className="text-sm text-gray-500">No drops yet.</p>
      )}

      {drops.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500">
                <th className="pb-2 pr-4">Title</th>
                <th className="pb-2 pr-4">Items</th>
                <th className="pb-2 pr-4">Status</th>
                <th className="pb-2 pr-4">Published</th>
                <th className="pb-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {drops.map((drop) => {
                const itemCount = drop.drop_items[0]?.count ?? 0
                const publishedAt = drop.published_at
                  ? new Date(drop.published_at).toLocaleDateString()
                  : '—'

                return (
                  <tr key={drop.id} className="hover:bg-gray-50">
                    <td className="py-3 pr-4 font-medium text-gray-900">
                      <button
                        onClick={() => navigate(`/drops/${drop.id}`)}
                        className="hover:underline text-left"
                      >
                        {drop.title ?? '(untitled)'}
                      </button>
                    </td>
                    <td className="py-3 pr-4 text-gray-600">{itemCount}</td>
                    <td className="py-3 pr-4">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${STATUS_CLS[drop.status]}`}
                      >
                        {STATUS_LABEL[drop.status]}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-gray-500">{publishedAt}</td>
                    <td className="py-3 text-right">
                      {drop.status === 'draft' && (
                        <button
                          onClick={() => handlePublish(drop)}
                          disabled={publishingId === drop.id}
                          className="px-3 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700 disabled:opacity-40"
                        >
                          {publishingId === drop.id ? 'Publishing…' : 'Publish'}
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
    </div>
  )
}

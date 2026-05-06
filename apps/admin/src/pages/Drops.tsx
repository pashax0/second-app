import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'

interface DropRow {
  id: string
  title: string
  status: 'scheduled' | 'active' | 'archived'
  scheduled_at: string
  published_at: string | null
  created_at: string
  drop_items: { count: number }[]
}

type DropTab = 'all' | 'scheduled' | 'active' | 'archived'

const TABS: { value: DropTab; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'active', label: 'Active' },
  { value: 'archived', label: 'Archived' },
]

async function fetchDrops(): Promise<DropRow[]> {
  const { data, error } = await supabase
    .from('drops')
    .select('id, title, status, scheduled_at, published_at, created_at, drop_items(count)')
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data ?? []) as unknown as DropRow[]
}

function useDebounced<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(id)
  }, [value, delay])
  return debounced
}

async function publishDrop(dropId: string) {
  const { error } = await supabase.rpc('activate_drop', { p_drop_id: dropId })
  if (error) throw error
}

const STATUS_LABEL: Record<DropRow['status'], string> = {
  scheduled: 'Scheduled',
  active: 'Active',
  archived: 'Archived',
}

const STATUS_CLS: Record<DropRow['status'], string> = {
  scheduled: 'bg-gray-100 text-gray-600',
  active: 'bg-green-100 text-green-700',
  archived: 'bg-gray-100 text-gray-400',
}

export default function Drops() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [publishingId, setPublishingId] = useState<string | null>(null)
  const [tab, setTab] = useState<DropTab>('all')
  const [searchInput, setSearchInput] = useState('')
  const search = useDebounced(searchInput, 300)

  const { data: drops = [], isLoading, error } = useQuery({
    queryKey: ['drops'],
    queryFn: fetchDrops,
  })

  const filtered = useMemo(() => {
    let rows = drops
    if (tab !== 'all') rows = rows.filter((d) => d.status === tab)
    const term = search.trim().toLowerCase()
    if (term) rows = rows.filter((d) => d.title.toLowerCase().includes(term))
    return rows
  }, [drops, tab, search])

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

    const active = drops.find((d) => d.status === 'active')
    const activeCount = active?.drop_items[0]?.count ?? 0

    const lines = [
      `Activate "${drop.title}" (${itemCount} item${itemCount === 1 ? '' : 's'})?`,
      '',
    ]
    if (active) {
      lines.push('This will archive the current active drop:')
      lines.push(`"${active.title}" (${activeCount} item${activeCount === 1 ? '' : 's'})`)
    } else {
      lines.push('No active drop to archive.')
    }

    if (!confirm(lines.join('\n'))) return

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
          placeholder="Search by title"
          className="flex-1 min-w-[220px] border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
        />
      </div>

      {isLoading && <p className="text-sm text-gray-500">Loading…</p>}

      {error && (
        <p className="text-sm text-red-600">{(error as Error).message}</p>
      )}

      {!isLoading && !error && drops.length === 0 && (
        <p className="text-sm text-gray-500">No drops yet.</p>
      )}

      {!isLoading && !error && drops.length > 0 && filtered.length === 0 && (
        <p className="text-sm text-gray-500">No drops match your filters.</p>
      )}

      {filtered.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500">
                <th className="pb-2 pr-4">Title</th>
                <th className="pb-2 pr-4">Items</th>
                <th className="pb-2 pr-4">Status</th>
                <th className="pb-2 pr-4">Scheduled</th>
                <th className="pb-2 pr-4">Published</th>
                <th className="pb-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((drop) => {
                const itemCount = drop.drop_items[0]?.count ?? 0
                const scheduledAt = new Date(drop.scheduled_at).toLocaleString()
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
                        {drop.title}
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
                    <td className="py-3 pr-4 text-gray-500">{scheduledAt}</td>
                    <td className="py-3 pr-4 text-gray-500">{publishedAt}</td>
                    <td className="py-3 text-right">
                      {drop.status === 'scheduled' && (
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

import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
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
  status: 'draft' | 'available' | 'sold'
  product_images: ProductImage[]
}

async function fetchProducts(): Promise<Product[]> {
  const { data, error } = await supabase
    .from('products')
    .select('id, name, brand, size, price, status, product_images(url, position)')
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data ?? []) as unknown as Product[]
}

async function deleteProduct(id: string) {
  const { error } = await supabase.from('products').delete().eq('id', id)
  if (error) throw error
}

const STATUS_LABEL: Record<Product['status'], string> = {
  draft: 'Draft',
  available: 'Available',
  sold: 'Sold',
}

const STATUS_CLS: Record<Product['status'], string> = {
  draft: 'bg-gray-100 text-gray-600',
  available: 'bg-green-100 text-green-700',
  sold: 'bg-red-100 text-red-600',
}

export default function Products() {
  const queryClient = useQueryClient()
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const { data: products = [], isLoading, error } = useQuery({
    queryKey: ['products'],
    queryFn: fetchProducts,
  })

  const deleteMutation = useMutation({
    mutationFn: deleteProduct,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['products'] }),
  })

  async function handleDelete(id: string) {
    if (!confirm('Delete this product?')) return
    setDeletingId(id)
    try {
      await deleteMutation.mutateAsync(id)
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Products</h1>
        <Link
          to="/products/new"
          className="px-4 py-2 bg-gray-900 text-white text-sm rounded hover:bg-gray-700"
        >
          New Product
        </Link>
      </div>

      {isLoading && <p className="text-sm text-gray-500">Loading…</p>}

      {error && (
        <p className="text-sm text-red-600">{(error as Error).message}</p>
      )}

      {!isLoading && !error && products.length === 0 && (
        <p className="text-sm text-gray-500">No products yet.</p>
      )}

      {products.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500">
                <th className="pb-2 pr-4 w-14">Photo</th>
                <th className="pb-2 pr-4">Brand</th>
                <th className="pb-2 pr-4">Size</th>
                <th className="pb-2 pr-4">Price</th>
                <th className="pb-2 pr-4">Status</th>
                <th className="pb-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {products.map((p) => {
                const thumb = [...p.product_images]
                  .sort((a, b) => a.position - b.position)[0]

                return (
                  <tr key={p.id} className="hover:bg-gray-50">
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
                      {p.brand ?? '—'}
                    </td>
                    <td className="py-2 pr-4 text-gray-600">{p.size ?? '—'}</td>
                    <td className="py-2 pr-4 text-gray-900">{p.price} ₴</td>
                    <td className="py-2 pr-4">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${STATUS_CLS[p.status]}`}
                      >
                        {STATUS_LABEL[p.status]}
                      </span>
                    </td>
                    <td className="py-2 text-right">
                      {p.status === 'draft' && (
                        <button
                          onClick={() => handleDelete(p.id)}
                          disabled={deletingId === p.id}
                          className="text-xs text-red-500 hover:text-red-700 disabled:opacity-40"
                        >
                          {deletingId === p.id ? 'Deleting…' : 'Delete'}
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

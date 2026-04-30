import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import ProductForm, {
  ProductFormValues,
  parseOptionalNumber,
  sanitizeFileName,
} from '../components/ProductForm'

export default function CreateProduct() {
  const navigate = useNavigate()
  const [photos, setPhotos] = useState<File[]>([])
  const [previews, setPreviews] = useState<string[]>([])

  function handlePhotosChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    setPhotos(files)
    setPreviews(files.map((f) => URL.createObjectURL(f)))
  }

  async function onSubmit(values: ProductFormValues) {
    if (photos.length === 0) {
      throw new Error('Add at least one photo')
    }

    const chest = parseOptionalNumber(values.chest)
    const waist = parseOptionalNumber(values.waist)
    const hips = parseOptionalNumber(values.hips)
    const length = parseOptionalNumber(values.length)

    const measurements =
      chest || waist || hips || length ? { chest, waist, hips, length } : null

    const priceNumber = parseFloat(values.price)
    const listPriceFromInput = parseOptionalNumber(values.list_price)

    const { data: product, error: insertError } = await supabase
      .from('products')
      .insert({
        name: values.name,
        brand: values.brand || null,
        size: values.size || null,
        price: priceNumber,
        list_price: listPriceFromInput ?? priceNumber,
        cost: parseOptionalNumber(values.cost),
        condition: values.condition || null,
        defect_notes: values.condition === 'has_defect' ? values.defect_notes || null : null,
        lot_id: values.lot_id || null,
        measurements,
        description: values.description || null,
        item_number: values.item_number || null,
        stock_quantity: 1,
        status: 'in_stock',
      })
      .select('id')
      .single()

    if (insertError || !product) throw insertError ?? new Error('Insert failed')

    for (let i = 0; i < photos.length; i++) {
      const file = photos[i]
      const path = `${product.id}/${i}-${sanitizeFileName(file.name)}`

      const { error: uploadError } = await supabase.storage
        .from('product-images')
        .upload(path, file)

      if (uploadError) throw uploadError

      const { error: imgError } = await supabase
        .from('product_images')
        .insert({ product_id: product.id, storage_path: path, position: i })

      if (imgError) throw imgError
    }

    navigate('/products')
  }

  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">New Product</h1>

      <ProductForm
        submitLabel="Save"
        onSubmit={onSubmit}
        onCancel={() => navigate('/products')}
      >
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
                <img
                  key={i}
                  src={src}
                  alt=""
                  className="h-20 w-20 object-cover rounded border border-gray-200"
                />
              ))}
            </div>
          )}
        </div>
      </ProductForm>
    </div>
  )
}

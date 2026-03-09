import { Link, Outlet } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

export default function Layout() {
  async function handleSignOut() {
    await supabase.auth.signOut()
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
        <div className="flex gap-6">
          <Link to="/products" className="text-sm font-medium text-gray-700 hover:text-gray-900">
            Products
          </Link>
          <Link to="/drops" className="text-sm font-medium text-gray-700 hover:text-gray-900">
            Drops
          </Link>
        </div>
        <button
          onClick={handleSignOut}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          Выйти
        </button>
      </nav>
      <main className="p-8">
        <Outlet />
      </main>
    </div>
  )
}

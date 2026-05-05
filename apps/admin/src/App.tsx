import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './lib/auth'
import ProtectedRoute from './components/ProtectedRoute'
import Layout from './components/Layout'
import Login from './pages/Login'
import Products from './pages/Products'
import CreateProduct from './pages/CreateProduct'
import EditProduct from './pages/EditProduct'
import Drops from './pages/Drops'
import CreateDrop from './pages/CreateDrop'
import DropDetail from './pages/DropDetail'
import EditDrop from './pages/EditDrop'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route path="/products" element={<Products />} />
            <Route path="/products/new" element={<CreateProduct />} />
            <Route path="/products/:id/edit" element={<EditProduct />} />
            <Route path="/drops" element={<Drops />} />
            <Route path="/drops/new" element={<CreateDrop />} />
            <Route path="/drops/:id" element={<DropDetail />} />
            <Route path="/drops/:id/edit" element={<EditDrop />} />
          </Route>
          <Route path="*" element={<Navigate to="/products" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

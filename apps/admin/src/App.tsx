import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router'
import { AdminLayout } from './AdminLayout'
import { ModulePage } from './ModulePage'
import { useAuth } from './lib/auth'
import { MODULES } from './modules'
import { CategoriesPage } from './pages/CategoriesPage'
import { LoginPage } from './pages/LoginPage'
import { ProductFormPage } from './pages/ProductFormPage'
import { ProductsPage } from './pages/ProductsPage'

// Modules with a real screen; the rest still show their scope from the spec.
const BUILT = new Set(['products', 'categories'])

function RequireStaff() {
  const staff = useAuth((state) => state.staff)
  return staff ? <Outlet /> : <Navigate to="/login" replace />
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<RequireStaff />}>
          <Route element={<AdminLayout />}>
            <Route path="products" element={<ProductsPage />} />
            <Route path="products/new" element={<ProductFormPage />} />
            <Route path="products/:id" element={<ProductFormPage />} />
            <Route path="categories" element={<CategoriesPage />} />
            {MODULES.filter((module) => !BUILT.has(module.path)).map((module) => (
              <Route key={module.path} path={module.path} element={<ModulePage module={module} />} />
            ))}
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App

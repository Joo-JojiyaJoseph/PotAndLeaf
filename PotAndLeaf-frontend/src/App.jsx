import { Navigate, Route, Routes } from 'react-router-dom';
import ProtectedRoute from './routes/ProtectedRoute';
import AppShell from './components/AppShell';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import ComingSoon from './pages/ComingSoon';
import SuppliersList from './pages/suppliers/SuppliersList';
import ProductsList from './pages/products/ProductsList';
import ProductForm from './pages/products/ProductForm';
import CompaniesList from './pages/companies/CompaniesList';
import UsersList from './pages/users/UsersList';
import RolesList from './pages/roles/RolesList';
import BulkSplitsList from './pages/bulkSplits/BulkSplitsList';
import BulkSplitForm from './pages/bulkSplits/BulkSplitForm';
import PurchasesList from './pages/purchases/PurchasesList';
import PurchaseForm from './pages/purchases/PurchaseForm';
import InventoryList from './pages/inventory/InventoryList';
import PurchaseReturnsList from './pages/purchaseReturns/PurchaseReturnsList';
import PurchaseReturnForm from './pages/purchaseReturns/PurchaseReturnForm';
import StockVerificationsList from './pages/stockVerifications/StockVerificationsList';
import StockVerificationForm from './pages/stockVerifications/StockVerificationForm';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<AppShell />}>
          <Route index element={<Dashboard />} />
          <Route path="suppliers" element={<SuppliersList />} />
          <Route path="products" element={<ProductsList />} />
          <Route path="products/new" element={<ProductForm />} />
          <Route path="products/:id/edit" element={<ProductForm />} />
          <Route path="purchases" element={<PurchasesList />} />
          <Route path="purchases/new" element={<PurchaseForm />} />
          <Route path="purchases/:id/edit" element={<PurchaseForm />} />
          <Route path="inventory" element={<InventoryList />} />
          <Route path="purchase-returns" element={<PurchaseReturnsList />} />
          <Route path="purchase-returns/new" element={<PurchaseReturnForm />} />
          <Route path="stock-verifications" element={<StockVerificationsList />} />
          <Route path="stock-verifications/new" element={<StockVerificationForm />} />
          <Route path="companies" element={<CompaniesList />} />
          <Route path="users" element={<UsersList />} />
          <Route path="roles" element={<RolesList />} />
          <Route path="bulk-splits" element={<BulkSplitsList />} />
          <Route path="bulk-splits/new" element={<BulkSplitForm />} />
          <Route path="soon/:module" element={<ComingSoon />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

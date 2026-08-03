import { Navigate, Route, Routes } from 'react-router-dom';
import ProtectedRoute from './routes/ProtectedRoute';
import AppShell from './components/AppShell';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import ComingSoon from './pages/ComingSoon';
import SuppliersList from './pages/suppliers/SuppliersList';
import SupplierDetail from './pages/suppliers/SupplierDetail';
import ProductsList from './pages/products/ProductsList';
import ProductForm from './pages/products/ProductForm';
import CompaniesList from './pages/companies/CompaniesList';
import UsersList from './pages/users/UsersList';
import UserDetail from './pages/users/UserDetail';
import RolesList from './pages/roles/RolesList';
import BulkSplitsList from './pages/bulkSplits/BulkSplitsList';
import BulkSplitForm from './pages/bulkSplits/BulkSplitForm';
import BulkSplitDetail from './pages/bulkSplits/BulkSplitDetail';
import CustomersList from './pages/customers/CustomersList';
import CustomerDetail from './pages/customers/CustomerDetail';
import SalesList from './pages/sales/SalesList';
import SaleForm from './pages/sales/SaleForm';
import SaleDetail from './pages/sales/SaleDetail';
import PaymentsList from './pages/payments/PaymentsList';
import ReceiptsList from './pages/receipts/ReceiptsList';
import CommissionList from './pages/commission/CommissionList';
import TransfersList from './pages/transfers/TransfersList';
import TransferForm from './pages/transfers/TransferForm';
import TransferDetail from './pages/transfers/TransferDetail';
import LocationsList from './pages/locations/LocationsList';
import ProductionList from './pages/production/ProductionList';
import ProductionOrderDetail from './pages/production/ProductionOrderDetail';
import RentalsList from './pages/rentals/RentalsList';
import RentalForm from './pages/rentals/RentalForm';
import RentalDetail from './pages/rentals/RentalDetail';
import ReportsPage from './pages/reports/ReportsPage';
import BarcodeLabelsPage from './pages/products/BarcodeLabelsPage';
import PurchasesList from './pages/purchases/PurchasesList';
import PurchaseForm from './pages/purchases/PurchaseForm';
import PurchaseDetail from './pages/purchases/PurchaseDetail';
import InventoryList from './pages/inventory/InventoryList';
import PurchaseReturnsList from './pages/purchaseReturns/PurchaseReturnsList';
import PurchaseReturnForm from './pages/purchaseReturns/PurchaseReturnForm';
import PurchaseReturnDetail from './pages/purchaseReturns/PurchaseReturnDetail';
import StockVerificationsList from './pages/stockVerifications/StockVerificationsList';
import StockVerificationForm from './pages/stockVerifications/StockVerificationForm';
import StockVerificationDetail from './pages/stockVerifications/StockVerificationDetail';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<AppShell />}>
          <Route index element={<Dashboard />} />
          <Route path="suppliers" element={<SuppliersList />} />
          <Route path="suppliers/:id" element={<SupplierDetail />} />
          <Route path="products" element={<ProductsList />} />
          <Route path="products/labels" element={<BarcodeLabelsPage />} />
          <Route path="products/new" element={<ProductForm />} />
          <Route path="products/:id/edit" element={<ProductForm />} />
          <Route path="purchases" element={<PurchasesList />} />
          <Route path="purchases/new" element={<PurchaseForm />} />
          <Route path="purchases/:id/edit" element={<PurchaseForm />} />
          <Route path="purchases/:id" element={<PurchaseDetail />} />
          <Route path="inventory" element={<InventoryList />} />
          <Route path="purchase-returns" element={<PurchaseReturnsList />} />
          <Route path="purchase-returns/new" element={<PurchaseReturnForm />} />
          <Route path="purchase-returns/:id" element={<PurchaseReturnDetail />} />
          <Route path="stock-verifications" element={<StockVerificationsList />} />
          <Route path="stock-verifications/new" element={<StockVerificationForm />} />
          <Route path="stock-verifications/:id" element={<StockVerificationDetail />} />
          <Route path="companies" element={<CompaniesList />} />
          <Route path="users" element={<UsersList />} />
          <Route path="users/:id" element={<UserDetail />} />
          <Route path="roles" element={<RolesList />} />
          <Route path="bulk-splits" element={<BulkSplitsList />} />
          <Route path="bulk-splits/new" element={<BulkSplitForm />} />
          <Route path="bulk-splits/:id" element={<BulkSplitDetail />} />
          <Route path="customers" element={<CustomersList />} />
          <Route path="customers/:id" element={<CustomerDetail />} />
          <Route path="sales" element={<SalesList />} />
          <Route path="sales/new" element={<SaleForm />} />
          <Route path="sales/:id" element={<SaleDetail />} />
          <Route path="payments" element={<PaymentsList />} />
          <Route path="receipts" element={<ReceiptsList />} />
          <Route path="commission" element={<CommissionList />} />
          <Route path="transfers" element={<TransfersList />} />
          <Route path="transfers/new" element={<TransferForm />} />
          <Route path="transfers/:id" element={<TransferDetail />} />
          <Route path="locations" element={<LocationsList />} />
          <Route path="production" element={<ProductionList />} />
          <Route path="production/orders/:id" element={<ProductionOrderDetail />} />
          <Route path="rentals" element={<RentalsList />} />
          <Route path="rentals/new" element={<RentalForm />} />
          <Route path="rentals/:id" element={<RentalDetail />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="soon/:module" element={<ComingSoon />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

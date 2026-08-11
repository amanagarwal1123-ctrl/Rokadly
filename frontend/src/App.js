import React from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AppProvider, useApp } from "@/context/AppContext";
import Layout from "@/components/Layout";
import { Toaster } from "@/components/ui/sonner";

import LoginPage from "@/pages/LoginPage";
import DashboardPage from "@/pages/DashboardPage";
import BillsPage from "@/pages/BillsPage";
import AllocationPage from "@/pages/AllocationPage";
import CashCountPage from "@/pages/CashCountPage";
import ExpensesPage from "@/pages/ExpensesPage";
import AdjustmentsPage from "@/pages/AdjustmentsPage";
import ReconciliationPage from "@/pages/ReconciliationPage";
import ChequesPage from "@/pages/ChequesPage";
import DiscrepanciesPage from "@/pages/DiscrepanciesPage";
import RegisterPage from "@/pages/RegisterPage";
import ComparisonPage from "@/pages/ComparisonPage";
import CrossStorePage from "@/pages/CrossStorePage";
import BanksPage from "@/pages/BanksPage";
import AdminUsersPage from "@/pages/AdminUsersPage";
import AdminHeadsPage from "@/pages/AdminHeadsPage";
import AuditLogPage from "@/pages/AuditLogPage";
import PrintNonCashPage from "@/pages/PrintNonCashPage";
import PrintCashPage from "@/pages/PrintCashPage";

const Protected = ({ children, roles }) => {
  const { user, loading } = useApp();
  const location = useLocation();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted-foreground text-sm animate-pulse">Loading Rokadly…</div>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return children;
};

const Page = ({ el, roles }) => <Protected roles={roles}><Layout>{el}</Layout></Protected>;

function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<Page el={<DashboardPage />} />} />
          <Route path="/bills" element={<Page el={<BillsPage />} roles={["cashier", "admin"]} />} />
          <Route path="/allocation" element={<Page el={<AllocationPage />} />} />
          <Route path="/cash-count" element={<Page el={<CashCountPage />} roles={["cashier", "admin"]} />} />
          <Route path="/expenses" element={<Page el={<ExpensesPage />} />} />
          <Route path="/adjustments" element={<Page el={<AdjustmentsPage />} roles={["cashier", "admin"]} />} />
          <Route path="/reconciliation" element={<Page el={<ReconciliationPage />} roles={["accountant", "manager", "admin"]} />} />
          <Route path="/cheques" element={<Page el={<ChequesPage />} />} />
          <Route path="/discrepancies" element={<Page el={<DiscrepanciesPage />} />} />
          <Route path="/register" element={<Page el={<RegisterPage />} />} />
          <Route path="/comparison" element={<Page el={<ComparisonPage />} roles={["admin"]} />} />
          <Route path="/cross-store" element={<Page el={<CrossStorePage />} roles={["admin"]} />} />
          <Route path="/banks" element={<Page el={<BanksPage />} />} />
          <Route path="/admin/users" element={<Page el={<AdminUsersPage />} roles={["admin"]} />} />
          <Route path="/admin/heads" element={<Page el={<AdminHeadsPage />} roles={["admin"]} />} />
          <Route path="/admin/audit" element={<Page el={<AuditLogPage />} roles={["admin"]} />} />
          <Route path="/print/noncash" element={<Protected><PrintNonCashPage /></Protected>} />
          <Route path="/print/cash" element={<Protected><PrintCashPage /></Protected>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <Toaster position="top-center" richColors />
      </BrowserRouter>
    </AppProvider>
  );
}

export default App;

import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { ClientLayout } from "@/components/layout/ClientLayout";
import { LoginPage } from "@/routes/LoginPage";
import { AcceptInvitePage } from "@/routes/AcceptInvitePage";
import { ForgotPasswordPage, ResetPasswordPage } from "@/routes/PasswordResetPages";

import { AdminDashboard } from "@/routes/admin/AdminDashboard";
import { CompaniesList } from "@/routes/admin/CompaniesList";
import { CompanyProfile } from "@/routes/admin/CompanyProfile";
import { WebsitesList } from "@/routes/admin/WebsitesList";
import { WebsiteManage } from "@/routes/admin/WebsiteManage";
import { WebsiteDeploy } from "@/routes/admin/WebsiteDeploy";
import { BillingOverview } from "@/routes/admin/BillingOverview";
import { SettingsPage } from "@/routes/admin/SettingsPage";
import { AdminTickets } from "@/routes/admin/AdminTickets";
import { AdminExtras } from "@/routes/admin/AdminExtras";

import { ClientDashboard } from "@/routes/portal/ClientDashboard";
import { ClientEditor } from "@/routes/portal/ClientEditor";
import { ClientMessages } from "@/routes/portal/ClientMessages";
import { ClientDocuments } from "@/routes/portal/ClientDocuments";
import { ClientTickets } from "@/routes/portal/ClientTickets";
import { ClientExtras } from "@/routes/portal/ClientExtras";
import { AccountSettings } from "@/routes/portal/AccountSettings";
import { LoadingState } from "@/components/ui/state";

// This app is deployed on its own portal subdomain, separate from the public marketing site —
// so "/" has no visitor-facing content of its own. Signed-in users go to their dashboard;
// everyone else goes to /login.
function HomeRedirect() {
  const { user, loading } = useAuth();
  if (loading) return <LoadingState />;
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={user.role === "admin" ? "/admin" : "/portal"} replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomeRedirect />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/accept-invite/:token" element={<AcceptInvitePage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password/:token" element={<ResetPasswordPage />} />

      <Route
        path="/admin"
        element={
          <ProtectedRoute role="admin">
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<AdminDashboard />} />
        <Route path="companies" element={<CompaniesList />} />
        <Route path="companies/:id" element={<CompanyProfile />} />
        <Route path="websites" element={<WebsitesList />} />
        <Route path="websites/:id" element={<WebsiteManage />} />
        <Route path="websites/:id/deploy" element={<WebsiteDeploy />} />
        <Route path="billing" element={<BillingOverview />} />
        <Route path="tickets" element={<AdminTickets />} />
        <Route path="extras" element={<AdminExtras />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>

      <Route
        path="/portal"
        element={
          <ProtectedRoute role="client">
            <ClientLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<ClientDashboard />} />
        <Route path="edit/:websiteId" element={<ClientEditor />} />
        <Route path="messages" element={<ClientMessages />} />
        <Route path="documents" element={<ClientDocuments />} />
        <Route path="tickets" element={<ClientTickets />} />
        <Route path="extras" element={<ClientExtras />} />
        <Route path="account" element={<AccountSettings />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

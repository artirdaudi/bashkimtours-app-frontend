import { useEffect, useSyncExternalStore } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { getAuthStatus, initializeAuth, subscribeAuth } from "./auth";
import LoginPage from "./LoginPage";
import DashboardLayout from "./DashboardLayout";
import MaarifTabs from "./MaarifTabs";
import StudentsPage from "./StudentsPage";
import VehiclesManagementPage from "./VehiclesManagementPage";
import { AccountPage, AreasPage, DriversPage } from "./PortalPages";
import IncomePage from "./IncomePage";
import ShoferatPage from "./ShoferatPage";
import AutobusatPage from "./AutobusatPage";
import ChartersPage from "./ChartersPage";
import CharterTabs from "./CharterTabs";
import CharterFinancePage from "./CharterFinancePage";
import AcademicCalendarPage from "./AcademicCalendarPage";
import StudentCardsPage from "./StudentCardsPage";
import PaymentFollowupRulesPage from "./PaymentFollowupRulesPage";
import MessagesPage from "./MessagesPage";
import AccountsRolesPage from "./AccountsRolesPage";
import CashRegistersPage from "./CashRegistersPage";
import DocumentTypesPage from "./DocumentTypesPage";
import MaarifCashPage from "./MaarifCashPage";
import MonthlyPaymentsPage from "./MonthlyPaymentsPage";
import StudentDebtsPage from "./StudentDebtsPage";
import ScanPage from "./ScanPage";
import PublicStudentPage from "./PublicStudentPage";
import "./bashkimtours.css";

const Guard = ({ children }) =>
  getAuthStatus() === "authenticated" ? children : <Navigate to="/" replace />;

export default function BashkimToursApp() {
  const status = useSyncExternalStore(subscribeAuth, getAuthStatus);
  useEffect(() => { initializeAuth(); }, []);
  if (status === "initializing") return <main role="status" aria-live="polite">Duke ngarkuar…</main>;
  if (status === "unavailable") return <main role="status">Nuk mund të lidhemi me serverin. <button onClick={() => window.location.reload()}>Provo përsëri</button></main>;
  return (
    <Routes>
      <Route
        path="/"
        element={
          status === "authenticated" ? (
            <Navigate to="/students" replace />
          ) : (
            <LoginPage />
          )
        }
      />
      <Route path="/student/:qrToken" element={<PublicStudentPage />} />
      <Route
        element={
          <Guard>
            <DashboardLayout />
          </Guard>
        }
      >
        <Route element={<MaarifTabs />}>
          <Route path="students" element={<StudentsPage />} />
          <Route path="debts" element={<StudentDebtsPage />} />
          <Route path="skano" element={<ScanPage />} />
          <Route path="cards" element={<StudentCardsPage />} />
          <Route path="areas" element={<AreasPage />} />
          <Route path="vehicles" element={<VehiclesManagementPage />} />
          <Route path="drivers" element={<DriversPage />} />
          <Route path="calendar" element={<AcademicCalendarPage />} />
          <Route path="followup-rules" element={<PaymentFollowupRulesPage />} />
          <Route path="payments" element={<MonthlyPaymentsPage />} />
          <Route path="arka" element={<MaarifCashPage />} />
        </Route>
        <Route path="account" element={<AccountPage />} />
        <Route path="income" element={<IncomePage />} />
        <Route path="shoferat" element={<ShoferatPage />} />
        <Route path="autobusat" element={<AutobusatPage />} />
        <Route path="charters" element={<CharterTabs />}>
          <Route index element={<ChartersPage />} />
          <Route path="payments" element={<CharterFinancePage />} />
          <Route path="cash" element={<MaarifCashPage registerType="EXCURSION" moduleLabel="Charterët" />} />
        </Route>
        <Route path="messages" element={<MessagesPage />} />
        <Route path="settings/accounts-roles" element={<AccountsRolesPage />} />
        <Route path="settings/cash-registers" element={<CashRegistersPage />} />
        <Route path="settings/document-types" element={<DocumentTypesPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

import { Navigate, Route, Routes } from "react-router-dom";
import { getToken } from "./auth";
import LoginPage from "./LoginPage";
import DashboardLayout from "./DashboardLayout";
import MaarifTabs from "./MaarifTabs";
import StudentsPage from "./StudentsPage";
import VehiclesManagementPage from "./VehiclesManagementPage";
import { AccountPage, AreasPage, DriversPage } from "./PortalPages";
import IncomePage from "./IncomePage";
import ShoferatPage from "./ShoferatPage";
import AutobusatPage from "./AutobusatPage";
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
  getToken() ? children : <Navigate to="/" replace />;

export default function BashkimToursApp() {
  return (
    <Routes>
      <Route
        path="/"
        element={
          getToken() ? (
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
        <Route path="messages" element={<MessagesPage />} />
        <Route path="settings/accounts-roles" element={<AccountsRolesPage />} />
        <Route path="settings/cash-registers" element={<CashRegistersPage />} />
        <Route path="settings/document-types" element={<DocumentTypesPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./auth";
import Layout from "./Layout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Initiatives from "./pages/Initiatives";
import InitiativeDetail from "./pages/InitiativeDetail";
import Departments from "./pages/Departments";
import DepartmentDetail from "./pages/DepartmentDetail";
import Sectors from "./pages/Sectors";
import Implementation from "./pages/Implementation";
import ImplementationDetail from "./pages/ImplementationDetail";
import SectorDetail from "./pages/SectorDetail";
import Schemes from "./pages/Schemes";
import SchemeDetail from "./pages/SchemeDetail";
import Entry from "./pages/Entry";
import Reports from "./pages/Reports";
import PRP from "./pages/PRP";
import Admin from "./pages/Admin";
import { Spinner } from "./ui";

function Protected({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <Spinner label="Checking session…" />;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            element={
              <Protected>
                <Layout />
              </Protected>
            }
          >
            <Route path="/" element={<Dashboard />} />
            <Route path="/initiatives" element={<Initiatives />} />
            <Route path="/initiatives/:id" element={<InitiativeDetail />} />
            <Route path="/departments" element={<Departments />} />
            <Route path="/departments/:id" element={<DepartmentDetail />} />
            <Route path="/implementation" element={<Implementation />} />
            <Route path="/implementation/:name" element={<ImplementationDetail />} />
            <Route path="/sectors" element={<Sectors />} />
            <Route path="/sectors/:name" element={<SectorDetail />} />
            <Route path="/prp" element={<PRP />} />
            <Route path="/schemes" element={<Schemes />} />
            <Route path="/schemes/:id" element={<SchemeDetail />} />
            <Route path="/entry" element={<Entry />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

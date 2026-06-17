import { useEffect, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import Dashboard from "./components/dash/dashboard";
import SectionPage from "./components/dash/section-page";
import StudManage from "./components/dash/StudManage";
import DetailedInputATL from "./components/dash/detailed";
import BatchInputATL from "./components/dash/batch";
import Report from "./components/dash/report";
import ManageUser from "./components/dash/manageuser"
import ATLmanage from "./components/dash/ATLmanage";
import Login from "./components/auth/login";
import { getCurrentUser } from "./services/atlApi";
import { ROLE_CODES, canAccessRoute } from "./services/accessControl";

function ProtectedRoute({ children, roles = [] }) {
  const location = useLocation();
  const [state, setState] = useState({ loading: true, user: null });

  useEffect(() => {
    let cancelled = false;
    getCurrentUser()
      .then((user) => {
        if (!cancelled) setState({ loading: false, user });
      })
      .catch(() => {
        if (!cancelled) setState({ loading: false, user: null });
      });
    return () => {
      cancelled = true;
    };
  }, [location.pathname]);

  if (state.loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-stone-50 text-sm font-bold text-stone-500">
        Memeriksa akses akun...
      </div>
    );
  }

  if (!state.user) return <Navigate to="/" replace state={{ from: location }} />;
  if (!canAccessRoute(state.user, roles)) return <Navigate to="/unauthorized" replace />;
  return children;
}

function Unauthorized() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-stone-50 p-6">
      <section className="max-w-md rounded-3xl border border-rose-200 bg-white p-8 text-center shadow-xl shadow-stone-200/60">
        <span className="material-symbols-outlined text-5xl text-rose-500">lock</span>
        <h1 className="mt-4 text-2xl font-black text-stone-950">Akses Ditolak</h1>
        <p className="mt-2 text-sm font-semibold leading-6 text-stone-500">
          Akun ini belum memiliki role yang diperlukan untuk membuka halaman tersebut.
        </p>
      </section>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/students" element={<ProtectedRoute roles={[ROLE_CODES.HOMEROOM]}><StudManage /></ProtectedRoute>} />
        <Route path="/input-atl" element={<ProtectedRoute roles={[ROLE_CODES.EVALUATOR]}><DetailedInputATL /></ProtectedRoute>} />
        <Route path="/input-atl/batch" element={<ProtectedRoute roles={[ROLE_CODES.EVALUATOR]}><BatchInputATL /></ProtectedRoute>} />
        <Route path="/reports" element={<ProtectedRoute roles={[ROLE_CODES.SUBJECT_COORDINATOR]}><Report /></ProtectedRoute>} />
        <Route path="/settings/users" element={<ProtectedRoute roles={[ROLE_CODES.ADMIN]}><ManageUser /></ProtectedRoute>} />
        <Route path="/atl/manage" element={<ProtectedRoute roles={[ROLE_CODES.ATL_EXPERT]}><ATLmanage /></ProtectedRoute>} />
        <Route path="/atl/weight" element={<ProtectedRoute roles={[ROLE_CODES.ATL_EXPERT]}><ATLmanage initialTab="settings" /></ProtectedRoute>} />
        <Route path="/unauthorized" element={<Unauthorized />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;

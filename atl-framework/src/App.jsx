import { BrowserRouter, Route, Routes } from "react-router-dom";
import Dashboard from "./components/dash/dashboard";
import SectionPage from "./components/dash/section-page";
import StudManage from "./components/dash/StudManage";
import DetailedInputATL from "./components/dash/detailed";
import BatchInputATL from "./components/dash/batch";
import Report from "./components/dash/report";
import ManageUser from "./components/dash/manageuser"
import ATLmanage from "./components/dash/ATLmanage";
import Login from "./components/auth/login";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/students" element={<StudManage />} />
        <Route path="/input-atl" element={<DetailedInputATL />} />
        <Route path="/input-atl/batch" element={<BatchInputATL />} />
        <Route path="/reports" element={<Report />} />
        <Route path="/settings/users" element={<ManageUser />} />
        <Route path="/atl/manage" element={<ATLmanage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;

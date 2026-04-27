import { NavLink, useNavigate } from "react-router-dom";
import schoolLogo from "../../assets/Cita_Hati_Christian_School_Logo.jpeg";

export default function Sidebar({ user }) {
  const navigate = useNavigate();
  const menuItems = [
    {
      icon: "space_dashboard",
      label: "Dashboard",
      key: "dashboard",
      to: "/dashboard",
    },
    {
      icon: "groups",
      label: "Manajemen Siswa",
      key: "students",
      to: "/students",
    },
    {
      icon: "edit_note",
      label: "Input Penilaian ATL",
      key: "input-atl",
      to: "/input-atl",
    },
    {
      icon: "poll",
      label: "Hasil Laporan",
      key: "report",
      to: "/reports",
    },
  ];

  const configItems = [
    {
      icon: "manage_accounts",
      label: "Pengaturan User",
      key: "user",
      to: "/settings/users",
    },
    {
      icon: "tune",
      label: "Manajemen Kriteria",
      key: "atl",
      to: "/atl/manage",
    },
  ];

  const currentUser = user ?? {
    name: "Joko Wiryanto",
    role: "Guru / Evaluator",
  };

  return (
    <aside className="hidden h-screen w-[17.5rem] flex-col border-r-2 border-stone-200 bg-white shadow-[12px_0_28px_rgba(15,23,42,0.06)] lg:flex">
      <div className="flex h-24 items-center gap-3 border-b border-stone-200 px-5">
        <div className="flex size-11 items-center justify-center rounded-full border border-primary/25 bg-primary/10 p-1.5 shadow-[0_10px_20px_rgba(234,179,8,0.12)]">
          <img
            src={schoolLogo}
            alt="Cita Hati crest"
            className="size-full rounded-full object-cover"
          />
        </div>
        <div className="min-w-0">
          <h2 className="truncate font-headline text-[1.05rem] font-semibold leading-tight text-stone-900">
             Cita Hati Surabaya
          </h2>
          <p className="mt-1 font-label text-[10px] uppercase tracking-[0.24em] text-primary">
            ATL Assesment System
          </p>
        </div>
      </div>

      <nav className="flex-1 px-4 py-6">
        <div className="space-y-1.5">
          {menuItems.map((item) => {
            return (
              <NavLink
                key={item.key}
                to={item.to}
                className={({ isActive }) =>
                  `group flex items-center gap-3 rounded-2xl px-4 py-3 text-sm transition-all duration-300 ${
                    isActive
                      ? "border border-primary/15 bg-primary/10 text-primary shadow-[0_10px_25px_rgba(234,179,8,0.10)]"
                      : "border border-transparent text-slate-500 hover:-translate-y-0.5 hover:border-primary/20 hover:bg-stone-50 hover:text-stone-900 hover:shadow-[0_12px_24px_rgba(15,23,42,0.06)]"
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <span
                      className={`material-symbols-outlined text-[20px] ${
                        isActive
                          ? "text-primary"
                          : "text-slate-400 transition-colors group-hover:text-primary"
                      }`}
                    >
                      {item.icon}
                    </span>
                    <span className={isActive ? "font-semibold" : "font-medium"}>
                      {item.label}
                    </span>
                  </>
                )}
              </NavLink>
            );
          })}
        </div>

        <div className="my-5 border-t border-stone-200" />

        <p className="px-3 font-label text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
          Pengaturan
        </p>

        <div className="mt-3 space-y-1.5">
          {configItems.map((item) => (
            <NavLink
              key={item.key}
              to={item.to}
              className={({ isActive }) =>
                `group flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-medium transition-all duration-300 ${
                  isActive
                    ? "border-primary/15 bg-primary/10 text-primary shadow-[0_10px_25px_rgba(234,179,8,0.10)]"
                    : "border-transparent text-slate-500 hover:-translate-y-0.5 hover:border-primary/20 hover:bg-stone-50 hover:text-stone-900 hover:shadow-[0_12px_24px_rgba(15,23,42,0.06)]"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className={`material-symbols-outlined text-[20px] transition-colors ${
                      isActive ? "text-primary" : "text-slate-400 group-hover:text-primary"
                    }`}
                  >
                    {item.icon}
                  </span>
                  <span className={item.key === "model" ? "max-w-[9rem] leading-5" : ""}>
                    {item.label}
                  </span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>

      <div className="border-t border-stone-200 bg-white/95 px-4 py-4">
        <div className="flex items-center gap-3 rounded-2xl border border-stone-200/90 bg-white px-3 py-3 shadow-[0_8px_20px_rgba(15,23,42,0.04)] transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-[0_14px_28px_rgba(15,23,42,0.08)]">
          <div className="flex size-10 items-center justify-center rounded-full bg-primary text-white shadow-[0_10px_22px_rgba(234,179,8,0.18)]">
            <span className="material-symbols-outlined text-[20px]">person</span>
          </div>

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-stone-900">
              {currentUser.name}
            </p>
            <p className="truncate text-xs text-slate-500">{currentUser.role}</p>
          </div>

          <button
            type="button"
            className="flex size-9 items-center justify-center rounded-xl text-slate-400 transition-all duration-300 hover:bg-stone-100 hover:text-primary"
            aria-label="Logout"
            onClick={() => navigate("/")}
          >
            <span className="material-symbols-outlined text-[19px]">logout</span>
          </button>
        </div>
      </div>
    </aside>
  );
}

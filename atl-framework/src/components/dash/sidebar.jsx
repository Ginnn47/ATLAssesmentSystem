import { useEffect, useMemo, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import schoolLogo from "../../assets/Cita_Hati_Christian_School_Logo.jpeg";
import { getCurrentUser, logoutUser } from "../../services/atlApi";
import { getGrantedFeatures, getSidebarMenuGroups, getUserRoleNames } from "../../services/accessControl";

export default function Sidebar({ user }) {
  const navigate = useNavigate();

  const fallbackUser = useMemo(() => ({
    name: "Belum Login",
    role: "Guest",
  }), []);

  const normalizeUser = (value) => {
    if (!value) return null;
    return {
      ...value,
      name: value.name || value.fullName || value.username || fallbackUser.name,
      role: value.role || value.roleLabel || value.roleGroup || fallbackUser.role,
      nip: value.nip || "",
      status: value.status || "",
    };
  };

  const readCachedUser = () => {
    try {
      const cached = localStorage.getItem("atl_current_user");
      return cached ? normalizeUser(JSON.parse(cached)) : null;
    } catch (error) {
      return null;
    }
  };

  const [currentUser, setCurrentUser] = useState(() => readCachedUser() || normalizeUser(user) || fallbackUser);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const { main: menuItems, config: configItems } = useMemo(() => getSidebarMenuGroups(currentUser), [currentUser]);
  const roleNames = useMemo(() => getUserRoleNames(currentUser), [currentUser]);
  const grantedFeatures = useMemo(() => getGrantedFeatures(currentUser), [currentUser]);

  useEffect(() => {
    let cancelled = false;
    const syncCurrentUser = async () => {
      const cachedUser = readCachedUser();
      if (cachedUser && !cancelled) setCurrentUser(cachedUser);
      const backendUser = await getCurrentUser();
      const freshCachedUser = readCachedUser();
      if (!cancelled) setCurrentUser(normalizeUser(backendUser) || freshCachedUser || normalizeUser(user) || fallbackUser);
    };

    syncCurrentUser();
    window.addEventListener("focus", syncCurrentUser);
    window.addEventListener("storage", syncCurrentUser);
    window.addEventListener("atl-auth-updated", syncCurrentUser);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", syncCurrentUser);
      window.removeEventListener("storage", syncCurrentUser);
      window.removeEventListener("atl-auth-updated", syncCurrentUser);
    };
  }, [user, fallbackUser]);

  const initials = (currentUser.name || fallbackUser.name)
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const handleLogout = async () => {
    try {
      await logoutUser();
    } catch (error) {
      localStorage.removeItem("atl_current_user");
    }
    window.dispatchEvent(new Event("atl-auth-updated"));
    navigate("/");
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

        {configItems.length > 0 && (
          <>
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
          </>
        )}
      </nav>

      <div className="border-t border-stone-200 bg-white/95 px-4 py-4">
        <div className="relative">
          {isUserMenuOpen && (
            <div className="absolute bottom-full left-0 right-0 mb-3 overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-[0_18px_45px_rgba(15,23,42,0.16)]">
              <div className="border-b border-stone-100 px-4 py-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-stone-400">My Access</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {roleNames.map((role) => (
                    <span key={role} className="rounded-full bg-primary/10 px-2 py-1 text-[10px] font-black text-primary">
                      {role}
                    </span>
                  ))}
                </div>
                <p className="mt-2 line-clamp-2 text-[11px] font-semibold leading-5 text-stone-500">
                  {grantedFeatures.slice(0, 3).join(", ")}
                </p>
              </div>
              {[
                ["person", "Profile", "/dashboard"],
                ["verified_user", "My Access", "/dashboard"],
                ["settings", "Account Settings", "/dashboard"],
              ].map(([icon, label, to]) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => {
                    setIsUserMenuOpen(false);
                    navigate(to);
                  }}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left text-xs font-bold text-stone-600 transition hover:bg-stone-50 hover:text-primary"
                >
                  <span className="material-symbols-outlined text-[18px]">{icon}</span>
                  {label}
                </button>
              ))}
              <button
                type="button"
                onClick={handleLogout}
                className="flex w-full items-center gap-3 border-t border-stone-100 px-4 py-3 text-left text-xs font-black text-rose-600 transition hover:bg-rose-50"
              >
                <span className="material-symbols-outlined text-[18px]">logout</span>
                Logout
              </button>
            </div>
          )}
          <div className="flex items-center gap-3 rounded-2xl border border-stone-200/90 bg-white px-3 py-3 shadow-[0_8px_20px_rgba(15,23,42,0.04)] transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-[0_14px_28px_rgba(15,23,42,0.08)]">
            <button
              type="button"
              onClick={() => setIsUserMenuOpen((current) => !current)}
              className="flex min-w-0 flex-1 items-center gap-3 text-left"
            >
              <div className="flex size-10 items-center justify-center rounded-full bg-primary text-xs font-black text-white shadow-[0_10px_22px_rgba(234,179,8,0.18)]">
                {initials || <span className="material-symbols-outlined text-[20px]">person</span>}
              </div>

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-stone-900">
                  {currentUser.name}
                </p>
                <p className="truncate text-xs text-slate-500">{roleNames.join(" + ") || currentUser.role}</p>
                {currentUser.nip && <p className="truncate text-[10px] font-semibold text-slate-400">{currentUser.nip}</p>}
              </div>
            </button>

            <button
              type="button"
              className="flex size-9 items-center justify-center rounded-xl text-slate-400 transition-all duration-300 hover:bg-stone-100 hover:text-primary"
              aria-label="Buka menu user"
              onClick={() => setIsUserMenuOpen((current) => !current)}
            >
              <span className="material-symbols-outlined text-[19px]">{isUserMenuOpen ? "expand_more" : "more_vert"}</span>
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}

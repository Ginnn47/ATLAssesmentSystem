import React, { useMemo, useState } from "react";
import Sidebar from "./sidebar";

const initialUsers = [
  {
    id: 1,
    name: "Alfa Santoso Wijaya",
    nip: "19901112 201502 1 003",
    roleLabel: "Admin",
    roleGroup: "Admin",
    status: "Aktif",
    lastLogin: "Baru saja",
    classAccess: [],
  },
  {
    id: 2,
    name: "Maria Ulfa Rahmawati",
    nip: "19890214 201103 2 011",
    roleLabel: "Akademik",
    roleGroup: "Akademik",
    status: "Aktif",
    lastLogin: "9 menit lalu",
    classAccess: ["3A", "4A"],
  },
  {
    id: 3,
    name: "Megawati Putri",
    nip: "19850325 201001 2 001",
    roleLabel: "Guru (Wali Kelas)",
    roleGroup: "Guru Wali Kelas",
    status: "Aktif",
    lastLogin: "2 jam lalu",
    classAccess: ["3A"],
  },
  {
    id: 4,
    name: "Joko Wiryanto",
    nip: "19920505 201801 2 005",
    roleLabel: "PJ Mapel - IPA",
    roleGroup: "PJ Mapel",
    status: "Aktif",
    lastLogin: "1 hari lalu",
    classAccess: ["3A", "4A"],
  },
  {
    id: 5,
    name: "Andi Prasetyo",
    nip: "19930809 201909 1 007",
    roleLabel: "PJ Mapel - Math",
    roleGroup: "PJ Mapel",
    status: "Aktif",
    lastLogin: "3 jam lalu",
    classAccess: ["4A"],
  },
];

const roleColors = {
  Admin: "bg-slate-100 text-slate-700 border-slate-200",
  Akademik: "bg-indigo-100 text-indigo-700 border-indigo-200",
  "Guru Wali Kelas": "bg-emerald-100 text-emerald-700 border-emerald-200",
  "PJ Mapel": "bg-amber-100 text-amber-700 border-amber-200",
};

const classColorVariants = [
  { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200", active: "bg-blue-500 text-white border-blue-600 shadow-blue-500/20" },
  { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200", active: "bg-emerald-500 text-white border-emerald-600 shadow-emerald-500/20" },
  { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200", active: "bg-amber-500 text-white border-amber-600 shadow-amber-500/20" },
  { bg: "bg-rose-50", text: "text-rose-700", border: "border-rose-200", active: "bg-rose-500 text-white border-rose-600 shadow-rose-500/20" },
  { bg: "bg-indigo-50", text: "text-indigo-700", border: "border-indigo-200", active: "bg-indigo-500 text-white border-indigo-600 shadow-indigo-500/20" },
  { bg: "bg-orange-50", text: "text-orange-700", border: "border-orange-200", active: "bg-orange-500 text-white border-orange-600 shadow-orange-500/20" },
  { bg: "bg-teal-50", text: "text-teal-700", border: "border-teal-200", active: "bg-teal-500 text-white border-teal-600 shadow-teal-500/20" },
  { bg: "bg-purple-50", text: "text-purple-700", border: "border-purple-200", active: "bg-purple-500 text-white border-purple-600 shadow-purple-500/20" },
  { bg: "bg-pink-50", text: "text-pink-700", border: "border-pink-200", active: "bg-pink-500 text-white border-pink-600 shadow-pink-500/20" },
  { bg: "bg-cyan-50", text: "text-cyan-700", border: "border-cyan-200", active: "bg-cyan-500 text-white border-cyan-600 shadow-cyan-500/20" },
];

export default function ManageUser() {
  const currentUser = { name: "Joko Wiryanto", role: "Guru / Evaluator" };
  const isAcademic = currentUser.role === "Akademik";

  const [activeTab, setActiveTab] = useState("users");
  const [users, setUsers] = useState(initialUsers);
  const [classList, setClassList] = useState(["3A", "4A"]);
  const [newClassName, setNewClassName] = useState("");
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("Semua Peran");

  const roleOptions = useMemo(
    () => ["Semua Peran", ...new Set(users.map((u) => u.roleGroup))],
    [users]
  );

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase();
    return users.filter((user) => {
      const matchesSearch =
        query.length === 0 ||
        user.name.toLowerCase().includes(query) ||
        user.nip.toLowerCase().includes(query) ||
        user.roleLabel.toLowerCase().includes(query);
      const matchesRole =
        roleFilter === "Semua Peran" || user.roleGroup === roleFilter;
      return matchesSearch && matchesRole;
    });
  }, [users, search, roleFilter]);

  const assignableTeachers = useMemo(
    () =>
      users.filter(
        (u) => u.roleGroup === "Guru Wali Kelas" || u.roleGroup === "PJ Mapel"
      ),
    [users]
  );

  const addClass = () => {
    if (!isAcademic) return;
    const normalized = newClassName.trim().toUpperCase().replace(/\s+/g, "");
    if (!normalized) return;

    if (classList.includes(normalized)) {
      alert(`Kelas ${normalized} sudah ada.`);
      return;
    }

    setClassList((prev) => [...prev, normalized]);
    setNewClassName("");
  };

  const toggleClassAccess = (userId, className) => {
    if (!isAcademic) return;

    setUsers((prev) =>
      prev.map((user) => {
        if (user.id !== userId) return user;
        const hasAccess = user.classAccess.includes(className);
        const nextAccess = hasAccess
          ? user.classAccess.filter((c) => c !== className)
          : [...user.classAccess, className];
        return { ...user, classAccess: nextAccess };
      })
    );
  };

  const saveAccessState = () => {
    alert("Pengaturan kelas dan akses guru berhasil disimpan.");
  };

  const getInitials = (name) =>
    name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();

  return (
    <div className="flex h-screen w-full overflow-hidden">
      <Sidebar active="user" user={currentUser} />

      <main className="relative flex flex-1 flex-col overflow-hidden bg-stone-50">
        <div className="flex-1 overflow-y-auto p-4 lg:p-8">
          <div className="mx-auto flex max-w-6xl flex-col gap-6">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <span className="rounded bg-primary/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-stone-900">
                  Settings / User Management
                </span>
                <h1 className="mt-2 text-2xl font-black text-stone-900 lg:text-3xl">
                  System User Management
                </h1>
                <p className="mt-2 text-sm text-stone-600">
                  Kelola user, role, dan akses kelas agar manajemen ATL tetap terstruktur.
                </p>
              </div>
              <div className="inline-flex items-center gap-2 rounded-2xl border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-semibold text-indigo-700">
                <span className="material-symbols-outlined text-[18px]">verified_user</span>
                Login Sebagai: {currentUser.role}
              </div>
            </div>

            <div className="border-b border-stone-200">
              <nav aria-label="Tabs" className="-mb-px flex gap-8">
                <button
                  type="button"
                  onClick={() => setActiveTab("users")}
                  className={`border-b-2 px-1 py-4 text-sm font-bold transition-all ${
                    activeTab === "users"
                      ? "border-primary text-primary"
                      : "border-transparent text-stone-500 hover:text-stone-700"
                  }`}
                >
                  Manajemen Pengguna
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("access")}
                  className={`border-b-2 px-1 py-4 text-sm font-bold transition-all ${
                    activeTab === "access"
                      ? "border-primary text-primary"
                      : "border-transparent text-stone-500 hover:text-stone-700"
                  }`}
                >
                  Peran & Akses
                </button>
              </nav>
            </div>

            {activeTab === "users" && (
              <>
                <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-[0_10px_28px_rgba(15,23,42,0.05)]">
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="md:col-span-2">
                      <label className="mb-2 block text-[11px] font-bold uppercase tracking-wider text-stone-500">
                        Cari User
                      </label>
                      <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Cari nama, NIP, atau role..."
                        className="w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-900 outline-none focus:border-primary focus:ring-4 focus:ring-primary/10"
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-[11px] font-bold uppercase tracking-wider text-stone-500">
                        Filter Peran
                      </label>
                      <select
                        value={roleFilter}
                        onChange={(e) => setRoleFilter(e.target.value)}
                        className="w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm font-semibold text-stone-900 outline-none focus:border-primary focus:ring-4 focus:ring-primary/10"
                      >
                        {roleOptions.map((role) => (
                          <option key={role} value={role}>
                            {role}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                <section className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-[0_10px_28px_rgba(15,23,42,0.05)]">
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-stone-200">
                      <thead className="bg-stone-50">
                        <tr>
                          <th className="px-5 py-4 text-left text-xs font-bold uppercase tracking-widest text-stone-500">
                            User
                          </th>
                          <th className="px-5 py-4 text-left text-xs font-bold uppercase tracking-widest text-stone-500">
                            Role
                          </th>
                          <th className="px-5 py-4 text-left text-xs font-bold uppercase tracking-widest text-stone-500">
                            Status
                          </th>
                          <th className="px-5 py-4 text-left text-xs font-bold uppercase tracking-widest text-stone-500">
                            Login Terakhir
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-100">
                        {filteredUsers.map((user) => (
                          <tr key={user.id} className="hover:bg-stone-50">
                            <td className="px-5 py-4">
                              <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-amber-100 to-orange-200 text-xs font-black text-stone-900">
                                  {getInitials(user.name)}
                                </div>
                                <div>
                                  <p className="text-sm font-bold text-stone-900">{user.name}</p>
                                  <p className="text-xs text-stone-500">{user.nip}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-5 py-4">
                              <span
                                className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold ${
                                  roleColors[user.roleGroup] || "bg-stone-100 text-stone-700 border-stone-200"
                                }`}
                              >
                                {user.roleLabel}
                              </span>
                            </td>
                            <td className="px-5 py-4">
                              <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-2.5 py-1 text-[11px] font-black uppercase tracking-tight text-emerald-600 border border-emerald-100">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                {user.status}
                              </span>
                            </td>
                            <td className="px-5 py-4 text-sm text-stone-600">{user.lastLogin}</td>
                          </tr>
                        ))}
                        {filteredUsers.length === 0 && (
                          <tr>
                            <td colSpan={4} className="px-5 py-10 text-center text-sm font-medium text-stone-500">
                              Tidak ada user yang cocok dengan filter saat ini.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </section>
              </>
            )}

            {activeTab === "access" && (
              <div className="space-y-5">
                <section className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4">
                  <div className="flex items-start gap-3">
                    <span className="material-symbols-outlined text-indigo-600">school</span>
                    <div>
                      <p className="text-sm font-bold text-indigo-900">Panel ini khusus Akademik</p>
                      <p className="text-xs text-indigo-700">
                        Tambah daftar kelas dan assign akses kelas untuk Guru Wali Kelas serta PJ Mapel.
                      </p>
                    </div>
                  </div>
                </section>

                <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-[0_10px_28px_rgba(15,23,42,0.05)]">
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="md:col-span-2">
                      <label className="mb-2 block text-[11px] font-bold uppercase tracking-wider text-stone-500">
                        Tambah Kelas Baru
                      </label>
                      <input
                        value={newClassName}
                        onChange={(e) => setNewClassName(e.target.value)}
                        placeholder="Contoh: 5A"
                        className="w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-900 outline-none focus:border-primary focus:ring-4 focus:ring-primary/10"
                      />
                    </div>
                    <div className="flex items-end">
                      <button
                        type="button"
                        onClick={addClass}
                        disabled={!isAcademic}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-stone-900 shadow-lg shadow-primary/20 transition-all hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <span className="material-symbols-outlined text-[18px]">add</span>
                        Tambah Kelas
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {classList.map((cls, idx) => {
                      const color = classColorVariants[idx % classColorVariants.length];
                      return (
                        <span
                          key={cls}
                          className={`rounded-full border px-3 py-1 text-xs font-black uppercase tracking-tight ${color.bg} ${color.text} ${color.border}`}
                        >
                          {cls}
                        </span>
                      );
                    })}
                  </div>
                </section>

                <section className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-[0_10px_28px_rgba(15,23,42,0.05)]">
                  <div className="border-b border-stone-200 bg-stone-50 px-6 py-4 flex items-center justify-between">
                    <h3 className="text-sm font-black uppercase tracking-[0.05em] text-stone-700">
                      Assign Akses Kelas Guru
                    </h3>
                    <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">
                      Total Guru: {assignableTeachers.length}
                    </span>
                  </div>
                  <div className="divide-y divide-stone-100">
                    {assignableTeachers.map((teacher) => (
                      <div key={teacher.id} className="p-6 transition-all hover:bg-stone-50/50">
                        <div className="grid gap-6 lg:grid-cols-12 items-start">
                          <div className="lg:col-span-4 flex items-center gap-4">
                            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-50 to-indigo-100 text-sm font-black text-indigo-700 shadow-sm border border-indigo-200/50">
                              {getInitials(teacher.name)}
                            </div>
                            <div>
                              <p className="text-sm font-black text-stone-900">{teacher.name}</p>
                              <p className="text-[11px] font-bold text-stone-400 uppercase tracking-tight mt-0.5">{teacher.roleLabel}</p>
                            </div>
                          </div>
                          <div className="lg:col-span-8">
                            <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest mb-3 ml-1">Pilih Kelas yang Dapat Diakses</p>
                            <div className="flex flex-wrap gap-2">
                              {classList.map((cls, idx) => {
                                const isAssigned = teacher.classAccess.includes(cls);
                                const color = classColorVariants[idx % classColorVariants.length];
                                return (
                                  <button
                                    key={cls}
                                    type="button"
                                    onClick={() => toggleClassAccess(teacher.id, cls)}
                                    disabled={!isAcademic}
                                    className={`group flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-[11px] font-black uppercase tracking-tight transition-all duration-200 border-2 ${
                                      isAssigned
                                        ? `${color.active}`
                                        : `bg-white ${color.text} ${color.border} opacity-50 hover:opacity-100`
                                    }`}
                                  >
                                    {isAssigned && <span className="material-symbols-outlined text-[16px]">check_circle</span>}
                                    {cls}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="border-t border-stone-200 bg-stone-50/50 px-6 py-5">
                    <button
                      type="button"
                      onClick={saveAccessState}
                      className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-6 py-3.5 text-sm font-black text-white shadow-lg shadow-emerald-500/20 transition-all hover:bg-emerald-600 hover:-translate-y-0.5 active:scale-95"
                    >
                      <span className="material-symbols-outlined">save</span>
                      Simpan Pengaturan Akses
                    </button>
                  </div>
                </section>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

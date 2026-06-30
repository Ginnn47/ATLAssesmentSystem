import React, { useEffect, useMemo, useState } from "react";
import Sidebar from "./sidebar";
import { createStudent, deleteClass, deleteStudent, getClasses, getCurrentUser, getStudents, getTopics, getUsers, importClassStudents, updateStudent, updateUser } from "../../services/atlApi";
import { ROLE_CODES, getGrantedFeatures, getUserRoleCodes, isAdminUser } from "../../services/accessControl";

const roleColors = {
  Admin: "bg-slate-100 text-slate-700 border-slate-200",
  Akademik: "bg-indigo-100 text-indigo-700 border-indigo-200",
  "Guru Wali Kelas": "bg-emerald-100 text-emerald-700 border-emerald-200",
  "PJ Mapel": "bg-amber-100 text-amber-700 border-amber-200",
  "ATL Expert": "bg-violet-100 text-violet-700 border-violet-200",
  "Guru / Evaluator": "bg-stone-100 text-stone-700 border-stone-200",
  "Multi Role": "bg-primary/10 text-primary-hover border-primary/20",
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

const normalizeAccessList = (items) => (Array.isArray(items) ? items : []);

const evaluatorRoleOptions = [
  {
    key: ROLE_CODES.EVALUATOR,
    label: "Evaluator",
    group: "Guru / Evaluator",
    icon: "edit_note",
    desc: "Role dasar guru untuk input penilaian ATL.",
    active: "border-stone-500 bg-stone-700 text-white shadow-stone-500/20",
    idle: "border-stone-200 bg-white text-stone-700 hover:bg-stone-50",
    chip: "border-stone-200 bg-stone-50 text-stone-700",
  },
  {
    key: ROLE_CODES.HOMEROOM,
    label: "Wali Kelas",
    group: "Guru Wali Kelas",
    icon: "home_work",
    desc: "Stud Manage, data siswa, dan rekap kelas yang diampu.",
    active: "border-emerald-500 bg-emerald-500 text-white shadow-emerald-500/20",
    idle: "border-emerald-200 bg-white text-emerald-700 hover:bg-emerald-50",
    chip: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
  {
    key: ROLE_CODES.SUBJECT_COORDINATOR,
    label: "Penanggung Jawab Mapel",
    group: "PJ Mapel",
    icon: "menu_book",
    desc: "Input nilai dan laporan sesuai mapel yang diampu.",
    active: "border-amber-500 bg-amber-500 text-white shadow-amber-500/20",
    idle: "border-amber-200 bg-white text-amber-700 hover:bg-amber-50",
    chip: "border-amber-200 bg-amber-50 text-amber-700",
  },
  {
    key: ROLE_CODES.ATL_EXPERT,
    label: "ATL Expert",
    group: "ATL Expert",
    icon: "hub",
    desc: "Mengatur bobot Fuzzy-AHP sesuai mapel yang diampu.",
    active: "border-violet-500 bg-violet-500 text-white shadow-violet-500/20",
    idle: "border-violet-200 bg-white text-violet-700 hover:bg-violet-50",
    chip: "border-violet-200 bg-violet-50 text-violet-700",
  },
];

const roleOptionByKey = Object.fromEntries(evaluatorRoleOptions.map((role) => [role.key, role]));

const deriveEvaluatorRoles = (user) => {
  const roles = getUserRoleCodes(user).filter((role) => role !== ROLE_CODES.ADMIN);
  return roles.includes(ROLE_CODES.EVALUATOR) ? roles : [ROLE_CODES.EVALUATOR, ...roles];
};

const composeEvaluatorRoleFields = (roleKeys) => {
  const keys = evaluatorRoleOptions.map((role) => role.key).filter((key) => roleKeys.includes(key));
  const normalizedKeys = keys.includes(ROLE_CODES.EVALUATOR) ? keys : [ROLE_CODES.EVALUATOR, ...keys];
  const extensionKeys = normalizedKeys.filter((key) => key !== ROLE_CODES.EVALUATOR);
  const roleLabel = normalizedKeys.map((key) => roleOptionByKey[key].label).join(" + ");
  const roleGroup = extensionKeys.length > 1
    ? "Multi Role"
    : extensionKeys[0]
      ? roleOptionByKey[extensionKeys[0]].group
      : "Guru / Evaluator";
  return { roleLabel, roleGroup, role: roleLabel, roles: normalizedKeys, roleCodes: normalizedKeys };
};

export default function ManageUser() {
  const [currentUser, setCurrentUser] = useState({ name: "Belum Login", role: "Guest" });
  const canManageAccess = isAdminUser(currentUser);

  const [users, setUsers] = useState([]);
  const [classList, setClassList] = useState([]);
  const [subjectList, setSubjectList] = useState([]);
  const [backendError, setBackendError] = useState("");
  const [newClassName, setNewClassName] = useState("");
  const [classImportFile, setClassImportFile] = useState(null);
  const [classImportStatus, setClassImportStatus] = useState("");
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("Semua Peran");
  const [studentReviewOpen, setStudentReviewOpen] = useState(false);
  const [reviewClass, setReviewClass] = useState("");
  const [reviewStudents, setReviewStudents] = useState([]);
  const [reviewStatus, setReviewStatus] = useState("");
  const [reviewLoading, setReviewLoading] = useState(false);
  const [deletingStudentId, setDeletingStudentId] = useState(null);
  const [studentForm, setStudentForm] = useState({ id: null, nis: "", name: "" });
  const [studentFormSaving, setStudentFormSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const syncCurrentUser = async () => {
      const user = await getCurrentUser();
      if (!cancelled && user) {
        setCurrentUser({
          ...user,
          name: user.name || user.username || "Belum Login",
          role: user.roleLabel || user.roleGroup || "Guest",
        });
      }
    };
    syncCurrentUser();
    window.addEventListener("focus", syncCurrentUser);
    window.addEventListener("atl-auth-updated", syncCurrentUser);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", syncCurrentUser);
      window.removeEventListener("atl-auth-updated", syncCurrentUser);
    };
  }, []);

  useEffect(() => {
    Promise.all([getUsers(), getClasses(), getTopics()])
      .then(([userItems, classItems, subjectItems]) => {
        setUsers(Array.isArray(userItems) ? userItems : []);
        setClassList((classItems || []).map((item) => item.code).filter(Boolean));
        setSubjectList(
          (subjectItems || [])
            .map((item) => ({
              code: item.id || item.code,
              label: item.batchLabel || item.label || item.name || item.id || item.code,
            }))
            .filter((item) => item.code)
        );
        setBackendError("");
      })
      .catch((error) => {
        setUsers([]);
        setClassList([]);
        setSubjectList([]);
        setBackendError(error.message || "Gagal mengambil user/kelas/mapel dari backend.");
      });
  }, []);

  const subjectLabelByCode = useMemo(
    () => Object.fromEntries(subjectList.map((subject) => [subject.code, subject.label])),
    [subjectList]
  );

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
        String(user.nip || "").toLowerCase().includes(query) ||
        String(user.roleLabel || "").toLowerCase().includes(query) ||
        normalizeAccessList(user.classAccess).join(" ").toLowerCase().includes(query) ||
        normalizeAccessList(user.subjectAccess).map((code) => subjectLabelByCode[code] || code).join(" ").toLowerCase().includes(query);
      const matchesRole =
        roleFilter === "Semua Peran" || user.roleGroup === roleFilter;
      return matchesSearch && matchesRole;
    });
  }, [users, search, roleFilter, subjectLabelByCode]);

  const assignableTeachers = useMemo(
    () =>
      users.filter(
        (u) => {
          const roleText = `${u.roleGroup || ""} ${u.roleLabel || ""}`.toLowerCase();
          return !u.isSuperuser && !roleText.includes("admin") && !roleText.includes("akademik");
        }
      ),
    [users]
  );

  const accessSummary = useMemo(() => {
    const activeUsers = users.filter((user) => String(user.status || "").toLowerCase() === "aktif");
    const atlExperts = assignableTeachers.filter((user) => deriveEvaluatorRoles(user).includes(ROLE_CODES.ATL_EXPERT));
    const subjectLeads = assignableTeachers.filter((user) => deriveEvaluatorRoles(user).includes(ROLE_CODES.SUBJECT_COORDINATOR));
    return [
      { label: "Total Pengguna", value: users.length, note: "Semua akun", icon: "groups", tone: "bg-blue-50 text-blue-700 border-blue-100" },
      { label: "Guru Aktif", value: activeUsers.filter((user) => !user.isSuperuser).length, note: "Akun aktif", icon: "group", tone: "bg-emerald-50 text-emerald-700 border-emerald-100" },
      { label: "PJ Mapel", value: subjectLeads.length, note: "Akses mapel", icon: "menu_book", tone: "bg-amber-50 text-amber-700 border-amber-100" },
      { label: "ATL Expert", value: atlExperts.length, note: "Tim pembobotan", icon: "hub", tone: "bg-violet-50 text-violet-700 border-violet-100" },
    ];
  }, [assignableTeachers, users]);

  const importStudentsFromExcel = async () => {
    if (!canManageAccess) return;
    const normalized = newClassName.trim().toUpperCase().replace(/\s+/g, "");
    if (!classImportFile) {
      alert("Pilih file Excel data siswa terlebih dahulu.");
      return;
    }

    try {
      setClassImportStatus("Mengupload dan membaca Excel...");
      const result = await importClassStudents({
        file: classImportFile,
        classCode: normalized,
        displayName: normalized ? `${normalized} - Primary` : "",
        level: "Primary",
      });
      const importedClasses = (result.classes || []).map((item) => item.code).filter(Boolean);
      setClassList((prev) => Array.from(new Set([...prev, ...importedClasses])));
      setNewClassName("");
      setClassImportFile(null);
      setClassImportStatus(`${result.imported || 0} siswa berhasil diimport${result.skippedRows?.length ? `, ${result.skippedRows.length} baris dilewati` : ""}.`);
    } catch (error) {
      setClassImportStatus("");
      alert(error.response?.data?.error || "Gagal import Excel. Pastikan file memiliki kolom NIS, Nama, dan Kelas.");
    }
  };

  const refreshClassStudents = async (classCode = reviewClass) => {
    if (!classCode) return [];
    setReviewLoading(true);
    setReviewStatus("Mengambil daftar siswa saat ini...");
    try {
      const students = await getStudents(classCode);
      setReviewStudents(Array.isArray(students) ? students : []);
      setReviewStatus("");
      return Array.isArray(students) ? students : [];
    } catch (error) {
      setReviewStatus(error.message || "Daftar siswa belum bisa ditampilkan saat ini.");
      return [];
    } finally {
      setReviewLoading(false);
    }
  };

  const openStudentReview = async (classCode) => {
    setReviewClass(classCode);
    setStudentReviewOpen(true);
    setReviewStudents([]);
    setStudentForm({ id: null, nis: "", name: "" });
    await refreshClassStudents(classCode);
  };

  const resetStudentForm = () => {
    setStudentForm({ id: null, nis: "", name: "" });
  };

  const handleEditStudent = (student) => {
    setStudentForm({
      id: student.id,
      nis: student.nis || "",
      name: student.name || student.fullName || "",
    });
  };

  const handleSaveStudent = async () => {
    if (!canManageAccess || !reviewClass) return;
    const payload = {
      nis: studentForm.nis.trim(),
      name: studentForm.name.trim(),
      classCode: reviewClass,
    };
    if (!payload.nis || !payload.name) {
      setReviewStatus("Lengkapi NIS dan nama siswa terlebih dahulu.");
      return;
    }

    setStudentFormSaving(true);
    setReviewStatus(studentForm.id ? "Menyimpan perubahan siswa..." : "Menambahkan siswa baru...");
    try {
      const savedStudent = studentForm.id
        ? await updateStudent(studentForm.id, payload)
        : await createStudent(payload);
      if (savedStudent) {
        setReviewStudents((prev) => {
          if (studentForm.id) {
            return prev.map((item) => (item.id === savedStudent.id ? savedStudent : item));
          }
          const exists = prev.some((item) => item.id === savedStudent.id);
          return exists ? prev.map((item) => (item.id === savedStudent.id ? savedStudent : item)) : [...prev, savedStudent];
        });
      } else {
        await refreshClassStudents(reviewClass);
      }
      resetStudentForm();
      setReviewStatus(studentForm.id ? "Data siswa diperbarui." : "Siswa baru ditambahkan.");
    } catch (error) {
      setReviewStatus(error.response?.data?.error || error.message || "Data siswa belum bisa disimpan saat ini.");
    } finally {
      setStudentFormSaving(false);
    }
  };

  const handleDeleteStudent = async (student) => {
    if (!canManageAccess || !student?.id) return;
    const confirmed = confirm(`Hapus ${student.name || student.fullName || "siswa ini"} dari daftar kelas ${reviewClass}?`);
    if (!confirmed) return;
    setDeletingStudentId(student.id);
    try {
      await deleteStudent(student.id);
      setReviewStudents((prev) => prev.filter((item) => item.id !== student.id));
      if (studentForm.id === student.id) resetStudentForm();
      setReviewStatus("Daftar siswa diperbarui.");
    } catch (error) {
      setReviewStatus(error.message || "Siswa belum bisa dihapus saat ini.");
    } finally {
      setDeletingStudentId(null);
    }
  };

  const handleDeleteReviewClass = async () => {
    if (!canManageAccess || !reviewClass) return;
    const confirmed = confirm(`Hapus data kelas ${reviewClass}? Kelas ini akan hilang dari Academic Management dan semua siswa aktif di kelas ini dinonaktifkan.`);
    if (!confirmed) return;
    setDeletingStudentId("__all__");
    setReviewStatus("Menghapus data kelas...");
    try {
      await deleteClass(reviewClass);
      setClassList((prev) => prev.filter((item) => item !== reviewClass));
      setUsers((prev) => prev.map((user) => ({
        ...user,
        classAccess: normalizeAccessList(user.classAccess).filter((item) => item !== reviewClass),
      })));
      setReviewStudents([]);
      resetStudentForm();
      setReviewStatus("Data kelas sudah dihapus.");
      setStudentReviewOpen(false);
    } catch (error) {
      setReviewStatus(error.response?.data?.error || error.message || "Data kelas belum bisa dihapus saat ini.");
      await refreshClassStudents(reviewClass);
    } finally {
      setDeletingStudentId(null);
    }
  };

  const toggleClassAccess = (userId, className) => {
    if (!canManageAccess) return;

    setUsers((prev) =>
      prev.map((user) => {
        if (user.id !== userId) return user;
        const currentAccess = normalizeAccessList(user.classAccess);
        const hasAccess = currentAccess.includes(className);
        const nextAccess = hasAccess
          ? currentAccess.filter((c) => c !== className)
          : [...currentAccess, className];
        return { ...user, classAccess: nextAccess };
      })
    );
  };

  const toggleSubjectAccess = (userId, subjectCode) => {
    if (!canManageAccess) return;

    setUsers((prev) =>
      prev.map((user) => {
        if (user.id !== userId) return user;
        const currentAccess = normalizeAccessList(user.subjectAccess);
        const hasAccess = currentAccess.includes(subjectCode);
        const nextAccess = hasAccess
          ? currentAccess.filter((item) => item !== subjectCode)
          : [...currentAccess, subjectCode];
        return { ...user, subjectAccess: nextAccess };
      })
    );
  };

  const toggleEvaluatorRole = (userId, roleKey) => {
    if (!canManageAccess) return;

    setUsers((prev) =>
      prev.map((user) => {
        if (user.id !== userId) return user;
        if (roleKey === ROLE_CODES.EVALUATOR) return user;
        const currentRoles = deriveEvaluatorRoles(user);
        const nextRoles = currentRoles.includes(roleKey)
          ? currentRoles.filter((item) => item !== roleKey)
          : [...currentRoles, roleKey];
        return { ...user, ...composeEvaluatorRoleFields(nextRoles) };
      })
    );
  };

  const saveAccessState = async () => {
    try {
      await Promise.all(assignableTeachers.map((teacher) => {
        const roleFields = composeEvaluatorRoleFields(deriveEvaluatorRoles(teacher));
        return updateUser(teacher.id, { ...teacher, ...roleFields });
      }));
      alert("Pengaturan peran, kelas, dan mapel evaluator berhasil disimpan.");
    } catch (error) {
      alert("Gagal menyimpan akses guru ke backend. Pastikan sudah login.");
    }
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
      <Sidebar active="user" />

      <main className="relative flex flex-1 flex-col overflow-hidden bg-stone-50">
        <div className="flex-1 overflow-y-auto p-4 lg:p-8">
          <div className="mx-auto flex max-w-6xl flex-col gap-6">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <span className="rounded bg-primary/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-stone-900">
                  Settings / Academic Management
                </span>
                <h1 className="mt-2 text-2xl font-black text-stone-900 lg:text-3xl">
                  Academic Management
                </h1>
                <p className="mt-2 text-sm text-stone-600">
                  Kelola pengguna akademik, role, akses kelas, dan akses mapel agar manajemen ATL tetap terstruktur.
                </p>
              </div>
              <div className="inline-flex items-center gap-2 rounded-2xl border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-semibold text-indigo-700">
                <span className="material-symbols-outlined text-[18px]">verified_user</span>
                Login Sebagai: {currentUser.role}
              </div>
            </div>

            {backendError && (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-bold text-red-700">
                <span className="material-symbols-outlined mr-2 align-middle text-[18px]">error</span>
                {backendError} Academic Management tidak memakai dummy/localStorage sebagai pengganti data.
              </div>
            )}

            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {accessSummary.map((item) => (
                <div key={item.label} className="rounded-2xl border border-stone-200 bg-white p-5 shadow-[0_10px_28px_rgba(15,23,42,0.05)]">
                  <div className="flex items-center justify-between gap-4">
                    <span className={`flex h-12 w-12 items-center justify-center rounded-2xl border ${item.tone}`}>
                      <span className="material-symbols-outlined text-[24px]">{item.icon}</span>
                    </span>
                    <span className="material-symbols-outlined text-stone-300">chevron_right</span>
                  </div>
                  <p className="mt-4 text-[11px] font-black uppercase tracking-[0.18em] text-stone-500">{item.label}</p>
                  <p className="mt-1 text-3xl font-black text-stone-950">{item.value}</p>
                  <p className="mt-1 text-xs font-semibold text-stone-500">{item.note}</p>
                </div>
              ))}
            </section>

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
                        placeholder="Cari nama, NIP, role, kelas, atau mapel..."
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
                            Akses
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
                              {user.roleLabel || deriveEvaluatorRoles(user).map((role) => roleOptionByKey[role]?.label).join(" + ")}
                              </span>
                            </td>
                            <td className="px-5 py-4">
                              <div className="flex max-w-xs flex-wrap gap-1.5">
                                {normalizeAccessList(user.classAccess).slice(0, 3).map((className) => (
                                  <span key={className} className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-black uppercase text-blue-700">
                                    {className}
                                  </span>
                                ))}
                                {normalizeAccessList(user.subjectAccess).slice(0, 3).map((subjectCode) => (
                                  <span key={subjectCode} className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-black uppercase text-amber-700">
                                    {subjectLabelByCode[subjectCode] || subjectCode}
                                  </span>
                                ))}
                                {normalizeAccessList(user.classAccess).length === 0 && normalizeAccessList(user.subjectAccess).length === 0 && (
                                  <span className="text-xs font-semibold text-stone-400">-</span>
                                )}
                              </div>
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
                            <td colSpan={5} className="px-5 py-10 text-center text-sm font-medium text-stone-500">
                              Tidak ada user yang cocok dengan filter saat ini.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </section>
              <div className="space-y-5">
                <section className="rounded-2xl border border-primary/25 bg-primary/10 p-4">
                  <div className="flex items-start gap-3">
                    <span className="material-symbols-outlined text-primary">info</span>
                    <div>
                      <p className="text-sm font-bold text-stone-900">Catatan Hak Akses</p>
                      <p className="text-xs font-semibold text-stone-600">
                        Wali Kelas dapat mengakses halaman Stud Manage untuk kelas yang diampu. PJ Mapel dan ATL Expert dapat mengakses data penilaian sesuai mapel yang diampu.
                      </p>
                    </div>
                  </div>
                </section>

                <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_280px]">
                  <section className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-[0_10px_28px_rgba(15,23,42,0.05)]">
                    <div className="border-b border-stone-200 bg-stone-50 px-6 py-4">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                          <h3 className="text-sm font-black uppercase tracking-[0.05em] text-stone-700">
                            Kelola Role & Akses Evaluator
                          </h3>
                          <p className="mt-1 text-xs font-semibold text-stone-500">
                            Role dapat dipilih lebih dari satu untuk setiap evaluator.
                          </p>
                        </div>
                        <span className="inline-flex w-fit rounded-full bg-primary/15 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-primary">
                          {assignableTeachers.length} Evaluator
                        </span>
                      </div>
                    </div>
                    <div className="divide-y divide-stone-100">
                      {assignableTeachers.map((teacher) => {
                        const selectedRoles = deriveEvaluatorRoles(teacher);
                        return (
                          <div key={teacher.id} className="p-6 transition-all hover:bg-stone-50/50">
                            <div className="grid gap-6 lg:grid-cols-12 lg:items-start">
                              <div className="lg:col-span-4">
                                <div className="flex items-center gap-4">
                                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-sm font-black text-primary shadow-sm">
                                    {getInitials(teacher.name)}
                                  </div>
                                  <div className="min-w-0">
                                    <p className="truncate text-sm font-black text-stone-900">{teacher.name}</p>
                                    <p className="mt-0.5 text-[11px] font-bold uppercase tracking-tight text-stone-400">{teacher.nip || teacher.username}</p>
                                  </div>
                                </div>
                                <div className="mt-4 flex flex-wrap gap-2">
                                  {selectedRoles.length > 0 ? selectedRoles.map((roleKey) => (
                                    <span key={roleKey} className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-black ${roleOptionByKey[roleKey].chip}`}>
                                      <span className="material-symbols-outlined text-[14px]">{roleOptionByKey[roleKey].icon}</span>
                                      {roleOptionByKey[roleKey].label}
                                    </span>
                                  )) : (
                                    <span className="rounded-full border border-stone-200 bg-stone-50 px-2.5 py-1 text-[10px] font-black text-stone-500">Belum ada role evaluator</span>
                                  )}
                                </div>
                              </div>

                              <div className="grid gap-5 lg:col-span-8">
                                <div>
                                  <p className="mb-3 ml-1 text-[10px] font-black uppercase tracking-widest text-stone-400">Predikat / Role Evaluator</p>
                                  <div className="flex flex-wrap gap-2">
                                    {evaluatorRoleOptions.map((role) => {
                                      const isAssigned = selectedRoles.includes(role.key);
                                      return (
                                        <button
                                          key={role.key}
                                          type="button"
                                          onClick={() => toggleEvaluatorRole(teacher.id, role.key)}
                                          disabled={!canManageAccess || role.key === ROLE_CODES.EVALUATOR}
                                          className={`group inline-flex rounded-xl border-2 text-[11px] font-black uppercase tracking-tight shadow-lg transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50 ${
                                            isAssigned
                                              ? `${role.active} min-w-[220px] flex-col items-start gap-1 px-5 py-3 text-left`
                                              : `${role.idle} items-center gap-1.5 px-4 py-2.5`
                                          }`}
                                        >
                                          <span className="inline-flex items-center gap-1.5">
                                            <span className="material-symbols-outlined text-[16px]">{isAssigned ? "check_circle" : role.icon}</span>
                                            {role.label}
                                          </span>
                                          {isAssigned && (
                                            <span className="text-[10px] font-semibold normal-case leading-4 tracking-normal text-white/90">
                                              {role.desc}
                                            </span>
                                          )}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>

                                <div className="grid gap-4 xl:grid-cols-2">
                                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4">
                                    <div className="flex items-center gap-2">
                                      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                                        <span className="material-symbols-outlined text-[20px]">home_work</span>
                                      </span>
                                      <div>
                                        <p className="text-sm font-black text-emerald-900">Akses Wali Kelas</p>
                                        <p className="text-[11px] font-semibold text-emerald-700">Kelas yang dapat dikelola di Stud Manage.</p>
                                      </div>
                                    </div>
                                    <div className="mt-4 flex flex-wrap gap-2">
                                      {classList.map((cls, idx) => {
                                        const isAssigned = normalizeAccessList(teacher.classAccess).includes(cls);
                                        const color = classColorVariants[idx % classColorVariants.length];
                                        return (
                                          <button
                                            key={cls}
                                            type="button"
                                            onClick={() => toggleClassAccess(teacher.id, cls)}
                                            disabled={!canManageAccess}
                                            className={`group flex items-center gap-1.5 rounded-xl border-2 px-4 py-2.5 text-[11px] font-black uppercase tracking-tight transition-all duration-200 ${
                                              isAssigned
                                                ? `${color.active}`
                                                : `bg-white ${color.text} ${color.border} opacity-60 hover:opacity-100`
                                            }`}
                                          >
                                            {isAssigned && <span className="material-symbols-outlined text-[16px]">check_circle</span>}
                                            {cls}
                                          </button>
                                        );
                                      })}
                                    </div>
                                  </div>

                                  <div className="rounded-2xl border border-amber-200 bg-amber-50/40 p-4">
                                    <div className="flex items-center gap-2">
                                      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                                        <span className="material-symbols-outlined text-[20px]">menu_book</span>
                                      </span>
                                      <div>
                                        <p className="text-sm font-black text-amber-900">Akses Mapel & Fuzzy</p>
                                        <p className="text-[11px] font-semibold text-amber-700">Mapel untuk input nilai, report, dan weighting.</p>
                                      </div>
                                    </div>
                                    <div className="mt-4 flex flex-wrap gap-2">
                                      {subjectList.map((subject, idx) => {
                                        const isAssigned = normalizeAccessList(teacher.subjectAccess).includes(subject.code);
                                        const color = classColorVariants[(idx + 3) % classColorVariants.length];
                                        return (
                                          <button
                                            key={subject.code}
                                            type="button"
                                            onClick={() => toggleSubjectAccess(teacher.id, subject.code)}
                                            disabled={!canManageAccess}
                                            className={`group flex items-center gap-1.5 rounded-xl border-2 px-4 py-2.5 text-[11px] font-black uppercase tracking-tight transition-all duration-200 ${
                                              isAssigned
                                                ? `${color.active}`
                                                : `bg-white ${color.text} ${color.border} opacity-60 hover:opacity-100`
                                            }`}
                                          >
                                            {isAssigned && <span className="material-symbols-outlined text-[16px]">check_circle</span>}
                                            {subject.label}
                                          </button>
                                        );
                                      })}
                                      {subjectList.length === 0 && (
                                        <span className="rounded-xl border border-dashed border-stone-300 px-4 py-2.5 text-[11px] font-bold text-stone-400">
                                          Mapel belum tersedia dari backend.
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                                <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
                                  <p className="text-[10px] font-black uppercase tracking-widest text-primary-hover">Access Summary</p>
                                  <div className="mt-3 grid gap-3 text-xs font-semibold leading-5 text-stone-600 md:grid-cols-3">
                                    <p><strong className="text-stone-900">Roles:</strong> {selectedRoles.map((role) => roleOptionByKey[role]?.label).filter(Boolean).join(", ")}</p>
                                    <p><strong className="text-stone-900">Subjects:</strong> {normalizeAccessList(teacher.subjectAccess).map((code) => subjectLabelByCode[code] || code).join(", ") || "-"}</p>
                                    <p><strong className="text-stone-900">Classes:</strong> {normalizeAccessList(teacher.classAccess).join(", ") || "-"}</p>
                                  </div>
                                  <div className="mt-3 flex flex-wrap gap-2">
                                    {getGrantedFeatures({ ...teacher, roles: selectedRoles }).map((feature) => (
                                      <span key={feature} className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-black text-emerald-700">
                                        <span className="material-symbols-outlined text-[13px]">check</span>
                                        {feature}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="border-t border-stone-200 bg-stone-50/50 px-6 py-5">
                      <button
                        type="button"
                        onClick={saveAccessState}
                        disabled={!canManageAccess}
                        className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-6 py-3.5 text-sm font-black text-white shadow-lg shadow-emerald-500/20 transition-all hover:-translate-y-0.5 hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-50 active:scale-95"
                      >
                        <span className="material-symbols-outlined">save</span>
                        Simpan Pengaturan
                      </button>
                    </div>
                  </section>

                  <aside className="space-y-4">
                    <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-[0_10px_28px_rgba(15,23,42,0.05)]">
                      <div className="flex items-center gap-3">
                        <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                          <span className="material-symbols-outlined">shield</span>
                        </span>
                        <div>
                          <p className="text-sm font-black text-stone-900">Aturan Akses</p>
                          <p className="text-xs font-semibold text-stone-500">Hak minimum sesuai tugas.</p>
                        </div>
                      </div>
                      <div className="mt-5 space-y-4">
                        {[
                          ["home_work", "Wali Kelas", "Mengakses Stud Manage untuk kelas yang diampu."],
                          ["menu_book", "PJ Mapel", "Mengakses input nilai dan report sesuai mapel yang diampu."],
                          ["hub", "ATL Expert", "Mengelola pembobotan Fuzzy-AHP untuk mapel yang diampu."],
                          ["lock", "Keamanan Data", "Role ganda tetap mengikuti batas kelas dan mapel."],
                        ].map(([icon, title, desc]) => (
                          <div key={title} className="flex gap-3">
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                              <span className="material-symbols-outlined text-[18px]">{icon}</span>
                            </span>
                            <div>
                              <p className="text-xs font-black text-stone-900">{title}</p>
                              <p className="mt-1 text-xs font-semibold leading-5 text-stone-500">{desc}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>
                    <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-[0_10px_28px_rgba(15,23,42,0.05)]">
                      <div className="flex items-center gap-3">
                        <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                          <span className="material-symbols-outlined">folder_managed</span>
                        </span>
                        <div>
                          <p className="text-sm font-black text-stone-900">Data Siswa & Import Excel</p>
                          <p className="text-xs font-semibold text-stone-500">Upload file kelas dan review daftar siswa sebelum dipakai di Stud Manage.</p>
                        </div>
                      </div>

                      <div className="mt-5 space-y-3">
                        <input
                          value={newClassName}
                          onChange={(e) => setNewClassName(e.target.value)}
                          placeholder="Kode kelas default, contoh: 5A"
                          className="w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-900 outline-none focus:border-primary focus:ring-4 focus:ring-primary/10"
                        />
                        <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-dashed border-primary/40 bg-primary/5 px-4 py-3 text-sm font-bold text-stone-700 transition hover:border-primary hover:bg-primary/10">
                          <span className="truncate">{classImportFile?.name || "Pilih file .xlsx data siswa"}</span>
                          <span className="material-symbols-outlined text-[18px] text-primary">upload_file</span>
                          <input
                            type="file"
                            accept=".xlsx,.xls"
                            className="hidden"
                            onChange={(event) => setClassImportFile(event.target.files?.[0] || null)}
                          />
                        </label>
                        <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-semibold leading-5 text-amber-800">
                          Header minimal: <strong>NIS</strong>, <strong>Nama</strong>, dan <strong>Kelas</strong>. Jika kolom Kelas kosong, isi kode kelas default di atas.
                        </p>
                        <button
                          type="button"
                          onClick={importStudentsFromExcel}
                          disabled={!canManageAccess}
                          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-stone-900 shadow-lg shadow-primary/20 transition-all hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <span className="material-symbols-outlined text-[18px]">upload_file</span>
                          Import Data Siswa
                        </button>
                        {classImportStatus && (
                          <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] font-bold text-emerald-700">
                            {classImportStatus}
                          </p>
                        )}
                      </div>

                      <div className="mt-5 border-t border-stone-100 pt-4">
                        <p className="text-[10px] font-black uppercase tracking-widest text-stone-400">Kelas Tersedia</p>
                        <div className="mt-3 space-y-2">
                          {classList.map((cls, idx) => {
                            const color = classColorVariants[idx % classColorVariants.length];
                            return (
                              <button
                                key={cls}
                                type="button"
                                onClick={() => openStudentReview(cls)}
                                className={`flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-2 text-left text-xs font-black uppercase tracking-tight transition hover:-translate-y-0.5 ${color.bg} ${color.text} ${color.border}`}
                              >
                                <span>{cls}</span>
                                <span className="inline-flex items-center gap-1 text-[10px]">
                                  Review
                                  <span className="material-symbols-outlined text-[14px]">visibility</span>
                                </span>
                              </button>
                            );
                          })}
                          {classList.length === 0 && (
                            <span className="rounded-xl border border-dashed border-stone-300 px-3 py-2 text-xs font-semibold text-stone-400">
                              Belum ada kelas dari backend.
                            </span>
                          )}
                        </div>
                        <p className="mt-2 text-[11px] font-semibold leading-5 text-stone-500">
                          Klik badge kelas untuk membuka preview daftar siswa dan opsi penghapusan.
                        </p>
                      </div>
                    </section>
                  </aside>
                </div>
              </div>
          </div>
        </div>
        {studentReviewOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/40 p-4 backdrop-blur-sm">
            <div className="flex max-h-[88vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-primary/40 bg-white shadow-2xl">
              <div className="border-b border-stone-200 bg-primary/10 px-6 py-5">
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.22em] text-primary-hover">Preview Data Siswa</p>
                    <h3 className="mt-1 text-2xl font-black text-stone-950">Kelas {reviewClass}</h3>
                    <p className="mt-2 text-sm font-semibold leading-6 text-stone-600">
                      Review daftar siswa yang tersimpan di backend untuk kelas ini. Penghapusan di sini akan menonaktifkan siswa dari daftar aktif.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => refreshClassStudents(reviewClass)}
                      disabled={reviewLoading}
                      className="inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm font-bold text-stone-700 transition hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <span className="material-symbols-outlined text-[18px]">{reviewLoading ? "hourglass_top" : "refresh"}</span>
                      Refresh
                    </button>
                    <button
                      type="button"
                      onClick={() => setStudentReviewOpen(false)}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-stone-200 bg-white text-stone-500 transition hover:bg-stone-50"
                      aria-label="Tutup preview siswa"
                    >
                      <span className="material-symbols-outlined">close</span>
                    </button>
                  </div>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  <div className="rounded-2xl border border-primary/20 bg-white px-4 py-3">
                    <p className="text-[10px] font-black uppercase tracking-widest text-stone-400">Kelas</p>
                    <p className="mt-1 text-sm font-black text-stone-900">{reviewClass || "-"}</p>
                  </div>
                  <div className="rounded-2xl border border-primary/20 bg-white px-4 py-3">
                    <p className="text-[10px] font-black uppercase tracking-widest text-stone-400">Total Siswa</p>
                    <p className="mt-1 text-sm font-black text-stone-900">{reviewStudents.length}</p>
                  </div>
                  <div className="rounded-2xl border border-primary/20 bg-white px-4 py-3">
                    <p className="text-[10px] font-black uppercase tracking-widest text-stone-400">Sumber</p>
                    <p className="mt-1 text-sm font-black text-stone-900">Backend aktif</p>
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-auto p-6">
                {reviewStatus && (
                  <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800">
                    <span className="material-symbols-outlined mr-2 align-middle text-[18px]">info</span>
                    {reviewStatus}
                  </div>
                )}
                <div className="mb-4 rounded-2xl border border-stone-200 bg-stone-50 p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
                    <div className="flex-1">
                      <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-stone-500">NIS</label>
                      <input
                        value={studentForm.nis}
                        onChange={(event) => setStudentForm((prev) => ({ ...prev, nis: event.target.value }))}
                        placeholder="Contoh: NIS 202601001"
                        className="w-full rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm font-semibold text-stone-900 outline-none focus:border-primary focus:ring-4 focus:ring-primary/10"
                      />
                    </div>
                    <div className="flex-[1.4]">
                      <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-stone-500">Nama Siswa</label>
                      <input
                        value={studentForm.name}
                        onChange={(event) => setStudentForm((prev) => ({ ...prev, name: event.target.value }))}
                        placeholder="Nama lengkap siswa"
                        className="w-full rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm font-semibold text-stone-900 outline-none focus:border-primary focus:ring-4 focus:ring-primary/10"
                      />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={handleSaveStudent}
                        disabled={!canManageAccess || studentFormSaving}
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-black text-stone-900 shadow-lg shadow-primary/20 transition hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <span className="material-symbols-outlined text-[18px]">{studentFormSaving ? "hourglass_top" : studentForm.id ? "save_as" : "person_add"}</span>
                        {studentForm.id ? "Simpan Edit" : "Tambah Siswa"}
                      </button>
                      {studentForm.id && (
                        <button
                          type="button"
                          onClick={resetStudentForm}
                          className="inline-flex items-center justify-center gap-2 rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm font-bold text-stone-700 transition hover:bg-stone-50"
                        >
                          Batal Edit
                        </button>
                      )}
                    </div>
                  </div>
                  <p className="mt-3 text-[11px] font-semibold leading-5 text-stone-500">
                    Form ini menyimpan satu siswa langsung ke kelas {reviewClass}. Pilih Edit pada tabel untuk mengubah NIS atau nama.
                  </p>
                </div>
                <div className="overflow-hidden rounded-2xl border border-stone-200">
                  <table className="min-w-full divide-y divide-stone-200">
                    <thead className="bg-stone-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-widest text-stone-500">No</th>
                        <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-widest text-stone-500">NIS</th>
                        <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-widest text-stone-500">Nama</th>
                        <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-widest text-stone-500">Kelas</th>
                        <th className="px-4 py-3 text-right text-xs font-black uppercase tracking-widest text-stone-500">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100 bg-white">
                      {reviewStudents.map((student, index) => (
                        <tr key={student.id || student.nis} className="hover:bg-stone-50">
                          <td className="px-4 py-3 text-sm font-bold text-stone-600">{index + 1}</td>
                          <td className="px-4 py-3 text-sm font-bold text-stone-700">{student.nis || student.id || "-"}</td>
                          <td className="px-4 py-3 text-sm font-black text-stone-900">{student.name || student.fullName || "-"}</td>
                          <td className="px-4 py-3 text-sm font-semibold text-stone-600">{reviewClass}</td>
                          <td className="px-4 py-3 text-right">
                            <button
                              type="button"
                              onClick={() => handleEditStudent(student)}
                              disabled={!canManageAccess || deletingStudentId === "__all__"}
                              className="mr-2 inline-flex items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-black text-blue-700 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              <span className="material-symbols-outlined text-[16px]">edit</span>
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteStudent(student)}
                              disabled={!canManageAccess || deletingStudentId === student.id || deletingStudentId === "__all__"}
                              className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-black text-red-600 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              <span className="material-symbols-outlined text-[16px]">
                                {deletingStudentId === student.id ? "hourglass_top" : "delete"}
                              </span>
                              Hapus
                            </button>
                          </td>
                        </tr>
                      ))}
                      {!reviewLoading && reviewStudents.length === 0 && (
                        <tr>
                          <td colSpan={5} className="px-4 py-12 text-center text-sm font-semibold text-stone-500">
                            Belum ada siswa aktif pada kelas ini.
                          </td>
                        </tr>
                      )}
                      {reviewLoading && (
                        <tr>
                          <td colSpan={5} className="px-4 py-12 text-center text-sm font-semibold text-stone-500">
                            Mengambil daftar siswa...
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex flex-col gap-3 border-t border-stone-200 bg-stone-50 px-6 py-4 md:flex-row md:items-center md:justify-between">
                <p className="text-xs font-semibold leading-5 text-stone-500">
                  Hapus data kelas akan menghilangkan kelas ini dari Academic Management dan menonaktifkan siswa aktif di dalamnya.
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleDeleteReviewClass}
                    disabled={!canManageAccess || !reviewClass || deletingStudentId === "__all__"}
                    className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-white px-4 py-2.5 text-sm font-black text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined text-[18px]">{deletingStudentId === "__all__" ? "hourglass_top" : "delete_forever"}</span>
                    Hapus Data Kelas
                  </button>
                  <button
                    type="button"
                    onClick={() => setStudentReviewOpen(false)}
                    className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-black text-stone-900 shadow-lg shadow-primary/20 transition hover:bg-secondary"
                  >
                    Selesai
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

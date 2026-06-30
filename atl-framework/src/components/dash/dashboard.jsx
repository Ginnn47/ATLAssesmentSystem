import React, { useEffect, useMemo, useState } from "react";
import Sidebar from "./sidebar";
import { getCurrentUser, getDashboardAnalytics } from "../../services/atlApi";
import { ROLE_CODES, getGrantedFeatures, getUserRoleCodes, getUserRoleNames, isAdminUser } from "../../services/accessControl";
import { getATLDistributionTemplate, getNoDataLevel } from "../../services/labelRegistry";
import posterFuzzy from "../../assets/posterFuzzy.png";

const emptyDashboard = {
  meta: { semester: "Semester 2 (2024/2025)", updatedAt: null },
  summary: {
    average: 0,
    completion: 0,
    totalStudents: 0,
    assessedStudents: 0,
    assessmentSaved: 0,
    topicActive: 0,
    criteriaCount: 0,
    bestClass: "-",
    needAttention: 0,
    strongestATL: "-",
    focusATL: "-",
    level: getNoDataLevel(),
  },
  overviewCards: [
    { label: "Cakupan Rubrik", value: "0%", note: "Persentase item rubrik yang sudah memiliki nilai.", icon: "fact_check", color: "blue" },
    { label: "Siswa Dinilai", value: "0/0", note: "Jumlah siswa yang sudah memiliki minimal satu nilai ATL.", icon: "groups", color: "amber" },
    { label: "Nilai Tersimpan", value: "0", note: "Total rating ATL yang tersimpan di database.", icon: "assignment_turned_in", color: "sky" },
    { label: "Topik Aktif", value: "0", note: "Topik pembelajaran yang sudah memiliki assessment.", icon: "auto_stories", color: "violet" },
  ],
  atlDistribution: getATLDistributionTemplate(),
  analysisScopes: [],
  trend: [
    { label: "Minggu 1", score: 0 },
    { label: "Minggu 2", score: 0 },
    { label: "Minggu 3", score: 0 },
    { label: "Minggu 4", score: 0 },
    { label: "Minggu 5", score: 0 },
  ],
  classComparison: [
    { className: "3A - Primary", average: 0 },
    { className: "4A - Primary", average: 0 },
  ],
  attentionStudents: [],
  teacherMonitoring: [
    { name: "Joko Wiryanto", progress: 0, color: "#45B978" },
    { name: "Nadia Fatthurrahmi", progress: 0, color: "#F6B21A" },
    { name: "Budhi Nugroho", progress: 0, color: "#EF4444" },
  ],
  recentActivities: [],
  workflow: [
    { step: 1, title: "Input Nilai", note: "Guru mengisi rating ATL berdasarkan rubrik.", icon: "edit_note", color: "#45B978" },
    { step: 2, title: "Bobot Fuzzy-AHP", note: "Sistem memakai bobot subskill per konteks.", icon: "hub", color: "#45B978" },
    { step: 3, title: "Agregasi Data", note: "Nilai dirangkum per siswa, kelas, dan ATL.", icon: "query_stats", color: "#F6B21A" },
    { step: 4, title: "Review Akademik", note: "Tim akademik meninjau area kuat dan fokus.", icon: "verified", color: "#4F8DE8" },
    { step: 5, title: "Laporan", note: "Hasil siap digunakan untuk tindak lanjut.", icon: "description", color: "#7C4CE0" },
  ],
  documents: [
    { title: "Laporan Kelas", note: "Ringkasan ATL per kelas", icon: "description", color: "green" },
    { title: "Laporan Siswa", note: "Detail ATL per siswa", icon: "person", color: "violet" },
    { title: "Laporan Topik", note: "Ringkasan per topik ATL", icon: "content_paste", color: "amber" },
    { title: "Export Data", note: "Unduh data mentah", icon: "cloud_download", color: "blue" },
  ],
};

const cardTone = {
  blue: "bg-blue-100 text-blue-600",
  sky: "bg-sky-100 text-sky-600",
  amber: "bg-amber-100 text-amber-600",
  violet: "bg-violet-100 text-violet-600",
  green: "bg-emerald-100 text-emerald-600",
};

const overviewTone = {
  blue: {
    card: "border-blue-100 bg-gradient-to-br from-blue-50 via-white to-blue-100/80 shadow-blue-100/70",
    icon: "bg-blue-100 text-blue-600",
    value: "text-blue-600",
  },
  amber: {
    card: "border-amber-100 bg-gradient-to-br from-amber-50 via-white to-amber-100/80 shadow-amber-100/70",
    icon: "bg-amber-100 text-amber-600",
    value: "text-orange-500",
  },
  sky: {
    card: "border-cyan-100 bg-gradient-to-br from-cyan-50 via-white to-cyan-100/80 shadow-cyan-100/70",
    icon: "bg-cyan-100 text-cyan-600",
    value: "text-cyan-600",
  },
  violet: {
    card: "border-violet-100 bg-gradient-to-br from-violet-50 via-white to-violet-100/80 shadow-violet-100/70",
    icon: "bg-violet-100 text-violet-600",
    value: "text-violet-600",
  },
  green: {
    card: "border-emerald-100 bg-gradient-to-br from-emerald-50 via-white to-emerald-100/80 shadow-emerald-100/70",
    icon: "bg-emerald-100 text-emerald-600",
    value: "text-emerald-600",
  },
};

const formatTime = (value) => {
  if (!value) return "Belum ada update";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Belum ada update";
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

const normalizeToken = (value) => String(value || "").trim().toLowerCase();

const matchesClassAccess = (className, access = []) => {
  if (!access.length) return true;
  const normalizedClass = normalizeToken(className);
  const classCode = normalizeToken(String(className || "").split(" - ")[0]);
  return access.some((item) => {
    const normalizedAccess = normalizeToken(item);
    return normalizedAccess === normalizedClass || normalizedAccess === classCode;
  });
};

const matchesSubjectAccess = (scope, access = []) => {
  if (!access.length) return true;
  const subjectCode = normalizeToken(scope.subjectCode);
  const subjectLabel = normalizeToken(scope.subjectLabel);
  return access.some((item) => {
    const normalizedAccess = normalizeToken(item);
    return normalizedAccess === subjectCode || normalizedAccess === subjectLabel;
  });
};

const buildAnalysisScopeOptions = ({ dashboard, roleCodes, isAdminDashboard, classAccess, subjectAccess }) => {
  const scopes = Array.isArray(dashboard.analysisScopes) ? dashboard.analysisScopes : [];
  const fallback = {
    key: "all",
    label: "Semua Kelas",
    type: "all",
    distribution: dashboard.atlDistribution || [],
    average: dashboard.summary?.average || 0,
    completion: dashboard.summary?.completion || 0,
    assessedStudents: dashboard.summary?.assessedStudents || 0,
    totalStudents: dashboard.summary?.totalStudents || 0,
    strongestATL: dashboard.summary?.strongestATL || "-",
    focusATL: dashboard.summary?.focusATL || "-",
  };
  const allScope = scopes.find((scope) => scope.key === "all") || fallback;
  const classScopes = scopes.filter((scope) => scope.type === "class");
  const subjectScopes = scopes.filter((scope) => scope.type === "subject");
  const classSubjectScopes = scopes.filter((scope) => scope.type === "class-subject");

  if (isAdminDashboard || roleCodes.includes(ROLE_CODES.ATL_EXPERT)) {
    return [
      allScope,
      ...classScopes,
      ...subjectScopes,
      ...classSubjectScopes,
    ];
  }

  if (roleCodes.includes(ROLE_CODES.SUBJECT_COORDINATOR)) {
    const options = classSubjectScopes.filter(
      (scope) => matchesClassAccess(scope.className, classAccess) && matchesSubjectAccess(scope, subjectAccess)
    );
    return options.length ? options : subjectScopes.filter((scope) => matchesSubjectAccess(scope, subjectAccess));
  }

  if (roleCodes.includes(ROLE_CODES.HOMEROOM)) {
    const options = classScopes.filter((scope) => matchesClassAccess(scope.className, classAccess));
    return options.length ? options : [allScope];
  }

  return [allScope];
};

const mergeDashboardData = (data) => {
  if (!data?.summary) return emptyDashboard;
  const merged = { ...emptyDashboard, ...data, summary: { ...emptyDashboard.summary, ...(data.summary || {}) } };
  [
    "overviewCards",
    "atlDistribution",
    "analysisScopes",
    "trend",
    "classComparison",
    "teacherMonitoring",
    "workflow",
    "documents",
  ].forEach((key) => {
    if (!Array.isArray(merged[key]) || merged[key].length === 0) merged[key] = emptyDashboard[key];
  });
  return merged;
};

const StatCard = ({ item }) => {
  const tone = overviewTone[item.color] || overviewTone.amber;
  return (
    <div className={`rounded-[1.2rem] border p-5 shadow-[0_16px_36px_rgba(15,23,42,0.06)] ${tone.card}`}>
      <div className="flex items-center gap-5">
        <div className={`flex size-14 shrink-0 items-center justify-center rounded-2xl ${tone.icon}`}>
          <span className="material-symbols-outlined text-[30px]">{item.icon}</span>
        </div>
        <div className="min-w-0">
          <p className={`text-3xl font-black leading-none ${tone.value}`}>{item.value}</p>
          <h3 className="mt-3 text-sm font-black leading-tight text-stone-950">{item.label}</h3>
          <p className="mt-2 text-[11px] font-semibold leading-5 text-stone-700">{item.note}</p>
        </div>
      </div>
    </div>
  );
};

const DonutChart = ({ rows }) => {
  let cursor = 0;
  const total = rows.reduce((sum, row) => sum + Number(row.score || 0), 0) || 1;
  const gradient = rows
    .map((row) => {
      const share = (Number(row.score || 0) / total) * 100;
      const start = cursor;
      const end = cursor + share;
      cursor = end;
      return `${row.color} ${start}% ${end}%`;
    })
    .join(", ");

  return (
    <div className="grid gap-8 xl:grid-cols-[320px_1fr]">
      <div className="flex items-center justify-center">
        <div
          className="relative size-72 rounded-full"
          style={{ background: `conic-gradient(${gradient || "#e7e5e4 0% 100%"})` }}
        >
          <div className="absolute inset-14 flex flex-col items-center justify-center rounded-full bg-white shadow-inner">
            <span className="text-xs font-black text-stone-500">Total</span>
            <span className="text-3xl font-black text-stone-950">ATL</span>
          </div>
        </div>
      </div>
      <div className="space-y-4">
        {rows.map((row) => (
          <div key={row.category}>
            <div className="mb-2 flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <span className="size-3 rounded-full" style={{ backgroundColor: row.color }} />
                <span className="truncate text-xs font-black text-stone-700">{row.category}</span>
              </div>
              <span className="text-xs font-black text-stone-900">{row.score}%</span>
            </div>
            <div className="h-2 rounded-full bg-stone-100">
              <div className="h-full rounded-full" style={{ width: `${row.score}%`, backgroundColor: row.color }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const TrendChart = ({ rows }) => {
  const points = rows.length ? rows : [{ label: "Minggu 1", score: 0 }];
  const linePoints = points
    .map((item, index) => {
      const x = points.length === 1 ? 40 : 24 + (index / (points.length - 1)) * 252;
      const y = 150 - (Number(item.score || 0) / 100) * 118;
      return `${x},${y}`;
    })
    .join(" ");
  const areaPoints = `24,150 ${linePoints} 276,150`;

  return (
    <div>
      <svg viewBox="0 0 300 180" className="h-64 w-full">
        {[35, 65, 95, 125, 155].map((y) => (
          <line key={y} x1="20" x2="285" y1={y} y2={y} stroke="#E7E5E4" strokeDasharray="5 5" />
        ))}
        <polygon points={areaPoints} fill="rgba(246,178,26,0.13)" />
        <polyline points={linePoints} fill="none" stroke="#F6A609" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        {points.map((item, index) => {
          const x = points.length === 1 ? 40 : 24 + (index / (points.length - 1)) * 252;
          const y = 150 - (Number(item.score || 0) / 100) * 118;
          return <circle key={item.label} cx={x} cy={y} r="4" fill="#F6A609" stroke="#fff" strokeWidth="2" />;
        })}
      </svg>
      <div className="grid grid-cols-5 text-center text-[11px] font-bold text-stone-500">
        {points.map((item) => <span key={item.label}>{item.label}</span>)}
      </div>
    </div>
  );
};

const ClassBarChart = ({ rows }) => {
  const max = Math.max(...rows.map((item) => item.average), 1);
  return (
    <div className="flex h-48 items-end justify-around gap-4 border-b border-dashed border-stone-200 px-4">
      {rows.map((item) => (
        <div key={item.className} className="flex flex-1 flex-col items-center gap-2">
          <div
            className="w-10 rounded-t-xl bg-gradient-to-t from-[#F6A609] to-[#FFD981]"
            style={{ height: `${Math.max(14, (item.average / max) * 150)}px` }}
            title={`${item.className}: ${item.average}%`}
          />
          <span className="text-[10px] font-black text-stone-500">{item.className.split(" ")[0]}</span>
        </div>
      ))}
    </div>
  );
};

const ATLAnalysisSection = ({ dashboard, insight, scopeOptions = [], selectedScopeKey, onScopeChange, scopeNote = "" }) => {
  const fallbackScope = {
    key: "all",
    label: "Semua Kelas",
    distribution: dashboard.atlDistribution || [],
    average: dashboard.summary?.average || 0,
    completion: dashboard.summary?.completion || 0,
    assessedStudents: dashboard.summary?.assessedStudents || 0,
    totalStudents: dashboard.summary?.totalStudents || 0,
    strongestATL: dashboard.summary?.strongestATL || "-",
    focusATL: dashboard.summary?.focusATL || "-",
  };
  const scopes = scopeOptions.length ? scopeOptions : [fallbackScope];
  const activeScope = scopes.find((scope) => scope.key === selectedScopeKey) || scopes[0] || fallbackScope;
  const distribution = activeScope.distribution || fallbackScope.distribution;
  const detailItems = [
    ["Average ATL", activeScope.average ?? 0],
    ["Completion", `${activeScope.completion ?? 0}%`],
    ["Siswa Dinilai", `${activeScope.assessedStudents ?? 0}/${activeScope.totalStudents ?? 0}`],
  ];

  return (
    <section className="rounded-[1.6rem] border border-stone-200 bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.04)]">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="text-lg font-black text-stone-950">Analisis ATL</h2>
          <p className="mt-2 text-sm font-semibold text-stone-500">Distribusi ATL berdasarkan lingkup data yang sedang dianalisis.</p>
        </div>
        <div className="w-full max-w-xs">
          <label className="text-[10px] font-black uppercase tracking-widest text-stone-400">Lingkup Analisis</label>
          {scopes.length > 1 ? (
            <select
              value={activeScope.key}
              onChange={(event) => onScopeChange?.(event.target.value)}
              className="mt-2 w-full rounded-xl border border-stone-200 bg-white px-4 py-3 text-xs font-black text-stone-700 outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
            >
              {scopes.map((scope) => (
                <option key={scope.key} value={scope.key}>{scope.label}</option>
              ))}
            </select>
          ) : (
            <div className="mt-2 rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-xs font-black text-stone-700">
              {activeScope.label}
            </div>
          )}
        </div>
      </div>

      <div className="mt-7 rounded-[1.35rem] border border-stone-200 p-6">
        <div className="mb-6 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <h3 className="text-sm font-black text-stone-950">Distribusi Rata-rata ATL</h3>
          <span className="w-fit rounded-full bg-primary/10 px-3 py-1 text-[10px] font-black text-primary">{activeScope.label}</span>
        </div>
        <DonutChart rows={distribution} />
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        {detailItems.map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-stone-200 bg-stone-50 px-5 py-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-stone-400">{label}</p>
            <p className="mt-2 text-xl font-black text-stone-950">{value}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_0.9fr]">
        <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4">
          <span className="material-symbols-outlined text-primary">emoji_objects</span>
          <div>
            <p className="text-sm font-black text-stone-950">Insight Utama</p>
            <p className="mt-1 text-xs font-semibold leading-5 text-stone-600">{insight}</p>
          </div>
        </div>
        <div className="rounded-2xl border border-stone-200 bg-white px-5 py-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-stone-400">Detail Lingkup</p>
          <p className="mt-2 text-sm font-black text-stone-950">Terkuat: {activeScope.strongestATL || "-"}</p>
          <p className="mt-1 text-sm font-black text-stone-950">Perlu Fokus: {activeScope.focusATL || "-"}</p>
          {scopeNote && <p className="mt-2 text-xs font-semibold leading-5 text-stone-500">{scopeNote}</p>}
        </div>
      </div>
    </section>
  );
};

const AttentionStudentsCard = ({ students = [], title = "Siswa Perlu Perhatian" }) => (
  <div className="rounded-[1.6rem] border border-stone-200 bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.04)]">
    <h2 className="text-base font-black text-stone-950">{title}</h2>
    <p className="mt-2 text-xs font-semibold text-stone-500">Siswa yang memerlukan pendampingan lebih lanjut.</p>
    <div className="mt-5 space-y-4">
      {students.length > 0 ? (
        students.map((student, index) => (
          <div key={student.id || index} className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-full bg-amber-100 text-xs font-black text-primary">
              {(student.name || "?").split(" ").map((part) => part[0]).slice(0, 2).join("")}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-black text-stone-900">{student.name}</p>
              <p className="text-[10px] font-semibold text-stone-400">{student.className || student.class || "Kelas aktif"}</p>
              <div className="mt-1 h-2 rounded-full bg-stone-100">
                <div className="h-full rounded-full bg-amber-300" style={{ width: `${student.score || 0}%` }} />
              </div>
            </div>
            <span className="rounded-full bg-amber-100 px-3 py-1 text-[10px] font-black text-primary">Perhatian</span>
          </div>
        ))
      ) : (
        <div className="rounded-2xl border border-dashed border-stone-200 bg-stone-50 px-4 py-6 text-center">
          <span className="material-symbols-outlined text-3xl text-stone-400">verified</span>
          <p className="mt-2 text-xs font-black text-stone-700">Belum ada siswa prioritas</p>
          <p className="mt-1 text-[11px] font-semibold text-stone-500">Data akan muncul setelah nilai ATL tersimpan.</p>
        </div>
      )}
    </div>
  </div>
);

const TeacherMonitoringCard = ({ rows = [] }) => (
  <div className="rounded-[1.6rem] border border-stone-200 bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.04)]">
    <h2 className="text-base font-black text-stone-950">Monitor Penilaian Guru</h2>
    <p className="mt-2 text-xs font-semibold text-stone-500">Progress input penilaian ATL oleh guru.</p>
    <div className="mt-5 space-y-4">
      {rows.length > 0 ? rows.map((teacher) => (
        <div key={teacher.name} className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-full bg-stone-100 text-stone-500">
            <span className="material-symbols-outlined text-lg">person</span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-black text-stone-900">{teacher.name}</p>
            <p className="mt-0.5 text-[10px] font-semibold text-stone-500">{teacher.role || "Pengajar"} | {teacher.assessmentCount || 0} input</p>
            <div className="mt-1 h-2 rounded-full bg-stone-100">
              <div className="h-full rounded-full" style={{ width: `${teacher.progress}%`, backgroundColor: teacher.color }} />
            </div>
          </div>
          <span className="text-xs font-black text-stone-500">{teacher.progress || 0}%</span>
        </div>
      )) : (
        <div className="rounded-2xl border border-dashed border-stone-200 bg-stone-50 px-4 py-6 text-center">
          <span className="material-symbols-outlined text-3xl text-stone-400">assignment_late</span>
          <p className="mt-2 text-xs font-black text-stone-700">Belum ada input guru</p>
          <p className="mt-1 text-[11px] font-semibold text-stone-500">Progress akan muncul setelah guru menyimpan penilaian.</p>
        </div>
      )}
    </div>
  </div>
);

const RecentActivityCompact = ({ activities = [] }) => {
  const rows = activities.slice(0, 4);
  return (
    <div className="rounded-[1.6rem] border border-stone-200 bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.04)]">
      <h2 className="text-base font-black text-stone-950">Aktivitas Terbaru</h2>
      <p className="mt-2 text-xs font-semibold text-stone-500">Siapa yang melakukan perubahan dan lokasi aktivitasnya.</p>
      <div className="mt-5 divide-y divide-stone-100">
        {rows.length > 0 ? rows.map((activity, index) => {
          const actor = activity.actor || activity.user || activity.evaluator || "Sistem ATL";
          const location = String(activity.title || activity.type || "-").replace(/^Nilai\s+/i, "");
          return (
            <div key={`${activity.title}-${index}`} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <span className="material-symbols-outlined text-[18px]">history</span>
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-black text-stone-900">{actor}</p>
                <p className="truncate text-[11px] font-semibold text-stone-500">{location}</p>
              </div>
              <span className="text-[10px] font-bold text-stone-400">{formatTime(activity.time)}</span>
            </div>
          );
        }) : (
          <div className="rounded-2xl border border-dashed border-stone-200 bg-stone-50 px-4 py-6 text-center text-xs font-bold text-stone-500">
            Belum ada aktivitas terbaru.
          </div>
        )}
      </div>
    </div>
  );
};

const ATLFlowBanner = ({ open, onToggle }) => (
  <section className="relative overflow-hidden rounded-[1.6rem] border border-amber-100 bg-gradient-to-r from-amber-50 via-white to-amber-100 p-7">
    <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
      <div className="flex items-center gap-5">
        <div className="flex size-16 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary md:size-20">
          <span className="material-symbols-outlined text-4xl md:text-5xl">school</span>
        </div>
        <div>
          <h2 className="text-lg font-black text-stone-950">Alur penilaian ATL dalam sistem</h2>
          <p className="mt-2 max-w-2xl text-xs font-semibold leading-5 text-stone-600">
            Penilaian dimulai dari input rubrik, pembobotan Fuzzy-AHP, agregasi nilai, review akademik, lalu laporan ATL yang siap digunakan.
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={onToggle}
        className="rounded-xl border border-primary/40 bg-white px-5 py-3 text-xs font-black text-primary transition hover:bg-primary/5"
      >
        {open ? "Sembunyikan Poster" : "Pelajari Lebih Lanjut"}
      </button>
    </div>
    {open && (
      <div className="mt-6 overflow-auto rounded-[1.4rem] border border-amber-200 bg-white p-3 shadow-inner lg:p-5">
        <img
          src={posterFuzzy}
          alt="Poster alur penilaian Fuzzy-AHP ATL"
          className="mx-auto min-w-[920px] max-w-none rounded-2xl object-contain shadow-[0_18px_42px_rgba(15,23,42,0.16)] lg:min-w-0 lg:w-full"
        />
      </div>
    )}
  </section>
);

export default function Dashboard() {
  const [dashboard, setDashboard] = useState(emptyDashboard);
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [backendError, setBackendError] = useState("");
  const [showFlowPoster, setShowFlowPoster] = useState(false);
  const [analysisScopeKey, setAnalysisScopeKey] = useState("all");

  const loadDashboard = async () => {
    setLoading(true);
    try {
      const data = await getDashboardAnalytics();
      setDashboard(mergeDashboardData(data));
      setBackendError("");
    } catch (error) {
      setDashboard(emptyDashboard);
      setBackendError(error.message || "Dashboard gagal mengambil data dari backend.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
    getCurrentUser().then((user) => setCurrentUser(user));
    window.addEventListener("focus", loadDashboard);
    window.addEventListener("atl-data-updated", loadDashboard);
    return () => {
      window.removeEventListener("focus", loadDashboard);
      window.removeEventListener("atl-data-updated", loadDashboard);
    };
  }, []);

  useEffect(() => {
    if (!showFlowPoster) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === "Escape") setShowFlowPoster(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showFlowPoster]);

  const summary = dashboard.summary || emptyDashboard.summary;
  const roleCodes = getUserRoleCodes(currentUser);
  const isAdminDashboard = isAdminUser(currentUser);
  const adminOverviewCards = [
    { label: "Total User", value: summary.totalUsers ?? "-", note: "Akun yang terdaftar di sistem.", icon: "manage_accounts", color: "blue" },
    { label: "Total Guru Aktif", value: summary.totalGuruAktif ?? "-", note: "Guru aktif non-admin.", icon: "group", color: "green" },
    { label: "Total Siswa", value: summary.totalStudents ?? 0, note: "Siswa aktif dalam katalog akademik.", icon: "groups", color: "amber" },
    { label: "Total Kelas", value: summary.totalClasses ?? "-", note: "Kelas aktif tahun ajaran ini.", icon: "home_work", color: "blue" },
    { label: "Total Subject", value: summary.totalSubjects ?? "-", note: "Mapel aktif yang tersedia.", icon: "menu_book", color: "sky" },
    { label: "Active Topic", value: summary.totalActiveTopic ?? "-", note: "Topik pembelajaran aktif.", icon: "topic", color: "violet" },
    { label: "Assessment Records", value: summary.assessmentRecords ?? "-", note: "Record penilaian tersimpan.", icon: "assignment_turned_in", color: "green" },
    { label: "Pairwise Config", value: summary.pairwiseConfiguration ?? summary.criteriaCount ?? 0, note: "Konfigurasi bobot dan kriteria.", icon: "hub", color: "violet" },
  ];
  const evaluatorOverviewCards = [
    { label: "Kelas yang Diampu", value: currentUser?.classAccess?.length || "-", note: "Kelas sesuai akses akun.", icon: "home_work", color: "blue" },
    { label: "Jumlah Siswa", value: summary.totalStudents ?? 0, note: "Siswa pada data akademik aktif.", icon: "groups", color: "amber" },
    { label: "Assessment Progress", value: `${summary.completion || 0}%`, note: "Progress penilaian tersimpan.", icon: "fact_check", color: "sky" },
    { label: "Pending Assessment", value: Math.max(0, Number(summary.totalStudents || 0) - Number(summary.assessedStudents || 0)), note: "Estimasi siswa belum lengkap dinilai.", icon: "pending_actions", color: "violet" },
  ];
  const overviewCards = isAdminDashboard ? adminOverviewCards : evaluatorOverviewCards;
  const dashboardTitle = isAdminDashboard ? "Monitoring Sistem ATL" : "Dashboard Pekerjaan Guru";
  const dashboardSubtitle = isAdminDashboard
    ? "Pantau user, data akademik, monitor penilaian guru, dan status konfigurasi sistem."
    : "Pantau kelas, progress assessment, siswa prioritas, dan insight penilaian.";
  const insight = useMemo(() => {
    const focus = summary.focusATL || "-";
    const strongest = summary.strongestATL || "-";
    return `Siswa menunjukkan kekuatan pada aspek ${strongest}, namun masih perlu peningkatan konsistensi pada ${focus}.`;
  }, [summary.focusATL, summary.strongestATL]);

  const roleNames = getUserRoleNames(currentUser);
  const grantedFeatures = getGrantedFeatures(currentUser);
  const classAccess = Array.isArray(currentUser?.classAccess) ? currentUser.classAccess : [];
  const subjectAccess = Array.isArray(currentUser?.subjectAccess) ? currentUser.subjectAccess : [];
  const classScopeLabel = classAccess.length ? classAccess.join(", ") : "Semua Kelas";
  const scopedAttentionStudents = (dashboard.attentionStudents || []).filter((student) => {
    if (!classAccess.length) return true;
    const className = student.className || student.class || "";
    const classCode = String(className).split(" - ")[0];
    return classAccess.includes(className) || classAccess.includes(classCode);
  });
  const roleDashboardCards = [
    { label: "Role Aktif", value: roleNames[0] || currentUser?.roleLabel || "-", note: "Dashboard mengikuti role akun ini.", icon: "badge", color: "blue" },
    { label: "Akses Kelas", value: classAccess.length || "-", note: classAccess.length ? classAccess.join(", ") : "Tidak dibatasi khusus.", icon: "home_work", color: "amber" },
    { label: "Akses Mapel", value: subjectAccess.length || "-", note: subjectAccess.length ? subjectAccess.join(", ").toUpperCase() : "Tidak dibatasi khusus.", icon: "menu_book", color: "sky" },
    { label: "Progress Sistem", value: `${summary.completion || 0}%`, note: "Ringkasan dari data assessment tersimpan.", icon: "fact_check", color: "green" },
  ];
  const roleFocusPanels = [
    roleCodes.includes(ROLE_CODES.ACADEMIC) && {
      title: "Fokus Akademik",
      icon: "verified",
      tone: "border-indigo-200 bg-indigo-50 text-indigo-700",
      note: "Pantau validasi data akademik, akses user, dan kesiapan laporan. Dashboard full monitoring hanya tersedia untuk Admin.",
    },
    roleCodes.includes(ROLE_CODES.HOMEROOM) && {
      title: "Fokus Wali Kelas",
      icon: "groups",
      tone: "border-emerald-200 bg-emerald-50 text-emerald-700",
      note: `Utamakan monitoring siswa pada kelas ${classAccess.join(", ") || "yang diampu"} dan cek siswa yang perlu perhatian.`,
    },
    roleCodes.includes(ROLE_CODES.SUBJECT_COORDINATOR) && {
      title: "Fokus PJ Mapel",
      icon: "poll",
      tone: "border-amber-200 bg-amber-50 text-amber-700",
      note: `Review report untuk mapel ${subjectAccess.join(", ").toUpperCase() || "yang diampu"} dan pastikan input nilai sudah lengkap.`,
    },
    roleCodes.includes(ROLE_CODES.ATL_EXPERT) && {
      title: "Fokus ATL Expert",
      icon: "hub",
      tone: "border-violet-200 bg-violet-50 text-violet-700",
      note: "Tinjau kriteria, pairwise comparison, dan bobot Fuzzy-AHP sebelum laporan digunakan.",
    },
  ].filter(Boolean);
  const analysisScopeOptions = useMemo(
    () => buildAnalysisScopeOptions({ dashboard, roleCodes, isAdminDashboard, classAccess, subjectAccess }),
    [dashboard, roleCodes, isAdminDashboard, classAccess, subjectAccess]
  );
  useEffect(() => {
    if (!analysisScopeOptions.length) return;
    if (!analysisScopeOptions.some((scope) => scope.key === analysisScopeKey)) {
      setAnalysisScopeKey(analysisScopeOptions[0].key);
    }
  }, [analysisScopeOptions, analysisScopeKey]);
  const analysisScopeNote = roleCodes.includes(ROLE_CODES.SUBJECT_COORDINATOR)
    ? `Fokus mapel: ${subjectAccess.join(", ").toUpperCase() || "mapel yang diampu"}. Pilihan kelas mengikuti akses PJ Mapel.`
    : roleCodes.includes(ROLE_CODES.HOMEROOM)
      ? `Dikunci ke kelas wali: ${classScopeLabel}.`
      : "Admin dan ATL Expert dapat memilih semua kelas, kelas tertentu, mapel, atau kombinasi kelas-mapel.";

  if (!isAdminDashboard) {
    return (
      <div className="flex h-screen w-full overflow-hidden bg-[#FBFAF7]">
        <Sidebar />

        <main className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto px-5 py-6 lg:px-8">
            <div className="mx-auto flex max-w-[1080px] flex-col gap-7">
              <header className="rounded-[1.8rem] border border-stone-200 bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.22em] text-primary">Dashboard Role</p>
                    <h1 className="mt-3 text-3xl font-black tracking-tight text-stone-950">
                      Halo, {currentUser?.name || "User ATL"}
                    </h1>
                    <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-stone-500">
                      Tampilan ini diringkas sesuai role akun. Semua halaman tetap bisa dibuka, sementara panel My Access menunjukkan cakupan akses sebenarnya.
                    </p>
                  </div>
                  <div className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-right">
                    <p className="text-[10px] font-black uppercase tracking-widest text-stone-400">Update Data</p>
                    <p className="mt-1 text-sm font-black text-stone-800">{formatTime(dashboard.meta?.updatedAt)}</p>
                  </div>
                </div>
              </header>

              {backendError && (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-bold text-red-700">
                  <span className="material-symbols-outlined mr-2 align-middle text-[18px]">error</span>
                  {backendError}
                </div>
              )}

              <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {roleDashboardCards.map((item) => <StatCard key={item.label} item={item} />)}
              </section>

              <section className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-[1.6rem] border border-stone-200 bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.04)]">
                  <h2 className="text-lg font-black text-stone-950">My Access</h2>
                  <p className="mt-2 text-sm font-semibold text-stone-500">Role dan scope akses yang tersimpan untuk akun ini.</p>
                  <div className="mt-5 space-y-4">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-stone-400">Role</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {roleNames.map((role) => (
                          <span key={role} className="rounded-full bg-primary/10 px-3 py-1 text-xs font-black text-primary">{role}</span>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-stone-400">Fitur</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {grantedFeatures.map((feature) => (
                          <span key={feature} className="rounded-full border border-stone-200 bg-stone-50 px-3 py-1 text-xs font-black text-stone-700">{feature}</span>
                        ))}
                      </div>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
                        <p className="text-[10px] font-black uppercase tracking-widest text-blue-500">Kelas</p>
                        <p className="mt-2 text-sm font-black text-blue-900">{classAccess.join(", ") || "Semua / tidak dibatasi"}</p>
                      </div>
                      <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4">
                        <p className="text-[10px] font-black uppercase tracking-widest text-amber-600">Mapel</p>
                        <p className="mt-2 text-sm font-black uppercase text-amber-900">{subjectAccess.join(", ") || "Semua / tidak dibatasi"}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-[1.6rem] border border-stone-200 bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.04)]">
                  <h2 className="text-lg font-black text-stone-950">Ringkasan Pekerjaan</h2>
                  <p className="mt-2 text-sm font-semibold text-stone-500">Informasi utama untuk role akun ini.</p>
                  <div className="mt-5 space-y-3">
                    {roleFocusPanels.map((panel) => (
                      <div key={panel.title} className={`rounded-2xl border p-4 ${panel.tone}`}>
                        <div className="flex items-start gap-3">
                          <span className="material-symbols-outlined text-[22px]">{panel.icon}</span>
                          <div>
                            <p className="text-sm font-black">{panel.title}</p>
                            <p className="mt-1 text-xs font-semibold leading-5">{panel.note}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                    {roleFocusPanels.length === 0 && (
                      <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4 text-sm font-semibold text-stone-500">
                        Akun ini bisa melakukan input penilaian ATL dan melihat menu lain sesuai kebutuhan.
                      </div>
                    )}
                  </div>
                </div>
              </section>

              <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
                <div className="rounded-[1.6rem] border border-stone-200 bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.04)]">
                  <h2 className="text-lg font-black text-stone-950">Progress ATL</h2>
                  <p className="mt-2 text-sm font-semibold text-stone-500">Ringkasan umum dari assessment yang tersimpan.</p>
                  <div className="mt-6 grid gap-4 md:grid-cols-3">
                    {[
                      ["Siswa Dinilai", `${summary.assessedStudents || 0}/${summary.totalStudents || 0}`],
                      ["Average ATL", summary.average || 0],
                      ["Best Class", summary.bestClass || "-"],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
                        <p className="text-[10px] font-black uppercase tracking-widest text-stone-400">{label}</p>
                        <p className="mt-2 text-xl font-black text-stone-950">{value}</p>
                      </div>
                    ))}
                  </div>
                  <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold leading-6 text-amber-800">
                    {insight}
                  </div>
                </div>

                <div className="rounded-[1.6rem] border border-stone-200 bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.04)]">
                  <h2 className="text-lg font-black text-stone-950">Aksi Cepat</h2>
                  <p className="mt-2 text-sm font-semibold text-stone-500">Menu tetap tersedia, pilih sesuai kebutuhan kerja.</p>
                  <div className="mt-5 grid gap-3">
                    {[
                      ["edit_note", "Input Penilaian ATL", "Isi nilai detailed atau batch."],
                      ["poll", "ATL Reports", "Lihat dan export hasil report."],
                      ["assignment", "Criteria Management", "Review kriteria ATL."],
                      ["tune", "Weight Management", "Kelola bobot Fuzzy-AHP."],
                    ].map(([icon, title, note]) => (
                      <div key={title} className="flex items-center gap-3 rounded-2xl border border-stone-200 bg-white px-4 py-3">
                        <span className="material-symbols-outlined text-primary">{icon}</span>
                        <div>
                          <p className="text-sm font-black text-stone-900">{title}</p>
                          <p className="text-xs font-semibold text-stone-500">{note}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </section>

              {(roleCodes.includes(ROLE_CODES.HOMEROOM) || roleCodes.includes(ROLE_CODES.ATL_EXPERT) || roleCodes.includes(ROLE_CODES.SUBJECT_COORDINATOR)) && (
                <ATLAnalysisSection
                  dashboard={dashboard}
                  insight={insight}
                  scopeOptions={analysisScopeOptions}
                  selectedScopeKey={analysisScopeKey}
                  onScopeChange={setAnalysisScopeKey}
                  scopeNote={analysisScopeNote}
                />
              )}

              {roleCodes.includes(ROLE_CODES.HOMEROOM) && (
                <AttentionStudentsCard
                  students={scopedAttentionStudents}
                  title={`Siswa Perlu Perhatian - ${classScopeLabel}`}
                />
              )}

              <ATLFlowBanner
                open={showFlowPoster}
                onToggle={() => setShowFlowPoster((value) => !value)}
              />

              <footer className="pb-4 text-[11px] font-semibold text-stone-400">
                <span>{loading ? "Memuat data dashboard..." : `Data diperbarui: ${formatTime(dashboard.meta?.updatedAt)}`}</span>
              </footer>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#FBFAF7]">
      <Sidebar />

      <main className="flex flex-1 flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto px-5 py-6 lg:px-8">
          <div className="mx-auto flex max-w-[1180px] flex-col gap-7">
            <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xs font-bold text-stone-400">Dashboard ATL</p>
                <h1 className="mt-3 text-3xl font-black tracking-tight text-stone-950">{dashboardTitle}</h1>
                <p className="mt-2 text-sm font-semibold text-stone-500">{dashboardSubtitle}</p>
              </div>
              <div className="flex items-center gap-4">
                <button className="flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm font-bold text-stone-700 shadow-sm">
                  <span className="material-symbols-outlined text-lg text-stone-500">calendar_month</span>
                  {dashboard.meta?.semester || "Semester 2 (2024/2025)"}
                  <span className="material-symbols-outlined text-lg text-stone-400">expand_more</span>
                </button>
                <button className="relative flex size-10 items-center justify-center rounded-full bg-white text-stone-500 shadow-sm">
                  <span className="material-symbols-outlined">notifications</span>
                  <span className="absolute right-2 top-2 size-2 rounded-full bg-primary" />
                </button>
                <div className="flex size-11 items-center justify-center rounded-full bg-primary text-white">
                  <span className="material-symbols-outlined">person</span>
                </div>
              </div>
            </header>

            {backendError && (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-bold text-red-700">
                <span className="material-symbols-outlined mr-2 align-middle text-[18px]">error</span>
                {backendError} Data dummy/localStorage tidak dipakai sebagai pengganti.
              </div>
            )}

            <section className="rounded-2xl border border-stone-200/70 bg-white px-6 py-5 shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl text-amber-500 ring-1 ring-amber-200">
                    <span className="material-symbols-outlined text-[24px]">fact_check</span>
                  </div>
                  <div>
                    <h2 className="text-lg font-black leading-tight text-stone-950">
                      {isAdminDashboard ? "Gambaran Umum Sistem" : "Gambaran Umum Penilaian"}
                    </h2>
                    <p className="mt-1 text-sm font-semibold text-stone-500">
                      {isAdminDashboard ? "Ringkasan langsung dari user, akademik, assessment, dan konfigurasi ATL." : "Ringkasan pekerjaan guru berdasarkan kelas, siswa, dan progress assessment."}
                    </p>
                  </div>
                </div>
                <div className="inline-flex w-fit items-center gap-2 rounded-full bg-stone-100 px-3 py-2 text-[11px] font-black text-stone-500">
                  <span className="material-symbols-outlined text-[15px]">calendar_month</span>
                  Update {formatTime(dashboard.meta?.updatedAt)}
                </div>
              </div>
              <div className="mt-5 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
                {overviewCards.map((item) => <StatCard key={item.label} item={item} />)}
              </div>
            </section>

            <section className="grid gap-5 lg:grid-cols-3">
              {isAdminDashboard && (
                <>
                  <div className="rounded-[1.6rem] border border-stone-200 bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.04)]">
                    <h2 className="text-base font-black text-stone-950">User Distribution</h2>
                    <p className="mt-2 text-xs font-semibold text-stone-500">Evaluator, PJ Mapel, dan ATL Expert aktif.</p>
                    <div className="mt-5 space-y-3">
                      {[
                        ["Evaluator", summary.evaluatorUsers ?? "-", "bg-stone-100 text-stone-700"],
                        ["PJ Mapel", summary.subjectCoordinatorUsers ?? "-", "bg-amber-100 text-amber-700"],
                        ["ATL Expert", summary.atlExpertUsers ?? "-", "bg-violet-100 text-violet-700"],
                      ].map(([label, value, tone]) => (
                        <div key={label} className="flex items-center justify-between rounded-xl border border-stone-200 px-3 py-3">
                          <span className="text-xs font-black text-stone-700">{label}</span>
                          <span className={`rounded-full px-3 py-1 text-xs font-black ${tone}`}>{value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <TeacherMonitoringCard rows={dashboard.teacherMonitoring || []} />
                  <div className="rounded-[1.6rem] border border-stone-200 bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.04)]">
                    <h2 className="text-base font-black text-stone-950">Configuration Status</h2>
                    <p className="mt-2 text-xs font-semibold text-stone-500">Status konfigurasi utama ATL.</p>
                    <div className="mt-5 space-y-3">
                      {[
                        ["Pairwise Configuration", summary.pairwiseConfiguration ? "Ready" : "Review"],
                        ["Weight Available", summary.weightAvailable ? "Ready" : "Review"],
                        ["Active Semester", dashboard.meta?.semester || "-"],
                      ].map(([label, value]) => (
                        <div key={label} className="flex items-center justify-between rounded-xl bg-stone-50 px-3 py-3">
                          <span className="text-xs font-black text-stone-700">{label}</span>
                          <span className="text-xs font-black text-primary">{value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
              {!isAdminDashboard && roleCodes.includes(ROLE_CODES.SUBJECT_COORDINATOR) && (
                <div className="rounded-[1.6rem] border border-amber-200 bg-amber-50/70 p-6 shadow-[0_18px_50px_rgba(15,23,42,0.04)] lg:col-span-3">
                  <h2 className="text-base font-black text-stone-950">Subject Performance</h2>
                  <p className="mt-2 text-xs font-semibold text-stone-600">Total topic {currentUser?.subjectAccess?.length || "-"} mapel akses, average ATL {summary.average || 0}, best class {summary.bestClass || "-"}.</p>
                </div>
              )}
              {!isAdminDashboard && roleCodes.includes(ROLE_CODES.ATL_EXPERT) && (
                <div className="rounded-[1.6rem] border border-violet-200 bg-violet-50/70 p-6 shadow-[0_18px_50px_rgba(15,23,42,0.04)] lg:col-span-3">
                  <h2 className="text-base font-black text-stone-950">Weight Configuration Status</h2>
                  <p className="mt-2 text-xs font-semibold text-stone-600">Pairwise dan bobot siap ditinjau melalui menu Weight Management sesuai mapel yang diampu.</p>
                </div>
              )}
            </section>

            <ATLAnalysisSection
              dashboard={dashboard}
              insight={insight}
              scopeOptions={analysisScopeOptions}
              selectedScopeKey={analysisScopeKey}
              onScopeChange={setAnalysisScopeKey}
              scopeNote={analysisScopeNote}
            />

            <section className="grid gap-5 lg:grid-cols-[1fr_1fr]">
              <div className="rounded-[1.6rem] border border-stone-200 bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.04)]">
                <h2 className="text-base font-black text-stone-950">Perbandingan Kelas</h2>
                <p className="mt-2 text-xs font-semibold text-stone-500">Perbandingan rata-rata ATL antar kelas.</p>
                <ClassBarChart rows={dashboard.classComparison || []} />
              </div>
              <RecentActivityCompact activities={dashboard.recentActivities || []} />
            </section>

            <ATLFlowBanner
              open={showFlowPoster}
              onToggle={() => setShowFlowPoster((value) => !value)}
            />

            <footer className="flex flex-col gap-2 pb-4 text-[11px] font-semibold text-stone-400 md:flex-row md:items-center md:justify-between">
              <span>© 2024 Cita Hati Surabaya - ATL Assessment System</span>
              <span>{loading ? "Memuat data dashboard..." : `Data diperbarui: ${formatTime(dashboard.meta?.updatedAt)}`}</span>
            </footer>
          </div>
        </div>
      </main>

    </div>
  );
}

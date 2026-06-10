import React, { useEffect, useMemo, useState } from "react";
import Sidebar from "./sidebar";
import { getDashboardAnalytics } from "../../services/atlApi";
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

const mergeDashboardData = (data) => {
  if (!data?.summary) return emptyDashboard;
  const merged = { ...emptyDashboard, ...data, summary: { ...emptyDashboard.summary, ...(data.summary || {}) } };
  [
    "overviewCards",
    "atlDistribution",
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
    <div className="grid gap-6 md:grid-cols-[220px_1fr]">
      <div className="flex items-center justify-center">
        <div
          className="relative size-56 rounded-full"
          style={{ background: `conic-gradient(${gradient || "#e7e5e4 0% 100%"})` }}
        >
          <div className="absolute inset-10 flex flex-col items-center justify-center rounded-full bg-white shadow-inner">
            <span className="text-xs font-black text-stone-500">Total</span>
            <span className="text-2xl font-black text-stone-950">ATL</span>
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

export default function Dashboard() {
  const [dashboard, setDashboard] = useState(emptyDashboard);
  const [loading, setLoading] = useState(true);
  const [backendError, setBackendError] = useState("");
  const [showFlowPoster, setShowFlowPoster] = useState(false);

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
  const insight = useMemo(() => {
    const focus = summary.focusATL || "-";
    const strongest = summary.strongestATL || "-";
    return `Siswa menunjukkan kekuatan pada aspek ${strongest}, namun masih perlu peningkatan konsistensi pada ${focus}.`;
  }, [summary.focusATL, summary.strongestATL]);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#FBFAF7]">
      <Sidebar />

      <main className="flex flex-1 flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto px-5 py-6 lg:px-8">
          <div className="mx-auto flex max-w-[1180px] flex-col gap-7">
            <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xs font-bold text-stone-400">Dashboard ATL</p>
                <h1 className="mt-3 text-3xl font-black tracking-tight text-stone-950">Monitoring Penilaian Siswa</h1>
                <p className="mt-2 text-sm font-semibold text-stone-500">Pantau cakupan assessment, performa ATL, dan kelas yang membutuhkan tindak lanjut.</p>
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
                    <h2 className="text-lg font-black leading-tight text-stone-950">Gambaran Umum Penilaian</h2>
                    <p className="mt-1 text-sm font-semibold text-stone-500">Ringkasan langsung dari data assessment, rubrik, siswa, dan topik aktif.</p>
                  </div>
                </div>
                <div className="inline-flex w-fit items-center gap-2 rounded-full bg-stone-100 px-3 py-2 text-[11px] font-black text-stone-500">
                  <span className="material-symbols-outlined text-[15px]">calendar_month</span>
                  Update {formatTime(dashboard.meta?.updatedAt)}
                </div>
              </div>
              <div className="mt-5 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
                {(dashboard.overviewCards || []).map((item) => <StatCard key={item.label} item={item} />)}
              </div>
            </section>

            <section className="rounded-[1.6rem] border border-stone-200 bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.04)]">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <h2 className="text-lg font-black text-stone-950">Analisis ATL</h2>
                  <p className="mt-2 text-sm font-semibold text-stone-500">Rata-rata pencapaian ATL berdasarkan kategori keterampilan.</p>
                </div>
                <button className="rounded-xl border border-stone-200 bg-white px-4 py-2 text-xs font-black text-stone-600">Semua Kelas</button>
              </div>
              <div className="mt-7 grid gap-5 lg:grid-cols-2">
                <div className="rounded-[1.35rem] border border-stone-200 p-6">
                  <h3 className="mb-5 text-sm font-black text-stone-950">Distribusi Rata-rata ATL</h3>
                  <DonutChart rows={dashboard.atlDistribution || []} />
                </div>
                <div className="rounded-[1.35rem] border border-stone-200 p-6">
                  <h3 className="mb-5 text-sm font-black text-stone-950">Tren Perkembangan ATL</h3>
                  <TrendChart rows={dashboard.trend || []} />
                </div>
              </div>
              <div className="mt-6 flex flex-col gap-4 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 md:flex-row md:items-center md:justify-between">
                <div className="flex items-start gap-3">
                  <span className="material-symbols-outlined text-primary">emoji_objects</span>
                  <div>
                    <p className="text-sm font-black text-stone-950">Insight Utama</p>
                    <p className="mt-1 text-xs font-semibold leading-5 text-stone-600">{insight}</p>
                  </div>
                </div>
                <button className="rounded-xl border border-primary/40 bg-white px-5 py-3 text-xs font-black text-primary">Lihat Rekomendasi</button>
              </div>
            </section>

            <section className="grid gap-5 lg:grid-cols-3">
              <div className="rounded-[1.6rem] border border-stone-200 bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.04)]">
                <h2 className="text-base font-black text-stone-950">Perbandingan Kelas</h2>
                <p className="mt-2 text-xs font-semibold text-stone-500">Perbandingan rata-rata ATL antar kelas.</p>
                <ClassBarChart rows={dashboard.classComparison || []} />
                <button className="mt-5 w-full rounded-xl border border-amber-200 px-4 py-3 text-xs font-black text-primary">Lihat Detail</button>
              </div>

              <div className="rounded-[1.6rem] border border-stone-200 bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.04)]">
                <h2 className="text-base font-black text-stone-950">Siswa Perlu Perhatian</h2>
                <p className="mt-2 text-xs font-semibold text-stone-500">Siswa yang memerlukan pendampingan lebih lanjut.</p>
                <div className="mt-5 space-y-4">
                  {(dashboard.attentionStudents || []).length > 0 ? (
                    (dashboard.attentionStudents || []).map((student, index) => (
                      <div key={student.id || index} className="flex items-center gap-3">
                        <div className="flex size-9 items-center justify-center rounded-full bg-amber-100 text-xs font-black text-primary">
                          {(student.name || "?").split(" ").map((part) => part[0]).slice(0, 2).join("")}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-black text-stone-900">{student.name}</p>
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
                <button className="mt-5 w-full rounded-xl border border-amber-200 px-4 py-3 text-xs font-black text-primary">Lihat Semua Siswa</button>
              </div>

              <div className="rounded-[1.6rem] border border-stone-200 bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.04)]">
                <h2 className="text-base font-black text-stone-950">Monitoring Input Guru</h2>
                <p className="mt-2 text-xs font-semibold text-stone-500">Progress input penilaian ATL oleh guru.</p>
                <div className="mt-5 space-y-4">
                  {(dashboard.teacherMonitoring || []).map((teacher) => (
                    <div key={teacher.name} className="flex items-center gap-3">
                      <div className="flex size-9 items-center justify-center rounded-full bg-stone-100 text-stone-500">
                        <span className="material-symbols-outlined text-lg">person</span>
                      </div>
                      <div className="flex-1">
                        <p className="text-xs font-black text-stone-900">{teacher.name}</p>
                        <p className="mt-0.5 text-[10px] font-semibold text-stone-500">{teacher.role || "Pengajar"} | {teacher.assessmentCount || 0} input</p>
                        <div className="mt-1 h-2 rounded-full bg-stone-100">
                          <div className="h-full rounded-full" style={{ width: `${teacher.progress}%`, backgroundColor: teacher.color }} />
                        </div>
                      </div>
                      <span className="material-symbols-outlined text-stone-400">chevron_right</span>
                    </div>
                  ))}
                </div>
                <button className="mt-5 w-full rounded-xl border border-amber-200 px-4 py-3 text-xs font-black text-primary">Lihat Semua Guru</button>
              </div>
            </section>

            <section className="grid gap-5">
              <div className="rounded-[1.6rem] border border-stone-200 bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.04)]">
                <h2 className="text-base font-black text-stone-950">Aktivitas Terbaru</h2>
                <p className="mt-2 text-xs font-semibold text-stone-500">Aktivitas terbaru yang terjadi dalam sistem.</p>
                <div className="mt-6 space-y-4">
                  {(dashboard.recentActivities || []).length > 0 ? (
                    (dashboard.recentActivities || []).map((activity, index) => (
                      <div key={`${activity.title}-${index}`} className="flex items-center gap-3">
                        <div className="flex size-9 items-center justify-center rounded-full bg-amber-100 text-primary">
                          <span className="material-symbols-outlined text-lg">description</span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-black text-stone-800">{activity.title}</p>
                          <div className="mt-1 h-2 w-2/3 rounded-full bg-stone-100" />
                        </div>
                        <span className="text-[10px] font-bold text-stone-400">{formatTime(activity.time)}</span>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-2xl border border-dashed border-stone-200 bg-stone-50 px-4 py-6 text-center">
                      <span className="material-symbols-outlined text-3xl text-stone-400">history</span>
                      <p className="mt-2 text-xs font-black text-stone-700">Belum ada aktivitas terbaru</p>
                      <p className="mt-1 text-[11px] font-semibold text-stone-500">Aktivitas akan tercatat saat bobot atau nilai diperbarui.</p>
                    </div>
                  )}
                </div>
                <button className="mt-6 w-full rounded-xl border border-amber-200 px-4 py-3 text-xs font-black text-primary">Lihat Semua Aktivitas</button>
              </div>

              <div className="rounded-[2rem] border border-stone-200 bg-white p-6 shadow-[0_20px_55px_rgba(15,23,42,0.07)] lg:p-10">
                <div className="flex items-start gap-4">
                  <span className="mt-1 h-10 w-1.5 shrink-0 rounded-full bg-primary" />
                  <div>
                    <h2 className="text-2xl font-black tracking-tight text-stone-950 lg:text-3xl">Alur Penilaian ATL</h2>
                    <p className="mt-2 text-sm font-semibold text-stone-500 lg:text-base">Tahapan proses penilaian ATL dalam sistem.</p>
                  </div>
                </div>

                <div className="relative mt-10">
                  <div className="absolute left-[10%] right-[10%] top-14 hidden h-0.5 bg-stone-200 lg:block" />
                  <div className="grid gap-6 lg:grid-cols-5 lg:gap-4">
                    {(dashboard.workflow || []).map((step) => (
                      <article key={step.step} className="relative flex min-w-0 flex-col items-center">
                        <div
                          className="relative z-10 flex size-28 items-center justify-center rounded-full border-[9px] border-white shadow-[0_10px_24px_rgba(15,23,42,0.12)]"
                          style={{ backgroundColor: `${step.color}16`, color: step.color }}
                        >
                          <span className="material-symbols-outlined text-[46px]">{step.icon}</span>
                        </div>
                        <div className="hidden h-6 w-px lg:block" style={{ backgroundColor: `${step.color}75` }} />
                        <span className="hidden size-3 rounded-full lg:block" style={{ backgroundColor: step.color }} />

                        <div className="mt-4 flex min-h-[190px] w-full flex-col items-center rounded-2xl border border-stone-200 bg-white px-4 py-6 text-center shadow-[0_8px_22px_rgba(15,23,42,0.035)]">
                          <span
                            className="inline-flex min-w-14 items-center justify-center rounded-full px-4 py-2 text-base font-black"
                            style={{ backgroundColor: `${step.color}16`, color: step.color }}
                          >
                            {step.step}
                          </span>
                          <h3 className="mt-5 text-base font-black leading-tight text-stone-950">{step.title}</h3>
                          <p className="mt-4 text-sm font-semibold leading-6 text-stone-500">{step.note}</p>
                        </div>
                      </article>
                    ))}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowFlowPoster(true)}
                  className="mt-10 w-full rounded-xl border border-primary bg-white px-4 py-4 text-base font-black text-primary transition-all hover:bg-primary/5"
                >
                  Lihat Detail Alur
                </button>
              </div>
            </section>

            <section className="rounded-[1.6rem] border border-stone-200 bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.04)]">
              <h2 className="text-base font-black text-stone-950">Laporan & Dokumen</h2>
              <p className="mt-2 text-xs font-semibold text-stone-500">Akses cepat ke laporan dan dokumen penting.</p>
              <div className="mt-7 grid gap-4 md:grid-cols-4">
                {(dashboard.documents || []).map((doc) => (
                  <button key={doc.title} className="flex items-center gap-4 rounded-2xl border border-stone-200 bg-white p-4 text-left transition hover:border-primary/40 hover:bg-amber-50/40">
                    <div className={`flex size-12 items-center justify-center rounded-2xl ${cardTone[doc.color] || "bg-amber-100 text-primary"}`}>
                      <span className="material-symbols-outlined">{doc.icon}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-black text-stone-900">{doc.title}</p>
                      <p className="truncate text-[11px] font-semibold text-stone-500">{doc.note}</p>
                    </div>
                    <span className="material-symbols-outlined text-stone-400">chevron_right</span>
                  </button>
                ))}
              </div>
            </section>

            <section className="relative overflow-hidden rounded-[1.6rem] border border-amber-100 bg-gradient-to-r from-amber-50 via-white to-amber-100 p-7">
              <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-5">
                  <div className="flex size-20 items-center justify-center rounded-full bg-primary/15 text-primary">
                    <span className="material-symbols-outlined text-5xl">school</span>
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-stone-950">Gunakan data untuk keputusan yang lebih baik</h2>
                    <p className="mt-2 max-w-2xl text-xs font-semibold leading-5 text-stone-600">
                      Dashboard ini membantu Admin memantau perkembangan ATL secara menyeluruh. Analisis yang tepat akan mendukung keputusan akademik yang lebih berdampak.
                    </p>
                  </div>
                </div>
                <button className="rounded-xl border border-primary/40 bg-white px-5 py-3 text-xs font-black text-primary">Pelajari Lebih Lanjut</button>
              </div>
            </section>

            <footer className="flex flex-col gap-2 pb-4 text-[11px] font-semibold text-stone-400 md:flex-row md:items-center md:justify-between">
              <span>© 2024 Cita Hati Surabaya - ATL Assessment System</span>
              <span>{loading ? "Memuat data dashboard..." : `Data diperbarui: ${formatTime(dashboard.meta?.updatedAt)}`}</span>
            </footer>
          </div>
        </div>
      </main>

      {showFlowPoster && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-stone-950/70 p-3 backdrop-blur-md sm:p-6">
          <button
            type="button"
            aria-label="Tutup poster alur"
            className="absolute inset-0"
            onClick={() => setShowFlowPoster(false)}
          />
          <section className="relative z-10 flex h-full max-h-[96vh] w-full max-w-7xl flex-col overflow-hidden rounded-[2rem] border border-white/30 bg-white/95 shadow-[0_32px_90px_rgba(0,0,0,0.38)]">
            <div className="flex shrink-0 items-center justify-between gap-4 border-b border-stone-200 bg-white/90 px-5 py-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-primary">Detail Alur Penilaian</p>
                <h3 className="mt-1 text-lg font-black text-stone-950">Poster Fuzzy-AHP ATL</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowFlowPoster(false)}
                className="flex size-11 shrink-0 items-center justify-center rounded-full border border-stone-200 bg-white text-stone-600 shadow-sm transition hover:border-primary hover:text-primary"
                aria-label="Tutup poster"
              >
                <span className="material-symbols-outlined text-[22px]">close</span>
              </button>
            </div>
            <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto bg-stone-100/70 p-3 sm:p-6">
              <img
                src={posterFuzzy}
                alt="Poster alur penilaian Fuzzy-AHP ATL"
                className="max-h-full w-auto max-w-full rounded-2xl bg-white object-contain shadow-[0_22px_65px_rgba(15,23,42,0.20)]"
              />
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

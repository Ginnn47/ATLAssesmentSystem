import React, { useEffect, useState } from "react";
import Sidebar from "./sidebar";
import { allStudentsData } from "./dummyStudents"; // Import data siswa
import { getClassAnalytics } from "../../services/atlApi";
import { getATLCategoryMeta, getScoreLevel, getSubjectMeta, hydrateLabelRegistry, normalizeATLCategory } from "../../services/labelRegistry";

const getSkillTone = (category) => {
  const meta = getATLCategoryMeta(category);
  return {
    text: meta.textClass || "text-stone-600",
    bar: meta.barClass || "from-stone-400 to-stone-600",
    dot: meta.dotClass || "bg-stone-500",
  };
};

const getSubjectTone = (subject = "") => getSubjectMeta(subject).chipClass || "text-violet-700 bg-violet-50 border-violet-200";

const detailCategoryConfig = [
  { label: "Thinking Skills", aliases: ["Thinking", "Thinking Skills"], icon: getATLCategoryMeta("Thinking Skills").icon },
  { label: "Research Skills", aliases: ["Research", "Research Skills"], icon: getATLCategoryMeta("Research Skills").icon },
  { label: "Communication Skills", aliases: ["Communication", "Communication Skills"], icon: getATLCategoryMeta("Communication Skills").icon },
  { label: "Social Skills", aliases: ["Social", "Social Skills", "Collaboration"], icon: getATLCategoryMeta("Social Skills").icon },
  { label: "Self-Management Skills", aliases: ["Self-management", "Self-Management", "Self-Management Skills"], icon: getATLCategoryMeta("Self-Management Skills").icon },
];

const ratingScoreMap = {
  "Exceeding Expectation": 90,
  "Meeting Expectation": 70,
  "Developing Expectation": 50,
  "Progressing Toward Expectation": 30,
  "Need Further Improvement": 10,
  "Need Improvement": 10,
};

const parsePercent = (value) => {
  const parsed = Number(String(value ?? "").replace("%", ""));
  return Number.isFinite(parsed) ? parsed : 0;
};

const readLocalATLData = () => {
  try {
    return JSON.parse(localStorage.getItem("atl_framework_data") || "{}");
  } catch (error) {
    return {};
  }
};

const buildATLDetailRows = (student) => {
  const scores = student?.categoryScores || [];
  const atlData = readLocalATLData();
  const studentAssessments = atlData.savedAssessments?.[String(student?.id)] || {};
  return detailCategoryConfig.map((config) => {
    const matched = scores.find((item) => config.aliases.includes(item.category));
    const strengthScore = config.aliases.includes(student?.strength) ? parsePercent(student?.strengthValue) : 0;
    const focusScore = config.aliases.includes(student?.focus) ? parsePercent(student?.focusValue) : 0;
    const score = matched?.score ?? (strengthScore || focusScore || 0);
    const sources = [];
    Object.entries(studentAssessments).forEach(([topicId, ratings]) => {
      const criteria = atlData[topicId] || [];
      Object.keys(ratings || {}).forEach((ratingKey) => {
        const criterion = criteria.find((item) => ratingKey.includes(`_${item.kriteria}_`));
        const subskill = (criterion?.atl || []).find((item) => ratingKey.endsWith(`_${item}`));
        const category = normalizeATLCategory((criterion?.atlCategories || [])[0] || subskill);
        if (!subskill || !config.aliases.includes(category)) return;
        sources.push({
          subskill,
          criterion: criterion?.kriteria,
          topic: topicId.replace(/_/g, " "),
        });
      });
    });
    const sourceText = sources.length
      ? `Nilai ${score} diambil dari ${sources.length} indikator softskill, seperti ${sources.slice(0, 2).map((source) => `${source.subskill} pada subtopik ${source.topic}`).join(" dan ")}.`
      : `Nilai ${score} diambil dari ringkasan softskill ${config.label} yang tersedia pada data siswa.`;
    return {
      ...config,
      score: Number(score || 0),
      sources,
      sourceText,
      tone: getSkillTone(config.label),
    };
  });
};

const buildTopicDetailRows = (student) => {
  if (Array.isArray(student?.topicDetails) && student.topicDetails.length > 0) return student.topicDetails;
  const atlData = readLocalATLData();
  const studentAssessments = atlData.savedAssessments?.[String(student?.id)] || {};
  return Object.entries(studentAssessments).map(([topicId, ratings]) => {
    const values = Object.values(ratings || {}).map((label) => ratingScoreMap[label]).filter(Boolean);
    const score = values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : 0;
    return {
      topicId,
      subject: topicId.split("_")[0]?.toUpperCase() || "Subject",
      topic: topicId.replace(/_/g, " "),
      score,
      assessedItems: values.length,
      level: score > 0 ? getScoreLevel(score).label : "No Data",
    };
  });
};

const noDataLevel = {
  label: "No Data",
  color: "#a8a29e",
  badgeClass: "bg-stone-100 text-stone-500",
  count: 0,
};

const buildEmptyClassAnalytics = (className) => {
  const students = (allStudentsData[className] || []).map((student) => ({
    ...student,
    assessedTopics: 0,
    overallScore: null,
    overall: "-",
    level: noDataLevel,
    strength: "-",
    strengthValue: "-",
    focus: "-",
    focusValue: "-",
    trendValue: "-",
    categoryScores: [],
  }));
  return {
    students,
    assessedCount: 0,
    totalStudents: students.length,
    average: 0,
    averageLevel: noDataLevel,
    distribution: [
      { key: "excellent", label: "Excellent", color: "#10b981", badgeClass: "bg-emerald-100 text-emerald-700", range: "85-100", count: 0 },
      { key: "good", label: "Good", color: "#3b82f6", badgeClass: "bg-blue-100 text-blue-700", range: "70-84", count: 0 },
      { key: "average", label: "Average", color: "#f59e0b", badgeClass: "bg-amber-100 text-amber-700", range: "50-69", count: 0 },
      { key: "low", label: "Low", color: "#f97316", badgeClass: "bg-orange-100 text-orange-700", range: "30-49", count: 0 },
      { key: "critical", label: "Critical", color: "#ef4444", badgeClass: "bg-red-100 text-red-700", range: "0-29", count: 0 },
    ],
    dominantCategory: noDataLevel,
    categoryAverages: [],
    topFocus: "-",
    completion: 0,
  };
};

export default function StudManage() {
  const currentUser = {
    name: "Joko Wiryanto",
    role: "Wali Kelas 3A",
  };

  const years = ["2024/2025", "2025/2026", "2026/2027"];
  const [selectedYear, setSelectedYear] = useState("2025/2026");
  const [selectedClassLabel, setSelectedClassLabel] = useState("3A - Primary"); // State untuk label kelas yang dipilih
  const [showClassInsight, setShowClassInsight] = useState(false);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [dataVersion, setDataVersion] = useState(0);
  const [classAnalytics, setClassAnalytics] = useState(() => buildEmptyClassAnalytics("3A - Primary"));
  const [expandedStudentId, setExpandedStudentId] = useState(null);
  const [detailTab, setDetailTab] = useState("atl");

  useEffect(() => {
    hydrateLabelRegistry().then(() => setDataVersion((version) => version + 1));
  }, []);

  useEffect(() => {
    const syncData = () => {
      setDataVersion((version) => version + 1);
    };
    syncData();
    window.addEventListener("focus", syncData);
    window.addEventListener("storage", syncData);
    window.addEventListener("atl-data-updated", syncData);
    return () => {
      window.removeEventListener("focus", syncData);
      window.removeEventListener("storage", syncData);
      window.removeEventListener("atl-data-updated", syncData);
    };
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedClassLabel]);

  useEffect(() => {
    let cancelled = false;
    getClassAnalytics(selectedClassLabel).then((data) => {
      if (cancelled) return;
      setClassAnalytics(data || buildEmptyClassAnalytics(selectedClassLabel));
    });
    return () => {
      cancelled = true;
    };
  }, [selectedClassLabel, dataVersion]);

  const students = classAnalytics.students;
  const averageOverall = classAnalytics.average;
  const averageLevel = classAnalytics.averageLevel;
  const distribution = classAnalytics.distribution;
  const dominantCategory = classAnalytics.dominantCategory;
  const topFocus = classAnalytics.topFocus;

  const totalStudents = students.length;
  const assessedStudents = classAnalytics.assessedCount;
  const totalPages = Math.ceil(students.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentStudents = students.slice(startIndex, endIndex);
  const pieSegments = distribution
    .map((item, index, array) => {
      const start = array
        .slice(0, index)
        .reduce((total, current) => total + (assessedStudents ? (current.count / assessedStudents) * 100 : 0), 0);
      const end = start + (assessedStudents ? (item.count / assessedStudents) * 100 : 0);

      return `${item.color} ${start}% ${end}%`;
    })
    .join(", ");
  const pieChartStyle = {
    background: `conic-gradient(${pieSegments || "#e7e5e4 0% 100%"})`,
  };

  return (
    <div className="flex h-screen w-full overflow-hidden">
      {/* Sidebar */}
      <Sidebar active="students" user={currentUser} />

      <main className="relative flex flex-1 flex-col overflow-hidden bg-stone-50">
        <div className="flex-1 overflow-y-auto p-4 lg:p-8">
          <div className="mx-auto flex max-w-7xl flex-col gap-8">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <span className="px-2 py-0.5 rounded bg-primary/20 text-primary-hover text-[10px] font-bold uppercase tracking-widest">
                  Main Page / Student Management
                </span>
                <h1 className="mt-3 text-3xl font-black text-text-main-light lg:text-4xl">
                  Student Management
                </h1>
                <div className="mt-2 flex items-center gap-2">
                  <h2 className="text-xl font-bold text-primary">Kelas</h2>
                  <select
                    value={selectedClassLabel}
                    onChange={(e) => setSelectedClassLabel(e.target.value)}
                    className="rounded-xl border border-primary/20 bg-primary/5 px-3 py-1 text-lg font-bold text-primary outline-none focus:ring-2 focus:ring-primary/50"
                  >
                    {Object.keys(allStudentsData).map((classLabel) => (
                      <option key={classLabel} value={classLabel}>
                        {classLabel}
                      </option>
                    ))}
                  </select>
                </div>
                <p className="mt-3 max-w-2xl text-sm text-text-sub-light">
                  Kelola penilaian ATL siswa secara global dan pantau perkembangan mereka secara real time.
                </p>
              </div>
            </div>

            <div className="rounded-3xl border border-stone-200/90 bg-white p-6 shadow-[0_18px_40px_rgba(15,23,42,0.06)]">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-stone-500">Pengaturan Filter</p>
                  <h2 className="mt-2 text-xl font-bold text-stone-900">Pilih Tahun Ajaran</h2>
                </div>
                <div className="rounded-3xl bg-stone-50 p-4">
                  <p className="text-xs uppercase tracking-[0.22em] text-stone-500">Tahun Ajaran</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {years.map((year) => (
                      <button
                        key={year}
                        type="button"
                        onClick={() => setSelectedYear(year)}
                        className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                          selectedYear === year
                            ? "bg-primary text-white"
                            : "bg-white text-stone-700 ring-1 ring-stone-200 hover:border-primary/50"
                        }`}
                      >
                        {year}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-1">
              <div className="rounded-[2rem] bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 p-6 shadow-[0_18px_60px_rgba(15,23,42,0.18)]">
                <div className="flex min-h-[220px] flex-col gap-6 xl:flex-row xl:items-start xl:justify-between xl:gap-10">
                  <div className="min-w-0 xl:max-w-[55%]">
                    <p className="text-xs uppercase tracking-[0.24em] text-amber-300">Assigned Classes</p>
                    <h2 className="mt-3 text-5xl font-black text-white">Grade {selectedClassLabel}</h2>
                    <p className="mt-4 text-sm leading-7 text-slate-300">
                      Ruang kelas utama untuk penilaian ATL. Data berikut merepresentasikan ringkasan nilai ATL siswa yang sudah tersedia di tabel, sehingga fokus tetap pada performa ATL.
                    </p>
                  </div>

                  <div className="min-w-[260px] rounded-[2rem] border border-amber-300/20 bg-[#111317] p-6 shadow-[0_30px_60px_rgba(0,0,0,0.35)]">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-xs uppercase tracking-[0.24em] text-amber-300/80">Average Nilai ATL</p>
                        <p className="mt-5 text-5xl font-black text-white">{averageOverall}%</p>
                      </div>
                      <span className="h-12 w-12 rounded-full bg-amber-300/20 p-3 text-center text-2xl font-black text-amber-200 shadow-[0_10px_30px_rgba(245,158,11,0.22)]">
                        A
                      </span>
                    </div>
                    <div className="mt-5 h-1 w-full rounded-full bg-amber-300/20">
                      <div className="h-full rounded-full bg-gradient-to-r from-amber-300 via-amber-400 to-yellow-400" style={{ width: `${averageOverall}%` }} />
                    </div>
                    <p className="mt-4 text-sm text-slate-400">
                      {assessedStudents} dari {totalStudents} siswa sudah memiliki nilai tersimpan
                    </p>
                  </div>
                </div>

                <div className="mt-8 grid gap-4 sm:grid-cols-3">
                  <div className="rounded-[1.75rem] bg-white/10 p-5 backdrop-blur-sm ring-1 ring-white/10">
                    <p className="text-xs uppercase tracking-[0.22em] text-slate-300">Total Siswa</p>
                    <p className="mt-3 text-3xl font-black text-white">{totalStudents}</p>
                  </div>
                  <div className="rounded-[1.75rem] bg-white/10 p-5 backdrop-blur-sm ring-1 ring-white/10">
                    <p className="text-xs uppercase tracking-[0.22em] text-slate-300">Dominan Level ATL</p>
                    <p className="mt-3 text-3xl font-black text-white">{dominantCategory.label}</p>
                  </div>
                  <div className="rounded-[1.75rem] bg-white/10 p-5 backdrop-blur-sm ring-1 ring-white/10">
                    <p className="text-xs uppercase tracking-[0.22em] text-slate-300">Fokus Terbanyak</p>
                    <p className="mt-3 text-3xl font-black text-white">{topFocus}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-[1.8rem] border-2 border-stone-200/90 bg-white p-5 shadow-[0_18px_40px_rgba(15,23,42,0.06)]">
              <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <span className="text-xs uppercase tracking-[0.24em] text-stone-500">Daftar Siswa</span>
                  <h2 className="mt-2 text-2xl font-black text-stone-900">Kelola penilaian ATL siswa</h2>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <select
                    value={itemsPerPage}
                    onChange={(e) => {
                      setItemsPerPage(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                    className="rounded-2xl bg-stone-50 px-4 py-3 text-sm text-stone-600 ring-1 ring-stone-200"
                  >
                    <option value={5}>Tampilkan 5 per halaman</option>
                    <option value={10}>Tampilkan 10 per halaman</option>
                    <option value={15}>Tampilkan 15 per halaman</option>
                  </select>
                  <button className="rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm font-semibold text-stone-700 transition hover:border-primary/50 hover:text-primary">
                    Reset Filter
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowClassInsight((current) => !current)}
                    className="rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm font-semibold text-primary transition hover:border-primary/50 hover:bg-primary/10"
                  >
                    {showClassInsight ? "Sembunyikan Insight Kelas" : "Insight Kelas"}
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-stone-200">
                  <thead className="bg-stone-100">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-[0.18em] text-stone-500">No</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-[0.18em] text-stone-500">Siswa</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-[0.18em] text-stone-500">Overall ATL</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-[0.18em] text-stone-500">Strength</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-[0.18em] text-stone-500">Focus Area</th>
                      <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-[0.18em] text-stone-500">Trend</th>
                      <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-[0.18em] text-stone-500">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-200 bg-white">
                    {currentStudents.map((student, index) => {
                      const isExpanded = expandedStudentId === student.id;
                      const atlRows = buildATLDetailRows(student);
                      const topicRows = buildTopicDetailRows(student);
                      return (
                        <React.Fragment key={student.id}>
                          <tr className={`group transition-colors ${isExpanded ? "bg-primary/5" : "hover:bg-primary/5"}`}>
                            <td className="px-6 py-4 text-sm font-semibold text-stone-900">{String(startIndex + index + 1).padStart(2, "0")}</td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center gap-4">
                                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${student.avatarTone} text-xs font-bold text-stone-900 shadow-sm`}>
                                  {student.initials}
                                </div>
                                <div>
                                  <div className="text-sm font-semibold text-stone-900">{student.name}</div>
                                  <div className="text-xs text-stone-500">{student.nis}</div>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-stone-900">
                              <div className="flex items-center gap-2">
                                <span>{student.overall}</span>
                                <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${student.overallScore === null ? "bg-stone-100 text-stone-500" : student.level.badgeClass}`}>
                                  {student.overallScore === null ? "No Data" : student.level.label}
                                </span>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-stone-900">
                              <div className="flex items-center gap-2">
                                <span className="inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500"></span>
                                <div>{student.strength}</div>
                              </div>
                              <div className="text-xs text-stone-500">{student.strengthValue}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-stone-600">
                              <div className="flex items-center gap-2">
                                <span className="inline-flex h-2.5 w-2.5 rounded-full bg-red-500"></span>
                                {student.focus}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-semibold text-emerald-600">{student.trendValue}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                              <button
                                type="button"
                                onClick={() => {
                                  setExpandedStudentId(isExpanded ? null : student.id);
                                  setDetailTab("atl");
                                }}
                                className={`rounded-2xl px-4 py-2 text-xs font-bold shadow-md transition-all duration-300 hover:-translate-y-0.5 active:scale-95 ${
                                  isExpanded
                                    ? "bg-stone-900 text-white shadow-stone-900/15"
                                    : "bg-primary text-white shadow-primary/20 hover:bg-secondary"
                                }`}
                              >
                                {isExpanded ? "Tutup" : "Detail"}
                              </button>
                            </td>
                          </tr>

                          {isExpanded && (
                            <tr className="bg-primary/5">
                              <td colSpan={7} className="px-6 pb-6 pt-0">
                                <div className="overflow-hidden rounded-[1.5rem] border border-primary/20 bg-white shadow-[0_16px_40px_rgba(15,23,42,0.08)]">
                                  <div className="flex flex-col gap-4 border-b border-stone-200 bg-gradient-to-r from-amber-50 via-white to-stone-50 p-5 lg:flex-row lg:items-center lg:justify-between">
                                    <div className="flex min-w-0 items-center gap-4">
                                      <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${student.avatarTone} text-sm font-black text-stone-950 shadow-sm`}>
                                        {student.initials}
                                      </div>
                                      <div className="min-w-0">
                                        <p className="truncate text-lg font-black text-stone-950">{student.name}</p>
                                        <p className="mt-1 text-xs font-semibold text-stone-500">{student.nis} - {selectedClassLabel}</p>
                                      </div>
                                    </div>
                                    <div className="grid grid-cols-3 gap-2 lg:min-w-[320px]">
                                      <div className="rounded-2xl bg-white px-4 py-3 ring-1 ring-stone-200">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-stone-400">Overall</p>
                                            <p className="mt-1 text-xl font-black text-stone-950">{student.overallScore ?? "-"}</p>
                                      </div>
                                      <div className="rounded-2xl bg-white px-4 py-3 ring-1 ring-stone-200">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-stone-400">Level</p>
                                        <p className="mt-1 text-xs font-black text-stone-900">{student.level?.label || "No Data"}</p>
                                      </div>
                                      <div className="rounded-2xl bg-white px-4 py-3 ring-1 ring-stone-200">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-stone-400">Topik</p>
                                        <p className="mt-1 text-xl font-black text-stone-950">{student.assessedTopics || topicRows.length || 0}</p>
                                      </div>
                                    </div>
                                  </div>

                                  <div className="p-5">
                                    <div className="mb-5 inline-grid grid-cols-2 gap-1 rounded-2xl bg-stone-100 p-1">
                                      <button
                                        type="button"
                                        onClick={() => setDetailTab("atl")}
                                        className={`rounded-xl px-5 py-2.5 text-xs font-black transition ${detailTab === "atl" ? "bg-primary text-white shadow-md shadow-primary/20" : "text-stone-500 hover:bg-white"}`}
                                      >
                                        Nilai 5 ATL
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setDetailTab("topic")}
                                        className={`rounded-xl px-5 py-2.5 text-xs font-black transition ${detailTab === "topic" ? "bg-primary text-white shadow-md shadow-primary/20" : "text-stone-500 hover:bg-white"}`}
                                      >
                                        Mapel & Topik
                                      </button>
                                    </div>

                                    {detailTab === "atl" ? (
                                      <div className="grid gap-3 lg:grid-cols-5">
                                        {atlRows.map((row) => (
                                          <div key={row.label} className="rounded-2xl border-2 border-stone-200 bg-gradient-to-br from-white via-stone-50 to-stone-100 p-4 shadow-[0_14px_30px_rgba(15,23,42,0.08)] transition-all hover:-translate-y-1 hover:border-primary/35 hover:shadow-[0_18px_36px_rgba(234,179,8,0.16)]">
                                            <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${row.tone.bar} text-white shadow-md`}>
                                              <span className="material-symbols-outlined text-[20px]">{row.icon}</span>
                                            </div>
                                            <p className="min-h-[34px] text-xs font-black leading-4 text-stone-900">{row.label}</p>
                                            <div className="mt-3 flex items-center justify-between">
                                              <span className={`text-2xl font-black ${row.tone.text}`}>{row.score}</span>
                                              <span className="text-[10px] font-black uppercase tracking-widest text-stone-400">Score</span>
                                            </div>
                                            <div className="mt-2 h-2 rounded-full bg-white">
                                              <div className={`h-full rounded-full bg-gradient-to-r ${row.tone.bar}`} style={{ width: `${Math.min(row.score, 100)}%` }} />
                                            </div>
                                            <p className="mt-3 text-[11px] font-semibold leading-4 text-stone-500">
                                              {row.sourceText}
                                            </p>
                                          </div>
                                        ))}
                                      </div>
                                    ) : (
                                      <div className="grid gap-3 lg:grid-cols-3">
                                        {topicRows.length > 0 ? (
                                          topicRows.map((row) => (
                                            <div key={row.topicId} className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
                                              <div className="flex items-start justify-between gap-3">
                                                <div className="min-w-0">
                                                  <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-widest ${getSubjectTone(row.subject)}`}>
                                                    {row.subject}
                                                  </span>
                                                  <h4 className="mt-1 truncate text-sm font-black capitalize text-stone-950">{row.topic}</h4>
                                                  <p className="mt-2 text-xs font-semibold text-stone-500">{row.assessedItems || 0} indikator ternilai</p>
                                                </div>
                                                <div className="text-right">
                                                  <p className="text-[10px] font-black uppercase tracking-widest text-stone-400">Nilai</p>
                                                  <p className="text-2xl font-black text-stone-950">{row.score ?? 0}</p>
                                                  <span className="mt-1 inline-flex rounded-full bg-primary/10 px-2 py-1 text-[10px] font-black text-primary">
                                                    {typeof row.level === "string" ? row.level : row.level?.label || "No Data"}
                                                  </span>
                                                </div>
                                              </div>
                                              <div className="mt-4 h-2 rounded-full bg-white">
                                                <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(Number(row.score || 0), 100)}%` }} />
                                              </div>
                                            </div>
                                          ))
                                        ) : (
                                          <div className="rounded-2xl border border-dashed border-stone-300 bg-stone-50 p-6 text-center lg:col-span-3">
                                            <span className="material-symbols-outlined text-4xl text-stone-300">folder_off</span>
                                            <p className="mt-3 text-sm font-bold text-stone-600">Belum ada detail topik tersimpan untuk siswa ini.</p>
                                            <p className="mt-1 text-xs font-semibold text-stone-400">Input nilai dari detailed atau batch agar data per mapel/topik muncul di sini.</p>
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="mt-6 flex items-center justify-between">
                <div className="text-sm text-stone-500">
                  Menampilkan {startIndex + 1} sampai {Math.min(endIndex, students.length)} dari {students.length} siswa
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className="rounded-2xl border border-stone-200 bg-white px-3 py-2 text-sm font-semibold text-stone-700 transition hover:border-primary/50 hover:text-primary disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    const page = i + 1;
                    return (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        className={`rounded-2xl px-3 py-2 text-sm font-semibold transition ${
                          currentPage === page
                            ? "bg-primary text-white"
                            : "border border-stone-200 bg-white text-stone-700 hover:border-primary/50 hover:text-primary"
                        }`}
                      >
                        {page}
                      </button>
                    );
                  })}
                  <button
                    onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
                    className="rounded-2xl border border-stone-200 bg-white px-3 py-2 text-sm font-semibold text-stone-700 transition hover:border-primary/50 hover:text-primary disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>

            {showClassInsight && (
              <div className="rounded-[1.8rem] border-2 border-stone-200/90 bg-white p-5 shadow-[0_18px_40px_rgba(15,23,42,0.06)]">
                <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                  <div>
                    <span className="text-xs uppercase tracking-[0.24em] text-stone-500">Insight Kelas</span>
                    <h2 className="mt-2 text-2xl font-black text-stone-900">
                      Ringkasan ATL {selectedClassLabel}
                    </h2>
                    <p className="mt-2 text-sm text-stone-500">Distribusi overall ATL siswa untuk tahun ajaran {selectedYear}.</p>
                  </div>
                  <span className="inline-flex rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                    {totalStudents} siswa
                  </span>
                </div>

                <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
                  <div className="rounded-3xl border border-stone-200 bg-stone-50 p-5">
                    <div className="grid gap-4 sm:grid-cols-3">
                      <div className="rounded-2xl bg-white p-4 ring-1 ring-stone-200">
                        <p className="text-xs uppercase tracking-[0.22em] text-stone-500">Rata-rata ATL</p>
                        <p className="mt-2 text-3xl font-black text-stone-900">{averageOverall}%</p>
                        <span className={`mt-3 inline-flex rounded-full px-3 py-1 text-xs font-semibold ${averageLevel.badgeClass}`}>
                          {averageLevel.label}
                        </span>
                      </div>
                      <div className="rounded-2xl bg-white p-4 ring-1 ring-stone-200">
                        <p className="text-xs uppercase tracking-[0.22em] text-stone-500">Kategori Dominan</p>
                        <p className="mt-2 text-lg font-black text-stone-900">
                          {dominantCategory.label}
                        </p>
                        <p className="mt-2 text-sm text-stone-500">
                          {dominantCategory.count || 0} siswa
                        </p>
                      </div>
                      <div className="rounded-2xl bg-white p-4 ring-1 ring-stone-200">
                        <p className="text-xs uppercase tracking-[0.22em] text-stone-500">Tahun Ajaran</p>
                        <p className="mt-2 text-lg font-black text-stone-900">{selectedYear}</p>
                        <p className="mt-2 text-sm text-stone-500">{selectedClassLabel}</p>
                      </div>
                    </div>

                    <div className="mt-5 rounded-2xl bg-white p-5 ring-1 ring-stone-200">
                      <h3 className="text-lg font-bold text-stone-900">Distribusi ATL Skills</h3>
                      <div className="mt-5 space-y-4">
                        {classAnalytics.categoryAverages.length > 0 ? (
                          classAnalytics.categoryAverages.map((item) => {
                            const tone = getSkillTone(item.category);
                            return (
                              <div key={item.category}>
                                <div className="mb-2 flex items-center justify-between">
                                  <span className="text-sm font-semibold text-stone-700">{item.category}</span>
                                  <span className={`text-sm font-bold ${tone.text}`}>{item.score}%</span>
                                </div>
                                <div className="h-2 rounded-full bg-stone-200">
                                  <div
                                    className={`h-full rounded-full bg-gradient-to-r ${tone.bar}`}
                                    style={{ width: `${item.score}%` }}
                                  />
                                </div>
                              </div>
                            );
                          })
                        ) : (
                          <div className="rounded-2xl border border-dashed border-stone-300 bg-stone-50 p-5 text-sm text-stone-500">
                            Belum ada nilai ATL tersimpan untuk kelas ini.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-3xl border border-stone-200 bg-stone-50 p-5">
                    <h3 className="text-lg font-bold text-stone-900">Distribusi Level ATL Kelas</h3>
                    <div className="mt-6 flex flex-col items-center gap-6">
                      <div className="relative flex h-52 w-52 items-center justify-center rounded-full" style={pieChartStyle}>
                        <div className="flex h-28 w-28 flex-col items-center justify-center rounded-full bg-white shadow-inner">
                          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-500">Rata-rata</span>
                          <span className="mt-1 text-3xl font-black text-stone-900">{averageOverall}%</span>
                        </div>
                      </div>

                      <div className="w-full space-y-3">
                        {distribution.map((item) => {
                          const percentage = assessedStudents ? Math.round((item.count / assessedStudents) * 100) : 0;

                          return (
                            <div key={item.key} className="flex items-start justify-between gap-3 rounded-2xl bg-white px-4 py-3 ring-1 ring-stone-200">
                              <div className="flex items-start gap-3">
                                <span className="mt-1 inline-flex h-3 w-3 rounded-full" style={{ backgroundColor: item.color }}></span>
                                <div>
                                  <p className="text-sm font-semibold text-stone-900">
                                    {item.label} ({item.range})
                                  </p>
                                  <p className="text-xs text-stone-500">{item.count} siswa</p>
                                </div>
                              </div>
                              <span className="text-sm font-bold text-stone-700">{percentage}%</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>
      </main>
    </div>
  );
}

import React, { useEffect, useState } from "react";
import Sidebar from "./sidebar";
import { exportReportExcel, getClassAnalytics, getClasses } from "../../services/atlApi";
import { getATLCategoryMeta, getScoreDistributionConfig, getScoreLevel, getSubjectMeta, hydrateLabelRegistry, normalizeATLCategory, normalizeScoreBand } from "../../services/labelRegistry";

const getSkillTone = (category) => {
  const meta = getATLCategoryMeta(category);
  return {
    text: meta.textClass || "text-stone-600",
    bar: meta.barClass || "from-stone-400 to-stone-600",
    dot: meta.dotClass || "bg-stone-500",
  };
};

const getSubjectVisual = (subject = "") => {
  const meta = getSubjectMeta(subject);
  const lower = String(subject || "").toLowerCase();
  const fallback = lower.includes("ipa")
    ? { icon: "science", color: "#16A34A", label: "IPA (Sains)" }
    : lower.includes("math")
      ? { icon: "calculate", color: "#2563EB", label: "Math" }
      : lower.includes("sing")
        ? { icon: "music_note", color: "#DC2626", label: "Singing" }
        : { icon: "auto_stories", color: "#F59E0B", label: subject || "Subject" };
  return {
    icon: meta.icon || fallback.icon,
    color: meta.color || fallback.color,
    label: meta.label || fallback.label,
  };
};

const FormulaHint = ({ text }) => (
  <span className="group relative inline-flex">
    <span className="material-symbols-outlined cursor-help text-[16px] text-stone-400 transition group-hover:text-primary">info</span>
    <span className="pointer-events-none absolute left-1/2 top-full z-30 mt-2 hidden w-72 -translate-x-1/2 rounded-xl border border-stone-200 bg-white p-3 text-[11px] font-semibold leading-5 text-stone-700 shadow-xl group-hover:block">
      {text}
    </span>
  </span>
);

const HeroTooltip = ({ children, text, className = "" }) => (
  <div className={`group relative min-w-0 cursor-help ${className}`}>
    {children}
    <span className="pointer-events-none absolute left-0 top-full z-40 mt-2 hidden w-72 rounded-2xl border border-white/10 bg-slate-950/95 p-3 text-[11px] font-semibold leading-5 text-slate-200 shadow-2xl ring-1 ring-amber-300/20 group-hover:block">
      {text}
    </span>
  </div>
);

const detailCategoryConfig = [
  { label: "Thinking Skills", aliases: ["Thinking", "Thinking Skills"], icon: getATLCategoryMeta("Thinking Skills").icon },
  { label: "Research Skills", aliases: ["Research", "Research Skills"], icon: getATLCategoryMeta("Research Skills").icon },
  { label: "Communication Skills", aliases: ["Communication", "Communication Skills"], icon: getATLCategoryMeta("Communication Skills").icon },
  { label: "Social Skills", aliases: ["Social", "Social Skills", "Collaboration"], icon: getATLCategoryMeta("Social Skills").icon },
  { label: "Self-Management Skills", aliases: ["Self-management", "Self-Management", "Self-Management Skills"], icon: getATLCategoryMeta("Self-Management Skills").icon },
];

const parsePercent = (value) => {
  const parsed = Number(String(value ?? "").replace("%", ""));
  return Number.isFinite(parsed) ? parsed : 0;
};

const buildATLDetailRows = (student) => {
  const scores = student?.categoryScores || [];
  return detailCategoryConfig.map((config) => {
    const matched = scores.find((item) => config.aliases.includes(normalizeATLCategory(item.category)));
    const strengthScore = config.aliases.includes(student?.strength) ? parsePercent(student?.strengthValue) : 0;
    const focusScore = config.aliases.includes(student?.focus) ? parsePercent(student?.focusValue) : 0;
    const score = matched?.score ?? (strengthScore || focusScore || 0);
    const sourceText = score > 0
      ? `Nilai ${score} diambil dari ringkasan backend untuk kategori ${config.label}.`
      : `Belum ada nilai backend untuk kategori ${config.label}.`;
    return {
      ...config,
      score: Number(score || 0),
      sources: [],
      sourceText,
      tone: getSkillTone(config.label),
    };
  });
};

const buildTopicDetailRows = (student) => {
  if (Array.isArray(student?.topicDetails) && student.topicDetails.length > 0) {
    return student.topicDetails.map((row) => ({
      ...row,
      subject: row.subject || row.subjectName || "-",
      topic: row.subTopic || row.topic || row.topicLabel || "-",
      score: Number(row.score ?? row.rawScore ?? 0),
      assessedCriteria: Number(row.assessedCriteria ?? row.assessedItems ?? 0),
      totalCriteria: Number(row.totalCriteria ?? row.totalItems ?? 0),
      weightedSubskillRows: Number(row.weightedSubskillRows ?? row.calculationRows?.length ?? row.assessedItems ?? 0),
    }));
  }
  return [];
};

const noDataLevel = {
  label: "No Data",
  color: "#a8a29e",
  badgeClass: "bg-stone-100 text-stone-500",
  count: 0,
};

const STUDENT_MANAGE_CACHE_KEY = "atl_student_manage_cache_v1";
const STUDENT_MANAGE_DIRTY_KEY = "atl_report_data_dirty_at";
const STUDENT_MANAGE_CACHE_VERSION = 1;
const DEFAULT_STUDENT_MANAGE_FILTER = {
  className: "3A - Primary",
  perPage: 10,
};

const scoreRangeByLabel = {
  EE: "85-100",
  ME: "70-84",
  DE: "50-69",
  PTE: "30-49",
  NFI: "0-29",
};

const scoreFullLabelByCode = {
  EE: "Exceeding Expectation",
  ME: "Meeting Expectation",
  DE: "Developing Expectation",
  PTE: "Progressing Toward Expectation",
  NFI: "Need Further Improvement",
};

const buildEmptyScoreDistribution = () => (
  getScoreDistributionConfig(false).map((item) => ({
    key: String(item.key || item.label).toLowerCase(),
    label: item.label,
    fullLabel: item.fullLabel || scoreFullLabelByCode[item.label] || item.description || item.label,
    color: item.color,
    badgeClass: item.badgeClass,
    range: scoreRangeByLabel[item.label] || "-",
    count: 0,
  }))
);

const scoreDisplayName = (level) => (
  level?.fullLabel || scoreFullLabelByCode[level?.label] || level?.description || level?.label || "No Data"
);

const getLevelRange = (level) => scoreRangeByLabel[level?.label] || "0-100";

const number2 = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed.toFixed(2) : "0.00";
};

const buildEmptyClassAnalytics = () => {
  const students = [];
  return {
    students,
    assessedCount: 0,
    totalStudents: students.length,
    average: 0,
    averageLevel: noDataLevel,
    distribution: buildEmptyScoreDistribution(),
    dominantCategory: noDataLevel,
    categoryAverages: [],
    topFocus: "-",
    completion: 0,
  };
};

const CalculationDetailPanel = ({ detail, onClose }) => {
  if (!detail) return null;
  const rows = detail.row.calculationRows || [];
  const levelColor = detail.level.color || "#F59E0B";
  const assessedCriteria = detail.row.assessedCriteria || detail.row.assessedItems || 0;
  const weightedSubskillRows = detail.row.weightedSubskillRows || rows.length || 0;

  return (
    <div className="mt-3 overflow-hidden rounded-[1.25rem] border border-primary/25 bg-white shadow-[0_18px_42px_rgba(15,23,42,0.08)]">
      <div className="flex flex-col gap-3 border-b border-stone-200 bg-gradient-to-r from-amber-50 via-white to-stone-50 px-5 py-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-amber-600">Detail Perhitungan</p>
          <h3 className="mt-1 truncate text-xl font-black text-stone-950">{detail.row.topic}</h3>
          <p className="mt-1 text-xs font-semibold text-stone-500">
            {detail.student.name} - {detail.row.subject} - {assessedCriteria} kriteria ternilai - {weightedSubskillRows} baris subskill pembobotan
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs font-black text-stone-600 transition hover:border-primary/40 hover:text-primary"
          aria-label="Tutup detail perhitungan"
        >
          <span className="material-symbols-outlined text-[16px]">keyboard_arrow_up</span>
          Tutup
        </button>
      </div>

      <div className="p-4">
        <div className="overflow-hidden rounded-2xl border border-stone-200">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px]">
              <thead className="bg-stone-50">
                <tr>
                  {["Criterion", "Kategori ATL", "Subskill", "Rating", "Score", "Weight", "Score x Weight"].map((header) => (
                    <th key={header} className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-[0.18em] text-stone-500">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 bg-white">
                {rows.length > 0 ? rows.map((item, index) => {
                  const rowLevel = getScoreLevel(Number(item.score || 0));
                  const rowColor = rowLevel.color || "#F59E0B";
                  const ratingCode = normalizeScoreBand(item.rating) || rowLevel.label || "-";
                  const repeatsCriterion = index > 0 && rows[index - 1]?.criterion === item.criterion;
                  const categoryMeta = getATLCategoryMeta(item.category);
                  return (
                    <tr key={`${item.criterion}-${item.subskill}-${index}`} className="hover:bg-primary/5">
                      <td className="px-4 py-3 text-sm font-bold leading-5 text-stone-800">
                        {repeatsCriterion ? <span className="text-stone-300">same</span> : item.criterion}
                      </td>
                      <td className="px-4 py-3 text-sm font-bold leading-5 text-stone-700">
                        {repeatsCriterion ? (
                          <span className="text-stone-300">same</span>
                        ) : (
                          <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-black ${categoryMeta.chipClass || "border-stone-200 bg-stone-50 text-stone-700"}`}>
                            <span className="material-symbols-outlined text-[14px]">{categoryMeta.icon || "category"}</span>
                            {categoryMeta.label || normalizeATLCategory(item.category) || "-"}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm font-bold leading-5 text-stone-700">{item.subskill}</td>
                      <td className="px-4 py-3">
                        <span
                          className="inline-flex rounded-full px-3 py-1 text-xs font-black"
                          style={{ backgroundColor: `${rowColor}14`, color: rowColor }}
                        >
                          {ratingCode}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm font-black text-stone-900">{number2(item.score)}</td>
                      <td className="px-4 py-3 text-sm font-black text-stone-900">{number2(item.weight)}</td>
                      <td className="px-4 py-3 text-sm font-black text-stone-950">{number2(item.weightedScore)}</td>
                    </tr>
                  );
                }) : (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-sm font-bold text-stone-500">
                      Detail perhitungan belum tersedia. Tekan Update Data setelah nilai disimpan.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_230px]">
          <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white">
            <table className="w-full">
              <thead className="bg-stone-50">
                <tr>
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-[0.18em] text-stone-500">Calculation</th>
                  <th className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-[0.18em] text-stone-500">Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {[
                  ["Weighted Total", number2(detail.row.weightedTotal)],
                  ["Total Weight", number2(detail.row.totalWeight)],
                  ["Final Score", `${number2(detail.row.weightedTotal)} / ${number2(detail.row.totalWeight)} = ${number2(detail.row.score)}`],
                ].map(([label, value]) => (
                  <tr key={label}>
                    <td className="px-4 py-3 text-sm font-black text-stone-700">{label}</td>
                    <td className="px-4 py-3 text-right text-sm font-black text-stone-950">{value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 text-center">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-stone-500">Predicate</p>
            <span
              className="mt-4 inline-flex h-16 min-w-16 items-center justify-center rounded-full px-4 text-2xl font-black"
              style={{ backgroundColor: `${levelColor}14`, color: levelColor }}
            >
              {detail.level.label}
            </span>
            <p className="mt-3 text-sm font-black text-stone-950">{scoreDisplayName(detail.level)}</p>
            <p className="mt-1 text-xs font-semibold text-stone-500">{getLevelRange(detail.level)}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

const emptyStudentManageCache = () => ({
  version: STUDENT_MANAGE_CACHE_VERSION,
  catalog: { classes: [], updatedAt: "" },
  snapshots: {},
  lastFilter: DEFAULT_STUDENT_MANAGE_FILTER,
});

const studentManageSnapshotKey = (className) => className || "class";

const readStudentManageCache = () => {
  try {
    const parsed = JSON.parse(localStorage.getItem(STUDENT_MANAGE_CACHE_KEY) || "null");
    if (!parsed || parsed.version !== STUDENT_MANAGE_CACHE_VERSION) return emptyStudentManageCache();
    return {
      ...emptyStudentManageCache(),
      ...parsed,
      catalog: { ...emptyStudentManageCache().catalog, ...(parsed.catalog || {}) },
      snapshots: parsed.snapshots || {},
      lastFilter: { ...DEFAULT_STUDENT_MANAGE_FILTER, ...(parsed.lastFilter || {}) },
    };
  } catch {
    return emptyStudentManageCache();
  }
};

const writeStudentManageCache = (cache) => {
  localStorage.setItem(STUDENT_MANAGE_CACHE_KEY, JSON.stringify(cache));
};

const readInitialStudentManageState = () => {
  const cache = readStudentManageCache();
  const filter = { ...DEFAULT_STUDENT_MANAGE_FILTER, ...(cache.lastFilter || {}), perPage: DEFAULT_STUDENT_MANAGE_FILTER.perPage };
  const snapshot = cache.snapshots[studentManageSnapshotKey(filter.className)] || null;
  const dirtyAt = localStorage.getItem(STUDENT_MANAGE_DIRTY_KEY) || "";
  return {
    cache,
    filter,
    snapshot,
    isDirty: Boolean(dirtyAt && (!snapshot?.updatedAt || dirtyAt > snapshot.updatedAt)),
  };
};

const formatSnapshotTime = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("id-ID");
};

const safeFilePart = (value) => (
  String(value || "")
    .trim()
    .replace(/[^a-z0-9]+/gi, "_")
    .replace(/^_+|_+$/g, "") || "data"
);

export default function StudManage() {
  const [initialState] = useState(readInitialStudentManageState);
  const [selectedClassLabel, setSelectedClassLabel] = useState(initialState.filter.className);
  const [showClassInsight, setShowClassInsight] = useState(false);
  const [itemsPerPage, setItemsPerPage] = useState(initialState.filter.perPage || 15);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [levelFilter, setLevelFilter] = useState("all");
  const [strengthFilter, setStrengthFilter] = useState("all");
  const [focusFilter, setFocusFilter] = useState("all");
  const [classAnalytics, setClassAnalytics] = useState(() => initialState.snapshot?.analytics || buildEmptyClassAnalytics());
  const [classOptions, setClassOptions] = useState(initialState.cache.catalog.classes || []);
  const [backendError, setBackendError] = useState("");
  const [expandedStudentId, setExpandedStudentId] = useState(null);
  const [detailTab, setDetailTab] = useState("atl");
  const [snapshotUpdatedAt, setSnapshotUpdatedAt] = useState(initialState.snapshot?.updatedAt || "");
  const [isUpdating, setIsUpdating] = useState(false);
  const [hasNewData, setHasNewData] = useState(initialState.isDirty);
  const [updateError, setUpdateError] = useState("");
  const [showAllAssessedTopics, setShowAllAssessedTopics] = useState(false);
  const [calculationDetail, setCalculationDetail] = useState(null);
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [showExcelPreview, setShowExcelPreview] = useState(false);
  const [excelPreviewRows, setExcelPreviewRows] = useState([]);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");

  useEffect(() => {
    hydrateLabelRegistry();
    getClasses()
      .then((classes) => {
        const labels = classes.map((item) => item.displayName || item.display_name || item.code).filter(Boolean);
        setClassOptions(labels);
        if (labels.length > 0 && !labels.includes(selectedClassLabel)) setSelectedClassLabel(labels[0]);
        const cache = readStudentManageCache();
        writeStudentManageCache({
          ...cache,
          catalog: { classes: labels, updatedAt: new Date().toISOString() },
          lastFilter: { className: selectedClassLabel, perPage: itemsPerPage },
        });
        setBackendError("");
      })
      .catch((error) => {
        setClassOptions((current) => current);
        setBackendError(error.message || "Gagal mengambil daftar kelas dari backend.");
      });
  }, []);

  useEffect(() => {
    setCurrentPage(1);
    setExpandedStudentId(null);
    setShowAllAssessedTopics(false);
    const cache = readStudentManageCache();
    const snapshot = cache.snapshots[studentManageSnapshotKey(selectedClassLabel)] || null;
    const dirtyAt = localStorage.getItem(STUDENT_MANAGE_DIRTY_KEY) || "";
    setClassAnalytics(snapshot?.analytics || buildEmptyClassAnalytics());
    setSnapshotUpdatedAt(snapshot?.updatedAt || "");
    setHasNewData(Boolean(dirtyAt && (!snapshot?.updatedAt || dirtyAt > snapshot.updatedAt)));
    setUpdateError("");
    writeStudentManageCache({
      ...cache,
      lastFilter: { className: selectedClassLabel, perPage: itemsPerPage },
    });
  }, [selectedClassLabel]);

  useEffect(() => {
    const cache = readStudentManageCache();
    writeStudentManageCache({
      ...cache,
      lastFilter: { className: selectedClassLabel, perPage: itemsPerPage },
    });
  }, [itemsPerPage, selectedClassLabel]);

  useEffect(() => {
    setCurrentPage(1);
    setExpandedStudentId(null);
    setCalculationDetail(null);
  }, [searchText, statusFilter, levelFilter, strengthFilter, focusFilter, itemsPerPage]);

  const handleUpdateData = async () => {
    if (!selectedClassLabel || isUpdating) return;
    setIsUpdating(true);
    setUpdateError("");
    try {
      const [classesResult, analyticsResult] = await Promise.allSettled([
        getClasses(),
        getClassAnalytics(selectedClassLabel),
      ]);
      const cache = readStudentManageCache();
      const nextCatalog = { ...(cache.catalog || {}) };
      if (classesResult.status === "fulfilled") {
        const labels = classesResult.value.map((item) => item.displayName || item.display_name || item.code).filter(Boolean);
        setClassOptions(labels);
        nextCatalog.classes = labels;
        nextCatalog.updatedAt = new Date().toISOString();
      }
      if (analyticsResult.status === "fulfilled") {
        const updatedAt = new Date().toISOString();
        const nextCache = {
          ...cache,
          version: STUDENT_MANAGE_CACHE_VERSION,
          catalog: nextCatalog,
          lastFilter: { className: selectedClassLabel, perPage: itemsPerPage },
          snapshots: {
            ...(cache.snapshots || {}),
            [studentManageSnapshotKey(selectedClassLabel)]: {
              analytics: analyticsResult.value || buildEmptyClassAnalytics(),
              updatedAt,
            },
          },
        };
        writeStudentManageCache(nextCache);
        setClassAnalytics(analyticsResult.value || buildEmptyClassAnalytics());
        setSnapshotUpdatedAt(updatedAt);
        setHasNewData(false);
        setBackendError("");
      } else {
        writeStudentManageCache({ ...cache, catalog: nextCatalog });
        setHasNewData(true);
        setUpdateError(analyticsResult.reason?.message || "Update gagal, menampilkan data terakhir yang tersimpan.");
      }
    } catch {
      setHasNewData(true);
      setUpdateError("Update gagal. Coba lagi setelah backend aktif.");
    } finally {
      setIsUpdating(false);
    }
  };

  useEffect(() => {
    const refreshNewData = () => {
      setHasNewData(true);
      window.setTimeout(() => {
        handleUpdateData();
      }, 0);
    };
    window.addEventListener("atl-data-updated", refreshNewData);
    return () => window.removeEventListener("atl-data-updated", refreshNewData);
  }, [selectedClassLabel, isUpdating]);

  const students = classAnalytics.students;
  const averageOverall = classAnalytics.average;
  const averageLevel = classAnalytics.averageLevel;
  const distribution = buildEmptyScoreDistribution().map((template) => {
    const matched = (classAnalytics.distribution || []).find((item) => normalizeScoreBand(item.label || item.key) === template.label);
    return {
      ...template,
      ...(matched || {}),
      key: template.key,
      label: template.label,
      color: matched?.color || template.color,
      badgeClass: matched?.badgeClass || template.badgeClass,
      range: matched?.range || template.range,
      fullLabel: matched?.fullLabel || template.fullLabel,
      count: Number(matched?.count || 0),
    };
  });
  const dominantCategory = classAnalytics.dominantCategory;
  const categoryAverageRows = detailCategoryConfig.map((config) => {
    const matched = (classAnalytics.categoryAverages || []).find((item) => normalizeATLCategory(item.category) === config.label);
    return { category: config.label, score: Number(matched?.score || 0) };
  });
  const hasCategoryAverage = categoryAverageRows.some((item) => item.score > 0);
  const assessedTopicCount = new Set(
    students.flatMap((student) => (
      student.topicDetails || []
    ).filter((topic) => Number(topic.score || 0) > 0).map((topic) => topic.topicId || `${topic.subject}-${topic.topic || topic.subTopic}`))
  ).size || students.reduce((sum, student) => sum + Number(student.assessedTopics || 0), 0);
  const assessedTopicRows = Object.values(
    students.flatMap((student) => student.topicDetails || [])
      .filter((topic) => Number(topic.score || 0) > 0)
      .reduce((acc, topic) => {
        const key = topic.topicId || `${topic.subject}-${topic.topic || topic.subTopic}`;
        if (!acc[key]) {
          acc[key] = {
            key,
            subject: topic.subject || topic.subjectName || "-",
            topic: topic.subTopic || topic.topic || topic.topicLabel || "-",
            totalScore: 0,
            count: 0,
          };
        }
        acc[key].totalScore += Number(topic.score || 0);
        acc[key].count += 1;
        return acc;
      }, {})
  )
    .map((topic) => ({ ...topic, average: topic.count ? topic.totalScore / topic.count : 0 }))
    .sort((a, b) => b.average - a.average);
  const previewAssessedTopics = assessedTopicRows.slice(0, 3);
  const rankedCategoryRows = categoryAverageRows.filter((item) => item.score > 0).sort((a, b) => b.score - a.score);
  const strongestATL = rankedCategoryRows[0] || { category: "-", score: 0 };
  const lowestATL = rankedCategoryRows.at(-1) || { category: classAnalytics.topFocus || "-", score: 0 };

  const totalStudents = students.length;
  const assessedStudents = classAnalytics.assessedCount;
  const assessedStudentPercent = totalStudents ? Math.round((assessedStudents / totalStudents) * 100) : 0;
  const categoryFilterOptions = detailCategoryConfig.map((item) => item.label);
  const levelFilterOptions = ["EE", "ME", "DE", "PTE", "NFI", "No Data"];
  const filteredStudents = students.filter((student) => {
    const query = searchText.trim().toLowerCase();
    const matchesSearch = !query || [
      student.name,
      student.nis,
      student.strength,
      student.strengthValue,
      student.focus,
      student.focusValue,
      student.level?.label,
      scoreDisplayName(student.level),
    ].some((value) => String(value || "").toLowerCase().includes(query));
    const hasScore = student.overallScore !== null && student.overallScore !== undefined;
    const matchesStatus = statusFilter === "all"
      || (statusFilter === "assessed" && hasScore)
      || (statusFilter === "empty" && !hasScore);
    const studentLevel = hasScore ? student.level?.label : "No Data";
    const matchesLevel = levelFilter === "all" || studentLevel === levelFilter;
    const matchesStrength = strengthFilter === "all" || normalizeATLCategory(student.strength) === strengthFilter;
    const matchesFocus = focusFilter === "all" || normalizeATLCategory(student.focus) === focusFilter;
    return matchesSearch && matchesStatus && matchesLevel && matchesStrength && matchesFocus;
  });
  const totalPages = Math.max(1, Math.ceil(filteredStudents.length / itemsPerPage));
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentStudents = filteredStudents.slice(startIndex, endIndex);
  const filterSummary = [
    `Kelas: ${selectedClassLabel}`,
    searchText.trim() ? `Search: ${searchText.trim()}` : "Search: Semua",
    `Status: ${statusFilter === "assessed" ? "Sudah Ternilai" : statusFilter === "empty" ? "Belum Ada Data" : "Semua"}`,
    `Level: ${levelFilter}`,
    `Strength: ${strengthFilter}`,
    `Focus: ${focusFilter}`,
  ].join(" | ");
  const activeFilterCount = [
    statusFilter !== "all",
    levelFilter !== "all",
    strengthFilter !== "all",
    focusFilter !== "all",
  ].filter(Boolean).length;
  const excelColumns = [
    { key: "no", label: "NO" },
    { key: "className", label: "CLASS" },
    { key: "nis", label: "NIS" },
    { key: "name", label: "NAME" },
    { key: "overall", label: "OVERALL ATL" },
    { key: "level", label: "LEVEL" },
    { key: "strength", label: "STRENGTH" },
    { key: "strengthScore", label: "STRENGTH SCORE" },
    { key: "focus", label: "FOCUS AREA" },
    { key: "focusScore", label: "FOCUS SCORE" },
    { key: "trend", label: "TREND" },
    { key: "assessedTopics", label: "ASSESSED TOPICS" },
    { key: "topicDetails", label: "TOPIC DETAILS" },
  ];
  const excelFilename = `ATL_Student_Management_${safeFilePart(selectedClassLabel)}_${safeFilePart(new Date().toISOString().slice(0, 10))}.xlsx`;
  const buildExcelRows = () => filteredStudents.map((student, index) => ({
    no: index + 1,
    className: selectedClassLabel,
    nis: student.nis,
    name: student.name,
    overall: student.overallScore ?? "-",
    level: student.overallScore === null || student.overallScore === undefined ? "No Data" : scoreDisplayName(student.level),
    strength: student.strength || "-",
    strengthScore: student.strengthValue || "-",
    focus: student.focus || "-",
    focusScore: student.focusValue || "-",
    trend: student.trendValue || "-",
    assessedTopics: student.assessedTopics || buildTopicDetailRows(student).length || 0,
    topicDetails: buildTopicDetailRows(student)
      .filter((topic) => Number(topic.score || 0) > 0)
      .map((topic) => `${topic.subject} - ${topic.topic}: ${number2(topic.score)} (${topic.level?.label || getScoreLevel(topic.score).label})`)
      .join("; ") || "-",
  }));
  const excelPayload = {
    meta: {
      filename: excelFilename,
      className: selectedClassLabel,
      subject: "Student Management",
      subTopic: "Class ATL Overview",
      rowCount: excelPreviewRows.length,
      generatedAt: new Date().toLocaleString("id-ID"),
      snapshotAt: snapshotUpdatedAt ? formatSnapshotTime(snapshotUpdatedAt) : "-",
      filterSummary,
    },
    columns: excelColumns,
    rows: excelPreviewRows,
  };
  const handleOpenExcelPreview = () => {
    if (!snapshotUpdatedAt) {
      setExportError("Update Data terlebih dahulu agar Excel memakai snapshot Student Management.");
      return;
    }
    const rows = buildExcelRows();
    if (rows.length === 0) {
      setExportError("Tidak ada siswa pada hasil filter/search yang bisa diexport.");
      return;
    }
    setExcelPreviewRows(rows);
    setExportError("");
    setShowExcelPreview(true);
  };
  const handleDownloadExcel = async () => {
    setExporting(true);
    setExportError("");
    try {
      const { blob, filename } = await exportReportExcel(excelPayload);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename || excelFilename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      setExportError(error?.message || "Export Excel gagal. Pastikan backend berjalan lalu coba lagi.");
    } finally {
      setExporting(false);
    }
  };
  const resetTableFilters = () => {
    setSearchText("");
    setStatusFilter("all");
    setLevelFilter("all");
    setStrengthFilter("all");
    setFocusFilter("all");
    setItemsPerPage(DEFAULT_STUDENT_MANAGE_FILTER.perPage);
    setCurrentPage(1);
    setExpandedStudentId(null);
    setCalculationDetail(null);
  };
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
  const dataStatus = (() => {
    if (isUpdating) return { icon: "sync", label: "Memperbarui data...", tone: "border-blue-200 bg-blue-50 text-blue-700" };
    if (updateError) return { icon: "error", label: updateError, tone: "border-red-200 bg-red-50 text-red-700" };
    if (hasNewData) return { icon: "notification_important", label: "Data penilaian baru tersedia. Tekan Update Data.", tone: "border-amber-300 bg-amber-50 text-amber-800" };
    if (snapshotUpdatedAt) return { icon: "check_circle", label: `Data terakhir: ${formatSnapshotTime(snapshotUpdatedAt)}`, tone: "border-emerald-200 bg-emerald-50 text-emerald-700" };
    return { icon: "info", label: "Belum ada data tersimpan. Tekan Update Data.", tone: "border-stone-200 bg-stone-50 text-stone-600" };
  })();

  return (
    <div className="flex h-screen w-full overflow-hidden">
      {/* Sidebar */}
      <Sidebar active="students" />

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
                </div>
                <p className="mt-3 max-w-2xl text-sm text-text-sub-light">
                  Kelola penilaian ATL siswa secara global dan pantau perkembangan mereka secara real time.
                </p>
              </div>
              <button
                type="button"
                onClick={handleUpdateData}
                disabled={isUpdating || !selectedClassLabel}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-3 text-sm font-black text-white shadow-[0_14px_28px_rgba(245,166,9,0.22)] transition hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span className={`material-symbols-outlined text-[18px] ${isUpdating ? "animate-spin" : ""}`}>{isUpdating ? "sync" : "refresh"}</span>
                {isUpdating ? "Memperbarui..." : "Update Data"}
              </button>
            </div>

            <div className={`flex items-center gap-3 rounded-2xl border px-5 py-4 text-sm font-bold ${dataStatus.tone}`}>
              <span className={`material-symbols-outlined text-[19px] ${isUpdating ? "animate-spin" : ""}`}>{dataStatus.icon}</span>
              <span className="flex-1">{dataStatus.label}</span>
              {snapshotUpdatedAt && <span className="rounded-full bg-white/70 px-3 py-1 text-[10px] font-black uppercase tracking-wider">Snapshot aktif</span>}
            </div>

            {backendError && (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-bold text-red-700">
                <span className="material-symbols-outlined mr-2 align-middle text-[18px]">error</span>
                {backendError} Student Management tidak memakai dummy/localStorage sebagai pengganti data.
              </div>
            )}

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
                        <p className="text-xs uppercase tracking-[0.24em] text-amber-300/80">Nilai ATL Tersimpan</p>
                        <HeroTooltip text="Jumlah siswa yang sudah memiliki minimal satu nilai ATL tersimpan pada kelas ini.">
                          <p className="mt-5 text-4xl font-black text-white">{assessedStudents}/{totalStudents}</p>
                        </HeroTooltip>
                      </div>
                      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-300/20 text-amber-200 shadow-[0_10px_30px_rgba(245,158,11,0.22)]">
                        <span className="material-symbols-outlined text-[26px]">assignment_turned_in</span>
                      </span>
                    </div>
                    <div className="mt-5 h-1 w-full rounded-full bg-amber-300/20">
                      <div className="h-full rounded-full bg-gradient-to-r from-amber-300 via-amber-400 to-yellow-400" style={{ width: `${assessedStudentPercent}%` }} />
                    </div>
                    <p className="mt-4 text-sm text-slate-400">
                      {assessedStudentPercent}% siswa sudah memiliki nilai tersimpan.
                    </p>
                  </div>
                </div>

                <div className="mt-8 grid gap-4 sm:grid-cols-3">
                  <div className="rounded-[1.75rem] bg-white/10 p-5 backdrop-blur-sm ring-1 ring-white/10">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-xs uppercase tracking-[0.22em] text-slate-300">Total Subtopik Ternilai</p>
                        <HeroTooltip text="Jumlah subtopik berbeda yang sudah memiliki minimal satu nilai ATL tersimpan untuk kelas ini.">
                          <p className="mt-3 text-3xl font-black text-white">{assessedTopicCount}</p>
                        </HeroTooltip>
                      </div>
                      {assessedTopicRows.length > 3 && (
                        <button
                          type="button"
                          onClick={() => setShowAllAssessedTopics(true)}
                          className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-amber-200 transition hover:bg-white/15"
                        >
                          Lihat Semua
                        </button>
                      )}
                    </div>
                    <div className="my-4 h-px bg-white/10" />
                    <div className="space-y-2">
                      {previewAssessedTopics.length > 0 ? previewAssessedTopics.map((topic) => (
                        <HeroTooltip
                          key={topic.key}
                          text={`${topic.subject}: ${topic.topic}. Nilai ${topic.average.toFixed(1)} adalah rata-rata skor siswa pada subtopik ini.`}
                        >
                          <div className="flex items-center justify-between gap-3 text-xs">
                          <div className="min-w-0">
                            <p className="truncate font-black text-white">{topic.topic}</p>
                            <p className="truncate font-semibold text-slate-400">{topic.subject} </p>
                          </div>
                          <span className="shrink-0 rounded-full bg-amber-300/15 px-2 py-1 font-black text-amber-200">
                            {topic.count}/{totalStudents}
                          </span>
                          </div>
                        </HeroTooltip>
                      )) : (
                        <p className="text-xs font-semibold text-slate-400">Belum ada subtopik dengan nilai tersimpan.</p>
                      )}
                    </div>
                  </div>
                  <div className="flex min-h-[178px] flex-col justify-between rounded-[1.75rem] bg-white/10 p-5 backdrop-blur-sm ring-1 ring-white/10">
                    <p className="text-xs uppercase tracking-[0.22em] text-slate-300">Dominan Level ATL</p>
                    <HeroTooltip text="Level yang paling banyak muncul dari siswa yang sudah memiliki nilai ATL di kelas ini.">
                      <p className="mt-4 text-[2.45rem] font-black leading-[0.98] text-white">{scoreDisplayName(dominantCategory)}</p>
                    </HeroTooltip>
                    <p className="mt-4 text-xs font-semibold text-slate-400">
                      {dominantCategory.count || 0} siswa berada pada level ini.
                    </p>
                  </div>
                  <div className="grid min-h-[178px] grid-rows-2 overflow-hidden rounded-[1.75rem] bg-white/10 backdrop-blur-sm ring-1 ring-white/10">
                    <HeroTooltip className="h-full" text="Kategori ATL dengan rata-rata nilai tertinggi dari semua kategori yang sudah punya data.">
                    <div className="flex h-full flex-col justify-center p-5">
                      <p className="text-xs uppercase tracking-[0.22em] text-emerald-200">Kategori ATL Tertinggi</p>
                      <div className="mt-2 flex items-end justify-between gap-3">
                        <p className="text-xl font-black leading-tight text-white">{strongestATL.category}</p>
                        <span className="text-sm font-black text-emerald-200">{strongestATL.score || 0}</span>
                      </div>
                    </div>
                    </HeroTooltip>
                    <HeroTooltip className="h-full" text="Kategori ATL dengan rata-rata nilai paling rendah. Bagian ini menjadi area yang paling perlu diperhatikan.">
                    <div className="flex h-full flex-col justify-center border-t border-white/10 p-5">
                      <p className="text-xs uppercase tracking-[0.22em] text-rose-200">Kategori ATL Perlu Fokus</p>
                      <div className="mt-2 flex items-end justify-between gap-3">
                        <p className="text-xl font-black leading-tight text-white">{lowestATL.category}</p>
                        <span className="text-sm font-black text-rose-200">{lowestATL.score || 0}</span>
                      </div>
                    </div>
                    </HeroTooltip>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-[1.8rem] border-2 border-stone-200/90 bg-white p-5 shadow-[0_18px_40px_rgba(15,23,42,0.06)]">
              <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <span className="text-xs uppercase tracking-[0.24em] text-stone-500">Daftar Siswa</span>
                  <h2 className="mt-2 text-2xl font-black text-stone-900">Kelola penilaian ATL siswa</h2>
                  <p className="mt-1 text-sm font-semibold text-stone-500">
                    {filteredStudents.length} dari {students.length} siswa cocok dengan filter aktif.
                  </p>
                </div>
              </div>

              <div className="mb-5 rounded-3xl border border-stone-200 bg-stone-50 p-4">
                <div className="grid gap-3 xl:grid-cols-[minmax(280px,1fr)_220px_auto_auto]">
                  <label className="relative block">
                    <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-stone-400">
                      <span className="material-symbols-outlined text-[19px]">search</span>
                    </span>
                    <input
                      value={searchText}
                      onChange={(e) => setSearchText(e.target.value)}
                      placeholder="Cari nama, NIS, strength, focus..."
                      className="h-12 w-full rounded-2xl border border-stone-200 bg-white pl-11 pr-4 text-sm font-semibold text-stone-700 outline-none transition focus:border-primary/60 focus:ring-4 focus:ring-primary/10"
                    />
                  </label>
                  <select
                    value={selectedClassLabel}
                    onChange={(e) => setSelectedClassLabel(e.target.value)}
                    className="h-12 rounded-2xl border border-stone-200 bg-white px-4 text-sm font-semibold text-stone-700 outline-none transition focus:border-primary/60 focus:ring-4 focus:ring-primary/10"
                  >
                    {(classOptions.length ? classOptions : [selectedClassLabel]).map((label) => (
                      <option key={label} value={label}>{label}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={handleOpenExcelPreview}
                    disabled={!snapshotUpdatedAt || filteredStudents.length === 0 || exporting}
                    className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 text-sm font-black text-emerald-700 transition hover:border-emerald-300 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined text-[18px]">download</span>
                    Export Excel
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowClassInsight((current) => !current)}
                    className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-primary/20 bg-primary/5 px-5 text-sm font-black text-primary transition hover:border-primary/50 hover:bg-primary/10"
                  >
                    <span className="material-symbols-outlined text-[18px]">insights</span>
                    {showClassInsight ? "Tutup Insight" : "Insight Kelas"}
                  </button>
                </div>

                <div className="mt-3 flex flex-col gap-3 border-t border-stone-200 pt-3 sm:flex-row sm:items-center sm:justify-between">
                  <button
                    type="button"
                    onClick={() => setShowFilterPanel((current) => !current)}
                    className={`inline-flex h-12 items-center justify-center gap-2 rounded-2xl px-5 text-sm font-black transition ${
                      showFilterPanel || activeFilterCount
                        ? "border border-primary/40 bg-primary/10 text-primary"
                        : "border border-stone-200 bg-white text-stone-700 hover:border-primary/50 hover:text-primary"
                    }`}
                  >
                    <span className="material-symbols-outlined text-[18px]">filter_alt</span>
                    Filter Data
                    {activeFilterCount > 0 && (
                      <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-black text-white">{activeFilterCount}</span>
                    )}
                  </button>
                  <div className="flex items-center gap-2 rounded-2xl border border-stone-200 bg-white p-1">
                    {[5, 10].map((value) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setItemsPerPage(value)}
                        className={`h-10 rounded-xl px-5 text-sm font-black transition ${
                          itemsPerPage === value
                            ? "bg-primary text-white shadow-sm shadow-primary/20"
                            : "text-stone-600 hover:bg-stone-50"
                        }`}
                      >
                        {value} Siswa
                      </button>
                    ))}
                  </div>
                </div>

                {showFilterPanel && (
                  <div className="mt-3 grid gap-3 rounded-3xl border border-stone-200 bg-white p-4 md:grid-cols-2 xl:grid-cols-[repeat(4,minmax(0,1fr))_auto]">
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="h-12 rounded-2xl border border-stone-200 bg-white px-4 text-sm font-semibold text-stone-700 outline-none transition focus:border-primary/60 focus:ring-4 focus:ring-primary/10"
                    >
                      <option value="all">Semua Status</option>
                      <option value="assessed">Sudah Ternilai</option>
                      <option value="empty">Belum Ada Data</option>
                    </select>
                    <select
                      value={levelFilter}
                      onChange={(e) => setLevelFilter(e.target.value)}
                      className="h-12 rounded-2xl border border-stone-200 bg-white px-4 text-sm font-semibold text-stone-700 outline-none transition focus:border-primary/60 focus:ring-4 focus:ring-primary/10"
                    >
                      <option value="all">Semua Level</option>
                      {levelFilterOptions.map((level) => (
                        <option key={level} value={level}>{level}</option>
                      ))}
                    </select>
                    <select
                      value={strengthFilter}
                      onChange={(e) => setStrengthFilter(e.target.value)}
                      className="h-12 rounded-2xl border border-stone-200 bg-white px-4 text-sm font-semibold text-stone-700 outline-none transition focus:border-primary/60 focus:ring-4 focus:ring-primary/10"
                    >
                      <option value="all">Kategori Terkuat</option>
                      {categoryFilterOptions.map((category) => (
                        <option key={category} value={category}>{category}</option>
                      ))}
                    </select>
                    <select
                      value={focusFilter}
                      onChange={(e) => setFocusFilter(e.target.value)}
                      className="h-12 rounded-2xl border border-stone-200 bg-white px-4 text-sm font-semibold text-stone-700 outline-none transition focus:border-primary/60 focus:ring-4 focus:ring-primary/10"
                    >
                      <option value="all">Area Fokus</option>
                      {categoryFilterOptions.map((category) => (
                        <option key={category} value={category}>{category}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={resetTableFilters}
                      className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-stone-200 bg-stone-50 px-4 text-sm font-black text-stone-700 transition hover:border-primary/50 hover:text-primary"
                    >
                      <span className="material-symbols-outlined text-[18px]">filter_alt_off</span>
                      Reset Filter
                    </button>
                  </div>
                )}
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
                                  setCalculationDetail(null);
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
                                        onClick={() => {
                                          setDetailTab("atl");
                                          setCalculationDetail(null);
                                        }}
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
                                            <div className="flex min-h-[34px] items-start justify-between gap-2">
                                              <p className="text-xs font-black leading-4 text-stone-900">{row.label}</p>
                                              <FormulaHint text={`Rumus: skor ${row.label} adalah rata-rata nilai indikator rubric yang masuk kategori ini. Level rubric dikonversi ke angka: NFI=10, PTE=30, DE=50, ME=70, EE=90. ${row.sourceText}`} />
                                            </div>
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
                                      <div className="space-y-3">
                                        {topicRows.length > 0 ? (
                                          topicRows.map((row) => {
                                            const score = Number(row.score || 0);
                                            const level = getScoreLevel(score);
                                            const subject = getSubjectVisual(row.subject);
                                            const levelColor = level.color || "#F59E0B";
                                            const range = getLevelRange(level);
                                            const rowKey = row.topicId || `${row.subject}-${row.topic}`;
                                            const detailKey = `${student.id}-${rowKey}`;
                                            const isCalculationOpen = calculationDetail?.key === detailKey;
                                            const assessedCriteria = row.assessedCriteria ?? row.assessedItems ?? 0;

                                            return (
                                              <React.Fragment key={rowKey}>
                                              <div
                                                className="relative overflow-hidden rounded-[1.15rem] border border-stone-200 bg-white p-3 shadow-[0_8px_20px_rgba(15,23,42,0.06)] transition-all hover:-translate-y-0.5 hover:shadow-[0_12px_28px_rgba(15,23,42,0.09)]"
                                              >
                                                <div className="absolute inset-y-0 left-0 w-1" style={{ backgroundColor: subject.color }} />
                                                <div className="grid gap-3 pl-2 lg:grid-cols-[1.12fr_0.62fr_0.9fr_150px] lg:items-center">
                                                  <div className="min-w-0">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                      <span
                                                        className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.16em]"
                                                        style={{
                                                          borderColor: `${subject.color}33`,
                                                          backgroundColor: `${subject.color}12`,
                                                          color: subject.color,
                                                        }}
                                                      >
                                                        <span className="material-symbols-outlined text-[14px]">{subject.icon}</span>
                                                        {subject.label}
                                                      </span>
                                                      <FormulaHint text="Nilai subtopik dihitung dari rata-rata indikator rubrik yang sudah dinilai pada subtopik tersebut." />
                                                    </div>
                                                    <p className="mt-3 truncate text-xl font-black leading-tight text-slate-950">
                                                      {row.topic}
                                                    </p>
                                                    <p className="mt-1.5 text-xs font-semibold text-stone-500">
                                                      {subject.label} <span className="mx-2 text-stone-300">|</span> {assessedCriteria} kriteria ternilai
                                                    </p>
                                                    <p className="hidden">
                                                      {subject.label} - {assessedCriteria} kriteria ternilai
                                                    </p>
                                                  </div>

                                                  <div className="border-y border-stone-200 py-3 text-left lg:border-x lg:border-y-0 lg:px-4 lg:py-0 lg:text-center">
                                                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-stone-400">Nilai</p>
                                                    <p className="mt-1.5 text-3xl font-black leading-none text-slate-950">{score.toFixed(2)}</p>
                                                    <span
                                                      className="mt-2 inline-flex rounded-lg px-3 py-1 text-xs font-black"
                                                      style={{
                                                        backgroundColor: `${levelColor}14`,
                                                        color: levelColor,
                                                      }}
                                                    >
                                                      {level.label}
                                                    </span>
                                                  </div>

                                                  <div className="min-w-0">
                                                    <p className="text-base font-black leading-tight text-slate-950">{scoreDisplayName(level)}</p>
                                                    <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-stone-200">
                                                      <div
                                                        className="h-full rounded-full"
                                                        style={{
                                                          width: `${Math.min(score, 100)}%`,
                                                          backgroundColor: levelColor,
                                                        }}
                                                      />
                                                    </div>
                                                    <p className="mt-2 text-center text-xs font-semibold text-stone-500">{range}</p>
                                                  </div>

                                                  <div className="flex justify-start lg:justify-end">
                                                    <button
                                                      type="button"
                                                      onClick={() => setCalculationDetail(isCalculationOpen ? null : { key: detailKey, student, row, level, subject })}
                                                      className={`inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-xs font-black transition ${
                                                        isCalculationOpen
                                                          ? "border-stone-900 bg-stone-900 text-white"
                                                          : "border-primary/25 bg-primary/5 text-primary hover:border-primary/50 hover:bg-primary/10"
                                                      }`}
                                                    >
                                                      <span className="material-symbols-outlined text-[16px]">receipt_long</span>
                                                      {isCalculationOpen ? "Tutup" : "Detail"}
                                                    </button>
                                                  </div>
                                                </div>
                                              </div>
                                              {isCalculationOpen && (
                                                <CalculationDetailPanel
                                                  detail={calculationDetail}
                                                  onClose={() => setCalculationDetail(null)}
                                                />
                                              )}
                                              </React.Fragment>
                                            );
                                          })
                                        ) : (
                                          <div className="rounded-2xl border border-dashed border-stone-300 bg-stone-50 p-6 text-center">
                                            <span className="material-symbols-outlined text-4xl text-stone-300">folder_off</span>
                                            <p className="mt-3 text-sm font-bold text-stone-600">Belum ada detail topik tersimpan untuk siswa ini.</p>
                                            <p className="mt-1 text-xs font-semibold text-stone-400">Tekan Update Data setelah nilai disimpan agar daftar mapel dan subtopik muncul.</p>
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
                    {currentStudents.length === 0 && (
                      <tr>
                        <td colSpan={7} className="px-6 py-14 text-center">
                          <span className="material-symbols-outlined text-5xl text-stone-300">manage_search</span>
                          <p className="mt-3 text-sm font-black text-stone-700">Tidak ada siswa sesuai filter saat ini.</p>
                          <p className="mt-1 text-xs font-semibold text-stone-400">Ubah kata kunci atau tekan Reset untuk menampilkan semua siswa pada snapshot aktif.</p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="mt-6 flex items-center justify-between">
                <div className="text-sm text-stone-500">
                  Menampilkan {filteredStudents.length ? startIndex + 1 : 0} sampai {Math.min(endIndex, filteredStudents.length)} dari {filteredStudents.length} siswa
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
                    <p className="mt-2 text-sm text-stone-500">
                      Distribusi overall ATL berdasarkan snapshot kelas terakhir yang berhasil diperbarui.
                    </p>
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
                          {scoreDisplayName(averageLevel)}
                        </span>
                      </div>
                      <div className="rounded-2xl bg-white p-4 ring-1 ring-stone-200">
                        <p className="text-xs uppercase tracking-[0.22em] text-stone-500">Kategori Dominan</p>
                        <p className="mt-2 text-lg font-black text-stone-900">
                          {scoreDisplayName(dominantCategory)}
                        </p>
                        <p className="mt-2 text-sm text-stone-500">
                          {dominantCategory.count || 0} siswa
                        </p>
                      </div>
                      <div className="rounded-2xl bg-white p-4 ring-1 ring-stone-200">
                        <p className="text-xs uppercase tracking-[0.22em] text-stone-500">Kategori ATL</p>
                        <div className="mt-3 grid gap-3">
                          <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600">Tertinggi</p>
                            <p className="mt-1 truncate text-sm font-black text-stone-950">{strongestATL.category}</p>
                            <p className="text-xs font-semibold text-stone-500">{strongestATL.score || 0}</p>
                          </div>
                          <div className="border-t border-stone-200 pt-3">
                            <p className="text-[10px] font-black uppercase tracking-widest text-rose-600">Terendah</p>
                            <p className="mt-1 truncate text-sm font-black text-stone-950">{lowestATL.category}</p>
                            <p className="text-xs font-semibold text-stone-500">{lowestATL.score || 0}</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-5 rounded-2xl bg-white p-5 ring-1 ring-stone-200">
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-bold text-stone-900">Distribusi ATL Skills</h3>
                        <FormulaHint text="Bagian ini selalu diringkas menjadi 5 kategori resmi ATL. Alias lama seperti Communication atau Self-Management digabung ke Communication Skills dan Self-Management Skills." />
                      </div>
                      <div className="mt-5 space-y-4">
                        {hasCategoryAverage ? (
                          categoryAverageRows.map((item) => {
                            const tone = getSkillTone(item.category);
                            return (
                              <div key={item.category}>
                                <div className="mb-2 flex items-center justify-between">
                                  <span className="inline-flex items-center gap-2 text-sm font-semibold text-stone-700">
                                    {item.category}
                                    <FormulaHint text={`Rumus: ${item.category} = rata-rata skor siswa pada indikator yang masuk kategori ini. Semua subskill/alias dinormalisasi ke 5 kategori ATL resmi.`} />
                                  </span>
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
                      <div className="mt-6 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
                        <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4">
                          <div className="flex items-start gap-3">
                            <span className="material-symbols-outlined mt-0.5 text-[20px] text-amber-600">info</span>
                            <div>
                              <p className="text-sm font-black text-stone-950">Cara Membaca Grafik</p>
                              <p className="mt-2 text-xs font-semibold leading-5 text-stone-600">
                                Setiap bar menunjukkan rata-rata nilai kelas pada kategori ATL tersebut. Semakin panjang bar, semakin kuat rata-rata performa kelas pada kategori itu. Nilai dihitung dari indikator rubrik pada subtopik yang sudah tersimpan.
                              </p>
                            </div>
                          </div>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                            <p className="text-[10px] font-black uppercase tracking-widest text-emerald-700">Area Terkuat</p>
                            <p className="mt-2 text-sm font-black text-stone-950">{strongestATL.category}</p>
                            <p className="mt-1 text-xs font-semibold text-emerald-700">{strongestATL.score || 0}% rata-rata kelas</p>
                          </div>
                          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
                            <p className="text-[10px] font-black uppercase tracking-widest text-rose-700">Perlu Fokus</p>
                            <p className="mt-2 text-sm font-black text-stone-950">{lowestATL.category}</p>
                            <p className="mt-1 text-xs font-semibold text-rose-700">{lowestATL.score || 0}% rata-rata kelas</p>
                          </div>
                        </div>
                      </div>
                      <div className="mt-4 rounded-2xl border border-stone-200 bg-white p-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <p className="text-xs font-black uppercase tracking-[0.2em] text-stone-500">Cakupan Data</p>
                            <p className="mt-1 text-sm font-semibold text-stone-600">
                              {assessedTopicRows.length} subtopik sudah memunculkan nilai, dengan {assessedStudents}/{totalStudents} siswa memiliki nilai tersimpan.
                            </p>
                          </div>
                          <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-black text-primary">
                            {assessedStudentPercent}% siswa ternilai
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-3xl border border-stone-200 bg-stone-50 p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="text-lg font-bold text-stone-900">Distribusi Level ATL Kelas</h3>
                        <p className="mt-1 text-xs font-semibold leading-5 text-stone-500">
                          Cara baca: warna donat menunjukkan proporsi siswa pada setiap level. Angka persen di kanan dihitung dari jumlah siswa yang sudah memiliki nilai.
                        </p>
                      </div>
                      <FormulaHint text="Contoh: jika Developing Expectation bernilai 100%, berarti seluruh siswa yang sudah ternilai berada pada level tersebut untuk ringkasan kelas ini." />
                    </div>
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
                                    {item.fullLabel || item.label} ({item.range})
                                  </p>
                                  <p className="text-xs text-stone-500">{item.count} siswa</p>
                                </div>
                              </div>
                              <span className="text-sm font-bold text-stone-700">{percentage}%</span>
                            </div>
                          );
                        })}
                      </div>
                      <div className="w-full rounded-2xl bg-white p-4 ring-1 ring-stone-200">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-xs font-black uppercase tracking-[0.2em] text-stone-500">Subtopik Ternilai</p>
                            <p className="mt-1 text-xs font-semibold text-stone-400">Menampilkan subtopik yang sudah muncul nilainya.</p>
                          </div>
                          {assessedTopicRows.length > 3 && (
                            <button
                              type="button"
                              onClick={() => setShowAllAssessedTopics(true)}
                              className="rounded-full bg-primary/10 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-primary"
                            >
                              Lihat Semua
                            </button>
                          )}
                        </div>
                        <div className="mt-4 space-y-3">
                          {previewAssessedTopics.length > 0 ? previewAssessedTopics.map((topic) => (
                            <div key={topic.key} className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-black text-stone-950">{topic.topic}</p>
                                  <p className="mt-1 text-xs font-semibold text-stone-500">{topic.subject}</p>
                                </div>
                                <span className="shrink-0 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-black text-amber-700">
                                  {topic.average.toFixed(1)}
                                </span>
                              </div>
                              <div className="mt-3 flex items-center gap-3">
                                <div className="h-2 flex-1 overflow-hidden rounded-full bg-stone-200">
                                  <div
                                    className="h-full rounded-full bg-primary"
                                    style={{ width: `${totalStudents ? Math.min(100, (topic.count / totalStudents) * 100) : 0}%` }}
                                  />
                                </div>
                                <span className="text-[11px] font-black text-stone-600">{topic.count}/{totalStudents} siswa ternilai</span>
                              </div>
                            </div>
                          )) : (
                            <p className="rounded-2xl border border-dashed border-stone-300 bg-stone-50 p-4 text-sm font-semibold text-stone-500">
                              Belum ada subtopik ternilai untuk kelas ini.
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="rounded-3xl border border-stone-200/90 bg-white p-6 shadow-[0_18px_40px_rgba(15,23,42,0.06)]">
              <div className="grid gap-4 lg:grid-cols-[1.2fr_0.9fr_0.9fr]">
                <div className="rounded-3xl border border-amber-200 bg-amber-50/70 p-5">
                  <div className="flex items-start gap-3">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-primary">
                      <span className="material-symbols-outlined text-[22px]">school</span>
                    </span>
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.22em] text-amber-700">Untuk Wali Kelas</p>
                      <p className="mt-2 text-sm font-semibold leading-6 text-stone-700">
                        Halaman ini merangkum nilai ATL siswa dalam satu kelas, termasuk level, kekuatan, area fokus, dan detail subtopik.
                      </p>
                    </div>
                  </div>
                </div>
                <div className="rounded-3xl border border-stone-200 bg-stone-50 p-5">
                  <p className="text-xs font-black uppercase tracking-[0.22em] text-stone-500">Cara Update</p>
                  <p className="mt-2 text-sm font-semibold leading-6 text-stone-700">
                    Tekan <span className="font-black text-primary">Update Data</span> untuk mengambil snapshot terbaru dari backend. Tampilan tidak berubah otomatis saat input nilai belum dipush.
                  </p>
                </div>
                <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5">
                  <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-700">Export Excel</p>
                  <p className="mt-2 text-sm font-semibold leading-6 text-stone-700">
                    File Excel mengikuti search dan filter tabel yang sedang aktif, jadi hasil download sama dengan daftar yang terlihat.
                  </p>
                </div>
              </div>
            </div>

          </div>
        </div>
        {showExcelPreview && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
            <div className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-[2rem] border border-yellow-300 bg-white shadow-[0_28px_90px_rgba(15,23,42,0.28)]">
              <div className="flex flex-col gap-4 border-b border-yellow-100 bg-gradient-to-r from-yellow-50 via-white to-stone-50 px-6 py-5 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.24em] text-yellow-700">Excel Preview</p>
                  <h3 className="mt-2 text-2xl font-black text-stone-950">ATL Student Management</h3>
                  <p className="mt-1 text-sm font-semibold text-stone-500">
                    {selectedClassLabel} - {excelPreviewRows.length} siswa hasil filter akan diexport ke file <span className="font-black text-stone-800">{excelFilename}</span>.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowExcelPreview(false);
                      setExportError("");
                    }}
                    disabled={exporting}
                    className="rounded-2xl border border-stone-200 bg-white px-5 py-3 text-sm font-black text-stone-700 transition hover:bg-stone-50 disabled:opacity-60"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadExcel}
                    disabled={exporting}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-yellow-400 px-5 py-3 text-sm font-black text-stone-950 shadow-[0_12px_24px_rgba(245,158,11,0.28)] transition-all hover:bg-yellow-500 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <span className="material-symbols-outlined text-[18px]">{exporting ? "hourglass_top" : "download"}</span>
                    {exporting ? "Membuat File..." : "Download XLSX"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowExcelPreview(false);
                      setExportError("");
                    }}
                    disabled={exporting}
                    className="rounded-full border border-stone-200 bg-white p-3 text-stone-600 transition hover:bg-stone-50 disabled:opacity-60"
                    aria-label="Tutup preview Excel"
                  >
                    <span className="material-symbols-outlined text-[18px]">close</span>
                  </button>
                </div>
              </div>

              <div className="border-b border-yellow-100 bg-yellow-50/70 px-6 py-4">
                <div className="grid gap-3 text-xs font-semibold text-stone-700 md:grid-cols-5">
                  <div className="rounded-xl bg-white/80 px-3 py-2 ring-1 ring-yellow-200">
                    <p className="text-[10px] font-black uppercase tracking-wider text-yellow-700">Kelas</p>
                    <p className="mt-1 text-stone-950">{selectedClassLabel}</p>
                  </div>
                  <div className="rounded-xl bg-white/80 px-3 py-2 ring-1 ring-yellow-200">
                    <p className="text-[10px] font-black uppercase tracking-wider text-yellow-700">Total Row</p>
                    <p className="mt-1 text-stone-950">{excelPreviewRows.length}</p>
                  </div>
                  <div className="rounded-xl bg-white/80 px-3 py-2 ring-1 ring-yellow-200">
                    <p className="text-[10px] font-black uppercase tracking-wider text-yellow-700">Snapshot</p>
                    <p className="mt-1 text-stone-950">{excelPayload.meta.snapshotAt}</p>
                  </div>
                  <div className="rounded-xl bg-white/80 px-3 py-2 ring-1 ring-yellow-200">
                    <p className="text-[10px] font-black uppercase tracking-wider text-yellow-700">Jam Export</p>
                    <p className="mt-1 text-stone-950">{excelPayload.meta.generatedAt}</p>
                  </div>
                  <div className="rounded-xl bg-white/80 px-3 py-2 ring-1 ring-yellow-200">
                    <p className="text-[10px] font-black uppercase tracking-wider text-yellow-700">Filter</p>
                    <p className="mt-1 truncate text-stone-950" title={filterSummary}>{filterSummary}</p>
                  </div>
                </div>
                <div className="mt-3 flex items-start gap-2 text-xs font-medium leading-6 text-stone-700">
                  <span className="material-symbols-outlined mt-0.5 text-[17px] text-yellow-600">info</span>
                  <span>Preview ini memakai payload yang sama dengan file Excel. Jika tabel ini benar, file XLSX akan mengikuti isi filter/search yang sedang aktif.</span>
                </div>
                {exportError && (
                  <div className="mt-3 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold leading-5 text-red-700">
                    <span className="material-symbols-outlined mt-0.5 text-[17px]">error</span>
                    <span>{exportError}</span>
                  </div>
                )}
              </div>

              <div className="flex-1 overflow-auto p-5">
                <div className="min-w-[1280px] overflow-hidden rounded-2xl border border-stone-200 bg-white">
                  <table className="w-full border-collapse text-left">
                    <thead>
                      <tr className="bg-yellow-400">
                        {excelColumns.map((column) => (
                          <th key={column.key} className="border border-yellow-500/50 px-3 py-3 text-[11px] font-black uppercase tracking-wider text-stone-950">
                            {column.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {excelPreviewRows.map((row) => (
                        <tr key={`${row.no}-${row.nis}`} className="odd:bg-white even:bg-stone-50">
                          {excelColumns.map((column) => (
                            <td key={column.key} className="border border-stone-200 px-3 py-3 text-xs font-semibold text-stone-700">
                              {row[column.key]}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}
        {showAllAssessedTopics && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
            <div className="w-full max-w-2xl overflow-hidden rounded-[2rem] border border-stone-200 bg-white shadow-[0_28px_80px_rgba(15,23,42,0.24)]">
              <div className="flex items-start justify-between gap-4 border-b border-stone-200 bg-gradient-to-r from-amber-50 via-white to-stone-50 px-6 py-5">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.24em] text-amber-600">Subtopik Ternilai</p>
                  <h3 className="mt-2 text-2xl font-black text-stone-950">{selectedClassLabel}</h3>
                  <p className="mt-1 text-sm font-semibold text-stone-500">
                    {assessedTopicRows.length} subtopik memiliki nilai tersimpan.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAllAssessedTopics(false)}
                  className="rounded-2xl border border-stone-200 bg-white p-3 text-stone-700 shadow-sm transition hover:bg-stone-50"
                >
                  <span className="material-symbols-outlined text-[22px]">close</span>
                </button>
              </div>
              <div className="max-h-[62vh] overflow-y-auto p-5">
                <div className="divide-y divide-stone-200 overflow-hidden rounded-2xl border border-stone-200">
                  {assessedTopicRows.map((topic, index) => (
                    <div key={topic.key} className="grid gap-3 bg-white px-4 py-4 sm:grid-cols-[56px_1fr_auto] sm:items-center">
                      <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 text-sm font-black text-amber-700">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-black text-stone-950">{topic.topic}</p>
                        <p className="mt-1 truncate text-sm font-semibold text-stone-500">
                          {topic.subject} - {topic.count}/{totalStudents} siswa ternilai
                        </p>
                      </div>
                      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-right">
                        <p className="text-[10px] font-black uppercase tracking-wider text-amber-700">Rata-rata</p>
                        <p className="text-lg font-black text-stone-950">{topic.average.toFixed(1)}</p>
                      </div>
                    </div>
                  ))}
                  {assessedTopicRows.length === 0 && (
                    <div className="px-4 py-10 text-center text-sm font-semibold text-stone-500">
                      Belum ada subtopik ternilai untuk kelas ini.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

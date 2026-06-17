import React, { useState, useMemo, useEffect, useCallback } from "react";
import Sidebar from "./sidebar";
import { exportReportExcel, getClasses, getCurrentUser, getReport, getTopics } from "../../services/atlApi";
import { filterSubjectsByUserAccess } from "../../services/accessControl";
import {
  getATLCategoryMeta,
  getNoDataLevel,
  getScoreDistributionConfig,
  getScoreLevel,
  getSubskillMeta,
  normalizeScoreBand,
  normalizeATLCategory,
} from "../../services/labelRegistry";

const FormulaHint = ({ text }) => (
  <span className="group relative inline-flex">
    <span className="material-symbols-outlined cursor-help text-[16px] text-stone-400 transition group-hover:text-primary">info</span>
    <span className="pointer-events-none absolute left-1/2 top-full z-30 mt-2 hidden w-80 -translate-x-1/2 rounded-xl border border-stone-200 bg-white p-3 text-[11px] font-semibold leading-5 text-stone-700 shadow-xl group-hover:block">
      {text}
    </span>
  </span>
);

const REPORT_CACHE_KEY = "atl_report_cache_v1";
const REPORT_DIRTY_KEY = "atl_report_data_dirty_at";
const REPORT_CACHE_VERSION = 1;
const MAX_REPORT_SNAPSHOTS = 10;
const DEFAULT_REPORT_FILTER = {
  cls: "3A - Primary",
  subj: "singing",
  topic: "singing_christmas_carol",
  perPage: 5,
};

const emptyReportCache = () => ({
  version: REPORT_CACHE_VERSION,
  catalog: { classes: [], subjects: [], updatedAt: "" },
  snapshots: {},
  lastFilter: DEFAULT_REPORT_FILTER,
});

const readReportCache = () => {
  try {
    const parsed = JSON.parse(localStorage.getItem(REPORT_CACHE_KEY) || "null");
    if (!parsed || parsed.version !== REPORT_CACHE_VERSION) return emptyReportCache();
    return {
      ...emptyReportCache(),
      ...parsed,
      catalog: { ...emptyReportCache().catalog, ...(parsed.catalog || {}) },
      snapshots: parsed.snapshots || {},
      lastFilter: { ...DEFAULT_REPORT_FILTER, ...(parsed.lastFilter || {}) },
    };
  } catch {
    return emptyReportCache();
  }
};

const writeReportCache = (cache) => {
  localStorage.setItem(REPORT_CACHE_KEY, JSON.stringify(cache));
};

const reportSnapshotKey = (className, topicId) => `${className || "class"}::${topicId || "topic"}`;

const trimSnapshots = (snapshots) => Object.fromEntries(
  Object.entries(snapshots || {})
    .sort(([, left], [, right]) => String(right.updatedAt || "").localeCompare(String(left.updatedAt || "")))
    .slice(0, MAX_REPORT_SNAPSHOTS)
);

const readInitialReportState = () => {
  const cache = readReportCache();
  const legacyPreference = (() => {
    try {
      return JSON.parse(localStorage.getItem("report_filter_pref") || "null");
    } catch {
      return null;
    }
  })();
  const filter = { ...DEFAULT_REPORT_FILTER, ...(legacyPreference || {}), ...(cache.lastFilter || {}) };
  const snapshot = cache.snapshots[reportSnapshotKey(filter.cls, filter.topic)] || null;
  const dirtyAt = localStorage.getItem(REPORT_DIRTY_KEY) || "";
  return { cache, filter, snapshot, isDirty: Boolean(dirtyAt && (!snapshot?.updatedAt || dirtyAt > snapshot.updatedAt)) };
};

export default function Report() {
  const [initialState] = useState(readInitialReportState);
  const [classOptions, setClassOptions] = useState(initialState.cache.catalog.classes || []);
  const [selectedClass, setSelectedClass] = useState(initialState.filter.cls);
  const [selectedSubject, setSelectedSubject] = useState(initialState.filter.subj);
  const [selectedTopic, setSelectedTopic] = useState(initialState.filter.topic);

  const [itemsPerPage, setItemsPerPage] = useState(initialState.filter.perPage);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedDetailStudent, setSelectedDetailStudent] = useState(null);
  const [apiReport, setApiReport] = useState(initialState.snapshot?.report || null);
  const [subjects, setSubjects] = useState(initialState.cache.catalog.subjects || []);
  const [snapshotUpdatedAt, setSnapshotUpdatedAt] = useState(initialState.snapshot?.updatedAt || "");
  const [isUpdating, setIsUpdating] = useState(false);
  const [hasNewData, setHasNewData] = useState(initialState.isDirty);
  const [updateError, setUpdateError] = useState("");
  const [currentUser, setCurrentUser] = useState(null);

  const [showExcelPreview, setShowExcelPreview] = useState(false);
  const [excelPreviewRows, setExcelPreviewRows] = useState([]);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  const [searchText, setSearchText] = useState("");
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [levelFilter, setLevelFilter] = useState("all");
  const [strengthFilter, setStrengthFilter] = useState("all");
  const [focusFilter, setFocusFilter] = useState("all");

  const selectSnapshot = (className, topicId) => {
    const snapshot = readReportCache().snapshots[reportSnapshotKey(className, topicId)] || null;
    const dirtyAt = localStorage.getItem(REPORT_DIRTY_KEY) || "";
    setApiReport(snapshot?.report || null);
    setSnapshotUpdatedAt(snapshot?.updatedAt || "");
    setHasNewData(Boolean(dirtyAt && (!snapshot?.updatedAt || dirtyAt > snapshot.updatedAt)));
    setUpdateError("");
    setCurrentPage(1);
    setSelectedDetailStudent(null);
  };

  useEffect(() => {
    setCurrentPage(1);
    setSelectedDetailStudent(null);
  }, [searchText, statusFilter, levelFilter, strengthFilter, focusFilter, itemsPerPage]);

  useEffect(() => {
    const markNewData = () => setHasNewData(true);
    window.addEventListener("atl-data-updated", markNewData);
    return () => window.removeEventListener("atl-data-updated", markNewData);
  }, []);

  const handleUpdateData = async () => {
    if (!selectedClass || !selectedTopic || isUpdating) return;
    setIsUpdating(true);
    setUpdateError("");
    try {
      const [classesResult, topicsResult, userResult, reportResult] = await Promise.allSettled([
        getClasses(),
        getTopics(),
        getCurrentUser(),
        getReport(selectedClass, selectedTopic),
      ]);
      const cache = readReportCache();
      const nextCatalog = { ...(cache.catalog || {}) };
      if (classesResult.status === "fulfilled") {
        const labels = classesResult.value.map((item) => item.displayName || item.display_name || item.code).filter(Boolean);
        setClassOptions(labels);
        nextCatalog.classes = labels;
      }
      if (topicsResult.status === "fulfilled") {
        const user = userResult.status === "fulfilled" ? userResult.value : currentUser;
        const accessibleSubjects = filterSubjectsByUserAccess(topicsResult.value || [], user);
        setCurrentUser(user);
        setSubjects(accessibleSubjects);
        nextCatalog.subjects = accessibleSubjects;
      }
      if (classesResult.status === "fulfilled" || topicsResult.status === "fulfilled") {
        nextCatalog.updatedAt = new Date().toISOString();
      }

      if (reportResult.status === "fulfilled") {
        const updatedAt = new Date().toISOString();
        const key = reportSnapshotKey(selectedClass, selectedTopic);
        const nextCache = {
          ...cache,
          version: REPORT_CACHE_VERSION,
          catalog: nextCatalog,
          lastFilter: { cls: selectedClass, subj: selectedSubject, topic: selectedTopic, perPage: itemsPerPage },
          snapshots: trimSnapshots({
            ...(cache.snapshots || {}),
            [key]: { report: reportResult.value, updatedAt },
          }),
        };
        writeReportCache(nextCache);
        localStorage.removeItem("report_filter_pref");
        setApiReport(reportResult.value);
        setSnapshotUpdatedAt(updatedAt);
        setHasNewData(false);
      } else {
        writeReportCache({ ...cache, catalog: nextCatalog });
        setUpdateError("Update gagal, menampilkan snapshot terakhir. Pastikan backend aktif lalu coba lagi.");
      }
    } catch {
      setUpdateError("Update gagal, menampilkan snapshot terakhir. Cache browser tidak dapat diperbarui.");
    } finally {
      setIsUpdating(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    getCurrentUser().then((user) => {
      if (cancelled) return;
      const accessibleSubjects = filterSubjectsByUserAccess(subjects, user);
      setCurrentUser(user);
      if (accessibleSubjects.length > 0) {
        setSubjects(accessibleSubjects);
        if (!accessibleSubjects.some((subject) => subject.id === selectedSubject)) {
          const nextSubject = accessibleSubjects[0];
          const nextTopic = nextSubject.topics?.[0]?.id || "";
          setSelectedSubject(nextSubject.id);
          setSelectedTopic(nextTopic);
          selectSnapshot(selectedClass, nextTopic);
        }
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const currentSubject = useMemo(
    () => subjects.find((s) => s.id === selectedSubject) || subjects[0],
    [subjects, selectedSubject]
  );
  const currentTopicLabel = useMemo(
    () => currentSubject?.topics.find((t) => t.id === selectedTopic)?.label || selectedTopic,
    [currentSubject, selectedTopic]
  );
  const reportGeneratedDate = useMemo(
    () =>
      new Intl.DateTimeFormat("en-US", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      }).format(new Date()),
    []
  );

const ratingNumericMap = {
  EE: 90,
  ME: 70,
  DE: 50,
  PTE: 30,
  NFI: 10,
};
const scoreLevel = getScoreLevel;
  const ratingMeaning = {
    NFI: "Belum menunjukkan perilaku yang diharapkan dan masih membutuhkan bantuan intensif.",
    PTE: "Mulai mencoba, tetapi performa masih belum stabil dan perlu banyak arahan.",
    DE: "Sedang berkembang; siswa sudah berusaha namun konsistensinya masih perlu dilatih.",
    ME: "Sudah memenuhi ekspektasi utama pada kriteria ini secara cukup konsisten.",
    EE: "Melebihi ekspektasi; performa tampak kuat, mandiri, dan konsisten.",
  };
  const scoreScaleInfo = getScoreDistributionConfig(false).map((item) => ({
    ...item,
    fullLabel: item.fullLabel || item.description || item.label,
    meaning: ratingMeaning[item.label] || item.description,
  }));
  const getScoreDisplayLabel = (level, mode = "full") => {
    const meta = level || getNoDataLevel();
    if (meta.label === "No Data") return "No Data";
    return mode === "short" ? meta.label : meta.fullLabel || meta.description || meta.label;
  };
  const getScoreTone = (level) => {
    const meta = level || getNoDataLevel();
    return {
      color: meta.color || "#a8a29e",
      className: meta.className || meta.badgeClass || "bg-stone-100 text-stone-600",
      softStyle: {
        borderColor: meta.color ? `${meta.color}44` : "#e7e5e4",
        backgroundColor: meta.color ? `${meta.color}12` : "#f5f5f4",
        color: meta.color || "#78716c",
      },
    };
  };
  const expandScoreBandText = (text = "") => (
    String(text || "")
      .replace(/\bEE\b/g, "Exceeding Expectation")
      .replace(/\bME\b/g, "Meeting Expectation")
      .replace(/\bDE\b/g, "Developing Expectation")
      .replace(/\bPTE\b/g, "Progressing Toward Expectation")
      .replace(/\bNFI\b/g, "Need Further Improvement")
  );
  const atlCategoryOrder = ["Thinking Skills", "Research Skills", "Communication Skills", "Social Skills", "Self-Management Skills"];
  const exportColumns = [
    { key: "no", label: "NO" },
    { key: "className", label: "CLASS" },
    { key: "nis", label: "NIS" },
    { key: "name", label: "NAME" },
    { key: "score", label: "FUZZY AHP SCORE" },
    { key: "predikat", label: "GRADE / PREDIKAT" },
    { key: "progress", label: "PROGRESS" },
    { key: "thinking", label: "THINKING SKILLS" },
    { key: "research", label: "RESEARCH SKILLS" },
    { key: "communication", label: "COMMUNICATION SKILLS" },
    { key: "social", label: "SOCIAL SKILLS" },
    { key: "selfManagement", label: "SELF-MANAGEMENT SKILLS" },
  ];

  // Data mentah kalkulasi (Skor & Kategori)
  const allCalculatedData = useMemo(() => {
    if (Array.isArray(apiReport?.students)) return apiReport.students;
    return [];
  }, [apiReport]);

  const categoryFilterOptions = atlCategoryOrder;
  const levelFilterOptions = ["EE", "ME", "DE", "PTE", "NFI", "No Data"];
  const getStudentCategoryValue = (student, categoryName) => {
    const value = Number(student?.catAverages?.[categoryName] ?? 0);
    return Number.isFinite(value) ? value : 0;
  };
  const getStudentStrongestCategory = (student) => (
    [...atlCategoryOrder]
      .map((category) => ({ category, score: getStudentCategoryValue(student, category) }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)[0]?.category || "-"
  );
  const getStudentFocusCategory = (student) => (
    [...atlCategoryOrder]
      .map((category) => ({ category, score: getStudentCategoryValue(student, category) }))
      .filter((item) => item.score > 0)
      .sort((a, b) => a.score - b.score)[0]?.category || "-"
  );
  const filteredCalculatedData = useMemo(() => (
    allCalculatedData.filter((student) => {
      const query = searchText.trim().toLowerCase();
      const rawScore = Number(student.rawScore ?? student.score ?? 0);
      const hasScore = Number.isFinite(rawScore) && rawScore > 0;
      const level = hasScore ? scoreLevel(rawScore) : getNoDataLevel();
      const levelLabel = hasScore ? level.label : "No Data";
      const strongest = getStudentStrongestCategory(student);
      const focus = getStudentFocusCategory(student);
      const matchesSearch = !query || [
        student.name,
        student.nis,
        student.id,
        student.predikat,
        getScoreDisplayLabel(level),
        strongest,
        focus,
      ].some((value) => String(value || "").toLowerCase().includes(query));
      const matchesStatus = statusFilter === "all"
        || (statusFilter === "assessed" && hasScore)
        || (statusFilter === "empty" && !hasScore);
      const matchesLevel = levelFilter === "all" || levelLabel === levelFilter;
      const matchesStrength = strengthFilter === "all" || strongest === strengthFilter;
      const matchesFocus = focusFilter === "all" || focus === focusFilter;
      return matchesSearch && matchesStatus && matchesLevel && matchesStrength && matchesFocus;
    })
  ), [allCalculatedData, focusFilter, levelFilter, searchText, statusFilter, strengthFilter]);

  // Pagination logic
  const calculatedReports = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredCalculatedData.slice(start, start + itemsPerPage);
  }, [filteredCalculatedData, currentPage, itemsPerPage]);

  const avgClassScore = useMemo(() => {
    if (allCalculatedData.length === 0) return 0;
    const sum = allCalculatedData.reduce((acc, s) => acc + parseFloat(s.score), 0);
    return (sum / allCalculatedData.length).toFixed(1);
  }, [allCalculatedData]);

  // Analytics Logic
  const stats = useMemo(() => {
    const distributionKeys = getScoreDistributionConfig().map((item) => item.key);
    const emptyDist = distributionKeys.reduce((acc, key) => ({ ...acc, [key]: 0 }), {});
    if (apiReport?.stats) {
      const dist = { ...emptyDist };
      const categoryBuckets = atlCategoryOrder.reduce((acc, category) => ({ ...acc, [category]: [] }), {});
      if (allCalculatedData.length > 0) {
        allCalculatedData.forEach((student) => {
          const rawScore = Number(student.rawScore ?? student.score ?? 0);
          const normalized = rawScore > 0
            ? normalizeScoreBand(student.predikat || student.atlLevel?.label)
            : "No Data";
          dist[normalized] = (dist[normalized] || 0) + 1;
        });
      } else {
        Object.entries(apiReport.stats.dist || {}).forEach(([key, value]) => {
          const normalized = normalizeScoreBand(key);
          dist[normalized] = (dist[normalized] || 0) + Number(value || 0);
        });
      }
      (apiReport.stats.cats || []).forEach((cat) => {
        const normalized = normalizeATLCategory(cat.name || cat.category);
        const value = Number(cat.val ?? cat.score ?? 0);
        if (categoryBuckets[normalized] && Number.isFinite(value) && value > 0) categoryBuckets[normalized].push(value);
      });
      if (!Object.values(categoryBuckets).some((values) => values.length > 0)) {
        allCalculatedData.forEach((student) => {
          const categoryRows = student.atlCategoryScores || buildATLCategoryScores(student.detailItems || [], student.catAverages || {});
          categoryRows.forEach((categoryRow) => {
            const normalized = normalizeATLCategory(categoryRow.name || categoryRow.category);
            const value = Number(categoryRow.score ?? categoryRow.val ?? 0);
            if (categoryBuckets[normalized] && Number.isFinite(value) && value > 0) categoryBuckets[normalized].push(value);
          });
        });
      }
      const cats = atlCategoryOrder.map((category) => {
        const values = categoryBuckets[category];
        const val = values.length ? (values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(1) : 0;
        return { name: category, val };
      });
      return { ...apiReport.stats, dist, cats };
    }

    const assessed = allCalculatedData.filter(s => s.rawScore > 0).length;
    const dist = { ...emptyDist };
    const catAvg = { "Thinking Skills": 0, "Social Skills": 0, "Communication Skills": 0, "Self-Management Skills": 0, "Research Skills": 0 };

    allCalculatedData.forEach(s => {
      const normalized = normalizeScoreBand(s.predikat);
      dist[normalized] = (dist[normalized] || 0) + 1;
      Object.keys(catAvg).forEach(cat => {
        catAvg[cat] += parseFloat(s.catAverages[cat] || 0);
      });
    });

    const cats = Object.keys(catAvg).map(cat => ({
      name: cat,
      val: allCalculatedData.length > 0 ? (catAvg[cat] / allCalculatedData.length).toFixed(1) : 0
    }));

    const strongest = [...cats].sort((a, b) => b.val - a.val)[0];

    return { assessed, dist, cats, strongest };
  }, [allCalculatedData, apiReport]);

  const distributionConfig = useMemo(() => (
    getScoreDistributionConfig().map((item) => {
      const matched = scoreScaleInfo.find((scale) => scale.label === item.label);
      return {
        ...item,
        fullLabel: item.label === "No Data" ? "No Data" : matched?.fullLabel || item.fullLabel || item.description || item.label,
        meaning: matched?.meaning || item.description,
      };
    })
  ), []);

  const distributionData = useMemo(() => {
    const total = distributionConfig.reduce((acc, item) => acc + (stats.dist[item.key] || 0), 0);
    const radius = 42;
    const circumference = 2 * Math.PI * radius;

    const { slices } = distributionConfig.reduce((acc, item) => {
      const count = stats.dist[item.key] || 0;
      const ratio = total > 0 ? count / total : 0;
      const dash = ratio * circumference;
      const offset = -acc.cumulativeRatio * circumference;
      return {
        cumulativeRatio: acc.cumulativeRatio + ratio,
        slices: [
          ...acc.slices,
          {
            ...item,
            count,
            ratio,
            percentage: total > 0 ? (ratio * 100).toFixed(1) : "0.0",
            dash,
            offset,
          },
        ],
      };
    }, { cumulativeRatio: 0, slices: [] });

    return { total, circumference, radius, slices };
  }, [distributionConfig, stats.dist]);

  const buildStudentDetailReport = useCallback(
    (student) => {
      if (Array.isArray(student.detailItems) && student.detailItems.length > 0) {
        const assessedCount = student.assessedCount ?? student.detailItems.filter((item) => item.ratingCode).length;
        const totalIndicators = student.totalIndicators ?? student.detailItems.length;
        const atlCategoryScores = student.atlCategoryScores || buildATLCategoryScores(student.detailItems, student.catAverages || {});
        return {
          ...student,
          summaryParagraph: expandScoreBandText(
            student.summaryParagraph ||
            `${student.name} achieved an ATL score of ${student.score} in ${currentTopicLabel}.`
          ),
          assessedCount,
          totalIndicators,
          atlLevel: student.atlLevel || scoreLevel(student.score || student.rawScore),
          atlCategoryScores,
          teacherInsight: expandScoreBandText(student.teacherInsight || buildTeacherInsightText(student, student.detailItems, assessedCount, totalIndicators)),
        };
      }

      const detailItems = [];
      const assessedCount = 0;
      const totalIndicators = 0;
      const summaryParagraph = `${student.name} sudah ada pada report backend, tetapi detail indikator belum tersedia dari endpoint report untuk filter ini.`;

      return {
        ...student,
        summaryParagraph,
        detailItems,
        assessedCount,
        totalIndicators,
        atlLevel: scoreLevel(student.score || student.rawScore),
        atlCategoryScores: buildATLCategoryScores(detailItems, student.catAverages || {}),
        teacherInsight: buildTeacherInsightText(student, detailItems, assessedCount, totalIndicators),
      };
    },
    [currentTopicLabel]
  );

  const safeFilePart = (value) => (
    String(value || "ATL_Report")
      .replace(/[^a-z0-9._-]+/gi, "_")
      .replace(/^_+|_+$/g, "")
  );

  const getCategoryExportValue = (student, categoryName) => {
    const raw = student.catAverages?.[categoryName];
    if (raw === undefined || raw === null || raw === "" || Number(raw) === 0) return "-";
    const numeric = Number(raw);
    return Number.isFinite(numeric) ? Number(numeric.toFixed(2)) : raw;
  };

  const getPerformanceDisplay = (student, mode = "short") => {
    const score = Number(student?.rawScore ?? student?.score ?? 0);
    if (!Number.isFinite(score) || score <= 0 || normalizeScoreBand(student?.predikat) === "No Data") {
      const level = getNoDataLevel();
      return { label: getScoreDisplayLabel(level, mode), className: level.className || level.badgeClass, level };
    }
    const level = scoreLevel(score);
    return { label: getScoreDisplayLabel(level, mode), className: level.className || level.badgeClass, level };
  };

  function buildATLCategoryScores(detailItems, catAverages = {}) {
    const buckets = atlCategoryOrder.reduce((acc, category) => ({ ...acc, [category]: [] }), {});
    atlCategoryOrder.forEach((category) => {
      const raw = catAverages?.[category];
      const numeric = Number(raw);
      if (raw !== undefined && raw !== null && raw !== "" && numeric > 0) buckets[category].push(numeric);
    });

    (detailItems || []).forEach((item) => {
      const numeric = ratingNumericMap[item.ratingCode];
      if (!numeric) return;
      let categories = [];
      if (Array.isArray(item.subskills) && item.subskills.length > 0) {
        categories = item.subskills.map((subskill) => subskill.category?.name).filter(Boolean);
      }
      if (categories.length === 0 && item.categoryName) {
        categories = String(item.categoryName).split(",").map((category) => category.trim()).filter(Boolean);
      }
      if (categories.length === 0 && item.atlName) {
        const subskillCategory = getSubskillMeta(item.atlName).categoryName;
        if (subskillCategory) categories = [subskillCategory];
      }
      if (categories.length === 0 && atlCategoryOrder.includes(normalizeATLCategory(item.atlName))) {
        categories = [normalizeATLCategory(item.atlName)];
      }
      categories.forEach((category) => {
        const normalized = normalizeATLCategory(category);
        if (buckets[normalized]) buckets[normalized].push(numeric);
      });
    });

    return atlCategoryOrder.map((category) => {
      const values = buckets[category];
      const score = values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
      return {
        name: category,
        score: Number(score.toFixed(1)),
        assessedIndicators: values.length,
        level: scoreLevel(score),
      };
    });
  }

  function buildTeacherInsightText(student, detailItems, assessedCount, totalIndicators) {
    const score = Number(student.score || student.rawScore || 0);
    const level = scoreLevel(score);
    const assessed = (detailItems || []).filter((item) => item.ratingCode);
    const strong = assessed.filter((item) => ["EE", "ME"].includes(item.ratingCode));
    const focus = assessed.filter((item) => ["DE", "PTE", "NFI"].includes(item.ratingCode));
    const uniqueNames = (items) => [...new Set(items.map((item) => item.atlName || item.kriteria).filter(Boolean))].slice(0, 2).join(", ");
    const evidence = assessed.find((item) => item.levelDescription)?.levelDescription;
    let text = `${student.name} berada pada level ${getScoreDisplayLabel(level)} dalam ${currentSubject?.label || selectedSubject} (${currentTopicLabel}) dengan skor ATL ${score.toFixed(2)}, berdasarkan ${assessedCount}/${totalIndicators} indikator softskill ATL yang sudah dinilai.`;
    if (uniqueNames(strong)) text += ` Kekuatan utama tampak pada ${uniqueNames(strong)}.`;
    if (uniqueNames(focus)) text += ` Area yang perlu diperkuat adalah ${uniqueNames(focus)}.`;
    if (evidence) text += ` Catatan rubric utama: ${evidence}`;
    return text;
  }

  const buildExcelRows = useCallback(() => (
    filteredCalculatedData.map((student, index) => {
      const scoreValue = Number(student.score);
      return {
        no: index + 1,
        className: selectedClass,
        nis: student.nis || student.id || "-",
        name: student.name || "-",
        score: Number.isFinite(scoreValue) ? Number(scoreValue.toFixed(2)) : "-",
        predikat: getPerformanceDisplay(student).label,
        progress: student.progress || "-",
        thinking: getCategoryExportValue(student, "Thinking Skills"),
        research: getCategoryExportValue(student, "Research Skills"),
        communication: getCategoryExportValue(student, "Communication Skills"),
        social: getCategoryExportValue(student, "Social Skills"),
        selfManagement: getCategoryExportValue(student, "Self-Management Skills"),
      };
    })
  ), [filteredCalculatedData, selectedClass]);
  const activeFilterCount = [
    statusFilter !== "all",
    levelFilter !== "all",
    strengthFilter !== "all",
    focusFilter !== "all",
  ].filter(Boolean).length;
  const resetTableFilters = () => {
    setSearchText("");
    setStatusFilter("all");
    setLevelFilter("all");
    setStrengthFilter("all");
    setFocusFilter("all");
    setCurrentPage(1);
  };
  const snapshotStatus = useMemo(() => {
    if (isUpdating) return { label: "Memperbarui data...", tone: "border-blue-200 bg-blue-50 text-blue-700", icon: "sync" };
    if (updateError) return { label: updateError, tone: "border-red-200 bg-red-50 text-red-700", icon: "error" };
    if (hasNewData) return { label: "Data penilaian baru tersedia. Tekan Update Data untuk menampilkan hasil terbaru.", tone: "border-amber-300 bg-amber-50 text-amber-800", icon: "notification_important" };
    if (snapshotUpdatedAt) {
      return {
        label: `Snapshot terakhir: ${new Date(snapshotUpdatedAt).toLocaleString("id-ID")}`,
        tone: "border-emerald-200 bg-emerald-50 text-emerald-700",
        icon: "database",
      };
    }
    return { label: "Belum diperbarui. Grafik nol belum mewakili data backend.", tone: "border-stone-200 bg-stone-50 text-stone-600", icon: "info" };
  }, [hasNewData, isUpdating, snapshotUpdatedAt, updateError]);

  const excelFilename = useMemo(() => (
    `ATL_Report_${safeFilePart(selectedClass)}_${safeFilePart(currentSubject?.label || selectedSubject)}_${safeFilePart(currentTopicLabel)}.xlsx`
  ), [selectedClass, currentSubject, selectedSubject, currentTopicLabel]);

  const excelPayload = useMemo(() => ({
    meta: {
      className: selectedClass,
      subject: currentSubject?.label || selectedSubject,
      subTopic: currentTopicLabel,
      rowCount: excelPreviewRows.length,
      generatedAt: new Date().toLocaleString("id-ID"),
      filename: excelFilename,
    },
    columns: exportColumns,
    rows: excelPreviewRows,
  }), [selectedClass, currentSubject, selectedSubject, currentTopicLabel, excelFilename, excelPreviewRows]);

  const handleOpenExcelPreview = () => {
    if (!snapshotUpdatedAt) {
      setExportError("Update Data terlebih dahulu agar Excel memakai snapshot report backend.");
      return;
    }
    const rows = buildExcelRows();
    if (rows.length === 0) {
      setExportError("Tidak ada siswa pada hasil search/filter yang bisa diexport.");
      return;
    }
    setExportError("");
    setExcelPreviewRows(rows);
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
      const message = error?.message || "Export Excel gagal. Pastikan server backend sedang berjalan lalu coba lagi.";
      setExportError(message);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="flex h-screen w-full overflow-hidden">
      <Sidebar active="report" />

      <main className="relative flex flex-1 flex-col overflow-hidden bg-stone-50">
        <div className="flex-1 overflow-y-auto p-4 lg:p-8">
          <div className="mx-auto flex max-w-6xl flex-col gap-8">
            {/* Header */}
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div className="flex flex-col gap-1">
                <span className="w-fit rounded bg-primary/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-primary-hover">
                  Main Page / Report & Export
                </span>
                <h1 className="mt-2 text-2xl font-black text-text-main-light lg:text-3xl">
                  ATL Analysis Report
                </h1>
                <p className="text-sm text-text-sub-light">
                  Hasil analisis ATL berbasis importance weight dan rubric performance.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleUpdateData}
                  disabled={isUpdating || !selectedClass || !selectedTopic}
                  className="inline-flex items-center gap-2 rounded-2xl bg-primary px-6 py-3 text-sm font-black text-white shadow-[0_14px_28px_rgba(245,166,9,0.22)] transition-all hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <span className={`material-symbols-outlined text-[18px] ${isUpdating ? "animate-spin" : ""}`}>{isUpdating ? "sync" : "refresh"}</span>
                  {isUpdating ? "Memperbarui..." : "Update Data"}
                </button>
              </div>
            </div>

            <div className={`flex items-center gap-3 rounded-2xl border px-5 py-4 text-sm font-bold ${snapshotStatus.tone}`}>
              <span className={`material-symbols-outlined text-[19px] ${isUpdating ? "animate-spin" : ""}`}>{snapshotStatus.icon}</span>
              <span className="flex-1">{snapshotStatus.label}</span>
              {snapshotUpdatedAt && <span className="rounded-full bg-white/70 px-3 py-1 text-[10px] font-black uppercase tracking-wider">Snapshot aktif</span>}
            </div>

            {/* Summary Cards */}
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-[1.8rem] border border-stone-200 bg-white p-4 shadow-[0_18px_40px_rgba(15,23,42,0.06)] lg:p-6 transition-all hover:shadow-lg hover:border-yellow-300 hover:-translate-y-1 cursor-pointer">
                <div className="flex items-start gap-3">
                  <span className="material-symbols-outlined text-3xl text-yellow-500">group</span>
                  <div>
                    <span className="block text-xs font-semibold text-stone-500">Total Siswa Dinilai</span>
                    <span className="mt-1 block text-xl font-black text-text-main-light lg:text-2xl">{stats.assessed} / {allCalculatedData.length} Siswa</span>
                  </div>
                </div>
              </div>

              <div className="rounded-[1.8rem] border border-stone-200 bg-white p-4 shadow-[0_18px_40px_rgba(15,23,42,0.06)] lg:p-6 transition-all hover:shadow-lg hover:border-green-300 hover:-translate-y-1 cursor-pointer">
                <div className="flex items-start gap-3">
                  <span className="material-symbols-outlined text-3xl text-green-500">trending_up</span>
                  <div>
                    <span className="block text-xs font-semibold text-stone-500">Rata-rata Kelas</span>
                    <span className="mt-1 block text-lg font-black text-text-main-light lg:text-xl">
                      {avgClassScore}{" "}
                      <span className="text-xs font-bold" style={{ color: scoreLevel(avgClassScore).color || "#16a34a" }}>
                        ({getScoreDisplayLabel(scoreLevel(avgClassScore))})
                      </span>
                    </span>
                  </div>
                </div>
              </div>

              <div className="rounded-[1.8rem] border border-stone-200 bg-white p-4 shadow-[0_18px_40px_rgba(15,23,42,0.06)] lg:p-6 transition-all hover:shadow-lg hover:border-orange-300 hover:-translate-y-1 cursor-pointer">
                <div className="flex items-start gap-3">
                  <span className="material-symbols-outlined text-3xl text-orange-500">emoji_events</span>
                  <div>
                    <span className="block text-xs font-semibold text-stone-500">Kategori Terkuat</span>
                    <span className="mt-1 block text-lg font-black text-text-main-light lg:text-xl">{stats.strongest?.name || "-"}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Charts Section */}
            <div className="grid gap-4 lg:grid-cols-2">
              {/* Distribusi Predikat */}
              <section className="rounded-[1.8rem] border border-stone-200 bg-white p-4 shadow-[0_18px_40px_rgba(15,23,42,0.06)] lg:p-6 transition-all hover:shadow-lg hover:border-emerald-300">
                <span className="block text-sm font-bold text-stone-800">Distribusi Predikat</span>
                <div className="mt-5 grid items-center gap-6 sm:grid-cols-2">
                  <div className="relative mx-auto h-52 w-52">
                    <svg viewBox="0 0 120 120" className="h-full w-full">
                      <circle cx="60" cy="60" r={distributionData.radius} fill="none" stroke="#e5e7eb" strokeWidth="16" />
                      {distributionData.total > 0 && distributionData.slices.map((slice) => (
                        slice.count > 0 ? (
                          <circle
                            key={slice.key}
                            cx="60"
                            cy="60"
                            r={distributionData.radius}
                            fill="none"
                            stroke={slice.color}
                            strokeWidth="16"
                            strokeLinecap="butt"
                            strokeDasharray={`${slice.dash} ${distributionData.circumference - slice.dash}`}
                            strokeDashoffset={slice.offset}
                            transform="rotate(-90 60 60)"
                          />
                        ) : null
                      ))}
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                      <span className="text-3xl font-black text-stone-900">{distributionData.total}</span>
                      <span className="text-[11px] font-semibold uppercase tracking-widest text-stone-500">Total Siswa</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {distributionData.slices.map((slice) => (
                      <div key={slice.key} className="flex items-center justify-between rounded-xl border border-stone-200 bg-stone-50 px-3 py-2">
                        <div className="flex items-center gap-2">
                          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: slice.color }} />
                          <span className="text-xs font-semibold text-stone-700">
                            {slice.fullLabel || slice.label || slice.key}
                          </span>
                        </div>
                        <div className="text-right">
                          <div className="text-xs font-black text-stone-900">{slice.count}</div>
                          <div className="text-[10px] font-medium text-stone-500">{slice.percentage}%</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </section>

              {/* Rata-rata Kategori ATL */}
              <section className="rounded-[1.8rem] border border-stone-200 bg-white p-4 shadow-[0_18px_40px_rgba(15,23,42,0.06)] lg:p-6 transition-all hover:shadow-lg hover:border-yellow-300 cursor-pointer">
                <div className="mb-4 flex items-center justify-between">
                  <span className="block text-sm font-bold text-stone-800">Rata-rata Kelas per Kategori ATL</span>
                  <span className="inline-flex items-center gap-1 rounded-full border border-yellow-300 bg-yellow-50 px-2 py-1 text-xs font-semibold text-yellow-600 transition-all hover:bg-yellow-100 hover:shadow-md cursor-pointer">
                    <span className="material-symbols-outlined text-[14px]">info</span>
                    Nilai Kelas
                  </span>
                </div>
                <div className="space-y-3">
                  {stats.cats.map((cat) => (
                    <div key={cat.name}>
                      <div className="mb-1 flex items-center justify-between text-xs font-medium text-stone-600">
                        <span>{cat.name}</span>
                        <span className="font-bold text-stone-900">{cat.val}</span>
                      </div>
                      <div className="h-2.5 w-full overflow-hidden rounded-full bg-stone-200">
                        <div
                          className="h-full rounded-full bg-yellow-500 transition-all"
                          style={{ width: `${cat.val}%` }}
                        ></div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </div>

            <section className="rounded-[1.8rem] border border-stone-200 bg-white p-5 shadow-[0_18px_40px_rgba(15,23,42,0.06)]">
              <div className="mb-4 flex flex-col gap-1">
                <span className="text-xs uppercase tracking-[0.24em] text-stone-500">Filter Kelas dan Tabel</span>
                <h2 className="text-xl font-black text-stone-900">Atur tampilan report</h2>
                <p className="text-sm font-semibold text-stone-500">
                  {filteredCalculatedData.length} dari {allCalculatedData.length} siswa cocok dengan filter aktif.
                </p>
              </div>

              <div className="grid gap-3 lg:grid-cols-3 xl:grid-cols-[1fr_1fr_1fr_auto]">
                <select
                  value={selectedClass}
                  onChange={(e) => {
                    const nextClass = e.target.value;
                    setSelectedClass(nextClass);
                    selectSnapshot(nextClass, selectedTopic);
                  }}
                  className="h-12 rounded-2xl border border-stone-200 bg-stone-50 px-4 text-sm font-semibold text-stone-900 outline-none transition focus:border-primary/60 focus:ring-4 focus:ring-primary/10"
                >
                  {classOptions.length > 0
                    ? classOptions.map(c => <option key={c} value={c}>{c}</option>)
                    : <option value={selectedClass}>{selectedClass}</option>}
                </select>
                <select
                  value={selectedSubject}
                  onChange={(e) => {
                    const nextSubject = e.target.value;
                    const nextTopic = subjects.find(s => s.id === nextSubject)?.topics?.[0]?.id || "";
                    setSelectedSubject(nextSubject);
                    setSelectedTopic(nextTopic);
                    selectSnapshot(selectedClass, nextTopic);
                  }}
                  className="h-12 rounded-2xl border border-stone-200 bg-stone-50 px-4 text-sm font-semibold text-stone-900 outline-none transition focus:border-primary/60 focus:ring-4 focus:ring-primary/10"
                >
                  {subjects.length > 0
                    ? subjects.map(s => <option key={s.id} value={s.id}>{s.label}</option>)
                    : <option value={selectedSubject}>{selectedSubject}</option>}
                </select>
                <select
                  value={selectedTopic}
                  onChange={(e) => {
                    const nextTopic = e.target.value;
                    setSelectedTopic(nextTopic);
                    selectSnapshot(selectedClass, nextTopic);
                  }}
                  className="h-12 rounded-2xl border border-stone-200 bg-stone-50 px-4 text-sm font-semibold text-stone-900 outline-none transition focus:border-primary/60 focus:ring-4 focus:ring-primary/10"
                >
                  {(currentSubject?.topics || []).length > 0
                    ? currentSubject.topics.map(t => <option key={t.id} value={t.id}>{t.label}</option>)
                    : <option value={selectedTopic}>{selectedTopic}</option>}
                </select>
                <button
                  type="button"
                  onClick={handleOpenExcelPreview}
                  disabled={!snapshotUpdatedAt || filteredCalculatedData.length === 0 || exporting}
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 text-sm font-black text-emerald-700 transition hover:border-emerald-300 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-[18px]">download</span>
                  Export Excel
                </button>
              </div>

              <div className="mt-3 flex flex-col gap-3 border-t border-stone-200 pt-3 lg:flex-row lg:items-center lg:justify-between">
                <label className="relative block min-w-0 flex-1">
                  <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-stone-400">
                    <span className="material-symbols-outlined text-[19px]">search</span>
                  </span>
                  <input
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                    placeholder="Cari nama, NIS, predikat, kategori ATL..."
                    className="h-12 w-full rounded-2xl border border-stone-200 bg-white pl-11 pr-4 text-sm font-semibold text-stone-700 outline-none transition focus:border-primary/60 focus:ring-4 focus:ring-primary/10"
                  />
                </label>
                <div className="flex flex-wrap items-center gap-2">
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
                    {[5, 10].map((size) => (
                      <button
                        key={size}
                        type="button"
                        onClick={() => {
                          setItemsPerPage(size);
                          setCurrentPage(1);
                        }}
                        className={`h-10 rounded-xl px-5 text-sm font-black transition ${
                          itemsPerPage === size
                            ? "bg-primary text-white shadow-sm shadow-primary/20"
                            : "text-stone-600 hover:bg-stone-50"
                        }`}
                      >
                        {size} List
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {showFilterPanel && (
                <div className="mt-3 grid gap-3 rounded-3xl border border-stone-200 bg-stone-50 p-4 md:grid-cols-2 xl:grid-cols-[repeat(4,minmax(0,1fr))_auto]">
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
                    className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-stone-200 bg-white px-4 text-sm font-black text-stone-700 transition hover:border-primary/50 hover:text-primary"
                  >
                    <span className="material-symbols-outlined text-[18px]">filter_alt_off</span>
                    Reset Filter
                  </button>
                </div>
              )}
            </section>

            {/* Table */}
            <section className="overflow-hidden rounded-[1.8rem] border border-stone-200 bg-white shadow-[0_18px_40px_rgba(15,23,42,0.06)] transition-all hover:shadow-lg hover:border-primary/20 cursor-pointer">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-stone-200 bg-stone-50">
                      <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-widest text-stone-500">NIS</th>
                      <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-widest text-stone-500">Nama Siswa</th>
                      <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-widest text-stone-500">Skor Fuzzy AHP</th>
                      <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-widest text-stone-500">Predikat</th>
                      <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-widest text-stone-500">Progress</th>
                      <th className="px-5 py-4 text-right text-xs font-semibold uppercase tracking-widest text-stone-500">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {calculatedReports.map((s) => {
                      const isReportOpen = selectedDetailStudent?.nis === s.nis;
                      return (
                      <React.Fragment key={s.nis}>
                      <tr className={`transition-all hover:bg-stone-50 hover:shadow-sm ${isReportOpen ? "bg-primary/5" : ""}`}>
                        <td className="px-5 py-4 text-xs font-medium text-stone-600 transition-all group-hover:text-primary">{s.nis}</td>
                        <td className="px-5 py-4 text-sm font-medium text-stone-900">
                          <div className="flex items-center gap-2">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-amber-100 to-orange-200 text-xs font-bold text-stone-900">
                              {s.name.split(' ').map(n => n[0]).join('').substring(0, 2)}
                            </div>
                            {s.name}
                          </div>
                        </td>
                        <td className="px-5 py-4 text-sm font-bold text-stone-900">{s.score}</td>
                        <td className="px-5 py-4 text-sm font-semibold text-stone-900">
                          <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${getPerformanceDisplay(s).className}`}>
                            {getPerformanceDisplay(s).label}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-sm font-semibold text-stone-900">
                          <span className={s.progress.includes('+') ? 'text-emerald-600' : s.progress === '0.0' ? 'text-stone-600' : 'text-red-600'}>
                            {s.progress}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-right">
                          <button
                            type="button"
                            onClick={() => setSelectedDetailStudent(isReportOpen ? null : buildStudentDetailReport(s))}
                            className={`inline-flex items-center gap-1 rounded-2xl px-3 py-2 text-sm font-bold transition-all ${
                              isReportOpen
                                ? "bg-stone-900 text-white"
                                : "bg-primary/10 text-primary hover:bg-primary/15"
                            }`}
                          >
                            <span>{isReportOpen ? "Tutup" : "View Report"}</span>
                            <span className="material-symbols-outlined text-[16px]">{isReportOpen ? "keyboard_arrow_up" : "keyboard_arrow_down"}</span>
                          </button>
                        </td>
                      </tr>
                      {isReportOpen && selectedDetailStudent && (
                        <tr className="bg-primary/5">
                          <td colSpan={6} className="px-5 pb-6 pt-0">
                            <div className="overflow-hidden rounded-[1.5rem] border border-primary/20 bg-white shadow-[0_16px_40px_rgba(15,23,42,0.08)]">
                              <div className="flex flex-col gap-4 border-b border-stone-200 bg-gradient-to-r from-amber-50 via-white to-stone-50 p-5 lg:flex-row lg:items-center lg:justify-between">
                                <div className="flex min-w-0 items-center gap-4">
                                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-yellow-100 via-orange-100 to-amber-200 text-sm font-black text-stone-950 shadow-sm">
                                    {selectedDetailStudent.name.split(" ").map((part) => part[0]).join("").slice(0, 2)}
                                  </div>
                                  <div className="min-w-0">
                                    <p className="truncate text-lg font-black text-stone-950">{selectedDetailStudent.name}</p>
                                    <p className="mt-1 text-xs font-semibold text-stone-500">
                                      {selectedDetailStudent.nis || selectedDetailStudent.id || "-"} - {selectedClass} - {currentSubject?.label || selectedSubject} - {currentTopicLabel}
                                    </p>
                                  </div>
                                </div>
                                <div className="grid grid-cols-3 gap-2 lg:min-w-[360px]">
                                  <div className="rounded-2xl bg-white px-4 py-3 ring-1 ring-stone-200">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-stone-400">Skor Akhir</p>
                                    <p className="mt-1 text-xl font-black text-stone-950">{Number(selectedDetailStudent.score || 0).toFixed(2)}</p>
                                  </div>
                                  <div className="rounded-2xl bg-white px-4 py-3 ring-1 ring-stone-200">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-stone-400">Predikat</p>
                                    <span
                                      className="mt-2 inline-flex rounded-xl px-3 py-1 text-xs font-black"
                                      style={{
                                        backgroundColor: `${getScoreTone(selectedDetailStudent.atlLevel || scoreLevel(selectedDetailStudent.score)).color}14`,
                                        color: getScoreTone(selectedDetailStudent.atlLevel || scoreLevel(selectedDetailStudent.score)).color,
                                      }}
                                    >
                                      {(selectedDetailStudent.atlLevel || scoreLevel(selectedDetailStudent.score)).label}
                                    </span>
                                  </div>
                                  <div className="rounded-2xl bg-white px-4 py-3 ring-1 ring-stone-200">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-stone-400">Indikator Ternilai</p>
                                    <p className="mt-1 text-xl font-black text-stone-950">{selectedDetailStudent.assessedCount || 0}/{selectedDetailStudent.totalIndicators || 0}</p>
                                  </div>
                                </div>
                              </div>

                              <div className="p-5">
                                <div className="grid gap-5 lg:grid-cols-[1fr_280px]">
                                  <div className="rounded-2xl border border-yellow-200 bg-gradient-to-br from-yellow-50 via-white to-amber-50 p-5">
                                    <div className="flex gap-4">
                                      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-yellow-100 text-yellow-700 ring-1 ring-yellow-200">
                                        <span className="material-symbols-outlined text-[26px]">lightbulb</span>
                                      </span>
                                      <div className="border-l-2 border-yellow-400 pl-5">
                                        <h4 className="text-base font-black text-slate-950">Teacher Insight</h4>
                                        <p className="mt-3 text-sm font-medium leading-7 text-slate-800">
                                          {expandScoreBandText(selectedDetailStudent.teacherInsight || selectedDetailStudent.summaryParagraph)}
                                        </p>
                                      </div>
                                    </div>
                                  </div>
                                  <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5 text-center">
                                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-stone-500">Predikat</p>
                                    <span
                                      className="mt-4 inline-flex h-16 min-w-16 items-center justify-center rounded-full px-4 text-2xl font-black"
                                      style={{
                                        backgroundColor: `${getScoreTone(selectedDetailStudent.atlLevel || scoreLevel(selectedDetailStudent.score)).color}14`,
                                        color: getScoreTone(selectedDetailStudent.atlLevel || scoreLevel(selectedDetailStudent.score)).color,
                                      }}
                                    >
                                      {(selectedDetailStudent.atlLevel || scoreLevel(selectedDetailStudent.score)).label}
                                    </span>
                                    <p className="mt-3 text-sm font-black text-stone-950">
                                      {getScoreDisplayLabel(selectedDetailStudent.atlLevel || scoreLevel(selectedDetailStudent.score))}
                                    </p>
                                    <p className="mt-1 text-xs font-semibold text-stone-500">
                                      {scoreScaleInfo.find((item) => item.label === (selectedDetailStudent.atlLevel || scoreLevel(selectedDetailStudent.score)).label)?.range || "0-100"}
                                    </p>
                                  </div>
                                </div>

                                <section className="mt-5 overflow-visible rounded-2xl border border-stone-200 bg-white">
                                  <div className="border-b border-stone-200 px-5 py-4">
                                    <div className="flex items-center gap-2">
                                      <h4 className="text-lg font-black text-slate-950">ATL Performance by Category</h4>
                                      <FormulaHint text="Ringkasan ini memakai 5 kategori resmi ATL. Nilai kategori dihitung dari indikator rubric yang sudah dinilai." />
                                    </div>
                                  </div>
                                  <div className="divide-y divide-stone-200">
                                    {(selectedDetailStudent.atlCategoryScores || buildATLCategoryScores(selectedDetailStudent.detailItems || [], selectedDetailStudent.catAverages || {})).map((category) => {
                                      const meta = getATLCategoryMeta(category.name);
                                      return (
                                        <div key={category.name} className="grid gap-4 px-5 py-4 md:grid-cols-[1fr_140px_180px] md:items-center">
                                          <div className="flex items-center gap-4">
                                            <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ring-1 ${meta.toneClass}`}>
                                              <span className="material-symbols-outlined text-[24px]">{meta.icon}</span>
                                            </span>
                                            <div>
                                              <p className="text-sm font-black text-slate-950">{category.name}</p>
                                              <p className="mt-1 text-xs font-semibold text-slate-500">
                                                {category.assessedIndicators > 0
                                                  ? `${category.assessedIndicators} indikator ternilai`
                                                  : "Tidak ada indikator yang dinilai untuk kategori ini"}
                                              </p>
                                            </div>
                                          </div>
                                          <div className="text-left md:text-center">
                                            <p className="text-[10px] font-black uppercase tracking-wider text-stone-400">Numeric Score</p>
                                            <p className="mt-1 text-2xl font-black text-slate-950">{Number(category.score || 0).toFixed(1)}</p>
                                          </div>
                                          <div className="md:text-right">
                                            <p
                                              className="text-sm font-black"
                                              style={{ color: getScoreTone(category.level || scoreLevel(category.score)).color }}
                                            >
                                              {getScoreDisplayLabel(category.level || scoreLevel(category.score))}
                                            </p>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </section>

                                <div className="mt-5 rounded-2xl border border-yellow-200 bg-yellow-50 px-5 py-4">
                                  <div className="flex gap-3">
                                    <span className="material-symbols-outlined text-[24px] text-yellow-700">info</span>
                                    <p className="text-sm font-medium leading-7 text-slate-700">
                                      Laporan ini dihasilkan otomatis oleh ATL Assessment System berbasis Fuzzy-AHP dan menggunakan data penilaian rubric yang tersimpan pada sistem.
                                    </p>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                      </React.Fragment>
                    );
                    })}
                    {calculatedReports.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-5 py-14 text-center">
                          <span className="material-symbols-outlined text-5xl text-stone-300">manage_search</span>
                          <p className="mt-3 text-sm font-black text-stone-700">Tidak ada siswa sesuai filter saat ini.</p>
                          <p className="mt-1 text-xs font-semibold text-stone-400">Ubah kata kunci atau reset filter untuk melihat data report.</p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between border-t border-stone-200 bg-stone-50 px-5 py-3">
                <p className="text-xs font-medium text-stone-500">
                  Menampilkan {filteredCalculatedData.length ? (currentPage - 1) * itemsPerPage + 1 : 0}-{Math.min(currentPage * itemsPerPage, filteredCalculatedData.length)} dari {filteredCalculatedData.length} siswa
                </p>
                <div className="flex items-center gap-2">
                  <button 
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(prev => prev - 1)}
                    className="rounded-lg border border-stone-200 bg-white px-2 py-1 text-stone-600 transition-all hover:bg-stone-50 disabled:opacity-30">
                    <span className="material-symbols-outlined text-[18px]">chevron_left</span>
                  </button>
                  <button className="rounded-lg bg-primary px-3 py-1 text-xs font-bold text-white">{currentPage}</button>
                  <button 
                    disabled={currentPage * itemsPerPage >= filteredCalculatedData.length}
                    onClick={() => setCurrentPage(prev => prev + 1)}
                    className="rounded-lg border border-stone-200 bg-white px-2 py-1 text-stone-600 transition-all hover:bg-stone-50 disabled:opacity-30">
                    <span className="material-symbols-outlined text-[18px]">chevron_right</span>
                  </button>
                </div>
              </div>
              <div className="border-t border-stone-200 bg-white px-5 py-5">
                <div className="grid gap-4 lg:grid-cols-[1fr_1.3fr]">
                  <div className="rounded-2xl border border-yellow-200 bg-yellow-50/70 p-4">
                    <div className="flex items-start gap-3">
                      <span className="material-symbols-outlined mt-0.5 text-[20px] text-yellow-600">info</span>
                      <div>
                        <p className="text-sm font-black text-stone-950">Keterangan Kolom</p>
                        <p className="mt-2 text-xs font-semibold leading-5 text-stone-600">
                          <b>Skor Fuzzy AHP</b> adalah nilai akhir ATL siswa dari rubric yang sudah dinilai dan bobot subskill. <b>Progress</b> menunjukkan perubahan skor dibanding data penilaian sebelumnya pada filter yang sama.
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
                    <p className="text-sm font-black text-stone-950">Predikat Penilaian</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {distributionConfig.map((item) => (
                        <span
                          key={item.key}
                          className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-black ${item.className || "bg-white text-stone-700"}`}
                        >
                          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
                          {item.fullLabel || item.label}
                        </span>
                      ))}
                    </div>
                    <div className="mt-3 space-y-2 text-xs font-semibold leading-5 text-stone-600">
                      {scoreScaleInfo.map((item) => (
                        <p key={item.label}>
                          <b style={{ color: item.color }}>{item.fullLabel}</b>: {item.meaning}
                        </p>
                      ))}
                      <p><b>No Data</b>: siswa belum memiliki nilai pada filter ini.</p>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>

        {showExcelPreview && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
            <div className="flex max-h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-[2rem] border border-yellow-200 bg-white shadow-[0_26px_70px_rgba(15,23,42,0.28)]">
              <div className="flex flex-col gap-4 border-b border-stone-200 bg-gradient-to-r from-yellow-50 via-white to-amber-50 px-6 py-5 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.22em] text-yellow-600">Excel Preview</p>
                  <h3 className="mt-1 text-2xl font-black text-stone-950">ATL Score List</h3>
                  <p className="mt-1 text-sm font-medium text-stone-600">
                    {selectedClass} | {currentSubject?.label || selectedSubject} | {currentTopicLabel}
                  </p>
                  <p className="mt-2 text-xs font-semibold text-stone-500">
                    {excelPreviewRows.length} siswa hasil filter akan diexport ke file <span className="font-black text-stone-800">{excelFilename}</span>.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowExcelPreview(false);
                      setExportError("");
                    }}
                    disabled={exporting}
                    className="inline-flex items-center justify-center rounded-2xl border border-stone-200 bg-white px-5 py-3 text-sm font-bold text-stone-700 transition-all hover:bg-stone-50 disabled:opacity-60"
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
                    className="rounded-full border border-stone-200 bg-white p-3 text-stone-600 transition-all hover:bg-stone-50 disabled:opacity-60"
                    aria-label="Close Excel preview"
                  >
                    <span className="material-symbols-outlined text-[18px]">close</span>
                  </button>
                </div>
              </div>

              <div className="border-b border-yellow-100 bg-yellow-50/70 px-6 py-3">
                <div className="grid gap-3 text-xs font-semibold text-stone-700 md:grid-cols-5">
                  <div className="rounded-xl bg-white/80 px-3 py-2 ring-1 ring-yellow-200">
                    <p className="text-[10px] font-black uppercase tracking-wider text-yellow-700">Kelas</p>
                    <p className="mt-1 text-stone-950">{selectedClass}</p>
                  </div>
                  <div className="rounded-xl bg-white/80 px-3 py-2 ring-1 ring-yellow-200">
                    <p className="text-[10px] font-black uppercase tracking-wider text-yellow-700">Mapel</p>
                    <p className="mt-1 text-stone-950">{currentSubject?.label || selectedSubject}</p>
                  </div>
                  <div className="rounded-xl bg-white/80 px-3 py-2 ring-1 ring-yellow-200">
                    <p className="text-[10px] font-black uppercase tracking-wider text-yellow-700">Subtopik</p>
                    <p className="mt-1 text-stone-950">{currentTopicLabel}</p>
                  </div>
                  <div className="rounded-xl bg-white/80 px-3 py-2 ring-1 ring-yellow-200">
                    <p className="text-[10px] font-black uppercase tracking-wider text-yellow-700">Total Siswa</p>
                    <p className="mt-1 text-stone-950">{excelPreviewRows.length}</p>
                  </div>
                  <div className="rounded-xl bg-white/80 px-3 py-2 ring-1 ring-yellow-200">
                    <p className="text-[10px] font-black uppercase tracking-wider text-yellow-700">Jam Export</p>
                    <p className="mt-1 text-stone-950">{excelPayload.meta.generatedAt}</p>
                  </div>
                </div>
                <div className="mt-3 flex items-start gap-2 text-xs font-medium leading-6 text-stone-700">
                  <span className="material-symbols-outlined mt-0.5 text-[17px] text-yellow-600">info</span>
                  <span>
                    Preview ini memakai payload yang sama dengan file Excel. Jika isi tabel di sini sudah benar, file XLSX akan mengikuti urutan kolom dan semua baris siswa hasil filter ini.
                  </span>
                </div>
                {exportError && (
                  <div className="mt-3 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold leading-5 text-red-700">
                    <span className="material-symbols-outlined mt-0.5 text-[17px]">error</span>
                    <span>{exportError}</span>
                  </div>
                )}
              </div>

              <div className="flex-1 overflow-auto p-5">
                <div className="min-w-[1180px] overflow-hidden rounded-2xl border border-stone-200 bg-white">
                  <table className="w-full border-collapse text-left">
                    <thead>
                      <tr className="bg-yellow-400">
                        {exportColumns.map((column) => (
                          <th key={column.key} className="border border-yellow-500/50 px-3 py-3 text-[11px] font-black uppercase tracking-wider text-stone-950">
                            {column.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {excelPreviewRows.map((row) => (
                        <tr key={`${row.no}-${row.nis}`} className="odd:bg-white even:bg-stone-50">
                          {exportColumns.map((column) => (
                            <td key={column.key} className="border border-stone-200 px-3 py-3 text-xs font-semibold text-stone-700">
                              {row[column.key]}
                            </td>
                          ))}
                        </tr>
                      ))}
                      {excelPreviewRows.length === 0 && (
                        <tr>
                          <td colSpan={exportColumns.length} className="px-4 py-10 text-center text-sm font-semibold text-stone-500">
                            Tidak ada data visible table untuk diexport.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {false && selectedDetailStudent && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4 backdrop-blur-sm">
            <div className="max-h-[94vh] w-full max-w-5xl overflow-hidden rounded-[2rem] border border-stone-200 bg-white shadow-[0_28px_80px_rgba(15,23,42,0.24)]">
              <div className="max-h-[94vh] overflow-y-auto p-6 lg:p-10">
                <div className="flex items-start justify-between gap-4">
                  <p className="text-[12px] font-black uppercase tracking-[0.28em] text-yellow-600">Student ATL Report</p>
                  <button
                    type="button"
                    onClick={() => setSelectedDetailStudent(null)}
                    className="rounded-2xl border border-stone-200 bg-white p-3 text-stone-700 shadow-sm transition-all hover:bg-stone-50 hover:shadow-md"
                  >
                    <span className="material-symbols-outlined text-[24px]">close</span>
                  </button>
                </div>

                <section className="mt-7 flex flex-col gap-6 md:flex-row md:items-center">
                  <div className="flex h-32 w-32 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-yellow-100 via-orange-100 to-amber-200 text-4xl font-black text-stone-900 ring-4 ring-yellow-100">
                    {selectedDetailStudent.name.split(" ").map((part) => part[0]).join("").slice(0, 2)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-3xl font-black leading-tight text-slate-950 lg:text-4xl">{selectedDetailStudent.name}</h3>
                    <div className="mt-5 flex flex-wrap items-center gap-3 text-sm font-semibold text-slate-500">
                      <span className="inline-flex items-center gap-2">
                        <span className="material-symbols-outlined text-[20px]">school</span>
                        {selectedClass}
                      </span>
                      <span className="text-yellow-500">|</span>
                      <span className="inline-flex items-center gap-2">
                        <span className="material-symbols-outlined text-[20px]">music_note</span>
                        {currentSubject?.label || selectedSubject}
                      </span>
                      <span className="text-yellow-500">|</span>
                      <span className="inline-flex items-center gap-2">
                        <span className="material-symbols-outlined text-[20px]">auto_stories</span>
                        {currentTopicLabel}
                      </span>
                    </div>
                  </div>
                </section>

                <section className="mt-8 grid overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm md:grid-cols-3">
                  {[
                    ["groups", "Class", selectedClass],
                    ["badge", "Student ID (NIS)", selectedDetailStudent.nis || selectedDetailStudent.id || "-"],
                    ["calendar_month", "Assessment Date", reportGeneratedDate],
                  ].map(([icon, label, value], index) => (
                    <div key={label} className={`flex items-center gap-4 px-6 py-5 ${index < 2 ? "border-b border-stone-200 md:border-b-0 md:border-r" : ""}`}>
                      <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-yellow-50 text-yellow-700 ring-1 ring-yellow-200">
                        <span className="material-symbols-outlined text-[28px]">{icon}</span>
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-slate-500">{label}</p>
                        <p className="mt-1 text-lg font-black text-slate-950">{value}</p>
                      </div>
                    </div>
                  ))}
                </section>

                <section className="mt-7 grid gap-5 lg:grid-cols-[1fr_280px]">
                  <div className="rounded-2xl border border-yellow-200 bg-gradient-to-br from-yellow-50 via-white to-amber-50 p-6">
                    <div className="flex gap-5">
                      <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-yellow-100 text-yellow-700 ring-1 ring-yellow-200">
                        <span className="material-symbols-outlined text-[34px]">lightbulb</span>
                      </span>
                      <div className="border-l-2 border-yellow-400 pl-6">
                        <h4 className="text-lg font-black text-slate-950">Teacher Insight</h4>
                        <p className="mt-4 text-sm font-medium leading-7 text-slate-800">
                          {expandScoreBandText(selectedDetailStudent.teacherInsight || selectedDetailStudent.summaryParagraph)}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div
                    className="flex flex-col items-center justify-center rounded-2xl border bg-white p-6 text-center"
                    style={getScoreTone(selectedDetailStudent.atlLevel || scoreLevel(selectedDetailStudent.score)).softStyle}
                  >
                    <p
                      className="text-[11px] font-black uppercase tracking-[0.28em]"
                      style={{ color: getScoreTone(selectedDetailStudent.atlLevel || scoreLevel(selectedDetailStudent.score)).color }}
                    >
                      ATL Level
                    </p>
                    <span
                      className="mt-6 flex h-16 w-16 items-center justify-center rounded-full text-white shadow-[0_18px_32px_rgba(15,23,42,0.14)]"
                      style={{ backgroundColor: getScoreTone(selectedDetailStudent.atlLevel || scoreLevel(selectedDetailStudent.score)).color }}
                    >
                      <span className="material-symbols-outlined text-[34px]">star</span>
                    </span>
                    <p className="mt-6 text-2xl font-black tracking-wide text-slate-950">
                      {getScoreDisplayLabel(selectedDetailStudent.atlLevel || scoreLevel(selectedDetailStudent.score))}
                    </p>
                    <span className={`mt-3 inline-flex rounded-full px-3 py-1 text-xs font-black ${(selectedDetailStudent.atlLevel || scoreLevel(selectedDetailStudent.score)).className}`}>
                      {Number(selectedDetailStudent.score || 0).toFixed(2)}
                    </span>
                    <p className="mt-3 text-sm leading-6 text-slate-700">
                      {(selectedDetailStudent.atlLevel || scoreLevel(selectedDetailStudent.score)).description}
                    </p>
                  </div>
                </section>

                <section className="mt-7 overflow-visible rounded-2xl border border-stone-200 bg-white">
                  <div className="border-b border-stone-200 px-6 py-4">
                    <div className="flex items-center gap-2">
                      <h4 className="text-xl font-black text-slate-950">ATL Performance by Category</h4>
                      <FormulaHint text="Ringkasan ini selalu memakai 5 kategori resmi ATL. Alias seperti Communication atau Self-Management digabung ke nama resmi agar tidak muncul kategori dobel." />
                    </div>
                    <p className="mt-1 text-sm font-semibold text-slate-500">
                      Nilai numerik 5 jenis ATL dihitung dari indikator rubric dan skala fuzzy yang sudah dinilai.
                    </p>
                  </div>
                  <div className="divide-y divide-stone-200-justify-between px-6 py-5">
                    {(selectedDetailStudent.atlCategoryScores || buildATLCategoryScores(selectedDetailStudent.detailItems || [], selectedDetailStudent.catAverages || {})).map((category) => {
                      const meta = getATLCategoryMeta(category.name);
                      return (
                        <div key={category.name} className="grid gap-4 px-6 py-5 md:grid-cols-[1fr_160px_120px] md:items-center">
                          <div className="flex items-center gap-4">
                            <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ring-1 ${meta.toneClass}`}>
                              <span className="material-symbols-outlined text-[30px]">{meta.icon}</span>
                            </span>
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="text-lg font-black text-slate-950">{category.name}</p>
                                <FormulaHint text={`Rumus: skor ${category.name} = rata-rata nilai indikator softskill ATL pada kategori ini. Level rubric dikonversi menjadi NFI=10, PTE=30, DE=50, ME=70, EE=90, lalu dirata-ratakan dari indikator yang tersedia.`} />
                              </div>
                              <p className="mt-1 text-sm leading-6 text-slate-600">
                                {category.assessedIndicators > 0
                                  ? `Nilai ${Number(category.score || 0).toFixed(1)} diambil dari rata-rata ${category.assessedIndicators} indikator softskill ATL dalam subtopik ${currentTopicLabel}.`
                                  : `Belum ada indikator ${category.name} yang dinilai pada subtopik ${currentTopicLabel}.`}
                              </p>
                            </div>
                          </div>
                          <div className="text-left md:text-center">
                            <p className="text-[11px] font-black uppercase tracking-wider text-stone-400">Numeric Score</p>
                            <p className="mt-1 text-3xl font-black text-slate-950">{Number(category.score || 0).toFixed(1)}</p>
                          </div>
                          <div className="md:text-right">
                            <span className={`inline-flex rounded-full px-3 py-1 text-xs font-black ${category.level?.className || scoreLevel(category.score).className}`}>
                              {getScoreDisplayLabel(category.level || scoreLevel(category.score))}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>

                <section className="mt-7">
                  <h4 className="text-xl font-black text-slate-950">Teacher Signature</h4>
                  <div className="mt-4 grid overflow-hidden rounded-2xl border border-stone-200 bg-white md:grid-cols-[1fr_1fr]">
                    <div className="flex items-center gap-4 border-b border-stone-200 px-6 py-5 md:border-b-0 md:border-r">
                      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-yellow-100 to-orange-200 text-lg font-black text-stone-900">JW</span>
                      <div>
                        <p className="text-lg font-black text-slate-950">Mrs. Joko Wiryanto</p>
                        <p className="mt-1 text-sm font-semibold text-slate-500">{currentSubject?.label || selectedSubject} Teacher</p>
                      </div>
                    </div>
                    <div className="flex flex-col items-center justify-center px-6 py-5">
                      <p className="font-serif text-4xl text-yellow-600">Joko</p>
                      <p className="mt-2 text-sm font-semibold text-slate-500">{reportGeneratedDate}</p>
                    </div>
                  </div>
                </section>

                <div className="mt-6 rounded-2xl border border-yellow-200 bg-yellow-50 px-6 py-4">
                  <div className="flex gap-4">
                    <span className="material-symbols-outlined text-[30px] text-yellow-700">info</span>
                    <p className="text-sm font-medium leading-7 text-slate-700">
                      Laporan ini dihasilkan otomatis oleh ATL Assessment System berbasis Fuzzy-AHP dan menggunakan data penilaian rubric yang tersimpan pada sistem.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

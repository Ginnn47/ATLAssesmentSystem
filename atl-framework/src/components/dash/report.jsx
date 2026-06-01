import React, { useState, useMemo, useEffect, useCallback } from "react";
import Sidebar from "./sidebar";
import { dummyATL } from "../dummyData/dummyATL";
import { allStudentsData } from "../dummyData/dummyStudents";
import { exportReportExcel, getReport, getStudents, hydrateTopic } from "../../services/atlApi";
import {
  getATLCategoryMeta,
  getScoreDistributionConfig,
  getScoreLevel,
  getSubskillMeta,
  hydrateLabelRegistry,
  normalizeScoreBand,
  normalizeATLCategory,
} from "../../services/labelRegistry";
import { getSubjectData } from "../../services/topicCatalog";

const FormulaHint = ({ text }) => (
  <span className="group relative inline-flex">
    <span className="material-symbols-outlined cursor-help text-[16px] text-stone-400 transition group-hover:text-primary">info</span>
    <span className="pointer-events-none absolute left-1/2 top-full z-30 mt-2 hidden w-80 -translate-x-1/2 rounded-xl border border-stone-200 bg-white p-3 text-[11px] font-semibold leading-5 text-stone-700 shadow-xl group-hover:block">
      {text}
    </span>
  </span>
);

export default function Report() {
  const currentUser = { name: "Joko Wiryanto", role: "Guru / Evaluator" };

  const classOptions = Object.keys(allStudentsData);
  const [selectedClass, setSelectedClass] = useState(classOptions.find(c => c.includes("3A")) || classOptions[0]);
  const [selectedSubject, setSelectedSubject] = useState("singing");
  const [selectedTopic, setSelectedTopic] = useState("singing_christmas_carol");

  const [itemsPerPage, setItemsPerPage] = useState(5);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedDetailStudent, setSelectedDetailStudent] = useState(null);
  const [apiStudents, setApiStudents] = useState(allStudentsData[selectedClass] || []);
  const [apiReport, setApiReport] = useState(null);
  const [subjects, setSubjects] = useState(getSubjectData);

  // State untuk memicu re-render saat data di localStorage berubah
  const [dataVersion, setDataVersion] = useState(0);
  const [showExcelPreview, setShowExcelPreview] = useState(false);
  const [excelPreviewRows, setExcelPreviewRows] = useState([]);
  const [exporting, setExporting] = useState(false);

  const syncDataFromStorage = useCallback(() => {
    const savedData = localStorage.getItem("atl_framework_data");
    if (savedData) {
      const parsed = JSON.parse(savedData);
      Object.assign(dummyATL, parsed);
      setDataVersion(v => v + 1);
    }
  }, []);

  // Load Persistensi Pilihan & Sinkronisasi Data Terbaru
  useEffect(() => {
    // 1. Sinkronisasi data dari localStorage
    syncDataFromStorage();
    hydrateLabelRegistry().then(() => setDataVersion((v) => v + 1));

    // 2. Load Filter Preference
    const savedPref = localStorage.getItem("report_filter_pref");
    if (savedPref) {
      const { cls, subj, topic, perPage } = JSON.parse(savedPref);
      setSelectedClass(cls);
      setSelectedSubject(subj);
      setSelectedTopic(topic);
      if (perPage === 5 || perPage === 10) setItemsPerPage(perPage);
    }
  }, [syncDataFromStorage]);

  useEffect(() => {
    let cancelled = false;
    getStudents(selectedClass).then((students) => {
      if (!cancelled) setApiStudents(students);
    });
    return () => {
      cancelled = true;
    };
  }, [selectedClass]);

  useEffect(() => {
    if (!selectedTopic) return undefined;
    let cancelled = false;
    Promise.all([hydrateTopic(selectedTopic), getReport(selectedClass, selectedTopic)]).then(([, report]) => {
      if (!cancelled) {
        setApiReport(report);
        setDataVersion((v) => v + 1);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [selectedClass, selectedTopic]);

  useEffect(() => {
    const syncTopics = () => setSubjects(getSubjectData());
    window.addEventListener("focus", syncDataFromStorage);
    window.addEventListener("storage", syncDataFromStorage);
    window.addEventListener("atl-data-updated", syncDataFromStorage);
    window.addEventListener("atl-topics-updated", syncTopics);

    return () => {
      window.removeEventListener("focus", syncDataFromStorage);
      window.removeEventListener("storage", syncDataFromStorage);
      window.removeEventListener("atl-data-updated", syncDataFromStorage);
      window.removeEventListener("atl-topics-updated", syncTopics);
    };
  }, [syncDataFromStorage]);

  const saveReportPreference = () => {
    const pref = { cls: selectedClass, subj: selectedSubject, topic: selectedTopic, perPage: itemsPerPage };
    localStorage.setItem("report_filter_pref", JSON.stringify(pref));
    alert(`View filter disimpan: ${selectedClass} - ${selectedSubject} - ${selectedTopic}`);
  };

  const currentSubject = useMemo(
    () => subjects.find((s) => s.id === selectedSubject) || subjects[0],
    [selectedSubject]
  );
  const currentTopicLabel = useMemo(
    () => currentSubject?.topics.find((t) => t.id === selectedTopic)?.label || selectedTopic,
    [currentSubject, selectedTopic]
  );
  const currentTopicIndex = useMemo(() => {
    const idx = currentSubject?.topics.findIndex((t) => t.id === selectedTopic) ?? -1;
    return idx >= 0 ? idx + 1 : "-";
  }, [currentSubject, selectedTopic]);
  const reportGeneratedDate = useMemo(
    () =>
      new Intl.DateTimeFormat("en-US", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      }).format(new Date()),
    []
  );

  // Mapping label ke nilai numerik untuk kalkulasi
  const ratingMap = {
    "Exceeding Expectation": 0.9,
    "Meeting Expectation": 0.7,
    "Developing Expectation": 0.5,
    "Progressing Toward Expectation": 0.3,
    "Need Further Improvement": 0.1,
    "Need Improvement": 0.1
  };
  const ratingCodeMap = {
    "Exceeding Expectation": "EE",
    "Meeting Expectation": "ME",
    "Developing Expectation": "DE",
    "Progressing Toward Expectation": "PTE",
    "Need Further Improvement": "NFI",
    "Need Improvement": "NFI",
  };
  const ratingNumericMap = {
    EE: 90,
    ME: 70,
    DE: 50,
    PTE: 30,
    NFI: 10,
  };
  const scoreLevel = getScoreLevel;
  const atlCategoryOrder = ["Thinking Skills", "Research Skills", "Communication Skills", "Social Skills", "Self-Management Skills"];
  const exportColumns = [
    { key: "no", label: "NO" },
    { key: "className", label: "CLASS" },
    { key: "nis", label: "NIS" },
    { key: "name", label: "NAME" },
    { key: "subject", label: "SUBJECT" },
    { key: "subTopic", label: "SUB TOPIC" },
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
    if (apiReport?.students?.length > 0) return apiReport.students;

    const students = apiStudents.length > 0 ? apiStudents : allStudentsData[selectedClass] || [];
    const weights = dummyATL.savedWeights?.[selectedTopic] || {};
    const criteriaList = dummyATL[selectedTopic] || [];

    return students.map(student => {
      const assessments = dummyATL.savedAssessments?.[student.id]?.[selectedTopic] || {};
      const catScores = { "Thinking Skills": 0, "Social Skills": 0, "Communication Skills": 0, "Self-Management Skills": 0, "Research Skills": 0 };
      const catWeights = { "Thinking Skills": 0, "Social Skills": 0, "Communication Skills": 0, "Self-Management Skills": 0, "Research Skills": 0 };
      
      let totalWeightedScore = 0;
      let totalWeight = 0;

      criteriaList.forEach(crit => {
        crit.atl.forEach(atlName => {
          const weightKey = `${crit.kriteria} (${atlName})`;
          const packageWeight = Object.values(weights.packages || {}).find((pkg) => pkg.title === crit.kriteria)?.weights?.[atlName];
          const weight = parseFloat(packageWeight ?? weights[weightKey] ?? weights[atlName]) || 0;
          
          const ratingKey = `${selectedTopic}_${crit.kriteria}_${atlName}`;
          const ratingLabel = assessments[ratingKey]; 

          if (ratingLabel && ratingMap[ratingLabel]) {
            const val = ratingMap[ratingLabel];
            totalWeightedScore += (val * weight);
            totalWeight += weight;

            const categories = crit.atlCategories || (crit.category ? crit.category.split(",").map((name) => name.trim()).filter(Boolean) : [atlName]);
            categories.forEach((categoryName) => {
              const normalizedCategory = normalizeATLCategory(categoryName);
              if (!Object.prototype.hasOwnProperty.call(catScores, normalizedCategory)) return;
              catScores[normalizedCategory] += (val * 100 * weight);
              catWeights[normalizedCategory] += weight;
            });
          }
        });
      });

      // Jika tidak ada kriteria/bobot, skor default
      const finalScore = totalWeight > 0 ? ((totalWeightedScore / totalWeight) * 100) : 0;
      
      return {
        ...student,
        score: finalScore.toFixed(2),
        rawScore: finalScore,
        predikat: finalScore === 0 ? "No Data" : scoreLevel(finalScore).label,
        progress: finalScore > 75 ? "+2.5" : "-1.2",
        catAverages: Object.keys(catScores).reduce((acc, cat) => {
          acc[cat] = catWeights[cat] > 0 ? (catScores[cat] / catWeights[cat]).toFixed(1) : 0;
          return acc;
        }, {})
      };
    });
  }, [selectedClass, selectedTopic, dataVersion, apiStudents, apiReport]);

  // Pagination logic
  const calculatedReports = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return allCalculatedData.slice(start, start + itemsPerPage);
  }, [allCalculatedData, currentPage, itemsPerPage]);

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
      Object.entries(apiReport.stats.dist || {}).forEach(([key, value]) => {
        const normalized = normalizeScoreBand(key);
        dist[normalized] = (dist[normalized] || 0) + Number(value || 0);
      });
      (apiReport.stats.cats || []).forEach((cat) => {
        const normalized = normalizeATLCategory(cat.name || cat.category);
        const value = Number(cat.val ?? cat.score ?? 0);
        if (categoryBuckets[normalized] && Number.isFinite(value) && value > 0) categoryBuckets[normalized].push(value);
      });
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
  }, [allCalculatedData, apiReport, dataVersion]);

  const distributionConfig = useMemo(() => getScoreDistributionConfig(), [dataVersion]);

  const distributionData = useMemo(() => {
    const total = distributionConfig.reduce((acc, item) => acc + (stats.dist[item.key] || 0), 0);
    let cumulativeRatio = 0;
    const radius = 42;
    const circumference = 2 * Math.PI * radius;

    const slices = distributionConfig.map((item) => {
      const count = stats.dist[item.key] || 0;
      const ratio = total > 0 ? count / total : 0;
      const dash = ratio * circumference;
      const offset = -cumulativeRatio * circumference;
      cumulativeRatio += ratio;
      return {
        ...item,
        count,
        ratio,
        percentage: total > 0 ? (ratio * 100).toFixed(1) : "0.0",
        dash,
        offset,
      };
    });

    return { total, circumference, radius, slices };
  }, [stats.dist]);

  const buildStudentDetailReport = useCallback(
    (student) => {
      if (Array.isArray(student.detailItems) && student.detailItems.length > 0) {
        const assessedCount = student.assessedCount ?? student.detailItems.filter((item) => item.ratingCode).length;
        const totalIndicators = student.totalIndicators ?? student.detailItems.length;
        const atlCategoryScores = student.atlCategoryScores || buildATLCategoryScores(student.detailItems, student.catAverages || {});
        return {
          ...student,
          summaryParagraph:
            student.summaryParagraph ||
            `${student.name} achieved an ATL score of ${student.score} in ${currentTopicLabel}.`,
          assessedCount,
          totalIndicators,
          atlLevel: student.atlLevel || scoreLevel(student.score || student.rawScore),
          atlCategoryScores,
          teacherInsight: student.teacherInsight || buildTeacherInsightText(student, student.detailItems, assessedCount, totalIndicators),
        };
      }

      const criteriaList = dummyATL[selectedTopic] || [];
      const assessments = dummyATL.savedAssessments?.[student.id]?.[selectedTopic] || {};

      const detailItems = [];
      criteriaList.forEach((criterion) => {
        (criterion.atl || []).forEach((atlName) => {
          const ratingKey = `${selectedTopic}_${criterion.kriteria}_${atlName}`;
          const ratingLabel = assessments[ratingKey];
          const ratingCode = ratingCodeMap[ratingLabel] || null;
          const levelDescription = ratingCode
            ? criterion.levels?.[ratingCode] || "Level description is not available."
            : "No assessment input is available for this indicator yet.";

          detailItems.push({
            kriteria: criterion.kriteria,
            atlName,
            ratingCode,
            ratingLabel: ratingLabel || "Not Assessed",
            levelDescription,
          });
        });
      });

      const assessedCount = detailItems.filter((item) => item.ratingCode).length;
      const totalIndicators = detailItems.length;
      const predikatText = normalizeScoreBand(student.predikat);
      const summaryParagraph = totalIndicators === 0
        ? `${student.name} is enrolled in ${currentSubject?.label}, sub-topic ${currentTopicIndex} (${currentTopicLabel}), but no ATL criteria are configured for this topic yet, so a narrative report cannot be generated.`
        : `${student.name} in ${currentSubject?.label}, sub-topic ${currentTopicIndex} (${currentTopicLabel}), achieved a Fuzzy AHP score of ${student.score} with the performance band "${predikatText}". Out of ${totalIndicators} ATL indicators, ${assessedCount} indicators have been assessed and are summarized below in report form.`;

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
    [selectedTopic, currentSubject, currentTopicIndex, currentTopicLabel]
  );

  useEffect(() => {
    setSelectedDetailStudent(null);
  }, [selectedClass, selectedSubject, selectedTopic, dataVersion]);

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

  const getPerformanceDisplay = (student) => {
    const score = Number(student?.rawScore ?? student?.score ?? 0);
    if (!Number.isFinite(score) || score <= 0 || normalizeScoreBand(student?.predikat) === "No Data") {
      const level = scoreLevel(0);
      return { label: level.label, className: level.className || level.badgeClass };
    }
    const level = scoreLevel(score);
    return { label: level.label, className: level.className || level.badgeClass };
  };

  const buildATLCategoryScores = (detailItems, catAverages = {}) => {
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
  };

  const buildTeacherInsightText = (student, detailItems, assessedCount, totalIndicators) => {
    const score = Number(student.score || student.rawScore || 0);
    const level = scoreLevel(score);
    const assessed = (detailItems || []).filter((item) => item.ratingCode);
    const strong = assessed.filter((item) => ["EE", "ME"].includes(item.ratingCode));
    const focus = assessed.filter((item) => ["DE", "PTE", "NFI"].includes(item.ratingCode));
    const uniqueNames = (items) => [...new Set(items.map((item) => item.atlName || item.kriteria).filter(Boolean))].slice(0, 2).join(", ");
    const evidence = assessed.find((item) => item.levelDescription)?.levelDescription;
    let text = `${student.name} berada pada level ${level.label} dalam ${currentSubject?.label || selectedSubject} (${currentTopicLabel}) dengan skor ATL ${score.toFixed(2)}, berdasarkan ${assessedCount}/${totalIndicators} indikator softskill ATL yang sudah dinilai.`;
    if (uniqueNames(strong)) text += ` Kekuatan utama tampak pada ${uniqueNames(strong)}.`;
    if (uniqueNames(focus)) text += ` Area yang perlu diperkuat adalah ${uniqueNames(focus)}.`;
    if (evidence) text += ` Catatan rubric utama: ${evidence}`;
    return text;
  };

  const buildExcelRows = useCallback(() => (
    allCalculatedData.map((student, index) => {
      const scoreValue = Number(student.score);
      return {
        no: index + 1,
        className: selectedClass,
        nis: student.nis || student.id || "-",
        name: student.name || "-",
        subject: currentSubject?.label || selectedSubject,
        subTopic: currentTopicLabel,
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
  ), [allCalculatedData, selectedClass, currentSubject, selectedSubject, currentTopicLabel]);

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
    setExcelPreviewRows(buildExcelRows());
    setShowExcelPreview(true);
  };

  const handleDownloadExcel = async () => {
    if (excelPreviewRows.length === 0) return;
    setExporting(true);
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
      alert("Export Excel gagal. Pastikan server backend sedang berjalan lalu coba lagi.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="flex h-screen w-full overflow-hidden">
      <Sidebar active="report" user={currentUser} />

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
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-2 rounded-2xl border border-stone-200 bg-white px-6 py-3 text-sm font-semibold text-stone-700 transition-all hover:bg-stone-50 hover:border-primary/30 hover:shadow-md"
                >
                  <span className="material-symbols-outlined text-[18px]">print</span>
                  Cetak Laporan
                </button>
                <button
                  type="button"
                  onClick={handleOpenExcelPreview}
                  disabled={calculatedReports.length === 0}
                  className="inline-flex items-center gap-2 rounded-2xl bg-yellow-400 px-6 py-3 text-sm font-bold text-stone-900 transition-all hover:bg-yellow-500 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-[18px]">download</span>
                  Export Excel
                </button>
              </div>
            </div>

            {/* Filters */}
            <section className="rounded-[1.8rem] border border-stone-200 bg-white p-5 shadow-[0_18px_40px_rgba(15,23,42,0.06)]">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                <div>
                  <label className="mb-2 block text-[10px] font-bold uppercase tracking-wider text-stone-500">KELAS</label>
                  <select 
                    value={selectedClass}
                    onChange={(e) => {
                      setSelectedClass(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="block w-full rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-900 outline-none focus:ring-4 focus:ring-primary/10"
                  >
                    {classOptions.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-2 block text-[10px] font-bold uppercase tracking-wider text-stone-500">MATA PELAJARAN</label>
                  <select 
                    value={selectedSubject}
                    onChange={(e) => {
                      setSelectedSubject(e.target.value);
                      setSelectedTopic(subjects.find(s => s.id === e.target.value).topics[0].id);
                      setCurrentPage(1);
                    }}
                    className="block w-full rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm font-semibold text-stone-900 outline-none focus:ring-4 focus:ring-primary/10"
                  >
                    {subjects.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-2 block text-[10px] font-bold uppercase tracking-wider text-stone-500">SUB TOPIK</label>
                  <select 
                    value={selectedTopic}
                    onChange={(e) => {
                      setSelectedTopic(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="block w-full rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm font-semibold text-stone-900 outline-none focus:ring-4 focus:ring-primary/10"
                  >
                    {currentSubject?.topics.map(t => (
                      <option key={t.id} value={t.id}>{t.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-2 block text-[10px] font-bold uppercase tracking-wider text-stone-500">TAMPILKAN</label>
                  <div className="grid grid-cols-2 gap-2">
                    {[5, 10].map((size) => (
                      <button
                        key={size}
                        type="button"
                        onClick={() => {
                          setItemsPerPage(size);
                          setCurrentPage(1);
                        }}
                        className={`rounded-2xl border px-3 py-3 text-sm font-bold transition-all ${
                          itemsPerPage === size
                            ? "border-primary bg-primary text-white shadow-md"
                            : "border-stone-200 bg-stone-50 text-stone-700 hover:border-primary/40 hover:bg-primary/5"
                        }`}
                      >
                        {size} List
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex flex-col justify-end gap-2">
                  <button
                    type="button"
                    onClick={saveReportPreference}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700 transition-all hover:bg-emerald-100"
                  >
                    <span className="material-symbols-outlined text-[18px]">save</span>
                    Save State
                  </button>
                  <p className="truncate text-[11px] font-medium text-stone-500">
                    View: {selectedClass} - {currentSubject?.label} - {currentTopicLabel}
                  </p>
                </div>
              </div>
            </section>

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
                      {avgClassScore} <span className={`text-xs font-bold ${scoreLevel(avgClassScore).textClass || "text-green-600"}`}>({scoreLevel(avgClassScore).label})</span>
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
                          <span className="text-xs font-semibold text-stone-700">{slice.key}</span>
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
                    {calculatedReports.map((s) => (
                      <tr key={s.nis} className="transition-all hover:bg-stone-50 hover:shadow-sm">
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
                            onClick={() => setSelectedDetailStudent(buildStudentDetailReport(s))}
                            className="inline-flex items-center gap-1 text-sm font-bold text-primary transition-all hover:underline hover:gap-2"
                          >
                            <span>View Report</span>
                            <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between border-t border-stone-200 bg-stone-50 px-5 py-3">
                <p className="text-xs font-medium text-stone-500">Menampilkan {(currentPage-1)*itemsPerPage + 1}-{Math.min(currentPage*itemsPerPage, allCalculatedData.length)} dari {allCalculatedData.length} siswa</p>
                <div className="flex items-center gap-2">
                  <button 
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(prev => prev - 1)}
                    className="rounded-lg border border-stone-200 bg-white px-2 py-1 text-stone-600 transition-all hover:bg-stone-50 disabled:opacity-30">
                    <span className="material-symbols-outlined text-[18px]">chevron_left</span>
                  </button>
                  <button className="rounded-lg bg-primary px-3 py-1 text-xs font-bold text-white">{currentPage}</button>
                  <button 
                    disabled={currentPage * itemsPerPage >= allCalculatedData.length}
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
                          {item.key}
                        </span>
                      ))}
                    </div>
                    <p className="mt-3 text-xs font-semibold leading-5 text-stone-500">
                      Critical, Low, Average, Good, dan Excellent adalah lima skala interpretasi skor akhir agar hasil tabel lebih mudah dibaca.
                    </p>
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
                    onClick={() => setShowExcelPreview(false)}
                    disabled={exporting}
                    className="inline-flex items-center justify-center rounded-2xl border border-stone-200 bg-white px-5 py-3 text-sm font-bold text-stone-700 transition-all hover:bg-stone-50 disabled:opacity-60"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadExcel}
                    disabled={exporting || excelPreviewRows.length === 0}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-yellow-400 px-5 py-3 text-sm font-black text-stone-950 shadow-[0_12px_24px_rgba(245,158,11,0.28)] transition-all hover:bg-yellow-500 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <span className="material-symbols-outlined text-[18px]">{exporting ? "hourglass_top" : "download"}</span>
                    {exporting ? "Membuat File..." : "Download XLSX"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowExcelPreview(false)}
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

        {selectedDetailStudent && (
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
                          {selectedDetailStudent.teacherInsight || selectedDetailStudent.summaryParagraph}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col items-center justify-center rounded-2xl border border-yellow-200 bg-white p-6 text-center">
                    <p className="text-[11px] font-black uppercase tracking-[0.28em] text-yellow-600">ATL Level</p>
                    <span className="mt-6 flex h-16 w-16 items-center justify-center rounded-full bg-yellow-400 text-white shadow-[0_18px_32px_rgba(245,158,11,0.25)]">
                      <span className="material-symbols-outlined text-[34px]">star</span>
                    </span>
                    <p className="mt-6 text-2xl font-black uppercase tracking-wide text-slate-950">
                      {selectedDetailStudent.atlLevel?.label || scoreLevel(selectedDetailStudent.score).label}
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
                  <div className="divide-y divide-stone-200">
                    {(selectedDetailStudent.atlCategoryScores || buildATLCategoryScores(selectedDetailStudent.detailItems || [], selectedDetailStudent.catAverages || {})).map((category) => {
                      const meta = getATLCategoryMeta(category.name);
                      return (
                        <div key={category.name} className="grid gap-4 px-6 py-5 md:grid-cols-[1fr_160px_120px] md:items-center">
                          <div className="flex items-center gap-4">
                            <span className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-full ring-1 ${meta.toneClass}`}>
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
                              {category.level?.label || scoreLevel(category.score).label}
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

import React, { useState, useMemo, useEffect, useCallback } from "react";
import Sidebar from "./sidebar";
import { dummyATL } from "./dummyATL";
import { allStudentsData } from "./dummyStudents";
import schoolLogo from "../../assets/Cita_Hati_Christian_School_Logo.jpeg";

export default function Report() {
  const currentUser = { name: "Joko Wiryanto", role: "Guru / Evaluator" };

  const classOptions = Object.keys(allStudentsData);
  const [selectedClass, setSelectedClass] = useState(classOptions.find(c => c.includes("3A")) || classOptions[0]);
  const [selectedSubject, setSelectedSubject] = useState("singing");
  const [selectedTopic, setSelectedTopic] = useState("singing_christmas_carol");

  const [itemsPerPage, setItemsPerPage] = useState(5);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedDetailStudent, setSelectedDetailStudent] = useState(null);

  // State untuk memicu re-render saat data di localStorage berubah
  const [dataVersion, setDataVersion] = useState(0);

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
    window.addEventListener("focus", syncDataFromStorage);
    window.addEventListener("storage", syncDataFromStorage);
    window.addEventListener("atl-data-updated", syncDataFromStorage);

    return () => {
      window.removeEventListener("focus", syncDataFromStorage);
      window.removeEventListener("storage", syncDataFromStorage);
      window.removeEventListener("atl-data-updated", syncDataFromStorage);
    };
  }, [syncDataFromStorage]);

  const saveReportPreference = () => {
    const pref = { cls: selectedClass, subj: selectedSubject, topic: selectedTopic, perPage: itemsPerPage };
    localStorage.setItem("report_filter_pref", JSON.stringify(pref));
    alert(`View filter disimpan: ${selectedClass} - ${selectedSubject} - ${selectedTopic}`);
  };

  const subjects = [
    { id: "singing", label: "Singing", topics: [
      { id: "singing_christmas_carol", label: "Christmas Carol" },
      { id: "singing_choir", label: "Choir" },
      { id: "singing_vocal_technique", label: "Vocal Technique" },
      { id: "singing_music_theory_basics", label: "Music Theory Basics" },
      { id: "singing_performance_practice", label: "Performance Practice" }
    ]},
    { id: "ipa", label: "IPA (Sains)", topics: [
      { id: "ipa_energi_perubahan", label: "Energi Perubahan" },
      { id: "ipa_tata_surya", label: "Tata Surya" },
      { id: "ipa_sistem_tubuh", label: "Sistem Tubuh" },
      { id: "ipa_ekosistem", label: "Ekosistem" }
    ]},
    { id: "math", label: "Math", topics: [
      { id: "math_linear_equations", label: "Linear Equations" },
      { id: "math_quadratic_functions", label: "Quadratic Functions" },
      { id: "math_geometry", label: "Geometry" },
      { id: "math_trigonometry", label: "Trigonometry" },
      { id: "math_statistics", label: "Statistics" }
    ]}
  ];

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
    "Exceeding Expectation": 100,
    "Meeting Expectation": 80,
    "Developing Expectation": 60,
    "Progressing Toward Expectation": 40,
    "Need Improvement": 20
  };
  const ratingCodeMap = {
    "Exceeding Expectation": "EE",
    "Meeting Expectation": "ME",
    "Developing Expectation": "DE",
    "Progressing Toward Expectation": "PTE",
    "Need Improvement": "NFI",
  };
  const performanceBandMap = {
    "Sangat Baik": "Excellent",
    "Baik": "Good",
    "Cukup": "Fair",
    "Kurang": "Needs Improvement",
    "-": "Not Assessed",
  };

  // Data mentah kalkulasi (Skor & Kategori)
  const allCalculatedData = useMemo(() => {
    const students = allStudentsData[selectedClass] || [];
    const weights = dummyATL.savedWeights?.[selectedTopic] || {};
    const criteriaList = dummyATL[selectedTopic] || [];

    return students.map(student => {
      const assessments = dummyATL.savedAssessments?.[student.id]?.[selectedTopic] || {};
      const catScores = { Thinking: 0, Social: 0, Communication: 0, "Self-Management": 0, Research: 0 };
      const catWeights = { Thinking: 0, Social: 0, Communication: 0, "Self-Management": 0, Research: 0 };
      
      let totalWeightedScore = 0;
      let totalWeight = 0;

      criteriaList.forEach(crit => {
        crit.atl.forEach(atlName => {
          const weightKey = `${crit.kriteria} (${atlName})`;
          const weight = parseFloat(weights[weightKey]) || 0;
          
          const ratingKey = `${selectedTopic}_${crit.kriteria}_${atlName}`;
          const ratingLabel = assessments[ratingKey]; 

          if (ratingLabel && ratingMap[ratingLabel]) {
            const val = ratingMap[ratingLabel];
            totalWeightedScore += (val * weight);
            totalWeight += weight;

            catScores[atlName] += (val * weight);
            catWeights[atlName] += weight;
          }
        });
      });

      // Jika tidak ada kriteria/bobot, skor default
      const finalScore = totalWeight > 0 ? (totalWeightedScore / totalWeight) : 0;
      
      return {
        ...student,
        score: finalScore.toFixed(2),
        rawScore: finalScore,
        predikat: finalScore === 0 ? "-" : (finalScore >= 85 ? "Sangat Baik" : finalScore >= 70 ? "Baik" : finalScore >= 50 ? "Cukup" : "Kurang"),
        progress: finalScore > 75 ? "+2.5" : "-1.2",
        catAverages: Object.keys(catScores).reduce((acc, cat) => {
          acc[cat] = catWeights[cat] > 0 ? (catScores[cat] / catWeights[cat]).toFixed(1) : 0;
          return acc;
        }, {})
      };
    });
  }, [selectedClass, selectedTopic, dataVersion]);

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
    const assessed = allCalculatedData.filter(s => s.rawScore > 0).length;
    const dist = { "Sangat Baik": 0, "Baik": 0, "Cukup": 0, "Kurang": 0, "Belum Dinilai": 0 };
    const catAvg = { Thinking: 0, Social: 0, Communication: 0, "Self-Management": 0, Research: 0 };

    allCalculatedData.forEach(s => {
      if (s.predikat === "-") {
        dist["Belum Dinilai"]++;
      } else if (Object.prototype.hasOwnProperty.call(dist, s.predikat)) {
        dist[s.predikat]++;
      }
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
  }, [allCalculatedData]);

  const distributionConfig = [
    { key: "Sangat Baik", color: "#10b981" },
    { key: "Baik", color: "#f59e0b" },
    { key: "Cukup", color: "#f97316" },
    { key: "Kurang", color: "#ef4444" },
    { key: "Belum Dinilai", color: "#94a3b8" },
  ];

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
      const predikatText = performanceBandMap[student.predikat] || student.predikat;
      const summaryParagraph = totalIndicators === 0
        ? `${student.name} is enrolled in ${currentSubject?.label}, sub-topic ${currentTopicIndex} (${currentTopicLabel}), but no ATL criteria are configured for this topic yet, so a narrative report cannot be generated.`
        : `${student.name} in ${currentSubject?.label}, sub-topic ${currentTopicIndex} (${currentTopicLabel}), achieved a Fuzzy AHP score of ${student.score} with the performance band "${predikatText}". Out of ${totalIndicators} ATL indicators, ${assessedCount} indicators have been assessed and are summarized below in report form.`;

      return {
        ...student,
        summaryParagraph,
        detailItems,
        assessedCount,
        totalIndicators,
      };
    },
    [selectedTopic, currentSubject, currentTopicIndex, currentTopicLabel, performanceBandMap]
  );

  useEffect(() => {
    setSelectedDetailStudent(null);
  }, [selectedClass, selectedSubject, selectedTopic, dataVersion]);

  const selectedDetailSpotlight = useMemo(() => {
    if (!selectedDetailStudent) return { score: "0.00", label: "Not Assessed" };

    const scoreValue = Number(selectedDetailStudent.score);
    const normalizedScore = Number.isFinite(scoreValue) ? scoreValue : 0;

    const label = selectedDetailStudent.predikat && selectedDetailStudent.predikat !== "-"
      ? selectedDetailStudent.predikat
      : "Belum Dinilai";

    const toneMap = {
      "Sangat Baik": {
        scoreClass: "text-amber-300",
        badgeClass: "border-amber-300/45 bg-amber-300/15 text-amber-100",
        panelClass: "border-amber-300/30 bg-amber-300/10",
      },
      Baik: {
        scoreClass: "text-amber-300",
        badgeClass: "border-amber-300/45 bg-amber-300/15 text-amber-100",
        panelClass: "border-amber-300/30 bg-amber-300/10",
      },
      Cukup: {
        scoreClass: "text-amber-200",
        badgeClass: "border-amber-300/40 bg-amber-300/10 text-amber-100",
        panelClass: "border-amber-300/25 bg-amber-300/10",
      },
      Kurang: {
        scoreClass: "text-amber-200",
        badgeClass: "border-amber-300/35 bg-amber-300/10 text-amber-100",
        panelClass: "border-amber-300/25 bg-amber-300/10",
      },
      "Belum Dinilai": {
        scoreClass: "text-amber-100",
        badgeClass: "border-amber-300/30 bg-amber-300/10 text-amber-100",
        panelClass: "border-amber-300/20 bg-amber-300/10",
      },
    };

    const tone = toneMap[label] || toneMap["Belum Dinilai"];

    return {
      score: normalizedScore.toFixed(2),
      label,
      scoreClass: tone.scoreClass,
      badgeClass: tone.badgeClass,
      panelClass: tone.panelClass,
    };
  }, [selectedDetailStudent]);

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
                  Hasil analisis model Fuzzy AHP untuk 5 kategori ATL (Approaches to Learning).
                </p>
              </div>

              <div className="flex items-center gap-3">
                <button className="inline-flex items-center gap-2 rounded-2xl border border-stone-200 bg-white px-6 py-3 text-sm font-semibold text-stone-700 transition-all hover:bg-stone-50 hover:border-primary/30 hover:shadow-md">
                  <span className="material-symbols-outlined text-[18px]">print</span>
                  Cetak Laporan
                </button>
                <button className="inline-flex items-center gap-2 rounded-2xl bg-yellow-400 px-6 py-3 text-sm font-bold text-stone-900 transition-all hover:bg-yellow-500 hover:shadow-lg">
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
                      {avgClassScore} <span className="text-xs font-bold text-green-600">({parseFloat(avgClassScore) >= 70 ? 'Baik' : 'Perlu Pendampingan'})</span>
                    </span>
                  </div>
                </div>
              </div>

              <div className="rounded-[1.8rem] border border-stone-200 bg-white p-4 shadow-[0_18px_40px_rgba(15,23,42,0.06)] lg:p-6 transition-all hover:shadow-lg hover:border-orange-300 hover:-translate-y-1 cursor-pointer">
                <div className="flex items-start gap-3">
                  <span className="material-symbols-outlined text-3xl text-orange-500">emoji_events</span>
                  <div>
                    <span className="block text-xs font-semibold text-stone-500">Kategori Terkuat</span>
                    <span className="mt-1 block text-lg font-black text-text-main-light lg:text-xl">{stats.strongest?.name || "-"} Skills</span>
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
                        <span>{cat.name} Skills</span>
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
                          <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                            s.predikat === "Sangat Baik" ? "bg-emerald-100 text-emerald-700" :
                            s.predikat === "Baik" ? "bg-yellow-100 text-yellow-700" :
                            s.predikat === "-" ? "bg-slate-100 text-slate-600" :
                            "bg-orange-100 text-orange-700"
                          }`}>
                            {s.predikat}
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
            </section>
          </div>
        </div>

        {selectedDetailStudent && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
            <div className="max-h-[90vh] w-full max-w-4xl overflow-hidden rounded-[2rem] border border-amber-300/20 bg-[#0b0907] shadow-[0_26px_60px_rgba(0,0,0,0.5)]">
              <div className="flex items-start justify-between gap-4 border-b border-amber-300/15 bg-gradient-to-r from-[#080706] via-[#15110c] to-[#090806] px-6 py-5">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.22em] text-amber-300/80">Student Detail Report</p>
                  <h3 className="mt-1 text-xl font-black text-white">{selectedDetailStudent.name}</h3>
                  <p className="mt-1 text-xs font-medium text-amber-100/70">
                    {selectedClass} | {currentSubject?.label} | Sub-topic {currentTopicIndex} ({currentTopicLabel})
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedDetailStudent(null)}
                  className="rounded-full border border-amber-300/30 bg-amber-300/10 p-2 text-amber-200 transition-colors hover:bg-amber-300/20"
                >
                  <span className="material-symbols-outlined text-[18px]">close</span>
                </button>
              </div>

              <div className="max-h-[calc(90vh-110px)] space-y-5 overflow-y-auto px-6 py-6">
                <section className="relative overflow-hidden rounded-3xl border border-amber-300/20 bg-gradient-to-br from-[#060504] via-[#17120c] to-[#0e0b08] p-0 shadow-[0_14px_28px_rgba(0,0,0,0.35)]">
                  <div className="pointer-events-none absolute -right-16 -top-14 h-56 w-56 rounded-full bg-amber-300/20 blur-3xl" />
                  <div className="pointer-events-none absolute -left-14 bottom-6 h-40 w-40 rounded-full bg-amber-200/10 blur-2xl" />
                  <div className="pointer-events-none absolute right-10 top-8 h-24 w-24 rounded-full border border-amber-300/30" />
                  <div className="pointer-events-none absolute right-16 top-14 h-12 w-12 rounded-full border border-amber-200/30" />
                  <div className="pointer-events-none absolute inset-x-0 top-24 h-px bg-gradient-to-r from-transparent via-amber-300/45 to-transparent" />
                  <div className="pointer-events-none absolute bottom-7 right-8 flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-200/80" />
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-300/60" />
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-100/60" />
                  </div>
                  <div className="absolute left-1/2 top-4 z-10 -translate-x-1/2 rounded-2xl border border-amber-300/30 bg-[#12100c]/95 px-3 py-2 shadow-[0_20px_30px_rgba(0,0,0,0.35)] backdrop-blur-sm">
                    <img src={schoolLogo} alt="Cita Hati School Logo" className="h-10 w-auto object-contain" />
                  </div>

                  <div className="relative border-b border-amber-300/15 bg-gradient-to-r from-[#070605] via-[#1b140d] to-[#120e0a] px-6 pb-5 pt-16">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.24em] text-amber-200/85">Student ATL Report</p>
                        <h4 className="mt-2 text-xl font-black text-white">{selectedDetailStudent.name}</h4>
                        <p className="mt-1 text-xs font-medium text-amber-100/70">
                          {currentSubject?.label} | Sub-topic {currentTopicIndex} ({currentTopicLabel})
                        </p>
                      </div>
                      <div className={`rounded-[1.4rem] border px-5 py-4 text-right shadow-[0_20px_30px_rgba(0,0,0,0.35)] ${selectedDetailSpotlight.panelClass}`}>
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-100/80">ATL Point</span>
                        <div className={`mt-1 text-4xl font-black leading-none md:text-5xl ${selectedDetailSpotlight.scoreClass}`}>
                          {selectedDetailSpotlight.score}
                        </div>
                        <span className={`mt-2 inline-flex rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] ${selectedDetailSpotlight.badgeClass}`}>
                          {selectedDetailSpotlight.label}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-0 border-b border-amber-300/15 md:grid-cols-2">
                    <div className="space-y-1 border-b border-amber-300/15 px-6 py-4 md:border-b-0 md:border-r">
                      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-200/70">Student Name</p>
                      <p className="text-sm font-semibold text-white">{selectedDetailStudent.name}</p>
                    </div>
                    <div className="space-y-1 px-6 py-4">
                      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-200/70">Student ID (NIS)</p>
                      <p className="text-sm font-semibold text-white">{selectedDetailStudent.nis}</p>
                    </div>
                    <div className="space-y-1 border-b border-amber-300/15 px-6 py-4 md:border-b-0 md:border-r">
                      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-200/70">Class</p>
                      <p className="text-sm font-semibold text-white">{selectedClass}</p>
                    </div>
                    <div className="space-y-1 px-6 py-4">
                      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-200/70">Report Date</p>
                      <p className="text-sm font-semibold text-white">{reportGeneratedDate}</p>
                    </div>
                  </div>

                  <div className="px-6 py-5">
                    <div className="rounded-2xl border border-amber-300/25 bg-amber-300/10 p-4">
                      <p className="text-sm leading-7 text-amber-100">{selectedDetailStudent.summaryParagraph}</p>
                    </div>
                  </div>
                </section>

                <section className="rounded-2xl border border-amber-300/20 bg-[#0e0c09]">
                  <div className="border-b border-amber-300/15 px-4 py-3">
                    <p className="text-xs font-black uppercase tracking-[0.2em] text-amber-300/80">Criterion-Based Narrative</p>
                  </div>
                  <div className="space-y-4 px-4 py-4">
                    {selectedDetailStudent.detailItems.length > 0 ? (
                      selectedDetailStudent.detailItems.map((item, idx) => (
                        <div key={`${item.kriteria}-${item.atlName}-${idx}`} className="rounded-xl border border-amber-300/20 bg-amber-300/5 p-4">
                          <p className="text-sm leading-7 text-amber-50">
                            <span className="font-black text-amber-300">{idx + 1}. </span>
                            In the criterion <strong>{item.kriteria}</strong> under <strong>{item.atlName}</strong>,{" "}
                            {selectedDetailStudent.name} is currently at level <strong>{item.ratingCode || "-"}</strong>{" "}
                            ({item.ratingLabel}). {item.levelDescription}
                          </p>
                        </div>
                      ))
                    ) : (
                      <p className="py-4 text-center text-sm font-medium text-amber-100/80">
                        No criterion data is available for this sub-topic.
                      </p>
                    )}
                  </div>
                </section>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

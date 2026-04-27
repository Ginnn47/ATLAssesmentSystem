import React, { useState, useMemo, useEffect } from "react";
import { Link } from "react-router-dom";
import Sidebar from "./sidebar";
import { dummyATL, saveATLData } from "./dummyATL";
import { allStudentsData } from "./dummyStudents";

const ratingOptions = [
  { label: "Need Improvement", code: "NFI", description: "Fails to participate in the assigned part." },
  { label: "Progressing Toward Expectation", code: "PTE", description: "Struggles with assigned role; impacts the group." },
  { label: "Developing Expectation", code: "DE", description: "Tries to fulfill role; struggles with technical requirements." },
  { label: "Meeting Expectation", code: "ME", description: "Executes assigned role effectively; contributes reliably." },
  { label: "Exceeding Expectation", code: "EE", description: "Skillfully executes role; demonstrates high technical command." },
];

const subjectColors = {
  Singing: { bg: "bg-red-50", border: "border-red-300", text: "text-red-700", badge: "bg-red-100 text-red-700", accentLight: "bg-red-100", accentMain: "text-red-600", icon: "music_note" },
  IPA: { bg: "bg-sky-50", border: "border-sky-300", text: "text-sky-700", badge: "bg-sky-100 text-sky-700", accentLight: "bg-sky-100", accentMain: "text-sky-600", icon: "science" },
  Math: { bg: "bg-amber-50", border: "border-amber-300", text: "text-amber-700", badge: "bg-amber-100 text-amber-700", accentLight: "bg-amber-100", accentMain: "text-amber-600", icon: "calculate" },
};

export default function BatchInputATL() {
  const currentUser = { name: "Joko Wiryanto", role: "Guru / Evaluator" };

  const getDynamicTopicSteps = (subject) => {
    if (subject === "Singing") {
      return [
        { id: "singing_christmas_carol", label: "Christmas Carol", description: "Musik & Gerak Berkelompok" },
        { id: "singing_choir", label: "Choir", description: "Paduan Suara" },
        { id: "singing_vocal_technique", label: "Vocal Technique", description: "Latihan Teknik Vokal" },
        { id: "singing_music_theory_basics", label: "Music Theory Basics", description: "Dasar Teori Musik" },
        { id: "singing_performance_practice", label: "Performance Practice", description: "Latihan Pertunjukan" },
      ];
    } else if (subject === "IPA") {
      return [
        { id: "ipa_energi_perubahan", label: "Energi Perubahan", description: "Eksperimen Energi" },
        { id: "ipa_tata_surya", label: "Tata Surya", description: "Planet dan Benda Langit" },
        { id: "ipa_sistem_tubuh", label: "Sistem Tubuh", description: "Anatomi dan Fisiologi" },
        { id: "ipa_ekosistem", label: "Ekosistem", description: "Interaksi Makhluk Hidup" },
      ];
    } else if (subject === "Math") {
      return [
        { id: "math_linear_equations", label: "Linear Equations", description: "Persamaan Linear" },
        { id: "math_quadratic_functions", label: "Quadratic Functions", description: "Fungsi Kuadrat" },
        { id: "math_geometry", label: "Geometry", description: "Geometri & Bentuk" },
        { id: "math_trigonometry", label: "Trigonometry", description: "Trigonometri" },
        { id: "math_statistics", label: "Statistics", description: "Statistika & Data" },
      ];
    }
    return [];
  };

  const classOptions = useMemo(() => (allStudentsData ? Object.keys(allStudentsData) : []), []);
  const [selectedClass, setSelectedClass] = useState(classOptions[0] || "");
  const [selectedTopicIndex, setSelectedTopicIndex] = useState(0);
  const [selectedSubject, setSelectedSubject] = useState("Singing");
  const studentOptions = useMemo(() => allStudentsData[selectedClass] || [], [selectedClass]);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const dynamicTopicSteps = useMemo(() => getDynamicTopicSteps(selectedSubject), [selectedSubject]);
  const [selectedRatings, setSelectedRatings] = useState({});
  const [openGroupId, setOpenGroupId] = useState(1);
  const [showInfoModal, setShowInfoModal] = useState(false);

  useEffect(() => { setSelectedTopicIndex(0); }, [selectedSubject]);
  useEffect(() => { setSelectedStudent(studentOptions[0] || null); }, [selectedClass, studentOptions]);

  // Persistensi Pilihan Filter
  useEffect(() => {
    const saved = localStorage.getItem("batch_filter_pref");
    if (saved) {
      const { cls, subj, topicIdx } = JSON.parse(saved);
      setSelectedClass(cls);
      setSelectedSubject(subj);
      setSelectedTopicIndex(topicIdx);
    }
  }, []);

  const saveFilterSelection = () => {
    const pref = {
      cls: selectedClass,
      subj: selectedSubject,
      topicIdx: selectedTopicIndex
    };
    localStorage.setItem("batch_filter_pref", JSON.stringify(pref));
    alert("Konfigurasi filter (Kelas/Mapel/Topik) berhasil disimpan!");
  };

  const atlSections = [
    { id: 1, label: "Thinking", section: "ATL 1: Thinking Skills", accent: "lightbulb" },
    { id: 2, label: "Social", section: "ATL 2: Social Skills", accent: "groups" },
    { id: 3, label: "Communication", section: "ATL 3: Communication Skills", accent: "forum" },
    { id: 4, label: "Self-Management", section: "ATL 4: Self-Management Skills", accent: "timer" },
    { id: 5, label: "Research", section: "ATL 5: Research Skills", accent: "search" },
  ];

  const handleSelectRating = (metricId, option) => {
    setSelectedRatings((prev) => ({ ...prev, [metricId]: option }));
  };

  const persistAssessment = () => {
    if (!selectedStudent || !dataKey) return false;

    if (!dummyATL.savedAssessments) dummyATL.savedAssessments = {};
    if (!dummyATL.savedAssessments[selectedStudent.id]) dummyATL.savedAssessments[selectedStudent.id] = {};
    dummyATL.savedAssessments[selectedStudent.id][dataKey] = { ...selectedRatings };
    saveATLData(dummyATL);
    return true;
  };

  const handleSendAssessment = () => {
    if (!persistAssessment()) return;
    alert(`Penilaian ATL untuk ${selectedStudent.name} pada topik ${selectedTopic.label} berhasil dikirim!`);
  };

  const handleSaveDraft = () => {
    if (!persistAssessment()) return;
    alert(`Draft penilaian untuk ${selectedStudent?.name} pada topik ${selectedTopic.label} berhasil disimpan.`);
  };

  const selectedTopic = dynamicTopicSteps[selectedTopicIndex] || { id: "", label: "Pilih Topik" };
  const dataKey = selectedTopic.id;
  const currentATLData = dummyATL[dataKey] || [];
  const activeATLName = atlSections.find(s => s.id === openGroupId)?.label || "";
  const activeMetrics = currentATLData.filter(item => item.atl && item.atl.includes(activeATLName));

  useEffect(() => {
    if (!selectedStudent || !dataKey) {
      setSelectedRatings({});
      return;
    }

    const existingRatings = dummyATL.savedAssessments?.[selectedStudent.id]?.[dataKey];
    setSelectedRatings(existingRatings ? { ...existingRatings } : {});
  }, [selectedStudent?.id, dataKey]);

  const completedCategoryCount = useMemo(() => {
    return atlSections.filter((section) => {
      const sectionMetrics = currentATLData.filter(item => item.atl && item.atl.includes(section.label));
      
      // Jika tidak ada metrics untuk kategori ini, auto-complete (dihitung 1/5)
      if (sectionMetrics.length === 0) {
        return true;
      }
      
      // Jika ada metrics, hanya complete jika sudah ada rating
      return sectionMetrics.some(item => selectedRatings[`${dataKey}_${item.kriteria}_${section.label}`]);
    }).length;
  }, [currentATLData, atlSections, selectedRatings, dataKey]);

  // Helper: check apakah kategori ATL sudah auto-complete (tidak ada metrics)
  const isAutoComplete = (sectionLabel) => {
    const sectionMetrics = currentATLData.filter(item => item.atl && item.atl.includes(sectionLabel));
    return sectionMetrics.length === 0;
  };

  // Helper: check apakah kategori ATL sudah dinilai
  const isCategoryCompleted = (section) => {
    const sectionMetrics = currentATLData.filter(item => item.atl && item.atl.includes(section.label));
    if (sectionMetrics.length === 0) return true; // Auto-complete
    return sectionMetrics.some(item => selectedRatings[`${dataKey}_${item.kriteria}_${section.label}`]);
  };

  // Kalkulasi Skor Fuzzy ATL secara Real-time
  const calculatedFuzzyScore = useMemo(() => {
    const weights = dummyATL.savedWeights?.[dataKey] || {};
    let totalWeightedScore = 0;
    let totalWeight = 0;

    currentATLData.forEach(item => {
      item.atl.forEach(atlName => {
        const weightKey = `${item.kriteria} (${atlName})`;
        const weight = parseFloat(weights[weightKey]) || 0;
        const ratingLabel = selectedRatings[`${dataKey}_${item.kriteria}_${atlName}`];
        
        if (ratingLabel) {
          const ratingCode = ratingOptions.find(opt => opt.label === ratingLabel)?.code;
          const ratingValue = { EE: 100, ME: 80, DE: 60, PTE: 40, NFI: 20 }[ratingCode] || 0;
          
          totalWeightedScore += (ratingValue * weight);
          totalWeight += weight;
        }
      });
    });

    const score = totalWeight > 0 ? (totalWeightedScore / totalWeight) : 0;
    return score.toFixed(2);
  }, [selectedRatings, currentATLData, dataKey]);

  return (
    <div className="flex h-screen w-full overflow-hidden">
      <Sidebar user={currentUser} />
      <main className="relative flex flex-1 flex-col overflow-hidden bg-stone-50">
        <div className="flex-1 overflow-y-auto p-4 lg:p-8">
          <div className="mx-auto flex max-w-7xl flex-col gap-8">
            {/* Header */}
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="max-w-2xl">
                <span className="px-2 py-0.5 rounded bg-primary/20 text-stone-900 text-[10px] font-bold uppercase tracking-widest">
                  Main Page / Student Management / ATL Input
                </span>
                <h1 className="mt-3 text-3xl font-black text-text-main-light lg:text-4xl">
                  ATL Input Form
                </h1>
                <p className="mt-3 text-sm text-text-sub-light">
                  Penilaian perilaku siswa berdasarkan pendekatan ATL pada setiap topik pembelajaran.
                </p>
              </div>
            </div>

            {/* Selection Section */}
            <section className="rounded-[2rem] border border-stone-200 bg-white p-6 shadow-[0_18px_40px_rgba(15,23,42,0.08)] space-y-6">
              <div className="grid gap-4 lg:grid-cols-3">
                <div className="space-y-4 lg:col-span-1">
                  {/* Kelas */}
                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.22em] text-stone-500">Kelas</label>
                    <select
                      value={selectedClass}
                      onChange={(e) => setSelectedClass(e.target.value)}
                      className="block w-full rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm font-semibold text-stone-900 outline-none transition-all focus:border-primary focus:bg-white focus:ring-4 focus:ring-primary/10"
                    >
                      {classOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                    </select>
                  </div>

                  {/* Mata Pelajaran */}
                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.22em] text-stone-500">Mata Pelajaran</label>
                    <div className="relative">
                      <span className={`material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-xl ${subjectColors[selectedSubject]?.accentMain}`}>
                        {subjectColors[selectedSubject]?.icon}
                      </span>
                      <select
                        value={selectedSubject}
                        onChange={(e) => setSelectedSubject(e.target.value)}
                        className={`block w-full rounded-2xl border-2 pl-12 pr-4 py-3 text-sm font-bold outline-none transition-all ${subjectColors[selectedSubject]?.bg} ${subjectColors[selectedSubject]?.border} ${subjectColors[selectedSubject]?.text} focus:ring-4`}
                      >
                        {["Singing", "IPA", "Math"].map((subj) => <option key={subj} value={subj} className="font-semibold text-stone-900 bg-white">{subj}</option>)}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Topik */}
                <div className="lg:col-span-2 rounded-[1.5rem] border border-stone-200 bg-stone-50 p-5">
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-stone-500">Pilih Topik Pembelajaran</p>
                    <button 
                      onClick={saveFilterSelection}
                      className="text-[10px] font-black uppercase text-primary hover:underline"
                    >
                      Simpan Pilihan Default
                    </button>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {dynamicTopicSteps.length > 0 ? dynamicTopicSteps.map((topic, idx) => (
                      <button key={topic.id} type="button" onClick={() => setSelectedTopicIndex(idx)}
                        className={`rounded-2xl px-4 py-3 text-sm font-semibold transition ${selectedTopicIndex === idx ? "bg-primary text-white shadow-[0_10px_30px_rgba(59,130,246,0.18)]" : "bg-white text-stone-700 border border-stone-200 hover:border-primary/40"}`}>
                        {topic.label}
                      </button>
                    )) : <p className="text-sm text-stone-500">Tidak ada topik tersedia untuk mata pelajaran ini.</p>}
                  </div>
                </div>
              </div>

              {/* Siswa */}
              <div className="mt-6 rounded-[1.5rem] border border-stone-200 bg-stone-50 p-5 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
                {selectedStudent ? (
                  <div className="flex items-center gap-4">
                    <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br from-primary to-secondary text-2xl font-black text-white shadow-lg shadow-primary/20">
                      {selectedStudent.initials}
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.22em] text-stone-500">Identitas Siswa</p>
                      <p className="text-base font-bold text-stone-900">{selectedStudent.name}</p>
                      <p className="text-sm text-stone-500">NISN: {selectedStudent.nis} • Kelas {selectedStudent.kelas}</p>
                    </div>
                  </div>
                ) : <p className="text-sm text-stone-500">Tidak ada siswa di kelas ini.</p>}

                {/* Ganti siswa */}
                <div className="flex-1 sm:ml-auto sm:max-w-xs">
                  {studentOptions.length > 0 && (
                    <>
                      <label className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.22em] text-stone-500">Ganti Siswa</label>
                      <select
                        value={selectedStudent?.id || ""}
                        onChange={(e) => {
                          const selectedId = Number(e.target.value);
                          setSelectedStudent(studentOptions.find((s) => s.id === selectedId));
                        }}
                        className="block w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-900 outline-none transition-all focus:border-primary focus:ring-4 focus:ring-primary/10"
                      >
                        {studentOptions.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    </>
                  )}
                </div>
              </div>
            </section>

            {/* ATL Buttons */}
            <div className="space-y-5">
              <div className="rounded-[1.8rem] border border-stone-200 bg-white p-5 shadow-[0_18px_40px_rgba(15,23,42,0.06)]">
                <div className="grid auto-cols-max gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
                  {atlSections.map((group) => {
                    const isComplete = isCategoryCompleted(group);
                    const isAuto = isAutoComplete(group.label);
                    
                    let btnStyle = "border-stone-200 bg-white text-stone-600 hover:border-primary/50 hover:bg-primary/5";
                    if (isComplete) btnStyle = "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100";
                    if (openGroupId === group.id) btnStyle = "border-primary bg-primary/10 text-primary shadow-[0_14px_28px_rgba(234,179,8,0.12)]";

                    return (
                      <button key={group.id} type="button" onClick={() => setOpenGroupId(group.id)}
                        className={`rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition relative ${btnStyle}`}>
                        <div className="flex items-center gap-2.5">
                          <span className="material-symbols-outlined text-[20px]">{group.accent}</span>
                          <span className="truncate">{group.label} Skills</span>
                        </div>
                        {isAuto && (
                          <div className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-amber-400 text-white shadow-sm ring-2 ring-white" title="Otomatis Dinilai">
                            <span className="material-symbols-outlined text-[13px] icon-fill">star</span>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* ATL Section Details */}
              <section className="rounded-[1.8rem] border border-stone-200 bg-white p-6 shadow-[0_18px_40px_rgba(15,23,42,0.06)]">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="max-w-3xl">
                    <div className="flex items-center gap-2 text-primary">
                      <span className="material-symbols-outlined text-[20px]">{atlSections.find((g) => g.id === openGroupId)?.accent}</span>
                      <p className="text-xs uppercase tracking-[0.22em] font-bold">ATL {openGroupId}</p>
                    </div>
                    <h2 className="mt-3 text-2xl font-black text-stone-900 flex items-center gap-3">
                      {atlSections.find((g) => g.id === openGroupId)?.section}
                    </h2>
                    <p className="mt-3 text-sm leading-6 text-stone-500">
                      Pilih kriteria ATL terbaik untuk siswa berdasarkan topik yang sedang dinilai. Setiap kategori akan membantu menghitung nilai akhir ATL.
                    </p>
                  </div>

                  <div className="flex flex-shrink-0 items-center gap-3">
                    <span className="inline-flex rounded-2xl bg-emerald-50 px-4 py-2 text-sm font-bold text-emerald-600 border border-emerald-100">{completedCategoryCount}/5 ATL Skills</span>
                    <span className="inline-flex rounded-2xl bg-primary/5 px-4 py-2 text-sm font-semibold text-primary">Topik: {selectedTopic.label}</span>
                    <button type="button" aria-label="Lihat panduan penilaian" onClick={() => setShowInfoModal(true)}
                      className="flex h-9 w-9 items-center justify-center rounded-full border border-stone-200 bg-white text-stone-600 transition-all hover:bg-stone-50" title="Lihat panduan penilaian">
                      <span className="material-symbols-outlined text-[18px]">info</span>
                    </button>
                  </div>
                </div>

                {/* Real-time Fuzzy Analysis Result */}
                <div className={`mt-6 overflow-hidden rounded-[1.8rem] border-2 transition-all duration-500 ${completedCategoryCount === 5 ? "border-emerald-200 bg-emerald-50/50 shadow-lg shadow-emerald-200/20" : "border-stone-100 bg-stone-50/30 opacity-60"}`}>
                  <div className="flex flex-col items-center justify-between gap-6 p-6 md:flex-row">
                    <div className="flex items-center gap-4">
                      <div className={`flex h-16 w-16 items-center justify-center rounded-3xl text-white shadow-lg transition-all duration-500 ${completedCategoryCount === 5 ? "bg-emerald-500" : "bg-stone-300"}`}>
                        <span className="material-symbols-outlined text-3xl">{completedCategoryCount === 5 ? "analytics" : "pending"}</span>
                      </div>
                      <div>
                        <h3 className="text-lg font-black text-stone-900">Hasil Analisis Fuzzy ATL</h3>
                        <p className="text-sm text-stone-500">Nilai dihitung berdasarkan pembobotan kriteria pada topik ini.</p>
                      </div>
                    </div>
                    <div className="text-center md:text-right">
                      <span className="text-[10px] font-black uppercase tracking-widest text-stone-400">Calculated Score</span>
                      <div className={`text-5xl font-black transition-colors duration-500 ${completedCategoryCount === 5 ? "text-emerald-600" : "text-stone-400"}`}>
                        {calculatedFuzzyScore}
                      </div>
                    </div>
                  </div>
                </div>

                {/* ATL Metrics */}
                <div className="mt-6 space-y-6">
                  {activeMetrics.length > 0 ? activeMetrics.map((metric, idx) => {
                    const metricKey = `${dataKey}_${metric.kriteria}_${activeATLName}`;
                    return (
                      <div key={idx} className="rounded-[1.6rem] border border-stone-200 bg-stone-50 p-5">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                          <div>
                            <h3 className="text-sm font-semibold text-stone-900">{metric.kriteria}</h3>
                            <span className="mt-2 inline-flex rounded-full bg-blue-50 px-3 py-1 text-[11px] font-semibold text-blue-600">Kriteria Penilaian</span>
                          </div>
                          <div className="text-xs uppercase tracking-[0.22em] text-stone-500">Bobot ATL</div>
                        </div>

                        <div className="mt-5 grid gap-3 md:grid-cols-5">
                          {ratingOptions.map((item) => {
                            const option = item.label;
                            const isActive = selectedRatings[metricKey] === option;
                            const colorMap = {
                              NFI: { active: "bg-red-500 border-red-500 shadow-red-200", idle: "bg-red-50/50 border-red-100 text-red-700 hover:border-red-300", icon: "bg-red-100 text-red-600" },
                              PTE: { active: "bg-orange-500 border-orange-500 shadow-orange-200", idle: "bg-orange-50/50 border-orange-100 text-orange-700 hover:border-orange-300", icon: "bg-orange-100 text-orange-600" },
                              DE: { active: "bg-amber-500 border-amber-500 shadow-amber-200", idle: "bg-amber-50/50 border-amber-100 text-amber-700 hover:border-amber-300", icon: "bg-amber-100 text-amber-600" },
                              ME: { active: "bg-blue-600 border-blue-600 shadow-blue-200", idle: "bg-blue-50/50 border-blue-100 text-blue-700 hover:border-blue-300", icon: "bg-blue-100 text-blue-600" },
                              EE: { active: "bg-emerald-600 border-emerald-600 shadow-emerald-200", idle: "bg-emerald-50/50 border-emerald-100 text-emerald-700 hover:border-emerald-300", icon: "bg-emerald-100 text-emerald-600" },
                            };
                            const style = colorMap[item.code] || colorMap.DE;

                            return (
                              <button key={option} type="button" onClick={() => handleSelectRating(metricKey, option)}
                                className={`flex flex-col items-center justify-start rounded-[2rem] border-2 p-6 text-center transition-all duration-300 ${isActive ? style.active + " text-white shadow-xl -translate-y-1" : style.idle}`}>
                                <div className={`mb-4 flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-lg font-black shadow-sm transition-colors ${isActive ? "bg-white/20 text-white" : style.icon}`}>
                                  {item.code}
                                </div>
                                <div className="flex flex-col items-center">
                                  <h4 className={`text-sm font-bold leading-tight tracking-tight ${isActive ? "text-white" : "text-stone-900"}`}>{item.label}</h4>
                                  <p className={`mt-3 text-[11px] leading-relaxed line-clamp-3 ${isActive ? "text-white/90" : "text-stone-500"}`}>
                                    {metric.levels?.[item.code] || "Tidak ada deskripsi"}
                                  </p>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  }) : (
                    <div className="py-10 rounded-2xl border-2 border-dashed border-amber-200 bg-amber-50 text-center">
                      <div className="flex items-center justify-center mb-3">
                        <span className="material-symbols-outlined text-amber-600 text-3xl">task_alt</span>
                      </div>
                      <p className="text-sm font-semibold text-amber-900">Kategori Sudah Otomatis Dinilai</p>
                      <p className="mt-2 text-xs text-amber-700">Tidak ada kriteria penilaian untuk kategori ini pada topik yang dipilih, sehingga dihitung otomatis dengan nilai <strong>1/5</strong>.</p>
                    </div>
                  )}
                </div>
              </section>

              {/* Improved Evaluation Guide Section */}
              <section className="rounded-[2rem] border border-stone-200 bg-white p-8 shadow-[0_18px_40px_rgba(15,23,42,0.06)]">
                <div className="mb-8 border-b border-stone-100 pb-6">
                  <h3 className="text-lg font-black text-stone-900 uppercase tracking-tight">Panduan Tingkat Pencapaian (IB Framework)</h3>
                  <p className="mt-1 text-sm text-stone-500">Gunakan referensi di bawah ini untuk menjaga objektivitas penilaian pada setiap metrik.</p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                  {[
                    { label: "Exceeding Expectation", code: "EE", color: "from-emerald-500 to-teal-600", text: "Kinerja luar biasa yang melampaui standar secara konsisten." },
                    { label: "Meeting Expectation", code: "ME", color: "from-blue-500 to-indigo-600", text: "Memenuhi seluruh kriteria yang diharapkan dengan baik." },
                    { label: "Developing Expectation", code: "DE", color: "from-amber-400 to-orange-500", text: "Menunjukkan pemahaman dasar namun masih memerlukan latihan." },
                    { label: "Progressing Toward Expectation", code: "PTE", color: "from-orange-500 to-red-500", text: "Masih dalam tahap awal pemahaman dan butuh banyak bantuan." },
                    { label: "Need Further Improvement", code: "NFI", color: "from-red-600 to-rose-700", text: "Belum menunjukkan partisipasi atau pemahaman yang memadai." }
                  ].map(item => (
                    <div key={item.code} className="group relative overflow-hidden rounded-3xl border border-stone-100 bg-stone-50/50 p-5 transition-all hover:bg-white hover:shadow-xl hover:-translate-y-1">
                      <div className={`absolute top-0 left-0 h-1 w-full bg-gradient-to-r ${item.color}`}></div>
                      <div className={`mb-4 flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br ${item.color} text-sm font-black text-white shadow-md`}>
                        {item.code}
                      </div>
                      <p className="text-[11px] font-black text-stone-900 uppercase tracking-tight">{item.label}</p>
                      <p className="mt-3 text-[11px] leading-relaxed text-stone-500">{item.text}</p>
                    </div>
                  ))}
                </div>
                
                <div className="mt-8 flex items-center gap-3 rounded-2xl bg-primary/5 p-4 border border-primary/10">
                  <span className="material-symbols-outlined text-primary text-xl">verified_user</span>
                  <p className="text-[10px] text-primary font-bold leading-relaxed">
                    Sistem penilaian ini didukung oleh algoritma Fuzzy Analytic Hierarchy Process (AHP) untuk memastikan 
                    bahwa setiap input observasi guru diproses dengan pembobotan yang adil dan akurat sesuai profil mata pelajaran.
                  </p>
                </div>
              </section>
            </div>

            {/* Modal Info: Bobot Kriteria */}
            {showInfoModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
                <div className="max-h-[85vh] w-full max-w-xl overflow-y-auto rounded-[2.5rem] border border-stone-200 bg-white shadow-2xl">
                  <div className="sticky top-0 z-10 border-b border-stone-200 bg-white/80 backdrop-blur-md px-8 py-6 flex items-center justify-between">
                    <div>
                      <h2 className="text-xl font-black text-stone-900 uppercase tracking-tight">Bobot Prioritas Kriteria</h2>
                      <p className="mt-1 text-xs font-medium text-stone-500">Konfigurasi Fuzzy AHP untuk Topik: {selectedTopic.label}</p>
                    </div>
                    <button onClick={() => setShowInfoModal(false)} className="flex h-10 w-10 items-center justify-center rounded-full bg-stone-100 text-stone-600 hover:bg-stone-200 transition-all">
                      <span className="material-symbols-outlined text-[20px]">close</span>
                    </button>
                  </div>
                  
                  <div className="p-8 space-y-6">
                    <div className="rounded-2xl bg-primary/5 p-4 border border-primary/10">
                      <p className="text-xs text-primary leading-relaxed">
                        Bobot (Weight) di bawah ini menunjukkan tingkat kepentingan relatif setiap kriteria dalam perhitungan skor akhir ATL siswa pada topik ini.
                      </p>
                    </div>

                    <div className="space-y-5">
                      {currentATLData.map((item, idx) => {
                        const savedWeights = dummyATL.savedWeights?.[dataKey] || {};
                        return (
                          <div key={idx} className="space-y-3">
                            <h4 className="text-sm font-bold text-stone-800 flex items-center gap-2">
                               <span className="h-1.5 w-1.5 rounded-full bg-primary"></span>
                               {item.kriteria}
                            </h4>
                            <div className="grid gap-2 pl-3">
                              {item.atl.map(atlName => {
                                const weightKey = `${item.kriteria} (${atlName})`;
                                const weight = savedWeights[weightKey] || "0.00";
                                return (
                                  <div key={atlName} className="flex items-center justify-between rounded-xl border border-stone-100 bg-stone-50/50 px-4 py-2.5">
                                    <span className="text-xs font-semibold text-stone-500">{atlName} Skills</span>
                                    <div className="flex items-center gap-2">
                                      <div className="h-1.5 w-16 rounded-full bg-stone-200 overflow-hidden">
                                        <div className="h-full bg-primary" style={{ width: `${parseFloat(weight) * 100}%` }}></div>
                                      </div>
                                      <span className="text-[10px] font-black text-primary font-mono">{weight}</span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                      {currentATLData.length === 0 && (
                        <div className="py-8 text-center text-stone-400 text-sm italic">Belum ada kriteria yang dikonfigurasi untuk topik ini.</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-stone-200 bg-white px-5 py-4 shadow-[0_-8px_22px_rgba(15,23,42,0.04)]">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
            <Link to="/students" className="rounded-2xl border border-stone-200 bg-white px-6 py-3 text-sm font-semibold text-stone-700 hover:bg-stone-50 transition-all">Kembali</Link>
            <div className="flex items-center gap-3">
              <button onClick={handleSaveDraft} className="rounded-2xl border border-stone-200 bg-white px-6 py-3 text-sm font-semibold text-stone-700 hover:bg-stone-50 transition-all">Simpan Draft</button>
              <button 
                onClick={handleSendAssessment}
                className="inline-flex items-center gap-2 rounded-2xl bg-primary px-6 py-3 text-sm font-bold text-white shadow-[0_16px_28px_rgba(234,179,8,0.24)] hover:bg-secondary transition-all"
              >
                <span className="material-symbols-outlined text-[18px]">send</span> Kirim Penilaian
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Sidebar from "./sidebar";
import { allStudentsData } from "./dummyStudents";
import { dummyATL, saveATLData } from "./dummyATL";

const ratingOptions = [
  { label: "Need Further Improvement", code: "NFI" },
  { label: "Progressing Toward Expectation", code: "PTE" },
  { label: "Developing Expectation", code: "DE" },
  { label: "Meeting Expectation", code: "ME" },
  { label: "Exceeding Expectation", code: "EE" },
];

const subjectTopicMap = {
  Singing: [
    { id: "singing_christmas_carol", label: "Christmas Carol" },
    { id: "singing_choir", label: "Choir" },
    { id: "singing_vocal_technique", label: "Vocal Technique" },
    { id: "singing_music_theory_basics", label: "Music Theory Basics" },
    { id: "singing_performance_practice", label: "Performance Practice" },
  ],
  IPA: [
    { id: "ipa_energi_perubahan", label: "Energi Perubahan" },
    { id: "ipa_tata_surya", label: "Tata Surya" },
    { id: "ipa_sistem_tubuh", label: "Sistem Tubuh" },
    { id: "ipa_ekosistem", label: "Ekosistem" },
  ],
  Math: [
    { id: "math_linear_equations", label: "Linear Equations" },
    { id: "math_quadratic_functions", label: "Quadratic Functions" },
    { id: "math_geometry", label: "Geometry" },
    { id: "math_trigonometry", label: "Trigonometry" },
    { id: "math_statistics", label: "Statistics" },
  ],
};

const levelStyleMap = {
  NFI: {
    chip: "border-red-200 bg-red-50 text-red-700",
    text: "text-red-700",
    cell: "border-red-100 bg-red-50/50",
    button: "border-red-500 bg-red-500 text-white shadow-red-200",
    idleButton: "border-red-100 bg-red-50/50 text-red-700 hover:border-red-300",
  },
  PTE: {
    chip: "border-orange-200 bg-orange-50 text-orange-700",
    text: "text-orange-700",
    cell: "border-orange-100 bg-orange-50/50",
    button: "border-orange-500 bg-orange-500 text-white shadow-orange-200",
    idleButton: "border-orange-100 bg-orange-50/50 text-orange-700 hover:border-orange-300",
  },
  DE: {
    chip: "border-amber-200 bg-amber-50 text-amber-700",
    text: "text-amber-700",
    cell: "border-amber-100 bg-amber-50/50",
    button: "border-amber-500 bg-amber-500 text-white shadow-amber-200",
    idleButton: "border-amber-100 bg-amber-50/50 text-amber-700 hover:border-amber-300",
  },
  ME: {
    chip: "border-blue-200 bg-blue-50 text-blue-700",
    text: "text-blue-700",
    cell: "border-blue-100 bg-blue-50/50",
    button: "border-blue-600 bg-blue-600 text-white shadow-blue-200",
    idleButton: "border-blue-100 bg-blue-50/50 text-blue-700 hover:border-blue-300",
  },
  EE: {
    chip: "border-emerald-200 bg-emerald-50 text-emerald-700",
    text: "text-emerald-700",
    cell: "border-emerald-100 bg-emerald-50/50",
    button: "border-emerald-600 bg-emerald-600 text-white shadow-emerald-200",
    idleButton: "border-emerald-100 bg-emerald-50/50 text-emerald-700 hover:border-emerald-300",
  },
  NONE: {
    chip: "border-stone-200 bg-stone-100 text-stone-600",
    text: "text-stone-600",
    cell: "border-stone-200 bg-white",
    button: "border-stone-200 bg-white text-stone-500",
    idleButton: "border-stone-200 bg-white text-stone-500 hover:border-primary/30 hover:bg-primary/5",
  },
};

const atlConfig = {
  Thinking: { icon: "psychology", color: "bg-blue-100 text-blue-700" },
  Communication: { icon: "chat", color: "bg-purple-100 text-purple-700" },
  Social: { icon: "group", color: "bg-green-100 text-green-700" },
  "Self-Management": { icon: "self_improvement", color: "bg-orange-100 text-orange-700" },
  Research: { icon: "explore", color: "bg-red-100 text-red-700" },
};

const normalizeRatingLabel = (label) =>
  label === "Need Improvement" ? "Need Further Improvement" : label;

const ratingValueMap = {
  "Exceeding Expectation": 100,
  "Meeting Expectation": 80,
  "Developing Expectation": 60,
  "Progressing Toward Expectation": 40,
  "Need Further Improvement": 20,
  "Need Improvement": 20,
};

export default function BatchInputATL() {
  const currentUser = { name: "Joko Wiryanto", role: "Guru / Evaluator" };

  const classOptions = useMemo(() => Object.keys(allStudentsData || {}), []);
  const [selectedClass, setSelectedClass] = useState(classOptions[0] || "");
  const [selectedSubject, setSelectedSubject] = useState("Singing");
  const [selectedTopicIndex, setSelectedTopicIndex] = useState(0);
  const [batchRatingsByStudent, setBatchRatingsByStudent] = useState({});
  const [matrixContext, setMatrixContext] = useState(null);
  const [dataVersion, setDataVersion] = useState(0);
  const skipNextSubjectResetRef = React.useRef(false);

  const topicOptions = useMemo(() => subjectTopicMap[selectedSubject] || [], [selectedSubject]);
  const selectedTopic = topicOptions[selectedTopicIndex] || { id: "", label: "Pilih Topik" };
  const dataKey = selectedTopic.id;

  const students = useMemo(() => allStudentsData[selectedClass] || [], [selectedClass]);
  const currentATLData = dummyATL[dataKey] || [];

  const columns = useMemo(
    () =>
      currentATLData.map((item, idx) => ({
        id: `metric-${idx}`,
        title: item.kriteria,
        atlNames: item.atl || [],
        levels: item.levels || {},
        metricKeys: (item.atl || []).map((atlName) => `${dataKey}_${item.kriteria}_${atlName}`),
      })),
    [currentATLData, dataKey]
  );

  useEffect(() => {
    const syncDataFromStorage = () => {
      const savedData = localStorage.getItem("atl_framework_data");
      if (!savedData) return;

      Object.assign(dummyATL, JSON.parse(savedData));
      setDataVersion((version) => version + 1);
    };

    window.addEventListener("focus", syncDataFromStorage);
    window.addEventListener("storage", syncDataFromStorage);
    window.addEventListener("atl-data-updated", syncDataFromStorage);

    return () => {
      window.removeEventListener("focus", syncDataFromStorage);
      window.removeEventListener("storage", syncDataFromStorage);
      window.removeEventListener("atl-data-updated", syncDataFromStorage);
    };
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem("batch_filter_pref");
    if (!saved) return;

    const { cls, subj, topicIdx } = JSON.parse(saved);
    if (cls) setSelectedClass(cls);
    if (subj) {
      skipNextSubjectResetRef.current = true;
      setSelectedSubject(subj);
    }
    if (Number.isInteger(topicIdx)) setSelectedTopicIndex(topicIdx);
  }, []);

  useEffect(() => {
    if (skipNextSubjectResetRef.current) {
      skipNextSubjectResetRef.current = false;
      return;
    }

    setSelectedTopicIndex(0);
  }, [selectedSubject]);

  useEffect(() => {
    if (!dataKey || students.length === 0) {
      setBatchRatingsByStudent({});
      return;
    }

    const next = {};
    students.forEach((student) => {
      const existing = dummyATL.savedAssessments?.[student.id]?.[dataKey] || {};
      const row = {};

      columns.forEach((column) => {
        const value = column.metricKeys.map((key) => existing[key]).find(Boolean);
        if (value) row[column.id] = normalizeRatingLabel(value);
      });

      next[student.id] = row;
    });

    setBatchRatingsByStudent(next);
  }, [students, dataKey, columns, dataVersion]);

  const saveFilterSelection = () => {
    localStorage.setItem(
      "batch_filter_pref",
      JSON.stringify({
        cls: selectedClass,
        subj: selectedSubject,
        topicIdx: selectedTopicIndex,
      })
    );
    alert("Pilihan kelas/mapel/topik disimpan.");
  };

  const filledCells = useMemo(
    () =>
      students.reduce(
        (acc, student) =>
          acc + Object.values(batchRatingsByStudent[student.id] || {}).filter(Boolean).length,
        0
      ),
    [students, batchRatingsByStudent]
  );
  const totalCells = students.length * columns.length;
  const progress = totalCells > 0 ? Math.round((filledCells / totalCells) * 100) : 0;
  const batchStudentScores = useMemo(() => {
    const weights = dummyATL.savedWeights?.[dataKey] || {};

    return students.reduce((acc, student) => {
      const row = batchRatingsByStudent[student.id] || {};
      let totalWeightedScore = 0;
      let totalWeight = 0;
      let fallbackScore = 0;
      let fallbackCount = 0;

      columns.forEach((column) => {
        const ratingLabel = normalizeRatingLabel(row[column.id]);
        const ratingValue = ratingValueMap[ratingLabel];
        if (!ratingValue) return;

        column.atlNames.forEach((atlName) => {
          const weightKey = `${column.title} (${atlName})`;
          const weight = parseFloat(weights[weightKey]) || 0;
          if (weight > 0) {
            totalWeightedScore += ratingValue * weight;
            totalWeight += weight;
          }
          fallbackScore += ratingValue;
          fallbackCount += 1;
        });
      });

      const score =
        totalWeight > 0
          ? totalWeightedScore / totalWeight
          : fallbackCount > 0
            ? fallbackScore / fallbackCount
            : null;

      acc[student.id] = score === null ? null : Math.round(score);
      return acc;
    }, {});
  }, [students, columns, batchRatingsByStudent, dataKey]);

  const handleCellChange = (studentId, columnId, value) => {
    setBatchRatingsByStudent((prev) => ({
      ...prev,
      [studentId]: {
        ...(prev[studentId] || {}),
        [columnId]: value,
      },
    }));
  };

  const openMatrix = (student, column) => {
    setMatrixContext({ student, column });
  };

  const closeMatrix = () => {
    setMatrixContext(null);
  };

  const resetGrid = () => {
    const cleared = {};
    students.forEach((student) => {
      cleared[student.id] = {};
    });
    setBatchRatingsByStudent(cleared);
  };

  const persistBatchAssessment = () => {
    if (!dataKey || columns.length === 0 || students.length === 0) return false;

    if (!dummyATL.savedAssessments) dummyATL.savedAssessments = {};

    students.forEach((student) => {
      if (!dummyATL.savedAssessments[student.id]) dummyATL.savedAssessments[student.id] = {};

      const topicRatings = { ...(dummyATL.savedAssessments[student.id][dataKey] || {}) };
      const row = batchRatingsByStudent[student.id] || {};

      columns.forEach((column) => {
        const selected = row[column.id];
        column.metricKeys.forEach((metricKey) => {
          if (selected) topicRatings[metricKey] = selected;
          else delete topicRatings[metricKey];
        });
      });

      dummyATL.savedAssessments[student.id][dataKey] = topicRatings;
    });

    saveATLData(dummyATL);
    return true;
  };

  const handleSaveDraft = () => {
    if (!persistBatchAssessment()) return;
    alert(`Draft batch ${students.length} siswa berhasil disimpan.`);
  };

  const handleSend = () => {
    if (!persistBatchAssessment()) return;
    alert(`Penilaian batch ${students.length} siswa berhasil dikirim.`);
  };

  return (
    <div className="flex h-screen w-full overflow-hidden">
      <Sidebar user={currentUser} />

      <main className="relative flex flex-1 flex-col overflow-hidden bg-stone-50">
        <div className="flex-1 overflow-y-auto p-4 lg:p-8">
          <div className="mx-auto flex max-w-[1500px] flex-col gap-8">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="max-w-2xl">
                <span className="rounded bg-primary/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-stone-900">
                  Main Page / Student Management / ATL Input
                </span>
                <h1 className="mt-3 text-3xl font-black text-text-main-light lg:text-4xl">ATL Batch Input</h1>
                <p className="mt-3 text-sm text-text-sub-light">
                    Penilaian cepat untuk banyak siswa dalam satu grid. Tabel bisa di-scroll untuk memudahkan input kriteria dalam jumlah besar.
                </p>
              </div>
              <div className="inline-flex rounded-2xl border border-stone-200 bg-white p-1 shadow-[0_8px_18px_rgba(15,23,42,0.05)]">
                <Link
                  to="/input-atl"
                  className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-stone-600 transition-all hover:bg-primary/5 hover:text-primary"
                >
                  <span className="material-symbols-outlined text-[18px]">person</span>
                  Detailed
                </Link>
                <span className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-black text-white shadow-sm">
                  <span className="material-symbols-outlined text-[18px]">grid_on</span>
                  Batch
                </span>
              </div>
            </div>

            <section className="rounded-[1.8rem] border border-stone-200 bg-white p-6 shadow-[0_18px_40px_rgba(15,23,42,0.06)]">
              <div className="grid gap-4 lg:grid-cols-3">
                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.22em] text-stone-500">Kelas</label>
                  <select
                    value={selectedClass}
                    onChange={(e) => setSelectedClass(e.target.value)}
                    className="block w-full rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm font-semibold text-stone-900 outline-none transition-all focus:border-primary focus:bg-white focus:ring-4 focus:ring-primary/10"
                  >
                    {classOptions.map((cls) => (
                      <option key={cls} value={cls}>{cls}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.22em] text-stone-500">Mata Pelajaran</label>
                  <select
                    value={selectedSubject}
                    onChange={(e) => setSelectedSubject(e.target.value)}
                    className="block w-full rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm font-semibold text-stone-900 outline-none transition-all focus:border-primary focus:bg-white focus:ring-4 focus:ring-primary/10"
                  >
                    {Object.keys(subjectTopicMap).map((subject) => (
                      <option key={subject} value={subject}>{subject}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <label className="block text-xs font-semibold uppercase tracking-[0.22em] text-stone-500">Topik</label>
                    <button
                      type="button"
                      onClick={saveFilterSelection}
                      className="text-[10px] font-black uppercase text-primary transition-all hover:underline"
                    >
                      Simpan Default
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2 rounded-[1.5rem] border border-stone-200 bg-stone-50 p-3">
                    {topicOptions.map((topic, idx) => (
                      <button
                        key={topic.id}
                        type="button"
                        onClick={() => setSelectedTopicIndex(idx)}
                        className={`rounded-2xl px-4 py-2.5 text-xs font-bold transition-all ${
                          selectedTopicIndex === idx
                            ? "bg-primary text-white shadow-[0_10px_25px_rgba(234,179,8,0.18)]"
                            : "border border-stone-200 bg-white text-stone-700 hover:border-primary/40 hover:bg-primary/5"
                        }`}
                      >
                        {topic.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            <section className="rounded-[1.8rem] border border-stone-200 bg-white shadow-[0_18px_40px_rgba(15,23,42,0.06)]">
              <div className="flex flex-col gap-3 border-b border-stone-200 px-6 py-5 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.2em] text-stone-500">Batch Entry: Criteria Grid</p>
                  <h2 className="mt-1 text-xl font-black text-stone-900">
                    {selectedClass} - {selectedTopic.label}
                  </h2>
                  <p className="mt-1 text-xs text-stone-500">
                    {students.length} siswa, {columns.length} kriteria, {filledCells}/{totalCells} cell terisi
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-700">
                    Progress {progress}%
                  </span>
                  <button
                    type="button"
                    onClick={resetGrid}
                    className="rounded-2xl border border-stone-200 bg-white px-4 py-2 text-xs font-bold text-stone-700 transition-all hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
                  >
                    Reset Grid
                  </button>
                </div>
              </div>

              <div className="px-6 py-5">
                {columns.length > 0 ? (
                  <div className="overflow-auto rounded-2xl border border-stone-200 bg-white" style={{ maxHeight: "65vh" }}>
                    <table className="w-full min-w-[1200px] border-separate border-spacing-0">
                      <thead className="sticky top-0 z-20 bg-stone-100">
                        <tr>
                          <th className="sticky left-0 z-30 min-w-[250px] border-b border-r border-stone-200 bg-stone-100 px-4 py-3 text-left text-[11px] font-black uppercase tracking-[0.18em] text-stone-500">
                            Student Name
                          </th>
                          {columns.map((column) => (
                            <th
                              key={column.id}
                              className="min-w-[300px] border-b border-r border-stone-200 bg-stone-100 px-4 py-3 text-left"
                            >
                              <p className="text-[11px] font-black uppercase tracking-[0.14em] text-stone-700">
                                {column.title}
                              </p>
                              <div className="mt-2 flex flex-wrap gap-1.5">
                                {column.atlNames.length > 0 ? (
                                  column.atlNames.map((atlName) => {
                                    const config = atlConfig[atlName] || {
                                      icon: "label",
                                      color: "bg-stone-100 text-stone-600",
                                    };

                                    return (
                                      <span
                                        key={atlName}
                                        className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-black ${config.color}`}
                                      >
                                        <span className="material-symbols-outlined text-[13px]">{config.icon}</span>
                                        {atlName}
                                      </span>
                                    );
                                  })
                                ) : (
                                  <span className="inline-flex rounded-full bg-stone-100 px-2 py-1 text-[10px] font-black text-stone-600">
                                    ATL
                                  </span>
                                )}
                              </div>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {students.map((student) => {
                          const studentScore = batchStudentScores[student.id];
                          const hasScore = Number.isFinite(studentScore);

                          return (
                          <tr key={student.id} className="odd:bg-white even:bg-stone-50/70">
                            <td className="sticky left-0 z-10 border-b border-r border-stone-200 bg-inherit px-4 py-3">
                              <div className="flex items-center gap-3">
                                <div
                                  className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${student.avatarTone} text-xs font-black text-stone-900`}
                                >
                                  {student.initials}
                                </div>
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-bold text-stone-900">{student.name}</p>
                                  <p className="text-xs text-stone-500">{student.nis}</p>
                                  <p className={`mt-1 text-sm font-black ${hasScore ? "text-emerald-700" : "text-stone-400"}`}>
                                    {hasScore ? `${studentScore}%` : "Belum dinilai"}
                                  </p>
                                </div>
                              </div>
                            </td>
                            {columns.map((column) => {
                              const value = batchRatingsByStudent[student.id]?.[column.id] || "";
                              const activeOption = ratingOptions.find((item) => item.label === value);
                              const activeCode = activeOption?.code || "NONE";
                              const tone = levelStyleMap[activeCode] || levelStyleMap.NONE;
                              const isMatrixOpen =
                                matrixContext?.student?.id === student.id &&
                                matrixContext?.column?.id === column.id;
                              const activePhrase = activeOption
                                ? column.levels?.[activeOption.code] || "Frasa level belum tersedia."
                                : "Pilih salah satu skala untuk menampilkan frasa penilaian.";

                              return (
                                <td
                                  key={`${student.id}-${column.id}`}
                                  className={`border-b border-r px-3 py-3 transition-colors ${tone.cell}`}
                                >
                                  <div className="space-y-2">
                                    <div className="grid grid-cols-5 gap-1.5">
                                      {ratingOptions.map((option) => {
                                        const selected = value === option.label;
                                        const optionTone = levelStyleMap[option.code];

                                        return (
                                          <button
                                            key={option.code}
                                            type="button"
                                            onClick={() =>
                                              handleCellChange(
                                                student.id,
                                                column.id,
                                                selected ? "" : option.label
                                              )
                                            }
                                            className={`flex h-9 items-center justify-center rounded-xl border text-[11px] font-black transition-all ${
                                              selected
                                                ? `${optionTone.button} -translate-y-0.5 shadow-lg`
                                                : optionTone.idleButton
                                            }`}
                                            title={`${option.code} - ${option.label}`}
                                            aria-label={`${student.name} ${column.title} ${option.code}`}
                                          >
                                            {option.code}
                                          </button>
                                        );
                                      })}
                                    </div>
                                    <div className="flex items-center justify-between gap-2">
                                      <button
                                        type="button"
                                        onClick={() => openMatrix(student, column)}
                                        className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase transition-all ${
                                          isMatrixOpen
                                            ? "border-primary bg-primary text-white shadow-sm"
                                            : "border-stone-200 bg-white text-stone-600 hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
                                        }`}
                                      >
                                        <span className="material-symbols-outlined text-[13px]">table_chart</span>
                                        Matriks
                                      </button>
                                      <span className={`rounded-full border px-2 py-1 text-[10px] font-black uppercase ${tone.chip}`}>
                                        {activeOption?.code || "-"}
                                      </span>
                                    </div>

                                    <div className="rounded-xl border border-stone-200 bg-white px-3 py-2">
                                      <div className="flex items-center justify-between gap-2">
                                        <p className="truncate text-[11px] font-black uppercase tracking-[0.14em] text-stone-500">
                                          {activeOption?.label || "Belum dinilai"}
                                        </p>
                                        {activeOption && (
                                          <span className="text-[10px] font-black text-stone-400">
                                            {activeOption.code}
                                          </span>
                                        )}
                                      </div>
                                      <p className="mt-1 text-[11px] leading-4 text-stone-700">
                                        {activePhrase}
                                      </p>
                                    </div>

                                  </div>
                                </td>
                              );
                            })}
                          </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="rounded-2xl border-2 border-dashed border-amber-200 bg-amber-50 py-10 text-center text-sm font-medium text-amber-900">
                    Belum ada kriteria ATL untuk topik ini.
                  </div>
                )}
              </div>
            </section>
          </div>
        </div>

        <div className="border-t border-stone-200 bg-white px-5 py-4 shadow-[0_-8px_22px_rgba(15,23,42,0.04)]">
          <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-4">
            <Link
              to="/students"
              className="rounded-2xl border border-stone-200 bg-white px-6 py-3 text-sm font-semibold text-stone-700 transition-all hover:bg-stone-50"
            >
              Kembali
            </Link>
            <div className="flex items-center gap-3">
              <button
                onClick={handleSaveDraft}
                className="rounded-2xl border border-primary/25 bg-primary/5 px-6 py-3 text-sm font-semibold text-primary transition-all hover:border-primary/40 hover:bg-primary/10"
              >
                Simpan Draft
              </button>
              <button
                onClick={handleSend}
                className="inline-flex items-center gap-2 rounded-2xl bg-amber-500 px-6 py-3 text-sm font-bold text-stone-900 shadow-[0_16px_28px_rgba(245,158,11,0.24)] transition-all hover:bg-amber-400"
              >
                <span className="material-symbols-outlined text-[18px]">send</span>
                Submit All Assessment
              </button>
            </div>
          </div>
        </div>

        {matrixContext &&
          (() => {
            const { student, column } = matrixContext;
            const value = batchRatingsByStudent[student.id]?.[column.id] || "";
            const activeOption = ratingOptions.find((item) => item.label === value);

            return (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/45 px-4 py-6 backdrop-blur-sm">
                <div className="w-full max-w-2xl overflow-hidden rounded-[1.75rem] border border-stone-200 bg-white shadow-[0_30px_80px_rgba(15,23,42,0.22)]">
                  <div className="flex items-start justify-between gap-4 border-b border-stone-200 px-6 py-5">
                    <div>
                      <span className="rounded bg-primary/20 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-primary">
                        Matriks Skala ATL
                      </span>
                      <h3 className="mt-3 text-xl font-black text-stone-900">{column.title}</h3>
                      <p className="mt-1 text-sm text-stone-500">
                        {student.name} - {column.atlNames.join(", ") || "ATL"}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={closeMatrix}
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-stone-200 bg-white text-stone-500 transition-all hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
                      aria-label="Tutup matriks"
                    >
                      <span className="material-symbols-outlined text-[20px]">close</span>
                    </button>
                  </div>

                  <div className="space-y-3 p-6">
                    {ratingOptions.map((option) => {
                      const optionTone = levelStyleMap[option.code];
                      const selected = value === option.label;

                      return (
                        <button
                          key={option.code}
                          type="button"
                          onClick={() => handleCellChange(student.id, column.id, option.label)}
                          className={`grid w-full gap-3 rounded-2xl border p-4 text-left transition-all sm:grid-cols-[72px_1fr] ${
                            selected
                              ? `${optionTone.button} shadow-lg`
                              : "border-stone-200 bg-stone-50 hover:border-primary/30 hover:bg-white"
                          }`}
                        >
                          <div
                            className={`flex h-12 w-16 items-center justify-center rounded-xl text-sm font-black ${
                              selected ? "bg-white/20 text-white" : `${optionTone.chip} border`
                            }`}
                          >
                            {option.code}
                          </div>
                          <div>
                            <p className={`text-sm font-black ${selected ? "text-white" : "text-stone-900"}`}>
                              {option.label}
                            </p>
                            <p className={`mt-1 text-sm leading-6 ${selected ? "text-white/90" : "text-stone-600"}`}>
                              {column.levels?.[option.code] || "Frasa belum tersedia."}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  <div className="flex flex-col gap-3 border-t border-stone-200 bg-stone-50 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm font-semibold text-stone-600">
                      Terpilih: <span className="font-black text-stone-900">{activeOption ? `${activeOption.code} - ${activeOption.label}` : "Belum dinilai"}</span>
                    </p>
                    <button
                      type="button"
                      onClick={closeMatrix}
                      className="rounded-2xl bg-primary px-5 py-2.5 text-sm font-black text-white shadow-md shadow-primary/20 transition-all hover:bg-secondary"
                    >
                      Selesai
                    </button>
                  </div>
                </div>
              </div>
            );
          })()}
      </main>
    </div>
  );
}

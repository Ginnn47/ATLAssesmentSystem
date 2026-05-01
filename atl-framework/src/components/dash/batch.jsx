import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Sidebar from "./sidebar";
import { allStudentsData } from "./dummyStudents";
import { dummyATL, saveATLData } from "./dummyATL";

const ratingOptions = [
  { label: "Need Improvement", code: "NFI", tier: "Need Support" },
  { label: "Progressing Toward Expectation", code: "PTE", tier: "Novice" },
  { label: "Developing Expectation", code: "DE", tier: "Learner" },
  { label: "Meeting Expectation", code: "ME", tier: "Practitioner" },
  { label: "Exceeding Expectation", code: "EE", tier: "Expert" },
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

const scoreLabelMap = {
  EE: "Expert",
  ME: "Practitioner",
  DE: "Learner",
  PTE: "Novice",
  NFI: "Need Support",
};

const levelStyleMap = {
  NFI: {
    chip: "border-red-200 bg-red-50 text-red-700",
    cell: "border-red-100 bg-red-50/55",
    select: "border-red-200 text-red-700 focus:border-red-400 focus:ring-red-100",
  },
  PTE: {
    chip: "border-orange-200 bg-orange-50 text-orange-700",
    cell: "border-orange-100 bg-orange-50/55",
    select: "border-orange-200 text-orange-700 focus:border-orange-400 focus:ring-orange-100",
  },
  DE: {
    chip: "border-amber-200 bg-amber-50 text-amber-700",
    cell: "border-amber-100 bg-amber-50/55",
    select: "border-amber-200 text-amber-700 focus:border-amber-400 focus:ring-amber-100",
  },
  ME: {
    chip: "border-blue-200 bg-blue-50 text-blue-700",
    cell: "border-blue-100 bg-blue-50/55",
    select: "border-blue-200 text-blue-700 focus:border-blue-400 focus:ring-blue-100",
  },
  EE: {
    chip: "border-emerald-200 bg-emerald-50 text-emerald-700",
    cell: "border-emerald-100 bg-emerald-50/55",
    select: "border-emerald-200 text-emerald-700 focus:border-emerald-400 focus:ring-emerald-100",
  },
  NONE: {
    chip: "border-stone-200 bg-stone-100 text-stone-600",
    cell: "border-stone-200 bg-white",
    select: "border-stone-200 text-stone-700 focus:border-primary focus:ring-primary/10",
  },
};

export default function BatchInputATL() {
  const currentUser = { name: "Joko Wiryanto", role: "Guru / Evaluator" };

  const classOptions = useMemo(() => Object.keys(allStudentsData || {}), []);
  const [selectedClass, setSelectedClass] = useState(classOptions[0] || "");
  const [selectedSubject, setSelectedSubject] = useState("Singing");
  const [selectedTopicIndex, setSelectedTopicIndex] = useState(0);
  const [batchRatingsByStudent, setBatchRatingsByStudent] = useState({});

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
        metricKeys: (item.atl || []).map((atlName) => `${dataKey}_${item.kriteria}_${atlName}`),
      })),
    [currentATLData, dataKey]
  );

  useEffect(() => {
    const saved = localStorage.getItem("batch_filter_pref");
    if (!saved) return;

    const { cls, subj, topicIdx } = JSON.parse(saved);
    if (cls) setSelectedClass(cls);
    if (subj) setSelectedSubject(subj);
    if (Number.isInteger(topicIdx)) setSelectedTopicIndex(topicIdx);
  }, []);

  useEffect(() => {
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
        if (value) row[column.id] = value;
      });

      next[student.id] = row;
    });

    setBatchRatingsByStudent(next);
  }, [students, dataKey, columns]);

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

  const handleCellChange = (studentId, columnId, value) => {
    setBatchRatingsByStudent((prev) => ({
      ...prev,
      [studentId]: {
        ...(prev[studentId] || {}),
        [columnId]: value,
      },
    }));
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
          <div className="mx-auto flex max-w-[1500px] flex-col gap-6">
            <div className="rounded-[2rem] bg-white p-6 shadow-[0_18px_40px_rgba(15,23,42,0.08)]">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-stone-500">Main Page / ATL Input</p>
                  <h1 className="mt-2 text-3xl font-black text-stone-900 lg:text-4xl">ATL Assessment - Batch Mode</h1>
                  <p className="mt-2 text-sm text-stone-500">
                    Penilaian cepat untuk banyak siswa dalam satu grid. Tabel bisa di-scroll untuk memudahkan input kriteria dalam jumlah besar.
                  </p>
                </div>
                <Link
                  to="/input-atl"
                  className="inline-flex items-center gap-2 rounded-2xl border border-stone-200 bg-white px-5 py-3 text-sm font-semibold text-stone-700 transition-all hover:border-blue-300 hover:bg-blue-50"
                >
                  <span className="material-symbols-outlined text-[18px]">person</span>
                  Pindah ke Detailed Mode
                </Link>
              </div>
            </div>

            <section className="rounded-[1.8rem] border border-stone-200 bg-white p-6 shadow-[0_18px_40px_rgba(15,23,42,0.06)]">
              <div className="grid gap-4 lg:grid-cols-3">
                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.22em] text-stone-500">Kelas</label>
                  <select
                    value={selectedClass}
                    onChange={(e) => setSelectedClass(e.target.value)}
                    className="block w-full rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm font-semibold text-stone-900 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
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
                    className="block w-full rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm font-semibold text-stone-900 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
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
                      className="rounded-xl border border-blue-200 bg-blue-50 px-2.5 py-1 text-[10px] font-black uppercase text-blue-700 transition-all hover:bg-blue-100"
                    >
                      Simpan Default
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {topicOptions.map((topic, idx) => (
                      <button
                        key={topic.id}
                        type="button"
                        onClick={() => setSelectedTopicIndex(idx)}
                        className={`rounded-2xl px-4 py-2.5 text-xs font-bold transition-all ${
                          selectedTopicIndex === idx
                            ? "bg-blue-600 text-white shadow-[0_10px_25px_rgba(37,99,235,0.25)]"
                            : "border border-stone-200 bg-white text-stone-700 hover:border-blue-300"
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
                    className="rounded-2xl border border-stone-200 bg-white px-4 py-2 text-xs font-bold text-stone-700 transition-all hover:border-blue-300 hover:bg-blue-50"
                  >
                    Reset Grid
                  </button>
                </div>
              </div>

              <div className="px-6 py-5">
                {columns.length > 0 ? (
                  <div className="overflow-auto rounded-2xl border border-stone-200 bg-white" style={{ maxHeight: "65vh" }}>
                    <table className="min-w-[1100px] w-full border-separate border-spacing-0">
                      <thead className="sticky top-0 z-20 bg-stone-100">
                        <tr>
                          <th className="sticky left-0 z-30 min-w-[250px] border-b border-r border-stone-200 bg-stone-100 px-4 py-3 text-left text-[11px] font-black uppercase tracking-[0.18em] text-stone-500">
                            Student Name
                          </th>
                          {columns.map((column) => (
                            <th
                              key={column.id}
                              className="min-w-[240px] border-b border-r border-stone-200 bg-stone-100 px-4 py-3 text-left"
                            >
                              <p className="text-[11px] font-black uppercase tracking-[0.14em] text-stone-700">
                                {column.title}
                              </p>
                              <p className="mt-1 text-[11px] font-medium text-stone-500">
                                {column.atlNames.join(", ") || "ATL"}
                              </p>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {students.map((student) => (
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
                                </div>
                              </div>
                            </td>
                            {columns.map((column) => {
                              const value = batchRatingsByStudent[student.id]?.[column.id] || "";
                              const tier = scoreLabelMap[
                                ratingOptions.find((item) => item.label === value)?.code || ""
                              ];

                              return (
                                <td key={`${student.id}-${column.id}`} className="border-b border-r border-stone-200 px-3 py-3">
                                  <div className="space-y-1">
                                    <select
                                      value={value}
                                      onChange={(e) => handleCellChange(student.id, column.id, e.target.value)}
                                      className="block w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs font-semibold text-stone-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                    >
                                      <option value="">Pilih level</option>
                                      {ratingOptions.map((option) => (
                                        <option key={option.code} value={option.label}>
                                          {option.code} - {option.tier}
                                        </option>
                                      ))}
                                    </select>
                                    <p className="min-h-[16px] text-[11px] font-medium text-stone-500">
                                      {tier || "Belum dinilai"}
                                    </p>
                                  </div>
                                </td>
                              );
                            })}
                          </tr>
                        ))}
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
                className="rounded-2xl border border-blue-200 bg-blue-50 px-6 py-3 text-sm font-semibold text-blue-700 transition-all hover:bg-blue-100"
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
      </main>
    </div>
  );
}

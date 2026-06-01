import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Sidebar from "./sidebar";
import { allStudentsData } from "../dummyData/dummyStudents";
import { dummyATL, saveATLData } from "../dummyData/dummyATL";
import { getStudents, hydrateTopic, saveAssessment } from "../../services/atlApi";
import { getRatingMeta, getScoreLevel, hydrateLabelRegistry, ratingOptions } from "../../services/labelRegistry";
import { getSubjectTopicMapByLabel } from "../../services/topicCatalog";

const getLevelStyle = (code) => {
  const meta = getRatingMeta(code);
  return {
    chip: meta.chipClass,
    text: meta.textClass,
    cell: meta.cellClass,
    button: meta.buttonClass,
    idleButton: meta.idleButtonClass,
  };
};

const normalizeRatingLabel = (label) =>
  label === "Need Improvement" ? "Need Further Improvement" : label;

const ratingValueMap = {
  "Exceeding Expectation": 0.9,
  "Meeting Expectation": 0.7,
  "Developing Expectation": 0.5,
  "Progressing Toward Expectation": 0.3,
  "Need Further Improvement": 0.1,
  "Need Improvement": 0.1,
};

const getScoreCategory = getScoreLevel;

export default function BatchInputATL() {
  const currentUser = { name: "Joko Wiryanto", role: "Guru / Evaluator" };

  const classOptions = useMemo(() => Object.keys(allStudentsData || {}), []);
  const [selectedClass, setSelectedClass] = useState(classOptions[0] || "");
  const [selectedSubject, setSelectedSubject] = useState("Singing");
  const [selectedTopicIndex, setSelectedTopicIndex] = useState(0);
  const [batchRatingsByStudent, setBatchRatingsByStudent] = useState({});
  const [matrixContext, setMatrixContext] = useState(null);
  const [showDetailPanel, setShowDetailPanel] = useState(true);
  const [dataVersion, setDataVersion] = useState(0);
  const [apiStudents, setApiStudents] = useState(allStudentsData[selectedClass] || []);
  const [subjectTopicMap, setSubjectTopicMap] = useState(getSubjectTopicMapByLabel);
  const [filtersHydrated, setFiltersHydrated] = useState(false);
  const skipNextSubjectResetRef = React.useRef(false);

  useEffect(() => {
    hydrateLabelRegistry().then(() => setDataVersion((version) => version + 1));
  }, []);

  const topicOptions = useMemo(() => subjectTopicMap[selectedSubject] || [], [selectedSubject, subjectTopicMap]);
  const selectedTopic = topicOptions[selectedTopicIndex] || { id: "", label: "Pilih Topik" };
  const dataKey = selectedTopic.id;

  const students = useMemo(
    () => (apiStudents.length > 0 ? apiStudents : allStudentsData[selectedClass] || []),
    [apiStudents, selectedClass]
  );
  const currentATLData = dummyATL[dataKey] || [];

  const columns = useMemo(
    () =>
      currentATLData.map((item, idx) => ({
        id: `metric-${idx}`,
        title: item.kriteria,
        categories: item.atlCategories || (item.category ? item.category.split(",").map((name) => name.trim()).filter(Boolean) : []),
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
    const syncTopics = () => setSubjectTopicMap(getSubjectTopicMapByLabel());

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
  }, []);

  useEffect(() => {
    let cancelled = false;
    getStudents(selectedClass).then((studentsFromApi) => {
      if (!cancelled) setApiStudents(studentsFromApi);
    });
    return () => {
      cancelled = true;
    };
  }, [selectedClass]);

  useEffect(() => {
    if (!dataKey) return undefined;
    let cancelled = false;
    hydrateTopic(dataKey).then(() => {
      if (!cancelled) setDataVersion((version) => version + 1);
    });
    return () => {
      cancelled = true;
    };
  }, [dataKey]);

  useEffect(() => {
    const saved = localStorage.getItem("batch_filter_pref");
    if (!saved) {
      setFiltersHydrated(true);
      return;
    }

    const { cls, subj, topicIdx } = JSON.parse(saved);
    if (cls) setSelectedClass(cls);
    if (subj) {
      skipNextSubjectResetRef.current = true;
      setSelectedSubject(subj);
    }
    if (Number.isInteger(topicIdx)) setSelectedTopicIndex(topicIdx);
    setFiltersHydrated(true);
  }, []);

  useEffect(() => {
    if (skipNextSubjectResetRef.current) {
      skipNextSubjectResetRef.current = false;
      return;
    }

    setSelectedTopicIndex(0);
  }, [selectedSubject]);

  useEffect(() => {
    if (!filtersHydrated) return;
    if (!selectedClass || !selectedSubject) return;
    localStorage.setItem(
      "batch_filter_pref",
      JSON.stringify({
        cls: selectedClass,
        subj: selectedSubject,
        topicIdx: selectedTopicIndex,
      })
    );
  }, [filtersHydrated, selectedClass, selectedSubject, selectedTopicIndex]);

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
          const legacyWeightKey = `${column.title} (${atlName})`;
          const packageWeight = Object.values(weights.packages || {}).find((pkg) => pkg.title === column.title)?.weights?.[atlName];
          const weight = parseFloat(packageWeight ?? weights[legacyWeightKey] ?? weights[atlName]) || 0;
          if (weight > 0) {
            totalWeightedScore += ratingValue * weight;
            totalWeight += weight;
          }
          fallbackScore += ratingValue * 100;
          fallbackCount += 1;
        });
      });

      const score =
        totalWeight > 0
          ? (totalWeightedScore / totalWeight) * 100
          : fallbackCount > 0
            ? fallbackScore / fallbackCount
            : null;

      acc[student.id] = score === null ? null : Math.round(score);
      return acc;
    }, {});
  }, [students, columns, batchRatingsByStudent, dataKey]);

  const handleCellChange = (studentId, columnId, value) => {
    setBatchRatingsByStudent((prev) => {
      const nextStudentRow = {
        ...(prev[studentId] || {}),
        [columnId]: value,
      };
      const next = {
        ...prev,
        [studentId]: nextStudentRow,
      };
      const column = columns.find((item) => item.id === columnId);
      if (column && dataKey) {
        if (!dummyATL.savedAssessments) dummyATL.savedAssessments = {};
        if (!dummyATL.savedAssessments[studentId]) dummyATL.savedAssessments[studentId] = {};
        const topicRatings = { ...(dummyATL.savedAssessments[studentId][dataKey] || {}) };
        column.metricKeys.forEach((metricKey) => {
          if (value) topicRatings[metricKey] = value;
          else delete topicRatings[metricKey];
        });
        dummyATL.savedAssessments[studentId][dataKey] = topicRatings;
        saveATLData(dummyATL);
      }
      return next;
    });
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

  const persistBatchAssessment = async () => {
    if (!dataKey || columns.length === 0 || students.length === 0) return false;

    if (!dummyATL.savedAssessments) dummyATL.savedAssessments = {};
    const apiWrites = [];

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
      apiWrites.push(saveAssessment(student.id, dataKey, topicRatings));
    });

    saveATLData(dummyATL);
    await Promise.all(apiWrites);
    return true;
  };

  const handleSaveDraft = async () => {
    if (!(await persistBatchAssessment())) return;
    alert(`Draft batch ${students.length} siswa berhasil disimpan.`);
  };

  const handleSend = async () => {
    if (!(await persistBatchAssessment())) return;
    alert(`Penilaian batch ${students.length} siswa berhasil dikirim.`);
  };

  const detailContext = matrixContext || (students[0] && columns[0] ? { student: students[0], column: columns[0] } : null);
  const detailValue = detailContext ? batchRatingsByStudent[detailContext.student.id]?.[detailContext.column.id] || "" : "";
  const detailOption = ratingOptions.find((item) => item.label === detailValue);
  const detailTone = getLevelStyle(detailOption?.code || "NONE");
  const detailStudentScore = detailContext ? batchStudentScores[detailContext.student.id] : null;
  const detailStudentCategory = getScoreCategory(detailStudentScore);
  const detailWeight = detailContext
    ? (() => {
        const weights = dummyATL.savedWeights?.[dataKey] || {};
        const packageWeight = Object.values(weights.packages || {}).find((pkg) => pkg.title === detailContext.column.title)?.weights || {};
        const values = detailContext.column.atlNames
          .map((atlName) => Number(packageWeight[atlName] ?? weights[`${detailContext.column.title} (${atlName})`] ?? weights[atlName] ?? 0))
          .filter((weight) => weight > 0);
        return values.length > 0 ? values.reduce((sum, weight) => sum + weight, 0) / values.length : 0;
      })()
    : 0;

  return (
    <div className="flex h-screen w-full overflow-hidden bg-stone-50">
      <Sidebar user={currentUser} />
      <main className="relative flex h-full flex-1 flex-col overflow-hidden bg-stone-50">
        <div className="flex-1 overflow-y-auto p-4 lg:p-8">
          <div className="mx-auto flex max-w-[1500px] flex-col gap-8">
            <div className="flex flex-col gap-4 rounded-[1.75rem] border border-stone-200 bg-white p-6 shadow-[0_18px_40px_rgba(15,23,42,0.06)] xl:flex-row xl:items-center xl:justify-between">
              <div className="max-w-2xl">
                <span className="rounded bg-primary/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-primary-hover">
                  Assessment / ATL Input
                </span>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <h1 className="text-3xl font-black text-text-main-light">Input Penilaian ATL</h1>
                  <span className="rounded-full bg-primary/10 px-4 py-1.5 text-sm font-black text-primary">{selectedTopic.label}</span>
                </div>
                <p className="mt-2 text-sm text-text-sub-light">
                  Batch compact mode untuk {selectedClass} dengan {students.length} siswa.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
              <div className="inline-flex rounded-2xl border border-stone-200 bg-stone-100 p-1 shadow-inner">
                <Link
                  to="/input-atl"
                  className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-stone-600 transition-all hover:bg-white hover:text-primary"
                >
                  <span className="material-symbols-outlined text-[18px]">person</span>
                  Detailed
                </Link>
                <span className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-black text-white shadow-sm">
                  <span className="material-symbols-outlined text-[18px]">grid_on</span>
                  Batch
                </span>
              </div>
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-2.5 text-sm font-black text-emerald-700 transition-all hover:bg-emerald-100"
              >
                <span className="material-symbols-outlined text-[18px]">ios_share</span>
                Export Excel
              </button>
              <button
                onClick={handleSend}
                className="inline-flex items-center gap-2 rounded-xl bg-stone-950 px-6 py-2.5 text-sm font-black text-white shadow-lg shadow-stone-950/15 transition-all hover:bg-stone-800"
              >
                <span className="material-symbols-outlined text-[18px]">save</span>
                Simpan
              </button>
              </div>
            </div>

            <section className="rounded-[1.4rem] border border-stone-200 bg-white p-4 shadow-[0_14px_32px_rgba(15,23,42,0.05)]">
              <div className="grid gap-3 lg:grid-cols-[1fr_1fr_1.4fr_auto] lg:items-end">
                <div>
                  <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.22em] text-stone-500">Kelas</label>
                  <select
                    value={selectedClass}
                    onChange={(e) => setSelectedClass(e.target.value)}
                    className="block w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm font-bold text-stone-900 outline-none transition-all focus:border-primary focus:bg-white focus:ring-4 focus:ring-primary/10"
                  >
                    {classOptions.map((cls) => (
                      <option key={cls} value={cls}>{cls}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.22em] text-stone-500">Mata Pelajaran</label>
                  <select
                    value={selectedSubject}
                    onChange={(e) => setSelectedSubject(e.target.value)}
                    className="block w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm font-bold text-stone-900 outline-none transition-all focus:border-primary focus:bg-white focus:ring-4 focus:ring-primary/10"
                  >
                    {Object.keys(subjectTopicMap).map((subject) => (
                      <option key={subject} value={subject}>{subject}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <label className="block text-[10px] font-black uppercase tracking-[0.22em] text-stone-500">Subtopik</label>
                    <button
                      type="button"
                      onClick={saveFilterSelection}
                      className="text-[10px] font-black uppercase text-primary transition-all hover:underline"
                    >
                      Simpan Default
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2 rounded-xl border border-stone-200 bg-stone-50 p-2">
                    {topicOptions.map((topic, idx) => (
                      <button
                        key={topic.id}
                        type="button"
                        onClick={() => setSelectedTopicIndex(idx)}
                        className={`rounded-lg px-3 py-2 text-xs font-bold transition-all ${
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
                <button
                  type="button"
                  onClick={() => setShowDetailPanel((value) => !value)}
                  className={`inline-flex h-[46px] items-center justify-center gap-2 rounded-xl border px-4 text-xs font-black transition-all ${
                    showDetailPanel
                      ? "border-orange-200 bg-orange-50 text-orange-700"
                      : "border-stone-200 bg-white text-stone-600 hover:border-primary/30 hover:bg-primary/5"
                  }`}
                >
                  <span className="material-symbols-outlined text-[17px]">{showDetailPanel ? "visibility_off" : "visibility"}</span>
                  {showDetailPanel ? "Sembunyikan Detail" : "Tampilkan Detail"}
                </button>
              </div>
            </section>

            <section className="rounded-[1.8rem] border border-stone-200 bg-white shadow-[0_18px_40px_rgba(15,23,42,0.06)]">
              <div className="flex flex-col gap-4 border-b border-stone-200 px-6 py-5 xl:flex-row xl:items-center xl:justify-between">
                <div className="flex max-w-4xl items-start gap-3 rounded-xl border border-primary/30 bg-primary/10 px-4 py-3 text-xs font-semibold text-stone-700">
                  <span className="material-symbols-outlined mt-0.5 text-[18px] text-primary">info</span>
                  <div>
                    <p className="font-black text-stone-900">Mode batch menyimpan otomatis setiap klik level.</p>
                    <p className="mt-1 leading-5">Pilih level pada cell siswa-kriteria, lalu buka panel detail untuk membaca deskripsi level dan melihat skor real-time siswa.</p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <span className="rounded-2xl border border-stone-200 bg-white px-3 py-2 text-xs font-black text-stone-700">
                    Progress {progress}%
                  </span>
                  <button
                    onClick={handleSaveDraft}
                    className="inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-5 py-2.5 text-sm font-black text-stone-700 transition-all hover:border-primary/40 hover:bg-primary/5"
                  >
                    <span className="material-symbols-outlined text-[18px]">save</span>
                    Simpan Draft
                  </button>
                </div>
              </div>

              <div className={`grid gap-4 px-6 py-5 ${showDetailPanel ? "xl:grid-cols-[minmax(0,1fr)_340px]" : ""}`}>
                <div className="min-w-0">
                {columns.length > 0 ? (
                  <div className="overflow-auto rounded-2xl border border-stone-200 bg-white" style={{ maxHeight: "66vh" }}>
                    <table className="w-full min-w-[1180px] border-separate border-spacing-0">
                      <thead className="sticky top-0 z-20 bg-white">
                        <tr>
                          <th className="sticky left-0 z-30 min-w-[170px] border-b border-r border-stone-200 bg-white px-4 py-6 text-left text-[11px] font-black uppercase tracking-[0.18em] text-stone-500">
                            Siswa
                          </th>
                          {columns.map((column) => {
                            return (
                              <th
                                key={column.id}
                                className="min-w-[165px] border-b border-r border-stone-200 bg-white px-4 py-5 text-left"
                              >
                                <button
                                  type="button"
                                  onClick={() => students[0] && openMatrix(students[0], column)}
                                  className="block w-full text-left"
                                  title={column.atlNames.join(", ")}
                                >
                                  <span className="line-clamp-2 block text-[12px] font-black leading-5 text-stone-900">{column.title}</span>
                                </button>
                              </th>
                            );
                          })}
                        </tr>
                      </thead>
                      <tbody>
                        {students.map((student) => {
                          const studentScore = batchStudentScores[student.id];
                          const hasScore = Number.isFinite(studentScore);

                          return (
                          <tr key={student.id} className="odd:bg-white even:bg-stone-50/70">
                            <td className="sticky left-0 z-10 border-b border-r border-stone-200 bg-inherit px-4 py-4">
                              <div className="flex items-center gap-3">
                                <div
                                  className={`flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br ${student.avatarTone} text-sm font-black text-stone-900`}
                                >
                                  {student.initials}
                                </div>
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-black text-stone-900">{student.name}</p>
                                  <p className="text-[11px] font-semibold text-stone-500">{student.nis}</p>
                                </div>
                              </div>
                            </td>
                            {columns.map((column) => {
                              const value = batchRatingsByStudent[student.id]?.[column.id] || "";
                              const activeOption = ratingOptions.find((item) => item.label === value);
                              const activeCode = activeOption?.code || "NONE";
                              const tone = getLevelStyle(activeCode || "NONE");
                              const isMatrixOpen =
                                matrixContext?.student?.id === student.id &&
                                matrixContext?.column?.id === column.id;

                              return (
                                <td
                                  key={`${student.id}-${column.id}`}
                                  className={`border-b border-r px-3 py-5 transition-colors ${isMatrixOpen ? "bg-orange-50 ring-1 ring-inset ring-orange-300" : "bg-white hover:bg-stone-50"}`}
                                  onClick={() => openMatrix(student, column)}
                                >
                                  <div className="flex items-center justify-center">
                                    <div className="grid grid-cols-5 gap-2">
                                      {ratingOptions.map((option) => {
                                        const selected = value === option.label;
                                        const optionTone = getLevelStyle(option.code);

                                        return (
                                          <button
                                            key={option.code}
                                            type="button"
                                            onClick={(event) => {
                                              event.stopPropagation();
                                              handleCellChange(
                                                student.id,
                                                column.id,
                                                selected ? "" : option.label
                                              );
                                              openMatrix(student, column);
                                            }}
                                            className={`relative flex h-8 min-w-9 items-center justify-center rounded-md border px-1 text-[10px] font-black transition-all ${
                                              selected
                                                ? `${optionTone.button} shadow-md`
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

                {showDetailPanel && (
                <aside className="rounded-[1.5rem] border border-stone-200 bg-white p-5 shadow-[0_18px_45px_rgba(15,23,42,0.08)] xl:sticky xl:top-4 xl:max-h-[65vh] xl:overflow-y-auto">
                  <div className="mb-5 flex items-start justify-between gap-3 border-b border-stone-100 pb-4">
                    <div>
                      <p className="text-[11px] font-black uppercase tracking-[0.18em] text-stone-500">Detail Level</p>
                      <h3 className="mt-3 text-sm font-black text-stone-900">
                        {detailContext?.column.title || "Pilih kriteria"}
                      </h3>
                      <p className="mt-1 text-xs font-semibold text-stone-500">
                        {detailContext?.student.name || "Klik salah satu sel pada tabel"}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={closeMatrix}
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-stone-200 bg-white text-stone-500 transition-all hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
                      aria-label="Tutup detail"
                    >
                      <span className="material-symbols-outlined text-[18px]">close</span>
                    </button>
                  </div>

                  <div className="space-y-5">
                    <div className="rounded-2xl border border-stone-200 bg-white p-4">
                      <p className="text-[11px] font-black uppercase tracking-[0.14em] text-stone-500">Real-time Score</p>
                      <div className="mt-3 flex items-end justify-between gap-3">
                        <div>
                          <p className="text-4xl font-black text-stone-900">
                            {Number.isFinite(detailStudentScore) ? detailStudentScore : 0}
                            <span className="text-base text-stone-500">/100</span>
                          </p>
                        </div>
                        <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase ${detailStudentCategory.className}`}>
                          {detailStudentCategory.label}
                        </span>
                      </div>
                    </div>

                    <div>
                      <p className="mb-2 text-[11px] font-black uppercase tracking-[0.14em] text-stone-500">Level Terpilih</p>
                      <div className="flex items-center gap-3 rounded-2xl border border-stone-100 bg-stone-50 p-3">
                        <span className={`inline-flex h-10 w-12 items-center justify-center rounded-xl border text-sm font-black ${detailTone.chip}`}>
                          {detailOption?.code || "-"}
                        </span>
                        <div>
                          <p className={`text-sm font-black ${detailTone.text}`}>{detailOption?.label || "Belum dinilai"}</p>
                          <p className="text-xs font-semibold text-stone-500">Klik level pada tabel untuk memilih.</p>
                        </div>
                      </div>
                    </div>

                    <div>
                      <p className="mb-2 text-[11px] font-black uppercase tracking-[0.14em] text-stone-500">Deskripsi Level</p>
                      <p className="rounded-2xl border border-stone-100 bg-white p-4 text-sm leading-6 text-stone-700">
                        {detailOption && detailContext
                          ? detailContext.column.levels?.[detailOption.code] || "Frasa belum tersedia."
                          : "Pilih level pada salah satu cell untuk melihat deskripsi rubric."}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-primary/30 bg-primary/10 p-4">
                      <p className="text-[11px] font-black uppercase tracking-[0.14em] text-stone-600">Status Cell</p>
                      <p className="mt-2 text-xl font-black text-stone-900">{detailOption ? "Sudah dinilai" : "Belum dinilai"}</p>
                    </div>

                    <div>
                      <p className="mb-3 text-[11px] font-black uppercase tracking-[0.14em] text-stone-500">Semua Level</p>
                      <div className="space-y-3">
                        {ratingOptions.map((option) => {
                          const optionTone = getLevelStyle(option.code);
                          const selected = detailValue === option.label;
                          return (
                            <button
                              key={option.code}
                              type="button"
                              disabled={!detailContext}
                              onClick={() => detailContext && handleCellChange(detailContext.student.id, detailContext.column.id, option.label)}
                              className={`grid w-full grid-cols-[52px_1fr_54px] items-center gap-3 rounded-2xl border p-3 text-left transition-all ${
                                selected ? "border-[#FDAD67] bg-[#FDAD67]/15 shadow-sm" : "border-stone-100 bg-white hover:border-primary/30 hover:bg-primary/5"
                              }`}
                            >
                              <span className={`inline-flex h-10 items-center justify-center rounded-xl border text-xs font-black ${optionTone.chip}`}>
                                {option.code}
                              </span>
                              <span>
                                <span className="block text-xs font-black text-stone-900">{option.label}</span>
                                <span className="mt-1 line-clamp-2 block text-[11px] leading-4 text-stone-600">
                                  {detailContext?.column.levels?.[option.code] || "Frasa belum tersedia."}
                                </span>
                              </span>
                              <span className="text-center text-[10px] font-bold text-stone-500">
                                Skor<br />
                                <strong className="text-stone-900">{Math.round((ratingValueMap[option.label] || 0) * 100)}</strong>
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </aside>
                )}
                <div className={showDetailPanel ? "xl:col-span-2" : ""}>
                  <div className="flex flex-col gap-3 rounded-2xl bg-stone-50 px-4 py-4 text-xs font-semibold text-stone-500 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                      <span className="material-symbols-outlined text-[18px] text-orange-500">info</span>
                      Rubrik dan bobot dihitung otomatis menggunakan metode Fuzzy-AHP.
                    </div>
                    <div className="flex items-center justify-end gap-3">
                      <span>Menampilkan {Math.min(students.length, 8)} dari {students.length} siswa</span>
                      <button type="button" className="flex h-8 w-8 items-center justify-center rounded-lg border border-stone-200 bg-white">
                        <span className="material-symbols-outlined text-[16px]">chevron_left</span>
                      </button>
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-xs font-black text-white">1</span>
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-stone-200 bg-white text-xs font-black text-stone-600">2</span>
                      <button type="button" className="flex h-8 w-8 items-center justify-center rounded-lg border border-stone-200 bg-white">
                        <span className="material-symbols-outlined text-[16px]">chevron_right</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>

        <div className="hidden border-t border-stone-200 bg-white px-5 py-4 shadow-[0_-8px_22px_rgba(15,23,42,0.04)]">
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
                className="inline-flex items-center gap-2 rounded-2xl border border-stone-200 bg-white px-6 py-3 text-sm font-black text-stone-700 transition-all hover:border-primary/40 hover:bg-primary/5"
              >
                <span className="material-symbols-outlined text-[18px]">save</span>
                Simpan Draft
              </button>
              <button
                onClick={handleSend}
                className="inline-flex items-center gap-2 rounded-2xl bg-stone-950 px-6 py-3 text-sm font-black text-white shadow-[0_16px_28px_rgba(15,23,42,0.22)] transition-all hover:bg-stone-800"
              >
                <span className="material-symbols-outlined text-[18px]">save</span>
                Simpan Penilaian
              </button>
            </div>
          </div>
        </div>

        {false && matrixContext &&
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
                      const optionTone = getLevelStyle(option.code);
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

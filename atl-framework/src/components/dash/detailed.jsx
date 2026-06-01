import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import Sidebar from "./sidebar";
import { dummyATL, saveATLData } from "../dummyData/dummyATL";
import { allStudentsData } from "../dummyData/dummyStudents";
import { getStudents, hydrateTopic, saveAssessment } from "../../services/atlApi";
import { getATLCategoryMeta, getRatingMeta, getScoreLevel, getSubjectMeta, hydrateLabelRegistry, ratingOptions } from "../../services/labelRegistry";
import { getTopicsForSubjectLabel } from "../../services/topicCatalog";

const rubricScoreMap = {
  "Exceeding Expectation": 0.9,
  "Meeting Expectation": 0.7,
  "Developing Expectation": 0.5,
  "Progressing Toward Expectation": 0.3,
  "Need Further Improvement": 0.1,
};

const normalizeRatingLabel = (label) =>
  label === "Need Improvement" ? "Need Further Improvement" : label;

const getScoreCategory = getScoreLevel;

const ratingMeaning = {
  NFI: "Belum menunjukkan perilaku yang diharapkan dan masih membutuhkan bantuan intensif.",
  PTE: "Mulai mencoba, tetapi performa masih belum stabil dan perlu banyak arahan.",
  DE: "Sedang berkembang; siswa sudah berusaha namun konsistensinya masih perlu dilatih.",
  ME: "Sudah memenuhi ekspektasi utama pada kriteria ini secara cukup konsisten.",
  EE: "Melebihi ekspektasi; performa tampak kuat, mandiri, dan konsisten.",
};

const getLevelTone = (code) => {
  const meta = getRatingMeta(code);
  return {
    card: meta.cellClass,
    icon: meta.chipClass,
    text: meta.textClass,
    active: meta.buttonClass,
    activeIcon: "bg-transparent text-white",
    activeText: "text-white",
    activeBg: meta.color,
  };
};

const getCriterionWeight = (weights, criterionTitle, subskill) => {
  const packageWeight = Object.values(weights.packages || {}).find((pkg) => pkg.title === criterionTitle)?.weights?.[subskill];
  const flatKey = `${criterionTitle} (${subskill})`;
  return Number(packageWeight ?? weights[flatKey] ?? weights[subskill] ?? 0);
};

export default function DetailedInputATL() {
  const currentUser = { name: "Joko Wiryanto", role: "Guru / Evaluator" };
  const classOptions = useMemo(() => Object.keys(allStudentsData || {}), []);
  const [selectedClass, setSelectedClass] = useState(classOptions[0] || "");
  const [selectedSubject, setSelectedSubject] = useState("Singing");
  const [selectedTopicIndex, setSelectedTopicIndex] = useState(0);
  const [apiStudents, setApiStudents] = useState(allStudentsData[selectedClass] || []);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [selectedCriterionIndex, setSelectedCriterionIndex] = useState(0);
  const [ratings, setRatings] = useState({});
  const [note, setNote] = useState("");
  const [topicVersion, setTopicVersion] = useState(0);
  const [defaultSaved, setDefaultSaved] = useState(false);
  const [, setDataVersion] = useState(0);
  const skipSubjectResetRef = useRef(false);

  const topics = useMemo(() => getTopicsForSubjectLabel(selectedSubject), [selectedSubject, topicVersion]);
  const selectedTopic = topics[selectedTopicIndex] || topics[0] || { id: "", label: "Pilih Topik" };
  const dataKey = selectedTopic.id;
  const students = useMemo(() => (apiStudents.length ? apiStudents : allStudentsData[selectedClass] || []), [apiStudents, selectedClass]);
  const criteria = dummyATL[dataKey] || [];
  const criterion = criteria[selectedCriterionIndex] || criteria[0] || null;
  const weights = dummyATL.savedWeights?.[dataKey] || {};

  useEffect(() => {
    hydrateLabelRegistry().then(() => setDataVersion((version) => version + 1));
    const savedDefault = localStorage.getItem("atl_detailed_filter_default");
    if (savedDefault) {
      try {
        const parsed = JSON.parse(savedDefault);
        if (parsed.className && classOptions.includes(parsed.className)) setSelectedClass(parsed.className);
        if (parsed.subject) {
          skipSubjectResetRef.current = true;
          setSelectedSubject(parsed.subject);
        }
        if (Number.isFinite(Number(parsed.topicIndex))) setSelectedTopicIndex(Number(parsed.topicIndex));
      } catch {
        localStorage.removeItem("atl_detailed_filter_default");
      }
    }
    const syncData = () => {
      const saved = localStorage.getItem("atl_framework_data");
      if (saved) Object.assign(dummyATL, JSON.parse(saved));
      setDataVersion((version) => version + 1);
    };
    const syncTopics = () => setTopicVersion((version) => version + 1);
    window.addEventListener("focus", syncData);
    window.addEventListener("storage", syncData);
    window.addEventListener("atl-data-updated", syncData);
    window.addEventListener("atl-topics-updated", syncTopics);
    return () => {
      window.removeEventListener("focus", syncData);
      window.removeEventListener("storage", syncData);
      window.removeEventListener("atl-data-updated", syncData);
      window.removeEventListener("atl-topics-updated", syncTopics);
    };
  }, []);

  useEffect(() => {
    if (skipSubjectResetRef.current) {
      skipSubjectResetRef.current = false;
      return;
    }
    setSelectedTopicIndex(0);
  }, [selectedSubject]);
  useEffect(() => setSelectedCriterionIndex(0), [dataKey]);
  useEffect(() => {
    let cancelled = false;
    getStudents(selectedClass).then((items) => {
      if (!cancelled) setApiStudents(items);
    });
    return () => { cancelled = true; };
  }, [selectedClass]);
  useEffect(() => setSelectedStudent(students[0] || null), [students]);
  useEffect(() => {
    if (!dataKey) return;
    hydrateTopic(dataKey).then(() => setDataVersion((version) => version + 1));
  }, [dataKey]);
  useEffect(() => {
    if (!selectedStudent || !dataKey) {
      setRatings({});
      return;
    }
    setRatings({ ...(dummyATL.savedAssessments?.[selectedStudent.id]?.[dataKey] || {}) });
  }, [selectedStudent?.id, dataKey]);

  const criterionRating = useMemo(() => {
    if (!criterion) return "";
    return normalizeRatingLabel((criterion.atl || []).map((atl) => ratings[`${dataKey}_${criterion.kriteria}_${atl}`]).find(Boolean));
  }, [criterion, ratings, dataKey]);

  const scoredCriteriaCount = useMemo(() => (
    criteria.filter((item) => (item.atl || []).some((atl) => ratings[`${dataKey}_${item.kriteria}_${atl}`])).length
  ), [criteria, ratings, dataKey]);

  const calculateScoreFromRatings = (ratingMap) => {
    let total = 0;
    let totalWeight = 0;
    criteria.forEach((item) => {
      (item.atl || []).forEach((atl) => {
        const rating = normalizeRatingLabel(ratingMap[`${dataKey}_${item.kriteria}_${atl}`]);
        const score = rubricScoreMap[rating];
        const weight = getCriterionWeight(weights, item.kriteria, atl);
        if (score && weight > 0) {
          total += score * weight;
          totalWeight += weight;
        }
      });
    });
    return totalWeight > 0 ? ((total / totalWeight) * 100).toFixed(1) : "0.0";
  };

  const calculatedScore = useMemo(() => calculateScoreFromRatings(ratings), [criteria, ratings, weights, dataKey]);
  const studentScores = useMemo(
    () =>
      students.reduce((acc, student) => {
        const savedRatings = dummyATL.savedAssessments?.[student.id]?.[dataKey] || {};
        acc[student.id] = calculateScoreFromRatings(savedRatings);
        return acc;
      }, {}),
    [students, criteria, weights, dataKey, ratings]
  );

  const handleSelectRating = (levelLabel) => {
    if (!criterion || !selectedStudent || !dataKey) return;
    setRatings((prev) => {
      const next = { ...prev };
      (criterion.atl || []).forEach((atl) => {
        next[`${dataKey}_${criterion.kriteria}_${atl}`] = levelLabel;
      });
      if (!dummyATL.savedAssessments) dummyATL.savedAssessments = {};
      if (!dummyATL.savedAssessments[selectedStudent.id]) dummyATL.savedAssessments[selectedStudent.id] = {};
      dummyATL.savedAssessments[selectedStudent.id][dataKey] = next;
      saveATLData(dummyATL);
      return next;
    });
  };

  const persist = async () => {
    if (!selectedStudent || !dataKey) return false;
    if (!dummyATL.savedAssessments) dummyATL.savedAssessments = {};
    if (!dummyATL.savedAssessments[selectedStudent.id]) dummyATL.savedAssessments[selectedStudent.id] = {};
    dummyATL.savedAssessments[selectedStudent.id][dataKey] = { ...ratings };
    saveATLData(dummyATL);
    await saveAssessment(selectedStudent.id, dataKey, ratings);
    return true;
  };

  const saveDefaultSelection = () => {
    localStorage.setItem(
      "atl_detailed_filter_default",
      JSON.stringify({
        className: selectedClass,
        subject: selectedSubject,
        topicIndex: selectedTopicIndex,
        topicId: selectedTopic.id,
      })
    );
    setDefaultSaved(true);
    window.setTimeout(() => setDefaultSaved(false), 1800);
  };

  const progress = criteria.length ? Math.round((scoredCriteriaCount / criteria.length) * 100) : 0;
  const dominantWeight = criterion ? Math.max(...(criterion.atl || []).map((atl) => getCriterionWeight(weights, criterion.kriteria, atl)), 0) : 0;
  const scoreCategory = getScoreCategory(calculatedScore);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-stone-50">
      <Sidebar user={currentUser} />
      <main className="relative flex flex-1 flex-col overflow-hidden bg-stone-50">
        <div className="flex-1 overflow-y-auto p-4 lg:p-8">
          <div className="mx-auto max-w-[1500px] space-y-5 rounded-[1.75rem] bg-white p-5 shadow-[0_24px_60px_rgba(15,23,42,0.08)]">
            <header className="flex flex-col gap-4 border-b border-stone-100 pb-5 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <span className="rounded bg-primary/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-primary-hover">
                  Assessment / ATL Input
                </span>
                <h1 className="mt-3 text-3xl font-black text-text-main-light">Input Penilaian ATL</h1>
                <p className="mt-2 text-sm text-text-sub-light">
                  Mode detail dengan rubrik lengkap untuk memahami kriteria sebelum menilai.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <div className="inline-flex rounded-2xl border border-stone-200 bg-stone-100 p-1 shadow-inner">
                  <span className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-black text-white shadow-sm">
                    <span className="material-symbols-outlined text-[18px]">person</span>
                    Detailed
                  </span>
                  <Link
                    to="/input-atl/batch"
                    className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-stone-600 transition-all hover:bg-white hover:text-primary"
                  >
                    <span className="material-symbols-outlined text-[18px]">grid_on</span>
                    Batch
                  </Link>
                </div>
                <button
                  type="button"
                  onClick={saveDefaultSelection}
                  className="inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-5 py-2.5 text-sm font-black text-stone-700 transition-all hover:border-primary/40 hover:bg-primary/5"
                >
                  <span className="material-symbols-outlined text-[18px]">save_as</span>
                  {defaultSaved ? "Default Tersimpan" : "Simpan Default"}
                </button>
                <button
                  type="button"
                  onClick={persist}
                  className="inline-flex items-center gap-2 rounded-xl bg-stone-950 px-6 py-2.5 text-sm font-black text-white shadow-lg shadow-stone-950/15 transition-all hover:bg-stone-800"
                >
                  <span className="material-symbols-outlined text-[18px]">save</span>
                  Simpan
                </button>
              </div>
            </header>

        <section className="grid gap-4 lg:grid-cols-[2fr_1fr_220px]">
          <div className="grid gap-5 rounded-2xl border border-stone-200 bg-white p-4 md:grid-cols-[320px_1fr]">
            <div className="space-y-3">
              <label className="text-[10px] font-black uppercase tracking-[0.22em] text-stone-500">Kelas</label>
              <select value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)} className="w-full rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm font-black">
                {classOptions.map((cls) => <option key={cls}>{cls}</option>)}
              </select>
              <label className="block text-[10px] font-black uppercase tracking-[0.22em] text-stone-500">Mata Pelajaran</label>
              <select value={selectedSubject} onChange={(e) => setSelectedSubject(e.target.value)} className="w-full rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-black text-red-600">
                {["Singing", "IPA", "Math"].map((item) => <option key={item}>{item}</option>)}
              </select>
            </div>
            <div>
              <p className="mb-4 text-[10px] font-black uppercase tracking-[0.24em] text-stone-500">Pilih Topik Pembelajaran</p>
              <div className="flex flex-wrap gap-2">
                {topics.map((topic, index) => (
                  <button key={topic.id} onClick={() => setSelectedTopicIndex(index)} className={`rounded-xl px-5 py-3 text-sm font-black ${index === selectedTopicIndex ? "bg-primary text-white shadow-lg shadow-primary/25" : "border border-stone-200 bg-white text-stone-900"}`}>
                    {topic.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
              <div className="rounded-2xl border border-stone-200 bg-white p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-stone-500">Track Progress Penilaian</p>
            <div className="mt-4 flex items-center gap-4">
              <div className="flex h-24 w-24 items-center justify-center rounded-full border-[10px] border-primary text-lg font-black text-stone-900">{progress}%</div>
              <div className="flex-1">
                <p className="text-sm font-black">{scoredCriteriaCount} / {criteria.length} Kriteria Dinilai</p>
                <div className="mt-3 h-3 overflow-hidden rounded-full bg-stone-100 shadow-inner"><div className="h-full rounded-full bg-primary shadow-sm" style={{ width: `${progress}%` }} /></div>
              </div>
            </div>
          </div>
          <div className="rounded-2xl border border-stone-200 bg-white p-5 text-center">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-stone-500">Real-time Score (ATL)</p>
            <div className="mt-5 text-5xl font-black text-stone-900">{calculatedScore}</div>
            <p className="mt-1 text-sm font-bold text-stone-500">/100</p>
            <span className={`mt-4 inline-flex rounded-full px-3 py-1 text-xs font-black uppercase ${scoreCategory.className}`}>{scoreCategory.label}</span>
          </div>
        </section>

        <section className="grid gap-5 lg:grid-cols-[280px_1fr]">
          <aside className="rounded-2xl border border-stone-200 bg-white p-4">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-stone-500">Daftar Siswa Kelas</p>
              <span className="text-xs text-stone-500">({students.length} siswa)</span>
            </div>
            <div className="max-h-[620px] space-y-2 overflow-y-auto pr-1">
              {students.map((student) => {
                const active = selectedStudent?.id === student.id;
                const studentScore = studentScores[student.id] || "0.0";
                const studentCategory = getScoreCategory(studentScore);
                return (
                  <button key={student.id} onClick={() => setSelectedStudent(student)} className={`w-full rounded-xl border p-3 text-left transition ${active ? "border-primary bg-primary/5 shadow-md" : "border-stone-200 bg-white"}`}>
                    <div className="flex items-center gap-3">
                      <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${student.avatarTone} text-xs font-black text-stone-900`}>{student.initials}</div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-black text-stone-900">{student.name}</p>
                        <p className="text-[11px] text-stone-500">{student.nis}</p>
                        <div className="mt-1 flex items-center gap-2">
                          <span className="text-[12px] font-black text-stone-900">{studentScore}/100</span>
                          <span className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase ${studentCategory.className}`}>{studentCategory.label}</span>
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </aside>

          <section className="rounded-2xl border border-stone-200 bg-white p-6">
            {criterion ? (
              <>
                <div className="flex items-start justify-between gap-5">
                  <div className="flex items-center gap-4">
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-orange-50 text-orange-700">
                      <span className="material-symbols-outlined text-3xl">{getSubjectMeta(selectedSubject).icon || "groups"}</span>
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.22em] text-primary">Kriteria yang Dinilai</p>
                      <h2 className="mt-2 text-2xl font-black text-stone-950">{criterion.kriteria}</h2>
                      <p className="mt-1 text-sm text-stone-600">{criterion.criteriaTopic}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-black uppercase tracking-[0.22em] text-stone-500">Subskill Kontekstual</p>
                    <div className="mt-2 flex max-w-xl flex-wrap justify-end gap-2">
                      {(criterion.atlCategories || []).map((cat) => {
                        const meta = getATLCategoryMeta(cat);
                        return (
                        <span key={cat} className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-black ${meta.chipClass || "border-stone-200 bg-stone-50 text-stone-700"}`}>
                          <span className="material-symbols-outlined text-[15px]">{meta.icon || "label"}</span>
                          {cat}
                        </span>
                      );
                      })}
                    </div>
                    <div className="mt-3 flex items-center justify-end gap-3">
                      <button
                        type="button"
                        disabled={selectedCriterionIndex === 0}
                        onClick={() => setSelectedCriterionIndex((i) => Math.max(0, i - 1))}
                        className="flex h-11 w-11 items-center justify-center rounded-xl border border-stone-200 bg-white text-stone-700 transition-all hover:border-primary/40 hover:bg-primary/5 disabled:opacity-35"
                        aria-label="Kriteria sebelumnya"
                      >
                        <span className="material-symbols-outlined">chevron_left</span>
                      </button>
                      <p className="text-sm font-black">{selectedCriterionIndex + 1} / {criteria.length} Kriteria</p>
                      <button
                        type="button"
                        disabled={selectedCriterionIndex >= criteria.length - 1}
                        onClick={() => setSelectedCriterionIndex((i) => Math.min(criteria.length - 1, i + 1))}
                        className="flex h-11 w-11 items-center justify-center rounded-xl border border-stone-200 bg-white text-stone-700 transition-all hover:border-primary/40 hover:bg-primary/5 disabled:opacity-35"
                        aria-label="Kriteria berikutnya"
                      >
                        <span className="material-symbols-outlined">chevron_right</span>
                      </button>
                    </div>
                  </div>
                </div>

                <div className="mt-8 grid gap-4 lg:grid-cols-5">
                  {ratingOptions.map((option) => {
                    const tone = getLevelTone(option.code);
                    const active = criterionRating === option.label;
                    const weight = dominantWeight * rubricScoreMap[option.label];
                    return (
                      <button
                        key={option.code}
                        onClick={() => handleSelectRating(option.label)}
                        style={active ? { backgroundColor: tone.activeBg } : undefined}
                        className={`min-h-[320px] rounded-2xl border p-5 text-center transition ${tone.card} ${active ? `${tone.active} -translate-y-1 scale-[1.02]` : ""}`}
                      >
                        <div className={`mx-auto flex h-16 w-16 items-center justify-center rounded-2xl text-xl font-black ${active ? tone.activeIcon : tone.icon}`}>{option.code}</div>
                        <h3 className={`mt-6 text-base font-black ${active ? tone.activeText : "text-stone-950"}`}>{option.label}</h3>
                        <p className={`mt-5 min-h-[76px] text-sm leading-6 ${active ? "text-white/95" : "text-stone-700"}`}>{criterion.levels?.[option.code] || "-"}</p>
                        <div className={`mt-6 border-t pt-4 ${active ? "border-white/25" : "border-current/15"}`}>
                          <p className={`text-sm font-black ${active ? "text-white" : tone.text}`}>{active ? "Level terpilih" : "Klik untuk memilih"}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div className="mt-6 space-y-5">
                  <div className="rounded-2xl border border-stone-200 bg-white p-5">
                    <p className="text-[10px] font-black uppercase tracking-[0.22em] text-stone-500">Catatan Guru <span className="normal-case tracking-normal">(opsional)</span></p>
                    <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={250} placeholder="Tulis catatan tentang performa siswa pada kriteria ini..." className="mt-3 h-24 w-full resize-none rounded-xl border border-stone-200 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/20" />
                    <p className="text-right text-xs text-stone-400">{note.length} / 250</p>
                  </div>
                  <div className="rounded-2xl border border-stone-200 bg-white p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-stone-500">Informasi Skala</p>
                        <p className="mt-2 text-sm leading-6 text-stone-600">Gunakan lima level berikut untuk membaca performa siswa secara sederhana.</p>
                      </div>
                      <span className="rounded-xl border border-primary/30 bg-primary/10 px-3 py-2 text-xs font-black text-stone-900">
                        {criterionRating ? "Sudah dinilai" : "Belum dinilai"}
                      </span>
                    </div>
                    <div className="mt-4 grid gap-3 md:grid-cols-5">
                      {ratingOptions.map((option) => {
                        const meta = getRatingMeta(option.code);
                        return (
                          <div
                            key={option.code}
                            className="rounded-2xl border p-3 shadow-sm"
                            style={{ borderColor: meta.color, backgroundColor: `${meta.color}14` }}
                          >
                            <div className="flex items-center gap-2">
                              <span className={`inline-flex h-8 min-w-10 items-center justify-center rounded-lg border text-xs font-black ${meta.chipClass}`}>{option.code}</span>
                              <span className="text-xs font-black text-stone-900">{option.label}</span>
                            </div>
                            <p className="mt-2 text-[11px] font-semibold leading-5 text-stone-600">{ratingMeaning[option.code]}</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="py-20 text-center text-sm font-bold text-stone-400">Belum ada kriteria untuk topik ini.</div>
            )}
          </section>
        </section>

        <footer className="flex items-center justify-end">
          <div className="flex gap-3">
            <button disabled={selectedCriterionIndex === 0} onClick={() => setSelectedCriterionIndex((i) => Math.max(0, i - 1))} className="rounded-xl border border-stone-200 bg-white px-6 py-3 text-sm font-bold disabled:opacity-40">Kriteria Sebelumnya</button>
            <button disabled={selectedCriterionIndex >= criteria.length - 1} onClick={() => setSelectedCriterionIndex((i) => Math.min(criteria.length - 1, i + 1))} className="rounded-xl border border-stone-200 bg-white px-6 py-3 text-sm font-bold disabled:opacity-40">Kriteria Berikutnya</button>
          </div>
        </footer>
          </div>
      </div>
      </main>
    </div>
  );
}

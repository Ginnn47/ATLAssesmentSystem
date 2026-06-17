import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Sidebar from "./sidebar";
import { dummyATL } from "../dummyData/dummyATL";
import {
  clearAssessmentDrafts,
  getAssessmentDraft,
  getAssessmentFilterState,
  getClasses,
  getCurrentUser,
  getReport,
  getStudents,
  getTopics,
  hydrateTopic,
  previewAssessmentScores,
  saveAssessmentBatch,
  saveAssessmentDrafts,
  saveAssessmentFilterState,
  updateAssessmentLiveDraft,
} from "../../services/atlApi";
import { filterSubjectsByUserAccess, subjectDisplayName } from "../../services/accessControl";
import { getRatingMeta, getScoreLevel, hydrateLabelRegistry, ratingOptions } from "../../services/labelRegistry";
import { getSubjectData, getSubjectTopicMapByLabel } from "../../services/topicCatalog";

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

const getScoreCategory = getScoreLevel;

const buildSubjectTopicMap = (subjects, user) =>
  filterSubjectsByUserAccess(subjects, user).reduce((acc, subject) => {
    const label = subjectDisplayName(subject);
    if (label) acc[label] = subject.topics || [];
    return acc;
  }, {});

export default function BatchInputATL() {
  const [classOptions, setClassOptions] = useState([]);
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("Singing");
  const [selectedTopicIndex, setSelectedTopicIndex] = useState(0);
  const [batchRatingsByStudent, setBatchRatingsByStudent] = useState({});
  const [matrixContext, setMatrixContext] = useState(null);
  const [showDetailPanel, setShowDetailPanel] = useState(true);
  const [dataVersion, setDataVersion] = useState(0);
  const [apiStudents, setApiStudents] = useState([]);
  const [subjectTopicMap, setSubjectTopicMap] = useState(getSubjectTopicMapByLabel);
  const [subjectData, setSubjectData] = useState(getSubjectData);
  const [currentUser, setCurrentUser] = useState(null);
  const [filtersHydrated, setFiltersHydrated] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null);
  const [saveMessage, setSaveMessage] = useState("");
  const [backendError, setBackendError] = useState("");
  const [backendStatus, setBackendStatus] = useState("idle");
  const [criteriaStatus, setCriteriaStatus] = useState("unknown");
  const [backendReportRows, setBackendReportRows] = useState([]);
  const [previewScores, setPreviewScores] = useState({});
  const [previewContextKey, setPreviewContextKey] = useState("");
  const [previewingScores, setPreviewingScores] = useState(false);
  const [reportVersion, setReportVersion] = useState(0);
  const [preferredStudentId, setPreferredStudentId] = useState(null);
  const skipNextSubjectResetRef = React.useRef(false);
  const activeBatchKeyRef = React.useRef("");
  const hasLocalChangesRef = React.useRef(false);

  useEffect(() => {
    hydrateLabelRegistry().then(() => setDataVersion((version) => version + 1));
    Promise.allSettled([getClasses(), getTopics(), getCurrentUser()])
      .then(([classesResult, topicsResult, userResult]) => {
        const classes = classesResult.status === "fulfilled" ? classesResult.value : [];
        const labels = classes.map((item) => item.displayName || item.display_name || item.code).filter(Boolean);
        if (labels.length > 0) {
          setClassOptions(labels);
          setSelectedClass((current) => current || labels[0] || "");
        }
        const user = userResult.status === "fulfilled" ? userResult.value : null;
        const subjects = topicsResult.status === "fulfilled" ? topicsResult.value || [] : getSubjectData();
        const nextMap = buildSubjectTopicMap(subjects, user);
        const subjectKeys = Object.keys(nextMap);
        setCurrentUser(user);
        setSubjectData(subjects);
        setSubjectTopicMap(nextMap);
        if (subjectKeys.length > 0) {
          setSelectedSubject((current) => (subjectKeys.includes(current) ? current : subjectKeys[0]));
        }
        if (classesResult.status === "rejected" || topicsResult.status === "rejected") {
          setBackendStatus("offline");
          setBackendError("Data backend belum tersambung. Menampilkan data terakhir.");
        } else {
          setBackendStatus("ready");
          setBackendError("");
        }
      });
  }, []);

  useEffect(() => {
    const nextMap = buildSubjectTopicMap(subjectData, currentUser);
    const subjectKeys = Object.keys(nextMap);
    if (subjectKeys.length === 0) return;
    setSubjectTopicMap(nextMap);
    if (!subjectKeys.includes(selectedSubject)) {
      setSelectedSubject(subjectKeys[0]);
    }
  }, [currentUser, selectedSubject, subjectData]);

  const topicOptions = useMemo(() => subjectTopicMap[selectedSubject] || [], [selectedSubject, subjectTopicMap]);
  const selectedTopic = topicOptions[selectedTopicIndex] || { id: "", label: "Pilih Topik" };
  const dataKey = selectedTopic.id;
  const currentATLData = dummyATL[dataKey] || [];
  const topicNeedsCriteria = Boolean(dataKey && selectedTopic.isAssessable === false && currentATLData.length === 0 && criteriaStatus !== "loading");
  const isBackendUpdating = backendStatus === "loading";
  const assessmentUnavailableMessage = topicNeedsCriteria
    ? "Assessment belum tersedia, belum ada kriteria untuk mapel ini."
    : "";

  const students = useMemo(
    () => apiStudents,
    [apiStudents]
  );
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
      setDataVersion((version) => version + 1);
    };
    const syncReportData = () => {
      setDataVersion((version) => version + 1);
      setReportVersion((version) => version + 1);
    };
    const syncTopics = () => {
      const nextSubjects = getSubjectData();
      setSubjectData(nextSubjects);
      setSubjectTopicMap(buildSubjectTopicMap(nextSubjects, currentUser));
    };

    window.addEventListener("focus", syncDataFromStorage);
    window.addEventListener("storage", syncDataFromStorage);
    window.addEventListener("atl-data-updated", syncReportData);
    window.addEventListener("atl-drafts-updated", syncDataFromStorage);
    window.addEventListener("atl-live-drafts-updated", syncDataFromStorage);
    window.addEventListener("atl-topics-updated", syncTopics);

    return () => {
      window.removeEventListener("focus", syncDataFromStorage);
      window.removeEventListener("storage", syncDataFromStorage);
      window.removeEventListener("atl-data-updated", syncReportData);
      window.removeEventListener("atl-drafts-updated", syncDataFromStorage);
      window.removeEventListener("atl-live-drafts-updated", syncDataFromStorage);
      window.removeEventListener("atl-topics-updated", syncTopics);
    };
  }, [currentUser]);

  useEffect(() => {
    let cancelled = false;
    if (!selectedClass) {
      setApiStudents([]);
      return () => {
        cancelled = true;
      };
    }
    getStudents(selectedClass)
      .then((studentsFromApi) => {
        if (!cancelled) {
          setApiStudents(studentsFromApi);
          setBackendError("");
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setBackendStatus("offline");
          setBackendError(error.message || "Data backend belum tersambung. Menampilkan data terakhir.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [selectedClass]);

  useEffect(() => {
    if (!dataKey) return undefined;
    let cancelled = false;
    setBackendStatus("loading");
    setCriteriaStatus(currentATLData.length > 0 ? "available" : "loading");
    hydrateTopic(dataKey)
      .then((result) => {
        if (!cancelled) {
          if (result?.stale) {
            setBackendStatus("offline");
            setBackendError("Data backend belum tersambung. Menampilkan data terakhir.");
          } else {
            setBackendStatus("ready");
            setBackendError("");
          }
          const nextCriteriaCount = result?.criteria?.length ?? (dummyATL[dataKey] || []).length;
          setCriteriaStatus(nextCriteriaCount > 0 ? "available" : "empty");
          setDataVersion((version) => version + 1);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setBackendStatus("failed");
          setBackendError(error.message || "Data backend belum tersambung. Menampilkan data terakhir.");
          setCriteriaStatus((dummyATL[dataKey] || []).length > 0 ? "available" : "empty");
          setDataVersion((version) => version + 1);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [dataKey]);
  useEffect(() => {
    if (!dataKey || !selectedClass) {
      setBackendReportRows([]);
      return undefined;
    }
    let cancelled = false;
    getReport(selectedClass, dataKey)
      .then((report) => {
        if (!cancelled) setBackendReportRows(report.students || []);
      })
      .catch(() => {
        if (!cancelled) setBackendReportRows([]);
      });
    return () => {
      cancelled = true;
    };
  }, [dataKey, selectedClass, reportVersion]);

  useEffect(() => {
    const sharedFilter = getAssessmentFilterState();
    const saved = Object.keys(sharedFilter).length > 0
      ? sharedFilter
      : localStorage.getItem("batch_filter_pref");
    if (!saved) {
      setFiltersHydrated(true);
      return;
    }

    const parsed = typeof saved === "string" ? JSON.parse(saved) : saved;
    const cls = parsed.className || parsed.cls;
    const subj = parsed.subject || parsed.subj;
    const topicIdx = parsed.topicIndex ?? parsed.topicIdx;
    if (cls) setSelectedClass(cls);
    if (subj) {
      skipNextSubjectResetRef.current = true;
      setSelectedSubject(subj);
    }
    if (Number.isInteger(topicIdx)) setSelectedTopicIndex(topicIdx);
    if (parsed.studentId !== undefined && parsed.studentId !== null) setPreferredStudentId(String(parsed.studentId));
    setFiltersHydrated(true);
  }, []);

  useEffect(() => {
    if (skipNextSubjectResetRef.current) {
      skipNextSubjectResetRef.current = false;
      return;
    }

    const options = subjectTopicMap[selectedSubject] || [];
    const firstAssessableIndex = options.findIndex((topic) => topic.isAssessable);
    setSelectedTopicIndex(firstAssessableIndex >= 0 ? firstAssessableIndex : 0);
  }, [selectedSubject]);

  useEffect(() => {
    if (topicOptions.length === 0) {
      if (selectedTopicIndex !== 0) setSelectedTopicIndex(0);
      return;
    }
    if (!topicOptions[selectedTopicIndex] || topicOptions[selectedTopicIndex]?.isAssessable === false) {
      const firstAssessableIndex = topicOptions.findIndex((topic) => topic.isAssessable);
      setSelectedTopicIndex(firstAssessableIndex >= 0 ? firstAssessableIndex : 0);
    }
  }, [topicOptions, selectedTopicIndex]);

  useEffect(() => {
    if (!filtersHydrated) return;
    if (!selectedClass || !selectedSubject) return;
    saveAssessmentFilterState({
      className: selectedClass,
      subject: selectedSubject,
      topicIndex: selectedTopicIndex,
      topicId: dataKey,
      studentId: matrixContext?.student?.id ?? preferredStudentId,
    });
  }, [filtersHydrated, selectedClass, selectedSubject, selectedTopicIndex, dataKey, matrixContext?.student?.id, preferredStudentId]);

  useEffect(() => {
    const activeKey = selectedClass && dataKey ? `${selectedClass}:${dataKey}` : "";
    const selectionChanged = activeBatchKeyRef.current !== activeKey;
    activeBatchKeyRef.current = activeKey;
    if (!dataKey || students.length === 0) {
      setBatchRatingsByStudent({});
      hasLocalChangesRef.current = false;
      return;
    }
    const next = {};
    let hasDraft = false;
    let hasLiveDraft = false;
    students.forEach((student) => {
      const draft = getAssessmentDraft(student.id, dataKey);
      if (draft) hasDraft = true;
      if (draft?.__source === "live") hasLiveDraft = true;
      const existing = draft?.ratings || dummyATL.savedAssessments?.[student.id]?.[dataKey] || {};
      const row = {};

      columns.forEach((column) => {
        const value = column.metricKeys.map((key) => existing[key]).find(Boolean);
        if (value) row[column.id] = normalizeRatingLabel(value);
      });

      next[student.id] = row;
    });

    setBatchRatingsByStudent(next);
    hasLocalChangesRef.current = hasLiveDraft;
    if (hasLiveDraft) {
      setSaveStatus("editing");
      setSaveMessage("Perubahan sudah terlihat di Batch dan Detailed.");
    } else if (selectionChanged && hasDraft) {
      setSaveStatus("draft");
      setSaveMessage("Perubahan tersimpan sementara.");
    } else if (selectionChanged) {
      setSaveStatus(null);
      setSaveMessage("");
    }
  }, [students, selectedClass, dataKey, columns, dataVersion]);

  const saveFilterSelection = () => {
    saveAssessmentFilterState({
      className: selectedClass,
      subject: selectedSubject,
      topicIndex: selectedTopicIndex,
      topicId: dataKey,
      studentId: matrixContext?.student?.id ?? preferredStudentId,
    });
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
  const backendStudentScores = useMemo(
    () => Object.fromEntries(
      backendReportRows.map((student) => [
        String(student.id),
        Number(student.rawScore ?? student.score ?? 0),
      ])
    ),
    [backendReportRows]
  );
  const activePreviewScores = useMemo(
    () => (previewContextKey === `${selectedClass}:${dataKey}` ? previewScores : {}),
    [dataKey, previewContextKey, previewScores, selectedClass]
  );
  const batchStudentScores = useMemo(
    () => ({
      ...backendStudentScores,
      ...Object.fromEntries(
        Object.entries(activePreviewScores).map(([studentId, score]) => [
          String(studentId),
          Number(score?.rawScore || 0),
        ])
      ),
    }),
    [activePreviewScores, backendStudentScores]
  );

  const buildStudentTopicRatings = React.useCallback((studentId, row) => {
    const draft = getAssessmentDraft(studentId, dataKey);
    const topicRatings = {
      ...(draft?.ratings || dummyATL.savedAssessments?.[studentId]?.[dataKey] || {}),
    };
    columns.forEach((column) => {
      const selected = row[column.id];
      column.metricKeys.forEach((metricKey) => {
        if (selected) topicRatings[metricKey] = selected;
        else delete topicRatings[metricKey];
      });
    });
    return topicRatings;
  }, [columns, dataKey]);

  useEffect(() => {
    if (!dataKey || topicNeedsCriteria || students.length === 0 || columns.length === 0) return undefined;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      setPreviewingScores(true);
      previewAssessmentScores(
        students.map((student) => ({
          studentId: student.id,
          topic: dataKey,
          ratings: buildStudentTopicRatings(student.id, batchRatingsByStudent[student.id] || {}),
        }))
      )
        .then((scores) => {
          if (!cancelled) {
            setPreviewScores(scores);
            setPreviewContextKey(`${selectedClass}:${dataKey}`);
          }
        })
        .catch(() => {
          if (!cancelled) setPreviewScores({});
        })
        .finally(() => {
          if (!cancelled) setPreviewingScores(false);
        });
    }, 220);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [batchRatingsByStudent, buildStudentTopicRatings, columns.length, dataKey, selectedClass, students, topicNeedsCriteria]);

  const handleCellChange = (studentId, columnId, value) => {
    if (topicNeedsCriteria) return;
    const nextStudentRow = {
      ...(batchRatingsByStudent[studentId] || {}),
      [columnId]: value,
    };
    setBatchRatingsByStudent((prev) => ({
      ...prev,
      [studentId]: nextStudentRow,
    }));
    updateAssessmentLiveDraft(studentId, dataKey, buildStudentTopicRatings(studentId, nextStudentRow), {
      className: selectedClass,
      subject: selectedSubject,
      topicLabel: selectedTopic.label,
    });
    hasLocalChangesRef.current = true;
    setSaveStatus("editing");
    setSaveMessage("Perubahan sudah terlihat di Batch dan Detailed.");
  };

  const openMatrix = (student, column) => {
    setPreferredStudentId(String(student.id));
    setMatrixContext({ student, column });
  };

  const closeMatrix = () => {
    setMatrixContext(null);
  };

  const buildAssessmentItems = () => (
    students.map((student) => {
      const row = batchRatingsByStudent[student.id] || {};
      return {
        studentId: student.id,
        topicId: dataKey,
        ratings: buildStudentTopicRatings(student.id, row),
        metadata: {
          className: selectedClass,
          subject: selectedSubject,
          topicLabel: selectedTopic.label,
        },
      };
    })
  );

  const handleSaveDraft = () => {
    if (!dataKey || columns.length === 0 || students.length === 0) return;
    saveAssessmentDrafts(buildAssessmentItems());
    hasLocalChangesRef.current = false;
    setSaveStatus("draft");
    setSaveMessage(`Perubahan ${students.length} siswa tersimpan sementara.`);
  };

  const handleSend = async () => {
    if (!dataKey || topicNeedsCriteria || columns.length === 0 || students.length === 0) {
      setSaveStatus("failed");
      setSaveMessage(assessmentUnavailableMessage || "Pilih topik dan kriteria yang valid sebelum menyimpan.");
      return;
    }
    const draftItems = buildAssessmentItems();
    hasLocalChangesRef.current = true;
    setSaveStatus("pushing");
    setSaveMessage(`Menyimpan nilai ${students.length} siswa...`);
    const result = await saveAssessmentBatch(
      draftItems.map(({ studentId, topicId, ratings }) => ({ studentId, topic: topicId, ratings }))
    );
    if (result?.synced) {
      hasLocalChangesRef.current = false;
      clearAssessmentDrafts(draftItems);
      setSaveStatus("backend");
      setSaveMessage(`Nilai ${students.length} siswa berhasil disimpan.`);
    } else {
      setSaveStatus("failed");
      setSaveMessage(result?.error || "Gagal menyimpan nilai.");
    }
  };

  const preferredStudent = students.find((student) => String(student.id) === preferredStudentId);
  const detailContext = matrixContext || ((preferredStudent || students[0]) && columns[0]
    ? { student: preferredStudent || students[0], column: columns[0] }
    : null);
  const detailValue = detailContext ? batchRatingsByStudent[detailContext.student.id]?.[detailContext.column.id] || "" : "";
  const detailOption = ratingOptions.find((item) => item.label === detailValue);
  const detailTone = getLevelStyle(detailOption?.code || "NONE");
  const detailStudentScore = detailContext ? batchStudentScores[String(detailContext.student.id)] : null;
  const detailStudentScoreText = Number.isFinite(detailStudentScore) ? Number(detailStudentScore).toFixed(2) : "0.00";
  const detailBackendScore = detailContext ? Number(backendStudentScores[String(detailContext.student.id)] || 0) : 0;
  const detailScoreIsPreview = Boolean(detailContext && activePreviewScores[String(detailContext.student.id)]);
  const detailStudentCategory = getScoreCategory(detailStudentScore);
  const canPushAssessment = Boolean(dataKey && !topicNeedsCriteria && columns.length > 0 && students.length > 0 && saveStatus !== "pushing");
  const saveStatusClass = {
    backend: "bg-emerald-100 text-emerald-700",
    draft: "bg-sky-100 text-sky-700",
    editing: "bg-amber-100 text-amber-800",
    pushing: "bg-blue-100 text-blue-700",
    failed: "bg-red-100 text-red-700",
  }[saveStatus] || "bg-stone-100 text-stone-700";

  return (
    <div className="flex h-screen w-full overflow-hidden bg-stone-50">
      <Sidebar />
      <main className="relative flex h-full flex-1 flex-col overflow-hidden bg-stone-50">
        <div className="flex-1 overflow-y-auto p-4 lg:p-8">
          <div className="mx-auto flex max-w-[1500px] flex-col gap-8">
            <div className="flex flex-col gap-4 rounded-[1.75rem] border border-stone-200 bg-white p-6 shadow-[0_18px_40px_rgba(15,23,42,0.06)] xl:flex-row xl:items-center xl:justify-between">
              <div className="max-w-2xl">
                <span className="rounded bg-primary/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-primary-hover">
                  Input Nilai ATL
                </span>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <h1 className="text-3xl font-black text-text-main-light">Input Penilaian ATL</h1>
                </div>
                <p className="mt-2 text-sm text-text-sub-light">
                  Isi nilai banyak siswa dalam satu tabel.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
              {saveStatus && (
                <span className={`max-w-sm rounded-xl px-3 py-2 text-xs font-black ${saveStatusClass}`}>
                  {saveMessage}
                </span>
              )}
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
                onClick={handleSend}
                disabled={!canPushAssessment}
                className="inline-flex items-center gap-2 rounded-xl bg-stone-950 px-6 py-2.5 text-sm font-black text-white shadow-lg shadow-stone-950/15 transition-all hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[18px]">cloud_upload</span>
                {saveStatus === "pushing" ? "Menyimpan..." : "Simpan Penilaian"}
              </button>
              </div>
            </div>

            {backendError && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm font-bold text-amber-800">
                <span className="material-symbols-outlined mr-2 align-middle text-[18px]">error</span>
                {backendError}
              </div>
            )}
            {isBackendUpdating && columns.length > 0 && (
              <div className="rounded-2xl border border-sky-200 bg-sky-50 px-5 py-3 text-xs font-black text-sky-700">
                <span className="material-symbols-outlined mr-2 align-middle text-[16px]">sync</span>
                Mohon tunggu sebentar, sistem sedang memuat data terbaru dari backend. Matrix tetap memakai data terakhir.
              </div>
            )}

            <section className="flex flex-col gap-4 rounded-2xl border border-amber-300 bg-amber-50 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex max-w-4xl items-start gap-3">
                <span className="material-symbols-outlined mt-0.5 text-[19px] text-orange-600">info</span>
                <div>
                  <p className="text-sm font-black text-stone-900">Isi nilai dulu, lalu simpan saat sudah siap.</p>
                  <p className="mt-1 text-xs font-semibold leading-5 text-stone-600">
                    Perubahan langsung muncul di mode <b>Batch</b> dan <b>Detailed</b>.
                    <b> Simpan Sementara</b> untuk lanjut nanti.
                    Pilih <b>Simpan Penilaian</b> agar nilai masuk ke laporan.
                  </p>
                  {saveStatus && <p className={`mt-2 inline-flex rounded-lg px-2.5 py-1 text-[11px] font-black ${saveStatusClass}`}>{saveMessage}</p>}
                </div>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-3">
                <span className="rounded-xl border border-orange-200 bg-white px-4 py-2.5 text-xs font-black text-stone-700">
                  Progress {progress}%
                </span>
                <button
                  onClick={handleSaveDraft}
                  className="inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-5 py-2.5 text-sm font-black text-stone-700 transition-all hover:border-amber-300 hover:bg-amber-100"
                >
                  <span className="material-symbols-outlined text-[18px]">save</span>
                  Simpan Sementara
                </button>
              </div>
            </section>

            <section className="rounded-[1.4rem] border border-stone-200 bg-white p-4 shadow-[0_14px_32px_rgba(15,23,42,0.05)]">
              <div className="grid gap-4 xl:grid-cols-[180px_200px_minmax(0,1fr)_190px] xl:items-stretch">
                <div className="flex flex-col justify-center border-stone-200 xl:border-r xl:pr-4">
                  <label className="mb-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-stone-500">
                    <span className="material-symbols-outlined text-[17px] text-primary">groups</span>
                    Kelas
                  </label>
                  <select
                    value={selectedClass}
                    onChange={(e) => setSelectedClass(e.target.value)}
                    className="block w-full rounded-lg border border-stone-200 bg-white px-3 py-2.5 text-xs font-black text-stone-900 outline-none transition-all focus:border-primary focus:ring-4 focus:ring-primary/10"
                  >
                    {classOptions.map((cls) => (
                      <option key={cls} value={cls}>{cls}</option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col justify-center border-stone-200 xl:border-r xl:pr-4">
                  <label className="mb-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-stone-500">
                    <span className="material-symbols-outlined text-[17px] text-primary">menu_book</span>
                    Mata Pelajaran
                  </label>
                  <select
                    value={selectedSubject}
                    onChange={(e) => setSelectedSubject(e.target.value)}
                    className="block w-full rounded-lg border border-stone-200 bg-white px-3 py-2.5 text-xs font-black text-stone-900 outline-none transition-all focus:border-primary focus:ring-4 focus:ring-primary/10"
                  >
                    {Object.keys(subjectTopicMap).map((subject) => (
                      <option key={subject} value={subject}>{subject}</option>
                    ))}
                  </select>
                </div>

                <div className="min-w-0">
                  <label className="mb-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-stone-500">
                    <span className="material-symbols-outlined text-[17px] text-primary">topic</span>
                    Topik Aktif
                  </label>
                  <div className={`mb-2 flex min-h-[42px] items-center justify-between gap-3 rounded-lg border px-3 py-2 ${
                    topicNeedsCriteria
                      ? "border-stone-200 bg-stone-100 text-stone-400"
                      : "border-primary/30 bg-primary/10"
                  }`}>
                    <div className="flex min-w-0 items-center gap-2">
                      <span className={`material-symbols-outlined text-[18px] ${topicNeedsCriteria ? "text-stone-400" : "text-primary"}`}>music_note</span>
                      <span className={`truncate text-xs font-black ${topicNeedsCriteria ? "text-stone-400" : "text-stone-900"}`}>{selectedTopic.label}</span>
                    </div>
                    <span className={`material-symbols-outlined text-[18px] ${topicNeedsCriteria ? "text-stone-400" : "text-primary"}`}>{topicNeedsCriteria ? "lock" : "check_circle"}</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {topicOptions.map((topic, idx) => {
                      const disabled = topic.isAssessable === false;
                      return (
                        <span key={topic.id} className="group relative inline-flex">
                          <button
                            type="button"
                            onClick={() => setSelectedTopicIndex(idx)}
                            disabled={disabled}
                            className={`rounded-md border px-3 py-1.5 text-[10px] font-black transition-all ${
                              disabled
                                ? "cursor-not-allowed border-stone-200 bg-stone-100 text-stone-400 opacity-60"
                                : selectedTopicIndex === idx
                                  ? "border-primary bg-primary text-white shadow-sm"
                                  : "border-stone-200 bg-white text-stone-700 hover:border-primary/40 hover:bg-primary/5"
                            }`}
                          >
                            {topic.label}
                          </button>
                          {disabled && (
                            <span className="pointer-events-none absolute left-1/2 top-full z-30 mt-2 hidden w-56 -translate-x-1/2 rounded-xl border border-stone-200 bg-white px-3 py-2 text-center text-[11px] font-bold text-stone-500 shadow-lg group-hover:block">
                              Assessment belum tersedia, belum ada kriteria untuk mapel ini.
                            </span>
                          )}
                        </span>
                      );
                    })}
                  </div>
                </div>
                <div className="flex flex-col justify-center gap-2 border-stone-200 xl:border-l xl:pl-4">
                  <button
                    type="button"
                    onClick={saveFilterSelection}
                    className="inline-flex min-h-[42px] items-center justify-center gap-2 rounded-lg bg-primary px-4 text-xs font-black text-white shadow-sm transition-all hover:bg-secondary"
                  >
                    <span className="material-symbols-outlined text-[17px]">bookmark</span>
                    Simpan Default
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowDetailPanel((value) => !value)}
                    className="inline-flex min-h-[42px] items-center justify-center gap-2 rounded-lg border border-stone-200 bg-white px-4 text-xs font-black text-stone-700 transition-all hover:border-primary/40 hover:bg-primary/5"
                  >
                    <span className="material-symbols-outlined text-[17px]">{showDetailPanel ? "visibility_off" : "visibility"}</span>
                    {showDetailPanel ? "Sembunyikan Detail" : "Tampilkan Detail"}
                  </button>
                </div>
              </div>
            </section>

            <section className="rounded-[1.8rem] border border-stone-200 bg-white shadow-[0_18px_40px_rgba(15,23,42,0.06)]">
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
                                className="min-w-[165px] border-b border-r border-stone-200 bg-white px-4 py-5 text-center align-middle"
                              >
                                <button
                                  type="button"
                                  onClick={() => students[0] && openMatrix(students[0], column)}
                                  className="flex min-h-[44px] w-full items-center justify-center rounded-lg text-center transition-colors hover:text-orange-700"
                                  title={column.atlNames.join(", ")}
                                >
                                  <span className="line-clamp-2 block text-center text-[12px] font-black leading-5 text-stone-900">{column.title}</span>
                                </button>
                              </th>
                            );
                          })}
                        </tr>
                      </thead>
                      <tbody>
                        {students.map((student) => {
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
                    {isBackendUpdating && criteriaStatus !== "empty"
                      ? "Mohon tunggu sebentar, sedang loading data dari backend."
                      : "Belum ada kriteria ATL untuk topik ini."}
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
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-orange-300 bg-white text-orange-700 transition-all hover:border-orange-500 hover:bg-orange-50"
                      aria-label="Tutup detail"
                    >
                      <span className="material-symbols-outlined text-[18px]">close</span>
                    </button>
                  </div>

                  <div className="space-y-5">
                    <div className="rounded-2xl border border-stone-200 bg-white p-4">
                      <p className="text-[11px] font-black uppercase tracking-[0.14em] text-stone-500">
                        {detailScoreIsPreview ? "(Realtime Calculation)" : "Recent Calculation Saved"}
                      </p>
                      <div className="mt-3 flex items-end justify-between gap-3">
                        <div>
                          <p className="text-4xl font-black text-stone-900">
                            {detailStudentScoreText}
                            <span className="text-base text-stone-500">/100</span>
                          </p>
                        </div>
                        <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase ${detailStudentCategory.className}`}>
                          {detailStudentCategory.label}
                        </span>
                      </div>
                      {detailScoreIsPreview && (
                        <p className="mt-3 text-[10px] font-bold text-amber-700">
                          {previewingScores ? "Menghitung..." : `Recent Calculation Saved: ${detailBackendScore.toFixed(2)}/100`}
                        </p>
                      )}
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
                                selected ? `${optionTone.cell} shadow-sm` : "border-stone-100 bg-white hover:border-primary/30 hover:bg-primary/5"
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
                                <strong className="text-stone-900">{Number(getRatingMeta(option.code).score || 0)}</strong>
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
                      <button type="button" className="flex h-8 w-8 items-center justify-center rounded-lg border border-stone-200 bg-white text-stone-700 transition-all hover:border-primary/40 hover:bg-primary/5">
                        <span className="material-symbols-outlined text-[16px]">chevron_left</span>
                      </button>
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-xs font-black text-white">1</span>
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-stone-200 bg-white text-xs font-black text-stone-600">2</span>
                      <button type="button" className="flex h-8 w-8 items-center justify-center rounded-lg border border-stone-200 bg-white text-stone-700 transition-all hover:border-primary/40 hover:bg-primary/5">
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
                Simpan Sementara
              </button>
              <button
                onClick={handleSend}
                disabled={!canPushAssessment}
                className="inline-flex items-center gap-2 rounded-2xl bg-stone-950 px-6 py-3 text-sm font-black text-white shadow-[0_16px_28px_rgba(15,23,42,0.22)] transition-all hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[18px] text-primary">cloud_upload</span>
                Simpan Penilaian
              </button>
            </div>
          </div>
        </div>

      </main>
    </div>
  );
}

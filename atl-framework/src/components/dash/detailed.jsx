import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import Sidebar from "./sidebar";
import { dummyATL } from "../dummyData/dummyATL";
import {
  clearAssessmentDraft,
  getAssessmentDraft,
  getAssessmentFilterState,
  getClasses,
  getCurrentUser,
  getReport,
  getStudents,
  getTopics,
  hydrateTopic,
  previewAssessmentScores,
  saveAssessment,
  saveAssessmentDraft,
  saveAssessmentFilterState,
  updateAssessmentLiveDraft,
} from "../../services/atlApi";
import { filterSubjectsByUserAccess, subjectDisplayName } from "../../services/accessControl";
import { getATLCategoryMeta, getRatingMeta, getScoreLevel, getSubjectMeta, hydrateLabelRegistry, ratingOptions } from "../../services/labelRegistry";
import { getSubjectData, getTopicsForSubjectLabel } from "../../services/topicCatalog";

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

const formatWeightScaleInfo = (updatedAt, source) => {
  const fallbackDefault = "2027-07-02T10:47:00+07:00";
  const targetDate = updatedAt || (source === "equal-fallback" ? fallbackDefault : "");
  if (!targetDate) return "Belum ada bobot";
  const date = new Date(targetDate);
  if (Number.isNaN(date.getTime())) return "Tanggal bobot tidak tersedia";
  const day = new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  }).format(date);
  const time = new Intl.DateTimeFormat("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  }).format(date).replace(/\./g, ":");
  return `${day} ${time} WIB`;
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
export default function DetailedInputATL() {
  const initialSubjectOptions = getSubjectData().map(subjectDisplayName).filter(Boolean);
  const [classOptions, setClassOptions] = useState([]);
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("Singing");
  const [subjectOptions, setSubjectOptions] = useState(initialSubjectOptions.length > 0 ? initialSubjectOptions : ["Singing", "IPA", "Math"]);
  const [selectedTopicIndex, setSelectedTopicIndex] = useState(0);
  const [apiStudents, setApiStudents] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [selectedCriterionIndex, setSelectedCriterionIndex] = useState(0);
  const [ratings, setRatings] = useState({});
  const [note, setNote] = useState("");
  const [topicVersion, setTopicVersion] = useState(0);
  const [saveStatus, setSaveStatus] = useState(null);
  const [saveMessage, setSaveMessage] = useState("");
  const [backendError, setBackendError] = useState("");
  const [backendStatus, setBackendStatus] = useState("idle");
  const [criteriaStatus, setCriteriaStatus] = useState("unknown");
  const [backendReportRows, setBackendReportRows] = useState([]);
  const [weightInfo, setWeightInfo] = useState({ updatedAt: "", source: "" });
  const [localScoreRows, setLocalScoreRows] = useState({});
  const [previewScore, setPreviewScore] = useState(null);
  const [previewingScore, setPreviewingScore] = useState(false);
  const [rubricLoading, setRubricLoading] = useState(false);
  const [dataVersion, setDataVersion] = useState(0);
  const [reportVersion, setReportVersion] = useState(0);
  const skipSubjectResetRef = useRef(false);
  const preferredStudentIdRef = useRef(null);
  const activeAssessmentKeyRef = useRef("");
  const hasLocalChangesRef = useRef(false);
  const currentAssessmentRef = useRef({});
  const pushRequestRef = useRef(0);

  const topics = useMemo(() => getTopicsForSubjectLabel(selectedSubject), [selectedSubject, topicVersion]);
  const selectedTopic = topics[selectedTopicIndex] || topics[0] || { id: "", label: "Pilih Topik" };
  const dataKey = selectedTopic.id;
  const students = useMemo(() => apiStudents, [apiStudents]);
  const criteria = dummyATL[dataKey] || [];
  const criterion = criteria[selectedCriterionIndex] || criteria[0] || null;
  const weightScaleLabel = formatWeightScaleInfo(weightInfo.updatedAt || dummyATL.savedWeights?.[dataKey]?.__savedAt, weightInfo.source);
  const isTopicReady = (topic) => Boolean(
    topic?.id && topic?.isActive !== false
  );
  const topicNeedsCriteria = Boolean(dataKey && !rubricLoading && !isTopicReady(selectedTopic) && criteria.length === 0);
  const isBackendUpdating = backendStatus === "loading" || rubricLoading;
  const assessmentUnavailableMessage = topicNeedsCriteria
    ? "Belum bisa disimpan: kriteria belum tersedia."
    : "";
  const canPushAssessment = Boolean(selectedStudent && dataKey && criteria.length > 0 && !topicNeedsCriteria && !rubricLoading && saveStatus !== "pushing");

  const resetSelectionFeedback = () => {
    setPreviewScore(null);
    setPreviewingScore(false);
    setSaveStatus(null);
    setSaveMessage("");
  };

  const refreshCurrentAssessmentRef = (overrides = {}) => {
    currentAssessmentRef.current = {
      studentId: selectedStudent?.id ?? null,
      topicId: dataKey,
      ratings,
      note,
      className: selectedClass,
      subject: selectedSubject,
      topicLabel: selectedTopic.label,
      ...overrides,
    };
  };

  const persistCurrentDraft = ({ showMessage = true } = {}) => {
    const current = currentAssessmentRef.current || {};
    if (!hasLocalChangesRef.current || !current.studentId || !current.topicId) return false;
    saveAssessmentDraft(current.studentId, current.topicId, current.ratings || {}, {
      note: current.note || "",
      className: current.className,
      subject: current.subject,
      topicLabel: current.topicLabel,
    });
    hasLocalChangesRef.current = false;
    if (showMessage) {
      setSaveStatus("draft");
      setSaveMessage("Draft otomatis tersimpan.");
    }
    return true;
  };

  const handleClassChange = (value) => {
    persistCurrentDraft();
    preferredStudentIdRef.current = null;
    resetSelectionFeedback();
    setSelectedClass(value);
  };

  const handleSubjectChange = (value) => {
    persistCurrentDraft();
    resetSelectionFeedback();
    setSelectedSubject(value);
  };

  const handleTopicChange = (index) => {
    persistCurrentDraft();
    resetSelectionFeedback();
    setSelectedTopicIndex(index);
  };

  const handleStudentChange = (student) => {
    persistCurrentDraft();
    preferredStudentIdRef.current = String(student?.id ?? "");
    resetSelectionFeedback();
    setSelectedStudent(student);
  };

  useEffect(() => {
    refreshCurrentAssessmentRef();
  }, [selectedStudent?.id, dataKey, ratings, note, selectedClass, selectedSubject, selectedTopic.label]);

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
        const topicSubjects = topicsResult.status === "fulfilled" ? topicsResult.value : getSubjectData();
        const user = userResult.status === "fulfilled" ? userResult.value : null;
        const options = filterSubjectsByUserAccess(topicSubjects || getSubjectData(), user)
          .map(subjectDisplayName)
          .filter(Boolean);
        if (options.length > 0) {
          setSubjectOptions(options);
          setSelectedSubject((current) => (options.includes(current) ? current : options[0]));
        }
        setTopicVersion((version) => version + 1);
        if (classesResult.status === "rejected" || topicsResult.status === "rejected") {
          setBackendStatus("offline");
          setBackendError("Data backend belum tersambung. Menampilkan data terakhir.");
        } else {
          setBackendStatus("ready");
          setBackendError("");
        }
      });
    const sharedFilter = getAssessmentFilterState();
    const savedDefault = Object.keys(sharedFilter).length > 0
      ? sharedFilter
      : localStorage.getItem("atl_detailed_filter_default");
    if (savedDefault) {
      try {
        const parsed = typeof savedDefault === "string" ? JSON.parse(savedDefault) : savedDefault;
        if (parsed.className) setSelectedClass(parsed.className);
        if (parsed.subject) {
          skipSubjectResetRef.current = true;
          setSelectedSubject(parsed.subject);
        }
        if (Number.isFinite(Number(parsed.topicIndex))) setSelectedTopicIndex(Number(parsed.topicIndex));
        if (parsed.studentId !== undefined && parsed.studentId !== null) preferredStudentIdRef.current = String(parsed.studentId);
      } catch {
        localStorage.removeItem("atl_detailed_filter_default");
      }
    }
    const syncData = () => setDataVersion((version) => version + 1);
    const syncTopics = () => {
      setTopicVersion((version) => version + 1);
      setDataVersion((version) => version + 1);
    };
    const syncReportData = () => {
      setDataVersion((version) => version + 1);
      setReportVersion((version) => version + 1);
    };
    window.addEventListener("focus", syncData);
    window.addEventListener("storage", syncData);
    window.addEventListener("atl-data-updated", syncReportData);
    window.addEventListener("atl-drafts-updated", syncData);
    window.addEventListener("atl-live-drafts-updated", syncData);
    window.addEventListener("atl-topics-updated", syncTopics);
    return () => {
      window.removeEventListener("focus", syncData);
      window.removeEventListener("storage", syncData);
      window.removeEventListener("atl-data-updated", syncReportData);
      window.removeEventListener("atl-drafts-updated", syncData);
      window.removeEventListener("atl-live-drafts-updated", syncData);
      window.removeEventListener("atl-topics-updated", syncTopics);
    };
  }, []);

  useEffect(() => {
    if (subjectOptions.length > 0 && !subjectOptions.includes(selectedSubject)) {
      setSelectedSubject(subjectOptions[0]);
    }
  }, [selectedSubject, subjectOptions]);

  useEffect(() => {
    if (skipSubjectResetRef.current) {
      skipSubjectResetRef.current = false;
      return;
    }
    const firstAssessableIndex = topics.findIndex((topic) => isTopicReady(topic));
    setSelectedTopicIndex(firstAssessableIndex >= 0 ? firstAssessableIndex : 0);
  }, [selectedSubject]);
  useEffect(() => {
    if (topics.length === 0) {
      if (selectedTopicIndex !== 0) setSelectedTopicIndex(0);
      return;
    }
    if (!topics[selectedTopicIndex] || !isTopicReady(topics[selectedTopicIndex])) {
      const firstAssessableIndex = topics.findIndex((topic) => isTopicReady(topic));
      setSelectedTopicIndex(firstAssessableIndex >= 0 ? firstAssessableIndex : 0);
    }
  }, [topics, selectedTopicIndex]);
  useEffect(() => setSelectedCriterionIndex(0), [dataKey]);
  useEffect(() => {
    let cancelled = false;
    if (!selectedClass) {
      setApiStudents([]);
      return () => { cancelled = true; };
    }
    getStudents(selectedClass)
      .then((items) => {
        if (!cancelled) {
          setApiStudents(items);
          setBackendError("");
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setBackendStatus("offline");
          setBackendError(error.message || "Data backend belum tersambung. Menampilkan data terakhir.");
        }
      });
    return () => { cancelled = true; };
  }, [selectedClass]);
  useEffect(() => {
    setSelectedStudent((current) => (
      students.find((student) => String(student.id) === String(current?.id))
      || students.find((student) => String(student.id) === preferredStudentIdRef.current)
      || students[0]
      || null
    ));
  }, [students]);
  useEffect(() => {
    if (!selectedClass || !selectedSubject) return;
    saveAssessmentFilterState({
      className: selectedClass,
      subject: selectedSubject,
      topicIndex: selectedTopicIndex,
      topicId: dataKey,
      studentId: selectedStudent?.id ?? null,
    });
  }, [selectedClass, selectedSubject, selectedTopicIndex, dataKey, selectedStudent?.id]);
  useEffect(() => {
    if (!dataKey) {
      setRubricLoading(false);
      setWeightInfo({ updatedAt: "", source: "" });
      return undefined;
    }
    let cancelled = false;
    setRubricLoading(true);
    setBackendStatus("loading");
    setCriteriaStatus(criteria.length > 0 ? "available" : "loading");
    setPreviewScore(null);
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
          setWeightInfo({
            updatedAt: result?.flow?.weightUpdatedAt || result?.weights?.__savedAt || "",
            source: result?.flow?.weightSource || "",
          });
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
          setWeightInfo({
            updatedAt: dummyATL.savedWeights?.[dataKey]?.__savedAt || "",
            source: dummyATL.savedWeights?.[dataKey] ? "cached" : "",
          });
          setDataVersion((version) => version + 1);
        }
      })
      .finally(() => {
        if (!cancelled) setRubricLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [dataKey]);
  useEffect(() => {
    if (!dataKey || !selectedClass) {
      setBackendReportRows([]);
      return;
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
    const activeKey = selectedStudent && dataKey ? `${selectedStudent.id}:${dataKey}` : "";
    const selectionChanged = activeAssessmentKeyRef.current !== activeKey;
    activeAssessmentKeyRef.current = activeKey;
    if (!selectedStudent || !dataKey) {
      setRatings({});
      setNote("");
      hasLocalChangesRef.current = false;
      return;
    }
    if (selectionChanged) {
      setRatings({});
      setNote("");
      setPreviewScore(null);
      setPreviewingScore(false);
      setSaveStatus(null);
      setSaveMessage("");
    }
    if (rubricLoading) {
      hasLocalChangesRef.current = false;
      return;
    }
    const draft = getAssessmentDraft(selectedStudent.id, dataKey);
    setRatings({ ...(draft?.ratings || dummyATL.savedAssessments?.[selectedStudent.id]?.[dataKey] || {}) });
    setNote(draft?.note || "");
    const hasLiveDraft = draft?.__source === "live";
    hasLocalChangesRef.current = hasLiveDraft;
    if (hasLiveDraft) {
      setSaveStatus("editing");
      setSaveMessage("Nilai siap disimpan ke laporan.");
    } else if (selectionChanged && draft) {
      setSaveStatus("draft");
      setSaveMessage("Draft tersimpan.");
    } else if (selectionChanged) {
      setSaveStatus(null);
      setSaveMessage("");
    }
  }, [selectedStudent?.id, dataKey, dataVersion, rubricLoading]);
  useEffect(() => {
    const studentId = selectedStudent?.id;
    if (!studentId || !dataKey || rubricLoading || topicNeedsCriteria || criteria.length === 0) return undefined;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      setPreviewingScore(true);
      previewAssessmentScores([
        { studentId, topic: dataKey, ratings },
      ])
        .then((scores) => {
          if (!cancelled) {
            const score = scores[String(studentId)];
            setPreviewScore(score ? { ...score, studentId: String(studentId), topicId: dataKey } : null);
          }
        })
        .catch(() => {
          if (!cancelled) setPreviewScore(null);
        })
        .finally(() => {
          if (!cancelled) setPreviewingScore(false);
        });
    }, 180);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [selectedStudent, dataKey, ratings, rubricLoading, topicNeedsCriteria, criteria.length]);

  useEffect(() => {
    if (!rubricLoading && !topicNeedsCriteria && criteria.length > 0 && saveStatus === "failed") {
      setSaveStatus(null);
      setSaveMessage("");
    }
  }, [rubricLoading, topicNeedsCriteria, criteria.length, saveStatus]);

  useEffect(() => {
    if (!dataKey || rubricLoading || topicNeedsCriteria || criteria.length === 0 || students.length === 0) {
      setLocalScoreRows({});
      return undefined;
    }
    const items = students
      .map((student) => {
        const draft = getAssessmentDraft(student.id, dataKey);
        const cachedRatings = dummyATL.savedAssessments?.[student.id]?.[dataKey];
        const studentRatings = draft?.ratings || cachedRatings || null;
        if (!studentRatings || Object.keys(studentRatings).length === 0) return null;
        return { studentId: student.id, topic: dataKey, ratings: studentRatings };
      })
      .filter(Boolean);

    if (items.length === 0) {
      setLocalScoreRows({});
      return undefined;
    }

    let cancelled = false;
    previewAssessmentScores(items)
      .then((scores) => {
        if (cancelled) return;
        setLocalScoreRows(
          Object.fromEntries(
            Object.entries(scores || {}).map(([studentId, score]) => [
              String(studentId),
              Number(score?.rawScore ?? score?.score ?? 0),
            ])
          )
        );
      })
      .catch(() => {
        if (!cancelled) setLocalScoreRows({});
      });
    return () => {
      cancelled = true;
    };
  }, [students, dataKey, dataVersion, rubricLoading, topicNeedsCriteria, criteria.length]);

  const criterionRating = useMemo(() => {
    if (!criterion) return "";
    return normalizeRatingLabel((criterion.atl || []).map((atl) => ratings[`${dataKey}_${criterion.kriteria}_${atl}`]).find(Boolean));
  }, [criterion, ratings, dataKey]);

  const scoredCriteriaCount = useMemo(() => (
    criteria.filter((item) => (item.atl || []).some((atl) => ratings[`${dataKey}_${item.kriteria}_${atl}`])).length
  ), [criteria, ratings, dataKey]);

  const studentScores = useMemo(
    () => Object.fromEntries(
      backendReportRows.map((student) => [
        String(student.id),
        Number(student.rawScore ?? student.score ?? 0),
      ])
    ),
    [backendReportRows]
  );
  const backendSavedScore = Number(studentScores[String(selectedStudent?.id)] || 0);
  const localSavedScore = Number(localScoreRows[String(selectedStudent?.id)] || 0);
  const activePreviewScore = (
    previewScore?.studentId === String(selectedStudent?.id)
    && previewScore?.topicId === dataKey
  ) ? previewScore : null;
  const displayedScore = activePreviewScore?.rawScore ?? (localSavedScore > 0 ? localSavedScore : backendSavedScore);
  const calculatedScore = Number(displayedScore).toFixed(2);
  const scoreIsPreview = Boolean(activePreviewScore);

  const handleSelectRating = (levelLabel) => {
    if (!criterion || !selectedStudent || !dataKey || topicNeedsCriteria) return;
    const next = { ...ratings };
    (criterion.atl || []).forEach((atl) => {
      next[`${dataKey}_${criterion.kriteria}_${atl}`] = levelLabel;
    });
    setRatings(next);
    refreshCurrentAssessmentRef({ ratings: next });
    updateAssessmentLiveDraft(selectedStudent.id, dataKey, next, {
      note,
      className: selectedClass,
      subject: selectedSubject,
      topicLabel: selectedTopic.label,
    });
    hasLocalChangesRef.current = true;
    setSaveStatus("editing");
    setSaveMessage("Nilai siap disimpan ke laporan.");
  };

  const handleSaveDefaultFilter = () => {
    saveAssessmentFilterState({
      className: selectedClass,
      subject: selectedSubject,
      topicIndex: selectedTopicIndex,
      topicId: dataKey,
      studentId: selectedStudent?.id ?? null,
    });
    setSaveStatus("default");
    setSaveMessage("Default tampilan filter disimpan.");
  };

  const handlePush = async () => {
    if (!canPushAssessment) {
      setSaveStatus("failed");
      setSaveMessage(
        rubricLoading
          ? "Tunggu sampai kriteria selesai dimuat."
          : assessmentUnavailableMessage || "Pilih siswa dan kriteria yang valid sebelum menyimpan."
      );
      return false;
    }
    const snapshot = {
      studentId: selectedStudent.id,
      topicId: dataKey,
      ratings: { ...ratings },
      note,
      key: `${selectedStudent.id}:${dataKey}`,
    };
    if (!Object.values(snapshot.ratings).some(Boolean)) {
      setSaveStatus("failed");
      setSaveMessage("Belum ada nilai untuk disimpan. Pilih minimal satu level rubrik.");
      return { synced: false, error: "Belum ada nilai untuk disimpan." };
    }
    const requestId = pushRequestRef.current + 1;
    pushRequestRef.current = requestId;
    refreshCurrentAssessmentRef(snapshot);
    setSaveStatus("pushing");
    setSaveMessage("Menyimpan nilai...");
    const result = await saveAssessment(snapshot.studentId, snapshot.topicId, snapshot.ratings, { teacherNote: snapshot.note });
    const stillCurrent = pushRequestRef.current === requestId && activeAssessmentKeyRef.current === snapshot.key;
    if (result?.synced) {
      clearAssessmentDraft(snapshot.studentId, snapshot.topicId);
      if (stillCurrent) {
        hasLocalChangesRef.current = false;
        setSaveStatus("backend");
        setSaveMessage("Nilai berhasil masuk laporan.");
      }
    } else if (stillCurrent) {
      setSaveStatus("failed");
      setSaveMessage(result?.error || "Gagal menyimpan nilai.");
    }
    return result;
  };

  const progress = criteria.length ? Math.round((scoredCriteriaCount / criteria.length) * 100) : 0;
  const scoreCategory = getScoreCategory(calculatedScore);
  const saveStatusClass = {
    backend: "bg-emerald-100 text-emerald-700",
    draft: "bg-sky-100 text-sky-700",
    editing: "bg-amber-100 text-amber-800",
    default: "bg-primary/10 text-primary",
    pushing: "bg-blue-100 text-blue-700",
    failed: "bg-red-100 text-red-700",
  }[saveStatus] || "bg-stone-100 text-stone-700";

  return (
    <div className="flex h-screen w-full overflow-hidden bg-stone-50">
      <Sidebar />
      <main className="relative flex flex-1 flex-col overflow-hidden bg-stone-50">
        <div className="flex-1 overflow-y-auto p-4 lg:p-8">
          <div className="mx-auto max-w-[1500px] space-y-5 rounded-[1.75rem] bg-white p-5 shadow-[0_24px_60px_rgba(15,23,42,0.08)]">
            <header className="flex flex-col gap-4 border-b border-stone-100 pb-5 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <span className="rounded bg-primary/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-primary-hover">
                  Input Nilai ATL
                </span>
                <h1 className="mt-3 text-3xl font-black text-text-main-light">Input Penilaian ATL</h1>
                <p className="mt-2 text-sm text-text-sub-light">
                  Isi nilai satu siswa dengan panduan rubrik yang lengkap.
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
                  data-testid="assessment-save-button"
                  type="button"
                  onClick={handlePush}
                  disabled={!canPushAssessment}
                  className="inline-flex items-center gap-2 rounded-xl bg-stone-950 px-6 py-2.5 text-sm font-black text-white shadow-lg shadow-stone-950/15 transition-all hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-[18px]">cloud_upload</span>
                  {saveStatus === "pushing" ? "Menyimpan..." : "Simpan Penilaian"}
                </button>
              </div>
            </header>

            {backendError && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm font-bold text-amber-800">
                <span className="material-symbols-outlined mr-2 align-middle text-[18px]">error</span>
                {backendError}
              </div>
            )}
            {isBackendUpdating && criteria.length > 0 && (
              <div className="rounded-2xl border border-sky-200 bg-sky-50 px-5 py-3 text-xs font-black text-sky-700">
                <span className="material-symbols-outlined mr-2 align-middle text-[16px]">sync</span>
                Mohon tunggu sebentar, sistem sedang memuat data terbaru dari backend. Tampilan tetap memakai data terakhir.
              </div>
            )}

            <section className="flex flex-col gap-4 rounded-2xl border border-amber-300 bg-amber-50 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex max-w-4xl items-start gap-3">
                <span className="material-symbols-outlined mt-0.5 text-[19px] text-amber-600">info</span>
                <div>
                  <p className="text-sm font-black text-stone-900">Isi nilai dulu, lalu simpan saat sudah siap.</p>
                  <p className="mt-1 text-xs font-semibold leading-5 text-stone-600">
                    Progress menunjukkan jumlah kriteria yang sudah dinilai. Gunakan <b>Simpan Default</b> untuk menyimpan pilihan kelas, mapel, topik, dan siswa saat ini sebagai tampilan awal.
                  </p>
                  {saveStatus && <p className={`mt-2 inline-flex rounded-lg px-2.5 py-1 text-[11px] font-black ${saveStatusClass}`}>{saveMessage}</p>}
                </div>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-3">
                <span className="rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-xs font-black text-stone-700">
                  Progress {progress}%
                </span>
                <button
                  type="button"
                  onClick={handleSaveDefaultFilter}
                  className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-black text-white shadow-sm transition-all hover:bg-secondary"
                >
                  <span className="material-symbols-outlined text-[18px]">bookmark</span>
                  Simpan Default
                </button>
              </div>
            </section>

        <section className="grid gap-4 lg:grid-cols-[2fr_1fr_220px]">
          <div className="grid gap-5 rounded-2xl border border-stone-200 bg-white p-4 md:grid-cols-[320px_1fr]">
            <div className="space-y-3">
              <label className="text-[10px] font-black uppercase tracking-[0.22em] text-stone-500">Kelas</label>
              <select data-testid="assessment-class-select" value={selectedClass} onChange={(e) => handleClassChange(e.target.value)} className="w-full rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm font-black">
                {classOptions.map((cls) => <option key={cls}>{cls}</option>)}
              </select>
              <label className="block text-[10px] font-black uppercase tracking-[0.22em] text-stone-500">Mata Pelajaran</label>
              <select data-testid="assessment-subject-select" value={selectedSubject} onChange={(e) => handleSubjectChange(e.target.value)} className="w-full rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-black text-red-600">
                {subjectOptions.map((item) => <option key={item}>{item}</option>)}
              </select>
            </div>
            <div>
              <p className="mb-4 text-[10px] font-black uppercase tracking-[0.24em] text-stone-500">Pilih Topik Pembelajaran</p>
              <div className="flex flex-wrap gap-2">
                {topics.map((topic, index) => {
                  const disabled = !isTopicReady(topic);
                  return (
                    <span key={topic.id} className="group relative inline-flex">
                      <button
                        data-testid={`assessment-topic-option-${topic.id}`}
                        onClick={() => handleTopicChange(index)}
                        disabled={disabled}
                        className={`rounded-xl px-5 py-3 text-sm font-black ${
                          disabled
                            ? "cursor-not-allowed border border-stone-200 bg-stone-100 text-stone-400 opacity-60"
                            : index === selectedTopicIndex
                              ? "bg-primary text-white shadow-lg shadow-primary/25"
                              : "border border-stone-200 bg-white text-stone-900"
                        }`}
                      >
                        {topic.label}
                      </button>
                      {disabled && (
                        <span className="pointer-events-none absolute left-1/2 top-full z-30 mt-2 hidden w-56 -translate-x-1/2 rounded-xl border border-stone-200 bg-white px-3 py-2 text-center text-[11px] font-bold text-stone-500 shadow-lg group-hover:block">
                          Belum bisa dinilai, kriteria belum tersedia.
                        </span>
                      )}
                    </span>
                  );
                })}
              </div>
            </div>
          </div>
              <div className="rounded-2xl border border-stone-200 bg-white p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-stone-500">Progres Penilaian</p>
            <div className="mt-4 flex items-center gap-4">
              <div className="flex h-24 w-24 items-center justify-center rounded-full border-[10px] border-primary text-lg font-black text-stone-900">{progress}%</div>
              <div className="flex-1">
                <p className="text-sm font-black">{scoredCriteriaCount} / {criteria.length} Kriteria Dinilai</p>
                <div className="mt-3 h-3 overflow-hidden rounded-full bg-stone-100 shadow-inner"><div className="h-full rounded-full bg-primary shadow-sm" style={{ width: `${progress}%` }} /></div>
              </div>
            </div>
          </div>
          <div className="rounded-2xl border border-stone-200 bg-white p-5 text-center">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-stone-500">
              {scoreIsPreview ? "(Realtime Calculation)" : "Recent Calculation Saved"}
            </p>
            <div className="mt-5 text-5xl font-black text-stone-900">{calculatedScore}</div>
            <p className="mt-1 text-sm font-bold text-stone-500">/100</p>
            <span className={`mt-4 inline-flex rounded-full px-3 py-1 text-xs font-black uppercase ${scoreCategory.className}`}>{scoreCategory.label}</span>
            {scoreIsPreview && (
              <p className="mt-3 text-[10px] font-bold text-amber-700">
                {previewingScore ? "Menghitung..." : `Recent Calculation Saved: ${backendSavedScore.toFixed(2)}/100`}
              </p>
            )}
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
                const studentScore = Number(
                  active && activePreviewScore
                    ? activePreviewScore.rawScore
                    : localScoreRows[String(student.id)] ?? studentScores[String(student.id)] ?? 0
                ).toFixed(2);
                const studentCategory = getScoreCategory(studentScore);
                return (
                  <button data-testid={`assessment-student-option-${student.id}`} key={student.id} onClick={() => handleStudentChange(student)} className={`w-full rounded-xl border p-3 text-left transition ${active ? "border-primary bg-primary/5 shadow-md" : "border-stone-200 bg-white"}`}>
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
                    return (
                      <button
                        data-testid={`rubric-item-${option.code}`}
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
                    <textarea
                      data-testid="assessment-teacher-note"
                      value={note}
                      onChange={(e) => {
                        const nextNote = e.target.value;
                        setNote(nextNote);
                        refreshCurrentAssessmentRef({ note: nextNote });
                        if (selectedStudent && dataKey) {
                          updateAssessmentLiveDraft(selectedStudent.id, dataKey, ratings, {
                            note: nextNote,
                            className: selectedClass,
                            subject: selectedSubject,
                            topicLabel: selectedTopic.label,
                          });
                        }
                        hasLocalChangesRef.current = true;
                        setSaveStatus("editing");
                        setSaveMessage("Nilai siap disimpan ke laporan.");
                      }}
                      maxLength={250}
                      placeholder="Tulis catatan tentang performa siswa pada kriteria ini..."
                      className="mt-3 h-24 w-full resize-none rounded-xl border border-stone-200 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                    />
                    <p className="text-right text-xs text-stone-400">{note.length} / 250</p>
                  </div>
                  <div className="rounded-2xl border border-stone-200 bg-white p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-stone-500">Informasi Skala</p>
                        <p className="mt-2 text-sm leading-6 text-stone-600">Gunakan lima level berikut untuk membaca performa siswa secara sederhana.</p>
                      </div>
                      <span className="rounded-xl border border-primary/30 bg-primary/10 px-3 py-2 text-xs font-black text-stone-900">
                        Bobot: {weightScaleLabel}
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
              <div className="py-20 text-center">
                <span className="material-symbols-outlined text-5xl text-stone-300">rule</span>
                <p className="mt-3 text-sm font-black text-stone-500">
                  {rubricLoading && criteriaStatus !== "empty"
                    ? "Mohon tunggu sebentar, sedang loading data dari backend."
                    : assessmentUnavailableMessage || "Belum ada kriteria untuk topik ini."}
                </p>
                <p className="mt-2 text-xs font-semibold text-stone-400">
                  Buka Criteria Management untuk membuat rubrik sebelum nilai bisa masuk ke laporan.
                </p>
              </div>
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

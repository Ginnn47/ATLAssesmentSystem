import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "./sidebar";
import criteriamanagement from "./criteriamanagement";
import ExpertManagement from "./expertmanagement";
import { dummyATL } from "../dummyData/dummyATL";
import { getCurrentUser, getTopics, hydrateTopic } from "../../services/atlApi";
import { filterSubjectsByUserAccess } from "../../services/accessControl";
import { getATLCategoryMeta, getSubskillMeta } from "../../services/labelRegistry";
import { getSubjectData } from "../../services/topicCatalog";

const getFittedSkillTitleStyle = (title) => {
  const length = String(title || "").length;
  if (length > 42) return { fontSize: "0.68rem", lineHeight: "0.85rem" };
  if (length > 32) return { fontSize: "0.75rem", lineHeight: "0.95rem" };
  if (length > 24) return { fontSize: "0.85rem", lineHeight: "1.05rem" };
  return { fontSize: "1rem", lineHeight: "1.2rem" };
};

const getATLStyle = (atl) => {
  const meta = getATLCategoryMeta(atl);
  return {
    chip: meta.chipClass,
    dot: meta.color,
  };
};

const getSubskillStyle = (subskill, atl) => {
  const meta = getSubskillMeta(subskill);
  const fallback = getATLStyle(atl);
  return {
    chip: meta.chipClass || fallback.chip,
    chipStyle: meta.chipStyle,
    solidStyle: meta.solidStyle,
    softStyle: meta.softStyle,
    dot: meta.colorHex || meta.color || fallback.dot,
    bar: meta.bar || (meta.barClass ? `bg-gradient-to-r ${meta.barClass}` : "bg-primary"),
    barColor: meta.colorHex || meta.color || fallback.dot,
  };
};

const getSubskillIcon = (subskill = "", index = 0) => {
  const icon = getSubskillMeta(subskill).icon;
  if (icon) return icon;
  return ["auto_awesome", "psychology", "groups", "business_center"][index % 4];
};

const getDominanceTone = (label) => {
  if (label === "Strong Dominance") return "bg-red-100 text-red-700 ring-red-200";
  if (label === "Moderate Dominance") return "bg-yellow-100 text-yellow-700 ring-yellow-200";
  return "bg-green-100 text-green-700 ring-green-200";
};

const getRatingChipClass = (code) => {
  const normalized = String(code || "").toUpperCase();
  if (normalized === "EE") return "bg-emerald-100 text-emerald-700 ring-emerald-200";
  if (normalized === "ME") return "bg-blue-100 text-blue-700 ring-blue-200";
  if (normalized === "DE") return "bg-amber-100 text-amber-700 ring-amber-200";
  if (normalized === "PTE") return "bg-orange-100 text-orange-700 ring-orange-200";
  if (normalized === "NFI") return "bg-red-100 text-red-700 ring-red-200";
  return "bg-stone-100 text-stone-600 ring-stone-200";
};

const getRatingFullLabel = (code) => {
  const normalized = String(code || "").toUpperCase();
  if (normalized === "EE") return "Exceeding Expectation";
  if (normalized === "ME") return "Meeting Expectation";
  if (normalized === "DE") return "Developing Expectation";
  if (normalized === "PTE") return "Progressing Toward Expectation";
  return "Need Further Improvement";
};

const prettyTopic = (topicId) =>
  topicId
    .replace(/^singing_/, "")
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

const SUMMARY_TOPIC_KEY = "atl_manage_summary_topic";
const DEFAULT_WEIGHT_CALCULATION_TIMESTAMP = "2027-07-02T10:47:00+07:00";

const formatSummaryCalculationTime = (value) => {
  const date = new Date(value || DEFAULT_WEIGHT_CALCULATION_TIMESTAMP);
  if (Number.isNaN(date.getTime())) return "02 Jul 2027 10:47 WIB";
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

const getInitialSummaryTopic = () => {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(SUMMARY_TOPIC_KEY) || "";
};

const getPreferredTopicId = (subjects = []) => {
  const singingSubject = subjects.find((subject) => subject.id === "singing");
  const preferredSubject = singingSubject
    || subjects.find((subject) => (subject.topics || []).length > 0)
    || subjects[0];
  return preferredSubject?.topics?.[0]?.id || "";
};

export default function ATLmanage({ page = "criteria" }) {
  const navigate = useNavigate();
  const isWeightPage = page === "weight";
  const pageTitle = isWeightPage ? "Weight Management" : "Criteria Management";
  const pageDescription = isWeightPage
    ? "Kelola pairwise comparison, bobot Fuzzy-AHP, dan ringkasan bobot ATL untuk setiap sub-topik pembelajaran."
    : "Tentukan dan kelola kriteria penilaian untuk setiap sub-topik pembelajaran dengan deskripsi level yang jelas.";
  const [selectedTopic, setSelectedTopic] = useState(getInitialSummaryTopic);
  const [subjectTopics, setSubjectTopics] = useState([]);
  const [showWeightDetail, setShowWeightDetail] = useState(false);
  const [backendError, setBackendError] = useState("");
  const [dataVersion, setDataVersion] = useState(0);

  const handleSummaryTopicChange = (topicId) => {
    const nextTopic = topicId || "";
    setSelectedTopic(nextTopic);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(SUMMARY_TOPIC_KEY, nextTopic);
    }
  };

  useEffect(() => {
    if (!isWeightPage) return undefined;
    Promise.allSettled([getTopics(), getCurrentUser()])
      .then(([topicsResult, userResult]) => {
        const subjects = topicsResult.status === "fulfilled" ? topicsResult.value : getSubjectData();
        const user = userResult.status === "fulfilled" ? userResult.value : null;
        const accessibleSubjects = filterSubjectsByUserAccess(subjects || getSubjectData(), user);
        setSubjectTopics(accessibleSubjects);
        const topicIds = accessibleSubjects.flatMap((subject) => (subject.topics || []).map((topic) => topic.id));
        setSelectedTopic((current) => {
          const nextTopic = current && topicIds.includes(current) ? current : getPreferredTopicId(accessibleSubjects);
          if (nextTopic && typeof window !== "undefined") {
            window.localStorage.setItem(SUMMARY_TOPIC_KEY, nextTopic);
          }
          return nextTopic;
        });
        if (topicsResult.status === "rejected") {
          setBackendError("Backend belum tersambung. Menampilkan data terakhir.");
        } else {
          setBackendError("");
        }
      });
    return undefined;
  }, [isWeightPage]);

  useEffect(() => {
    let cancelled = false;
    if (!isWeightPage) return () => { cancelled = true; };
    if (!selectedTopic) return () => { cancelled = true; };
    hydrateTopic(selectedTopic)
      .then((result) => {
        if (!cancelled) {
          setBackendError(result?.stale ? "Backend belum tersambung. Menampilkan data terakhir." : "");
          setDataVersion((version) => version + 1);
        }
      })
      .catch(() => {
        if (!cancelled) {
        setBackendError("Backend belum tersambung. Menampilkan data terakhir.");
        setDataVersion((version) => version + 1);
      }
      });
    return () => {
      cancelled = true;
    };
  }, [isWeightPage, selectedTopic]);

  useEffect(() => {
    let cancelled = false;
    if (!isWeightPage) return () => { cancelled = true; };
    const syncWeights = () => {
      if (!selectedTopic) return;
      hydrateTopic(selectedTopic)
        .then((result) => {
          if (!cancelled) {
            setBackendError(result?.stale ? "Backend belum tersambung. Menampilkan data terakhir." : "");
            setDataVersion((version) => version + 1);
          }
        })
        .catch(() => {
          if (!cancelled) setBackendError("Backend belum tersambung. Menampilkan data terakhir.");
        });
    };
    window.addEventListener("atl-weights-updated", syncWeights);
    window.addEventListener("atl-criteria-updated", syncWeights);
    window.addEventListener("focus", syncWeights);
    return () => {
      cancelled = true;
      window.removeEventListener("atl-weights-updated", syncWeights);
      window.removeEventListener("atl-criteria-updated", syncWeights);
      window.removeEventListener("focus", syncWeights);
    };
  }, [isWeightPage, selectedTopic]);

  const summaryData = (() => {
    void dataVersion;
    const items = dummyATL[selectedTopic] || [];
    const savedWeights = dummyATL.savedWeights?.[selectedTopic] || {};
    const rows = items.map((item, index) => {
      const packageEntry = Object.values(savedWeights.packages || {}).find((pkg) => pkg.title === item.kriteria);
      const subskillRows = (item.atl || []).map((subskill) => {
        const packageWeight = packageEntry?.weights?.[subskill];
        const flatKey = `${item.kriteria} (${subskill})`;
        const weight = Number(packageWeight ?? savedWeights[flatKey] ?? savedWeights[subskill] ?? 0);
        return {
          subskill,
          weight,
          atl: getSubskillMeta(subskill).categoryName || item.atlCategories?.[0] || "ATL",
        };
      });
      const rankedRows = subskillRows.slice().sort((a, b) => b.weight - a.weight);
      const dominant = rankedRows[0] || { subskill: "-", weight: 0, atl: "-" };
      const runnerUp = rankedRows[1] || { subskill: "-", weight: 0, atl: "-" };
      const dominanceGap = Math.max(0, Number(dominant.weight || 0) - Number(runnerUp.weight || 0));
      const dominanceLabel = dominanceGap >= 0.2 ? "Strong Dominance" : dominanceGap >= 0.08 ? "Moderate Dominance" : "Balanced";
      const pairwiseTrace = packageEntry?.pairwiseTrace || [];
      const pairwiseExpected = subskillRows.length > 1 ? (subskillRows.length * (subskillRows.length - 1)) / 2 : 0;
      const averageWeight = subskillRows.length
        ? subskillRows.reduce((sum, row) => sum + row.weight, 0) / subskillRows.length
        : 0;
      return {
        index,
        item,
        dominant,
        runnerUp,
        subskillRows,
        averageWeight,
        packageEntry,
        consistency: packageEntry?.consistency,
        pairwiseTrace,
        pairwiseExpected,
        pairwiseValid: pairwiseTrace.length,
        dominanceGap,
        dominanceLabel,
      };
    });

    const distributionRaw = rows.reduce((acc, row) => {
      const key = row.dominant.subskill || "-";
      acc[key] = acc[key] || { subskill: key, atl: row.dominant.atl, value: 0 };
      acc[key].value += row.dominant.weight;
      return acc;
    }, {});
    const total = Object.values(distributionRaw).reduce((sum, entry) => sum + entry.value, 0) || 1;
    const distribution = Object.values(distributionRaw)
      .map((entry) => ({ ...entry, value: entry.value / total }))
      .sort((a, b) => b.value - a.value);
    const dominantOverall = distribution[0] || { subskill: "-", atl: "-", value: 0 };
    const calculationTimeLabel = formatSummaryCalculationTime(savedWeights.__savedAt);
    const donut = distribution.length
      ? `conic-gradient(${distribution.map((entry, index) => {
          const previous = distribution.slice(0, index).reduce((sum, item) => sum + item.value, 0) * 100;
          const next = previous + entry.value * 100;
          return `${getSubskillStyle(entry.subskill, entry.atl).dot} ${previous}% ${next}%`;
        }).join(", ")})`
      : "conic-gradient(#eab308 0% 100%)";

    return { rows, distribution, dominantOverall, donut, calculationTimeLabel };
  })();

  const selectedSummaryMeta = (() => {
    for (const subject of subjectTopics) {
      const topic = (subject.topics || []).find((item) => item.id === selectedTopic);
      if (topic) return { subject, topic };
    }
    return {
      subject: null,
      topic: { id: selectedTopic, label: prettyTopic(selectedTopic) },
    };
  })();

  return (
    <div className="flex h-screen w-full overflow-hidden">
      <Sidebar />

      {/* Main Content */}
      <main className="relative flex flex-1 flex-col overflow-hidden bg-stone-50">
        <div className="flex-1 overflow-y-auto p-4 lg:p-8">
          <div className="mx-auto flex max-w-7xl flex-col gap-8">
            {/* Header */}
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <span className="px-2 py-0.5 rounded bg-primary/20 text-primary-hover text-[10px] font-bold uppercase tracking-widest">
                  Settings / {pageTitle}
                </span>
                <h1 className="mt-3 text-3xl font-black text-text-main-light lg:text-4xl">
                  {pageTitle}
                </h1>
                <p className="mt-2 max-w-2xl text-sm text-text-sub-light">
                  {pageDescription}
                </p>
              </div>
            </div>

            {backendError && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm font-bold text-amber-800">
                <span className="material-symbols-outlined mr-2 align-middle text-[18px]">sync_problem</span>
                {backendError}
              </div>
            )}

            <div className="rounded-2xl border border-stone-200/90 bg-white shadow-[0_8px_16px_rgba(15,23,42,0.04)]">
              <div className="p-6">
                {isWeightPage ? (
                  <ExpertManagement 
                    onAddCriteriaClick={() => navigate("/atl/manage")}
                  />
                ) : (
                  React.createElement(criteriamanagement)
                )}
              </div>
            </div>

            {/* SIMPLE SUMMARY VIEW */}
            {isWeightPage && (
            <div className="overflow-hidden rounded-[2rem] border border-primary/25 bg-white shadow-sm">
              <div className="flex flex-col gap-4 border-b border-primary/20 px-6 py-5 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <span className="material-symbols-outlined text-3xl">balance</span>
                  </div>
                  <div>
                    <h2 className="text-2xl font-black tracking-wide text-stone-950">SUMMARY WEIGHTING - ATL (Fuzzy-AHP)</h2>
                    <p className="mt-1 text-sm font-semibold text-stone-500">Ringkasan hasil pembobotan ATL berdasarkan metode Fuzzy-AHP</p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <label className="group relative inline-flex min-w-[230px] items-center rounded-xl border border-stone-200 bg-white transition-all hover:border-primary/50 hover:bg-primary/5 focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/10">
                    <span className="pointer-events-none absolute left-3 material-symbols-outlined text-[17px] text-primary">summarize</span>
                    <select
                      value={selectedTopic}
                      onChange={(event) => handleSummaryTopicChange(event.target.value)}
                      className="w-full cursor-pointer appearance-none rounded-xl bg-transparent py-2 pl-10 pr-9 text-xs font-black text-stone-700 outline-none"
                      aria-label="Pilih mapel dan subtopik untuk summary"
                    >
                      {subjectTopics.map((subject) => (
                        <optgroup key={subject.id} label={subject.label}>
                          {(subject.topics || []).map((topic) => (
                            <option key={topic.id} value={topic.id}>
                              Summary: {subject.label} - {topic.label}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                    <span className="pointer-events-none absolute right-3 material-symbols-outlined text-[18px] text-stone-500 transition-transform group-focus-within:rotate-180">
                      expand_more
                    </span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowWeightDetail((current) => !current)}
                    className="inline-flex items-center gap-2 rounded-xl border border-primary/25 bg-primary/5 px-4 py-2 text-xs font-black text-primary-hover transition hover:border-primary/50 hover:bg-primary/10"
                  >
                    <span className="material-symbols-outlined text-[17px]">
                      {showWeightDetail ? "visibility_off" : "bar_chart"}
                    </span>
                    {showWeightDetail ? "Sembunyikan Detail" : "Tampilkan Detail"}
                  </button>
                </div>
              </div>

              <div className="grid gap-5 p-5 xl:grid-cols-[240px_minmax(0,1fr)_360px]">
                <aside className="rounded-2xl border border-primary/25 bg-white p-5">
                  <p className="mb-5 text-[11px] font-black uppercase tracking-[0.2em] text-primary-hover">Konfigurasi</p>
                  {[
                    ["menu_book", "Mata Pelajaran", selectedSummaryMeta.subject?.label || "-"],
                    ["topic", "Topik", selectedSummaryMeta.topic?.label || prettyTopic(selectedTopic)],
                    ["groups", "Kelas", "3A (Primary)"],
                    ["grid_view", "Jumlah Kriteria", summaryData.rows.length],
                    ["person", "Jumlah ATL", 5],
                    ["settings", "Metode", "Fuzzy-AHP"],
                    ["calendar_month", "Tanggal Perhitungan", summaryData.calculationTimeLabel],
                  ].map(([icon, label, value]) => (
                    <div key={label} className="mb-5 flex items-start gap-3 last:mb-0">
                      <span className="material-symbols-outlined mt-0.5 text-[20px] text-stone-500">{icon}</span>
                      <div>
                        <p className="text-xs font-bold text-stone-500">{label}</p>
                        <p className="mt-1 text-sm font-black text-stone-900">{value}</p>
                      </div>
                    </div>
                  ))}
                </aside>

                <section>
                  <h3 className="text-xl font-black text-stone-950">Weight Recap</h3>
                  <p className="mt-1 text-sm font-semibold text-stone-500">Ringkasan cepat bobot Fuzzy-AHP yang akan dipakai saat menghitung nilai akhir siswa.</p>

                  <div className="mt-4 rounded-2xl border border-primary/25 bg-primary/5 p-4">
                    <div className="flex gap-4">
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-primary">
                        <span className="material-symbols-outlined text-3xl">target</span>
                      </div>
                      <div>
                        <p className="text-[11px] font-black uppercase tracking-[0.16em] text-primary-hover">Pengertian Bobot Fuzzy-AHP</p>
                        <p className="mt-1 text-sm leading-6 text-stone-700">
                          Bobot menunjukkan seberapa besar pengaruh subskill pada perhitungan akhir. Semakin besar bobot, semakin besar kontribusinya saat skor rubrik siswa digabungkan.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 overflow-hidden rounded-2xl border border-primary/25">
                    <table className="w-full">
                      <thead className="bg-primary/5">
                        <tr>
                          <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-stone-500">Kriteria Penilaian</th>
                          <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-stone-500">Dominant Subskill</th>
                          <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-stone-500">Bobot Fuzzy</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-primary/10 bg-white">
                        {summaryData.rows.map((row) => {
                          const style = getSubskillStyle(row.dominant.subskill, row.dominant.atl);
                          return (
                            <tr key={row.item.kriteria} className="hover:bg-primary/5">
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-3">
                                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                                    <span className="text-xs font-black">{row.index + 1}</span>
                                  </span>
                                  <span className="text-sm font-black text-stone-900">{row.item.kriteria}</span>
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <span
                                  className={`inline-flex h-10 w-44 items-center justify-center rounded-xl border px-3 text-center text-[11px] font-black leading-tight ${style.chip}`}
                                  style={style.chipStyle}
                                  title={row.dominant.subskill}
                                >
                                  <span className="line-clamp-2">{row.dominant.subskill}</span>
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-3">
                                  <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-stone-100">
                                    <div className="h-full rounded-full" style={{ width: `${Math.min(row.dominant.weight * 100, 100)}%`, backgroundColor: style.barColor }} />
                                  </div>
                                  <span className="min-w-[54px] rounded-lg bg-primary/10 px-2.5 py-1 text-center text-sm font-black text-primary">
                                    {row.dominant.weight.toFixed(2)}
                                  </span>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    <div className="border-t border-primary/20 bg-primary/5 px-4 py-3 text-xs font-semibold text-stone-600">
                      Catatan: bagian ini menjelaskan bobot pembobotan, bukan hasil nilai siswa. Nilai siswa tetap dihitung dari rating rubrik yang dimasukkan evaluator.
                    </div>
                  </div>
                </section>

                <aside className="rounded-2xl border border-primary/25 bg-white p-5">
                  <p className="text-[11px] font-black uppercase tracking-widest text-primary-hover">Ringkasan Distribusi Subskill</p>
                  <div className="mt-4 rounded-2xl border border-sky-200 bg-sky-50 p-4">
                    <div className="flex items-start gap-3">
                      <span className="material-symbols-outlined mt-0.5 text-xl text-sky-600">info</span>
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-sky-700">Summary Recap View</p>
                        <p className="mt-1 text-xs font-semibold leading-5 text-slate-700">
                          Bagian ini menampilkan dominant subskill tertinggi dari setiap criterion. Gunakan view ini untuk membaca kekuatan utama per kriteria secara cepat.
                        </p>
                        <p className="mt-1 text-[11px] font-semibold leading-5 text-slate-500">
                          Subskill non-dominan tetap dihitung di detail package, tetapi tidak menjadi fokus ringkasan cepat ini.
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="mt-6 flex items-center justify-center">
                    <div className="relative flex h-40 w-40 items-center justify-center rounded-full" style={{ background: summaryData.donut }}>
                      <div className="flex h-24 w-24 flex-col items-center justify-center rounded-full bg-white text-center shadow-inner">
                        <span className="text-xs font-bold text-stone-500">Total</span>
                        <span className="text-xl font-black text-stone-900">1.00</span>
                      </div>
                    </div>
                  </div>
                  <div className="mt-5 space-y-3">
                    {summaryData.distribution.map((entry) => (
                      <div key={entry.subskill} className="flex items-center justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: getSubskillStyle(entry.subskill, entry.atl).dot }} />
                          <span className="truncate text-xs font-black text-stone-800">{entry.subskill}</span>
                        </div>
                        <span className="text-xs font-black text-stone-900">{entry.value.toFixed(2)} ({Math.round(entry.value * 100)}%)</span>
                      </div>
                    ))}
                  </div>
                  <div
                    className="mt-7 rounded-2xl border p-4"
                    style={getSubskillStyle(summaryData.dominantOverall.subskill, summaryData.dominantOverall.atl).softStyle}
                  >
                    <p className="text-xs font-black uppercase" style={{ color: getSubskillStyle(summaryData.dominantOverall.subskill, summaryData.dominantOverall.atl).dot }}>
                      Subskill Dominan Keseluruhan
                    </p>
                    <p className="mt-2 text-xl font-black text-stone-900">{summaryData.dominantOverall.subskill}</p>
                    <p className="mt-1 text-xs leading-5 text-stone-600">Subskill ini paling berpengaruh secara keseluruhan pada seluruh kriteria penilaian.</p>
                  </div>
                </aside>
              </div>

              {showWeightDetail && (
              <div className="border-t border-primary/10 bg-gradient-to-b from-primary/5 to-white px-5 pb-5 pt-6">
                <div>
                  <h3 className="text-xl font-black text-stone-950">Detailed Weight Breakdown</h3>
                  <p className="mt-1 text-sm font-semibold text-stone-500">Distribusi bobot subskill pada setiap criterion package.</p>
                </div>
                <div className="mt-5 grid gap-5 xl:grid-cols-3">
                  {summaryData.rows.map((row) => {
                    const dominantStyle = getSubskillStyle(row.dominant.subskill, row.dominant.atl);
                    const dominantIcon = getSubskillIcon(row.dominant.subskill);
                    return (
                    <article key={row.item.kriteria} className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
                      <div className="flex items-start gap-3 border-b border-stone-200 pb-4">
                        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                          <span className="material-symbols-outlined text-3xl">music_note</span>
                        </span>
                        <div className="min-w-0">
                          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-stone-400">{row.item.criteriaTopic || "Rubric"}</p>
                          <h3 className="mt-1 text-base font-black leading-tight text-slate-950">{row.item.kriteria}</h3>
                        </div>
                      </div>

                      <div className="mt-4 flex min-h-[42px] items-center justify-between gap-3 rounded-xl bg-stone-50 px-3 py-2">
                        <p className="text-sm font-semibold leading-none text-stone-500">Mean Weight</p>
                        <p className="text-3xl font-black leading-none text-primary">{row.averageWeight.toFixed(2)}</p>
                      </div>

                      <div
                        className="mt-4 rounded-2xl border p-4"
                        style={{
                          borderColor: `${dominantStyle.dot}55`,
                          backgroundColor: `${dominantStyle.dot}12`,
                        }}
                      >
                        <div className="grid grid-cols-[48px_minmax(0,1fr)_auto] items-center gap-3">
                          <div
                            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-white shadow-lg"
                            style={{ backgroundColor: dominantStyle.dot }}
                          >
                            <span className="material-symbols-outlined text-2xl">{dominantIcon}</span>
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-black" style={{ color: dominantStyle.dot }}>Dominant Skill</p>
                            <p
                              className="mt-0.5 line-clamp-2 break-words font-black text-slate-950"
                              style={getFittedSkillTitleStyle(row.dominant.subskill)}
                              title={row.dominant.subskill}
                            >
                              {row.dominant.subskill}
                            </p>
                            <p className="mt-0.5 text-xs font-semibold text-stone-500">Strong analytical contribution</p>
                          </div>
                          <p className="shrink-0 text-3xl font-black" style={{ color: dominantStyle.dot }}>{row.dominant.weight.toFixed(2)}</p>
                        </div>
                      </div>

                      <div className="mt-5 space-y-4">
                        {row.subskillRows.filter((subskillRow) => subskillRow.subskill !== row.dominant.subskill).map((subskillRow) => {
                          const style = getSubskillStyle(subskillRow.subskill, subskillRow.atl);
                          const icon = getSubskillIcon(subskillRow.subskill);
                          return (
                          <div key={subskillRow.subskill} className="grid grid-cols-[42px_minmax(0,1fr)_44px] items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full text-white shadow-sm" style={{ backgroundColor: style.dot }}>
                              <span className="material-symbols-outlined text-xl">{icon}</span>
                            </div>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-black text-slate-950">{subskillRow.subskill}</p>
                              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-stone-200">
                                <div className="h-full rounded-full" style={{ width: `${Math.min(subskillRow.weight * 100, 100)}%`, backgroundColor: style.dot }} />
                              </div>
                            </div>
                            <p className="text-right text-sm font-black text-slate-950">{Math.round(subskillRow.weight * 100)}%</p>
                          </div>
                          );
                        })}
                      </div>
                      <div className="mt-5 rounded-2xl border border-stone-200 bg-stone-50 p-3">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-stone-500">Evidence Recap</p>
                          <span
                            className={`rounded-full px-2.5 py-1 text-[10px] font-black ring-1 ${getDominanceTone(row.dominanceLabel)}`}
                          >
                            {row.dominanceLabel}
                          </span>
                        </div>
                        <div className="mt-3 grid grid-cols-3 gap-2">
                          <div className="rounded-xl bg-white p-2 ring-1 ring-stone-200">
                            <p className="text-[9px] font-black uppercase text-stone-400">Pairwise</p>
                            <p className="mt-1 text-sm font-black text-stone-900">{row.pairwiseValid}/{row.pairwiseExpected}</p>
                          </div>
                          <div className="rounded-xl bg-white p-2 ring-1 ring-stone-200">
                            <p className="text-[9px] font-black uppercase text-stone-400">CR</p>
                            <p className="mt-1 text-sm font-black text-stone-900">
                              {Number.isFinite(Number(row.consistency)) ? Number(row.consistency).toFixed(2) : "-"}
                            </p>
                          </div>
                          <div className="rounded-xl bg-white p-2 ring-1 ring-stone-200">
                            <p className="text-[9px] font-black uppercase text-stone-400">Gap</p>
                            <p className="mt-1 text-sm font-black text-stone-900">+{row.dominanceGap.toFixed(2)}</p>
                          </div>
                        </div>
                      </div>

                      <div className="mt-3 rounded-2xl border border-stone-200 bg-white p-3">
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-stone-500">Pairwise Trace</p>
                          <span className="text-[10px] font-black text-stone-400">Preview</span>
                        </div>
                        {row.pairwiseTrace.length > 0 ? (
                          <div className="space-y-2">
                            {row.pairwiseTrace.slice(0, 3).map((trace, traceIndex) => (
                              <div key={`${trace.left}-${trace.right}-${traceIndex}`} className="rounded-xl bg-stone-50 px-3 py-2">
                                <p className="truncate text-[11px] font-black text-stone-800">
                                  {trace.left} <span className="text-primary">&gt;</span> {trace.right}
                                </p>
                                <p className="mt-0.5 text-[10px] font-bold text-stone-500">
                                  {trace.scale} {Array.isArray(trace.tfn) ? `(${trace.tfn.join(", ")})` : ""}
                                </p>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="rounded-xl border border-dashed border-stone-300 bg-stone-50 px-3 py-3 text-[11px] font-semibold leading-5 text-stone-500">
                            Trace belum tersimpan. Recalculate dan simpan bobot dari Importance Weighting.
                          </p>
                        )}
                      </div>
                    </article>
                  );
                  })}
                </div>
                {(() => {
                  const exampleScores = [90, 70, 50, 30];
                  const exampleRows = summaryData.rows.slice(0, 4).map((row, index) => {
                    const score = exampleScores[index] ?? 70;
                    const weight = Number(row.dominant.weight || row.averageWeight || 1);
                    const scoreLabel = score >= 85 ? "EE" : score >= 70 ? "ME" : score >= 50 ? "DE" : score >= 30 ? "PTE" : "NFI";
                    return {
                      criteria: row.item.kriteria,
                      indicator: row.dominant.subskill,
                      score,
                      scoreLabel,
                      weight,
                      weightedScore: score * weight,
                    };
                  });
                  const totalWeight = exampleRows.reduce((sum, row) => sum + row.weight, 0) || 1;
                  const weightedTotal = exampleRows.reduce((sum, row) => sum + row.weightedScore, 0);
                  const finalScore = weightedTotal / totalWeight;
                  const finalLabel = finalScore >= 85 ? "EE" : finalScore >= 70 ? "ME" : finalScore >= 50 ? "DE" : finalScore >= 30 ? "PTE" : "NFI";
                  return (
                    <div className="mt-5 rounded-[1.75rem] border border-stone-200 bg-white p-5 shadow-sm">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                        <div>
                          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-primary-hover">How weights are used</p>
                          <h3 className="mt-2 text-2xl font-black text-stone-950">Ringkasan Bobot & Cara Perhitungan</h3>
                          <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-slate-500">
                            Ikhtisar rumus, contoh penerapan, dan hasil akhir berdasarkan bobot indikator. Panel ini bersifat edukatif, bukan perhitungan real-time nilai siswa.
                          </p>
                        </div>
                        <div className="hidden items-end gap-3 lg:flex">
                          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary shadow-sm">
                            <span className="material-symbols-outlined text-3xl">music_note</span>
                          </div>
                          <div className="flex h-20 w-24 items-end justify-center gap-1 rounded-2xl bg-violet-50 p-3">
                            {[24, 36, 50, 68].map((height, index) => (
                              <span key={height} className="w-3 rounded-t bg-primary/70" style={{ height: `${height}px`, opacity: 0.55 + index * 0.12 }} />
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="mt-5 grid gap-5 xl:grid-cols-[0.9fr_1.5fr]">
                        <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
                          <div className="flex items-center gap-3">
                            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                              <span className="material-symbols-outlined text-2xl">menu_book</span>
                            </span>
                            <h4 className="text-lg font-black text-stone-950">Rumus & Penjelasan Singkat</h4>
                          </div>
                          <div className="mt-4 rounded-2xl bg-primary/5 px-5 py-6 text-center">
                            <p className="text-xl font-black text-stone-950">
                              Final Score = <span className="inline-block align-middle">&Sigma;(Score &times; Weight)</span> / <span className="inline-block align-middle">&Sigma;(Weight)</span>
                            </p>
                          </div>
                          {[
                            ["speed", "Score", "Nilai mentah dari rating rubrik pada setiap indikator.", "bg-blue-50 text-blue-700"],
                            ["balance", "Weight", "Bobot Fuzzy-AHP yang ditetapkan untuk setiap indikator.", "bg-emerald-50 text-emerald-700"],
                            ["flag", "Hasil Akhir", "Skor akhir adalah rata-rata tertimbang dari seluruh indikator.", "bg-amber-50 text-amber-700"],
                          ].map(([icon, title, text, tone]) => (
                            <div key={title} className={`mt-3 flex items-start gap-3 rounded-2xl p-3 ${tone}`}>
                              <span className="material-symbols-outlined text-2xl">{icon}</span>
                              <div>
                                <p className="text-sm font-black">{title}</p>
                                <p className="mt-1 text-xs font-semibold leading-5 text-stone-600">{text}</p>
                              </div>
                            </div>
                          ))}
                        </div>

                        <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
                          <div className="flex items-center gap-3">
                            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-rose-50 text-rose-600">
                              <span className="material-symbols-outlined text-2xl">calculate</span>
                            </span>
                            <h4 className="text-lg font-black text-stone-950">Contoh Perhitungan</h4>
                          </div>
                          <div className="mt-4 overflow-hidden rounded-2xl border border-stone-200">
                            <table className="w-full">
                              <thead className="bg-stone-50">
                                <tr>
                                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-slate-500">Area</th>
                                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-slate-500">Indikator</th>
                                  <th className="px-4 py-3 text-center text-[10px] font-black uppercase tracking-widest text-slate-500">Predikat</th>
                                  <th className="px-4 py-3 text-center text-[10px] font-black uppercase tracking-widest text-slate-500">Score</th>
                                  <th className="px-4 py-3 text-center text-[10px] font-black uppercase tracking-widest text-slate-500">Weight</th>
                                  <th className="px-4 py-3 text-center text-[10px] font-black uppercase tracking-widest text-slate-500">Score x Weight</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-stone-100">
                                {exampleRows.length > 0 ? exampleRows.map((row) => (
                                  <tr key={row.criteria}>
                                    <td className="px-4 py-3 text-xs font-bold leading-5 text-stone-700">{row.criteria}</td>
                                    <td className="px-4 py-3 text-xs font-bold leading-5 text-stone-700">{row.indicator}</td>
                                    <td className="px-4 py-3 text-center">
                                      <span className={`inline-flex rounded-full px-3 py-1 text-xs font-black ring-1 ${getRatingChipClass(row.scoreLabel)}`}>
                                        {row.scoreLabel}
                                      </span>
                                    </td>
                                    <td className="px-4 py-3 text-center text-sm font-bold text-stone-700">{row.score}</td>
                                    <td className="px-4 py-3 text-center text-sm font-bold text-stone-700">{row.weight.toFixed(2)}</td>
                                    <td className="px-4 py-3 text-center text-sm font-black text-stone-950">{row.weightedScore.toFixed(2)}</td>
                                  </tr>
                                )) : (
                                  <tr>
                                    <td colSpan={6} className="px-4 py-8 text-center text-sm font-bold text-slate-500">
                                      Belum ada package bobot untuk dibuat contoh.
                                    </td>
                                  </tr>
                                )}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>

                      <div className="mt-5 rounded-2xl border border-emerald-200 bg-white p-4 shadow-sm">
                        <div className="grid gap-4 lg:grid-cols-[136px_minmax(0,1fr)] lg:items-stretch">
                          <div className="flex items-center justify-center gap-3 rounded-2xl bg-stone-50 p-3 lg:flex-col">
                            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100">
                              <span className="material-symbols-outlined text-3xl">fact_check</span>
                            </span>
                            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/20">
                              <span className="material-symbols-outlined text-3xl">balance</span>
                            </span>
                          </div>

                          <div className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-4">
                            <div className="flex flex-wrap items-center justify-center gap-3 lg:justify-end">
                              <div className="min-w-[150px] rounded-2xl bg-white px-4 py-3 text-center ring-1 ring-stone-200">
                                <p className="text-[11px] font-bold text-stone-500">Weighted Total</p>
                                <p className="mt-1 text-3xl font-black text-emerald-700">{weightedTotal.toFixed(2)}</p>
                                <p className="mt-1 text-[11px] font-semibold text-stone-500">&Sigma; (Score x Weight)</p>
                              </div>
                              <span className="text-4xl font-black text-stone-300">/</span>
                              <div className="min-w-[150px] rounded-2xl bg-white px-4 py-3 text-center ring-1 ring-stone-200">
                                <p className="text-[11px] font-bold text-stone-500">Total Weight</p>
                                <p className="mt-1 text-3xl font-black text-emerald-700">{totalWeight.toFixed(2)}</p>
                                <p className="mt-1 text-[11px] font-semibold text-stone-500">&Sigma; (Weight)</p>
                              </div>
                              <span className="text-4xl font-black text-stone-300">=</span>
                              <div className="min-w-[220px] rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-3 text-center">
                                <p className="text-[12px] font-black text-emerald-900">Final Score</p>
                                <p className="mt-1 text-5xl font-black leading-none text-emerald-700">
                                  {Number.isFinite(finalScore) ? finalScore.toFixed(2) : "0.00"}
                                </p>
                                <p className="mt-2 text-sm font-semibold text-stone-500">(Skor Akhir)</p>
                              </div>
                            </div>

                            <div className="mt-3 flex flex-col gap-3 rounded-2xl border border-primary/15 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                              <div>
                                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-stone-500">Predicate</p>
                                <p className="mt-1 text-sm font-semibold leading-5 text-stone-500">
                                  Contoh cara membaca bobot, bukan nilai siswa tersimpan.
                                </p>
                              </div>
                              <div className="flex items-center gap-3">
                                <span className={`inline-flex h-12 min-w-12 items-center justify-center rounded-full px-3 text-lg font-black ring-1 ${getRatingChipClass(finalLabel)}`}>
                                  {finalLabel}
                                </span>
                                <p className="text-right text-sm font-black text-stone-900">{getRatingFullLabel(finalLabel)}</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
              )}
                <div className="mt-5 rounded-2xl border border-primary/25 bg-white p-4">
                  <p className="text-[11px] font-black uppercase tracking-[0.18em] text-primary-hover">
                    Proses Fuzzy-AHP yang Dipakai
                  </p>
                  <div className="mt-3 grid gap-3 text-xs font-semibold text-stone-600 md:grid-cols-5">
                    {[
                      ["1", "Pairwise", "Expert membandingkan subskill dalam satu criterion package."],
                      ["2", "TFN Matrix", "Pilihan linguistik dikonversi menjadi Triangular Fuzzy Number."],
                      ["3", "Synthetic Extent", "Row sum fuzzy dibagi total fuzzy untuk membentuk S_i."],
                      ["4", "Vector d", "Setiap S_i dibandingkan dengan subskill lain memakai degree of possibility."],
                      ["5", "Weight", "Vector d dinormalisasi menjadi bobot lokal per subskill."],
                    ].map(([number, title, desc]) => (
                      <div key={title} className="rounded-xl bg-primary/5 p-3">
                        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary text-[10px] font-black text-white">{number}</span>
                        <p className="mt-2 font-black text-stone-900">{title}</p>
                        <p className="mt-1 leading-5">{desc}</p>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="mt-5 grid gap-4 rounded-2xl border border-primary/25 bg-primary/5 p-4 text-xs text-stone-700 lg:grid-cols-3">
                  <p><strong>Metode:</strong> Fuzzy-AHP (Triangular Fuzzy Number)</p>
                  <p><strong>Sumber Penilaian:</strong> 3 Expert (Guru)</p>
                  <p><strong>Keterangan:</strong> Pairwise Comparison &rarr; Fuzzy Synthesis &rarr; Defuzzification &rarr; Consistency Check</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

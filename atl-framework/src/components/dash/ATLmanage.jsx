import React, { useEffect, useMemo, useState } from "react";
import Sidebar from "./sidebar";
import criteriamanagement from "./criteriamanagement";
import ExpertManagement from "./expertmanagement";
import { dummyATL } from "./dummyATL";
import { hydrateTopic } from "../../services/atlApi";
import { getATLCategoryMeta, getSubskillMeta } from "../../services/labelRegistry";

const subskillATLMap = {
  "Critical Thingking": "Thinking Skills",
  "Creative Thingking": "Thinking Skills",
  "InformationTransfer": "Thinking Skills",
  "Reflection / Metacognitive": "Thinking Skills",
  "Textual Literacy": "Research Skills",
  "Media Literacy": "Research Skills",
  "Ethical use of information": "Research Skills",
  "Exchanging-information": "Communication Skills",
  "Literacy skills": "Communication Skills",
  "ICT skills": "Communication Skills",
  "Interpersonal relationships": "Collaboration",
  "Social-emotional intelligence": "Social-emotional",
  "Organization skills": "Self-management",
  "State of Mind": "Self-management",
};

const atlTone = {
  "Thinking Skills": {
    chip: "border-sky-200 bg-sky-50 text-sky-700",
    dot: "#0284c7",
  },
  "Research Skills": {
    chip: "border-violet-200 bg-violet-50 text-violet-700",
    dot: "#7c3aed",
  },
  "Communication Skills": {
    chip: "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700",
    dot: "#c026d3",
  },
  "Social Skills": {
    chip: "border-lime-200 bg-lime-50 text-lime-700",
    dot: "#65a30d",
  },
  Collaboration: {
    chip: "border-lime-200 bg-lime-50 text-lime-700",
    dot: "#65a30d",
  },
  "Social-emotional": {
    chip: "border-lime-200 bg-lime-50 text-lime-700",
    dot: "#65a30d",
  },
  "Self-management": {
    chip: "border-rose-200 bg-rose-50 text-rose-700",
    dot: "#be123c",
  },
  "Self-Management Skills": {
    chip: "border-rose-200 bg-rose-50 text-rose-700",
    dot: "#be123c",
  },
};

const getATLStyle = (atl) => {
  const meta = getATLCategoryMeta(atl);
  return {
    chip: meta.chipClass,
    dot: meta.color,
  };
};

const subskillTone = {
  "Critical Thingking": {
    chip: "border-[#00E5E5] bg-[#00E5E5]/10 text-[#008C8C]",
    dot: "#00E5E5",
    bar: "bg-[#00E5E5]",
  },
  "Creative Thingking": {
    chip: "border-[#0B0787] bg-[#0B0787]/10 text-[#0B0787]",
    dot: "#0B0787",
    bar: "bg-[#0B0787]",
  },
  InformationTransfer: {
    chip: "border-[#1100FF] bg-[#1100FF]/10 text-[#1100FF]",
    dot: "#1100FF",
    bar: "bg-[#1100FF]",
  },
  "Reflection / Metacognitive": {
    chip: "border-[#4B8DBB] bg-[#4B8DBB]/10 text-[#2F6F9F]",
    dot: "#4B8DBB",
    bar: "bg-[#4B8DBB]",
  },
  "Textual Literacy": {
    chip: "border-red-300 bg-red-100 text-red-800",
    dot: "#DC2626",
    bar: "bg-red-500",
  },
  "Media Literacy": {
    chip: "border-red-300 bg-red-100 text-red-800",
    dot: "#EF4444",
    bar: "bg-red-500",
  },
  "Ethical use of information": {
    chip: "border-red-300 bg-red-100 text-red-800",
    dot: "#B91C1C",
    bar: "bg-red-700",
  },
  "Exchanging-information": {
    chip: "border-purple-300 bg-purple-100 text-purple-800",
    dot: "#7C3AED",
    bar: "bg-purple-500",
  },
  "Literacy skills": {
    chip: "border-purple-300 bg-purple-100 text-purple-800",
    dot: "#8B5CF6",
    bar: "bg-purple-500",
  },
  "ICT skills": {
    chip: "border-purple-300 bg-purple-100 text-purple-800",
    dot: "#6D28D9",
    bar: "bg-purple-700",
  },
  "Interpersonal relationships": {
    chip: "border-lime-300 bg-lime-100 text-lime-800",
    dot: "#65a30d",
    bar: "bg-lime-500",
  },
  "Social-emotional intelligence": {
    chip: "border-green-300 bg-green-100 text-green-800",
    dot: "#16a34a",
    bar: "bg-green-500",
  },
  "Organization skills": {
    chip: "border-orange-300 bg-orange-100 text-orange-800",
    dot: "#EA580C",
    bar: "bg-orange-600",
  },
  "State of Mind": {
    chip: "border-orange-300 bg-orange-100 text-orange-800",
    dot: "#F97316",
    bar: "bg-orange-500",
  },
};

const getSubskillStyle = (subskill, atl) => {
  const meta = getSubskillMeta(subskill);
  const fallback = getATLStyle(atl);
  return {
    chip: meta.chipClass || fallback.chip,
    dot: meta.colorHex || meta.color || fallback.dot,
    bar: meta.bar || (meta.barClass ? `bg-gradient-to-r ${meta.barClass}` : "bg-primary"),
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

const prettyTopic = (topicId) =>
  topicId
    .replace(/^singing_/, "")
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

const SUMMARY_TOPIC_KEY = "atl_manage_summary_topic";
const getInitialSummaryTopic = () => {
  if (typeof window === "undefined") return "singing_christmas_carol";
  const savedTopic = window.localStorage.getItem(SUMMARY_TOPIC_KEY);
  return savedTopic && dummyATL[savedTopic] ? savedTopic : "singing_christmas_carol";
};

export default function ATLmanage() {
  const [activeTab, setActiveTab] = useState("criteria");
  const [selectedTopic, setSelectedTopic] = useState(getInitialSummaryTopic);
  const [showWeightDetail, setShowWeightDetail] = useState(false);
  const [, setDataVersion] = useState(0);

  const handleSummaryTopicChange = (topicId) => {
    const nextTopic = dummyATL[topicId] ? topicId : "singing_christmas_carol";
    setSelectedTopic(nextTopic);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(SUMMARY_TOPIC_KEY, nextTopic);
    }
  };

  useEffect(() => {
    let cancelled = false;
    hydrateTopic(selectedTopic).then(() => {
      if (!cancelled) setDataVersion((version) => version + 1);
    });
    return () => {
      cancelled = true;
    };
  }, [selectedTopic]);

  const summaryData = useMemo(() => {
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
          atl: subskillATLMap[subskill] || item.atlCategories?.[0] || "ATL",
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
    const donut = distribution.length
      ? `conic-gradient(${distribution.map((entry, index) => {
          const previous = distribution.slice(0, index).reduce((sum, item) => sum + item.value, 0) * 100;
          const next = previous + entry.value * 100;
          return `${getSubskillStyle(entry.subskill, entry.atl).dot} ${previous}% ${next}%`;
        }).join(", ")})`
      : "conic-gradient(#eab308 0% 100%)";

    return { rows, distribution, dominantOverall, donut };
  }, [selectedTopic, dummyATL.savedWeights?.[selectedTopic]]);

  return (
    <div className="flex h-screen w-full overflow-hidden">
      <Sidebar user={{ name: "Joko Wiryanto", role: "Guru / Evaluator" }} />

      {/* Main Content */}
      <main className="relative flex flex-1 flex-col overflow-hidden bg-stone-50">
        <div className="flex-1 overflow-y-auto p-4 lg:p-8">
          <div className="mx-auto flex max-w-7xl flex-col gap-8">
            {/* Header */}
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <span className="px-2 py-0.5 rounded bg-primary/20 text-primary-hover text-[10px] font-bold uppercase tracking-widest">
                  Settings / ATL Management
                </span>
                <h1 className="mt-3 text-3xl font-black text-text-main-light lg:text-4xl">
                  ATL System Management
                </h1>
                <p className="mt-2 max-w-2xl text-sm text-text-sub-light">
                  Tentukan dan kelola kriteria penilaian untuk setiap sub-topik pembelajaran dengan deskripsi level yang jelas.
                </p>
              </div>
            </div>

            {/* Tab Navigation */}
            <div className="rounded-2xl border border-stone-200/90 bg-white shadow-[0_8px_16px_rgba(15,23,42,0.04)]">
              <div className="flex border-b border-stone-200/90">
                <button
                  onClick={() => setActiveTab("criteria")}
                  className={`flex-1 px-6 py-4 font-semibold text-sm transition-all duration-300 ${
                    activeTab === "criteria"
                      ? "text-primary border-b-2 border-primary"
                      : "text-text-sub-light hover:text-text-main-light border-b-2 border-transparent"
                  }`}
                >
                  <span className="flex items-center justify-center gap-2">
                    <span className="material-symbols-outlined text-lg">assignment</span>
                    Context Setup
                  </span>
                </button>
                <button
                  onClick={() => setActiveTab("settings")}
                  className={`flex-1 px-6 py-4 font-semibold text-sm transition-all duration-300 ${
                    activeTab === "settings"
                      ? "text-primary border-b-2 border-primary"
                      : "text-text-sub-light hover:text-text-main-light border-b-2 border-transparent"
                  }`}
                >
                  <span className="flex items-center justify-center gap-2">
                    <span className="material-symbols-outlined text-lg">tune</span>
                    Importance Weighting
                  </span>
                </button>
              </div>

              {/* Content */}
              <div className="p-6">
                {activeTab === "criteria" && React.createElement(criteriamanagement)}
                {activeTab === "settings" && (
                  <ExpertManagement 
                    onAddCriteriaClick={() => setActiveTab("criteria")} 
                    onTopicChange={handleSummaryTopicChange}
                  />
                )}
              </div>
            </div>

            {/* SIMPLE SUMMARY VIEW */}
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
                  <span className="inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-4 py-2 text-xs font-black text-stone-700">
                    <span className="material-symbols-outlined text-[17px] text-primary">summarize</span>
                    Summary: {prettyTopic(selectedTopic)}
                  </span>
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
                    ["topic", "Topik", prettyTopic(selectedTopic)],
                    ["groups", "Kelas", "3A (Primary)"],
                    ["grid_view", "Jumlah Kriteria", summaryData.rows.length],
                    ["person", "Jumlah ATL", 5],
                    ["settings", "Metode", "Fuzzy-AHP"],
                    ["calendar_month", "Tanggal Perhitungan", "10 Mei 2025 14:32"],
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
                  <p className="mt-1 text-sm font-semibold text-stone-500">Ringkasan cepat hasil pembobotan ATL per kriteria.</p>

                  <div className="mt-4 rounded-2xl border border-primary/25 bg-primary/5 p-4">
                    <div className="flex gap-4">
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-primary">
                        <span className="material-symbols-outlined text-3xl">target</span>
                      </div>
                      <div>
                        <p className="text-[11px] font-black uppercase tracking-[0.16em] text-primary-hover">Pengertian Dominant Subskill</p>
                        <p className="mt-1 text-sm leading-6 text-stone-700">
                          Dominant subskill adalah subskill ATL dengan pengaruh terbesar terhadap suatu kriteria berdasarkan bobot akhir tertinggi.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 overflow-hidden rounded-2xl border border-primary/25">
                    <table className="w-full">
                      <thead className="bg-primary/5">
                        <tr>
                          <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-stone-500">No</th>
                          <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-stone-500">Kriteria Penilaian</th>
                          <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-stone-500">Dominant Subskill</th>
                          <th className="px-4 py-3 text-center text-[10px] font-black uppercase tracking-widest text-stone-500">Bobot Akhir</th>
                          <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-stone-500">Kontribusi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-primary/10 bg-white">
                        {summaryData.rows.map((row) => {
                          const style = getSubskillStyle(row.dominant.subskill, row.dominant.atl);
                          return (
                            <tr key={row.item.kriteria} className="hover:bg-primary/5">
                              <td className="px-4 py-3 text-sm font-bold text-stone-500">{row.index + 1}</td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-3">
                                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                                    <span className="material-symbols-outlined text-[17px]">music_note</span>
                                  </span>
                                  <span className="text-sm font-black text-stone-900">{row.item.kriteria}</span>
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <span className={`inline-flex rounded-lg border px-3 py-1 text-xs font-black ${style.chip}`}>{row.dominant.subskill}</span>
                              </td>
                              <td className="px-4 py-3 text-center">
                                <span className="inline-flex min-w-[58px] justify-center rounded-lg bg-primary/10 px-3 py-1 text-base font-black text-primary">
                                  {row.dominant.weight.toFixed(2)}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-3">
                                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-stone-100">
                                    <div className={`h-full rounded-full ${style.bar}`} style={{ width: `${Math.min(row.dominant.weight * 100, 100)}%` }} />
                                  </div>
                                  <span className="w-12 text-right text-xs font-black text-stone-500">{(row.dominant.weight * 100).toFixed(1)}%</span>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    <div className="border-t border-primary/20 bg-primary/5 px-4 py-3 text-xs font-semibold text-stone-600">
                      Dominant subskill ditentukan berdasarkan bobot akhir tertinggi pada setiap kriteria.
                    </div>
                  </div>
                </section>

                <aside className="rounded-2xl border border-primary/25 bg-white p-5">
                  <p className="text-[11px] font-black uppercase tracking-widest text-primary-hover">Ringkasan Distribusi Subskill</p>
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
                  <div className="mt-7 rounded-2xl border border-primary/25 bg-primary/5 p-4">
                    <p className="text-xs font-black uppercase text-primary-hover">Subskill Dominan Keseluruhan</p>
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
                        <p className="text-sm font-semibold leading-none text-stone-500">Average Weight</p>
                        <p className="text-3xl font-black leading-none text-primary">{row.averageWeight.toFixed(2)}</p>
                      </div>

                      <div
                        className="mt-4 rounded-2xl border p-4"
                        style={{
                          borderColor: `${dominantStyle.dot}55`,
                          backgroundColor: `${dominantStyle.dot}12`,
                        }}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-white shadow-lg"
                            style={{ backgroundColor: dominantStyle.dot }}
                          >
                            <span className="material-symbols-outlined text-2xl">{dominantIcon}</span>
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-black" style={{ color: dominantStyle.dot }}>Dominant Skill</p>
                            <p className="mt-0.5 truncate text-lg font-black leading-tight text-slate-950">{row.dominant.subskill}</p>
                            <p className="mt-0.5 text-xs font-semibold text-stone-500">Strong analytical contribution</p>
                          </div>
                          <p className="text-3xl font-black" style={{ color: dominantStyle.dot }}>{row.dominant.weight.toFixed(2)}</p>
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
        </div>
      </main>
    </div>
  );
}

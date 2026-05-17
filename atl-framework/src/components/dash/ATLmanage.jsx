import React, { useEffect, useMemo, useState } from "react";
import Sidebar from "./sidebar";
import criteriamanagement from "./criteriamanagement";
import ExpertManagement from "./expertmanagement";
import { dummyATL } from "./dummyATL";
import { hydrateTopic } from "../../services/atlApi";

const subskillATLMap = {
  "Critical Thingking": "Thinking Skills",
  "Creative Thingking": "Thinking Skills",
  InformationTransfer: "Thinking Skills",
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

const getATLStyle = (atl) => atlTone[atl] || atlTone["Thinking Skills"];

const prettyTopic = (topicId) =>
  topicId
    .replace(/^singing_/, "")
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

const dominantForCriterion = (item, savedWeights) => {
  const rows = (item.atl || []).map((subskill) => {
    const packageWeight = Object.values(savedWeights.packages || {}).find((pkg) => pkg.title === item.kriteria)?.weights?.[subskill];
    const flatKey = `${item.kriteria} (${subskill})`;
    return { subskill, weight: Number(packageWeight || savedWeights[flatKey] || savedWeights[subskill] || 0) };
  });
  const dominant = rows.sort((a, b) => b.weight - a.weight)[0] || { subskill: "-", weight: 0 };
  return { ...dominant, atl: subskillATLMap[dominant.subskill] || item.atlCategories?.[0] || "-" };
};

export default function ATLmanage() {
  const [activeTab, setActiveTab] = useState("criteria");
  const [selectedTopic, setSelectedTopic] = useState("singing_christmas_carol");
  const [, setDataVersion] = useState(0);

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
      const subskillRows = (item.atl || []).map((subskill) => {
        const packageWeight = Object.values(savedWeights.packages || {}).find((pkg) => pkg.title === item.kriteria)?.weights?.[subskill];
        const flatKey = `${item.kriteria} (${subskill})`;
        const weight = Number(packageWeight ?? savedWeights[flatKey] ?? savedWeights[subskill] ?? 0);
        return {
          subskill,
          weight,
          atl: subskillATLMap[subskill] || item.atlCategories?.[0] || "ATL",
        };
      });
      const dominant = subskillRows.slice().sort((a, b) => b.weight - a.weight)[0] || { subskill: "-", weight: 0, atl: "-" };
      const averageWeight = subskillRows.length
        ? subskillRows.reduce((sum, row) => sum + row.weight, 0) / subskillRows.length
        : 0;
      return {
        index,
        item,
        dominant,
        subskillRows,
        averageWeight,
      };
    });

    const distributionRaw = rows.reduce((acc, row) => {
      acc[row.dominant.atl] = (acc[row.dominant.atl] || 0) + row.dominant.weight;
      return acc;
    }, {});
    const total = Object.values(distributionRaw).reduce((sum, value) => sum + value, 0) || 1;
    const distribution = Object.entries(distributionRaw)
      .map(([atl, value]) => ({ atl, value: value / total }))
      .sort((a, b) => b.value - a.value);
    const dominantOverall = distribution[0] || { atl: "-", value: 0 };
    const donut = distribution.length
      ? `conic-gradient(${distribution.map((entry, index) => {
          const previous = distribution.slice(0, index).reduce((sum, item) => sum + item.value, 0) * 100;
          const next = previous + entry.value * 100;
          return `${getATLStyle(entry.atl).dot} ${previous}% ${next}%`;
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
                    onTopicChange={(id) => setSelectedTopic(id)}
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
                <button className="inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-4 py-2 text-xs font-black text-stone-700">
                  <span className="material-symbols-outlined text-[17px]">bar_chart</span>
                  Mode Lanjutan
                </button>
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
                  <span className="inline-flex rounded-full bg-primary/100 px-4 py-1 text-[11px] font-black uppercase tracking-widest text-white shadow-sm shadow-primary/20">
                    Weight Recap
                  </span>
                  <p className="mt-3 text-sm font-semibold text-stone-500">Ringkasan cepat hasil pembobotan ATL per kriteria.</p>

                  <div className="mt-4 rounded-2xl border border-primary/25 bg-primary/5 p-4">
                    <div className="flex gap-4">
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-primary">
                        <span className="material-symbols-outlined text-3xl">target</span>
                      </div>
                      <div>
                        <p className="text-[11px] font-black uppercase tracking-[0.16em] text-primary-hover">Pengertian Dominant ATL</p>
                        <p className="mt-1 text-sm leading-6 text-stone-700">
                          Dominant ATL adalah ATL yang memiliki pengaruh terbesar terhadap suatu kriteria berdasarkan bobot akhir tertinggi.
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
                          <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-stone-500">Dominant ATL</th>
                          <th className="px-4 py-3 text-center text-[10px] font-black uppercase tracking-widest text-stone-500">Bobot Akhir</th>
                          <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-stone-500">Kontribusi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-primary/10 bg-white">
                        {summaryData.rows.map((row) => {
                          const style = getATLStyle(row.dominant.atl);
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
                                <span className={`inline-flex rounded-lg border px-3 py-1 text-xs font-black ${style.chip}`}>{row.dominant.atl}</span>
                              </td>
                              <td className="px-4 py-3 text-center">
                                <span className="inline-flex min-w-[58px] justify-center rounded-lg bg-primary/10 px-3 py-1 text-base font-black text-primary">
                                  {row.dominant.weight.toFixed(2)}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-3">
                                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-stone-100">
                                    <div className="h-full rounded-full bg-primary/100" style={{ width: `${Math.min(row.dominant.weight * 100, 100)}%` }} />
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
                      Dominant ATL ditentukan berdasarkan bobot akhir tertinggi pada setiap kriteria.
                    </div>
                  </div>
                </section>

                <aside className="rounded-2xl border border-primary/25 bg-white p-5">
                  <p className="text-[11px] font-black uppercase tracking-widest text-primary-hover">Ringkasan Distribusi ATL</p>
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
                      <div key={entry.atl} className="flex items-center justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: getATLStyle(entry.atl).dot }} />
                          <span className="truncate text-xs font-black text-stone-800">{entry.atl}</span>
                        </div>
                        <span className="text-xs font-black text-stone-900">{entry.value.toFixed(2)} ({Math.round(entry.value * 100)}%)</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-7 rounded-2xl border border-primary/25 bg-primary/5 p-4">
                    <p className="text-xs font-black uppercase text-primary-hover">ATL Dominan Keseluruhan</p>
                    <p className="mt-2 text-xl font-black text-stone-900">{summaryData.dominantOverall.atl}</p>
                    <p className="mt-1 text-xs leading-5 text-stone-600">ATL ini paling berpengaruh secara keseluruhan pada seluruh kriteria penilaian.</p>
                  </div>
                </aside>
              </div>

              <div className="border-t border-primary/20 px-5 pb-5">
                <div className="mx-auto -mt-4 flex h-9 w-9 items-center justify-center rounded-full border border-primary/25 bg-white text-primary">
                  <span className="material-symbols-outlined">keyboard_arrow_down</span>
                </div>
                <div className="mt-2">
                  <span className="inline-flex rounded-full bg-primary/10 px-4 py-1 text-[11px] font-black uppercase tracking-widest text-primary-hover">
                    Detail Bobot per Subskill (Rubric Item)
                  </span>
                  <p className="mt-2 text-sm font-semibold text-stone-500">Distribusi bobot setiap subskill di dalam masing-masing kriteria.</p>
                </div>
                <div className="mt-5 grid gap-5 xl:grid-cols-3">
                  {summaryData.rows.map((row) => (
                    <article key={row.item.kriteria} className="rounded-2xl border border-primary/25 bg-white p-4 shadow-sm">
                      <div className="mb-4 flex items-start justify-between gap-3">
                        <div className="flex gap-3">
                          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                            <span className="material-symbols-outlined">music_note</span>
                          </span>
                          <div>
                            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-stone-400">{row.item.criteriaTopic || "Rubric"}</p>
                            <h3 className="mt-1 text-sm font-black text-stone-900">{row.item.kriteria}</h3>
                          </div>
                        </div>
                        <span className="rounded-lg bg-primary/10 px-2 py-1 text-[10px] font-black text-primary">
                          Avg W: {row.averageWeight.toFixed(2)}
                        </span>
                      </div>
                      <div className="mb-4 flex flex-wrap gap-2">
                        {(row.item.atlCategories || []).map((category) => (
                          <span key={category} className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase ${getATLStyle(category).chip}`}>
                            {category}
                          </span>
                        ))}
                      </div>
                      <div className="space-y-3">
                        {row.subskillRows.map((subskillRow) => (
                          <div key={subskillRow.subskill}>
                            <div className="mb-1 flex items-center justify-between gap-3">
                              <span className="truncate text-xs font-black text-stone-800">{subskillRow.subskill}</span>
                              <span className="rounded bg-primary/10 px-2 py-0.5 text-[11px] font-black text-primary">
                                W: {subskillRow.weight.toFixed(2)}
                              </span>
                            </div>
                            <div className="h-2 overflow-hidden rounded-full bg-stone-100">
                              <div className="h-full rounded-full bg-primary/100" style={{ width: `${Math.min(subskillRow.weight * 100, 100)}%` }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </article>
                  ))}
                </div>
                <div className="mt-5 grid gap-4 rounded-2xl border border-primary/25 bg-primary/5 p-4 text-xs text-stone-700 lg:grid-cols-3">
                  <p><strong>Metode:</strong> Fuzzy-AHP (Triangular Fuzzy Number)</p>
                  <p><strong>Sumber Penilaian:</strong> 3 Expert (Guru)</p>
                  <p><strong>Keterangan:</strong> Pairwise Comparison &rarr; Fuzzy Synthesis &rarr; Defuzzification &rarr; Consistency Check</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

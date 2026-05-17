import React, { useState, useMemo, useEffect } from "react";
import { dummyATL, saveATLData } from "./dummyATL";
import { calculateContextWeights, getCriteria, getWeights, saveWeights } from "../../services/atlApi";
import { getSubjectData } from "../../services/topicCatalog";

 const scaleOptions = [
  { label: "Sama penting", value: 1, tfn: [1, 1, 1] },
  { label: "Sedikit lebih penting", value: 3, tfn: [2, 3, 4] },
  { label: "Lebih penting", value: 5, tfn: [4, 5, 6] },
  { label: "Sangat lebih penting", value: 7, tfn: [6, 7, 8] },
  { label: "Mutlak lebih penting", value: 9, tfn: [8, 9, 9] },
 ];
 
 // TFN Helper Functions
const round = (n) => Math.round(n * 100) / 100;

const addTFN = (a, b) => [
  round(a[0] + b[0]), 
  round(a[1] + b[1]), 
  round(a[2] + b[2])
];

const inverseTFN = (a) => [
  round(1 / a[2]), 
  round(1 / a[1]), 
  round(1 / a[0])
];

const divideTFN = (a, b) => [
  round(a[0] / b[2]),
  round(a[1] / b[1]),
  round(a[2] / b[0]),
];

// Degree of Possibility
const degreePossibility = (M1, M2) => {
  const [l1, m1, u1] = M1;
  const [l2, m2, u2] = M2;

  // Case 1: pasti lebih besar
  if (m1 >= m2) return 1;

  // Case 2: pasti lebih kecil
  if (l2 >= u1) return 0;

  // Case 3: overlap → hitung rasio
  const numerator = l2 - u1;
  const denominator = (m1 - u1) - (m2 - l2);

  if (denominator === 0) return 0;

  const val = numerator / denominator;

  return Math.max(0, Math.min(1, round(val)));
};

// Helper to convert decimal to fraction string for display (specifically for TFN Matrix)
const toFraction = (val) => {
  if (val === 1) return "1";
  if (val < 1) {
    const denom = Math.round(1 / val);
    return `1/${denom}`;
  }
  return Math.round(val).toString();
};

const WEIGHT_PRECISION = 6;
const formatWeightDisplay = (weight) => Number(weight || 0).toFixed(2);
const riTable = { 1: 0, 2: 0, 3: 0.58, 4: 0.9, 5: 1.12, 6: 1.24, 7: 1.32, 8: 1.41, 9: 1.45, 10: 1.49 };
const calculateConsistencyRatio = (matrix) => {
  const n = matrix.length;
  if (n <= 2) return 0;
  const crisp = matrix.map((row) => row.map((cell) => cell[1]));
  const geometricMeans = crisp.map((row) => row.reduce((acc, value) => acc * Math.max(value, 0.000001), 1) ** (1 / n));
  const gmTotal = geometricMeans.reduce((acc, value) => acc + value, 0);
  const weights = gmTotal > 0 ? geometricMeans.map((value) => value / gmTotal) : Array(n).fill(1 / n);
  const weightedSums = crisp.map((row) => row.reduce((acc, value, index) => acc + value * weights[index], 0));
  const lambdaValues = weightedSums.map((value, index) => value / weights[index]).filter(Number.isFinite);
  const lambdaMax = lambdaValues.reduce((acc, value) => acc + value, 0) / lambdaValues.length;
  const ci = Math.max(0, (lambdaMax - n) / (n - 1));
  const ri = riTable[n] || 1.49;
  return ri === 0 ? 0 : Math.round((ci / ri) * 1000000) / 1000000;
};

// NOTE: calculateResult must live inside ExpertManagement so it can access component state.

const ExpertManagement = ({ onAddCriteriaClick, onTopicChange }) => {
  const [subjectData, setSubjectData] = useState(getSubjectData);
  const [step, setStep] = useState(1);
  const [selectedSubjectId, setSelectedSubjectId] = useState(getSubjectData()[0].id);
  const [selectedTopicId, setSelectedTopicId] = useState(getSubjectData()[0].topics[0].id);

  const [pairwise, setPairwise] = useState({});
  const [result, setResult] = useState(null);
  const [dataVersion, setDataVersion] = useState(0);

  const buildLocalResultFor = (criteriaList, pairwiseMap = {}) => {
    const n = criteriaList.length;
    if (n === 0) return null;

    // 1. Build matrix TFN nxn
    let matrix = Array(n).fill(0).map(() =>
      Array(n).fill([1, 1, 1])
    );

    // isi dari pairwise
    Object.values(pairwiseMap).forEach((val) => {
      const i = criteriaList.indexOf(val.left);
      const j = criteriaList.indexOf(val.right);

      const scaleObj = scaleOptions.find(s => s.label === val.scale);
      const tfn = scaleObj ? scaleObj.tfn : [1, 1, 1];

      if (i >= 0 && j >= 0) {
        matrix[i][j] = tfn;
        matrix[j][i] = inverseTFN(tfn);
      }
    });

    // 2. Sum per baris
    let rowSums = matrix.map(row =>
      row.reduce((acc, val) => addTFN(acc, val), [0,0,0])
    );

    // 3. Total semua
    let total = rowSums.reduce((acc, val) => addTFN(acc, val), [0,0,0]);

    // 4. Synthetic extent
    let S = rowSums.map(r => divideTFN(r, total));

    // 5. Degree of possibility matrix
    let V = Array(n).fill(0).map(() => Array(n).fill(0));

    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (i !== j) {
          V[i][j] = degreePossibility(S[i], S[j]);
        } else {
          V[i][j] = 1;
        }
      }
    }

    // 6. d vector (min tiap baris)
    let d = V.map(row => Math.min(...row));

    // 7. normalisasi (W)
    const sumD = d.reduce((a, b) => a + b, 0);
    let weights = {};

    // Normalisasi awal dari d-vector
    let normalizedWeights = [];
    if (sumD === 0) {
      normalizedWeights = Array(n).fill(1 / n);
    } else {
      normalizedWeights = d.map((val) => val / sumD);
    }

    const finalWeights = normalizedWeights;

    criteriaList.forEach((c, i) => {
      weights[c] = finalWeights[i].toFixed(WEIGHT_PRECISION);
    });

    return {
      weights,
      sumD: sumD.toFixed(2),
      consistency: calculateConsistencyRatio(matrix),
      debug: { matrix, rowSums, total, S, V, d: d.map(val => val.toFixed(2)) }
    };
  };

  const calculateResult = async () => {
    const packageResults = {};
    const flatWeights = {};
    rubricPackages.forEach((pkg) => {
      const localResult = buildLocalResultFor(pkg.subskills, pairwise[pkg.key] || {});
      if (!localResult) return;
      packageResults[pkg.key] = {
        ...localResult,
        title: pkg.title,
        criteriaTopic: pkg.criteriaTopic,
        subskills: pkg.subskills,
      };
      Object.entries(localResult.weights || {}).forEach(([subskill, weight]) => {
        flatWeights[`${pkg.title} (${subskill})`] = weight;
      });
    });

    const consistencyValues = Object.values(packageResults).map((item) => Number(item.consistency || 0));
    const firstPackage = Object.values(packageResults)[0];
    const localResult = {
      weights: flatWeights,
      packages: packageResults,
      consistency: consistencyValues.length ? Math.max(...consistencyValues) : 0,
      sumD: firstPackage?.sumD || "0.00",
      debug: firstPackage?.debug || { packages: packageResults },
    };

    if (Object.keys(packageResults).length === 0) return;

    setResult(localResult);
    try {
      const apiResult = await calculateContextWeights(selectedTopicId, {
        __criterionPackages: true,
        packages: packageResults,
        weights: flatWeights,
      });
      if (apiResult?.weights && Object.keys(apiResult.weights).length > 0) {
        setResult({ ...localResult, ...apiResult, packages: apiResult.packages || packageResults });
      }
    } catch (error) {
      setResult(localResult);
    }
  };

  const handleSaveToSystem = async () => {
    if (!result || !result.weights) return;
    
    if (!dummyATL.savedWeights) dummyATL.savedWeights = {};
    dummyATL.savedWeights[selectedTopicId] = {
      ...(result.weights || {}),
      __mode: "criterion-packages",
      packages: result.packages || {},
    };
    
    saveATLData(dummyATL);
    await saveWeights(selectedTopicId, dummyATL.savedWeights[selectedTopicId], result.debug || {});
    alert(`Bobot untuk topik ${selectedTopicId} berhasil disimpan secara permanen!`);
  };

  const rubricPackages = useMemo(() => {
    const rawData = dummyATL[selectedTopicId] || [];
    return rawData
      .filter((item) => Array.isArray(item.atl) && item.atl.length > 0)
      .map((item, index) => ({
        key: item.id ? `rubric-${item.id}` : `${item.kriteria}-${index}`,
        title: item.kriteria,
        criteriaTopic: item.criteriaTopic || "Rubric Evidence",
        categories: item.atlCategories || (item.category ? item.category.split(",").map((name) => name.trim()).filter(Boolean) : []),
        subskills: Array.from(new Set(item.atl || [])),
      }));
  }, [selectedTopicId, dataVersion]);

  const packagePairs = useMemo(() => (
    rubricPackages.reduce((acc, pkg) => {
      const pairs = [];
      for (let i = 0; i < pkg.subskills.length; i++) {
        for (let j = i + 1; j < pkg.subskills.length; j++) {
          pairs.push([pkg.subskills[i], pkg.subskills[j]]);
        }
      }
      acc[pkg.key] = pairs;
      return acc;
    }, {})
  ), [rubricPackages]);

  const totalPairCount = useMemo(
    () => Object.values(packagePairs).reduce((acc, pairs) => acc + pairs.length, 0),
    [packagePairs]
  );
  const filledPairCount = useMemo(
    () => Object.values(pairwise).reduce((acc, packagePairwise) => acc + Object.keys(packagePairwise || {}).length, 0),
    [pairwise]
  );
  const activeCriteriaForDebug = useMemo(
    () => rubricPackages.flatMap((pkg) => pkg.subskills),
    [rubricPackages]
  );
  const displayPackage = result?.packages ? Object.values(result.packages)[0] : null;
  const criteria = displayPackage?.subskills || activeCriteriaForDebug;

  // Reset pairwise jika subskill berubah
  useEffect(() => {
    setPairwise({});
    setResult(null);
  }, [rubricPackages]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getCriteria(selectedTopicId), getWeights(selectedTopicId)]).then(() => {
      if (!cancelled) setDataVersion((version) => version + 1);
    });
    return () => {
      cancelled = true;
    };
  }, [selectedTopicId]);

  useEffect(() => {
    const syncTopics = () => setSubjectData(getSubjectData());
    window.addEventListener("atl-topics-updated", syncTopics);
    return () => window.removeEventListener("atl-topics-updated", syncTopics);
  }, []);

  // Kalkulasi Real-time
  useEffect(() => {
    if (Object.keys(pairwise).length > 0) {
      calculateResult();
    }
  }, [pairwise]);

  // Notify parent about topic change for tracking
  useEffect(() => {
    if (onTopicChange) onTopicChange(selectedTopicId);
  }, [selectedTopicId, onTopicChange]);

  const steps = [
    { id: 1, name: "Context", icon: "hub" },
    { id: 2, name: "Subskill", icon: "list_alt" },
    { id: 3, name: "Pairwise", icon: "compare_arrows" },
    { id: 4, name: "Fuzzy Scale", icon: "query_stats" },
    { id: 5, name: "Result", icon: "analytics" },
  ];

  return (
    <div className="flex h-full min-h-[600px] gap-8">
      {/* LEFT SIDEBAR: STEP INDICATOR */}
      <div className="w-64 shrink-0 space-y-2 border-r border-stone-200 pr-6">
        <div className="mb-8 px-2">
          <h3 className="text-xs font-black uppercase tracking-widest text-stone-400">Workflow</h3>
          <p className="text-sm font-bold text-stone-900">Expert Configuration</p>
        </div>
        {steps.map((s) => (
          <button
            key={s.id}
            disabled={s.id > step && !result}
            onClick={() => setStep(s.id)}
            className={`group flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left transition-all ${
              step === s.id
                ? "bg-primary text-white shadow-lg shadow-primary/20"
                : "text-stone-500 hover:bg-stone-100"
            }`}
          >
            <span className="material-symbols-outlined text-lg">{s.icon}</span>
            <div className="flex flex-col">
              <span className="text-[10px] uppercase tracking-tighter opacity-80">Step {s.id}</span>
              <span className="text-sm font-bold">{s.name}</span>
            </div>
          </button>
        ))}
      </div>

      {/* MAIN CONTENT AREA */}
      <div className="flex flex-1 flex-col justify-between overflow-hidden py-2">
        <div className="flex-1 overflow-y-auto pr-4">
          {/* STEP 1: CONTEXT */}
          {step === 1 && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="mb-8">
                <div className="flex items-center gap-2 text-primary">
                  <span className="material-symbols-outlined">psychology</span>
                  <h2 className="text-xl font-black text-stone-900 uppercase tracking-tight">Expert Configuration — Fuzzy AHP</h2>
                </div>
                <p className="mt-2 text-sm text-stone-500 italic">Bobot akan disimpan khusus untuk topik dan mata pelajaran ini guna menjaga relevansi penilaian.</p>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-stone-500 flex items-center gap-1">
                    Mata Pelajaran <span className="material-symbols-outlined text-xs cursor-help" title="Mata pelajaran induk">info</span>
                  </label>
                  <select
                    className="w-full rounded-2xl border-2 border-stone-100 bg-stone-50 px-4 py-4 font-bold text-stone-900 outline-none transition-all focus:border-primary focus:bg-white focus:ring-4 focus:ring-primary/10"
                    value={selectedSubjectId}
                    onChange={(e) => {
                      setSelectedSubjectId(e.target.value);
                      setSelectedTopicId(subjectData.find(s => s.id === e.target.value).topics[0].id);
                    }}
                  >
                    {subjectData.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-stone-500">Sub Topik</label>
                  <select
                    className="w-full rounded-2xl border-2 border-stone-100 bg-stone-50 px-4 py-4 font-bold text-stone-900 outline-none transition-all focus:border-primary focus:bg-white focus:ring-4 focus:ring-primary/10"
                    value={selectedTopicId}
                    onChange={(e) => setSelectedTopicId(e.target.value)}
                  >
                    {subjectData.find(s => s.id === selectedSubjectId)?.topics.map(t => (
                      <option key={t.id} value={t.id}>{t.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: SUBSKILL */}
          {step === 2 && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <h2 className="mb-2 text-xl font-black text-stone-900">Paket Pairwise per Criterion dalam Topik "{subjectData.find(s => s.id === selectedSubjectId)?.topics.find(t => t.id === selectedTopicId)?.label}"</h2>
              <p className="mb-6 text-sm font-semibold text-stone-500">
                Setiap rubric criterion menjadi evidence package sendiri. Pairwise hanya membandingkan ATL subskill yang relevan di dalam criterion tersebut.
              </p>
              <div className="grid gap-4 md:grid-cols-3">
                {rubricPackages.map((pkg) => (
                  <div key={pkg.key} className="group relative overflow-hidden rounded-2xl border-2 border-stone-100 bg-white p-6 shadow-sm transition-all hover:border-primary/50 hover:shadow-md">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-black text-stone-800">{pkg.title}</span>
                      <div className="h-6 w-6 rounded-full bg-emerald-500 flex items-center justify-center text-white">
                        <span className="material-symbols-outlined text-sm font-bold">check</span>
                      </div>
                    </div>
                    <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-stone-400">{pkg.criteriaTopic}</p>
                    <p className="mt-4 text-[10px] font-bold uppercase tracking-widest text-stone-400">ATL Subskill dalam Paket</p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {pkg.subskills.map((atlSkill, idx) => (
                        <span key={idx} className="inline-flex items-center rounded-full bg-blue-50 px-2 py-1 text-[9px] font-bold text-blue-700">
                          {atlSkill}
                        </span>
                      )) || []}
                    </div>
                  </div>
                ))}
                <button onClick={onAddCriteriaClick} className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-stone-200 p-6 text-stone-400 transition-all hover:border-primary hover:text-primary">
                  <span className="material-symbols-outlined text-2xl">add_circle</span>
                  <span className="mt-2 text-xs font-bold uppercase">Tambah Kriteria</span>
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: PAIRWISE (CORE UI) */}
          {step === 3 && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-12">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-black text-stone-900 italic underline decoration-primary decoration-4 underline-offset-4">Criterion Package Comparison</h2>
                  <p className="text-xs text-stone-500 mt-2 font-bold">Setiap blok di bawah adalah 1 paket pairwise untuk 1 rubric criterion.</p>
                </div>
                <span className="p-4 bg-primary/5 rounded-2xl border border-primary/20">
                  <p className="text-[10px] font-black uppercase text-primary tracking-widest mb-1 text-right">Real-time Status</p>
                  <p className="text-sm font-black text-stone-900">
                    {filledPairCount} / {totalPairCount} Perbandingan Terisi
                  </p>
                </span>
              </div>

              <div className="space-y-12 pb-12">
                {rubricPackages.map((pkg, packageIndex) => (
                  <section key={pkg.key} className="rounded-[2rem] border-2 border-stone-100 bg-white p-6 shadow-sm">
                    <div className="mb-8 flex flex-col gap-3 border-b border-stone-100 pb-5 md:flex-row md:items-center md:justify-between">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Paket {packageIndex + 1} - {pkg.criteriaTopic}</p>
                        <h3 className="mt-1 text-lg font-black text-stone-900">{pkg.title}</h3>
                        <p className="mt-1 text-xs font-semibold text-stone-500">Evidence source ini punya {pkg.subskills.length} ATL subskill relevan.</p>
                      </div>
                      <span className="rounded-full bg-stone-100 px-3 py-1 text-[10px] font-black uppercase text-stone-600">
                        {(pairwise[pkg.key] && Object.keys(pairwise[pkg.key]).length) || 0}/{packagePairs[pkg.key]?.length || 0} pair
                      </span>
                    </div>

                    <div className="space-y-10">
                      {(packagePairs[pkg.key] || []).map(([c1, c2], idx) => (
                  <div key={`${pkg.key}-${idx}`} className="relative flex flex-col items-center">
                    <div className="mb-8 flex w-full items-center justify-between px-8">
                      <div className="text-center w-1/3">
                        <span className="block text-[10px] font-black uppercase text-stone-400 mb-2 tracking-tighter">Subskill A</span>
                        <h4 className="text-lg font-black text-stone-900 underline decoration-stone-200 mb-2">{c1}</h4>
                      </div>
                      <div className="flex-1 flex items-center justify-center px-4">
                        <div className="h-px w-full bg-gradient-to-r from-transparent via-stone-200 to-transparent relative">
                          <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-stone-50 px-3 text-xs font-black text-stone-400">VS</span>
                        </div>
                      </div>
                      <div className="text-center w-1/3">
                        <span className="block text-[10px] font-black uppercase text-stone-400 mb-2 tracking-tighter">Subskill B</span>
                        <h4 className="text-lg font-black text-stone-900 underline decoration-stone-200 mb-2">{c2}</h4>
                      </div>
                    </div>

                    <div className="grid w-full grid-cols-5 gap-3">
                      {scaleOptions.map((opt) => {
                        const isActive = pairwise[pkg.key]?.[idx]?.scale === opt.label;
                        return (
                          <button
                            key={opt.label}
                            onClick={() => setPairwise({
                              ...pairwise,
                              [pkg.key]: {
                                ...(pairwise[pkg.key] || {}),
                                [idx]: { left: c1, right: c2, scale: opt.label },
                              },
                            })}
                            className={`group relative flex flex-col items-center rounded-[2rem] border-2 p-5 transition-all duration-300 ${
                              isActive
                                ? "border-primary bg-primary/10 shadow-xl shadow-primary/10 -translate-y-1"
                                : "border-stone-100 bg-white hover:border-stone-300"
                            }`}
                          >
                            <div className={`mb-3 flex h-8 w-8 items-center justify-center rounded-full transition-all ${
                              isActive ? "bg-primary text-white" : "bg-stone-100 text-stone-400"
                            }`}>
                              <span className="text-xs font-black">{isActive ? "✓" : ""}</span>
                            </div>
                            <p className={`text-center text-[11px] font-black uppercase leading-tight tracking-tighter ${isActive ? "text-primary" : "text-stone-500"}`}>
                              {opt.label}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            </div>
          )}

          {/* STEP 4: ADVANCED ANALYTICS */}
          {step === 4 && (() => {
            const packageEntries = Object.entries(result?.packages || {});
            const [activePackageKey, activePackage] = packageEntries[0] || [];
            const traceRows = Object.values(pairwise?.[activePackageKey] || {}).slice(0, 5);
            const weightEntries = Object.entries(activePackage?.weights || {});
            const dominantEntry = weightEntries.reduce(
              (best, entry) => (Number(entry[1]) > Number(best?.[1] || 0) ? entry : best),
              weightEntries[0]
            );
            const subskills = activePackage?.subskills || [];
            const matrix = activePackage?.debug?.matrix || [];
            const consistency = Number(activePackage?.consistency || result?.consistency || 0);

            return (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                  <div>
                    <span className="inline-flex rounded-full bg-gradient-to-r from-violet-500 to-purple-500 px-4 py-1.5 text-[11px] font-black uppercase tracking-widest text-white shadow-lg shadow-violet-200">
                      Mode 2 - Advanced Analytics
                    </span>
                    <p className="mt-2 text-sm font-semibold text-stone-500">
                      Analisis mendalam proses Fuzzy-AHP per criterion package.
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setStep(5)}
                      className="inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-4 py-2 text-xs font-black text-stone-700 transition-all hover:border-primary/40 hover:bg-primary/5"
                    >
                      <span className="material-symbols-outlined text-[16px]">arrow_back</span>
                      Kembali ke Result
                    </button>
                    <button
                      type="button"
                      className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-black text-emerald-700"
                    >
                      <span className="material-symbols-outlined text-[16px]">ios_share</span>
                      Export Detail
                    </button>
                  </div>
                </div>

                <div className="grid gap-4 xl:grid-cols-5">
                  <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
                    <h3 className="mb-1 flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-stone-700">
                      <span className="flex h-5 w-5 items-center justify-center rounded bg-emerald-500 text-[10px] text-white">1</span>
                      Full Weight Breakdown
                    </h3>
                    <p className="mb-4 text-[11px] font-semibold text-stone-500">
                      Bobot lokal untuk {activePackage?.title || "criterion terpilih"}.
                    </p>
                    <div className="overflow-hidden rounded-xl border border-stone-100">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-stone-50 text-[10px] uppercase tracking-widest text-stone-500">
                          <tr>
                            <th className="px-3 py-2">ATL</th>
                            <th className="px-3 py-2 text-center">Weight</th>
                            <th className="px-3 py-2 text-center">Rank</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-stone-100">
                          {weightEntries.length > 0 ? weightEntries.map(([name, weight], index) => (
                            <tr key={name}>
                              <td className="px-3 py-2 font-black text-stone-800">{name}</td>
                              <td className="px-3 py-2 text-center font-mono font-black text-primary">{formatWeightDisplay(weight)}</td>
                              <td className="px-3 py-2 text-center">
                                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-amber-100 text-[10px] font-black text-amber-700">
                                  {index + 1}
                                </span>
                              </td>
                            </tr>
                          )) : (
                            <tr><td colSpan="3" className="px-3 py-6 text-center text-stone-400">Belum ada hasil.</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                    <div className={`mt-4 rounded-xl px-3 py-2 text-[11px] font-black ${
                      consistency < 0.1 ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
                    }`}>
                      Consistency Ratio (CR): {consistency.toFixed(2)}
                    </div>
                  </section>

                  <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
                    <h3 className="mb-1 flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-stone-700">
                      <span className="flex h-5 w-5 items-center justify-center rounded bg-emerald-500 text-[10px] text-white">2</span>
                      Pairwise Trace
                    </h3>
                    <p className="mb-4 text-[11px] font-semibold text-stone-500">Jejak perbandingan pada paket aktif.</p>
                    <div className="space-y-2">
                      {traceRows.length > 0 ? traceRows.map((row, index) => (
                        <div key={`${row.left}-${row.right}-${index}`} className="rounded-xl border border-stone-100 bg-stone-50 p-3">
                          <p className="text-xs font-black text-stone-800">{row.left} &gt; {row.right}</p>
                          <p className="mt-1 text-[11px] font-bold text-primary">{row.scale}</p>
                        </div>
                      )) : (
                        <div className="rounded-xl border border-dashed border-stone-200 p-6 text-center text-xs font-semibold text-stone-400">
                          Lengkapi pairwise untuk melihat trace.
                        </div>
                      )}
                    </div>
                    <p className="mt-3 rounded-xl bg-blue-50 px-3 py-2 text-[11px] font-bold text-blue-700">
                      Total comparison valid: {traceRows.length}/{packagePairs?.[activePackageKey]?.length || 0}
                    </p>
                  </section>

                  <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
                    <h3 className="mb-1 flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-stone-700">
                      <span className="flex h-5 w-5 items-center justify-center rounded bg-emerald-500 text-[10px] text-white">3</span>
                      Fuzzy Detail
                    </h3>
                    <p className="mb-4 text-[11px] font-semibold text-stone-500">Contoh detail perhitungan untuk ATL dominan.</p>
                    <div className="rounded-xl border border-stone-100 bg-stone-50 p-4">
                      <p className="text-[10px] font-black uppercase tracking-widest text-stone-500">Pilih ATL</p>
                      <p className="mt-1 text-sm font-black text-stone-900">{dominantEntry?.[0] || "-"}</p>
                    </div>
                    <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                      {["Lower", "Middle", "Upper"].map((label, index) => (
                        <div key={label} className="rounded-xl border border-stone-100 bg-white p-3">
                          <p className="text-[10px] font-black uppercase text-stone-400">{label}</p>
                          <p className="mt-1 font-mono text-sm font-black text-stone-900">
                            {activePackage?.debug?.S?.[0]?.[index]?.toFixed(2) || "0.00"}
                          </p>
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 rounded-xl border border-violet-100 bg-violet-50 p-4">
                      <p className="text-[10px] font-black uppercase tracking-widest text-violet-500">Hasil Akhir</p>
                      <p className="mt-1 text-2xl font-black text-violet-700">{formatWeightDisplay(dominantEntry?.[1])}</p>
                    </div>
                  </section>

                  <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
                    <h3 className="mb-1 flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-stone-700">
                      <span className="flex h-5 w-5 items-center justify-center rounded bg-emerald-500 text-[10px] text-white">4</span>
                      Inference Graph
                    </h3>
                    <p className="mb-4 text-[11px] font-semibold text-stone-500">Alur pengaruh ATL dalam satu criterion.</p>
                    <div className="relative h-56 rounded-2xl bg-stone-50">
                      {weightEntries.slice(0, 5).map(([name, weight], index) => {
                        const positions = [
                          "left-[35%] top-4 bg-amber-100 text-amber-700",
                          "left-4 top-[44%] bg-emerald-100 text-emerald-700",
                          "right-4 top-[44%] bg-blue-100 text-blue-700",
                          "left-[20%] bottom-4 bg-violet-100 text-violet-700",
                          "right-[20%] bottom-4 bg-teal-100 text-teal-700",
                        ];
                        return (
                          <div
                            key={name}
                            className={`absolute flex h-20 w-24 flex-col items-center justify-center rounded-full border border-white text-center shadow-sm ${positions[index] || positions[0]}`}
                          >
                            <span className="material-symbols-outlined text-[18px]">hub</span>
                            <span className="mt-1 line-clamp-2 px-2 text-[10px] font-black">{name}</span>
                            <span className="text-[10px] font-mono">({formatWeightDisplay(weight)})</span>
                          </div>
                        );
                      })}
                      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 260 220">
                        <path d="M130 62 C80 80 55 105 48 132" fill="none" stroke="#a78bfa" strokeWidth="2" strokeDasharray="5 4" />
                        <path d="M130 62 C180 80 205 105 212 132" fill="none" stroke="#a78bfa" strokeWidth="2" />
                        <path d="M80 140 C105 165 120 178 130 188" fill="none" stroke="#a78bfa" strokeWidth="2" strokeDasharray="5 4" />
                        <path d="M180 140 C155 165 140 178 130 188" fill="none" stroke="#a78bfa" strokeWidth="2" />
                      </svg>
                    </div>
                  </section>

                  <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
                    <h3 className="mb-1 flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-stone-700">
                      <span className="flex h-5 w-5 items-center justify-center rounded bg-emerald-500 text-[10px] text-white">5</span>
                      Heatmap Comparison
                    </h3>
                    <p className="mb-4 text-[11px] font-semibold text-stone-500">Intensitas pairwise antar ATL.</p>
                    <div className="overflow-auto rounded-xl border border-stone-100">
                      <table className="w-full min-w-[260px] text-center text-[11px]">
                        <thead className="bg-stone-50 text-[10px] uppercase text-stone-500">
                          <tr>
                            <th className="px-2 py-2"></th>
                            {subskills.map((name) => <th key={name} className="px-2 py-2">{name.slice(0, 3)}</th>)}
                          </tr>
                        </thead>
                        <tbody>
                          {subskills.map((rowName, rowIndex) => (
                            <tr key={rowName} className="border-t border-stone-100">
                              <td className="px-2 py-2 font-black text-stone-700">{rowName.slice(0, 3)}</td>
                              {subskills.map((_, colIndex) => {
                                const cell = matrix?.[rowIndex]?.[colIndex];
                                const middle = Array.isArray(cell) ? Number(cell[1]) : 1;
                                const intensity = Math.min(Math.max(middle / 9, 0.08), 1);
                                return (
                                  <td
                                    key={`${rowName}-${colIndex}`}
                                    className="px-2 py-2 font-mono font-bold text-stone-800"
                                    style={{ backgroundColor: `rgba(124, 58, 237, ${intensity})`, color: intensity > 0.55 ? "white" : undefined }}
                                  >
                                    {toFraction(middle)}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="mt-4 h-2 rounded-full bg-gradient-to-r from-violet-100 via-violet-400 to-violet-800" />
                    <div className="mt-1 flex justify-between text-[10px] font-bold text-stone-400">
                      <span>Lemah</span>
                      <span>Sangat kuat</span>
                    </div>
                  </section>
                </div>
              </div>
            );
          })()}

          {/* STEP 4: FUZZY SCALE */}
          {false && step === 4 && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-8">
              <div className="mb-2">
                <h2 className="text-2xl font-black text-stone-900">Mathematical Calculation Flow</h2>
                <p className="text-sm text-stone-500 mt-2 leading-relaxed max-w-3xl">
                  Bagian ini menunjukkan transformasi data dari pilihan verbal yang Anda masukkan menjadi bobot matematis menggunakan logika 
                  <strong> Chang's Extent Analysis</strong>. Ikuti langkah-langkah di bawah untuk memahami bagaimana sistem memproses subskill ATL Anda.
                </p>
              </div>

              <div className="rounded-[2rem] border-2 border-stone-100 bg-white p-8 shadow-xl shadow-stone-200/50">
                {result?.debug ? (
                  <div className="space-y-12">
                    <section>
                      <h3 className="flex items-center gap-3 text-sm font-black uppercase tracking-widest text-primary mb-4">
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-[10px] text-white">01</span>
                        Matriks Triangular Fuzzy Number (TFN)
                      </h3>
                      <p className="text-sm text-stone-600 mb-6 leading-relaxed">
                        Langkah pertama adalah mengubah input kualitatif Anda menjadi angka fuzzy segitiga (L, M, U). 
                        Nilai di bawah diagonal utama merupakan nilai kebalikan (reciprocal) otomatis untuk menjaga konsistensi.
                      </p>
                      <div className="overflow-x-auto rounded-2xl border border-stone-100 bg-stone-50/50">
                        <table className="min-w-full divide-y divide-stone-200">
                          <thead className="bg-stone-100/50">
                            <tr>
                              <th className="px-4 py-4 text-left text-[10px] font-bold uppercase tracking-widest text-stone-500">Subskill</th>
                              {criteria.map((crit) => (
                                <th key={crit} className="px-4 py-4 text-center text-[10px] font-bold uppercase tracking-widest text-stone-500">{crit}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-stone-100 bg-white">
                            {criteria.map((rowCrit, rowIndex) => (
                              <tr key={rowCrit} className="hover:bg-stone-50 transition-colors">
                                <td className="px-4 py-4 whitespace-nowrap text-sm font-bold text-stone-900 bg-stone-50/30">{rowCrit}</td>
                                {criteria.map((colCrit, colIndex) => {
                                  const tfn = result.debug.matrix[rowIndex][colIndex];
                                  return (
                                    <td key={colCrit} className="px-4 py-4 whitespace-nowrap text-center text-sm font-mono text-stone-600">
                                      ({toFraction(tfn[0])}, {toFraction(tfn[1])}, {toFraction(tfn[2])})
                                    </td>
                                  );
                                })}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </section>

                    <section>
                      <h3 className="flex items-center gap-3 text-sm font-black uppercase tracking-widest text-primary mb-4">
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-[10px] text-white">02</span>
                        Akumulasi Bobot per Subskill (Row Sums)
                      </h3>
                      <p className="text-sm text-stone-600 mb-6 leading-relaxed">
                        Sistem menjumlahkan seluruh nilai TFN pada setiap baris untuk melihat total intensitas kepentingan setiap subskill 
                        relatif terhadap subskill lainnya.
                      </p>
                      <div className="overflow-x-auto rounded-2xl border border-stone-100 bg-stone-50/50">
                        <table className="min-w-full divide-y divide-stone-200">
                          <thead className="bg-stone-100/50">
                            <tr>
                              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-stone-500">Subskill</th>
                              <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-stone-500">Jumlah TFN</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-stone-200 bg-white">
                            {criteria.map((crit, idx) => (
                              <tr key={crit} className="hover:bg-stone-50 transition-colors">
                                <td className="px-4 py-3 whitespace-nowrap text-sm font-bold text-stone-900">{crit}</td>
                                <td className="px-4 py-3 whitespace-nowrap text-center text-sm font-mono text-stone-700">
                                  ({result.debug.rowSums[idx][0].toFixed(2)}, {result.debug.rowSums[idx][1].toFixed(2)}, {result.debug.rowSums[idx][2].toFixed(2)})
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </section>

                    <section className="bg-stone-50 p-8 rounded-[2rem] border border-stone-200">
                      <h3 className="flex items-center gap-3 text-sm font-black uppercase tracking-widest text-primary mb-4">
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-[10px] text-white">03</span>
                        Total Nilai Fuzzy Keseluruhan
                      </h3>
                      <p className="text-sm text-stone-600 mb-6 leading-relaxed">
                        Seluruh Row Sums dijumlahkan untuk mendapatkan nilai total fuzzy. Nilai ini akan menjadi pembagi (denominator) 
                        untuk menentukan nilai sintetis di langkah berikutnya.
                      </p>
                      <div className="flex flex-col items-center justify-center p-6 bg-white rounded-2xl border-2 border-primary/20 shadow-inner">
                        <span className="text-[10px] font-black text-stone-400 uppercase tracking-[0.2em] mb-2">Total Akumulasi</span>
                        <div className="text-2xl font-mono font-black text-stone-900">
                          ({result.debug.total[0].toFixed(2)}, {result.debug.total[1].toFixed(2)}, {result.debug.total[2].toFixed(2)})
                        </div>
                      </div>
                    </section>

                    <section>
                      <h3 className="flex items-center gap-3 text-sm font-black uppercase tracking-widest text-primary mb-4">
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-[10px] text-white">04</span>
                        Perhitungan Nilai Sintetis Fuzzy (S_i)
                      </h3>
                      <p className="text-sm text-stone-600 mb-6 leading-relaxed">
                        Setiap <strong>Row Sum</strong> dibagi dengan <strong>Total Nilai Fuzzy</strong> (dengan urutan L, M, U yang dibalik pada pembagi) 
                        untuk mendapatkan <i>Synthetic Extent</i> dari masing-masing subskill.
                      </p>
                      <div className="overflow-x-auto rounded-2xl border border-stone-100 bg-stone-50/50">
                        <table className="min-w-full divide-y divide-stone-200">
                          <thead className="bg-stone-100/50">
                            <tr>
                              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-stone-500">Subskill</th>
                              <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-stone-500">S_i</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-stone-200 bg-white">
                            {criteria.map((crit, idx) => (
                              <tr key={crit} className="hover:bg-stone-50 transition-colors">
                                <td className="px-4 py-3 whitespace-nowrap text-sm font-bold text-stone-900">{crit}</td>
                                <td className="px-4 py-3 whitespace-nowrap text-center text-sm font-mono text-stone-700">
                                  ({result.debug.S[idx][0].toFixed(2)}, {result.debug.S[idx][1].toFixed(2)}, {result.debug.S[idx][2].toFixed(2)})
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </section>

                    <section className="border-t border-stone-100 pt-8">
                      <h3 className="flex items-center gap-3 text-sm font-black uppercase tracking-widest text-primary mb-4">
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-[10px] text-white">05</span>
                        Komparasi Derajat Kemungkinan (Vector d)
                      </h3>
                      <p className="text-sm text-stone-600 leading-relaxed italic">
                        Pada tahap ini, setiap nilai S_i dibandingkan satu sama lain untuk melihat kemungkinan suatu subskill lebih besar dari subskill lainnya. 
                        Hasil dari perbandingan ini adalah nilai minimum dari derajat kemungkinan yang akan dinormalisasi pada tahap <strong>Result</strong>.
                      </p>
                    </section>
                  </div>
                ) : (
                  <div className="rounded-3xl border border-stone-200 bg-stone-50 p-8 text-stone-600">
                    Lengkapi semua perbandingan pairwise untuk melihat langkah-langkah perhitungan Fuzzy AHP di sini.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STEP 5: RESULT & VALIDATION */}
          {step === 5 && result && (
            <div className="animate-in zoom-in-95 duration-500 space-y-10">
              {result.packages && (
                <div className="rounded-[2.5rem] border-2 border-stone-100 bg-white p-8 shadow-xl shadow-stone-200/50">
                  <h2 className="mb-3 flex items-center gap-2 text-xl font-black uppercase tracking-tight text-stone-900">
                    <span className="material-symbols-outlined text-primary">inventory_2</span>
                    Bobot per Criterion Package
                  </h2>
                  <p className="mb-6 text-sm leading-relaxed text-stone-600">
                    Bobot ini lokal untuk setiap evidence source. Criterion yang berbeda boleh punya dominasi ATL yang berbeda.
                  </p>
                  <div className="grid gap-5 lg:grid-cols-2">
                    {Object.entries(result.packages).map(([packageKey, pkg]) => (
                      <section key={packageKey} className="rounded-2xl border border-stone-200 bg-stone-50/60 p-5">
                        <div className="mb-4 flex items-start justify-between gap-3">
                          <div>
                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">{pkg.criteriaTopic}</p>
                            <h3 className="mt-1 text-base font-black text-stone-900">{pkg.title}</h3>
                          </div>
                          <span className={`shrink-0 rounded-full px-3 py-1 text-[10px] font-black uppercase ${pkg.consistency < 0.1 ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
                            CR {pkg.consistency}
                          </span>
                        </div>
                        <div className="space-y-3">
                          {Object.entries(pkg.weights || {}).map(([subskill, weight]) => (
                            <div key={subskill}>
                              <div className="mb-1 flex items-center justify-between gap-3">
                                <span className="min-w-0 truncate text-xs font-bold text-stone-700">{subskill}</span>
                                <span className="rounded bg-primary/10 px-2 py-0.5 text-[10px] font-black text-primary">{formatWeightDisplay(weight)}</span>
                              </div>
                              <div className="h-2 overflow-hidden rounded-full bg-white">
                                <div className="h-full bg-primary" style={{ width: `${Math.min(Number(weight || 0) * 100, 100)}%` }} />
                              </div>
                            </div>
                          ))}
                        </div>
                      </section>
                    ))}
                  </div>
                </div>
              )}
              <div className="rounded-[2.5rem] border-2 border-stone-100 bg-white p-10 shadow-xl shadow-stone-200/50">
                <div className="flex flex-col gap-8 lg:flex-row">
                  <div className="flex-1">
                    <h2 className="mb-4 text-xl font-black text-stone-900 uppercase tracking-tight flex items-center gap-2">
                      <span className="material-symbols-outlined text-primary">analytics</span> Hasil Bobot Penilaian
                    </h2>
                    <p className="mb-8 text-sm text-stone-600 leading-relaxed">
                      Berdasarkan perbandingan berpasangan yang telah dilakukan, subskill di bawah ini telah dikonversi menjadi bobot prioritas. 
                      Bobot ini menentukan seberapa besar pengaruh sebuah subskill terhadap total nilai ATL siswa pada topik 
                      <strong> {subjectData.find(s => s.id === selectedSubjectId)?.topics.find(t => t.id === selectedTopicId)?.label}</strong>.
                    </p>
                    
                    <div className="space-y-6">
                      {result.weights && Object.entries(result.weights).map(([k, v]) => (
                        <div key={k} className="space-y-2">
                          <div className="flex items-end justify-between">
                            <span className="text-sm font-black text-stone-800">{k}</span>
                            <span className="text-xs font-black text-primary bg-primary/10 px-2 py-0.5 rounded-md">{formatWeightDisplay(v)}</span>
                          </div>
                          <div className="h-3 w-full overflow-hidden rounded-full bg-stone-100">
                            <div 
                              className="h-full bg-gradient-to-r from-primary to-yellow-400 transition-all duration-1000" 
                              style={{ width: `${parseFloat(v) * 100}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* NEW VISUALIZATION: RADAR CHART */}
                  <div className="flex w-full flex-col items-center justify-center rounded-[2rem] border border-stone-100 bg-stone-50/50 p-6 lg:w-[350px]">
                    <p className="mb-6 text-[10px] font-black uppercase tracking-[0.2em] text-stone-400">ATL Weight Profile</p>
                    <div className="relative h-64 w-64">
                      <svg viewBox="0 0 100 100" className="h-full w-full drop-shadow-md">
                        {/* Circles background */}
                        {[0.2, 0.4, 0.6, 0.8, 1].map((r) => (
                          <circle key={r} cx="50" cy="50" r={r * 40} fill="none" stroke="#e7e5e4" strokeWidth="0.5" strokeDasharray="2 2" />
                        ))}
                        {/* Axis */}
                        {criteria.map((_, i) => {
                          const angle = (i * 2 * Math.PI) / criteria.length - Math.PI / 2;
                          return (
                            <line key={i} x1="50" y1="50" x2={50 + 40 * Math.cos(angle)} y2={50 + 40 * Math.sin(angle)} stroke="#e7e5e4" strokeWidth="0.5" />
                          );
                        })}
                        {/* Radar Polygon */}
                        <polygon
                          points={criteria.map((c, i) => {
                            const angle = (i * 2 * Math.PI) / criteria.length - Math.PI / 2;
                            const radarWeights = displayPackage?.weights || result.weights || {};
                            const r = (parseFloat(radarWeights[c]) / Math.max(...Object.values(radarWeights).map(Number)) || 0) * 40;
                            return `${50 + r * Math.cos(angle)},${50 + r * Math.sin(angle)}`;
                          }).join(" ")}
                          fill="rgba(234, 179, 8, 0.2)"
                          stroke="#EAB308"
                          strokeWidth="2"
                        />
                      </svg>
                    </div>
                    <p className="mt-4 text-center text-[10px] leading-relaxed text-stone-500 italic">
                      Visualisasi di atas menunjukkan keseimbangan prioritas antar subskill ATL yang terpilih.
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-[2.5rem] border-2 border-stone-100 bg-white p-10 shadow-xl shadow-stone-200/50">
                <h2 className="mb-8 text-xl font-black text-stone-900 uppercase tracking-tight flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">grid_on</span> Matriks Derajat Kemungkinan (V)
                </h2>
                <p className="mb-6 text-sm text-stone-600">
                  Tabel ini membandingkan setiap pasangan <i>Synthetic Extent</i> (S_i) untuk menentukan probabilitas subskill satu lebih dominan dari subskill lainnya.
                </p>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-stone-200">
                    <thead className="bg-stone-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-stone-500">S_i \ S_j</th>
                        {criteria.map((crit) => (
                          <th key={crit} className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-stone-500">{crit}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-200 bg-white">
                      {criteria.map((rowCrit, idx) => (
                        <tr key={rowCrit}>
                          <td className="px-4 py-3 whitespace-nowrap text-sm font-bold text-stone-900">{rowCrit}</td>
                          {criteria.map((colCrit, colIdx) => (
                            <td key={colCrit} className="px-4 py-3 whitespace-nowrap text-center text-sm font-mono text-stone-700">
                              {result.debug.V[idx][colIdx].toFixed(2)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="rounded-[2.5rem] border-2 border-stone-100 bg-white p-10 shadow-xl shadow-stone-200/50">
                <h2 className="mb-8 text-xl font-black text-stone-900 uppercase tracking-tight flex items-center gap-2">
                   <span className="material-symbols-outlined text-primary">calculate</span> Vektor d & Normalisasi
                </h2>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-stone-200">
                    <thead className="bg-stone-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-stone-500">Subskill</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-stone-500">Vektor d (Min)</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-stone-500">Bobot (W)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-200 bg-white">
                      {criteria.map((crit, idx) => {
                        const weight = result.weights[crit] || displayPackage?.weights?.[crit];
                        return (
                          <tr key={crit}>
                            <td className="px-4 py-3 whitespace-nowrap text-sm font-bold text-stone-900">{crit}</td>
                            <td className="px-4 py-3 whitespace-nowrap text-center text-sm font-mono text-stone-700">
                              {result.debug.d[idx]}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-center text-sm font-bold text-primary">
                              {formatWeightDisplay(weight)}
                            </td>
                          </tr>
                        );
                      })}
                      <tr className="bg-stone-50 font-black">
                        <td className="px-4 py-3 text-sm text-stone-900">TOTAL</td>
                        <td className="px-4 py-3 text-center text-sm font-mono text-stone-900">{result.sumD}</td>
                        <td className="px-4 py-3 text-center text-sm text-primary">1.00</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div className={`rounded-3xl border-2 p-6 flex items-center justify-between transition-all ${
                result.consistency < 0.1 ? "border-emerald-200 bg-emerald-50" : "border-rose-200 bg-rose-50"
              }`}>
                <div className="flex items-center gap-4">
                  <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${
                    result.consistency < 0.1 ? "bg-emerald-500 text-white" : "bg-rose-500 text-white"
                  }`}>
                    <span className="material-symbols-outlined">{result.consistency < 0.1 ? "verified" : "warning"}</span>
                  </div>
                  <div>
                    <h4 className={`text-lg font-black ${result.consistency < 0.1 ? "text-emerald-900" : "text-rose-900"}`}>
                      Consistency Ratio: {result.consistency}
                    </h4>
                    <p className={`text-sm font-bold ${result.consistency < 0.1 ? "text-emerald-600" : "text-rose-600"}`}>
                      {result.consistency < 0.1 ? "✅ Model Konsisten & Siap Digunakan" : "⚠️ Konsistensi rendah, silakan perbaiki Pairwise"}
                    </p>
                  </div>
                </div>
                {result.consistency < 0.1 && (
                  <span className="material-symbols-outlined text-4xl text-emerald-300">check_circle</span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* BOTTOM ACTION BUTTONS */}
        <div className="mt-6 flex items-center justify-between border-t border-stone-200 pt-6">
          <button
            disabled={step === 1}
            onClick={() => setStep(step - 1)}
            className="flex items-center gap-2 rounded-2xl border-2 border-stone-100 bg-white px-6 py-3 text-sm font-black text-stone-500 transition-all hover:bg-stone-50 disabled:opacity-30"
          >
            <span className="material-symbols-outlined text-lg">arrow_back</span> Kembali
          </button>

          {step < 5 ? (
            <button
              onClick={() => setStep(step + 1)}
              className="flex items-center gap-2 rounded-2xl bg-stone-900 px-8 py-3 text-sm font-black text-white shadow-xl shadow-stone-950/20 transition-all hover:bg-stone-800 hover:-translate-y-0.5 active:scale-95"
            >
              Lanjutkan <span className="material-symbols-outlined text-lg">arrow_forward</span>
            </button>
          ) : (
            <button 
              onClick={handleSaveToSystem}
              className="flex items-center gap-2 rounded-2xl bg-primary px-8 py-3 text-sm font-black text-white shadow-xl shadow-primary/20 transition-all hover:bg-secondary hover:-translate-y-0.5 active:scale-95"
            >
              <span className="material-symbols-outlined text-lg">save</span> Simpan Bobot ke Sistem
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ExpertManagement;

import React, { useState, useEffect } from "react";
import {
  calculateContextWeights,
  getContextFlow,
  getTopics,
  resetContextPairwiseScale,
  saveContextWeights,
  updateContextPairwiseScale,
} from "../../services/atlApi";
import { getSubskillColorHex, getSubskillMeta } from "../../services/labelRegistry";
import { getSubjectData } from "../../services/topicCatalog";

const fallbackScaleOptions = [
  { code: "equal", label: "Sama penting", ahpValue: 1, tfn: [1, 1, 1], reciprocal: [1, 1, 1] },
  { code: "slight", label: "Sedikit lebih penting", ahpValue: 3, tfn: [2, 3, 4], reciprocal: [0.25, 0.33, 0.5] },
  { code: "important", label: "Lebih penting", ahpValue: 5, tfn: [4, 5, 6], reciprocal: [0.17, 0.2, 0.25] },
  { code: "very_important", label: "Sangat lebih penting", ahpValue: 7, tfn: [6, 7, 8], reciprocal: [0.13, 0.14, 0.17] },
  { code: "absolute", label: "Mutlak lebih penting", ahpValue: 9, tfn: [8, 9, 9], reciprocal: [0.11, 0.11, 0.13] },
];

const SAVED_WEIGHT_META_KEYS = ["__mode", "packages", "__savedAt", "__activity"];
const formatWeightDisplay = (weight) => Number(weight || 0).toFixed(2);
const ResultHoverCard = ({ item, mode }) => {
  if (!item) {
    return (
      <div className="rounded-2xl border border-stone-200 bg-white/95 p-4 shadow-sm">
        <p className="text-[10px] font-black uppercase tracking-widest text-stone-400">Info Diagram</p>
        <p className="mt-2 text-xs font-semibold leading-5 text-stone-500">
          Arahkan cursor ke titik, irisan, atau legend untuk melihat detail subskill.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-stone-200 bg-white/95 p-4 shadow-[0_18px_45px_rgba(15,23,42,0.08)]">
      <div className="flex items-start gap-3">
        <span className="mt-1 h-3 w-3 shrink-0 rounded-full ring-4 ring-stone-100" style={{ backgroundColor: item.color }} />
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-widest text-stone-400">{mode === "pie" ? "Pie Segment" : "Radar Point"}</p>
          <h4 className="mt-1 text-sm font-black leading-tight text-stone-950">{item.subskill}</h4>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl bg-stone-50 px-2 py-2">
          <p className="text-[9px] font-black uppercase text-stone-400">Total</p>
          <p className="mt-1 text-xs font-black text-stone-900">{formatWeightDisplay(item.total)}</p>
        </div>
        <div className="rounded-xl bg-stone-50 px-2 py-2">
          <p className="text-[9px] font-black uppercase text-stone-400">Share</p>
          <p className="mt-1 text-xs font-black text-stone-900">{Math.round(Number(item.share || 0) * 100)}%</p>
        </div>
        <div className="rounded-xl bg-stone-50 px-2 py-2">
          <p className="text-[9px] font-black uppercase text-stone-400">Package</p>
          <p className="mt-1 text-xs font-black text-stone-900">{item.count || 0}</p>
        </div>
      </div>
      <p className="mt-3 text-[11px] font-semibold leading-5 text-stone-500">
        {mode === "pie"
          ? "Porsi ini menunjukkan kontribusi subskill terhadap total bobot semua criterion package."
          : "Jarak titik dari pusat menunjukkan seberapa besar bobot total subskill dibanding subskill terbesar."}
      </p>
      {(item.criteria || []).length > 0 && (
        <div className="mt-3 rounded-xl bg-primary/5 px-3 py-2">
          <p className="text-[9px] font-black uppercase tracking-widest text-primary-hover">Sumber Criterion</p>
          <p className="mt-1 line-clamp-2 text-[11px] font-semibold leading-5 text-stone-600">
            {Array.from(new Set(item.criteria)).join(", ")}
          </p>
        </div>
      )}
    </div>
  );
};
const formatSavedActivityTime = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};


const ExpertManagement = ({ onAddCriteriaClick, onTopicChange }) => {
  const initialSubjects = getSubjectData();
  const [subjectData, setSubjectData] = useState(initialSubjects);
  const [step, setStep] = useState(1);
  const [selectedSubjectId, setSelectedSubjectId] = useState(initialSubjects[0]?.id || "");
  const [selectedTopicId, setSelectedTopicId] = useState(initialSubjects[0]?.topics?.[0]?.id || "");

  const [pairwise, setPairwise] = useState({});
  const [result, setResult] = useState(null);
  const [contextFlow, setContextFlow] = useState(null);
  const [savedTopicWeights, setSavedTopicWeights] = useState({});
  const [resultVisualIndex, setResultVisualIndex] = useState(0);
  const [fuzzyPackageIndex, setFuzzyPackageIndex] = useState(0);
  const [resultHover, setResultHover] = useState(null);
  const [calculatingWeights, setCalculatingWeights] = useState(false);
  const [savingWeights, setSavingWeights] = useState(false);
  const [scaleOptions, setScaleOptions] = useState(fallbackScaleOptions);
  const [scaleDraft, setScaleDraft] = useState(fallbackScaleOptions);
  const [scaleSaving, setScaleSaving] = useState(false);
  const [scaleStatus, setScaleStatus] = useState("");
  const [backendError, setBackendError] = useState("");

  useEffect(() => {
    getTopics()
      .then((subjects) => {
        setSubjectData(subjects || []);
        const firstSubject = subjects?.[0];
        setSelectedSubjectId((current) => current || firstSubject?.id || "");
        setSelectedTopicId((current) => current || firstSubject?.topics?.[0]?.id || "");
        setBackendError("");
      })
      .catch((error) => {
        setSubjectData([]);
        setBackendError(error.message || "Gagal mengambil topik dari backend.");
      });
  }, []);

  const buildPackagePayload = () => Object.fromEntries(
    rubricPackages.map((pkg) => [
      pkg.key,
      {
        key: pkg.key,
        rubricItemId: pkg.rubricItemId,
        title: pkg.title,
        criteriaTopic: pkg.criteriaTopic,
        categories: pkg.categories,
        subskills: pkg.subskills,
        pairwise: Object.values(pairwise[pkg.key] || {}),
      },
    ])
  );

  const normalizeScaleOptions = (options) => (Array.isArray(options) && options.length > 0 ? options : fallbackScaleOptions)
    .map((option, index) => {
      const tfn = option.tfn || [option.fuzzyLower, option.fuzzyMiddle, option.fuzzyUpper];
      const normalizedTfn = tfn.map((value) => Number(value || 0));
      return {
        ...option,
        code: option.code || `scale-${index}`,
        ahpValue: option.ahpValue || option.value || index + 1,
        tfn: normalizedTfn,
        reciprocal: option.reciprocal || [
          normalizedTfn[2] ? 1 / normalizedTfn[2] : 0,
          normalizedTfn[1] ? 1 / normalizedTfn[1] : 0,
          normalizedTfn[0] ? 1 / normalizedTfn[0] : 0,
        ],
      };
    });

  const scaleDirty = JSON.stringify(scaleOptions.map((item) => item.tfn)) !== JSON.stringify(scaleDraft.map((item) => item.tfn));
  const scaleInvalid = scaleDraft.some((item) => {
    const [lower, middle, upper] = item.tfn || [];
    return !Number.isFinite(lower) || !Number.isFinite(middle) || !Number.isFinite(upper) || lower <= 0 || middle <= 0 || upper <= 0 || lower > middle || middle > upper;
  });
  const formatScaleNumber = (value) => {
    const number = Number(value || 0);
    return Number.isInteger(number) ? String(number) : number.toFixed(2);
  };

  const updateScaleDraftValue = (code, index, value) => {
    const nextValue = Number(value);
    setScaleDraft((current) => current.map((item) => {
      if (item.code !== code) return item;
      const nextTfn = [...(item.tfn || [1, 1, 1])];
      nextTfn[index] = Number.isNaN(nextValue) ? 0 : nextValue;
      return {
        ...item,
        tfn: nextTfn,
        reciprocal: [
          nextTfn[2] ? 1 / nextTfn[2] : 0,
          nextTfn[1] ? 1 / nextTfn[1] : 0,
          nextTfn[0] ? 1 / nextTfn[0] : 0,
        ],
      };
    }));
    setScaleStatus("Scale berubah. Simpan scale lalu hitung ulang bobot.");
    setResult(null);
  };

  const handleSaveScaleOptions = async () => {
    if (!selectedTopicId || scaleInvalid || !scaleDirty) return;
    setScaleSaving(true);
    setBackendError("");
    try {
      const saved = normalizeScaleOptions(await updateContextPairwiseScale(
        selectedTopicId,
        scaleDraft.map((item) => ({
          code: item.code,
          fuzzyLower: item.tfn[0],
          fuzzyMiddle: item.tfn[1],
          fuzzyUpper: item.tfn[2],
        }))
      ));
      setScaleOptions(saved);
      setScaleDraft(saved);
      setScaleStatus("Scale tersimpan. Silakan hitung ulang bobot.");
      setResult(null);
    } catch (error) {
      setBackendError(error.message || "Gagal menyimpan scale pairwise.");
    } finally {
      setScaleSaving(false);
    }
  };

  const handleResetScaleOptions = async () => {
    if (!selectedTopicId) return;
    setScaleSaving(true);
    setBackendError("");
    try {
      const reset = normalizeScaleOptions(await resetContextPairwiseScale(selectedTopicId));
      setScaleOptions(reset);
      setScaleDraft(reset);
      setScaleStatus("Scale kembali ke default. Silakan hitung ulang bobot.");
      setResult(null);
    } catch (error) {
      setBackendError(error.message || "Gagal reset scale pairwise.");
    } finally {
      setScaleSaving(false);
    }
  };

  const calculateResult = async () => {
    if (!selectedTopicId || rubricPackages.length === 0 || scaleDirty || scaleInvalid) return;
    setCalculatingWeights(true);
    setBackendError("");
    try {
      const apiResult = await calculateContextWeights(
        selectedTopicId,
        {
          __criterionPackages: true,
          packages: buildPackagePayload(),
        },
        { persist: false }
      );
      setResult(apiResult);
      setResultHover(null);
      setStep(3);
    } catch (error) {
      setBackendError(error.message || "Backend gagal menghitung bobot Fuzzy-AHP.");
    } finally {
      setCalculatingWeights(false);
    }
  };

  const handleSaveToSystem = async () => {
    if (!result || !result.weights) return;

    const selectedSubject = subjectData.find((subject) => subject.id === selectedSubjectId);
    const selectedTopic = selectedSubject?.topics.find((topic) => topic.id === selectedTopicId);
    const savedAt = new Date().toISOString();
    const weightEntries = Object.entries(result.weights || {}).filter(([key]) => !SAVED_WEIGHT_META_KEYS.includes(key));
    const savedActivity = {
      topicId: selectedTopicId,
      topicLabel: selectedTopic?.label || selectedTopicId,
      subjectId: selectedSubjectId,
      subjectLabel: selectedSubject?.label || selectedSubjectId,
      savedAt,
      packageCount: Object.keys(result.packages || {}).length,
      weightedLinkCount: weightEntries.length,
      maxConsistency: Number(result.consistency || 0),
    };

    setSavingWeights(true);
    try {
      const apiResult = await saveContextWeights(selectedTopicId, {
        packages: buildPackagePayload(),
        savedAt,
        activity: savedActivity,
      });
      setResult(apiResult);
      setResultHover(null);
      setSavedTopicWeights(apiResult.weights || {});
      setContextFlow((current) => current ? { ...current, hasSavedWeight: true, weightSource: "saved" } : current);
      alert(`Bobot untuk topik ${selectedTopicId} berhasil disimpan ke backend.`);
    } catch (error) {
      alert(error.message || "Gagal menyimpan bobot ke backend. Pastikan seluruh pairwise sudah terisi.");
    } finally {
      setSavingWeights(false);
    }
  };

  const rubricPackages = backendError
    ? []
    : Object.values(contextFlow?.weightingPackages || {}).map((item) => ({
      key: item.key || `rubric-${item.rubricItemId}`,
      rubricItemId: item.rubricItemId,
      title: item.title,
      criteriaTopic: item.criteriaTopic || "Rubric Evidence",
      categories: item.categories || [],
      subskills: Array.from(new Set(item.subskills || [])),
      pairs: item.pairs || [],
    }));

  const packagePairs = rubricPackages.reduce((acc, pkg) => {
      acc[pkg.key] = (pkg.pairs || []).map((pair) => [pair.left, pair.right]);
      return acc;
    }, {});

  const totalPairCount = Object.values(packagePairs).reduce((acc, pairs) => acc + pairs.length, 0);
  const filledPairCount = Object.values(pairwise).reduce(
    (acc, packagePairwise) => acc + Object.keys(packagePairwise || {}).length,
    0
  );
  const savedPackages = savedTopicWeights.packages || {};
  const recentSavedActivities = savedTopicWeights.__activity ? [savedTopicWeights.__activity] : [];
  const hasSavedWeight = Boolean(contextFlow?.hasSavedWeight);

  const buildSavedWeightResult = () => {
    if (!hasSavedWeight) return null;
    const packageEntries = Object.entries(savedPackages);
    const flatWeights = Object.fromEntries(
      Object.entries(savedTopicWeights).filter(([key]) => !SAVED_WEIGHT_META_KEYS.includes(key))
    );

    if (Object.keys(flatWeights).length === 0 && packageEntries.length > 0) {
      packageEntries.forEach(([, pkg]) => {
        Object.entries(pkg.weights || {}).forEach(([subskill, weight]) => {
          flatWeights[`${pkg.title} (${subskill})`] = weight;
        });
      });
    }

    const firstPackage = packageEntries[0]?.[1];
    const consistencyValues = packageEntries.map(([, pkg]) => Number(pkg.consistency || 0));
    return {
      weights: flatWeights,
      packages: savedPackages,
      consistency: consistencyValues.length ? Math.max(...consistencyValues) : 0,
      sumD: firstPackage?.sumD || "0.00",
      debug: firstPackage?.debug || { packages: savedPackages },
    };
  };

  const openSavedWeightStep = (targetStep) => {
    const savedResult = buildSavedWeightResult();
    if (!savedResult) return;
    setResult(savedResult);
    setStep(targetStep);
  };

  const selectSavedActivity = (activity) => {
    const topicSubject = subjectData.find((subject) =>
      subject.topics.some((topic) => topic.id === activity.topicId)
    );
    if (topicSubject) {
      setSelectedSubjectId(topicSubject.id);
      setSelectedTopicId(activity.topicId);
    }
  };

  useEffect(() => {
    let cancelled = false;
    if (!selectedTopicId) return () => { cancelled = true; };
    getContextFlow(selectedTopicId)
      .then((flow) => {
        if (!cancelled) {
          const nextPairwise = {};
          Object.values(flow?.weightingPackages || {}).forEach((pkg) => {
            nextPairwise[pkg.key || `rubric-${pkg.rubricItemId}`] = Object.fromEntries(
              (pkg.pairwise || []).map((item, index) => [index, item])
            );
          });
          setResult(null);
          setResultHover(null);
          setContextFlow(flow);
          setSavedTopicWeights(flow?.weights || {});
          setPairwise(nextPairwise);
          const nextScaleOptions = normalizeScaleOptions(flow?.scaleOptions);
          setScaleOptions(nextScaleOptions);
          setScaleDraft(nextScaleOptions);
          setScaleStatus("");
          setBackendError("");
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setResult(null);
          setResultHover(null);
          setBackendError(error.message || "Gagal mengambil rubrik/bobot dari backend.");
          setContextFlow(null);
          setSavedTopicWeights({});
          setPairwise({});
          setScaleOptions(fallbackScaleOptions);
          setScaleDraft(fallbackScaleOptions);
          setScaleStatus("");
        }
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

  // Notify parent about topic change for tracking
  useEffect(() => {
    if (onTopicChange) onTopicChange(selectedTopicId);
  }, [selectedTopicId, onTopicChange]);

  const steps = [
    { id: 1, name: "Context & Criteria", icon: "hub" },
    { id: 2, name: "Pairwise", icon: "compare_arrows" },
    { id: 3, name: "Fuzzy Process", icon: "query_stats" },
    { id: 4, name: "Result", icon: "analytics" },
  ];
  const resultPackageEntries = Object.entries(result?.packages || {});
  const resultSoftskillRows = resultPackageEntries.flatMap(([packageKey, pkg]) =>
    Object.entries(pkg.weights || {}).map(([subskill, weight]) => ({
      packageKey,
      criterion: pkg.title,
      criteriaTopic: pkg.criteriaTopic,
      subskill,
      weight: Number(weight || 0),
      consistency: Number(pkg.consistency || 0),
    }))
  );
  const resultDistributionRawTotal = resultSoftskillRows.reduce((sum, row) => sum + row.weight, 0);
  const resultDistributionTotal = resultDistributionRawTotal || 1;
  const resultDistribution = Object.values(resultSoftskillRows.reduce((acc, row) => {
    if (!acc[row.subskill]) acc[row.subskill] = { subskill: row.subskill, total: 0, count: 0, criteria: [] };
    acc[row.subskill].total += row.weight;
    acc[row.subskill].count += 1;
    acc[row.subskill].criteria.push(row.criterion);
    return acc;
  }, {})).map((row) => ({
    ...row,
    average: row.total / row.count,
    share: row.total / resultDistributionTotal,
  })).sort((a, b) => b.total - a.total);
  const dominantSoftskill = resultDistribution[0];
  const secondarySoftskills = resultDistribution.slice(1, 4);
  const maxDistributionTotal = Math.max(...resultDistribution.map((row) => row.total), 0) || 1;
  const radarPoints = resultDistribution.map((row, index) => {
    const angle = (index * 2 * Math.PI) / Math.max(resultDistribution.length, 1) - Math.PI / 2;
    const radius = (row.total / maxDistributionTotal) * 38;
    return {
      ...row,
      x: 50 + radius * Math.cos(angle),
      y: 50 + radius * Math.sin(angle),
      axisX: 50 + 42 * Math.cos(angle),
      axisY: 50 + 42 * Math.sin(angle),
      color: getSubskillColorHex(row.subskill, index),
    };
  });
  const donutSegments = resultDistribution.reduce((segments, row, index) => {
    const share = resultDistributionTotal > 0 ? row.total / resultDistributionTotal : 0;
    const start = segments.at(-1)?.end || 0;
    segments.push({
      ...row,
      color: getSubskillColorHex(row.subskill, index),
      start,
      end: start + share,
    });
    return segments;
  }, []);
  const pieGradient = donutSegments.length
    ? `conic-gradient(${donutSegments.map((segment) => `${segment.color} ${segment.start * 100}% ${segment.end * 100}%`).join(", ")})`
    : "conic-gradient(#E7E5E4 0% 100%)";
  const resultVisualTabs = [
    {
      key: "radar",
      icon: "radar",
      title: "Radar Weight Profile",
      description: "Melihat keseimbangan pengaruh antar softskill. Semakin jauh titik dari tengah, semakin besar total bobotnya.",
      guide: {
        title: "Cara Membaca Radar",
        intro: "Radar dipakai untuk membaca bentuk distribusi bobot antar softskill, bukan untuk membaca nilai siswa.",
        points: [
          "Titik yang lebih jauh dari pusat berarti softskill tersebut memiliki total bobot lebih besar.",
          "Bidang yang melebar ke satu arah berarti weighting terkonsentrasi pada softskill tertentu.",
          "Bidang yang relatif merata berarti kontribusi antar softskill lebih seimbang.",
          "Hover titik atau legend untuk melihat total weight, share, dan criterion package sumbernya.",
        ],
      },
    },
    {
      key: "pie",
      icon: "pie_chart",
      title: "2D Pie Distribution",
      description: "Melihat porsi kontribusi semua softskill dalam proses expert weighting. Legend tetap menampilkan total contribution dan share setiap softskill.",
      guide: {
        title: "Cara Membaca 2D Pie",
        intro: "Pie memperlihatkan share setiap softskill terhadap total bobot seluruh criterion package.",
        points: [
          "Irisan terbesar menunjukkan softskill dengan kontribusi total paling tinggi.",
          "Persentase pada legend adalah share dari akumulasi bobot, bukan persentase nilai siswa.",
          "Softskill dengan irisan kecil tetap dihitung jika muncul pada rubric item.",
          "Hover irisan atau legend untuk melihat total bobot, share, dan criterion yang menyumbang bobot.",
        ],
      },
    },
    {
      key: "coverage",
      icon: "schema",
      title: "Evidence Weight Matrix",
      description: "Melihat criterion package mana yang menyumbang bobot ke setiap softskill sebelum dipakai pada input ATL siswa.",
      guide: {
        title: "Cara Membaca Matrix",
        intro: "Matrix menjelaskan asal bobot: baris adalah criterion package, kolom adalah softskill.",
        points: [
          "Angka W adalah local weight softskill pada criterion package tersebut.",
          "Bar yang lebih panjang berarti subskill lebih berpengaruh pada package itu.",
          "Nilai 0.00 berarti softskill tidak menjadi bagian dari package tersebut.",
          "Gunakan matrix untuk melacak mengapa sebuah softskill besar pada radar atau pie.",
        ],
      },
    },
  ];
  const activeResultVisual = resultVisualTabs[resultVisualIndex] || resultVisualTabs[0];
  const activeResultInfo = resultHover || (dominantSoftskill ? { ...dominantSoftskill, color: getSubskillColorHex(dominantSoftskill.subskill, 0) } : null);
  const handlePieHover = (event) => {
    if (!donutSegments.length) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left - rect.width / 2;
    const y = event.clientY - rect.top - rect.height / 2;
    const angle = ((Math.atan2(y, x) * 180) / Math.PI + 90 + 360) % 360;
    const position = angle / 360;
    const hovered = donutSegments.find((segment) => position >= segment.start && position <= segment.end) || donutSegments[0];
    setResultHover(hovered);
  };

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
            disabled={s.id > 2 && !result}
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
        <div className="mt-6 border-t border-stone-200 pt-5">
          <p className="px-2 text-[10px] font-black uppercase tracking-widest text-stone-400">Saved Weight</p>
          <div className="mt-3 rounded-2xl border border-primary/20 bg-primary/5 p-3">
            <p className="text-xs font-black text-stone-900">
              {subjectData.find(s => s.id === selectedSubjectId)?.topics.find(t => t.id === selectedTopicId)?.label || selectedTopicId}
            </p>
            <p className="mt-1 text-[11px] font-semibold leading-4 text-stone-500">
              {hasSavedWeight ? "Bobot tersimpan tersedia." : "Belum ada bobot tersimpan."}
            </p>
            {hasSavedWeight && (
              <div className="mt-3 rounded-xl border border-amber-200 bg-white px-3 py-2">
                <p className="text-[9px] font-black uppercase tracking-widest text-stone-400">Last Saved</p>
                <p className="mt-1 text-xs font-black text-stone-900">
                  {formatSavedActivityTime(savedTopicWeights.__savedAt)}
                </p>
              </div>
            )}
            <div className="mt-3 grid gap-2">
              <button
                type="button"
                disabled={!hasSavedWeight}
                onClick={() => openSavedWeightStep(3)}
                className="rounded-xl border border-primary/25 bg-white px-3 py-2 text-left text-[11px] font-black text-primary transition hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Lihat Fuzzy Process
              </button>
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-stone-200 bg-white p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10px] font-black uppercase tracking-widest text-stone-500">Recent Saved Activities</p>
              <span className="material-symbols-outlined text-base text-primary">history</span>
            </div>
            <div className="mt-3 space-y-2">
              {recentSavedActivities.length > 0 ? (
                recentSavedActivities.slice(0, 4).map((activity, index) => (
                  <button
                    key={`${activity.topicId}-${activity.savedAt || index}`}
                    type="button"
                    onClick={() => selectSavedActivity(activity)}
                    className={`w-full rounded-xl border px-3 py-2 text-left transition hover:border-primary/40 hover:bg-primary/5 ${
                      activity.topicId === selectedTopicId
                        ? "border-primary/30 bg-primary/5"
                        : "border-stone-100 bg-stone-50"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-[11px] font-black text-stone-900">
                          {activity.topicLabel || activity.topicId}
                        </p>
                        <p className="truncate text-[10px] font-bold text-stone-400">
                          {activity.subjectLabel || "Subject"} - {activity.packageCount || 0} package
                        </p>
                      </div>
                      <span className="shrink-0 rounded-lg bg-amber-100 px-2 py-1 text-[10px] font-black text-amber-700">
                        {formatSavedActivityTime(activity.savedAt)}
                      </span>
                    </div>
                  </button>
                ))
              ) : (
                <div className="rounded-xl border border-dashed border-stone-200 bg-stone-50 px-3 py-4 text-center">
                  <p className="text-[11px] font-semibold leading-4 text-stone-400">
                    Belum ada aktivitas save. Setelah klik simpan, waktu penyimpanan akan muncul di sini.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* MAIN CONTENT AREA */}
      <div className="flex flex-1 flex-col justify-between overflow-hidden py-2">
        <div className="flex-1 overflow-y-auto pr-4">
          {backendError && (
            <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-bold text-red-700">
              <span className="material-symbols-outlined mr-2 align-middle text-[18px]">error</span>
              {backendError} Importance Weighting tidak memakai dummy/localStorage sebagai pengganti data.
            </div>
          )}
          {/* STEP 1: CONTEXT + CRITERIA */}
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
                      setSelectedTopicId(subjectData.find(s => s.id === e.target.value)?.topics?.[0]?.id || "");
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
                    {(subjectData.find(s => s.id === selectedSubjectId)?.topics || []).map(t => (
                      <option key={t.id} value={t.id}>{t.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="mt-8 rounded-[2rem] border border-stone-200 bg-white p-5 shadow-sm">
                <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.22em] text-primary">Criterion Packages</p>
                    <h3 className="mt-1 text-xl font-black text-stone-950">
                      {subjectData.find(s => s.id === selectedSubjectId)?.topics.find(t => t.id === selectedTopicId)?.label}
                    </h3>
                    <p className="mt-1 text-sm font-semibold text-stone-500">
                      Setiap criterion menjadi 1 paket pairwise. Subskill hanya dibandingkan dengan sibling dalam criterion yang sama.
                    </p>
                  </div>
                  <button onClick={onAddCriteriaClick} className="inline-flex items-center gap-2 rounded-2xl border border-primary/25 bg-primary/5 px-4 py-3 text-xs font-black text-primary transition hover:bg-primary/10">
                    <span className="material-symbols-outlined text-lg">add_circle</span>
                    Tambah Kriteria
                  </button>
                </div>

                <div className="overflow-hidden rounded-2xl border border-stone-200">
                  <div className="hidden grid-cols-[44px_minmax(180px,1fr)_110px_minmax(260px,1.7fr)_70px] gap-3 bg-stone-50 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-stone-500 lg:grid">
                    <span>No</span>
                    <span>Criterion</span>
                    <span>Domain</span>
                    <span>ATL Subskill dalam Paket</span>
                    <span className="text-right">Pairs</span>
                  </div>
                  <div className="divide-y divide-stone-200 bg-white">
                    {rubricPackages.map((pkg, packageIndex) => (
                      <div key={pkg.key} className="grid gap-3 px-4 py-4 lg:grid-cols-[44px_minmax(180px,1fr)_110px_minmax(260px,1.7fr)_70px]">
                        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-xs font-black text-primary">{packageIndex + 1}</span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-black text-stone-900">{pkg.title}</p>
                          <p className="mt-1 text-[11px] font-semibold text-stone-500">{pkg.subskills.length} subskill relevan</p>
                        </div>
                        <p className="text-xs font-black uppercase tracking-wider text-stone-500">{pkg.criteriaTopic}</p>
                        <div className="flex min-w-0 flex-wrap gap-1.5">
                          {pkg.subskills.map((atlSkill, skillIndex) => {
                            const tone = getSubskillMeta(atlSkill, skillIndex);
                            return (
                            <span
                              key={atlSkill}
                              className="inline-flex max-w-full items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-black"
                              style={tone.solidStyle}
                            >
                              <span className="material-symbols-outlined text-[13px]">{tone.icon}</span>
                              {atlSkill}
                            </span>
                            );
                          })}
                        </div>
                        <p className="text-right text-sm font-black text-stone-900">{packagePairs[pkg.key]?.length || 0}</p>
                      </div>
                    ))}
                    {rubricPackages.length === 0 && (
                      <div className="px-4 py-10 text-center text-sm font-semibold text-stone-500">
                        Belum ada criterion untuk topik ini.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: PAIRWISE (CORE UI) */}
          {step === 2 && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-12">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-black text-stone-900 italic underline decoration-primary decoration-4 underline-offset-4">Criterion Package Comparison</h2>
                  <p className="text-xs text-stone-500 mt-2 font-bold">Setiap blok di bawah adalah 1 paket pairwise untuk 1 rubric criterion.</p>
                </div>
                <span className="p-4 bg-primary/5 rounded-2xl border border-primary/20">
                  <p className="text-[10px] font-black uppercase text-primary tracking-widest mb-1 text-right">Draft Pairwise</p>
                  <p className="text-sm font-black text-stone-900">
                    {filledPairCount} / {totalPairCount} Perbandingan Terisi
                  </p>
                </span>
              </div>

              <section className="rounded-[2rem] border-2 border-primary/20 bg-gradient-to-br from-amber-50 via-white to-white p-5 shadow-sm">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="max-w-2xl">
                    <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-primary-hover">
                      <span className="material-symbols-outlined text-[14px]">tune</span>
                      Pairwise Scale Settings
                    </span>
                    <h3 className="mt-3 text-lg font-black text-stone-950">Atur TFN untuk scale pairwise subtopik ini</h3>
                    <p className="mt-2 text-xs font-semibold leading-5 text-stone-600">
                      Scale ini hanya berlaku untuk perbandingan antar subskill. Diagonal AHP tetap 1, dan pairwise yang belum dipilih tetap netral.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={handleResetScaleOptions}
                      disabled={scaleSaving}
                      className="rounded-2xl border border-stone-200 bg-white px-4 py-2 text-xs font-black text-stone-600 transition hover:border-primary hover:text-primary disabled:opacity-40"
                    >
                      Reset Default
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveScaleOptions}
                      disabled={scaleSaving || scaleInvalid || !scaleDirty}
                      className="rounded-2xl bg-stone-950 px-5 py-2 text-xs font-black text-white shadow-lg shadow-stone-950/15 transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {scaleSaving ? "Menyimpan..." : "Simpan Scale"}
                    </button>
                  </div>
                </div>

                <div className="mt-5 overflow-x-auto rounded-2xl border border-stone-200 bg-white">
                  <table className="min-w-full divide-y divide-stone-200 text-xs">
                    <thead className="bg-stone-50 text-[10px] uppercase tracking-widest text-stone-500">
                      <tr>
                        <th className="px-4 py-3 text-left">Definisi</th>
                        <th className="px-4 py-3 text-center">AHP</th>
                        <th className="px-4 py-3 text-center">Lower</th>
                        <th className="px-4 py-3 text-center">Middle</th>
                        <th className="px-4 py-3 text-center">Upper</th>
                        <th className="px-4 py-3 text-center">Reciprocal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100 bg-white">
                      {scaleDraft.map((option) => {
                        const [lower, middle, upper] = option.tfn || [1, 1, 1];
                        const reciprocal = [
                          upper ? 1 / upper : 0,
                          middle ? 1 / middle : 0,
                          lower ? 1 / lower : 0,
                        ];
                        const rowInvalid = lower <= 0 || middle <= 0 || upper <= 0 || lower > middle || middle > upper;
                        return (
                          <tr key={option.code} className={rowInvalid ? "bg-rose-50" : ""}>
                            <td className="px-4 py-3">
                              <p className="font-black text-stone-950">{option.label}</p>
                              <p className="mt-1 text-[10px] font-semibold text-stone-400">Scale code: {option.code}</p>
                            </td>
                            <td className="px-4 py-3 text-center font-black text-primary">{option.ahpValue}</td>
                            {[lower, middle, upper].map((value, index) => (
                              <td key={`${option.code}-${index}`} className="px-2 py-3 text-center">
                                <input
                                  type="number"
                                  min="0.01"
                                  step="0.01"
                                  value={value}
                                  onChange={(event) => updateScaleDraftValue(option.code, index, event.target.value)}
                                  className="h-10 w-20 rounded-xl border border-stone-200 bg-white px-2 text-center text-xs font-black text-stone-900 outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
                                />
                              </td>
                            ))}
                            <td className="px-4 py-3 text-center font-mono text-[11px] font-bold text-stone-600">
                              ({reciprocal.map(formatScaleNumber).join(", ")})
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {(scaleStatus || scaleInvalid) && (
                  <div className={`mt-4 rounded-2xl px-4 py-3 text-xs font-bold ${
                    scaleInvalid
                      ? "border border-rose-200 bg-rose-50 text-rose-700"
                      : "border border-amber-200 bg-amber-50 text-amber-800"
                  }`}>
                    {scaleInvalid ? "Scale belum valid. Pastikan lower <= middle <= upper dan semua angka lebih dari 0." : scaleStatus}
                  </div>
                )}
              </section>

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
                            onClick={() => {
                              setPairwise({
                                ...pairwise,
                                [pkg.key]: {
                                  ...(pairwise[pkg.key] || {}),
                                  [idx]: { left: c1, right: c2, scale: opt.label },
                                },
                              });
                              setResult(null);
                            }}
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

          {/* STEP 3: FUZZY-AHP PROCESS */}
          {step === 3 && (() => {
            const packageEntries = Object.entries(result?.packages || {});
            const safePackageIndex = Math.min(fuzzyPackageIndex, Math.max(packageEntries.length - 1, 0));
            const [activePackageKey, activePackage] = packageEntries[safePackageIndex] || packageEntries[0] || [];
            const traceRows = activePackage?.pairwiseTrace || Object.values(pairwise?.[activePackageKey] || {});
            const weightEntries = Object.entries(activePackage?.weights || {});
            const subskills = activePackage?.subskills || [];
            const matrix = activePackage?.debug?.matrix || [];
            const consistency = Number(activePackage?.consistency || result?.consistency || 0);
            const rowSums = activePackage?.debug?.rowSums || [];
            const totalFuzzy = activePackage?.debug?.total || [];
            const syntheticExtents = activePackage?.debug?.S || [];
            const possibilityMatrix = activePackage?.debug?.V || [];
            const dVector = activePackage?.debug?.d || [];
            const formatTFN = (value) => Array.isArray(value) ? `(${value.map((item) => Number(item).toFixed(2)).join(", ")})` : "-";

            return (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-5 pb-10">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                  <div>
                    <span className="inline-flex rounded-full bg-primary px-4 py-1.5 text-[11px] font-black uppercase tracking-widest text-white shadow-lg shadow-primary/20">
                      Fuzzy-AHP Process
                    </span>
                    <h2 className="mt-3 text-2xl font-black text-stone-950">{activePackage?.title || "Criterion belum dipilih"}</h2>
                    <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-stone-600">
                      Flow ini menunjukkan transformasi dari keputusan pairwise expert menjadi bobot lokal ATL subskill. Semua tabel di bawah memakai satu criterion package aktif agar prosesnya mudah diikuti dari awal sampai normalisasi.
                    </p>
                  </div>
                  <div className="rounded-2xl border border-stone-200 bg-white p-2 shadow-sm">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={safePackageIndex === 0}
                        onClick={() => setFuzzyPackageIndex(Math.max(0, safePackageIndex - 1))}
                        className="flex h-10 w-10 items-center justify-center rounded-xl border border-stone-200 text-stone-700 transition-all hover:border-stone-400 disabled:opacity-35"
                        aria-label="Paket sebelumnya"
                      >
                        <span className="material-symbols-outlined text-[18px]">chevron_left</span>
                      </button>
                      <div className="min-w-[190px] px-2 text-center">
                        <p className="text-[10px] font-black uppercase tracking-widest text-stone-400">Paket aktif</p>
                        <p className="truncate text-xs font-black text-stone-950">
                          {packageEntries.length ? `${safePackageIndex + 1}/${packageEntries.length} - ${activePackage?.title || activePackageKey}` : "Belum ada paket"}
                        </p>
                      </div>
                      <button
                        type="button"
                        disabled={safePackageIndex >= packageEntries.length - 1}
                        onClick={() => setFuzzyPackageIndex(Math.min(packageEntries.length - 1, safePackageIndex + 1))}
                        className="flex h-10 w-10 items-center justify-center rounded-xl border border-stone-200 text-stone-700 transition-all hover:border-stone-400 disabled:opacity-35"
                        aria-label="Paket berikutnya"
                      >
                        <span className="material-symbols-outlined text-[18px]">chevron_right</span>
                      </button>
                    </div>
                  </div>
                </div>

                <section className="rounded-[2rem] border border-stone-200 bg-white p-6 shadow-sm">
                  <h3 className="text-lg font-black text-stone-950">1. Pairwise Comparison Input</h3>
                  <p className="mt-2 text-sm font-semibold leading-6 text-stone-600">
                    Expert memilih tingkat kepentingan linguistik untuk setiap pasangan subskill. Pilihan ini menjadi sumber utama matriks TFN.
                  </p>
                  <div className="mt-5 overflow-x-auto rounded-2xl border border-stone-200">
                    <table className="min-w-full divide-y divide-stone-200 text-sm">
                      <thead className="bg-stone-50 text-[10px] uppercase tracking-widest text-stone-500">
                        <tr>
                          <th className="px-4 py-3 text-left">Left</th>
                          <th className="px-4 py-3 text-left">Right</th>
                          <th className="px-4 py-3 text-left">Linguistic Scale</th>
                          <th className="px-4 py-3 text-center">TFN</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-200 bg-white">
                        {traceRows.length > 0 ? traceRows.map((row, index) => {
                          const scaleObj = scaleOptions.find((scale) => scale.label === row.scale);
                          return (
                            <tr key={`${row.left}-${row.right}-${index}`}>
                              <td className="px-4 py-3 font-black text-stone-900">{row.left}</td>
                              <td className="px-4 py-3 font-black text-stone-900">{row.right}</td>
                              <td className="px-4 py-3 font-semibold text-primary">{row.scale}</td>
                              <td className="px-4 py-3 text-center font-mono text-stone-700">({(row.tfn || scaleObj?.tfn || [1, 1, 1]).join(", ")})</td>
                            </tr>
                          );
                        }) : (
                          <tr><td colSpan="4" className="px-4 py-8 text-center font-semibold text-stone-500">Lengkapi pairwise untuk melihat tabel input.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </section>

                <section className="rounded-[2rem] border border-stone-200 bg-white p-6 shadow-sm">
                  <h3 className="text-lg font-black text-stone-950">2. TFN Matrix dan Reciprocal</h3>
                  <p className="mt-2 text-sm font-semibold leading-6 text-stone-600">
                    Nilai linguistik dimasukkan ke matriks segitiga fuzzy. Arah sebaliknya otomatis memakai reciprocal TFN, sehingga matriks tetap konsisten secara AHP.
                  </p>
                  <div className="mt-5 overflow-x-auto rounded-2xl border border-stone-200">
                    <table className="min-w-full divide-y divide-stone-200 text-xs">
                      <thead className="bg-stone-50 uppercase tracking-wider text-stone-500">
                        <tr>
                          <th className="px-3 py-3 text-left">Subskill</th>
                          {subskills.map((name) => <th key={name} className="px-3 py-3 text-center">{name}</th>)}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-200 bg-white">
                        {subskills.map((rowName, rowIndex) => (
                          <tr key={rowName}>
                            <td className="px-3 py-3 font-black text-stone-900">{rowName}</td>
                            {subskills.map((colName, colIndex) => (
                              <td key={`${rowName}-${colName}`} className="px-3 py-3 text-center font-mono text-stone-700">
                                {formatTFN(matrix?.[rowIndex]?.[colIndex])}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>

                <section className="rounded-[2rem] border border-stone-200 bg-white p-6 shadow-sm">
                  <h3 className="text-lg font-black text-stone-950">3. Fuzzy Synthesis: Row Sum, Total, dan Synthetic Extent</h3>
                  <p className="mt-2 text-sm font-semibold leading-6 text-stone-600">
                    Setiap baris matriks dijumlahkan menjadi row sum. Semua row sum dijumlahkan lagi menjadi total fuzzy, lalu setiap row sum dibagi total fuzzy untuk menghasilkan S_i.
                  </p>
                  <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_260px]">
                    <div className="overflow-x-auto rounded-2xl border border-stone-200">
                      <table className="min-w-full divide-y divide-stone-200 text-sm">
                        <thead className="bg-stone-50 text-[10px] uppercase tracking-widest text-stone-500">
                          <tr>
                            <th className="px-4 py-3 text-left">Subskill</th>
                            <th className="px-4 py-3 text-center">Row Sum</th>
                            <th className="px-4 py-3 text-center">Synthetic Extent S_i</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-stone-200 bg-white">
                          {subskills.map((name, index) => (
                            <tr key={name}>
                              <td className="px-4 py-3 font-black text-stone-900">{name}</td>
                              <td className="px-4 py-3 text-center font-mono text-stone-700">{formatTFN(rowSums[index])}</td>
                              <td className="px-4 py-3 text-center font-mono text-primary">{formatTFN(syntheticExtents[index])}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="rounded-2xl border border-primary/25 bg-primary/5 p-5">
                      <p className="text-[10px] font-black uppercase tracking-widest text-primary-hover">Total Fuzzy</p>
                      <p className="mt-3 font-mono text-xl font-black text-stone-950">{formatTFN(totalFuzzy)}</p>
                      <p className="mt-3 text-xs font-semibold leading-5 text-stone-600">Total ini menjadi pembagi untuk membentuk synthetic extent setiap subskill.</p>
                    </div>
                  </div>
                </section>

                <section className="rounded-[2rem] border border-stone-200 bg-white p-6 shadow-sm">
                  <h3 className="text-lg font-black text-stone-950">4. Degree of Possibility dan Vector d</h3>
                  <p className="mt-2 text-sm font-semibold leading-6 text-stone-600">
                    Setiap S_i dibandingkan dengan S_j. Nilai minimum pada baris menjadi vector d, yang menunjukkan kekuatan relatif subskill sebelum normalisasi.
                  </p>
                  <div className="mt-5 overflow-x-auto rounded-2xl border border-stone-200">
                    <table className="min-w-full divide-y divide-stone-200 text-sm">
                      <thead className="bg-stone-50 text-[10px] uppercase tracking-widest text-stone-500">
                        <tr>
                          <th className="px-4 py-3 text-left">S_i \ S_j</th>
                          {subskills.map((name) => <th key={name} className="px-4 py-3 text-center">{name}</th>)}
                          <th className="px-4 py-3 text-center">d Min</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-200 bg-white">
                        {subskills.map((rowName, rowIndex) => (
                          <tr key={rowName}>
                            <td className="px-4 py-3 font-black text-stone-900">{rowName}</td>
                            {subskills.map((colName, colIndex) => (
                              <td key={`${rowName}-${colName}`} className="px-4 py-3 text-center font-mono text-stone-700">
                                {Number(possibilityMatrix?.[rowIndex]?.[colIndex] ?? 0).toFixed(2)}
                              </td>
                            ))}
                            <td className="px-4 py-3 text-center font-mono font-black text-primary">{dVector[rowIndex] ?? "-"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>

                <section className="rounded-[2rem] border border-stone-200 bg-white p-6 shadow-sm">
                  <h3 className="text-lg font-black text-stone-950">5. Normalisasi Bobot Lokal</h3>
                  <p className="mt-2 text-sm font-semibold leading-6 text-stone-600">
                    Vector d dinormalisasi sehingga total bobot dalam criterion package bernilai 1. Bobot ini menjadi importance weight lokal untuk menghitung kontribusi ATL dari rubric siswa.
                  </p>
                  <div className="mt-5 overflow-x-auto rounded-2xl border border-stone-200">
                    <table className="min-w-full divide-y divide-stone-200 text-sm">
                      <thead className="bg-stone-50 text-[10px] uppercase tracking-widest text-stone-500">
                        <tr>
                          <th className="px-4 py-3 text-left">Subskill</th>
                          <th className="px-4 py-3 text-center">d Vector</th>
                          <th className="px-4 py-3 text-center">Normalized Weight</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-200 bg-white">
                        {weightEntries.map(([name, weight], index) => (
                          <tr key={name}>
                            <td className="px-4 py-3 font-black text-stone-900">{name}</td>
                            <td className="px-4 py-3 text-center font-mono text-stone-700">{dVector[index] ?? "-"}</td>
                            <td className="px-4 py-3 text-center font-black text-primary">{formatWeightDisplay(weight)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>

                <section className={`rounded-[2rem] border p-6 ${
                  consistency < 0.1 ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"
                }`}>
                  <p className={`text-sm font-black ${consistency < 0.1 ? "text-emerald-800" : "text-amber-800"}`}>
                    Consistency Ratio (CR): {consistency.toFixed(2)}
                  </p>
                  <p className={`mt-1 text-sm font-semibold ${consistency < 0.1 ? "text-emerald-700" : "text-amber-700"}`}>
                    {consistency < 0.1
                      ? "Pairwise cukup konsisten untuk digunakan sebagai bobot importance."
                      : "Pairwise perlu ditinjau ulang karena tingkat konsistensi belum ideal."}
                  </p>
                </section>
              </div>
            );
          })()}

          {/* STEP 4: RESULT & VALIDATION */}
          {step === 4 && result && (
            <div className="animate-in zoom-in-95 duration-500 space-y-10">
              <div className="rounded-[2.5rem] border-2 border-primary/20 bg-primary/5 p-8">
                <p className="text-[11px] font-black uppercase tracking-[0.24em] text-primary-hover">Final Weight Result</p>
                <h2 className="mt-2 text-2xl font-black text-stone-950">
                  Bobot ATL siap dipakai untuk menghitung nilai siswa
                </h2>
                <p className="mt-3 max-w-4xl text-sm font-semibold leading-6 text-stone-600">
                  Hasil Fuzzy-AHP di bawah adalah importance weight lokal. Saat guru memberi rating rubric, rating tersebut dikonversi ke fuzzy score, lalu kontribusi tiap subskill dihitung dengan rumus: <strong>rubric score x local weight</strong>. Nilai akhir ATL siswa adalah akumulasi kontribusi dari semua criterion package yang dinilai.
                </p>
                <div className="mt-5">
                  <div className="rounded-2xl border border-stone-200 bg-white p-4">
                    <p className="text-[10px] font-black uppercase tracking-widest text-stone-500">Prioritas Terbesar</p>
                    <p className="mt-2 text-xl font-black text-stone-950">{dominantSoftskill?.subskill || "-"}</p>
                    <p className="mt-1 text-sm font-semibold text-stone-500">
                      Share {dominantSoftskill ? Math.round(dominantSoftskill.share * 100) : 0}% dari total pengaruh softskill. Softskill lain tetap memberi kontribusi sesuai bobotnya.
                    </p>
                  </div>
                </div>
                <div className="mt-6 grid gap-4 md:grid-cols-3">
                  <div className="rounded-2xl bg-white p-4 ring-1 ring-primary/20">
                    <p className="text-[10px] font-black uppercase tracking-widest text-stone-500">Criterion Packages</p>
                    <p className="mt-2 text-3xl font-black text-stone-950">{resultPackageEntries.length}</p>
                  </div>
                  <div className="rounded-2xl bg-white p-4 ring-1 ring-primary/20">
                    <p className="text-[10px] font-black uppercase tracking-widest text-stone-500">Weighted Links</p>
                    <p className="mt-2 text-3xl font-black text-stone-950">{resultSoftskillRows.length}</p>
                  </div>
                  <div className="rounded-2xl bg-white p-4 ring-1 ring-primary/20">
                    <p className="text-[10px] font-black uppercase tracking-widest text-stone-500">Max CR</p>
                    <p className="mt-2 text-3xl font-black text-stone-950">{Number(result.consistency || 0).toFixed(2)}</p>
                  </div>
                </div>
              </div>

              <div className="rounded-[2.5rem] border-2 border-stone-100 bg-white p-8 shadow-xl shadow-stone-200/50">
                <h2 className="mb-3 flex items-center gap-2 text-xl font-black uppercase tracking-tight text-stone-900">
                  <span className="material-symbols-outlined text-primary">donut_large</span>
                  Ringkasan Distribusi Softskill
                </h2>
                <p className="mb-6 text-sm leading-relaxed text-stone-600">
                  Semua softskill yang masuk perhitungan ditampilkan di sini. Share menunjukkan seberapa besar total pengaruh softskill tersebut dibanding seluruh bobot lokal yang muncul di semua criterion package.
                </p>
                <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50/70 p-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-amber-700">Cara membaca variabel tabel</p>
                  <div className="mt-3 grid gap-3 text-xs font-semibold leading-5 text-stone-600 md:grid-cols-2">
                    <p><strong className="text-stone-900">Packages</strong> = jumlah criterion yang memakai softskill tersebut sebagai evidence.</p>
                    <p><strong className="text-stone-900">Avg Weight</strong> = rata-rata bobot lokal softskill pada criterion yang memakainya.</p>
                    <p><strong className="text-stone-900">Distribution Share</strong> = porsi total pengaruh softskill terhadap seluruh hasil weighting.</p>
                    <p><strong className="text-stone-900">Input ATL</strong> memakai bobot lokal per criterion: rubric score x weight softskill pada criterion tersebut.</p>
                  </div>
                </div>
                <div className="mb-6 grid gap-3 md:grid-cols-3">
                  {[
                    ["Dominant", dominantSoftskill?.subskill || "-", dominantSoftskill ? `${Math.round(dominantSoftskill.share * 100)}% share` : "0% share"],
                    ["Secondary", secondarySoftskills.map((item) => item.subskill).join(", ") || "-", "Tetap dihitung"],
                    ["Scoring Impact", "Rubric Score x Weight", "Kontribusi ATL per criterion"],
                  ].map(([label, value, note]) => (
                    <div key={label} className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
                      <p className="text-[10px] font-black uppercase tracking-widest text-stone-500">{label}</p>
                      <p className="mt-2 line-clamp-2 text-sm font-black text-stone-900">{value}</p>
                      <p className="mt-1 text-xs font-semibold text-stone-500">{note}</p>
                    </div>
                  ))}
                </div>
                <div className="overflow-x-auto rounded-2xl border border-stone-200">
                  <table className="min-w-full divide-y divide-stone-200">
                    <thead className="bg-stone-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-stone-500">Softskill</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-stone-500">Packages</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-stone-500">Avg Weight</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-stone-500">Distribution Share</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-stone-500">Criterion Source</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-200 bg-white">
                      {resultDistribution.map((row, index) => {
                        const tone = getSubskillMeta(row.subskill, index);
                        return (
                          <tr key={row.subskill}>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-3">
                                <span
                                  className="flex h-8 w-8 items-center justify-center rounded-full"
                                  style={tone.solidStyle}
                                >
                                  <span className="material-symbols-outlined text-[17px]">{tone.icon}</span>
                                </span>
                                <span className="font-bold text-stone-900">{row.subskill}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-center text-sm font-black text-stone-700">{row.count}</td>
                            <td className="px-4 py-3 text-center text-sm font-black text-primary">{formatWeightDisplay(row.average)}</td>
                            <td className="px-4 py-3 text-center text-sm font-black text-stone-900">{Math.round(row.share * 100)}%</td>
                            <td className="px-4 py-3 text-sm font-semibold text-stone-600">{Array.from(new Set(row.criteria)).join(", ")}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

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
                          {Object.entries(pkg.weights || {}).map(([subskill, weight], index) => {
                            const tone = getSubskillMeta(subskill, index);
                            return (
                            <div key={subskill}>
                              <div className="mb-1 flex items-center justify-between gap-3">
                                <span className="min-w-0 truncate text-xs font-bold text-stone-700">{subskill}</span>
                                <span
                                  className="rounded border px-2 py-0.5 text-[10px] font-black"
                                  style={tone.chipStyle}
                                >
                                  {formatWeightDisplay(weight)}
                                </span>
                              </div>
                              <div className="h-2 overflow-hidden rounded-full bg-white">
                                <div className="h-full rounded-full" style={{ width: `${Math.min(Number(weight || 0) * 100, 100)}%`, backgroundColor: tone.colorHex }} />
                              </div>
                            </div>
                            );
                          })}
                        </div>
                      </section>
                    ))}
                  </div>
                </div>
              )}
              <div className="rounded-[2.5rem] border-2 border-stone-100 bg-white p-8 shadow-xl shadow-stone-200/50">
                <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <h2 className="flex items-center gap-2 text-xl font-black uppercase tracking-tight text-stone-900">
                      <span className="material-symbols-outlined text-primary">{activeResultVisual.icon}</span>
                      Visualisasi Hasil Bobot
                    </h2>
                    <p className="mt-2 max-w-3xl text-sm leading-relaxed text-stone-600">
                      Pilih visualisasi untuk membaca hasil dari sudut berbeda tanpa mengulang bar chart yang sudah muncul di bobot per criterion.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setResultHover(null);
                        setResultVisualIndex((index) => (index + resultVisualTabs.length - 1) % resultVisualTabs.length);
                      }}
                      className="flex h-10 w-10 items-center justify-center rounded-xl border border-stone-200 bg-white text-stone-600 transition hover:border-primary hover:text-primary"
                    >
                      <span className="material-symbols-outlined text-lg">chevron_left</span>
                    </button>
                    <div className="rounded-xl bg-primary/10 px-4 py-2 text-xs font-black text-primary">
                      {activeResultVisual.title}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setResultHover(null);
                        setResultVisualIndex((index) => (index + 1) % resultVisualTabs.length);
                      }}
                      className="flex h-10 w-10 items-center justify-center rounded-xl border border-stone-200 bg-white text-stone-600 transition hover:border-primary hover:text-primary"
                    >
                      <span className="material-symbols-outlined text-lg">chevron_right</span>
                    </button>
                  </div>
                </div>

                <div className="mb-6 rounded-3xl border border-amber-200 bg-amber-50 p-5">
                  <div className="flex items-start gap-4">
                    <span className="material-symbols-outlined flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-500 text-white">tips_and_updates</span>
                    <div>
                      <p className="text-[11px] font-black uppercase tracking-[0.2em] text-amber-800">Full Weight Analysis View</p>
                      <p className="mt-2 text-sm font-semibold leading-6 text-stone-700">
                        Bagian ini menampilkan semua subskill yang ikut dalam proses Fuzzy-AHP, bukan hanya yang dominan. Setiap criterion package punya bobot lokal sendiri, sehingga result view dipakai untuk membaca proses weighting lengkap.
                      </p>
                      <p className="mt-1 text-xs font-semibold leading-5 text-stone-500">
                        Dominant bukan satu-satunya yang dihitung. Subskill kecil tetap mempengaruhi skor akhir jika muncul pada rubric item.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
                  <div className="min-h-[360px] rounded-[2rem] border border-stone-200 bg-stone-50/60 p-6">
                    {activeResultVisual.key === "radar" && (
                      <div className="grid h-full gap-5 xl:grid-cols-[1fr_260px]">
                        <div className="flex flex-col items-center justify-center">
                          <svg viewBox="0 0 100 100" className="h-72 w-72 drop-shadow-sm">
                            {[0.25, 0.5, 0.75, 1].map((radius) => (
                              <circle key={radius} cx="50" cy="50" r={radius * 38} fill="none" stroke="#E7E5E4" strokeWidth="0.6" strokeDasharray="2 2" />
                            ))}
                            {radarPoints.map((point) => (
                              <line key={`axis-${point.subskill}`} x1="50" y1="50" x2={point.axisX} y2={point.axisY} stroke="#D6D3D1" strokeWidth="0.6" />
                            ))}
                            <polygon
                              points={radarPoints.map((point) => `${point.x},${point.y}`).join(" ")}
                              fill="rgba(245, 158, 11, 0.22)"
                              stroke="#F59E0B"
                              strokeWidth="2"
                            />
                            {radarPoints.map((point) => (
                              <g
                                key={`dot-${point.subskill}`}
                                onMouseEnter={() => setResultHover(point)}
                                onFocus={() => setResultHover(point)}
                                tabIndex="0"
                                className="cursor-pointer outline-none"
                              >
                                <circle cx={point.x} cy={point.y} r={resultHover?.subskill === point.subskill ? "4.3" : "3.1"} fill={point.color} opacity="0.18" />
                                <circle cx={point.x} cy={point.y} r="2.4" fill={point.color} stroke="#fff" strokeWidth="1" />
                              </g>
                            ))}
                          </svg>
                          <p className="mt-2 max-w-md text-center text-xs font-semibold leading-5 text-stone-500">
                            Radar membaca jarak bobot dari pusat. Bentuk yang runcing berarti satu softskill lebih dominan.
                          </p>
                          <div className="mt-4 grid w-full gap-2 sm:grid-cols-2">
                            {radarPoints.map((point) => (
                              <button
                                key={`radar-legend-${point.subskill}`}
                                type="button"
                                onMouseEnter={() => setResultHover(point)}
                                onFocus={() => setResultHover(point)}
                                className="flex min-w-0 items-center justify-between gap-3 rounded-xl border border-stone-200 bg-white px-3 py-2 text-left transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-sm"
                              >
                                <span className="flex min-w-0 items-center gap-2">
                                  <span className="h-3 w-3 shrink-0 rounded-full ring-4 ring-stone-100" style={{ backgroundColor: point.color }} />
                                  <span className="truncate text-[11px] font-black text-stone-800">{point.subskill}</span>
                                </span>
                                <span className="shrink-0 text-[11px] font-black text-stone-500">{Math.round(point.share * 100)}%</span>
                              </button>
                            ))}
                          </div>
                        </div>
                        <div className="self-center">
                          <ResultHoverCard item={activeResultInfo} mode="radar" />
                        </div>
                      </div>
                    )}

                    {activeResultVisual.key === "pie" && (
                      <div className="flex h-full flex-col justify-center gap-5">
                        <div className="grid items-center gap-5 xl:grid-cols-[1fr_260px]">
                          <div className="flex flex-col items-center">
                            <div
                              className="group relative flex h-72 w-72 items-center justify-center"
                              onMouseMove={handlePieHover}
                              onMouseEnter={() => donutSegments[0] && setResultHover(donutSegments[0])}
                            >
                              <div className="absolute inset-6 rounded-full bg-white shadow-[0_24px_60px_rgba(15,23,42,0.16)] transition duration-300 group-hover:scale-[1.03] group-hover:shadow-[0_30px_70px_rgba(15,23,42,0.22)]" />
                              <div
                                className="absolute inset-8 rounded-full border-[10px] border-white transition duration-300 group-hover:rotate-6 group-hover:scale-[1.04]"
                                style={{ background: pieGradient }}
                                title={`Process Total: ${formatWeightDisplay(resultDistributionRawTotal)}`}
                              />
                              <div className="absolute inset-[5.9rem] rounded-full bg-white shadow-inner" />
                              <div className="relative z-10 text-center">
                                <p className="text-[8px] font-black uppercase tracking-widest text-stone-400">Process Total</p>
                                <p className="mt-0.5 text-xl font-black text-stone-950">{formatWeightDisplay(resultDistributionRawTotal)}</p>
                                <p className="mt-0.5 text-[9px] font-bold text-stone-400">Full weighting</p>
                              </div>
                              <div className="pointer-events-none absolute -bottom-2 left-1/2 h-7 w-52 -translate-x-1/2 rounded-full bg-stone-900/10 blur-xl" />
                            </div>
                            <p className="max-w-xl text-center text-[11px] font-semibold leading-5 text-stone-500">
                              Arahkan cursor ke area pie atau legend untuk membaca subskill yang sedang disorot.
                            </p>
                          </div>
                          <ResultHoverCard item={activeResultInfo} mode="pie" />
                        </div>
                        <p className="max-w-xl text-center text-[11px] font-semibold leading-5 text-stone-500 xl:mx-auto">
                          Total ini adalah akumulasi bobot semua criterion package, bukan total recap dominant-subskill.
                        </p>
                        <div className="grid w-full gap-2 sm:grid-cols-2 xl:grid-cols-3">
                          {donutSegments.map((segment) => (
                            <div
                              key={segment.subskill}
                              onMouseEnter={() => setResultHover(segment)}
                              onFocus={() => setResultHover(segment)}
                              tabIndex="0"
                              className="group flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-stone-200 bg-white px-3 py-2 outline-none transition hover:-translate-y-0.5 hover:border-stone-300 hover:shadow-md focus:border-primary/50 focus:ring-2 focus:ring-primary/15"
                              title={`${segment.subskill}: ${formatWeightDisplay(segment.total)} (${Math.round(segment.share * 100)}%)`}
                            >
                              <div className="flex min-w-0 items-center gap-2">
                                <span className="h-3 w-3 shrink-0 rounded-full ring-4 ring-stone-100 transition group-hover:scale-125" style={{ backgroundColor: segment.color }} />
                                <span className="truncate text-xs font-black text-stone-800">{segment.subskill}</span>
                              </div>
                              <div className="shrink-0 text-right">
                                <p className="text-xs font-black text-stone-950">{formatWeightDisplay(segment.total)}</p>
                                <p className="text-[10px] font-bold text-stone-400">{Math.round(segment.share * 100)}%</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {activeResultVisual.key === "coverage" && (
                      <div className="flex h-full flex-col gap-4">
                        <div className="overflow-x-auto">
                          <table className="min-w-[820px] border-separate border-spacing-2">
                            <thead>
                              <tr>
                                <th className="sticky left-0 z-10 rounded-xl bg-white px-3 py-3 text-left text-[10px] font-black uppercase tracking-widest text-stone-400 shadow-sm">Criterion Package</th>
                                {resultDistribution.map((row) => (
                                  <th key={row.subskill} className="rounded-xl bg-white px-3 py-3 text-center text-[10px] font-black text-stone-700 shadow-sm">
                                    <span className="line-clamp-2">{row.subskill}</span>
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {resultPackageEntries.map(([packageKey, pkg]) => (
                                <tr key={packageKey}>
                                  <td className="sticky left-0 z-10 min-w-[220px] rounded-xl border border-stone-200 bg-white px-3 py-3 shadow-sm">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-primary">{pkg.criteriaTopic}</p>
                                    <p className="mt-1 text-xs font-black text-stone-900">{pkg.title}</p>
                                  </td>
                                  {resultDistribution.map((row, index) => {
                                    const weight = Number(pkg.weights?.[row.subskill] || 0);
                                    const color = getSubskillColorHex(row.subskill, index);
                                    const isZero = weight <= 0;
                                    return (
                                      <td
                                        key={`${packageKey}-${row.subskill}`}
                                        className={`min-w-[108px] rounded-xl border p-3 ${isZero ? "border-stone-100 bg-white/70" : "border-stone-200 bg-white shadow-sm"}`}
                                      >
                                        <div className="mb-2 flex items-center justify-between gap-2">
                                          <span className="text-[10px] font-black text-stone-400">W</span>
                                          <span className={`text-xs font-black ${isZero ? "text-stone-300" : "text-stone-900"}`}>{formatWeightDisplay(weight)}</span>
                                        </div>
                                        <div className="h-2 overflow-hidden rounded-full bg-stone-100">
                                          <div
                                            className="h-full rounded-full transition-all"
                                            style={{ width: `${Math.min(weight * 100, 100)}%`, backgroundColor: isZero ? "#E7E5E4" : color }}
                                          />
                                        </div>
                                      </td>
                                    );
                                  })}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        <div className="grid gap-2 rounded-2xl border border-stone-200 bg-white p-4 text-[11px] font-semibold leading-5 text-stone-600 md:grid-cols-3">
                          <p><strong className="text-stone-900">W</strong> = local weight subskill dalam criterion package.</p>
                          <p><strong className="text-stone-900">0.00</strong> = subskill tidak berpengaruh pada package tersebut.</p>
                          <p>Semakin panjang bar, semakin besar kontribusi pada package itu.</p>
                        </div>
                      </div>
                    )}
                  </div>

                  <aside className="rounded-[2rem] border border-primary/20 bg-primary/5 p-5">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-white">
                      <span className="material-symbols-outlined">{activeResultVisual.icon}</span>
                    </div>
                    <h3 className="mt-4 text-lg font-black text-stone-950">{activeResultVisual.title}</h3>
                    <p className="mt-2 text-sm font-semibold leading-6 text-stone-600">{activeResultVisual.description}</p>
                    <div className="mt-5 rounded-2xl border border-white/80 bg-white p-4">
                      <p className="text-[10px] font-black uppercase tracking-widest text-stone-400">Cara Dibaca</p>
                      <h4 className="mt-2 text-sm font-black text-stone-950">{activeResultVisual.guide.title}</h4>
                      <p className="mt-2 text-xs font-semibold leading-5 text-stone-600">
                        {activeResultVisual.guide.intro}
                      </p>
                      <div className="mt-3 space-y-2 text-[11px] font-semibold leading-5 text-stone-500">
                        {activeResultVisual.guide.points.map((point, index) => (
                          <p key={point} className="flex gap-2">
                            <span className="mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[9px] font-black text-primary">{index + 1}</span>
                            <span>{point}</span>
                          </p>
                        ))}
                      </div>
                      <div className="mt-4 rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-[11px] font-semibold leading-5 text-amber-900">
                        Nilai akhir siswa tetap dihitung dari level rubrik pada input ATL, lalu dikalikan dengan bobot softskill yang relevan.
                      </div>
                    </div>
                  </aside>
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

          {step === 2 ? (
            <button
              onClick={calculateResult}
              disabled={calculatingWeights || rubricPackages.length === 0 || scaleDirty || scaleInvalid}
              className="flex items-center gap-2 rounded-2xl bg-stone-950 px-8 py-3 text-sm font-black text-white shadow-xl shadow-stone-950/20 transition-all hover:bg-stone-800 hover:-translate-y-0.5 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <span className="material-symbols-outlined text-lg">{calculatingWeights ? "hourglass_top" : "calculate"}</span>
              {calculatingWeights ? "Menghitung di Backend..." : "Hitung Bobot"}
            </button>
          ) : step < 4 ? (
            <button
              onClick={() => setStep(step + 1)}
              className="flex items-center gap-2 rounded-2xl bg-stone-950 px-8 py-3 text-sm font-black text-white shadow-xl shadow-stone-950/20 transition-all hover:bg-stone-800 hover:-translate-y-0.5 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {step === 3 ? "Lihat Result" : "Lanjutkan"} <span className="material-symbols-outlined text-lg">arrow_forward</span>
            </button>
          ) : (
            <button 
              onClick={handleSaveToSystem}
              disabled={savingWeights}
              className="flex items-center gap-2 rounded-2xl bg-primary px-8 py-3 text-sm font-black text-white shadow-xl shadow-primary/20 transition-all hover:bg-secondary hover:-translate-y-0.5 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <span className="material-symbols-outlined text-lg">{savingWeights ? "hourglass_top" : "save"}</span>
              {savingWeights ? "Menyimpan..." : "Simpan Bobot ke Sistem"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ExpertManagement;

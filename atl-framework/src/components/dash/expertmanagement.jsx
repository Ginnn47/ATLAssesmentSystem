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
const SAVED_WEIGHT_META_KEYS = ["__mode", "packages", "__savedAt", "__activity"];
const formatWeightDisplay = (weight) => Number(weight || 0).toFixed(2);
const weightPercent = (weight) => `${Math.round(Number(weight || 0) * 100)}%`;
const describeWeight = (weight) => {
  const value = Number(weight || 0);
  if (value >= 0.6) return "Strong analytical contribution";
  if (value >= 0.35) return "Major contextual contribution";
  if (value >= 0.15) return "Supporting contribution";
  return "Minor evidence contribution";
};
const subskillIconTone = (subskill = "", index = 0) => {
  const toneMap = {
    "Critical Thingking": { icon: "psychology_alt", bg: "bg-[#00E5E5]", bar: "bg-[#00E5E5]" },
    "Critical Thinking": { icon: "psychology_alt", bg: "bg-[#00E5E5]", bar: "bg-[#00E5E5]" },
    "Creative Thingking": { icon: "lightbulb", bg: "bg-[#0B0787]", bar: "bg-[#0B0787]" },
    "Creative Thinking": { icon: "lightbulb", bg: "bg-[#0B0787]", bar: "bg-[#0B0787]" },
    InformationTransfer: { icon: "sync_alt", bg: "bg-[#1100FF]", bar: "bg-[#1100FF]" },
    "Reflection / Metacognitive": { icon: "neurology", bg: "bg-[#4B8DBB]", bar: "bg-[#4B8DBB]" },
    "Textual Literacy": { icon: "article", bg: "bg-red-600", bar: "bg-red-600" },
    "Media Literacy": { icon: "perm_media", bg: "bg-red-500", bar: "bg-red-500" },
    "Ethical use of information": { icon: "shield", bg: "bg-red-700", bar: "bg-red-700" },
    "Exchanging-information": { icon: "chat_bubble", bg: "bg-purple-600", bar: "bg-purple-600" },
    "Literacy skills": { icon: "menu_book", bg: "bg-purple-500", bar: "bg-purple-500" },
    "ICT skills": { icon: "devices", bg: "bg-purple-700", bar: "bg-purple-700" },
    "Interpersonal relationships": { icon: "groups", bg: "bg-green-600", bar: "bg-green-600" },
    "Social-emotional intelligence": { icon: "diversity_3", bg: "bg-green-500", bar: "bg-green-500" },
    "Organization skills": { icon: "event_note", bg: "bg-orange-600", bar: "bg-orange-600" },
    "State of Mind": { icon: "self_improvement", bg: "bg-orange-500", bar: "bg-orange-500" },
  };
  if (toneMap[subskill]) return toneMap[subskill];
  return [
    { icon: "auto_awesome", bg: "bg-amber-500", bar: "bg-amber-500" },
    { icon: "psychology", bg: "bg-violet-500", bar: "bg-violet-500" },
    { icon: "groups", bg: "bg-green-500", bar: "bg-green-500" },
    { icon: "business_center", bg: "bg-red-500", bar: "bg-red-500" },
  ][index % 4];
};
const subskillColorHex = (subskill = "", index = 0) => {
  const colorMap = {
    "Critical Thingking": "rgb(0, 229, 229)",
    "Creative Thinking": "rgb(11, 7, 135)",
    "InformationTransfer": "rgb(17, 0, 255)",
    "Reflection / Metacognitive": "rgb(75, 141, 187)",
    "Textual Literacy": "rgb(243, 147, 73)",
    "Media Literacy": "rgb(243, 0, 0)",
    "Ethical use of information": "rgb(93, 2, 2)",
    "Exchanging-information": "rgb(128, 9, 240)",
    "Literacy skills": "rgb(168, 85, 247)",
    "ICT skills": "rgb(41, 3, 74)",
    "Interpersonal relationships": "rgb(22, 163, 74)",
    "Social-emotional intelligence": "rgb(34, 197, 94)",
    "Organization skills": "rgb(232, 248, 6)",
    "State of Mind": "rgb(219, 245, 136)",
  };
  if (colorMap[subskill]) return colorMap[subskill];
  return ["#F59E0B", "#8B5CF6", "#22C55E", "#EF4444"][index % 4];
};

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

// NOTE: calculateResult must live inside ExpertManagement so it can access component state.

const ExpertManagement = ({ onAddCriteriaClick, onTopicChange }) => {
  const [subjectData, setSubjectData] = useState(getSubjectData);
  const [step, setStep] = useState(1);
  const [selectedSubjectId, setSelectedSubjectId] = useState(getSubjectData()[0].id);
  const [selectedTopicId, setSelectedTopicId] = useState(getSubjectData()[0].topics[0].id);

  const [pairwise, setPairwise] = useState({});
  const [result, setResult] = useState(null);
  const [dataVersion, setDataVersion] = useState(0);
  const [resultVisualIndex, setResultVisualIndex] = useState(0);

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
      const pairwiseTrace = Object.values(pairwise[pkg.key] || {}).map((trace) => {
        const scaleObj = scaleOptions.find((scale) => scale.label === trace.scale);
        return {
          left: trace.left,
          right: trace.right,
          scale: trace.scale,
          tfn: scaleObj?.tfn || [1, 1, 1],
        };
      });
      packageResults[pkg.key] = {
        ...localResult,
        title: pkg.title,
        criteriaTopic: pkg.criteriaTopic,
        subskills: pkg.subskills,
        pairwiseTrace,
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
        const mergedPackages = Object.entries(apiResult.packages || packageResults).reduce((acc, [key, pkg]) => {
          acc[key] = {
            ...(packageResults[key] || {}),
            ...pkg,
            pairwiseTrace: packageResults[key]?.pairwiseTrace || pkg.pairwiseTrace || [],
          };
          return acc;
        }, {});
        setResult({ ...localResult, ...apiResult, packages: mergedPackages });
      }
    } catch (error) {
      setResult(localResult);
    }
  };

  const handleSaveToSystem = async () => {
    if (!result || !result.weights) return;
    
    if (!dummyATL.savedWeights) dummyATL.savedWeights = {};
    const selectedSubject = subjectData.find((subject) => subject.id === selectedSubjectId);
    const selectedTopic = selectedSubject?.topics.find((topic) => topic.id === selectedTopicId);
    const savedAt = new Date().toISOString();
    const savedActivity = {
      topicId: selectedTopicId,
      topicLabel: selectedTopic?.label || selectedTopicId,
      subjectId: selectedSubjectId,
      subjectLabel: selectedSubject?.label || selectedSubjectId,
      savedAt,
      packageCount: Object.keys(result.packages || {}).length,
      weightedLinkCount: Object.keys(result.weights || {}).length,
      maxConsistency: Number(result.consistency || 0),
    };
    dummyATL.savedWeights[selectedTopicId] = {
      ...(result.weights || {}),
      __mode: "criterion-packages",
      packages: result.packages || {},
      __savedAt: savedAt,
      __activity: savedActivity,
    };
    dummyATL.savedWeightActivities = [
      savedActivity,
      ...(dummyATL.savedWeightActivities || []).filter((activity) => activity.topicId !== selectedTopicId),
    ].slice(0, 6);
    
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
  const savedTopicWeights = dummyATL.savedWeights?.[selectedTopicId] || {};
  const savedPackages = savedTopicWeights.packages || {};
  const recentSavedActivities = dummyATL.savedWeightActivities || [];
  const hasSavedWeight =
    Object.keys(savedPackages).length > 0 ||
    Object.keys(savedTopicWeights).some((key) => !SAVED_WEIGHT_META_KEYS.includes(key));

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
      color: subskillColorHex(row.subskill, index),
    };
  });
  let donutCursor = 0;
  const donutSegments = resultDistribution.map((row, index) => {
    const share = resultDistributionTotal > 0 ? row.total / resultDistributionTotal : 0;
    const segment = {
      ...row,
      color: subskillColorHex(row.subskill, index),
      dash: `${share * 100} ${100 - share * 100}`,
      offset: 25 - donutCursor * 100,
    };
    donutCursor += share;
    return segment;
  });
  const resultVisualTabs = [
    {
      key: "radar",
      icon: "radar",
      title: "Radar Weight Profile",
      description: "Melihat keseimbangan pengaruh antar softskill. Semakin jauh titik dari tengah, semakin besar total bobotnya.",
    },
    {
      key: "donut",
      icon: "donut_large",
      title: "Donut Distribution",
      description: "Melihat porsi kontribusi setiap softskill terhadap total bobot. Legend tetap menampilkan softskill bernilai 0.00.",
    },
    {
      key: "coverage",
      icon: "schema",
      title: "Criterion Coverage Map",
      description: "Melihat criterion mana yang menjadi sumber bobot setiap softskill sebelum dipakai pada input ATL siswa.",
    },
  ];
  const activeResultVisual = resultVisualTabs[resultVisualIndex] || resultVisualTabs[0];

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
              <button
                type="button"
                disabled={!hasSavedWeight}
                onClick={() => openSavedWeightStep(4)}
                className="rounded-xl border border-primary/25 bg-white px-3 py-2 text-left text-[11px] font-black text-primary transition hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Lihat Result
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
                            const tone = subskillIconTone(atlSkill, skillIndex);
                            return (
                            <span key={atlSkill} className={`inline-flex max-w-full items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-black text-white ${tone.bg}`}>
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

          {/* STEP 2: SUBSKILL */}
          {false && step === 2 && (
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

          {/* STEP 2: PAIRWISE (CORE UI) */}
          {step === 2 && (
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

          {/* STEP 3: FUZZY-AHP PROCESS */}
          {step === 3 && (() => {
            const packageEntries = Object.entries(result?.packages || {});
            const [activePackageKey, activePackage] = packageEntries[0] || [];
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
                  <button
                    type="button"
                    onClick={() => setStep(4)}
                    className="inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-4 py-2 text-xs font-black text-stone-700 transition-all hover:border-primary/40 hover:bg-primary/5"
                  >
                    <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                    Lihat Result
                  </button>
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
                        const tone = subskillIconTone(row.subskill, index);
                        return (
                          <tr key={row.subskill}>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-3">
                                <span className={`flex h-8 w-8 items-center justify-center rounded-full text-white ${tone.bg}`}>
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
                      onClick={() => setResultVisualIndex((index) => (index + resultVisualTabs.length - 1) % resultVisualTabs.length)}
                      className="flex h-10 w-10 items-center justify-center rounded-xl border border-stone-200 bg-white text-stone-600 transition hover:border-primary hover:text-primary"
                    >
                      <span className="material-symbols-outlined text-lg">chevron_left</span>
                    </button>
                    <div className="rounded-xl bg-primary/10 px-4 py-2 text-xs font-black text-primary">
                      {activeResultVisual.title}
                    </div>
                    <button
                      type="button"
                      onClick={() => setResultVisualIndex((index) => (index + 1) % resultVisualTabs.length)}
                      className="flex h-10 w-10 items-center justify-center rounded-xl border border-stone-200 bg-white text-stone-600 transition hover:border-primary hover:text-primary"
                    >
                      <span className="material-symbols-outlined text-lg">chevron_right</span>
                    </button>
                  </div>
                </div>

                <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
                  <div className="min-h-[360px] rounded-[2rem] border border-stone-200 bg-stone-50/60 p-6">
                    {activeResultVisual.key === "radar" && (
                      <div className="flex h-full flex-col items-center justify-center">
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
                            <circle key={`dot-${point.subskill}`} cx={point.x} cy={point.y} r="2.4" fill={point.color} stroke="#fff" strokeWidth="1" />
                          ))}
                        </svg>
                        <p className="mt-2 text-center text-xs font-semibold leading-5 text-stone-500">
                          Radar membantu melihat apakah bobot terkonsentrasi pada satu softskill atau menyebar ke beberapa softskill.
                        </p>
                      </div>
                    )}

                    {activeResultVisual.key === "donut" && (
                      <div className="grid h-full gap-6 lg:grid-cols-[260px_1fr]">
                        <div className="flex items-center justify-center">
                          <div className="relative h-64 w-64">
                            <svg viewBox="0 0 42 42" className="h-full w-full -rotate-90">
                              <circle cx="21" cy="21" r="15.915" fill="transparent" stroke="#F5F5F4" strokeWidth="7" />
                              {donutSegments.map((segment) => (
                                <circle
                                  key={segment.subskill}
                                  cx="21"
                                  cy="21"
                                  r="15.915"
                                  fill="transparent"
                                  stroke={segment.color}
                                  strokeWidth="7"
                                  strokeDasharray={segment.dash}
                                  strokeDashoffset={segment.offset}
                                />
                              ))}
                            </svg>
                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                              <span className="text-[10px] font-black uppercase tracking-widest text-stone-400">Total</span>
                              <span className="text-2xl font-black text-stone-950">{formatWeightDisplay(resultDistributionRawTotal)}</span>
                            </div>
                          </div>
                        </div>
                        <div className="space-y-2 overflow-y-auto pr-1">
                          {donutSegments.map((segment) => (
                            <div key={segment.subskill} className="flex items-center justify-between gap-3 rounded-xl border border-stone-200 bg-white px-3 py-2">
                              <div className="flex min-w-0 items-center gap-2">
                                <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: segment.color }} />
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
                      <div className="h-full overflow-x-auto">
                        <div className="min-w-[720px]">
                          <div className="grid gap-2" style={{ gridTemplateColumns: `220px repeat(${Math.max(resultDistribution.length, 1)}, minmax(92px, 1fr))` }}>
                            <div className="rounded-xl bg-white px-3 py-2 text-[10px] font-black uppercase tracking-widest text-stone-400">Criterion</div>
                            {resultDistribution.map((row, index) => (
                              <div key={row.subskill} className="rounded-xl bg-white px-3 py-2 text-center text-[10px] font-black text-stone-700">
                                <span className="line-clamp-2">{row.subskill}</span>
                              </div>
                            ))}
                            {resultPackageEntries.map(([packageKey, pkg]) => (
                              <React.Fragment key={packageKey}>
                                <div className="rounded-xl border border-stone-200 bg-white px-3 py-3">
                                  <p className="text-[10px] font-black uppercase tracking-widest text-primary">{pkg.criteriaTopic}</p>
                                  <p className="mt-1 text-xs font-black text-stone-900">{pkg.title}</p>
                                </div>
                                {resultDistribution.map((row, index) => {
                                  const weight = Number(pkg.weights?.[row.subskill] || 0);
                                  return (
                                    <div key={`${packageKey}-${row.subskill}`} className="rounded-xl border border-stone-200 bg-white p-3">
                                      <div className="mb-2 flex items-center justify-between">
                                        <span className="text-[10px] font-black text-stone-400">W</span>
                                        <span className="text-xs font-black text-stone-900">{formatWeightDisplay(weight)}</span>
                                      </div>
                                      <div className="h-2 overflow-hidden rounded-full bg-stone-100">
                                        <div className="h-full rounded-full" style={{ width: `${Math.min(weight * 100, 100)}%`, backgroundColor: subskillColorHex(row.subskill, index) }} />
                                      </div>
                                    </div>
                                  );
                                })}
                              </React.Fragment>
                            ))}
                          </div>
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
                      <p className="mt-2 text-xs font-semibold leading-5 text-stone-600">
                        Visualisasi ini hanya menjelaskan importance weight. Nilai siswa tetap dihitung saat guru memilih level rubric pada input ATL: fuzzy rubric score dikalikan bobot softskill yang relevan.
                      </p>
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

          {step < 4 ? (
            <button
              onClick={() => setStep(step + 1)}
              disabled={step === 2 && !result}
              className="flex items-center gap-2 rounded-2xl bg-stone-900 px-8 py-3 text-sm font-black text-white shadow-xl shadow-stone-950/20 transition-all hover:bg-stone-800 hover:-translate-y-0.5 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
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

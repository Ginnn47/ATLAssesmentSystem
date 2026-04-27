import React, { useState, useMemo, useEffect } from "react";
import { dummyATL, saveATLData } from "./dummyATL";

 const scaleOptions = [
  { label: "Sama penting", value: 1, tfn: [1, 1, 1] },
  { label: "Sedikit lebih penting", value: 3, tfn: [2, 3, 4] },
  { label: "Lebih penting", value: 5, tfn: [4, 5, 6] },
  { label: "Sangat lebih penting", value: 7, tfn: [6, 7, 8] },
  { label: "Mutlak lebih penting", value: 9, tfn: [8, 9, 9] },
 ];
 
const subjectData = [
  { id: "singing", label: "Singing", topics: [
    { id: "singing_christmas_carol", label: "Christmas Carol" },
    { id: "singing_choir", label: "Choir" },
    { id: "singing_vocal_technique", label: "Vocal Technique" },
    { id: "singing_music_theory_basics", label: "Music Theory Basics" },
    { id: "singing_performance_practice", label: "Performance Practice" }
  ]},
  { id: "ipa", label: "IPA (Sains)", topics: [
    { id: "ipa_energi_perubahan", label: "Energi Perubahan" },
    { id: "ipa_tata_surya", label: "Tata Surya" },
    { id: "ipa_sistem_tubuh", label: "Sistem Tubuh" },
    { id: "ipa_ekosistem", label: "Ekosistem" }
  ]},
  { id: "math", label: "Mathematics", topics: [
    { id: "math_linear_equations", label: "Linear Equations" },
    { id: "math_quadratic_functions", label: "Quadratic Functions" },
    { id: "math_geometry", label: "Geometry" },
    { id: "math_trigonometry", label: "Trigonometry" },
    { id: "math_statistics", label: "Statistics" }
  ]}
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
const MIN_WEIGHT_FLOOR = 0.01;
const formatWeightDisplay = (weight) => Number(weight || 0).toFixed(2);

// NOTE: calculateResult must live inside ExpertManagement so it can access component state.

const ExpertManagement = ({ onAddCriteriaClick, onTopicChange }) => {
  const [step, setStep] = useState(1);
  const [selectedSubjectId, setSelectedSubjectId] = useState(subjectData[0].id);
  const [selectedTopicId, setSelectedTopicId] = useState(subjectData[0].topics[0].id);

  const [pairwise, setPairwise] = useState({});
  const [result, setResult] = useState(null);

  const calculateResult = () => {
    const n = criteria.length;
    if (n === 0) return;

    // 1. Build matrix TFN nxn
    let matrix = Array(n).fill(0).map(() =>
      Array(n).fill([1, 1, 1])
    );

    // isi dari pairwise
    Object.values(pairwise).forEach((val) => {
      const i = criteria.indexOf(val.left);
      const j = criteria.indexOf(val.right);

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

    // Terapkan minimum floor lalu normalisasi ulang agar total tetap 1
    const flooredWeights = normalizedWeights.map((w) => Math.max(w, MIN_WEIGHT_FLOOR));
    const flooredSum = flooredWeights.reduce((acc, w) => acc + w, 0);
    const finalWeights = flooredSum > 0 ? flooredWeights.map((w) => w / flooredSum) : Array(n).fill(1 / n);

    criteria.forEach((c, i) => {
      weights[c] = finalWeights[i].toFixed(WEIGHT_PRECISION);
    });

    setResult({
      weights,
      sumD: sumD.toFixed(2),
      consistency: 0.042, // Mock consistency ratio untuk demo
      debug: { matrix, rowSums, total, S, V, d: d.map(val => val.toFixed(2)) }
    });
  };

  const handleSaveToSystem = () => {
    if (!result || !result.weights) return;
    
    if (!dummyATL.savedWeights) dummyATL.savedWeights = {};
    dummyATL.savedWeights[selectedTopicId] = result.weights;
    
    saveATLData(dummyATL);
    alert(`Bobot untuk topik ${selectedTopicId} berhasil disimpan secara permanen!`);
  };

  // Ambil kriteria dengan ATL skills dari dummyATL berdasarkan topik yang dipilih
  const criteriaWithATL = useMemo(() => {
    const rawData = dummyATL[selectedTopicId] || [];
    const tempMap = {};

    rawData.forEach(item => {
      item.atl.forEach(atlSkill => {
        // Gunakan format label yang bersih untuk menghindari duplikasi key
        const label = `${item.kriteria} (${atlSkill})`;
        tempMap[label] = [atlSkill];
      });
    });

    return tempMap;
  }, [selectedTopicId]);

  const criteria = useMemo(() => Object.keys(criteriaWithATL), [criteriaWithATL]);

  const pairs = useMemo(() => {
    let pairs = [];
    for (let i = 0; i < criteria.length; i++) {
      for (let j = i + 1; j < criteria.length; j++) {
        pairs.push([criteria[i], criteria[j]]);
      }
    }
    return pairs;
  }, [criteria]);

  // Reset pairwise jika kriteria berubah
  useEffect(() => {
    setPairwise({});
    setResult(null);
  }, [criteria]);

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
    { id: 2, name: "Kriteria", icon: "list_alt" },
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

          {/* STEP 2: KRITERIA */}
          {step === 2 && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <h2 className="mb-6 text-xl font-black text-stone-900">Kriteria dalam Topik "{subjectData.find(s => s.id === selectedSubjectId)?.topics.find(t => t.id === selectedTopicId)?.label}"</h2>
              <div className="grid gap-4 md:grid-cols-3">
                {criteria.map((c, i) => (
                  <div key={i} className="group relative overflow-hidden rounded-2xl border-2 border-stone-100 bg-white p-6 shadow-sm transition-all hover:border-primary/50 hover:shadow-md">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-black text-stone-800">{c}</span>
                      <div className="h-6 w-6 rounded-full bg-emerald-500 flex items-center justify-center text-white">
                        <span className="material-symbols-outlined text-sm font-bold">check</span>
                      </div>
                    </div>
                    <p className="mt-4 text-[10px] font-bold uppercase tracking-widest text-stone-400">ATL Skills</p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {criteriaWithATL[c]?.map((atlSkill, idx) => (
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
                  <h2 className="text-xl font-black text-stone-900 italic underline decoration-primary decoration-4 underline-offset-4">Interactive Comparison</h2>
                  <p className="text-xs text-stone-500 mt-2 font-bold">Hasil bobot akan ter-update secara otomatis di layar Anda.</p>
                </div>
                <span className="p-4 bg-primary/5 rounded-2xl border border-primary/20">
                  <p className="text-[10px] font-black uppercase text-primary tracking-widest mb-1 text-right">Real-time Status</p>
                  <p className="text-sm font-black text-stone-900">
                    {Object.keys(pairwise).length} / {pairs.length} Perbandingan Terisi
                  </p>
                </span>
              </div>

              <div className="space-y-16 pb-12">
                {pairs.map(([c1, c2], idx) => (
                  <div key={idx} className="relative flex flex-col items-center">
                    <div className="mb-8 flex w-full items-center justify-between px-8">
                      <div className="text-center w-1/3">
                        <span className="block text-[10px] font-black uppercase text-stone-400 mb-2 tracking-tighter">Kriteria A</span>
                        <h4 className="text-lg font-black text-stone-900 underline decoration-stone-200 mb-2">{c1}</h4>
                        <div className="flex flex-wrap justify-center gap-1">
                          {criteriaWithATL[c1]?.map((atlSkill, idx) => (
                            <span key={idx} className="inline-flex items-center rounded-full bg-blue-50 px-2 py-1 text-[8px] font-bold text-blue-700">
                              {atlSkill}
                            </span>
                          )) || []}
                        </div>
                      </div>
                      <div className="flex-1 flex items-center justify-center px-4">
                        <div className="h-px w-full bg-gradient-to-r from-transparent via-stone-200 to-transparent relative">
                          <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-stone-50 px-3 text-xs font-black text-stone-400">VS</span>
                        </div>
                      </div>
                      <div className="text-center w-1/3">
                        <span className="block text-[10px] font-black uppercase text-stone-400 mb-2 tracking-tighter">Kriteria B</span>
                        <h4 className="text-lg font-black text-stone-900 underline decoration-stone-200 mb-2">{c2}</h4>
                        <div className="flex flex-wrap justify-center gap-1">
                          {criteriaWithATL[c2]?.map((atlSkill, idx) => (
                            <span key={idx} className="inline-flex items-center rounded-full bg-blue-50 px-2 py-1 text-[8px] font-bold text-blue-700">
                              {atlSkill}
                            </span>
                          )) || []}
                        </div>
                      </div>
                    </div>

                    <div className="grid w-full grid-cols-5 gap-3">
                      {scaleOptions.map((opt) => {
                        const isActive = pairwise[idx]?.scale === opt.label;
                        return (
                          <button
                            key={opt.label}
                            onClick={() => setPairwise({ ...pairwise, [idx]: { left: c1, right: c2, scale: opt.label } })}
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
            </div>
          )}

          {/* STEP 4: FUZZY SCALE */}
          {step === 4 && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-8">
              <div className="mb-2">
                <h2 className="text-2xl font-black text-stone-900">Mathematical Calculation Flow</h2>
                <p className="text-sm text-stone-500 mt-2 leading-relaxed max-w-3xl">
                  Bagian ini menunjukkan transformasi data dari pilihan verbal yang Anda masukkan menjadi bobot matematis menggunakan logika 
                  <strong> Chang's Extent Analysis</strong>. Ikuti langkah-langkah di bawah untuk memahami bagaimana sistem memproses kriteria ATL Anda.
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
                              <th className="px-4 py-4 text-left text-[10px] font-bold uppercase tracking-widest text-stone-500">Kriteria</th>
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
                        Akumulasi Bobot per Kriteria (Row Sums)
                      </h3>
                      <p className="text-sm text-stone-600 mb-6 leading-relaxed">
                        Sistem menjumlahkan seluruh nilai TFN pada setiap baris untuk melihat total intensitas kepentingan setiap kriteria 
                        relatif terhadap kriteria lainnya.
                      </p>
                      <div className="overflow-x-auto rounded-2xl border border-stone-100 bg-stone-50/50">
                        <table className="min-w-full divide-y divide-stone-200">
                          <thead className="bg-stone-100/50">
                            <tr>
                              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-stone-500">Kriteria</th>
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
                        untuk mendapatkan <i>Synthetic Extent</i> dari masing-masing kriteria.
                      </p>
                      <div className="overflow-x-auto rounded-2xl border border-stone-100 bg-stone-50/50">
                        <table className="min-w-full divide-y divide-stone-200">
                          <thead className="bg-stone-100/50">
                            <tr>
                              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-stone-500">Kriteria</th>
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
                        Pada tahap ini, setiap nilai S_i dibandingkan satu sama lain untuk melihat kemungkinan suatu kriteria lebih besar dari kriteria lainnya. 
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
              <div className="rounded-[2.5rem] border-2 border-stone-100 bg-white p-10 shadow-xl shadow-stone-200/50">
                <div className="flex flex-col gap-8 lg:flex-row">
                  <div className="flex-1">
                    <h2 className="mb-4 text-xl font-black text-stone-900 uppercase tracking-tight flex items-center gap-2">
                      <span className="material-symbols-outlined text-primary">analytics</span> Hasil Bobot Penilaian
                    </h2>
                    <p className="mb-8 text-sm text-stone-600 leading-relaxed">
                      Berdasarkan perbandingan berpasangan yang telah dilakukan, kriteria di bawah ini telah dikonversi menjadi bobot prioritas. 
                      Bobot ini menentukan seberapa besar pengaruh sebuah kriteria terhadap total nilai ATL siswa pada topik 
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
                            const r = (parseFloat(result.weights[c]) / Math.max(...Object.values(result.weights).map(Number)) || 0) * 40;
                            return `${50 + r * Math.cos(angle)},${50 + r * Math.sin(angle)}`;
                          }).join(" ")}
                          fill="rgba(234, 179, 8, 0.2)"
                          stroke="#EAB308"
                          strokeWidth="2"
                        />
                      </svg>
                    </div>
                    <p className="mt-4 text-center text-[10px] leading-relaxed text-stone-500 italic">
                      Visualisasi di atas menunjukkan keseimbangan prioritas antar kriteria ATL yang terpilih.
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-[2.5rem] border-2 border-stone-100 bg-white p-10 shadow-xl shadow-stone-200/50">
                <h2 className="mb-8 text-xl font-black text-stone-900 uppercase tracking-tight flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">grid_on</span> Matriks Derajat Kemungkinan (V)
                </h2>
                <p className="mb-6 text-sm text-stone-600">
                  Tabel ini membandingkan setiap pasangan <i>Synthetic Extent</i> (S_i) untuk menentukan probabilitas kriteria satu lebih dominan dari kriteria lainnya.
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
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-stone-500">Kriteria</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-stone-500">Vektor d (Min)</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-stone-500">Bobot (W)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-200 bg-white">
                      {criteria.map((crit, idx) => {
                        const weight = result.weights[crit];
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

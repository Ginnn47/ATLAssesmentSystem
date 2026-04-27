import React, { useState } from "react";
import { dummyATL, saveATLData } from "./dummyATL";

// ATL Icons and Colors
const atlConfig = {
  Thinking: { icon: "psychology", color: "bg-blue-100 text-blue-700", bgLight: "bg-blue-50" },
  Communication: { icon: "chat", color: "bg-purple-100 text-purple-700", bgLight: "bg-purple-50" },
  Social: { icon: "group", color: "bg-green-100 text-green-700", bgLight: "bg-green-50" },
  "Self-Management": { icon: "self_improvement", color: "bg-orange-100 text-orange-700", bgLight: "bg-orange-50" },
  Research: { icon: "explore", color: "bg-red-100 text-red-700", bgLight: "bg-red-50" },
};

export default function criteriamanagement() {
  // Subjects with colors
  const subjects = [
    {
      id: "singing",
      label: "Singing",
      icon: "music_note",
      color: "rose",
      bgColor: "bg-rose-50",
      borderColor: "border-rose-200",
      textColor: "text-rose-700",
      badgeColor: "bg-rose-100 text-rose-700",
      accentBorder: "border-rose-300",
    },
    {
      id: "ipa",
      label: "IPA (Sains)",
      icon: "science",
      color: "emerald",
      bgColor: "bg-emerald-50",
      borderColor: "border-emerald-200",
      textColor: "text-emerald-700",
      badgeColor: "bg-emerald-100 text-emerald-700",
      accentBorder: "border-emerald-300",
    },
    {
      id: "math",
      label: "Mathematics",
      icon: "calculate",
      color: "amber",
      bgColor: "bg-amber-50",
      borderColor: "border-amber-200",
      textColor: "text-amber-700",
      badgeColor: "bg-amber-100 text-amber-700",
      accentBorder: "border-amber-300",
    },
  ];

  // Sub-topics structure
  const subtopics = {
    singing: [
      { id: "singing_christmas_carol", label: "Christmas Carol", description: "Musik & Gerak Berkelompok" },
      { id: "singing_choir", label: "Choir", description: "Paduan Suara" },
      { id: "singing_vocal_technique", label: "Vocal Technique", description: "Latihan Teknik Vokal" },
      { id: "singing_music_theory_basics", label: "Music Theory Basics", description: "Dasar Teori Musik" },
      { id: "singing_performance_practice", label: "Performance Practice", description: "Latihan Pertunjukan" },
    ],
    ipa: [
      { id: "ipa_energi_perubahan", label: "Energi Perubahan", description: "Eksperimen Energi" },
      { id: "ipa_sistem_tubuh", label: "Sistem Tubuh", description: "Anatomi dan Fisiologi" },
      { id: "ipa_ekosistem", label: "Ekosistem", description: "Interaksi Makhluk Hidup" },
      { id: "ipa_tata_surya", label: "Tata Surya", description: "Planet dan Benda Langit" },
    ],
    math: [
      { id: "math_linear_equations", label: "Linear Equations", description: "Persamaan Linear" },
      { id: "math_quadratic_functions", label: "Quadratic Functions", description: "Fungsi Kuadrat" },
      { id: "math_geometry", label: "Geometry", description: "Geometri & Bentuk" },
      { id: "math_trigonometry", label: "Trigonometry", description: "Trigonometri" },
      { id: "math_statistics", label: "Statistics", description: "Statistika & Data" },
    ],
  };

  // ATL options
  const atlOptions = [
    "Thinking",
    "Communication",
    "Social",
    "Self-Management",
    "Research",
  ];

  // State management
  const [selectedSubject, setSelectedSubject] = useState("singing");
  const [selectedSubtopic, setSelectedSubtopic] = useState("singing_christmas_carol");
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingIndex, setEditingIndex] = useState(null);
  const [, setDataVersion] = useState(0);

  // Form state
  const [formData, setFormData] = useState({
    kriteria: "",
    atl: [],
    levels: {
      NFI: "",
      PTE: "",
      DE: "",
      ME: "",
      EE: "",
    },
  });

  // Get current criteria list
  const currentCriteria = dummyATL[selectedSubtopic] || [];

  // Get current subject config
  const currentSubjectConfig = subjects.find((s) => s.id === selectedSubject);
  const currentSubtopics = subtopics[selectedSubject] || [];

  const handleATLToggle = (atl) => {
    setFormData((prev) => ({
      ...prev,
      atl: prev.atl.includes(atl)
        ? prev.atl.filter((a) => a !== atl)
        : [...prev.atl, atl],
    }));
  };

  const handleLevelChange = (level, value) => {
    setFormData((prev) => ({
      ...prev,
      levels: {
        ...prev.levels,
        [level]: value,
      },
    }));
  };

  const buildWeightKey = (criteriaName, atlName) => `${criteriaName} (${atlName})`;
  const buildRatingKey = (topicId, criteriaName, atlName) => `${topicId}_${criteriaName}_${atlName}`;

  const persistATLChanges = () => {
    saveATLData(dummyATL);
    setDataVersion((v) => v + 1);
    window.dispatchEvent(new Event("atl-data-updated"));
  };

  const syncCriterionReferences = (topicId, previousCriterion, nextCriterion) => {
    if (!previousCriterion || !nextCriterion) return;

    const previousName = previousCriterion.kriteria;
    const nextName = nextCriterion.kriteria;
    const previousATL = previousCriterion.atl || [];
    const nextATL = nextCriterion.atl || [];

    const previousATLSet = new Set(previousATL);
    const nextATLSet = new Set(nextATL);

    const retainedATL = nextATL.filter((atlName) => previousATLSet.has(atlName));
    const removedATL = previousATL.filter((atlName) => !nextATLSet.has(atlName));

    const topicWeights = dummyATL.savedWeights?.[topicId];
    if (topicWeights) {
      retainedATL.forEach((atlName) => {
        const oldWeightKey = buildWeightKey(previousName, atlName);
        const newWeightKey = buildWeightKey(nextName, atlName);

        if (
          oldWeightKey !== newWeightKey &&
          Object.prototype.hasOwnProperty.call(topicWeights, oldWeightKey)
        ) {
          if (!Object.prototype.hasOwnProperty.call(topicWeights, newWeightKey)) {
            topicWeights[newWeightKey] = topicWeights[oldWeightKey];
          }
          delete topicWeights[oldWeightKey];
        }
      });

      removedATL.forEach((atlName) => {
        const oldWeightKey = buildWeightKey(previousName, atlName);
        delete topicWeights[oldWeightKey];
      });
    }

    if (dummyATL.savedAssessments) {
      Object.values(dummyATL.savedAssessments).forEach((studentAssessments) => {
        const topicAssessments = studentAssessments?.[topicId];
        if (!topicAssessments) return;

        retainedATL.forEach((atlName) => {
          const oldRatingKey = buildRatingKey(topicId, previousName, atlName);
          const newRatingKey = buildRatingKey(topicId, nextName, atlName);

          if (
            oldRatingKey !== newRatingKey &&
            Object.prototype.hasOwnProperty.call(topicAssessments, oldRatingKey)
          ) {
            if (!Object.prototype.hasOwnProperty.call(topicAssessments, newRatingKey)) {
              topicAssessments[newRatingKey] = topicAssessments[oldRatingKey];
            }
            delete topicAssessments[oldRatingKey];
          }
        });

        removedATL.forEach((atlName) => {
          const oldRatingKey = buildRatingKey(topicId, previousName, atlName);
          delete topicAssessments[oldRatingKey];
        });
      });
    }
  };

  const removeCriterionReferences = (topicId, criterionToDelete) => {
    if (!criterionToDelete) return;

    const criterionName = criterionToDelete.kriteria;
    const criterionATL = criterionToDelete.atl || [];

    const topicWeights = dummyATL.savedWeights?.[topicId];
    if (topicWeights) {
      criterionATL.forEach((atlName) => {
        delete topicWeights[buildWeightKey(criterionName, atlName)];
      });
    }

    if (dummyATL.savedAssessments) {
      Object.values(dummyATL.savedAssessments).forEach((studentAssessments) => {
        const topicAssessments = studentAssessments?.[topicId];
        if (!topicAssessments) return;

        criterionATL.forEach((atlName) => {
          delete topicAssessments[buildRatingKey(topicId, criterionName, atlName)];
        });
      });
    }
  };

  const handleAddCriteria = () => {
    if (
      !formData.kriteria ||
      formData.atl.length === 0 ||
      !Object.values(formData.levels).every((v) => v.trim())
    ) {
      alert("Mohon isi semua field!");
      return;
    }

    if (!dummyATL[selectedSubtopic]) {
      dummyATL[selectedSubtopic] = [];
    }

    const normalizedFormData = {
      kriteria: formData.kriteria.trim(),
      atl: [...formData.atl],
      levels: { ...formData.levels },
    };

    if (editingIndex !== null) {
      // Update existing criteria
      const previousCriterion = dummyATL[selectedSubtopic][editingIndex];
      dummyATL[selectedSubtopic][editingIndex] = normalizedFormData;
      syncCriterionReferences(selectedSubtopic, previousCriterion, normalizedFormData);
      setEditingIndex(null);
    } else {
      // Add new criteria
      dummyATL[selectedSubtopic].push(normalizedFormData);
    }

    persistATLChanges();

    setFormData({
      kriteria: "",
      atl: [],
      levels: {
        NFI: "",
        PTE: "",
        DE: "",
        ME: "",
        EE: "",
      },
    });
    setShowAddForm(false);
  };

  const handleEditCriteria = (index) => {
    const existing = dummyATL[selectedSubtopic][index];
    setFormData({
      kriteria: existing.kriteria,
      atl: [...(existing.atl || [])],
      levels: { ...existing.levels },
    });
    setEditingIndex(index);
    setShowAddForm(true);
  };

  const handleDeleteCriteria = (index) => {
    if (confirm("Apakah Anda yakin ingin menghapus kriteria ini?")) {
      const deletedCriterion = dummyATL[selectedSubtopic][index];
      dummyATL[selectedSubtopic].splice(index, 1);
      removeCriterionReferences(selectedSubtopic, deletedCriterion);
      persistATLChanges();
    }
  };

  const handleCancel = () => {
    setShowAddForm(false);
    setEditingIndex(null);
    setFormData({
      kriteria: "",
      atl: [],
      levels: {
        NFI: "",
        PTE: "",
        DE: "",
        ME: "",
        EE: "",
      },
    });
  };

  const levelDescriptions = {
    NFI: "Tidak Mencapai",
    PTE: "Pendekatan Awal",
    DE: "Berkembang",
    ME: "Menguasai",
    EE: "Melampaui",
  };

  return (
    <div className="space-y-8">
      {/* Subject Selection - Card Based */}
      <div>
        <h3 className="text-sm font-bold uppercase tracking-wider text-text-main-light mb-4">
          Pilih Mata Pelajaran
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {subjects.map((subject) => (
            <button
              key={subject.id}
              onClick={() => {
                setSelectedSubject(subject.id);
                setSelectedSubtopic(subtopics[subject.id][0].id);
                setShowAddForm(false);
              }}
              className={`group relative overflow-hidden rounded-2xl border-2 p-6 transition-all duration-300 ${
                selectedSubject === subject.id
                  ? `${subject.borderColor} ${subject.bgColor} shadow-[0_12px_28px_rgba(0,0,0,0.1)]`
                  : "border-stone-200/90 bg-white hover:border-stone-300/90 hover:shadow-md"
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 text-left">
                  <div className={`inline-flex items-center justify-center w-12 h-12 rounded-xl ${subject.badgeColor} mb-3`}>
                    <span className="material-symbols-outlined text-xl">{subject.icon}</span>
                  </div>
                  <h4 className={`text-lg font-bold ${selectedSubject === subject.id ? subject.textColor : "text-text-main-light"}`}>
                    {subject.label}
                  </h4>
                  <p className="text-sm text-text-sub-light mt-1">
                    {subtopics[subject.id].length} Sub Topik
                  </p>
                </div>
                {selectedSubject === subject.id && (
                  <span className="material-symbols-outlined text-2xl text-primary">check_circle</span>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Sub-topic Selection - Grid Based */}
      <div>
        <h3 className="text-sm font-bold uppercase tracking-wider text-text-main-light mb-4">
          Pilih Sub Topik
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
          {currentSubtopics.map((subtopic) => (
            <button
              key={subtopic.id}
              onClick={() => {
                setSelectedSubtopic(subtopic.id);
                setShowAddForm(false);
              }}
              className={`group rounded-xl border-2 p-4 transition-all duration-300 text-left ${
                selectedSubtopic === subtopic.id
                  ? `${currentSubjectConfig?.borderColor} ${currentSubjectConfig?.bgColor} shadow-[0_8px_16px_rgba(0,0,0,0.1)]`
                  : "border-stone-200/90 bg-white hover:border-stone-300/90 hover:shadow-md"
              }`}
            >
              <div className="flex items-start justify-between mb-2">
                <span className={`text-2xl ${selectedSubtopic === subtopic.id ? "opacity-100" : "opacity-50"}`}>
                  {currentSubjectConfig?.id === "singing" ? "🎤" : currentSubjectConfig?.id === "ipa" ? "🧪" : "📐"}
                </span>
                {selectedSubtopic === subtopic.id && (
                  <span className={`material-symbols-outlined text-lg ${currentSubjectConfig?.textColor}`}>
                    check_circle
                  </span>
                )}
              </div>
              <h4 className={`font-bold text-sm ${selectedSubtopic === subtopic.id ? currentSubjectConfig?.textColor : "text-text-main-light"}`}>
                {subtopic.label}
              </h4>
              <p className="text-xs text-text-sub-light mt-1 line-clamp-2">{subtopic.description}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Criteria List Section */}
      <div className="rounded-2xl border border-stone-200/90 bg-white p-6 shadow-[0_8px_16px_rgba(15,23,42,0.04)]">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-text-main-light">
              Daftar Kriteria ({currentCriteria.length})
            </h3>
            <p className="text-xs text-text-sub-light mt-1">
              {subtopics[selectedSubject].find((s) => s.id === selectedSubtopic)?.label}
            </p>
          </div>
          <button
            onClick={() => {
              setShowAddForm(!showAddForm);
              if (showAddForm) handleCancel();
            }}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white shadow-lg shadow-primary/20 transition-all duration-300 hover:-translate-y-0.5 hover:bg-primary-hover"
          >
            <span className="material-symbols-outlined text-lg">add</span>
            Tambah Kriteria
          </button>
        </div>

        {/* Criteria Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {currentCriteria.map((criteria, index) => (
            <div
              key={index}
              className={`rounded-xl border-2 p-4 shadow-sm hover:shadow-md transition-all duration-300 ${currentSubjectConfig?.borderColor} bg-white`}
            >
              {/* Criteria Name */}
              <h4 className={`font-bold mb-3 line-clamp-2 ${currentSubjectConfig?.textColor}`}>
                {criteria.kriteria}
              </h4>

              {/* ATL Tags with Icons */}
              <div className="flex flex-wrap gap-2 mb-4">
                {criteria.atl.map((atl, idx) => (
                  <span
                    key={idx}
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold ${atlConfig[atl]?.color}`}
                  >
                    <span className="material-symbols-outlined text-sm">{atlConfig[atl]?.icon}</span>
                    {atl}
                  </span>
                ))}
              </div>

              {/* Level Preview */}
              <div className="space-y-2 mb-4">
                {Object.entries(criteria.levels).map(([level, desc]) => (
                  <div key={level} className="text-xs">
                    <span className={`font-bold ${currentSubjectConfig?.textColor}`}>{level}</span>
                    <p className="text-text-sub-light line-clamp-1">
                      {desc}
                    </p>
                  </div>
                ))}
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-3 border-t border-stone-200/90">
                <button
                  onClick={() => handleEditCriteria(index)}
                  className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-lg border-2 text-sm font-semibold transition-all ${currentSubjectConfig?.textColor} ${currentSubjectConfig?.borderColor} hover:${currentSubjectConfig?.bgColor}`}
                >
                  <span className="material-symbols-outlined text-base">edit</span>
                  Edit
                </button>
                <button
                  onClick={() => handleDeleteCriteria(index)}
                  className="flex-1 flex items-center justify-center gap-1 py-2 rounded-lg border-2 border-red-500/30 text-red-600 text-sm font-semibold hover:bg-red-500/5 transition-colors"
                >
                  <span className="material-symbols-outlined text-base">delete</span>
                  Hapus
                </button>
              </div>
            </div>
          ))}
        </div>

        {currentCriteria.length === 0 && (
          <div className="text-center py-8">
            <span className="material-symbols-outlined text-5xl text-text-sub-light mb-3 block opacity-50">
              assignment
            </span>
            <p className="text-text-sub-light font-medium">
              Belum ada kriteria. Tambahkan kriteria baru untuk sub-topik ini.
            </p>
          </div>
        )}
      </div>

      {/* Add/Edit Criteria Form */}
      {showAddForm && (
        <div className={`rounded-2xl border-2 p-8 shadow-[0_12px_28px_rgba(234,179,8,0.08)] ${currentSubjectConfig?.bgColor} ${currentSubjectConfig?.borderColor}`}>
          <div className="flex items-center gap-2 mb-6">
            <span className="material-symbols-outlined text-2xl text-primary">
              {editingIndex !== null ? "edit_note" : "add_circle"}
            </span>
            <h3 className="text-lg font-bold text-text-main-light">
              {editingIndex !== null ? "Edit Kriteria" : "Tambah Kriteria Baru"}
            </h3>
          </div>

          <div className="space-y-6">
            {/* Criteria Name Input */}
            <div>
              <label className="block text-sm font-semibold text-text-main-light mb-2">
                Nama Kriteria
              </label>
              <input
                type="text"
                value={formData.kriteria}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    kriteria: e.target.value,
                  }))
                }
                placeholder="Contoh: Self-Management & Leadership"
                className="w-full px-4 py-2 rounded-lg border border-stone-200/90 bg-white text-text-main-light focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            {/* ATL Selection */}
            <div>
              <label className="block text-sm font-semibold text-text-main-light mb-3">
                Pilih ATL (Approaches to Learning)
              </label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {atlOptions.map((atl) => (
                  <label
                    key={atl}
                    className={`flex items-center gap-3 p-3 rounded-lg border-2 bg-white cursor-pointer transition-all ${
                      formData.atl.includes(atl)
                        ? `${atlConfig[atl]?.color} border-current`
                        : "border-stone-200/90 hover:border-stone-300/90"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={formData.atl.includes(atl)}
                      onChange={() => handleATLToggle(atl)}
                      className="w-5 h-5 cursor-pointer"
                    />
                    <span className="flex items-center gap-1 text-sm font-medium">
                      <span className="material-symbols-outlined text-sm">{atlConfig[atl]?.icon}</span>
                      {atl}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* Level Descriptions */}
            <div className="space-y-4">
              <label className="block text-sm font-semibold text-text-main-light">
                Deskripsi Level Penilaian (5 Level)
              </label>
              <p className="text-xs text-text-sub-light mb-3">
                Guru berpikir dalam deskripsi, bukan angka. Masukkan deskripsi yang jelas dan terukur untuk setiap level.
              </p>

              <div className="bg-white rounded-xl p-4 space-y-3">
                {["NFI", "PTE", "DE", "ME", "EE"].map((level) => (
                  <div key={level}>
                    <label className="block text-sm font-bold text-text-main-light mb-1">
                      <span className="text-primary">{level}</span> — {levelDescriptions[level]}
                    </label>
                    <textarea
                      value={formData.levels[level]}
                      onChange={(e) =>
                        handleLevelChange(level, e.target.value)
                      }
                      placeholder={`Deskripsi untuk level ${level}...`}
                      className="w-full px-3 py-2 rounded-lg border border-stone-200/90 bg-white text-text-main-light text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                      rows="2"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4">
              <button
                onClick={handleAddCriteria}
                className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 text-sm font-bold text-white shadow-lg shadow-primary/20 transition-all duration-300 hover:-translate-y-0.5 hover:bg-primary-hover"
              >
                <span className="material-symbols-outlined">
                  {editingIndex !== null ? "save_as" : "save"}
                </span>
                {editingIndex !== null ? "Simpan Perubahan" : "Simpan Kriteria"}
              </button>
              <button
                onClick={handleCancel}
                className="flex-1 flex items-center justify-center gap-2 rounded-lg border-2 border-stone-200/90 px-4 py-3 text-sm font-bold text-text-main-light hover:bg-white transition-colors"
              >
                <span className="material-symbols-outlined">close</span>
                Batal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

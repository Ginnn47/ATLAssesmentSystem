import React, { useEffect, useState } from "react";
import { dummyATL, saveATLData } from "./dummyATL";
import { createContext, createCriterion, deleteCriterion, getATLHierarchy, getCriteria, updateCriterion } from "../../services/atlApi";
import { addCustomSubtopic, getSubjectData } from "../../services/topicCatalog";

// ATL Icons and Colors
const atlConfig = {
  Thinking: { icon: "psychology", color: "bg-blue-100 text-blue-700", bgLight: "bg-blue-50" },
  Communication: { icon: "chat", color: "bg-purple-100 text-purple-700", bgLight: "bg-purple-50" },
  Social: { icon: "group", color: "bg-green-100 text-green-700", bgLight: "bg-green-50" },
  "Self-Management": { icon: "self_improvement", color: "bg-orange-100 text-orange-700", bgLight: "bg-orange-50" },
  Research: { icon: "explore", color: "bg-red-100 text-red-700", bgLight: "bg-red-50" },
  "Thinking Skills": { icon: "psychology", color: "bg-blue-100 text-blue-700", bgLight: "bg-blue-50" },
  "Communication Skills": { icon: "chat", color: "bg-purple-100 text-purple-700", bgLight: "bg-purple-50" },
  "Social Skills": { icon: "group", color: "bg-green-100 text-green-700", bgLight: "bg-green-50" },
  "Self-Management Skills": { icon: "self_improvement", color: "bg-orange-100 text-orange-700", bgLight: "bg-orange-50" },
  "Research Skills": { icon: "explore", color: "bg-red-100 text-red-700", bgLight: "bg-red-50" },
  "Critical Thingking": { icon: "psychology", color: "bg-blue-100 text-blue-700", bgLight: "bg-blue-50" },
  "Creative Thingking": { icon: "lightbulb", color: "bg-blue-100 text-blue-700", bgLight: "bg-blue-50" },
  InformationTransfer: { icon: "sync_alt", color: "bg-blue-100 text-blue-700", bgLight: "bg-blue-50" },
  "Reflection / Metacognitive": { icon: "neurology", color: "bg-blue-100 text-blue-700", bgLight: "bg-blue-50" },
  "Textual Literacy": { icon: "article", color: "bg-red-100 text-red-700", bgLight: "bg-red-50" },
  "Media Literacy": { icon: "perm_media", color: "bg-red-100 text-red-700", bgLight: "bg-red-50" },
  "Ethical use of information": { icon: "verified_user", color: "bg-red-100 text-red-700", bgLight: "bg-red-50" },
  "Exchanging-information": { icon: "forum", color: "bg-purple-100 text-purple-700", bgLight: "bg-purple-50" },
  "Literacy skills": { icon: "menu_book", color: "bg-purple-100 text-purple-700", bgLight: "bg-purple-50" },
  "ICT skills": { icon: "devices", color: "bg-purple-100 text-purple-700", bgLight: "bg-purple-50" },
  "Interpersonal relationships": { icon: "groups", color: "bg-green-100 text-green-700", bgLight: "bg-green-50" },
  "Social-emotional intelligence": { icon: "diversity_3", color: "bg-green-100 text-green-700", bgLight: "bg-green-50" },
  "Organization skills": { icon: "event_note", color: "bg-orange-100 text-orange-700", bgLight: "bg-orange-50" },
  "State of Mind": { icon: "self_improvement", color: "bg-orange-100 text-orange-700", bgLight: "bg-orange-50" },
};
const fallbackAtlConfig = { icon: "label", color: "bg-stone-100 text-stone-700", bgLight: "bg-stone-50" };

export default function criteriamanagement() {
  const subjectStyles = {
    singing: { icon: "music_note", bgColor: "bg-rose-50", borderColor: "border-rose-200", textColor: "text-rose-700", badgeColor: "bg-rose-100 text-rose-700", accentBorder: "border-rose-300" },
    ipa: { icon: "science", bgColor: "bg-emerald-50", borderColor: "border-emerald-200", textColor: "text-emerald-700", badgeColor: "bg-emerald-100 text-emerald-700", accentBorder: "border-emerald-300" },
    math: { icon: "calculate", bgColor: "bg-amber-50", borderColor: "border-amber-200", textColor: "text-amber-700", badgeColor: "bg-amber-100 text-amber-700", accentBorder: "border-amber-300" },
  };

  const buildSubjects = () =>
    getSubjectData().map((subject) => ({
      ...subject,
      ...(subjectStyles[subject.id] || subjectStyles.singing),
    }));

  // State management
  const [subjects, setSubjects] = useState(buildSubjects);
  const [selectedSubject, setSelectedSubject] = useState("singing");
  const [selectedSubtopic, setSelectedSubtopic] = useState("singing_christmas_carol");
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingIndex, setEditingIndex] = useState(null);
  const [, setDataVersion] = useState(0);
  const [atlHierarchy, setAtlHierarchy] = useState([]);
  const [newSubtopicName, setNewSubtopicName] = useState("");
  const [newSubtopicDescription, setNewSubtopicDescription] = useState("");

  // Form state
  const [formData, setFormData] = useState({
    kriteria: "",
    atl: [],
    criteriaTopic: "",
    categoryId: "",
    categoryIds: [],
    subskillId: "",
    subskillIds: [],
    subskillName: "",
    categoryName: "",
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
  const currentSubtopics = subjects.find((subject) => subject.id === selectedSubject)?.topics || [];

  const findSubskillMeta = (value, categoryName) => {
    for (const category of atlHierarchy) {
      for (const subskill of category.subskills || []) {
        if (
          String(subskill.id) === String(value) ||
          subskill.name === value ||
          (categoryName && category.name === categoryName && subskill.name === value)
        ) {
          return { category, subskill };
        }
      }
    }
    return null;
  };

  const selectedCategories = atlHierarchy.filter((category) => (formData.categoryIds || []).map(String).includes(String(category.id)));
  const selectedCategorySubskills = selectedCategories.flatMap((category) => category.subskills || []);
  const selectedSubskills = selectedCategorySubskills.filter((subskill) => (formData.subskillIds || []).map(String).includes(String(subskill.id)));
  const selectedCategory = selectedCategories[0] || atlHierarchy[0];
  const selectedSubskill = selectedSubskills[0] || selectedCategorySubskills[0] || selectedCategory?.subskills?.[0];

  const findCategoryForSubskill = (subskillIdOrName) =>
    atlHierarchy.find((category) =>
      (category.subskills || []).some(
        (subskill) => String(subskill.id) === String(subskillIdOrName) || subskill.name === subskillIdOrName
      )
    );

  const getCriteriaSubskillNames = (criteria) =>
    Array.isArray(criteria.atl) ? criteria.atl : criteria.atl ? [criteria.atl] : [];

  const getCriteriaCategoryNames = (criteria) => {
    if (Array.isArray(criteria.atlCategories) && criteria.atlCategories.length > 0) return criteria.atlCategories;
    if (Array.isArray(criteria.categories) && criteria.categories.length > 0) return criteria.categories;
    if (criteria.category) return criteria.category.split(",").map((item) => item.trim()).filter(Boolean);
    return [];
  };

  const setCategorySelection = (category) => {
    const currentCategoryIds = (formData.categoryIds || []).map(String);
    const isActive = currentCategoryIds.includes(String(category.id));
    const categorySubskillIds = (category.subskills || []).map((subskill) => subskill.id);
    const nextCategoryIds = isActive
      ? currentCategoryIds.filter((id) => id !== String(category.id))
      : [...currentCategoryIds, String(category.id)];
    const nextSubskillIds = isActive
      ? (formData.subskillIds || []).filter((id) => !categorySubskillIds.map(String).includes(String(id)))
      : Array.from(new Set([...(formData.subskillIds || []), ...categorySubskillIds]));
    const nextSubskills = atlHierarchy
      .flatMap((item) => item.subskills || [])
      .filter((subskill) => nextSubskillIds.map(String).includes(String(subskill.id)));

    setFormData((prev) => ({
      ...prev,
      categoryIds: nextCategoryIds,
      categoryId: nextCategoryIds[0] || "",
      categoryName: atlHierarchy.find((item) => String(item.id) === String(nextCategoryIds[0]))?.name || "",
      subskillIds: nextSubskillIds,
      subskillId: nextSubskillIds[0] || "",
      subskillName: nextSubskills[0]?.name || "",
      atl: nextSubskills.map((subskill) => subskill.name),
    }));
  };

  const setSubskillSelection = (subskill) => {
    const current = (formData.subskillIds || []).map(String);
    const isActive = current.includes(String(subskill.id));
    const nextSubskillIds = isActive
      ? current.filter((id) => id !== String(subskill.id))
      : [...current, String(subskill.id)];
    const nextSubskills = atlHierarchy
      .flatMap((item) => item.subskills || [])
      .filter((item) => nextSubskillIds.map(String).includes(String(item.id)));
    setFormData((prev) => ({
      ...prev,
      subskillIds: nextSubskillIds,
      subskillId: nextSubskillIds[0] || "",
      subskillName: nextSubskills[0]?.name || "",
      atl: nextSubskills.map((item) => item.name),
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

  useEffect(() => {
    const syncTopics = () => setSubjects(buildSubjects());
    window.addEventListener("atl-topics-updated", syncTopics);
    return () => window.removeEventListener("atl-topics-updated", syncTopics);
  }, []);

  const handleAddSubtopic = async () => {
    if (!newSubtopicName.trim()) {
      alert("Nama subtopik wajib diisi.");
      return;
    }

    const created = addCustomSubtopic(selectedSubject, newSubtopicName, newSubtopicDescription);
    if (!created) return;

    const nextSubjects = buildSubjects();
    setSubjects(nextSubjects);
    dummyATL[created.id] = dummyATL[created.id] || [];
    persistATLChanges();

    const subject = nextSubjects.find((item) => item.id === selectedSubject);
    await createContext({
      grade: "Grade 3",
      subjectName: subject?.label || selectedSubject,
      unitName: created.label,
      description: created.description,
      legacyTopicCode: created.id,
    });

    setSelectedSubtopic(created.id);
    setNewSubtopicName("");
    setNewSubtopicDescription("");
  };

  useEffect(() => {
    let cancelled = false;
    Promise.all([getCriteria(selectedSubtopic), getATLHierarchy()]).then(([, hierarchy]) => {
      if (cancelled) return;
      setAtlHierarchy(hierarchy || []);
      const firstCategory = hierarchy?.[0];
      const firstSubskill = firstCategory?.subskills?.[0];
      if (!formData.categoryId && firstCategory && firstSubskill) {
        setFormData((prev) => ({
          ...prev,
          categoryId: firstCategory.id,
          categoryIds: [firstCategory.id],
          categoryName: firstCategory.name,
          subskillId: firstSubskill.id,
          subskillIds: firstCategory.subskills?.map((subskill) => subskill.id) || [firstSubskill.id],
          subskillName: firstSubskill.name,
          atl: firstCategory.subskills?.map((subskill) => subskill.name) || [firstSubskill.name],
        }));
      }
      if (!cancelled) setDataVersion((v) => v + 1);
    });
    return () => {
      cancelled = true;
    };
  }, [selectedSubtopic]);

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

  const handleAddCriteria = async () => {
    const chosenSubskills = selectedSubskills.length > 0 ? selectedSubskills : selectedCategorySubskills;
    const chosenCategoryIds = Array.from(
      new Set(chosenSubskills.map((subskill) => findCategoryForSubskill(subskill.id)?.id).filter(Boolean))
    );
    const chosenCategories = atlHierarchy.filter((category) => chosenCategoryIds.map(String).includes(String(category.id)));

    if (
      !formData.criteriaTopic.trim() ||
      !formData.kriteria ||
      chosenCategories.length === 0 ||
      chosenSubskills.length === 0 ||
      !Object.values(formData.levels).every((v) => v.trim())
    ) {
      alert("Mohon isi semua field!");
      return;
    }

    if (!dummyATL[selectedSubtopic]) {
      dummyATL[selectedSubtopic] = [];
    }

    const normalizedFormData = {
      criteriaTopic: formData.criteriaTopic.trim(),
      kriteria: formData.kriteria.trim(),
      atl: chosenSubskills.map((subskill) => subskill.name),
      atlCategories: chosenCategories.map((category) => category.name),
      category: chosenCategories.map((category) => category.name).join(", "),
      categoryIds: chosenCategories.map((category) => category.id),
      subskillIds: chosenSubskills.map((subskill) => subskill.id),
      subskillId: chosenSubskills[0]?.id || "",
      subskillName: chosenSubskills.map((subskill) => subskill.name).join(", "),
      levels: { ...formData.levels },
    };

    if (editingIndex !== null) {
      // Update existing criteria
      const previousCriterion = dummyATL[selectedSubtopic][editingIndex];
      dummyATL[selectedSubtopic][editingIndex] = normalizedFormData;
      syncCriterionReferences(selectedSubtopic, previousCriterion, normalizedFormData);
      const savedCriterion = await updateCriterion(previousCriterion.id, normalizedFormData);
      if (savedCriterion?.id) {
        dummyATL[selectedSubtopic][editingIndex] = {
          ...dummyATL[selectedSubtopic][editingIndex],
          id: savedCriterion.id,
          category: savedCriterion.category || normalizedFormData.category,
          atlCategories: savedCriterion.atlCategories || normalizedFormData.atlCategories,
          atl: savedCriterion.atl || normalizedFormData.atl,
          subskillId: savedCriterion.subskillId || normalizedFormData.subskillId,
          subskillIds: savedCriterion.subskillIds || normalizedFormData.subskillIds,
          criteriaTopic: savedCriterion.criteriaTopic || normalizedFormData.criteriaTopic,
        };
      }
      setEditingIndex(null);
    } else {
      // Add new criteria
      dummyATL[selectedSubtopic].push(normalizedFormData);
      const createdCriterion = await createCriterion(selectedSubtopic, normalizedFormData);
      if (createdCriterion?.id) {
        dummyATL[selectedSubtopic][dummyATL[selectedSubtopic].length - 1] = {
          ...normalizedFormData,
          id: createdCriterion.id,
          category: createdCriterion.category || normalizedFormData.category,
          atlCategories: createdCriterion.atlCategories || normalizedFormData.atlCategories,
          atl: createdCriterion.atl || normalizedFormData.atl,
          subskillId: createdCriterion.subskillId || normalizedFormData.subskillId,
          subskillIds: createdCriterion.subskillIds || normalizedFormData.subskillIds,
          criteriaTopic: createdCriterion.criteriaTopic || normalizedFormData.criteriaTopic,
        };
      }
    }

    persistATLChanges();

    setFormData({
      kriteria: "",
      criteriaTopic: "",
      atl: selectedSubskills.map((subskill) => subskill.name),
      categoryId: selectedCategory?.id || "",
      categoryIds: formData.categoryIds || [],
      categoryName: selectedCategory?.name || "",
      subskillId: selectedSubskill?.id || "",
      subskillIds: formData.subskillIds || [],
      subskillName: selectedSubskill?.name || "",
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
    const existingSubskillNames = getCriteriaSubskillNames(existing);
    const existingSubskillIds = Array.isArray(existing.subskillIds) ? existing.subskillIds : [];
    const metas = [
      ...existingSubskillIds.map((id) => findSubskillMeta(id)),
      ...existingSubskillNames.map((name) => findSubskillMeta(name)),
    ].filter(Boolean);
    const uniqueCategories = Array.from(new Map(metas.map((meta) => [String(meta.category.id), meta.category])).values());
    const uniqueSubskills = Array.from(new Map(metas.map((meta) => [String(meta.subskill.id), meta.subskill])).values());
    const fallbackMeta =
      findSubskillMeta(existing.subskillId) ||
      findSubskillMeta(existing.atl?.[0], existing.category) ||
      { category: selectedCategory, subskill: selectedSubskill };
    const finalCategories = uniqueCategories.length > 0 ? uniqueCategories : [fallbackMeta.category].filter(Boolean);
    const finalSubskills = uniqueSubskills.length > 0 ? uniqueSubskills : [fallbackMeta.subskill].filter(Boolean);
    setFormData({
      criteriaTopic: existing.criteriaTopic || "",
      kriteria: existing.kriteria,
      atl: finalSubskills.map((subskill) => subskill.name),
      categoryId: finalCategories[0]?.id || "",
      categoryIds: finalCategories.map((category) => category.id),
      categoryName: finalCategories.map((category) => category.name).join(", ") || existing.category || "",
      subskillId: finalSubskills[0]?.id || existing.subskillId || "",
      subskillIds: finalSubskills.map((subskill) => subskill.id),
      subskillName: finalSubskills.map((subskill) => subskill.name).join(", ") || existing.atl?.[0] || "",
      levels: { ...existing.levels },
    });
    setEditingIndex(index);
    setShowAddForm(true);
  };

  const handleDeleteCriteria = async (index) => {
    if (confirm("Apakah Anda yakin ingin menghapus kriteria ini?")) {
      const deletedCriterion = dummyATL[selectedSubtopic][index];
      dummyATL[selectedSubtopic].splice(index, 1);
      removeCriterionReferences(selectedSubtopic, deletedCriterion);
      await deleteCriterion(deletedCriterion?.id);
      persistATLChanges();
    }
  };

  const handleCancel = () => {
    setShowAddForm(false);
    setEditingIndex(null);
    setFormData({
      kriteria: "",
      criteriaTopic: "",
      atl: selectedSubskills.map((subskill) => subskill.name),
      categoryId: selectedCategory?.id || "",
      categoryIds: formData.categoryIds || [],
      categoryName: selectedCategory?.name || "",
      subskillId: selectedSubskill?.id || "",
      subskillIds: formData.subskillIds || [],
      subskillName: selectedSubskill?.name || "",
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
                setSelectedSubtopic(subject.topics[0]?.id || "");
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
                    {subject.topics.length} Sub Topik
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
        <div className="mt-4 grid gap-3 rounded-2xl border border-dashed border-stone-300 bg-white p-4 md:grid-cols-[1fr_1fr_auto]">
          <input
            type="text"
            value={newSubtopicName}
            onChange={(e) => setNewSubtopicName(e.target.value)}
            placeholder="Tambah subtopik baru, contoh: Vocal Ensemble"
            className="rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm font-semibold text-stone-900 outline-none focus:border-primary focus:bg-white focus:ring-4 focus:ring-primary/10"
          />
          <input
            type="text"
            value={newSubtopicDescription}
            onChange={(e) => setNewSubtopicDescription(e.target.value)}
            placeholder="Deskripsi singkat"
            className="rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm font-semibold text-stone-900 outline-none focus:border-primary focus:bg-white focus:ring-4 focus:ring-primary/10"
          />
          <button
            type="button"
            onClick={handleAddSubtopic}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-black text-white shadow-lg shadow-primary/20 transition-all hover:bg-primary-hover"
          >
            <span className="material-symbols-outlined text-lg">add</span>
            Tambah Subtopik
          </button>
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
              {currentSubtopics.find((s) => s.id === selectedSubtopic)?.label}
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
              {criteria.criteriaTopic && (
                <p className="mb-1 text-[10px] font-black uppercase tracking-widest text-stone-400">
                  {criteria.criteriaTopic}
                </p>
              )}
              <h4 className={`font-bold mb-3 line-clamp-2 ${currentSubjectConfig?.textColor}`}>
                {criteria.kriteria}
              </h4>

              {/* ATL Tags with Icons */}
              <div className="mb-4 flex flex-wrap gap-2">
                {getCriteriaCategoryNames(criteria).map((categoryName) => (
                  <span
                    key={categoryName}
                    title={getCriteriaSubskillNames(criteria).join(", ")}
                    className={`group relative inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold ${(atlConfig[categoryName] || fallbackAtlConfig).color}`}
                  >
                    <span className="material-symbols-outlined text-sm">{(atlConfig[categoryName] || fallbackAtlConfig).icon}</span>
                    {categoryName}
                    <span className="pointer-events-none absolute left-0 top-full z-20 mt-2 hidden w-64 rounded-xl border border-stone-200 bg-white p-3 text-[11px] font-semibold leading-5 text-stone-700 shadow-xl group-hover:block">
                      {getCriteriaSubskillNames(criteria).join(", ")}
                    </span>
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
            {/* Criteria Topic Input */}
            <div>
              <label className="block text-sm font-semibold text-text-main-light mb-2">
                Topik Kriteria ATL
              </label>
              <input
                type="text"
                value={formData.criteriaTopic}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    criteriaTopic: e.target.value,
                  }))
                }
                placeholder="Contoh: Choir Performance / Vocal Technique"
                className="w-full px-4 py-2 rounded-lg border border-stone-200/90 bg-white text-text-main-light focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

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

            {/* ATL Category and Subskill Selection */}
            <div>
              <label className="block text-sm font-semibold text-text-main-light mb-3">
                Pilih Kategori ATL yang Berpengaruh
              </label>
              <div className="grid gap-3 md:grid-cols-5">
                {atlHierarchy.map((category) => {
                  const active = (formData.categoryIds || []).map(String).includes(String(category.id));
                  const config = atlConfig[category.name] || fallbackAtlConfig;

                  return (
                    <button
                      key={category.id}
                      type="button"
                      onClick={() => setCategorySelection(category)}
                      className={`rounded-xl border-2 p-3 text-left transition-all ${
                        active
                          ? `${config.color} border-current shadow-md`
                          : "border-stone-200/90 bg-white text-stone-700 hover:border-stone-300/90"
                      }`}
                    >
                      <span className="material-symbols-outlined text-lg">{config.icon}</span>
                      <span className="mt-1 block text-xs font-black leading-tight">{category.name}</span>
                      <span className="mt-1 block text-[10px] font-semibold opacity-70">{category.subskills?.length || 0} subskill</span>
                      {active && <span className="mt-2 block text-[10px] font-black">Dipilih</span>}
                    </button>
                  );
                })}
              </div>
              <p className="mt-2 text-xs text-text-sub-light">
                Bisa memilih lebih dari satu kategori. Subskill resmi dari kategori terpilih akan masuk ke kandidat pairwise.
              </p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-text-main-light mb-3">
                Pilih Subskill yang Akan Diadu di Pairwise
              </label>
              <div className="grid gap-3 md:grid-cols-2">
                {selectedCategorySubskills.map((subskill) => {
                  const active = (formData.subskillIds || []).map(String).includes(String(subskill.id));
                  const parentCategory = findCategoryForSubskill(subskill.id);
                  const config = atlConfig[subskill.name] || atlConfig[parentCategory?.name] || fallbackAtlConfig;

                  return (
                    <button
                      key={subskill.id}
                      type="button"
                      onClick={() => setSubskillSelection(subskill)}
                      className={`flex items-center justify-between gap-3 rounded-xl border-2 bg-white p-3 text-left transition-all ${
                        active
                          ? `${config.color} border-current shadow-md`
                          : "border-stone-200/90 text-stone-700 hover:border-stone-300/90"
                      }`}
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="material-symbols-outlined text-lg">{config.icon}</span>
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-bold">{subskill.name}</span>
                          <span className="block truncate text-[10px] font-semibold text-stone-400">{parentCategory?.name}</span>
                        </span>
                      </span>
                      {active && <span className="material-symbols-outlined text-lg">check_circle</span>}
                    </button>
                  );
                })}
                {selectedCategorySubskills.length === 0 && (
                  <div className="rounded-xl border-2 border-dashed border-stone-200 bg-white p-4 text-sm text-stone-500">
                    Belum ada subskill untuk kategori ini.
                  </div>
                )}
              </div>
              <div className="mt-3 rounded-xl border border-primary/10 bg-primary/5 px-4 py-3 text-xs font-semibold text-primary">
                Dipilih: {selectedCategories.map((category) => category.name).join(", ") || "-"} / {selectedSubskills.length} subskill
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

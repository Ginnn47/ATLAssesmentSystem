import React, { useEffect, useState } from "react";
import { dummyATL, saveATLData } from "../dummyData/dummyATL";
import { createContext, createCriterion, deleteCriterion, deleteTopic, getATLHierarchy, getCriteria, getTopics, updateCriterion, getCurrentUser } from "../../services/atlApi";
import { filterSubjectsByUserAccess } from "../../services/accessControl";
import { getATLCategoryMeta, getSubskillMeta } from "../../services/labelRegistry";
import { createCustomSubtopicDraft, getSubjectData, saveCustomSubtopic } from "../../services/topicCatalog";

const fallbackAtlConfig = { icon: "label", color: "bg-stone-100 text-stone-700", bgLight: "bg-stone-50" };

const toATLConfig = (meta = fallbackAtlConfig) => ({
  icon: meta.icon || fallbackAtlConfig.icon,
  color: meta.chipClass || meta.toneClass || fallbackAtlConfig.color,
  bgLight: meta.bgClass || fallbackAtlConfig.bgLight,
});

const getCategoryConfig = (categoryName) => toATLConfig(getATLCategoryMeta(categoryName));
const getSubskillConfig = (subskillName, index = 0) => toATLConfig(getSubskillMeta(subskillName, index));

export default function CriteriaManagement() {
  const subjectStyles = {
    singing: { icon: "music_note", bgColor: "bg-rose-50", borderColor: "border-rose-200", textColor: "text-rose-700", badgeColor: "bg-rose-100 text-rose-700", accentBorder: "border-rose-300" },
    ipa: { icon: "science", bgColor: "bg-emerald-50", borderColor: "border-emerald-200", textColor: "text-emerald-700", badgeColor: "bg-emerald-100 text-emerald-700", accentBorder: "border-emerald-300" },
    math: { icon: "calculate", bgColor: "bg-amber-50", borderColor: "border-amber-200", textColor: "text-amber-700", badgeColor: "bg-amber-100 text-amber-700", accentBorder: "border-amber-300" },
  };

  const buildSubjects = (user = currentUser) =>
    filterSubjectsByUserAccess(getSubjectData(), user).map((subject) => ({
      ...subject,
      ...(subjectStyles[subject.id] || subjectStyles.singing),
    }));

  // State management
  const [currentUser, setCurrentUser] = useState(null);
  const [subjects, setSubjects] = useState(() => buildSubjects(null));
  const [selectedSubject, setSelectedSubject] = useState("singing");
  const [selectedSubtopic, setSelectedSubtopic] = useState("singing_christmas_carol");
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingIndex, setEditingIndex] = useState(null);
  const [, setDataVersion] = useState(0);
  const [atlHierarchy, setAtlHierarchy] = useState([]);
  const [backendError, setBackendError] = useState("");
  const [newSubtopicName, setNewSubtopicName] = useState("");
  const [newSubtopicDescription, setNewSubtopicDescription] = useState("");
  const [deletingSubtopicId, setDeletingSubtopicId] = useState("");

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
  const selectedCategory = selectedCategories[0] || atlHierarchy[0];
  const selectedCategorySubskills = selectedCategory?.subskills || [];
  const selectedSubskills = selectedCategorySubskills.filter((subskill) => (formData.subskillIds || []).map(String).includes(String(subskill.id)));
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

  const normalizeMetasToOneCategory = (metas) => {
    const normalizedMetas = (metas || []).filter(Boolean);
    if (normalizedMetas.length <= 1) return normalizedMetas;
    const counts = {};
    const firstSeen = {};
    normalizedMetas.forEach((meta, index) => {
      const categoryId = String(meta.category.id);
      counts[categoryId] = (counts[categoryId] || 0) + 1;
      if (firstSeen[categoryId] === undefined) firstSeen[categoryId] = index;
    });
    const selectedCategoryId = Object.keys(counts).sort((left, right) => {
      if (counts[right] !== counts[left]) return counts[right] - counts[left];
      return firstSeen[left] - firstSeen[right];
    })[0];
    return normalizedMetas.filter((meta) => String(meta.category.id) === selectedCategoryId);
  };

  const setCategorySelection = (category) => {
    const categorySubskillIds = (category.subskills || []).map((subskill) => subskill.id);
    const nextSubskills = category.subskills || [];

    setFormData((prev) => ({
      ...prev,
      categoryIds: [category.id],
      categoryId: category.id,
      categoryName: category.name,
      subskillIds: categorySubskillIds,
      subskillId: categorySubskillIds[0] || "",
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
    const nextSubskills = selectedCategorySubskills.filter((item) => nextSubskillIds.map(String).includes(String(item.id)));
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

  const applyCriteriaResult = (topicId, criteria = []) => {
    const rows = Array.isArray(criteria) ? [...criteria] : [];
    dummyATL[topicId] = rows;
    saveATLData(dummyATL);
    const meta = criteria?.__meta || {};
    if (meta.stale) {
      setBackendError(meta.message || "Mengambil data saat ini. Menampilkan data kriteria yang tersedia.");
    } else {
      setBackendError("");
    }
    return meta;
  };

  const refreshSelectedSubtopicFromBackend = async (topicId = selectedSubtopic) => {
    await getTopics();
    const nextSubjects = buildSubjects(currentUser);
    setSubjects(nextSubjects);
    if (topicId) {
      const criteria = await getCriteria(topicId);
      applyCriteriaResult(topicId, criteria);
    }
    setDataVersion((v) => v + 1);
    window.dispatchEvent(new Event("atl-topics-updated"));
    window.dispatchEvent(new Event("atl-data-updated"));
  };

  useEffect(() => {
    const syncTopics = () => setSubjects(buildSubjects(currentUser));
    window.addEventListener("atl-topics-updated", syncTopics);
    return () => window.removeEventListener("atl-topics-updated", syncTopics);
  }, [currentUser]);

  useEffect(() => {
    Promise.allSettled([getTopics(), getCurrentUser()])
      .then(([topicsResult, userResult]) => {
        const user = userResult.status === "fulfilled" ? userResult.value : null;
        setCurrentUser(user);
        const nextSubjects = buildSubjects(user);
        setSubjects(nextSubjects);
        const topicIds = nextSubjects.flatMap((subject) => (subject.topics || []).map((topic) => topic.id));
        if (!topicIds.includes(selectedSubtopic)) {
          const firstSubject = nextSubjects[0];
          setSelectedSubject(firstSubject?.id || "");
          setSelectedSubtopic(firstSubject?.topics?.[0]?.id || "");
        }
        if (topicsResult.status === "rejected") {
          setBackendError("Mengambil data saat ini. Menampilkan data yang tersedia.");
        } else {
          setBackendError("");
        }
      });
  }, []);

  const handleAddSubtopic = async () => {
    if (!newSubtopicName.trim()) {
      alert("Nama subtopik wajib diisi.");
      return;
    }

    const created = createCustomSubtopicDraft(selectedSubject, newSubtopicName, newSubtopicDescription);
    if (!created) return;

    const currentSubjects = buildSubjects(currentUser);
    const subject = currentSubjects.find((item) => item.id === selectedSubject);
    const backendContext = await createContext({
      grade: "Grade 3",
      subjectName: subject?.label || selectedSubject,
      unitName: created.label,
      description: created.description,
      legacyTopicCode: created.id,
    });
    if (!backendContext) {
      alert("Gagal menyimpan subtopik ke backend. Pastikan sudah login.");
      return;
    }

    saveCustomSubtopic(selectedSubject, created);
    const nextSubjects = buildSubjects(currentUser);
    setSubjects(nextSubjects);
    dummyATL[created.id] = dummyATL[created.id] || [];
    persistATLChanges();
    await getTopics();
    setSubjects(buildSubjects(currentUser));

    setSelectedSubtopic(created.id);
    setNewSubtopicName("");
    setNewSubtopicDescription("");
  };

  const handleDeleteSubtopic = async (subtopic) => {
    const confirmed = confirm(
      `Hapus subtopik "${subtopic.label}"?\n\nContext, rubrik, pembobotan, dan nilai kontekstual untuk subtopik ini juga akan dihapus. Tindakan ini tidak dapat dibatalkan dari halaman ini.`
    );
    if (!confirmed) return;

    setDeletingSubtopicId(subtopic.id);
    const deleted = await deleteTopic(subtopic.id);
    if (!deleted) {
      setDeletingSubtopicId("");
      alert("Gagal menghapus subtopik dari backend. Pastikan sudah login dan coba lagi.");
      return;
    }

    delete dummyATL[subtopic.id];
    if (dummyATL.savedWeights) delete dummyATL.savedWeights[subtopic.id];
    Object.values(dummyATL.savedAssessments || {}).forEach((assessments) => {
      if (assessments) delete assessments[subtopic.id];
    });
    persistATLChanges();

    try {
      await getTopics();
      const nextSubjects = buildSubjects(currentUser);
      const nextSubject =
        nextSubjects.find((subject) => subject.id === selectedSubject && subject.topics?.length > 0)
        || nextSubjects.find((subject) => subject.topics?.length > 0)
        || nextSubjects[0];
      setSubjects(nextSubjects);
      setSelectedSubject(nextSubject?.id || "");
      setSelectedSubtopic(nextSubject?.topics?.[0]?.id || "");
      setShowAddForm(false);
      setBackendError("");
    } catch (error) {
      setBackendError(error.message || "Subtopik terhapus, tetapi katalog terbaru gagal dimuat.");
    } finally {
      setDeletingSubtopicId("");
    }
  };

  useEffect(() => {
    let cancelled = false;
    if (!selectedSubtopic) return () => { cancelled = true; };
    Promise.allSettled([getCriteria(selectedSubtopic), getATLHierarchy()])
      .then(([criteriaResult, hierarchyResult]) => {
        if (cancelled) return;
        const messages = [];
        if (criteriaResult.status === "fulfilled") {
          const meta = applyCriteriaResult(selectedSubtopic, criteriaResult.value);
          if (meta.stale && meta.message) messages.push(meta.message);
        } else {
          messages.push("Mengambil data saat ini. Menampilkan data kriteria yang tersedia.");
        }

        const hierarchy = hierarchyResult.status === "fulfilled" ? hierarchyResult.value : atlHierarchy;
        if (hierarchyResult.status === "fulfilled") {
          setAtlHierarchy(hierarchy || []);
        } else {
          messages.push("Mengambil data saat ini. Menampilkan pilihan ATL yang tersedia.");
        }

        if (messages.length > 0) setBackendError(messages[0]);
        else setBackendError("");
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
    const chosenCategory = chosenSubskills.length > 0 ? findCategoryForSubskill(chosenSubskills[0].id) : selectedCategory;
    const chosenCategories = chosenCategory ? [chosenCategory] : [];

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
      const previousCriterion = dummyATL[selectedSubtopic][editingIndex];
      let savedCriterion = null;
      try {
        savedCriterion = await updateCriterion(previousCriterion.id, normalizedFormData);
      } catch (error) {
        alert(error.message || "Gagal menyimpan perubahan kriteria ke backend.");
        return;
      }
      if (!savedCriterion?.id) {
        alert("Gagal menyimpan perubahan kriteria ke backend.");
        return;
      }
      dummyATL[selectedSubtopic][editingIndex] = {
        ...normalizedFormData,
        id: savedCriterion.id,
        category: savedCriterion.category || normalizedFormData.category,
        atlCategories: savedCriterion.atlCategories || normalizedFormData.atlCategories,
        atl: savedCriterion.atl || normalizedFormData.atl,
        subskillId: savedCriterion.subskillId || normalizedFormData.subskillId,
        subskillIds: savedCriterion.subskillIds || normalizedFormData.subskillIds,
        criteriaTopic: savedCriterion.criteriaTopic || normalizedFormData.criteriaTopic,
      };
      syncCriterionReferences(selectedSubtopic, previousCriterion, dummyATL[selectedSubtopic][editingIndex]);
      setEditingIndex(null);
    } else {
      let createdCriterion = null;
      try {
        createdCriterion = await createCriterion(selectedSubtopic, normalizedFormData);
      } catch (error) {
        alert(error.message || "Gagal menyimpan kriteria baru ke backend.");
        return;
      }
      if (!createdCriterion?.id) {
        alert("Gagal menyimpan kriteria baru ke backend.");
        return;
      }
      if (!dummyATL[selectedSubtopic]) dummyATL[selectedSubtopic] = [];
      dummyATL[selectedSubtopic].push({
        ...normalizedFormData,
        id: createdCriterion.id,
        category: createdCriterion.category || normalizedFormData.category,
        atlCategories: createdCriterion.atlCategories || normalizedFormData.atlCategories,
        atl: createdCriterion.atl || normalizedFormData.atl,
        subskillId: createdCriterion.subskillId || normalizedFormData.subskillId,
        subskillIds: createdCriterion.subskillIds || normalizedFormData.subskillIds,
        criteriaTopic: createdCriterion.criteriaTopic || normalizedFormData.criteriaTopic,
      });
    }

    persistATLChanges();
    await refreshSelectedSubtopicFromBackend(selectedSubtopic);

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
    const fallbackMeta =
      findSubskillMeta(existing.subskillId) ||
      findSubskillMeta(existing.atl?.[0], existing.category) ||
      { category: selectedCategory, subskill: selectedSubskill };
    const normalizedMetas = normalizeMetasToOneCategory(
      metas.length > 0 ? metas : [fallbackMeta]
    );
    const finalCategories = Array.from(new Map(normalizedMetas.map((meta) => [String(meta.category.id), meta.category])).values());
    const finalSubskills = normalizedMetas.map((meta) => meta.subskill).filter(Boolean);
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
      let deleted = false;
      try {
        deleted = await deleteCriterion(deletedCriterion?.id);
      } catch (error) {
        alert(error.message || "Gagal menghapus kriteria dari backend.");
        return;
      }
      if (!deleted) {
        alert("Gagal menghapus kriteria dari backend.");
        return;
      }
      dummyATL[selectedSubtopic].splice(index, 1);
      removeCriterionReferences(selectedSubtopic, deletedCriterion);
      persistATLChanges();
      await refreshSelectedSubtopicFromBackend(selectedSubtopic);
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
      {backendError && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm font-bold text-amber-800">
          <span className="material-symbols-outlined mr-2 align-middle text-[18px]">sync</span>
          {backendError}
        </div>
      )}

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
          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                const topic = currentSubtopics.find((item) => item.id === selectedSubtopic);
                if (topic) handleDeleteSubtopic(topic);
              }}
              disabled={!selectedSubtopic || deletingSubtopicId === selectedSubtopic}
              className="flex items-center gap-2 rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-bold text-red-600 transition-all duration-300 hover:border-red-400 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-lg">delete</span>
              {deletingSubtopicId === selectedSubtopic ? "Menghapus Subtopik..." : "Hapus Subtopik"}
            </button>
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
                {getCriteriaCategoryNames(criteria).map((categoryName) => {
                  const config = getCategoryConfig(categoryName);
                  return (
                    <span
                      key={categoryName}
                      title={getCriteriaSubskillNames(criteria).join(", ")}
                      className={`group relative inline-flex items-center gap-1.5 rounded-xl border px-2 py-2 text-[9px] font-black ${config.color}`}
                    >
                      <span className="material-symbols-outlined text-[15px]">{config.icon}</span>
                      {categoryName}
                      <span className="pointer-events-none absolute left-0 top-full z-20 mt-2 hidden w-64 rounded-xl border border-stone-200 bg-white p-3 text-[12px] font-semibold leading-5 text-stone-700 shadow-xl group-hover:block">
                        {getCriteriaSubskillNames(criteria).join(", ")}
                      </span>
                    </span>
                  );
                })}
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
                  const config = getCategoryConfig(category.name);

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
                Satu kriteria hanya memakai satu kategori ATL. Kamu tetap bisa memilih beberapa subskill di dalam kategori itu.
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
                  const config = getSubskillConfig(subskill.name) || getCategoryConfig(parentCategory?.name);

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
                Dipilih: {selectedCategory?.name || "-"} / {selectedSubskills.length} subskill
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

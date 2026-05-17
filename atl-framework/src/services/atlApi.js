import api from "../api";
import { dummyATL, saveATLData } from "../components/dash/dummyATL";
import { allStudentsData } from "../components/dash/dummyStudents";

const unwrap = (response) => response?.data || {};

export const mergeTopicCriteria = (topicId, criteria) => {
  if (Array.isArray(criteria) && criteria.length > 0) {
    const current = dummyATL[topicId] || [];
    const merged = [...current];
    criteria.forEach((item) => {
      const normalized = {
        id: item.id,
        criteriaTopic: item.criteriaTopic,
        kriteria: item.kriteria || item.name,
        atl: item.atl || [],
        levels: item.levels || {},
        category: item.category,
        atlCategories: item.atlCategories || [],
        subskillIds: item.subskillIds || [],
        subskillId: item.subskillId,
      };
      const index = merged.findIndex((existing) => (
        (normalized.id && existing.id === normalized.id) ||
        (!normalized.id && existing.kriteria === normalized.kriteria) ||
        (normalized.id && existing.kriteria === normalized.kriteria)
      ));
      if (index >= 0) merged[index] = { ...merged[index], ...normalized };
      else merged.push(normalized);
    });
    dummyATL[topicId] = merged;
    saveATLData(dummyATL);
  }
  return dummyATL[topicId] || [];
};

const contextCriteriaFromFlow = (flow) => (
  (flow?.rubricItems || []).map((item) => ({
    id: item.id,
    criteriaTopic: item.criteriaTopic,
    kriteria: item.title,
    atl: Array.isArray(item.subskills) && item.subskills.length > 0
      ? item.subskills.map((subskill) => subskill.name)
      : item.subskill?.name ? [item.subskill.name] : [],
    levels: item.levelDescriptors || {},
    atlCategories: Array.isArray(item.categories) ? item.categories.map((category) => category.name) : [],
    subskillIds: Array.isArray(item.subskills) ? item.subskills.map((subskill) => subskill.id) : [],
    subskillId: item.subskill?.id,
    category: Array.isArray(item.categories) ? item.categories.map((category) => category.name).join(", ") : item.subskill?.category?.name,
  }))
);

const criterionFromRubricItem = (item) => ({
  id: item.id,
  criteriaTopic: item.criteriaTopic,
  kriteria: item.title,
  atl: Array.isArray(item.subskills) && item.subskills.length > 0
    ? item.subskills.map((subskill) => subskill.name)
    : item.subskill?.name ? [item.subskill.name] : [],
  levels: item.levelDescriptors || {},
  atlCategories: Array.isArray(item.categories) ? item.categories.map((category) => category.name) : [],
  subskillIds: Array.isArray(item.subskills) ? item.subskills.map((subskill) => subskill.id) : [],
  subskillId: item.subskill?.id,
  category: Array.isArray(item.categories) ? item.categories.map((category) => category.name).join(", ") : item.subskill?.category?.name,
});

export const getContextFlow = async (topicId) => {
  const data = unwrap(await api.get(`contexts/${topicId}/flow/`));
  const criteria = contextCriteriaFromFlow(data);
  if (criteria.length > 0) mergeTopicCriteria(topicId, criteria);
  if (data.weights && Object.keys(data.weights).length > 0) {
    mergeTopicWeights(
      topicId,
      data.debug?.packages ? { ...data.weights, __mode: "criterion-packages", packages: data.debug.packages } : data.weights
    );
  }
  return { ...data, criteria };
};

export const createContext = async (context) => {
  try {
    const data = unwrap(await api.post("contexts/", context));
    return data.context || null;
  } catch (error) {
    return null;
  }
};

export const mergeTopicWeights = (topicId, weights) => {
  if (weights && Object.keys(weights).length > 0) {
    if (!dummyATL.savedWeights) dummyATL.savedWeights = {};
    dummyATL.savedWeights[topicId] = weights;
    saveATLData(dummyATL);
  }
  return dummyATL.savedWeights?.[topicId] || {};
};

export const mergeAssessments = (assessments) => {
  if (assessments && Object.keys(assessments).length > 0) {
    if (!dummyATL.savedAssessments) dummyATL.savedAssessments = {};
    Object.entries(assessments).forEach(([studentId, studentAssessments]) => {
      dummyATL.savedAssessments[studentId] = {
        ...(dummyATL.savedAssessments[studentId] || {}),
        ...(studentAssessments || {}),
      };
    });
    saveATLData(dummyATL);
  }
  return dummyATL.savedAssessments || {};
};

export const getStudents = async (className) => {
  try {
    const data = unwrap(await api.get("students/", { params: className ? { class: className } : {} }));
    if (className && Array.isArray(data.students)) return data.students;
    if (!className && data.students && !Array.isArray(data.students)) return data.students;
  } catch (error) {
    // Hybrid fallback: keep the prototype data source alive.
  }
  return className ? allStudentsData[className] || [] : allStudentsData;
};

export const getTopics = async () => {
  try {
    const data = unwrap(await api.get("topics/"));
    if (Array.isArray(data.subjects) && data.subjects.length > 0) return data.subjects;
  } catch (error) {
    // Fallback is defined inside each page's existing subject/topic config.
  }
  return null;
};

export const getATLHierarchy = async () => {
  try {
    const data = unwrap(await api.get("atl/hierarchy/"));
    if (Array.isArray(data.categories)) return data.categories;
  } catch (error) {
    // Local fallback below keeps context setup usable without the API.
  }
  return [
    { id: "thinking", name: "Thinking Skills", subskills: [
      { id: "thinking-critical", name: "Critical Thingking" },
      { id: "thinking-creative", name: "Creative Thingking" },
      { id: "thinking-transfer", name: "InformationTransfer" },
      { id: "thinking-reflection", name: "Reflection / Metacognitive" },
    ] },
    { id: "research", name: "Research Skills", subskills: [
      { id: "research-information", name: "Textual Literacy" },
      { id: "research-media", name: "Media Literacy" },
      { id: "research-ethical", name: "Ethical use of information" },
    ] },
    { id: "communication", name: "Communication Skills", subskills: [
      { id: "communication-exchanging", name: "Exchanging-information" },
      { id: "communication-literacy", name: "Literacy skills" },
      { id: "communication-ict", name: "ICT skills" },
    ] },
    { id: "social", name: "Social Skills", subskills: [
      { id: "social-relationships", name: "Interpersonal relationships" },
      { id: "social-emotional", name: "Social-emotional intelligence" },
    ] },
    { id: "self-management", name: "Self-Management Skills", subskills: [
      { id: "self-organization", name: "Organization skills" },
      { id: "self-state", name: "State of Mind" },
    ] },
  ];
};

export const getCriteria = async (topicId) => {
  try {
    const flow = await getContextFlow(topicId);
    if (flow.criteria?.length > 0) return flow.criteria;
  } catch (error) {
    // Legacy endpoint below remains the transition fallback.
  }

  try {
    const data = unwrap(await api.get(`topics/${topicId}/criteria/`));
    return mergeTopicCriteria(topicId, data.criteria || []);
  } catch (error) {
    return dummyATL[topicId] || [];
  }
};

export const createCriterion = async (topicId, criterion) => {
  try {
    const data = unwrap(await api.post(`topics/${topicId}/criteria/`, criterion));
    return data.criterion || null;
  } catch (error) {
    try {
      const data = unwrap(await api.post(`contexts/${topicId}/rubric-items/`, {
        ...criterion,
        title: criterion.kriteria,
        levelDescriptors: criterion.levels,
      }));
      return data.rubricItem ? criterionFromRubricItem(data.rubricItem) : null;
    } catch (fallbackError) {
      return null;
    }
  }
};

export const updateCriterion = async (criterionId, criterion) => {
  if (!criterionId) return null;
  try {
    const data = unwrap(await api.put(`criteria/${criterionId}/`, criterion));
    return data.criterion || null;
  } catch (error) {
    return null;
  }
};

export const deleteCriterion = async (criterionId) => {
  if (!criterionId) return false;
  try {
    await api.delete(`criteria/${criterionId}/`);
    return true;
  } catch (error) {
    return false;
  }
};

export const calculateFuzzyWeights = async (criteria, pairwise) => {
  const data = unwrap(await api.post("fuzzy-ahp/calculate/", { criteria, pairwise }));
  return data;
};

export const calculateContextWeights = async (contextId, pairwise) => {
  const data = unwrap(await api.post(`contexts/${contextId}/weights/calculate/`, { pairwise }));
  if (data.weights) {
    mergeTopicWeights(contextId, data.packages ? { ...data.weights, __mode: "criterion-packages", packages: data.packages } : data.weights);
  }
  return data;
};

export const saveContextPairwise = async (contextId, pairwise) => {
  const data = unwrap(await api.post(`contexts/${contextId}/pairwise/`, { pairwise }));
  return data;
};

export const getWeights = async (topicId) => {
  try {
    const data = unwrap(await api.get(`contexts/${topicId}/weights/`));
    if (data.weights && Object.keys(data.weights).length > 0) {
      return mergeTopicWeights(
        topicId,
        data.debug?.packages ? { ...data.weights, __mode: "criterion-packages", packages: data.debug.packages } : data.weights
      );
    }
  } catch (error) {
    // Legacy endpoint below remains the transition fallback.
  }

  try {
    const data = unwrap(await api.get(`topics/${topicId}/weights/`));
    return mergeTopicWeights(topicId, data.weights || {});
  } catch (error) {
    return dummyATL.savedWeights?.[topicId] || {};
  }
};

export const saveWeights = async (topicId, weights, debug = {}) => {
  try {
    const data = unwrap(await api.post(`topics/${topicId}/weights/`, { weights, debug }));
    return mergeTopicWeights(topicId, data.weights || weights);
  } catch (error) {
    return mergeTopicWeights(topicId, weights);
  }
};

export const getAssessments = async ({ topicId, studentId } = {}) => {
  try {
    const params = {};
    if (topicId) params.topic = topicId;
    if (studentId) params.student = studentId;
    const data = unwrap(await api.get("assessments/", { params }));
    return mergeAssessments(data.assessments || {});
  } catch (error) {
    return dummyATL.savedAssessments || {};
  }
};

export const saveAssessment = async (studentId, topicId, ratings) => {
  try {
    await api.post("assessments/", { studentId, topic: topicId, ratings });
  } catch (error) {
    // Local persistence below is the official fallback for this phase.
  }
  if (!dummyATL.savedAssessments) dummyATL.savedAssessments = {};
  if (!dummyATL.savedAssessments[studentId]) dummyATL.savedAssessments[studentId] = {};
  dummyATL.savedAssessments[studentId][topicId] = { ...ratings };
  saveATLData(dummyATL);
  return true;
};

export const getReport = async (className, topicId) => {
  try {
    const data = unwrap(await api.get("reports/", { params: { class: className, topic: topicId, context: topicId } }));
    if (Array.isArray(data.students) && data.students.length > 0) return data;
  } catch (error) {
    // Existing page-level calculation remains the fallback.
  }
  return null;
};

export const hydrateTopic = async (topicId) => {
  const [criteria, weights, assessments, flow] = await Promise.all([
    getCriteria(topicId),
    getWeights(topicId),
    getAssessments({ topicId }),
    getContextFlow(topicId).catch(() => null),
  ]);
  return { criteria, weights, assessments, flow };
};

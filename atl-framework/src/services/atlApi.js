import api from "../api";
import { dummyATL, saveATLData } from "../components/dummyData/dummyATL";
import {
  getATLDistributionTemplate,
  normalizeATLCategory,
} from "./labelRegistry";
import { getSubjectData, setSubjectData } from "./topicCatalog";

const unwrap = (response) => response?.data || {};
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const requestWithRetry = async (operation, { attempts = 4, delay = 350 } = {}) => {
  let lastError = null;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      const status = error?.response?.status;
      const retryable = !status || [404, 409, 423, 429, 500, 502, 503, 504].includes(status);
      if (!retryable || attempt === attempts - 1) break;
      await sleep(delay * (attempt + 1));
    }
  }
  throw lastError;
};
const ASSESSMENT_DRAFT_STORAGE_KEY = "atl_assessment_drafts";
const ASSESSMENT_LIVE_DRAFT_STORAGE_KEY = "atl_assessment_live_drafts";
const ASSESSMENT_FILTER_STORAGE_KEY = "atl_assessment_filter_state";
const REPORT_DIRTY_STORAGE_KEY = "atl_report_data_dirty_at";
const BACKEND_SAVE_AUDIT_KEY = "atl_backend_save_audit";
const CLASS_CACHE_STORAGE_KEY = "atl_class_catalog_snapshot";
const STUDENT_CACHE_STORAGE_KEY = "atl_student_catalog_snapshot";
const apiErrorMessage = (error, fallback) => (
  error?.response?.data?.error ||
  error?.response?.data?.message ||
  error?.message ||
  fallback
);
const raiseApiError = (error, fallback) => {
  throw new Error(apiErrorMessage(error, fallback));
};

const clearCachedAuth = () => {
  localStorage.removeItem("atl_current_user");
};

const readStorageObject = (key) => {
  try {
    return JSON.parse(localStorage.getItem(key) || "{}");
  } catch {
    localStorage.removeItem(key);
    return {};
  }
};

const readAssessmentDrafts = () => readStorageObject(ASSESSMENT_DRAFT_STORAGE_KEY);
const readAssessmentLiveDrafts = () => readStorageObject(ASSESSMENT_LIVE_DRAFT_STORAGE_KEY);
const readClassCache = () => {
  const cached = readStorageObject(CLASS_CACHE_STORAGE_KEY);
  return Array.isArray(cached.classes) ? cached.classes : [];
};
const writeClassCache = (classes) => {
  localStorage.setItem(CLASS_CACHE_STORAGE_KEY, JSON.stringify({ classes: classes || [], updatedAt: new Date().toISOString() }));
};
const readStudentCache = (className) => {
  const cached = readStorageObject(STUDENT_CACHE_STORAGE_KEY);
  const key = className || "__all__";
  return Array.isArray(cached[key]) ? cached[key] : [];
};
const writeStudentCache = (className, students) => {
  const cached = readStorageObject(STUDENT_CACHE_STORAGE_KEY);
  const key = className || "__all__";
  cached[key] = students || [];
  cached.updatedAt = new Date().toISOString();
  localStorage.setItem(STUDENT_CACHE_STORAGE_KEY, JSON.stringify(cached));
};

const writeAssessmentDrafts = (drafts) => {
  localStorage.setItem(ASSESSMENT_DRAFT_STORAGE_KEY, JSON.stringify(drafts));
  window.dispatchEvent(new Event("atl-drafts-updated"));
};

const writeAssessmentLiveDrafts = (drafts) => {
  localStorage.setItem(ASSESSMENT_LIVE_DRAFT_STORAGE_KEY, JSON.stringify(drafts));
  window.dispatchEvent(new Event("atl-live-drafts-updated"));
};

const mergeDraftItem = (current, ratings, metadata = {}) => ({
  ...(current || {}),
  ...metadata,
  ratings: { ...(ratings || {}) },
  updatedAt: new Date().toISOString(),
});

const assessmentSyncError = (error) => {
  if (error.response?.status === 401) {
    clearCachedAuth();
    window.dispatchEvent(new Event("atl-auth-updated"));
    return "Login belum aktif. Silakan login ulang sebelum menyimpan nilai.";
  }
  if (error.response?.status === 403) {
    return error.response?.data?.error || "Akun ini tidak memiliki izin untuk menyimpan penilaian.";
  }
  const message = error.response?.data?.error || error.response?.data?.message || "";
  if (/assessment|kriteria|rubrik|rubric/i.test(message)) {
    return "Belum bisa disimpan: kriteria belum tersedia.";
  }
  return message || "Gagal menyimpan nilai ke backend.";
};

const markReportDataDirty = () => {
  try {
    localStorage.setItem(REPORT_DIRTY_STORAGE_KEY, new Date().toISOString());
  } catch {
    // Assessment sync must remain successful even if browser storage is unavailable.
  }
};

const recordBackendSaveAudit = (entry = {}) => {
  const auditEntry = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    at: new Date().toISOString(),
    ...entry,
  };
  try {
    const previous = JSON.parse(localStorage.getItem(BACKEND_SAVE_AUDIT_KEY) || "[]");
    const rows = Array.isArray(previous) ? previous : [];
    localStorage.setItem(BACKEND_SAVE_AUDIT_KEY, JSON.stringify([auditEntry, ...rows].slice(0, 20)));
  } catch {
    // Debug audit must never block the save flow.
  }
  if (entry.success) {
    console.info("[ATL backend save]", auditEntry);
  } else {
    console.warn("[ATL backend save failed]", auditEntry);
  }
};

export const loginUser = async ({ username, password }) => {
  let loginData;
  try {
    loginData = unwrap(await api.post("auth/login/", { username: String(username || "").trim(), password }));
  } catch (error) {
    const message = error.response?.data?.error || "Username atau password tidak valid.";
    throw new Error(message);
  }

  try {
    const verified = unwrap(await api.get("auth/me/"));
    const user = verified.user || loginData.user || null;
    if (!user) throw new Error("Session user tidak tersedia.");
    localStorage.setItem("atl_current_user", JSON.stringify(user));
    window.dispatchEvent(new Event("atl-auth-updated"));
    return user;
  } catch {
    clearCachedAuth();
    throw new Error("Login diterima, tetapi sesi backend tidak tersambung. Buka frontend dan backend dengan host yang sama lalu login ulang.");
  }
};

export const logoutUser = async () => {
  await api.post("auth/logout/");
  clearCachedAuth();
  window.dispatchEvent(new Event("atl-auth-updated"));
  return true;
};

export const getCurrentUser = async () => {
  try {
    const data = unwrap(await api.get("auth/me/"));
    if (data.user) localStorage.setItem("atl_current_user", JSON.stringify(data.user));
    return data.user || null;
  } catch {
    clearCachedAuth();
    return null;
  }
};

export const updateCurrentUser = async (payload = {}) => {
  const data = unwrap(await api.put("auth/me/", payload));
  if (data.user) {
    localStorage.setItem("atl_current_user", JSON.stringify(data.user));
    window.dispatchEvent(new Event("atl-auth-updated"));
  }
  return data.user || null;
};

export const getAssessmentDraft = (studentId, topicId) => {
  const studentKey = String(studentId);
  const topicKey = String(topicId);
  const liveDraft = readAssessmentLiveDrafts()?.[studentKey]?.[topicKey];
  if (liveDraft) return { ...liveDraft, __source: "live" };
  const savedDraft = readAssessmentDrafts()?.[studentKey]?.[topicKey];
  return savedDraft ? { ...savedDraft, __source: "saved" } : null;
};

export const updateAssessmentLiveDrafts = (items = []) => {
  const liveDrafts = readAssessmentLiveDrafts();
  const savedDrafts = readAssessmentDrafts();
  items.forEach(({ studentId, topicId, ratings, metadata = {} }) => {
    const studentKey = String(studentId);
    const topicKey = String(topicId);
    if (!liveDrafts[studentKey]) liveDrafts[studentKey] = {};
    const current = liveDrafts[studentKey][topicKey] || savedDrafts?.[studentKey]?.[topicKey] || {};
    liveDrafts[studentKey][topicKey] = mergeDraftItem(current, ratings, metadata);
  });
  writeAssessmentLiveDrafts(liveDrafts);
  return liveDrafts;
};

export const updateAssessmentLiveDraft = (studentId, topicId, ratings, metadata = {}) => {
  updateAssessmentLiveDrafts([{ studentId, topicId, ratings, metadata }]);
  return getAssessmentDraft(studentId, topicId);
};

export const saveAssessmentDrafts = (items = []) => {
  const drafts = readAssessmentDrafts();
  const liveDrafts = readAssessmentLiveDrafts();
  items.forEach(({ studentId, topicId, ratings, metadata = {} }) => {
    const studentKey = String(studentId);
    const topicKey = String(topicId);
    if (!drafts[studentKey]) drafts[studentKey] = {};
    const current = liveDrafts?.[studentKey]?.[topicKey] || drafts[studentKey][topicKey] || {};
    drafts[studentKey][topicKey] = mergeDraftItem(current, ratings, metadata);
    if (liveDrafts[studentKey]) {
      delete liveDrafts[studentKey][topicKey];
      if (Object.keys(liveDrafts[studentKey]).length === 0) delete liveDrafts[studentKey];
    }
  });
  writeAssessmentDrafts(drafts);
  writeAssessmentLiveDrafts(liveDrafts);
  return drafts;
};

export const saveAssessmentDraft = (studentId, topicId, ratings, metadata = {}) => {
  saveAssessmentDrafts([{ studentId, topicId, ratings, metadata }]);
  return getAssessmentDraft(studentId, topicId);
};

export const clearAssessmentDrafts = (items = []) => {
  const drafts = readAssessmentDrafts();
  const liveDrafts = readAssessmentLiveDrafts();
  items.forEach(({ studentId, topicId }) => {
    const studentKey = String(studentId);
    const topicKey = String(topicId);
    if (drafts[studentKey]) {
      delete drafts[studentKey][topicKey];
      if (Object.keys(drafts[studentKey]).length === 0) delete drafts[studentKey];
    }
    if (liveDrafts[studentKey]) {
      delete liveDrafts[studentKey][topicKey];
      if (Object.keys(liveDrafts[studentKey]).length === 0) delete liveDrafts[studentKey];
    }
  });
  writeAssessmentDrafts(drafts);
  writeAssessmentLiveDrafts(liveDrafts);
};

export const clearAssessmentDraft = (studentId, topicId) => {
  clearAssessmentDrafts([{ studentId, topicId }]);
};

export const getAssessmentFilterState = () => readStorageObject(ASSESSMENT_FILTER_STORAGE_KEY);

export const saveAssessmentFilterState = (filter = {}) => {
  const next = {
    ...getAssessmentFilterState(),
    ...filter,
    updatedAt: new Date().toISOString(),
  };
  localStorage.setItem(ASSESSMENT_FILTER_STORAGE_KEY, JSON.stringify(next));
  window.dispatchEvent(new Event("atl-assessment-filter-updated"));
  return next;
};

export const getClasses = async () => {
  try {
    const data = unwrap(await api.get("classes/"));
    const classes = data.classes || [];
    if (classes.length > 0) writeClassCache(classes);
    return classes;
  } catch (error) {
    const cached = readClassCache();
    if (cached.length > 0) return cached;
    raiseApiError(error, "Gagal mengambil data kelas dari backend.");
  }
};

export const createClass = async (payload) => {
  const data = unwrap(await api.post("classes/", payload));
  return data.class || null;
};

export const deleteClass = async (classCode) => {
  if (!classCode) throw new Error("Kode kelas tidak tersedia.");
  await api.delete("classes/", { params: { code: classCode } });
  return true;
};

export const importClassStudents = async ({ file, classCode = "", displayName = "", level = "Primary" }) => {
  const formData = new FormData();
  formData.append("file", file);
  if (classCode) formData.append("classCode", classCode);
  if (displayName) formData.append("displayName", displayName);
  if (level) formData.append("level", level);
  return unwrap(await api.post("classes/import-students/", formData));
};

export const getUsers = async () => {
  const data = unwrap(await api.get("users/"));
  return data.users || [];
};

export const createUser = async (payload) => {
  const data = unwrap(await api.post("users/", payload));
  return data.user || null;
};

export const updateUser = async (userId, payload) => {
  const data = unwrap(await api.put(`users/${userId}/`, payload));
  return data.user || null;
};

export const deleteUser = async (userId) => {
  if (!userId) throw new Error("User belum dipilih.");
  await api.delete(`users/${userId}/`);
  return true;
};

const ATL_CATEGORY_ORDER = getATLDistributionTemplate().map((item) => item.category);

const emptyCategoryBuckets = () => ATL_CATEGORY_ORDER.reduce((acc, category) => ({ ...acc, [category]: [] }), {});

const normalizeCategoryScoreRows = (rows = []) => {
  const buckets = emptyCategoryBuckets();
  (rows || []).forEach((row) => {
    const category = normalizeATLCategory(row.category || row.name || row.label);
    const score = Number(row.score ?? row.val ?? row.value ?? 0);
    if (buckets[category] && Number.isFinite(score) && score > 0) buckets[category].push(score);
  });
  return ATL_CATEGORY_ORDER
    .map((category) => {
      const values = buckets[category];
      const score = values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : 0;
      return { category, score };
    })
    .filter((item) => item.score > 0);
};

const normalizeClassAnalyticsPayload = (data) => {
  if (!data || !Array.isArray(data.students)) return data;
  const students = data.students.map((student) => ({
    ...student,
    strength: normalizeATLCategory(student.strength),
    focus: normalizeATLCategory(student.focus),
    categoryScores: normalizeCategoryScoreRows(student.categoryScores || []),
  }));
  const categoryAverages = normalizeCategoryScoreRows(data.categoryAverages || students.flatMap((student) => student.categoryScores || []))
    .sort((a, b) => b.score - a.score);
  return {
    ...data,
    students,
    categoryAverages,
    topFocus: categoryAverages.slice().sort((a, b) => a.score - b.score)[0]?.category || data.topFocus || "-",
  };
};

export const mergeTopicCriteria = (topicId, criteria) => {
  if (Array.isArray(criteria)) {
    const seen = new Set();
    const rows = [];
    criteria.forEach((item) => {
      const normalized = normalizeCriterionRow(item);
      const key = normalized.id || normalized.kriteria;
      if (!key || seen.has(key)) return;
      seen.add(key);
      rows.push(normalized);
    });
    dummyATL[topicId] = rows;
    saveATLData(dummyATL);
  }
  return dummyATL[topicId] || [];
};

const normalizeCriterionId = (id, source = "") => {
  if (!id) return "";
  const value = String(id);
  if (value.includes(":")) return value;
  return source === "context" ? `context:${value}` : `criterion:${value}`;
};

const normalizeCriterionRow = (item = {}, source = "") => ({
  id: normalizeCriterionId(item.id, source),
  criterionId: item.criterionId || "",
  rubricItemId: item.rubricItemId || "",
  criteriaTopic: item.criteriaTopic || "",
  kriteria: item.kriteria || item.name || item.title || "",
  atl: item.atl || [],
  levels: item.levels || item.levelDescriptors || {},
  category: item.category,
  atlCategories: item.atlCategories || [],
  subskillIds: item.subskillIds || [],
  subskillId: item.subskillId,
  subskillName: item.subskillName || "",
});

const contextCriteriaFromFlow = (flow) => (
  (flow?.rubricItems || []).map((item) => ({
    id: normalizeCriterionId(item.id, "context"),
    rubricItemId: item.id,
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

export const getContextFlow = async (topicId) => {
  const data = unwrap(await requestWithRetry(() => api.get(`contexts/${topicId}/flow/`)));
  const criteria = contextCriteriaFromFlow(data);
  const weights = data.weights && Object.keys(data.weights).length > 0
    ? data.debug?.packages
      ? {
          ...data.weights,
          __mode: "criterion-packages",
          __savedAt: data.weights.__savedAt || data.weightUpdatedAt,
          packages: data.debug.packages,
        }
      : {
          ...data.weights,
          __savedAt: data.weights.__savedAt || data.weightUpdatedAt,
        }
    : {};
  if (criteria.length > 0) mergeTopicCriteria(topicId, criteria);
  if (Object.keys(weights).length > 0) mergeTopicWeights(topicId, weights);
  return { ...data, criteria, weights };
};

export const createContext = async (context) => {
  try {
    const data = unwrap(await api.post("contexts/", context));
    return data.context || null;
  } catch {
    return null;
  }
};

export const mergeTopicWeights = (topicId, weights) => {
  if (weights && typeof weights === "object") {
    if (!dummyATL.savedWeights) dummyATL.savedWeights = {};
    dummyATL.savedWeights[topicId] = weights;
    if (weights.__activity) {
      dummyATL.savedWeightActivities = [
        weights.__activity,
        ...(dummyATL.savedWeightActivities || []).filter((activity) => activity.topicId !== topicId),
      ].slice(0, 6);
    }
    saveATLData(dummyATL);
  }
  return dummyATL.savedWeights?.[topicId] || {};
};

const dispatchWeightEvents = () => {
  window.dispatchEvent(new Event("atl-weights-updated"));
  window.dispatchEvent(new Event("atl-data-updated"));
};

const normalizeWeightPayload = (data = {}) => {
  const weights = data.weights || {};
  const packages = data.packages || data.debug?.packages || weights.packages || {};
  if (Object.keys(packages || {}).length > 0) {
    return {
      ...weights,
      __mode: weights.__mode || "criterion-packages",
      __savedAt: weights.__savedAt || data.savedAt || data.weightUpdatedAt,
      packages,
    };
  }
  return data.savedAt || data.weightUpdatedAt
    ? { ...weights, __savedAt: weights.__savedAt || data.savedAt || data.weightUpdatedAt }
    : weights;
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
    if (className && Array.isArray(data.students)) {
      writeStudentCache(className, data.students);
      return data.students;
    }
    if (!className && data.students && !Array.isArray(data.students)) return data.students;
    return className ? [] : {};
  } catch (error) {
    const cached = className ? readStudentCache(className) : [];
    if (cached.length > 0) return cached;
    raiseApiError(error, "Gagal mengambil data siswa dari backend.");
  }
};

export const createStudent = async (payload = {}) => {
  const data = unwrap(await api.post("students/", payload));
  return data.student || null;
};

export const updateStudent = async (studentId, payload = {}) => {
  if (!studentId) throw new Error("ID siswa tidak tersedia.");
  const data = unwrap(await api.put(`students/${studentId}/`, payload));
  return data.student || null;
};

export const deleteStudent = async (studentId) => {
  if (!studentId) throw new Error("ID siswa tidak tersedia.");
  await api.delete(`students/${studentId}/`);
  return true;
};

export const getTopics = async () => {
  try {
    const data = unwrap(await api.get("topics/"));
    if (Array.isArray(data.subjects)) return setSubjectData(data.subjects);
    return setSubjectData([]);
  } catch (error) {
    const cachedSubjects = getSubjectData();
    if (cachedSubjects.length > 0) return cachedSubjects;
    raiseApiError(error, "Gagal mengambil data topik dari backend.");
  }
};

export const deleteTopic = async (topicId) => {
  if (!topicId) return false;
  try {
    await api.delete(`topics/${topicId}/`);
    return true;
  } catch {
    return false;
  }
};

export const getATLHierarchy = async () => {
  try {
    const data = unwrap(await requestWithRetry(() => api.get("atl/hierarchy/")));
    if (Array.isArray(data.categories)) return data.categories;
    return [];
  } catch (error) {
    raiseApiError(error, "Gagal mengambil hierarki ATL dari backend.");
  }
};

export const getLabels = async () => {
  const data = unwrap(await api.get("labels/"));
  return data;
};

const cachedTopicCriteria = (topicId) => (
  Array.isArray(dummyATL[topicId]) ? dummyATL[topicId] : []
);

const criteriaWithMeta = (criteria = [], meta = {}) => {
  const rows = [...(criteria || [])];
  Object.defineProperty(rows, "__meta", {
    value: meta,
    enumerable: false,
  });
  return rows;
};

export const getCriteria = async (topicId) => {
  const cachedCriteria = cachedTopicCriteria(topicId);
  let flowError = null;
  try {
    const flow = await getContextFlow(topicId);
    if (flow.criteria?.length > 0) {
      return criteriaWithMeta(flow.criteria, { source: "context", stale: false });
    }
  } catch (error) {
    flowError = error;
  }

  try {
    const data = unwrap(await requestWithRetry(() => api.get(`topics/${topicId}/criteria/`)));
    if (Array.isArray(data.criteria) && data.criteria.length === 0) {
      if (cachedCriteria.length > 0) {
        return criteriaWithMeta(cachedCriteria, {
          source: "cache",
          stale: true,
          message: "Mengambil data saat ini. Menampilkan data kriteria yang tersedia.",
        });
      }
      dummyATL[topicId] = [];
      saveATLData(dummyATL);
      return criteriaWithMeta([], { source: "backend", stale: false });
    }
    return criteriaWithMeta(mergeTopicCriteria(topicId, data.criteria || []), { source: "backend", stale: false });
  } catch (error) {
    if (cachedCriteria.length > 0) {
      return criteriaWithMeta(cachedCriteria, {
        source: "cache",
        stale: true,
        message: "Mengambil data saat ini. Menampilkan data kriteria yang tersedia.",
      });
    }
    raiseApiError(flowError || error, "Gagal mengambil rubrik/kriteria dari backend.");
  }
};

export const createCriterion = async (topicId, criterion) => {
  try {
    const data = unwrap(await api.post(`topics/${topicId}/criteria/`, criterion));
    return data.criterion || null;
  } catch (error) {
    raiseApiError(error, "Gagal menyimpan kriteria baru ke backend.");
  }
};

export const updateCriterion = async (criterionId, criterion) => {
  if (!criterionId) throw new Error("ID kriteria tidak tersedia.");
  try {
    const data = unwrap(await api.put(`criteria/${criterionId}/`, criterion));
    return data.criterion || null;
  } catch (error) {
    raiseApiError(error, "Gagal menyimpan perubahan kriteria ke backend.");
  }
};

export const deleteCriterion = async (criterionId) => {
  if (!criterionId) throw new Error("ID kriteria tidak tersedia.");
  try {
    await api.delete(`criteria/${criterionId}/`);
    return true;
  } catch (error) {
    raiseApiError(error, "Gagal menghapus kriteria dari backend.");
  }
};

export const calculateContextWeights = async (contextId, pairwise, options = {}) => {
  const persist = options.persist ?? true;
  const data = unwrap(await api.post(`contexts/${contextId}/weights/calculate/`, { pairwise, persist }));
  if (persist && data.weights) {
    mergeTopicWeights(contextId, normalizeWeightPayload(data));
    dispatchWeightEvents();
  }
  return data;
};

export const saveContextWeights = async (contextId, payload = {}) => {
  const savedAt = payload.savedAt || new Date().toISOString();
  const data = unwrap(await api.post(`contexts/${contextId}/weights/calculate/`, {
    persist: true,
    pairwise: {
      __criterionPackages: true,
      packages: payload.packages || {},
      savedAt,
      activity: payload.activity || {},
      validationAcknowledged: Boolean(payload.validationAcknowledged),
    },
  }));
  const cachedWeights = normalizeWeightPayload(data);
  mergeTopicWeights(contextId, cachedWeights);
  dispatchWeightEvents();
  return { ...data, weights: cachedWeights, savedAt };
};

export const getContextPairwiseScale = async (contextId) => {
  const data = unwrap(await api.get(`contexts/${contextId}/pairwise-scale/`));
  return data.scaleOptions || [];
};

export const updateContextPairwiseScale = async (contextId, options = []) => {
  const data = unwrap(await api.put(`contexts/${contextId}/pairwise-scale/`, { options }));
  return data.scaleOptions || [];
};

export const resetContextPairwiseScale = async (contextId) => {
  const data = unwrap(await api.post(`contexts/${contextId}/pairwise-scale/reset/`));
  return data.scaleOptions || [];
};

export const getAssessments = async ({ topicId, studentId } = {}) => {
  try {
    const params = {};
    if (topicId) params.topic = topicId;
    if (studentId) params.student = studentId;
    const data = unwrap(await api.get("assessments/", { params }));
    return mergeAssessments(data.assessments || {});
  } catch (error) {
    raiseApiError(error, "Gagal mengambil nilai assessment dari backend.");
  }
};

export const previewAssessmentScores = async (items = []) => {
  if (!Array.isArray(items) || items.length === 0) return {};
  try {
    const data = unwrap(await api.post("assessments/preview/", { items }));
    return data.scores || {};
  } catch (error) {
    raiseApiError(error, "Gagal menghitung preview penilaian dari backend.");
  }
};

export const saveAssessment = async (studentId, topicId, ratings, options = {}) => {
  try {
    const data = unwrap(await api.post("assessments/", { studentId, topic: topicId, ratings, ...options }));
    if (data.assessments) {
      mergeAssessments(data.assessments);
    } else {
      if (!dummyATL.savedAssessments) dummyATL.savedAssessments = {};
      if (!dummyATL.savedAssessments[studentId]) dummyATL.savedAssessments[studentId] = {};
      dummyATL.savedAssessments[studentId][topicId] = { ...(data.ratings || ratings) };
      saveATLData(dummyATL);
    }
    markReportDataDirty();
    window.dispatchEvent(new Event("atl-data-updated"));
    recordBackendSaveAudit({
      type: "assessment-detail",
      success: true,
      studentId,
      topicId,
      status: data.status || "saved",
      ratingCount: Object.values(ratings || {}).filter(Boolean).length,
      hasBackendSnapshot: Boolean(data.assessments),
    });
    return { synced: true, status: data.status || "saved", assessments: data.assessments || null };
  } catch (error) {
    const message = assessmentSyncError(error);
    recordBackendSaveAudit({
      type: "assessment-detail",
      success: false,
      studentId,
      topicId,
      error: message,
      statusCode: error?.response?.status || null,
    });
    return { synced: false, error: message };
  }
};

export const saveAssessmentBatch = async (items = []) => {
  try {
    const data = unwrap(await api.post("assessments/", { items }));
    if (data.assessments) mergeAssessments(data.assessments);
    markReportDataDirty();
    window.dispatchEvent(new Event("atl-data-updated"));
    recordBackendSaveAudit({
      type: "assessment-batch",
      success: true,
      topicId: items[0]?.topicId || items[0]?.topic || "",
      itemCount: items.length,
      savedCount: data.savedCount || 0,
      clearedCount: data.clearedCount || 0,
      hasBackendSnapshot: Boolean(data.assessments),
    });
    return {
      synced: true,
      assessments: data.assessments || null,
      items: data.items || [],
      savedCount: data.savedCount || 0,
      clearedCount: data.clearedCount || 0,
    };
  } catch (error) {
    const message = assessmentSyncError(error);
    recordBackendSaveAudit({
      type: "assessment-batch",
      success: false,
      topicId: items[0]?.topicId || items[0]?.topic || "",
      itemCount: items.length,
      error: message,
      statusCode: error?.response?.status || null,
    });
    return { synced: false, error: message };
  }
};

export const getReport = async (className, topicId) => {
  try {
    const data = unwrap(await api.get("reports/", { params: { class: className, topic: topicId, context: topicId } }));
    if (Array.isArray(data.students)) return data;
    return { ...data, students: [] };
  } catch (error) {
    raiseApiError(error, "Gagal mengambil report dari backend.");
  }
};

export const exportReportExcel = async (payload) => {
  let response;
  try {
    response = await api.post("reports/export/", payload, { responseType: "blob" });
  } catch (error) {
    const blob = error.response?.data;
    if (blob?.text) {
      try {
        const text = await blob.text();
        const parsed = JSON.parse(text);
        const message = parsed.error || parsed.message;
        if (message) throw new Error(message);
      } catch (parseError) {
        if (parseError?.message && !parseError.message.startsWith("Unexpected")) throw parseError;
      }
    }
    throw new Error("Export Excel gagal. Pastikan backend berjalan dan payload report valid.");
  }
  const contentType = response.headers?.["content-type"] || response.data?.type || "";
  if (!contentType.includes("spreadsheetml.sheet")) {
    let message = "Response export bukan file Excel.";
    try {
      const text = await response.data.text();
      const parsed = JSON.parse(text);
      message = parsed.error || parsed.message || message;
    } catch {
      // Keep the generic message when the blob cannot be parsed as JSON.
    }
    throw new Error(message);
  }
  const disposition = response.headers?.["content-disposition"] || "";
  const encodedMatch = disposition.match(/filename\*=UTF-8''([^;]+)/i);
  const match = disposition.match(/filename="?([^";]+)"?/i);
  const filename = encodedMatch
    ? decodeURIComponent(encodedMatch[1])
    : match?.[1];
  return {
    blob: response.data,
    filename: filename || payload?.meta?.filename || "ATL_Report.xlsx",
  };
};

export const getDashboardAnalytics = async () => {
  try {
    const data = unwrap(await api.get("dashboard/"));
    if (data?.summary || data?.overviewCards?.length) return data;
    return {};
  } catch (error) {
    raiseApiError(error, "Gagal mengambil dashboard dari backend.");
  }
};

export const getClassAnalytics = async (className) => {
  try {
    const data = normalizeClassAnalyticsPayload(unwrap(await api.get("students/analytics/", { params: className ? { class: className } : {} })));
    if (Array.isArray(data.students)) return data;
    return { ...data, students: [] };
  } catch (error) {
    raiseApiError(error, "Gagal mengambil analytics siswa dari backend.");
  }
};

export const hydrateTopic = async (topicId) => {
  const [criteriaResult, flowResult, assessmentResult] = await Promise.allSettled([
    getCriteria(topicId),
    getContextFlow(topicId),
    getAssessments({ topicId }),
  ]);
  const criteria = criteriaResult.status === "fulfilled" ? criteriaResult.value : [];
  const flow = flowResult.status === "fulfilled" ? flowResult.value : {};
  const assessments = assessmentResult.status === "fulfilled" ? assessmentResult.value : dummyATL.savedAssessments || {};
  const cachedCriteria = dummyATL[topicId] || [];
  const errors = [criteriaResult, flowResult, assessmentResult]
    .filter((result) => result.status === "rejected")
    .map((result) => result.reason?.message)
    .filter(Boolean);
  return {
    criteria: criteria.length > 0 ? criteria : flow.criteria?.length > 0 ? flow.criteria : cachedCriteria,
    weights: flow.weights || {},
    assessments,
    flow,
    stale: errors.length > 0,
    error: errors[0] || "",
  };
};

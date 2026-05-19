import api from "../api";
import { dummyATL, saveATLData } from "../components/dash/dummyATL";
import { allStudentsData } from "../components/dash/dummyStudents";

const unwrap = (response) => response?.data || {};

const getLocalATLData = () => {
  try {
    const saved = localStorage.getItem("atl_framework_data");
    return saved ? JSON.parse(saved) : null;
  } catch (error) {
    return null;
  }
};

const atlCategoryMap = {
  "Critical Thingking": "Thinking Skills",
  "Critical Thinking": "Thinking Skills",
  "Creative Thingking": "Thinking Skills",
  "Creative Thinking": "Thinking Skills",
  InformationTransfer: "Thinking Skills",
  "Reflection / Metacognitive": "Thinking Skills",
  "Textual Literacy": "Research Skills",
  "Media Literacy": "Research Skills",
  "Ethical use of information": "Research Skills",
  "Exchanging-information": "Communication Skills",
  "Literacy skills": "Communication Skills",
  "ICT skills": "Communication Skills",
  "Interpersonal relationships": "Social Skills",
  "Social-emotional intelligence": "Social Skills",
  "Organization skills": "Self-Management Skills",
  "State of Mind": "Self-Management Skills",
};

const ratingScoreMap = {
  "Exceeding Expectation": 90,
  "Meeting Expectation": 70,
  "Developing Expectation": 50,
  "Progressing Toward Expectation": 30,
  "Need Further Improvement": 10,
  "Need Improvement": 10,
};

const atlDistributionTemplate = [
  { category: "Thinking Skills", score: 0, color: "#F6B21A" },
  { category: "Communication Skills", score: 0, color: "#4F8DE8" },
  { category: "Social Skills", score: 0, color: "#45B978" },
  { category: "Self-Management Skills", score: 0, color: "#8D55D7" },
  { category: "Research Skills", score: 0, color: "#14B8A6" },
];

const scoreCategory = (score) => {
  const value = Number(score || 0);
  if (value >= 85) return { label: "Excellent", color: "#10b981", badgeClass: "bg-emerald-100 text-emerald-700" };
  if (value >= 70) return { label: "Good", color: "#3b82f6", badgeClass: "bg-blue-100 text-blue-700" };
  if (value >= 50) return { label: "Average", color: "#f59e0b", badgeClass: "bg-amber-100 text-amber-700" };
  if (value >= 30) return { label: "Low", color: "#f97316", badgeClass: "bg-orange-100 text-orange-700" };
  return { label: "Critical", color: "#ef4444", badgeClass: "bg-red-100 text-red-700" };
};

const noDataLevel = { label: "No Data", color: "#a8a29e", badgeClass: "bg-stone-100 text-stone-500", count: 0 };

const parsePercent = (value) => {
  const parsed = Number(String(value ?? "").replace("%", ""));
  return Number.isFinite(parsed) ? parsed : 0;
};

const buildLocalClassAnalytics = (className, atlData = getLocalATLData()) => {
  const students = allStudentsData[className] || [];
  const assessments = atlData?.savedAssessments || {};
  const analytics = students.map((student) => {
    const studentAssessments = assessments[String(student.id)] || {};
    const topicScores = [];
    const categoryBuckets = {};
    const topicDetails = Object.entries(studentAssessments).map(([topicId, ratings]) => {
      const scores = Object.values(ratings || {}).map((label) => ratingScoreMap[label]).filter(Boolean);
      const average = scores.length ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length) : 0;
      topicScores.push(...scores);

      const criteria = atlData?.[topicId] || [];
      Object.entries(ratings || {}).forEach(([ratingKey, ratingLabel]) => {
        const score = ratingScoreMap[ratingLabel];
        if (!score) return;
        const matchedCriterion = criteria.find((criterion) => ratingKey.includes(`_${criterion.kriteria}_`));
        const matchedSubskill = (matchedCriterion?.atl || []).find((subskill) => ratingKey.endsWith(`_${subskill}`));
        const category =
          (matchedCriterion?.atlCategories || [])[0] ||
          atlCategoryMap[matchedSubskill] ||
          "Thinking Skills";
        if (!categoryBuckets[category]) categoryBuckets[category] = [];
        categoryBuckets[category].push(score);
      });

      return {
        topicId,
        subject: topicId.split("_")[0]?.toUpperCase() || "Subject",
        topic: topicId.replace(/_/g, " "),
        score: average,
        assessedItems: scores.length,
        level: scoreCategory(average),
      };
    });

    const computedScore = topicScores.length
      ? Math.round(topicScores.reduce((sum, score) => sum + score, 0) / topicScores.length)
      : null;
    const fallbackScore = parsePercent(student.overall);
    const overallScore = computedScore ?? (fallbackScore || null);
    const categoryScores = Object.entries(categoryBuckets).map(([category, values]) => ({
      category,
      score: Math.round(values.reduce((sum, value) => sum + value, 0) / values.length),
    }));
    if (categoryScores.length === 0 && student.strength && student.strength !== "-") {
      categoryScores.push({ category: student.strength, score: parsePercent(student.strengthValue) || fallbackScore || 0 });
      if (student.focus && student.focus !== student.strength) {
        categoryScores.push({ category: student.focus, score: Math.max(0, (fallbackScore || 55) - 10) });
      }
    }
    const strength = categoryScores.slice().sort((a, b) => b.score - a.score)[0];
    const focus = categoryScores.slice().sort((a, b) => a.score - b.score)[0];

    return {
      ...student,
      assessedTopics: topicDetails.length,
      overallScore,
      overall: overallScore === null ? "-" : `${overallScore}%`,
      level: overallScore === null ? noDataLevel : scoreCategory(overallScore),
      strength: strength?.category || student.strength || "-",
      strengthValue: strength ? `${strength.score}%` : student.strengthValue || "-",
      focus: focus?.category || student.focus || "-",
      focusValue: focus ? `${focus.score}%` : student.focusValue || "-",
      trendValue: overallScore === null ? "-" : student.trendValue || `${overallScore >= 70 ? "+" : "-"}1%`,
      categoryScores,
      topicDetails,
    };
  });

  const assessed = analytics.filter((student) => student.overallScore !== null);
  const average = assessed.length
    ? Math.round(assessed.reduce((sum, student) => sum + student.overallScore, 0) / assessed.length)
    : 0;
  const distribution = [
    { key: "excellent", ...scoreCategory(90), range: "85-100", count: 0 },
    { key: "good", ...scoreCategory(75), range: "70-84", count: 0 },
    { key: "average", ...scoreCategory(55), range: "50-69", count: 0 },
    { key: "low", ...scoreCategory(35), range: "30-49", count: 0 },
    { key: "critical", ...scoreCategory(10), range: "0-29", count: 0 },
  ].map((bucket) => ({
    ...bucket,
    count: assessed.filter((student) => scoreCategory(student.overallScore).label === bucket.label).length,
  }));

  const categoryBuckets = {};
  analytics.forEach((student) => {
    (student.categoryScores || []).forEach((item) => {
      if (!categoryBuckets[item.category]) categoryBuckets[item.category] = [];
      categoryBuckets[item.category].push(item.score);
    });
  });
  const categoryAverages = Object.entries(categoryBuckets)
    .map(([category, values]) => ({ category, score: Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) }))
    .sort((a, b) => b.score - a.score);

  return {
    students: analytics,
    assessedCount: assessed.length,
    totalStudents: students.length,
    average,
    averageLevel: assessed.length ? scoreCategory(average) : noDataLevel,
    distribution,
    dominantCategory: assessed.length ? distribution.reduce((top, item) => (item.count > top.count ? item : top), distribution[0]) : noDataLevel,
    categoryAverages,
    topFocus: categoryAverages.slice().sort((a, b) => a.score - b.score)[0]?.category || "-",
    completion: students.length ? Math.round((assessed.length / students.length) * 100) : 0,
  };
};

const buildLocalDashboardFallback = (atlData = getLocalATLData()) => {
  const totalStudents = Object.values(allStudentsData).reduce((sum, students) => sum + students.length, 0);
  const assessments = atlData?.savedAssessments || {};
  const assessedStudentIds = Object.keys(assessments).filter((studentId) => Object.keys(assessments[studentId] || {}).length > 0);
  const assessmentSaved = assessedStudentIds.reduce((sum, studentId) => sum + Object.keys(assessments[studentId] || {}).length, 0);
  const topicActive = new Set(assessedStudentIds.flatMap((studentId) => Object.keys(assessments[studentId] || {}))).size;
  const criteriaCount = Object.entries(atlData || {}).reduce((sum, [key, value]) => (Array.isArray(value) ? sum + value.length : sum), 0);
  const categoryBuckets = {};
  let scoreTotal = 0;
  let scoreCount = 0;

  assessedStudentIds.forEach((studentId) => {
    Object.entries(assessments[studentId] || {}).forEach(([topicId, ratings]) => {
      const criteria = atlData?.[topicId] || [];
      Object.entries(ratings || {}).forEach(([ratingKey, ratingLabel]) => {
        const score = ratingScoreMap[ratingLabel];
        if (!score) return;
        scoreTotal += score;
        scoreCount += 1;
        const matchedCriterion = criteria.find((criterion) => ratingKey.includes(`_${criterion.kriteria}_`));
        const matchedSubskill = (matchedCriterion?.atl || []).find((subskill) => ratingKey.endsWith(`_${subskill}`));
        const category =
          (matchedCriterion?.atlCategories || [])[0] ||
          atlCategoryMap[matchedSubskill] ||
          "Thinking Skills";
        if (!categoryBuckets[category]) categoryBuckets[category] = [];
        categoryBuckets[category].push(score);
      });
    });
  });

  const average = scoreCount ? Math.round(scoreTotal / scoreCount) : 0;
  const completion = totalStudents ? Math.round((assessedStudentIds.length / totalStudents) * 100) : 0;
  const atlDistribution = atlDistributionTemplate.map((item) => {
    const values = categoryBuckets[item.category] || [];
    return { ...item, score: values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : 0 };
  });
  const strongest = atlDistribution.slice().sort((a, b) => b.score - a.score)[0]?.category || "-";
  const focus = atlDistribution.filter((item) => item.score > 0).sort((a, b) => a.score - b.score)[0]?.category || "-";

  return {
    meta: { semester: "Semester 2 (2024/2025)", updatedAt: new Date().toISOString(), source: "frontend-local-fallback" },
    summary: {
      average,
      completion,
      totalStudents,
      assessedStudents: assessedStudentIds.length,
      assessmentSaved,
      topicActive,
      criteriaCount,
      bestClass: Object.keys(allStudentsData)[0] || "-",
      needAttention: 0,
      strongestATL: strongest,
      focusATL: focus,
      level: { label: average >= 70 ? "Good" : average >= 50 ? "Average" : average > 0 ? "Low" : "No Data", color: "#F6B21A" },
    },
    systemRecap: [
      { label: "Progress Penilaian", value: `${completion}%`, note: "Membaca data localStorage", icon: "tips_and_updates" },
      { label: "Fokus Utama", value: focus, note: "Berdasarkan rating ATL tersimpan", icon: "emoji_objects" },
      { label: "Siswa Perlu Perhatian", value: "0", note: "Butuh data backend untuk deteksi detail", icon: "person_alert" },
      { label: "Update Terakhir", value: "Hari ini", note: "Fallback lokal aktif", icon: "schedule" },
    ],
    overviewCards: [
      { label: "Cakupan Penilaian", value: `${completion}%`, note: "Sebagian siswa sudah memiliki penilaian ATL.", icon: "pie_chart", color: "blue" },
      { label: "Total Siswa", value: String(totalStudents), note: "Siswa aktif dalam proses penilaian semester ini.", icon: "groups", color: "amber" },
      { label: "Penilaian Tersimpan", value: String(assessmentSaved), note: "Penilaian ATL yang ditemukan di localStorage.", icon: "assignment_turned_in", color: "sky" },
      { label: "Topik Aktif", value: String(topicActive), note: "Topik ATL yang sudah memiliki input nilai.", icon: "auto_stories", color: "violet" },
    ],
    atlDistribution,
    trend: [-8, -2, 3, -1, -7].map((delta, index) => ({ label: `Minggu ${index + 1}`, score: Math.max(0, Math.min(100, average + delta)) })),
    classComparison: Object.entries(allStudentsData).map(([className, students]) => ({
      className,
      average,
      totalStudents: students.length,
      assessedCount: 0,
    })),
    attentionStudents: [],
    teacherMonitoring: [
      { name: "Joko Wiryanto", progress: completion, color: "#45B978" },
      { name: "Nadia Fatthurrahmi", progress: Math.max(0, completion - 15), color: "#F6B21A" },
      { name: "Budhi Nugroho", progress: Math.max(0, completion - 30), color: "#EF4444" },
    ],
    recentActivities: (atlData?.savedWeightActivities || []).slice(0, 5).map((activity) => ({
      type: "Weighting",
      title: `Bobot ${activity.topicLabel || activity.topicId} disimpan`,
      time: activity.savedAt,
    })),
    workflow: [
      { step: 1, title: "Input Penilaian", note: "Guru melakukan input penilaian ATL", icon: "edit_note", color: "#45B978" },
      { step: 2, title: "Perhitungan Bobot", note: "Sistem menghitung bobot kriteria", icon: "hub", color: "#45B978" },
      { step: 3, title: "Analisis Siswa", note: "Nilai dianalisis berdasarkan ATL", icon: "school", color: "#F6B21A" },
      { step: 4, title: "Review & Validasi", note: "Validasi oleh pihak terkait", icon: "verified", color: "#4F8DE8" },
      { step: 5, title: "Laporan Akhir", note: "Hasil siap dilihat dan diunduh", icon: "person", color: "#9CA3AF" },
    ],
    documents: [
      { title: "Laporan Kelas", note: "Ringkasan ATL per kelas", icon: "description", color: "green" },
      { title: "Laporan Siswa", note: "Detail ATL per siswa", icon: "person", color: "violet" },
      { title: "Laporan Topik", note: "Ringkasan per topik ATL", icon: "content_paste", color: "amber" },
      { title: "Export Data", note: "Unduh data mentah", icon: "cloud_download", color: "blue" },
    ],
  };
};

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

export const getLabels = async () => {
  const data = unwrap(await api.get("labels/"));
  return data;
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

export const exportReportExcel = async (payload) => {
  const response = await api.post("reports/export/", payload, { responseType: "blob" });
  const disposition = response.headers?.["content-disposition"] || "";
  const match = disposition.match(/filename="?([^"]+)"?/i);
  return {
    blob: response.data,
    filename: match?.[1] || payload?.meta?.filename || "ATL_Report.xlsx",
  };
};

export const getDashboardAnalytics = async () => {
  const atlData = getLocalATLData();
  if (atlData && Object.keys(atlData).length > 0) {
    try {
      const data = unwrap(await api.post("dashboard/", { atlData }));
      if (data?.summary) return data;
    } catch (error) {
      // GET fallback below still supports database-backed dashboards.
    }
  }

  try {
    const data = unwrap(await api.get("dashboard/"));
    if (data?.summary?.totalStudents || data?.overviewCards?.length) return data;
    return buildLocalDashboardFallback(atlData);
  } catch (error) {
    return buildLocalDashboardFallback(atlData);
  }
};

export const getClassAnalytics = async (className) => {
  const atlData = getLocalATLData();
  if (atlData && Object.keys(atlData).length > 0) {
    try {
      const data = unwrap(await api.post("students/analytics/", { class: className, atlData }));
      if (Array.isArray(data.students) && data.students.some((student) => student.overallScore !== null)) return data;
    } catch (error) {
      // GET fallback below still supports database-backed analytics.
    }
  }

  try {
    const data = unwrap(await api.get("students/analytics/", { params: className ? { class: className } : {} }));
    if (Array.isArray(data.students) && data.students.some((student) => student.overallScore !== null)) return data;
  } catch (error) {
    // Page-level fallback handles empty analytics.
  }
  return buildLocalClassAnalytics(className, atlData);
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

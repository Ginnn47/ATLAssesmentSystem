const ratingValueMap = {
  "Exceeding Expectation": 0.9,
  "Meeting Expectation": 0.7,
  "Developing Expectation": 0.5,
  "Progressing Toward Expectation": 0.3,
  "Need Further Improvement": 0.1,
  "Need Improvement": 0.1,
};

const subskillATLMap = {
  "Critical Thingking": "Thinking",
  "Creative Thingking": "Thinking",
  InformationTransfer: "Thinking",
  "Reflection / Metacognitive": "Thinking",
  "Textual Literacy": "Research",
  "Media Literacy": "Research",
  "Ethical use of information": "Research",
  "Exchanging-information": "Communication",
  "Literacy skills": "Communication",
  "ICT skills": "Communication",
  "Interpersonal relationships": "Social",
  "Social-emotional intelligence": "Social",
  "Organization skills": "Self-management",
  "State of Mind": "Self-management",
};

const noDataLevel = { label: "No Data", color: "#a8a29e", badgeClass: "bg-stone-100 text-stone-500", count: 0 };

export const scoreCategory = (score) => {
  const value = Number(score || 0);
  if (value >= 85) return { label: "Excellent", color: "#10b981", badgeClass: "bg-emerald-100 text-emerald-700" };
  if (value >= 70) return { label: "Good", color: "#3b82f6", badgeClass: "bg-blue-100 text-blue-700" };
  if (value >= 50) return { label: "Average", color: "#f59e0b", badgeClass: "bg-amber-100 text-amber-700" };
  if (value >= 30) return { label: "Low", color: "#f97316", badgeClass: "bg-orange-100 text-orange-700" };
  return { label: "Critical", color: "#ef4444", badgeClass: "bg-red-100 text-red-700" };
};

const getCriterionWeight = (weights, criterionTitle, subskill) => {
  const packageWeight = Object.values(weights.packages || {}).find((pkg) => pkg.title === criterionTitle)?.weights?.[subskill];
  const flatKey = `${criterionTitle} (${subskill})`;
  return Number(packageWeight ?? weights[flatKey] ?? weights[subskill] ?? 0);
};

export const calculateStudentTopicScore = (dummyATL, studentId, topicId) => {
  const criteria = dummyATL[topicId] || [];
  const assessments = dummyATL.savedAssessments?.[studentId]?.[topicId] || {};
  const weights = dummyATL.savedWeights?.[topicId] || {};
  let totalWeightedScore = 0;
  let totalWeight = 0;
  let fallbackScore = 0;
  let fallbackCount = 0;
  let filled = 0;
  let possible = 0;

  criteria.forEach((criterion) => {
    (criterion.atl || []).forEach((subskill) => {
      possible += 1;
      const ratingLabel = assessments[`${topicId}_${criterion.kriteria}_${subskill}`];
      const ratingValue = ratingValueMap[ratingLabel];
      if (!ratingValue) return;

      filled += 1;
      const weight = getCriterionWeight(weights, criterion.kriteria, subskill);
      if (weight > 0) {
        totalWeightedScore += ratingValue * weight;
        totalWeight += weight;
      }
      fallbackScore += ratingValue * 100;
      fallbackCount += 1;
    });
  });

  const score =
    totalWeight > 0
      ? (totalWeightedScore / totalWeight) * 100
      : fallbackCount > 0
        ? fallbackScore / fallbackCount
        : null;

  return {
    filled,
    possible,
    score: score === null ? null : Math.round(score),
  };
};

export const getStudentAnalytics = (student, dummyATL) => {
  const topicIds = Object.keys(dummyATL.savedAssessments?.[student.id] || {}).filter((topicId) => Array.isArray(dummyATL[topicId]));
  const topicScores = topicIds.map((topicId) => calculateStudentTopicScore(dummyATL, student.id, topicId)).filter((item) => item.score !== null);
  const score =
    topicScores.length > 0
      ? Math.round(topicScores.reduce((sum, item) => sum + item.score, 0) / topicScores.length)
      : null;

  const categoryBuckets = {};
  topicIds.forEach((topicId) => {
    const assessments = dummyATL.savedAssessments?.[student.id]?.[topicId] || {};
    (dummyATL[topicId] || []).forEach((criterion) => {
      (criterion.atl || []).forEach((subskill) => {
        const ratingValue = ratingValueMap[assessments[`${topicId}_${criterion.kriteria}_${subskill}`]];
        if (!ratingValue) return;
        const category = subskillATLMap[subskill] || criterion.atlCategories?.[0] || "ATL";
        if (!categoryBuckets[category]) categoryBuckets[category] = [];
        categoryBuckets[category].push(ratingValue * 100);
      });
    });
  });

  const categoryScores = Object.entries(categoryBuckets).map(([category, values]) => ({
    category,
    score: Math.round(values.reduce((sum, value) => sum + value, 0) / values.length),
  }));
  const strength = categoryScores.slice().sort((a, b) => b.score - a.score)[0];
  const focus = categoryScores.slice().sort((a, b) => a.score - b.score)[0];

  return {
    ...student,
    assessedTopics: topicScores.length,
    overallScore: score,
    overall: score === null ? "-" : `${score}%`,
    level: scoreCategory(score || 0),
    strength: strength?.category || "-",
    strengthValue: strength ? `${strength.score}%` : "-",
    focus: focus?.category || "-",
    focusValue: focus ? `${focus.score}%` : "-",
    trendValue: score === null ? "-" : `${score >= 70 ? "+" : "-"}${Math.max(1, Math.round(Math.abs(score - 70) / 5))}%`,
    categoryScores,
  };
};

export const getClassAnalytics = (students, dummyATL) => {
  const analytics = students.map((student) => getStudentAnalytics(student, dummyATL));
  const assessed = analytics.filter((student) => student.overallScore !== null);
  const total = students.length;
  const average = assessed.length > 0 ? Math.round(assessed.reduce((sum, student) => sum + student.overallScore, 0) / assessed.length) : 0;
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

  const categoryValues = {};
  analytics.forEach((student) => {
    student.categoryScores.forEach(({ category, score }) => {
      if (!categoryValues[category]) categoryValues[category] = [];
      categoryValues[category].push(score);
    });
  });
  const categoryAverages = Object.entries(categoryValues)
    .map(([category, values]) => ({
      category,
      score: Math.round(values.reduce((sum, value) => sum + value, 0) / values.length),
    }))
    .sort((a, b) => b.score - a.score);

  const filled = analytics.reduce((sum, student) => {
    const topicIds = Object.keys(dummyATL.savedAssessments?.[student.id] || {});
    return sum + topicIds.reduce((topicSum, topicId) => topicSum + calculateStudentTopicScore(dummyATL, student.id, topicId).filled, 0);
  }, 0);
  const possible = students.reduce((sum, student) => {
    const topicIds = Object.keys(dummyATL.savedAssessments?.[student.id] || {});
    return sum + topicIds.reduce((topicSum, topicId) => topicSum + calculateStudentTopicScore(dummyATL, student.id, topicId).possible, 0);
  }, 0);

  return {
    students: analytics,
    assessedCount: assessed.length,
    totalStudents: total,
    average,
    averageLevel: assessed.length > 0 ? scoreCategory(average) : noDataLevel,
    distribution,
    dominantCategory: assessed.length > 0 ? distribution.reduce((top, item) => (item.count > top.count ? item : top), distribution[0]) : noDataLevel,
    categoryAverages,
    topFocus: categoryAverages.slice().sort((a, b) => a.score - b.score)[0]?.category || "-",
    completion: possible > 0 ? Math.round((filled / possible) * 100) : 0,
  };
};

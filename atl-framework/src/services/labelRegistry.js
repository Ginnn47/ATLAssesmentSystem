import api from "../api";

export const fallbackLabelRegistry = {
  scoreLevels: [
    { min: 85, label: "Excellent", color: "#10B981", tone: "emerald", className: "bg-emerald-100 text-emerald-700", badgeClass: "bg-emerald-100 text-emerald-700", description: "Consistently exceeds expectations" },
    { min: 70, label: "Good", color: "#3B82F6", tone: "blue", className: "bg-blue-100 text-blue-700", badgeClass: "bg-blue-100 text-blue-700", description: "Meets expectations with consistent performance" },
    { min: 50, label: "Average", color: "#F59E0B", tone: "amber", className: "bg-amber-100 text-amber-700", badgeClass: "bg-amber-100 text-amber-700", description: "Developing and needs steady reinforcement" },
    { min: 30, label: "Low", color: "#F97316", tone: "orange", className: "bg-orange-100 text-orange-700", badgeClass: "bg-orange-100 text-orange-700", description: "Needs guided support to progress" },
    { min: 0, label: "Critical", color: "#EF4444", tone: "red", className: "bg-red-100 text-red-700", badgeClass: "bg-red-100 text-red-700", description: "Requires immediate support and monitoring" },
  ],
  noDataLevel: { label: "No Data", color: "#A8A29E", tone: "stone", className: "bg-stone-100 text-stone-500", badgeClass: "bg-stone-100 text-stone-500", description: "No assessment data is available yet", count: 0 },
  atlCategories: {
    "Thinking Skills": { key: "thinking", label: "Thinking Skills", aliases: ["Thinking", "Critical Thinking"], icon: "psychology", color: "#0EA5E9", chipClass: "border-sky-200 bg-sky-50 text-sky-700", toneClass: "bg-sky-100 text-sky-700 ring-sky-200", textClass: "text-sky-700", bgClass: "bg-sky-50", borderClass: "border-sky-200", barClass: "from-sky-400 to-sky-600", dotClass: "bg-sky-500" },
    "Research Skills": { key: "research", label: "Research Skills", aliases: ["Research"], icon: "menu_book", color: "#8B5CF6", chipClass: "border-violet-200 bg-violet-50 text-violet-700", toneClass: "bg-violet-100 text-violet-700 ring-violet-200", textClass: "text-violet-700", bgClass: "bg-violet-50", borderClass: "border-violet-200", barClass: "from-violet-400 to-violet-600", dotClass: "bg-violet-500" },
    "Communication Skills": { key: "communication", label: "Communication Skills", aliases: ["Communication"], icon: "forum", color: "#D946EF", chipClass: "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700", toneClass: "bg-fuchsia-100 text-fuchsia-700 ring-fuchsia-200", textClass: "text-fuchsia-700", bgClass: "bg-fuchsia-50", borderClass: "border-fuchsia-200", barClass: "from-fuchsia-400 to-fuchsia-600", dotClass: "bg-fuchsia-500" },
    "Social Skills": { key: "social", label: "Social Skills", aliases: ["Social", "Collaboration"], icon: "groups", color: "#84CC16", chipClass: "border-lime-200 bg-lime-50 text-lime-700", toneClass: "bg-lime-100 text-lime-700 ring-lime-200", textClass: "text-lime-700", bgClass: "bg-lime-50", borderClass: "border-lime-200", barClass: "from-lime-400 to-lime-600", dotClass: "bg-lime-500" },
    "Self-Management Skills": { key: "self-management", label: "Self-Management Skills", aliases: ["Self-Management", "Self Management"], icon: "work", color: "#DC2626", chipClass: "border-red-200 bg-red-50 text-red-700", toneClass: "bg-red-100 text-red-700 ring-red-200", textClass: "text-red-700", bgClass: "bg-red-50", borderClass: "border-red-200", barClass: "from-red-400 to-red-600", dotClass: "bg-red-500" },
  },
  subskills: {
    "Critical Thingking": { category: "Thinking Skills", icon: "psychology_alt", bg: "bg-[#00E5E5]", bar: "bg-[#00E5E5]", colorHex: "rgb(0, 229, 229)" },
    "Critical Thinking": { category: "Thinking Skills", canonical: "Critical Thingking", icon: "psychology_alt", bg: "bg-[#00E5E5]", bar: "bg-[#00E5E5]", colorHex: "rgb(0, 229, 229)" },
    "Creative Thingking": { category: "Thinking Skills", icon: "lightbulb", bg: "bg-[#0B0787]", bar: "bg-[#0B0787]", colorHex: "rgb(11, 7, 135)" },
    "Creative Thinking": { category: "Thinking Skills", canonical: "Creative Thingking", icon: "lightbulb", bg: "bg-[#0B0787]", bar: "bg-[#0B0787]", colorHex: "rgb(11, 7, 135)" },
    InformationTransfer: { category: "Thinking Skills", icon: "sync_alt", bg: "bg-[#1100FF]", bar: "bg-[#1100FF]", colorHex: "rgb(17, 0, 255)" },
    "Reflection / Metacognitive": { category: "Thinking Skills", icon: "neurology", bg: "bg-[#4B8DBB]", bar: "bg-[#4B8DBB]", colorHex: "rgb(75, 141, 187)" },
    "Textual Literacy": { category: "Research Skills", icon: "article", bg: "bg-red-600", bar: "bg-red-600", colorHex: "rgb(243, 147, 73)" },
    "Media Literacy": { category: "Research Skills", icon: "perm_media", bg: "bg-red-500", bar: "bg-red-500", colorHex: "rgb(243, 0, 0)" },
    "Ethical use of information": { category: "Research Skills", icon: "shield", bg: "bg-red-700", bar: "bg-red-700", colorHex: "rgb(93, 2, 2)" },
    "Exchanging-information": { category: "Communication Skills", icon: "chat_bubble", bg: "bg-purple-600", bar: "bg-purple-600", colorHex: "rgb(128, 9, 240)" },
    "Literacy skills": { category: "Communication Skills", icon: "menu_book", bg: "bg-purple-500", bar: "bg-purple-500", colorHex: "rgb(168, 85, 247)" },
    "ICT skills": { category: "Communication Skills", icon: "devices", bg: "bg-purple-700", bar: "bg-purple-700", colorHex: "rgb(41, 3, 74)" },
    "Interpersonal relationships": { category: "Social Skills", icon: "groups", bg: "bg-green-600", bar: "bg-green-600", colorHex: "rgb(22, 163, 74)" },
    "Social-emotional intelligence": { category: "Social Skills", icon: "diversity_3", bg: "bg-green-500", bar: "bg-green-500", colorHex: "rgb(34, 197, 94)" },
    "Organization skills": { category: "Self-Management Skills", icon: "event_note", bg: "bg-orange-600", bar: "bg-orange-600", colorHex: "rgb(232, 248, 6)" },
    "State of Mind": { category: "Self-Management Skills", icon: "self_improvement", bg: "bg-orange-500", bar: "bg-orange-500", colorHex: "rgb(219, 245, 136)" },
  },
  subjects: {
    singing: { label: "Singing", aliases: ["Singing"], icon: "music_note", color: "#DC2626", chipClass: "border-red-200 bg-red-50 text-red-700" },
    ipa: { label: "IPA", aliases: ["IPA", "IPA (Sains)"], icon: "science", color: "#16A34A", chipClass: "border-green-200 bg-green-50 text-green-700" },
    math: { label: "Math", aliases: ["Math", "Mathematics"], icon: "calculate", color: "#2563EB", chipClass: "border-blue-200 bg-blue-50 text-blue-700" },
  },
  criteria: {
    "Role Play & Musical Contribution": { icon: "music_note" },
    "Rhythm & Tempo Accuracy": { icon: "music_note" },
    "Ensemble Balance & Dynamics": { icon: "equalizer" },
    "Focus & Attention": { icon: "visibility" },
    "Participation & Effort": { icon: "person" },
    "Responsibility & Respect": { icon: "shield" },
  },
  rubricLevels: {
    NFI: { label: "Need Further Improvement", shortLabel: "NFI", score: 10, color: "#EF4444", chipClass: "border-red-200 bg-red-50 text-red-700", textClass: "text-red-700", cellClass: "border-red-100 bg-red-50/50", buttonClass: "border-red-500 bg-red-500 text-white shadow-red-200", idleButtonClass: "border-red-100 bg-red-50/50 text-red-700 hover:border-red-300" },
    PTE: { label: "Progressing Toward Expectation", shortLabel: "PTE", score: 30, color: "#F97316", chipClass: "border-orange-200 bg-orange-50 text-orange-700", textClass: "text-orange-700", cellClass: "border-orange-100 bg-orange-50/50", buttonClass: "border-orange-500 bg-orange-500 text-white shadow-orange-200", idleButtonClass: "border-orange-100 bg-orange-50/50 text-orange-700 hover:border-orange-300" },
    DE: { label: "Developing Expectation", shortLabel: "DE", score: 50, color: "#F59E0B", chipClass: "border-amber-200 bg-amber-50 text-amber-700", textClass: "text-amber-700", cellClass: "border-amber-100 bg-amber-50/50", buttonClass: "border-amber-500 bg-amber-500 text-white shadow-amber-200", idleButtonClass: "border-amber-100 bg-amber-50/50 text-amber-700 hover:border-amber-300" },
    ME: { label: "Meeting Expectation", shortLabel: "ME", score: 70, color: "#2563EB", chipClass: "border-blue-200 bg-blue-50 text-blue-700", textClass: "text-blue-700", cellClass: "border-blue-100 bg-blue-50/50", buttonClass: "border-blue-600 bg-blue-600 text-white shadow-blue-200", idleButtonClass: "border-blue-100 bg-blue-50/50 text-blue-700 hover:border-blue-300" },
    EE: { label: "Exceeding Expectation", shortLabel: "EE", score: 90, color: "#059669", chipClass: "border-emerald-200 bg-emerald-50 text-emerald-700", textClass: "text-emerald-700", cellClass: "border-emerald-100 bg-emerald-50/50", buttonClass: "border-emerald-600 bg-emerald-600 text-white shadow-emerald-200", idleButtonClass: "border-emerald-100 bg-emerald-50/50 text-emerald-700 hover:border-emerald-300" },
    NONE: { label: "Not Assessed", shortLabel: "-", score: 0, color: "#78716C", chipClass: "border-stone-200 bg-stone-100 text-stone-600", textClass: "text-stone-600", cellClass: "border-stone-200 bg-white", buttonClass: "border-stone-200 bg-white text-stone-500", idleButtonClass: "border-stone-200 bg-white text-stone-500 hover:border-primary/30 hover:bg-primary/5" },
  },
  ratingLabelToCode: {
    "Need Further Improvement": "NFI",
    "Need Improvement": "NFI",
    "Progressing Toward Expectation": "PTE",
    "Developing Expectation": "DE",
    "Meeting Expectation": "ME",
    "Exceeding Expectation": "EE",
  },
  atlCategoryOrder: ["Thinking Skills", "Research Skills", "Communication Skills", "Social Skills", "Self-Management Skills"],
};

let registry = fallbackLabelRegistry;

export const hydrateLabelRegistry = async () => {
  try {
    const response = await api.get("labels/");
    if (response?.data?.atlCategories) registry = response.data;
  } catch (error) {
    registry = fallbackLabelRegistry;
  }
  return registry;
};

export const getLabelRegistry = () => registry;

export const normalizeATLCategory = (value) => {
  const labels = registry.atlCategories || {};
  const match = Object.entries(labels).find(([name, meta]) => name === value || (meta.aliases || []).includes(value));
  return match?.[0] || value;
};

export const getScoreLevel = (score) => {
  const value = Number(score || 0);
  return (registry.scoreLevels || fallbackLabelRegistry.scoreLevels).find((level) => value >= Number(level.min || 0)) || fallbackLabelRegistry.scoreLevels.at(-1);
};

export const getATLCategoryMeta = (name) => {
  const normalized = normalizeATLCategory(name);
  return registry.atlCategories?.[normalized] || fallbackLabelRegistry.atlCategories["Thinking Skills"];
};

export const getSubskillMeta = (name) => {
  const subskill = registry.subskills?.[name] || fallbackLabelRegistry.subskills[name] || {};
  const category = getATLCategoryMeta(subskill.category || name);
  return { ...category, ...subskill, categoryName: subskill.category || category.label };
};

export const getSubjectMeta = (value) => {
  const lower = String(value || "").toLowerCase();
  return Object.values(registry.subjects || fallbackLabelRegistry.subjects).find((meta) => (
    meta.label?.toLowerCase() === lower || (meta.aliases || []).some((alias) => alias.toLowerCase() === lower)
  )) || registry.subjects?.[lower] || fallbackLabelRegistry.subjects.singing;
};

export const getCriterionMeta = (name) => (
  registry.criteria?.[name] || fallbackLabelRegistry.criteria[name] || { icon: "music_note" }
);

export const getRatingMeta = (codeOrLabel) => {
  const code = registry.ratingLabelToCode?.[codeOrLabel] || codeOrLabel || "NONE";
  return registry.rubricLevels?.[code] || fallbackLabelRegistry.rubricLevels.NONE;
};

export const ratingOptions = ["NFI", "PTE", "DE", "ME", "EE"].map((code) => ({
  code,
  label: fallbackLabelRegistry.rubricLevels[code].label,
}));

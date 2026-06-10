import api from "../api";

export const fallbackLabelRegistry = {
  scoreLevels: [
    { min: 85, label: "EE", fullLabel: "Exceeding Expectation", color: "#059669", tone: "emerald", className: "bg-emerald-100 text-emerald-700", badgeClass: "bg-emerald-100 text-emerald-700", description: "Exceeding Expectation" },
    { min: 70, label: "ME", fullLabel: "Meeting Expectation", color: "#2563EB", tone: "blue", className: "bg-blue-100 text-blue-700", badgeClass: "bg-blue-100 text-blue-700", description: "Meeting Expectation" },
    { min: 50, label: "DE", fullLabel: "Developing Expectation", color: "#F59E0B", tone: "amber", className: "bg-amber-100 text-amber-700", badgeClass: "bg-amber-100 text-amber-700", description: "Developing Expectation" },
    { min: 30, label: "PTE", fullLabel: "Progressing Toward Expectation", color: "#F97316", tone: "orange", className: "bg-orange-100 text-orange-700", badgeClass: "bg-orange-100 text-orange-700", description: "Progressing Toward Expectation" },
    { min: 0, label: "NFI", fullLabel: "Need Further Improvement", color: "#EF4444", tone: "red", className: "bg-red-100 text-red-700", badgeClass: "bg-red-100 text-red-700", description: "Need Further Improvement" },
  ],
  noDataLevel: { label: "No Data", color: "#A8A29E", tone: "stone", className: "bg-stone-100 text-stone-500", badgeClass: "bg-stone-100 text-stone-500", description: "No assessment data is available yet", count: 0 },
  atlCategories: {
    "Thinking Skills": { key: "thinking", label: "Thinking Skills", aliases: ["Thinking", "Critical Thinking"], icon: "psychology", color: "#0EA5E9", chipClass: "border-sky-200 bg-sky-50 text-sky-700", toneClass: "bg-sky-100 text-sky-700 ring-sky-200", textClass: "text-sky-700", bgClass: "bg-sky-50", borderClass: "border-sky-200", barClass: "from-sky-400 to-sky-600", dotClass: "bg-sky-500" },
    "Research Skills": { key: "research", label: "Research Skills", aliases: ["Research"], icon: "menu_book", color: "#F97316", chipClass: "border-orange-200 bg-orange-50 text-orange-700", toneClass: "bg-orange-100 text-orange-700 ring-orange-200", textClass: "text-orange-700", bgClass: "bg-orange-50", borderClass: "border-orange-200", barClass: "from-yellow-500 via-orange-500 to-red-600", dotClass: "bg-orange-500" },
    "Communication Skills": { key: "communication", label: "Communication Skills", aliases: ["Communication"], icon: "forum", color: "#D946EF", chipClass: "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700", toneClass: "bg-fuchsia-100 text-fuchsia-700 ring-fuchsia-200", textClass: "text-fuchsia-700", bgClass: "bg-fuchsia-50", borderClass: "border-fuchsia-200", barClass: "from-fuchsia-400 to-fuchsia-600", dotClass: "bg-fuchsia-500" },
    "Social Skills": { key: "social", label: "Social Skills", aliases: ["Social", "Collaboration"], icon: "groups", color: "#10B981", chipClass: "border-emerald-200 bg-emerald-50 text-emerald-700", toneClass: "bg-emerald-100 text-emerald-700 ring-emerald-200", textClass: "text-emerald-700", bgClass: "bg-emerald-50", borderClass: "border-emerald-200", barClass: "from-emerald-400 to-emerald-600", dotClass: "bg-emerald-500" },
    "Self-Management Skills": { key: "self-management", label: "Self-Management Skills", aliases: ["Self-Management", "Self Management"], icon: "work", color: "#92400E", chipClass: "border-amber-300 bg-amber-50 text-amber-900", toneClass: "bg-amber-100 text-amber-900 ring-amber-200", textClass: "text-amber-900", bgClass: "bg-amber-50", borderClass: "border-amber-300", barClass: "from-amber-700 to-orange-900", dotClass: "bg-amber-800" },
  },
  subskills: {
    "Critical Thingking": { category: "Thinking Skills", icon: "psychology_alt", bg: "bg-sky-500", bar: "bg-sky-500", colorHex: "#0ea5e9" },
    "Critical Thinking": { category: "Thinking Skills", canonical: "Critical Thingking", icon: "psychology_alt", bg: "bg-sky-500", bar: "bg-sky-500", colorHex: "#0ea5e9" },
    "Creative Thingking": { category: "Thinking Skills", icon: "lightbulb", bg: "bg-blue-600", bar: "bg-blue-600", colorHex: "#2563eb" },
    "Creative Thinking": { category: "Thinking Skills", canonical: "Creative Thingking", icon: "lightbulb", bg: "bg-blue-600", bar: "bg-blue-600", colorHex: "#2563eb" },
    InformationTransfer: { category: "Thinking Skills", icon: "sync_alt", bg: "bg-indigo-500", bar: "bg-indigo-500", colorHex: "#6366f1" },
    "Reflection / Metacognitive": { category: "Thinking Skills", icon: "neurology", bg: "bg-cyan-600", bar: "bg-cyan-600", colorHex: "#0891b2" },
    "Textual Literacy": { category: "Research Skills", icon: "article", bg: "bg-yellow-500", bar: "bg-yellow-500", colorHex: "#eab308" },
    "Media Literacy": { category: "Research Skills", icon: "perm_media", bg: "bg-orange-500", bar: "bg-orange-500", colorHex: "#f97316" },
    "Ethical use of information": { category: "Research Skills", icon: "shield", bg: "bg-red-600", bar: "bg-red-600", colorHex: "#dc2626" },
    "Exchanging Information": { category: "Communication Skills", icon: "chat_bubble", bg: "bg-purple-500", bar: "bg-purple-500", colorHex: "#a855f7" },
    "Literacy skills": { category: "Communication Skills", icon: "menu_book", bg: "bg-fuchsia-500", bar: "bg-fuchsia-500", colorHex: "#d946ef" },
    "ICT skills": { category: "Communication Skills", icon: "devices", bg: "bg-pink-500", bar: "bg-pink-500", colorHex: "#ec4899" },
    "Interpersonal relationships": { category: "Social Skills", icon: "groups", bg: "bg-emerald-500", bar: "bg-emerald-500", colorHex: "#10b981" },
    "Social-emotional intelligence": { category: "Social Skills", icon: "diversity_3", bg: "bg-green-600", bar: "bg-green-600", colorHex: "#16a34a" },
    "Organization skills": { category: "Self-Management Skills", icon: "event_note", bg: "bg-amber-800", bar: "bg-amber-800", colorHex: "#92400e" },
    "State of Mind": { category: "Self-Management Skills", icon: "self_improvement", bg: "bg-orange-800", bar: "bg-orange-800", colorHex: "#9a3412" },
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

export const getNoDataLevel = () => registry.noDataLevel || fallbackLabelRegistry.noDataLevel;

export const getATLCategoryMeta = (name) => {
  const normalized = normalizeATLCategory(name);
  return registry.atlCategories?.[normalized] || fallbackLabelRegistry.atlCategories["Thinking Skills"];
};

const parseColorChannels = (color) => {
  const value = String(color || "").trim();
  const rgb = value.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/i);
  if (rgb) return rgb.slice(1).map(Number);
  const hex = value.match(/^#?([a-f0-9]{6})$/i);
  if (hex) {
    const raw = hex[1];
    return [0, 2, 4].map((offset) => parseInt(raw.slice(offset, offset + 2), 16));
  }
  return [245, 158, 11];
};

const alphaColor = (color, alpha = 0.12) => {
  const [r, g, b] = parseColorChannels(color);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const readableTextColor = (color) => {
  const [r, g, b] = parseColorChannels(color);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.68 ? "#0F172A" : "#FFFFFF";
};

export const getSubskillMeta = (name, index = 0) => {
  const fallbackTones = [
    { icon: "auto_awesome", bg: "bg-amber-500", bar: "bg-amber-500", colorHex: "#F59E0B" },
    { icon: "psychology", bg: "bg-violet-500", bar: "bg-violet-500", colorHex: "#8B5CF6" },
    { icon: "groups", bg: "bg-green-500", bar: "bg-green-500", colorHex: "#22C55E" },
    { icon: "business_center", bg: "bg-red-500", bar: "bg-red-500", colorHex: "#EF4444" },
  ];
  const subskill = registry.subskills?.[name] || fallbackLabelRegistry.subskills[name] || {};
  const category = getATLCategoryMeta(subskill.category || name);
  const fallback = fallbackTones[index % fallbackTones.length];
  const colorHex = subskill.colorHex || fallback.colorHex;
  const softBg = alphaColor(colorHex, 0.14);
  const softBorder = alphaColor(colorHex, 0.36);
  return {
    ...category,
    ...fallback,
    ...subskill,
    colorHex,
    categoryName: subskill.category || category.label,
    chipClass: "border",
    chipStyle: {
      borderColor: softBorder,
      backgroundColor: softBg,
      color: colorHex,
    },
    solidStyle: {
      backgroundColor: colorHex,
      color: readableTextColor(colorHex),
    },
    softStyle: {
      borderColor: softBorder,
      backgroundColor: softBg,
      color: colorHex,
    },
  };
};

export const getSubskillColorHex = (name, index = 0) => getSubskillMeta(name, index).colorHex;

export const getATLDistributionTemplate = () => (
  (registry.atlCategoryOrder || fallbackLabelRegistry.atlCategoryOrder).map((category) => {
    const meta = getATLCategoryMeta(category);
    return { category: meta.label || category, score: 0, color: meta.color };
  })
);

export const getScoreDistributionConfig = (includeNoData = true) => {
  const rows = (registry.scoreLevels || fallbackLabelRegistry.scoreLevels).map((level) => ({
    key: level.label,
    label: level.label,
    fullLabel: level.fullLabel || level.description || level.label,
    description: level.description,
    color: level.color,
    className: level.className,
    badgeClass: level.badgeClass,
  }));
  return includeNoData ? [...rows, { key: getNoDataLevel().label, ...getNoDataLevel() }] : rows;
};

export const normalizeScoreBand = (label) => {
  const legacyMap = {
    Excellent: "EE",
    "Sangat Baik": "EE",
    "Exceeding Expectation": "EE",
    Good: "ME",
    Baik: "ME",
    "Meeting Expectation": "ME",
    Average: "DE",
    Cukup: "DE",
    "Developing Expectation": "DE",
    Low: "PTE",
    Kurang: "PTE",
    "Progressing Toward Expectation": "PTE",
    Critical: "NFI",
    "Need Improvement": "NFI",
    "Need Further Improvement": "NFI",
    "Belum Dinilai": getNoDataLevel().label,
    "-": getNoDataLevel().label,
    "Not Assessed": getNoDataLevel().label,
  };
  return legacyMap[label] || label || getNoDataLevel().label;
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

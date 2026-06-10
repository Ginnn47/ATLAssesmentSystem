export const baseSubjectCatalog = [
  {
    id: "singing",
    label: "Singing",
    batchLabel: "Singing",
    topics: [
      { id: "singing_christmas_carol", label: "Christmas Carol", description: "Musik & Gerak Berkelompok" },
      { id: "singing_choir", label: "Choir", description: "Paduan Suara" },
      { id: "singing_vocal_technique", label: "Vocal Technique", description: "Latihan Teknik Vokal" },
    ],
  },
  {
    id: "ipa",
    label: "IPA (Sains)",
    batchLabel: "IPA",
    topics: [
      { id: "ipa_energi_perubahan", label: "Energi Perubahan", description: "Eksperimen Energi" },
      { id: "ipa_tata_surya", label: "Tata Surya", description: "Planet dan Benda Langit" },
      { id: "ipa_sistem_tubuh", label: "Sistem Tubuh", description: "Anatomi dan Fisiologi" },
    ],
  },
  {
    id: "math",
    label: "Mathematics",
    batchLabel: "Math",
    topics: [
      { id: "math_linear_equations", label: "Linear Equations", description: "Persamaan Linear" },
      { id: "math_geometry", label: "Geometry", description: "Geometri & Bentuk" },
      { id: "math_statistics", label: "Statistics", description: "Statistika & Data" },
    ],
  },
];

const slugify = (value) =>
  String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);

const SUBJECT_CATALOG_CACHE_KEY = "atl_subject_catalog_snapshot";

const readCachedSubjects = () => {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(SUBJECT_CATALOG_CACHE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    window.localStorage.removeItem(SUBJECT_CATALOG_CACHE_KEY);
    return [];
  }
};

const writeCachedSubjects = (subjects) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SUBJECT_CATALOG_CACHE_KEY, JSON.stringify(subjects || []));
  } catch {
    // The UI can still use in-memory data when localStorage is unavailable.
  }
};

let subjectCatalogCache = readCachedSubjects();

const normalizeSubject = (subject) => {
  const id = subject.id || subject.code || String(subject.label || "").toLowerCase();
  const baseSubject = baseSubjectCatalog.find((item) => item.id === id);
  return {
    id,
    label: subject.label || subject.name || baseSubject?.label || id,
    batchLabel: subject.batchLabel || baseSubject?.batchLabel || subject.label || subject.name || id,
    aliases: Array.from(new Set([id, subject.label, subject.name, subject.batchLabel, baseSubject?.label, baseSubject?.batchLabel].filter(Boolean))),
    topics: Array.isArray(subject.topics)
      ? subject.topics.map((topic) => ({
          id: topic.id || topic.code,
          label: topic.label || topic.name || topic.id || topic.code,
          description: topic.description || "",
          isCustom: Boolean(topic.isCustom),
          isActive: topic.isActive !== false,
          contextAvailable: Boolean(topic.contextAvailable),
          rubricCount: Number(topic.rubricCount || 0),
          isAssessable: Boolean(topic.isAssessable),
        }))
      : [],
  };
};

export const setSubjectData = (subjects = []) => {
  subjectCatalogCache = Array.isArray(subjects) ? subjects.map(normalizeSubject) : [];
  if (subjectCatalogCache.length > 0) writeCachedSubjects(subjectCatalogCache);
  if (typeof window !== "undefined") window.dispatchEvent(new Event("atl-topics-updated"));
  return subjectCatalogCache;
};

export const getSubjectData = () => subjectCatalogCache;

export const getSubjectTopicMapByLabel = () =>
  getSubjectData().reduce((acc, subject) => {
    acc[subject.batchLabel] = subject.topics;
    return acc;
  }, {});

export const getTopicsForSubjectLabel = (subjectLabel) =>
  getSubjectTopicMapByLabel()[subjectLabel] ||
  getSubjectData().find((subject) => (subject.aliases || []).includes(subjectLabel))?.topics ||
  [];

export const addCustomSubtopic = (subjectId, label, description = "") => {
  const topic = createCustomSubtopicDraft(subjectId, label, description);
  if (!topic) return null;
  return saveCustomSubtopic(subjectId, topic);
};

export const createCustomSubtopicDraft = (subjectId, label, description = "") => {
  const subject = subjectCatalogCache.find((item) => item.id === subjectId);
  if (!subject || !label.trim()) return null;

  const existingTopics = subject.topics || [];
  const baseId = `${subjectId}_${slugify(label) || "custom_topic"}`;
  let id = baseId;
  let counter = 2;
  while (existingTopics.some((topic) => topic.id === id)) {
    id = `${baseId}_${counter}`;
    counter += 1;
  }

  const topic = {
    id,
    label: label.trim(),
    description: description.trim() || "Subtopik tambahan",
    isCustom: true,
    isActive: true,
    contextAvailable: false,
    rubricCount: 0,
    isAssessable: false,
  };
  return topic;
};

export const saveCustomSubtopic = (subjectId, topic) => {
  if (!topic?.id) return null;
  const subjectIndex = subjectCatalogCache.findIndex((item) => item.id === subjectId);
  if (subjectIndex < 0) return topic;
  const existing = subjectCatalogCache[subjectIndex].topics || [];
  if (existing.some((item) => item.id === topic.id)) return topic;
  subjectCatalogCache = subjectCatalogCache.map((subject, index) => (
    index === subjectIndex ? { ...subject, topics: [...existing, topic] } : subject
  ));
  window.dispatchEvent(new Event("atl-topics-updated"));
  return topic;
};

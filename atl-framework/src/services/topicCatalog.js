const TOPIC_STORAGE_KEY = "atl_custom_subtopics_v1";

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

const readCustomTopics = () => {
  try {
    return JSON.parse(localStorage.getItem(TOPIC_STORAGE_KEY) || "{}");
  } catch (error) {
    return {};
  }
};

const writeCustomTopics = (items) => {
  localStorage.setItem(TOPIC_STORAGE_KEY, JSON.stringify(items));
  window.dispatchEvent(new Event("atl-topics-updated"));
};

export const getSubjectData = () => {
  const customTopics = readCustomTopics();
  return baseSubjectCatalog.map((subject) => ({
    ...subject,
    topics: [...subject.topics, ...(customTopics[subject.id] || [])],
  }));
};

export const getSubjectTopicMapByLabel = () =>
  getSubjectData().reduce((acc, subject) => {
    acc[subject.batchLabel] = subject.topics;
    return acc;
  }, {});

export const getTopicsForSubjectLabel = (subjectLabel) =>
  getSubjectTopicMapByLabel()[subjectLabel] || [];

export const addCustomSubtopic = (subjectId, label, description = "") => {
  const subject = baseSubjectCatalog.find((item) => item.id === subjectId);
  if (!subject || !label.trim()) return null;

  const customTopics = readCustomTopics();
  const existingTopics = [...subject.topics, ...(customTopics[subjectId] || [])];
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
  };
  customTopics[subjectId] = [...(customTopics[subjectId] || []), topic];
  writeCustomTopics(customTopics);
  return topic;
};

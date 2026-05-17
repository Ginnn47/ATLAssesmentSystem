const ATL_DATA_VERSION = 4;

const item = (criteriaTopic, kriteria, atlCategories, atl, levels) => ({
  criteriaTopic,
  kriteria,
  atlCategories,
  category: atlCategories.join(", "),
  atl,
  levels,
});

const baseATL = {
  __version: ATL_DATA_VERSION,

  singing_christmas_carol: [
    item("Creating", "Role Play & Musical Contribution", ["Thinking Skills", "Communication Skills"], [
      "Interpersonal relationships",
      "Exchanging-information",
      "Organization skills",
      "Reflection / Metacognitive",
    ], {
      NFI: "Fails to participate in the assigned part.",
      PTE: "Significantly struggles with assigned role; negatively impacts the group.",
      DE: "Tries to fulfill role; struggles with technical requirements.",
      ME: "Executes assigned role effectively; contributes reliably to the music.",
      EE: "Skillfully executes role; demonstrates high technical command.",
    }),
    item("Creating", "Rhythm & Tempo Accuracy", ["Thinking Skills", "Self-Management Skills"], [
      "State of Mind",
      "InformationTransfer",
      "Reflection / Metacognitive",
      "Critical Thingking",
    ], {
      NFI: "Cannot follow the rhythm or tempo.",
      PTE: "Difficulty maintaining tempo.",
      DE: "Often out of sync with the music's tempo.",
      ME: "Performs with mostly accurate rhythm.",
      EE: "Performs with highly accurate rhythm.",
    }),
    item("Creating", "Ensemble Balance & Dynamics", ["Social Skills", "Communication Skills"], [
      "Interpersonal relationships",
      "Social-emotional intelligence",
      "Exchanging-information",
    ], {
      NFI: "No awareness of group sound or control.",
      PTE: "Difficulty controlling volume.",
      DE: "Volume is sometimes unbalanced.",
      ME: "Good ensemble balance.",
      EE: "Excellent ensemble balance.",
    }),
    item("Responding", "Focus & Attention", ["Self-Management Skills", "Thinking Skills"], [
      "State of Mind",
      "Reflection / Metacognitive",
      "Organization skills",
    ], {
      NFI: "Does not show attention to the lesson at all.",
      PTE: "Is often unfocused and distracts others.",
      DE: "Is sometimes attentive, but is often distracted by others.",
      ME: "Pays attention to teacher and peer instructions well.",
      EE: "Always pays attention to teacher and peer instructions.",
    }),
    item("Responding", "Participation & Effort", ["Social Skills", "Self-Management Skills"], [
      "State of Mind",
      "Interpersonal relationships",
      "Reflection / Metacognitive",
    ], {
      NFI: "Is completely unwilling to participate in music activities in class.",
      PTE: "Often refuses to participate in singing or practice activities.",
      DE: "Participates when asked or encouraged by the teacher.",
      ME: "Actively participates in most activities.",
      EE: "Very enthusiastic and always actively participates in all music activities.",
    }),
    item("Responding", "Responsibility & Respect", ["Social Skills", "Self-Management Skills"], [
      "Social-emotional intelligence",
      "Interpersonal relationships",
      "Organization skills",
    ], {
      NFI: "Shows a lack of concern for classroom rules, peers, and the teacher.",
      PTE: "Needs repeated reminders to be respectful.",
      DE: "Sometimes forgets classroom rules.",
      ME: "Shows respect for the teacher and peers.",
      EE: "Listens respectfully when others are performing or the teacher is speaking.",
    }),
  ],

  singing_choir: [
    item("Choir Performance", "Harmonization Accuracy", ["Thinking Skills", "Research Skills"], [
      "Critical Thingking",
      "Media Literacy",
      "Textual Literacy",
    ], {
      NFI: "Cannot identify when harmony is out of tune or disconnected from the group.",
      PTE: "Frequently loses pitch and needs repeated support to rejoin the harmony.",
      DE: "Maintains some harmony, but pitch and blend shift during difficult transitions.",
      ME: "Blends with the group and keeps harmony stable with minor pitch issues.",
      EE: "Maintains accurate harmony, adjusts independently, and strengthens the group sound.",
    }),
    item("Choir Performance", "Performance Expression", ["Communication Skills", "Thinking Skills"], [
      "Exchanging-information",
      "Literacy skills",
      "Creative Thingking",
    ], {
      NFI: "Sings without clear expression, phrasing, or attention to musical meaning.",
      PTE: "Shows limited expression and rarely connects expression to the song text.",
      DE: "Attempts expression, but phrasing and emotion are inconsistent.",
      ME: "Communicates the song clearly with appropriate expression and phrasing.",
      EE: "Uses expressive phrasing, diction, and emotion to enhance the choir performance.",
    }),
    item("Choir Performance", "Team Collaboration", ["Social Skills", "Self-Management Skills"], [
      "Interpersonal relationships",
      "Social-emotional intelligence",
      "Organization skills",
    ], {
      NFI: "Does not cooperate with the ensemble and disrupts rehearsal flow.",
      PTE: "Participates inconsistently and needs reminders to listen to the group.",
      DE: "Works with peers when prompted, but group awareness is uneven.",
      ME: "Collaborates reliably and responds to group cues during rehearsal.",
      EE: "Supports peers, listens actively, and helps the ensemble stay coordinated.",
    }),
  ],

  singing_vocal_technique: [
    item("Vocal Technique", "Breath Control", ["Self-Management Skills", "Thinking Skills"], [
      "State of Mind",
      "Reflection / Metacognitive",
    ], {
      NFI: "Runs out of breath quickly and cannot complete short vocal phrases.",
      PTE: "Needs frequent reminders to breathe before phrases and support the tone.",
      DE: "Uses breath support sometimes, but control drops in longer phrases.",
      ME: "Maintains steady breath support through most assigned vocal phrases.",
      EE: "Uses controlled breathing to sing long phrases smoothly and confidently.",
    }),
    item("Vocal Technique", "Pitch Accuracy", ["Thinking Skills", "Research Skills"], [
      "Critical Thingking",
      "Textual Literacy",
    ], {
      NFI: "Cannot match the target pitch even with teacher modeling.",
      PTE: "Matches pitch only occasionally and often drifts from the melody.",
      DE: "Sings several notes correctly, but pitch accuracy is inconsistent.",
      ME: "Keeps pitch mostly accurate across the assigned melody.",
      EE: "Sings with accurate pitch and self-corrects quickly when needed.",
    }),
  ],

  ipa_energi_perubahan: [
    item("Energy Investigation", "Experiment Setup & Safety", ["Self-Management Skills", "Research Skills"], [
      "Organization skills",
      "Ethical use of information",
    ], {
      NFI: "Cannot prepare materials safely or follow basic experiment rules.",
      PTE: "Needs repeated reminders to use tools and materials safely.",
      DE: "Sets up parts of the experiment with some safety reminders.",
      ME: "Sets up the experiment correctly and follows safety expectations.",
      EE: "Prepares materials independently and models safe procedures for peers.",
    }),
    item("Energy Investigation", "Data Collection & Observation", ["Research Skills", "Thinking Skills"], [
      "Textual Literacy",
      "Critical Thingking",
      "InformationTransfer",
    ], {
      NFI: "Does not record useful observations or measurable data.",
      PTE: "Records incomplete data with frequent errors or missing details.",
      DE: "Collects some relevant data, but observations need more precision.",
      ME: "Collects mostly accurate data and records clear observations.",
      EE: "Collects complete data and notices patterns or changes independently.",
    }),
    item("Energy Investigation", "Collaboration & Communication", ["Social Skills", "Communication Skills"], [
      "Interpersonal relationships",
      "Exchanging-information",
      "ICT skills",
    ], {
      NFI: "Does not contribute to the group investigation or discussion.",
      PTE: "Shares little information and relies heavily on peers.",
      DE: "Contributes when prompted, but explanations are still unclear.",
      ME: "Participates actively and communicates observations clearly.",
      EE: "Helps organize group discussion and explains scientific ideas clearly.",
    }),
    item("Energy Investigation", "Problem-Solving / Critical Thinking", ["Thinking Skills"], [
      "Critical Thingking",
      "InformationTransfer",
    ], {
      NFI: "Cannot suggest a solution when the investigation does not work.",
      PTE: "Tries simple fixes but does not connect them to evidence.",
      DE: "Suggests partial solutions using some evidence from the experiment.",
      ME: "Uses evidence to solve most problems during the investigation.",
      EE: "Analyzes problems carefully and proposes improvements based on evidence.",
    }),
  ],

  ipa_tata_surya: [
    item("Solar System Inquiry", "Planet Identification & Characteristics", ["Research Skills"], [
      "Textual Literacy",
      "Media Literacy",
    ], {
      NFI: "Cannot identify planets or describe their main characteristics.",
      PTE: "Identifies a few planets but gives unclear or inaccurate details.",
      DE: "Identifies most planets with some confusion about characteristics.",
      ME: "Accurately identifies planets and explains main characteristics.",
      EE: "Gives detailed planet descriptions using accurate research information.",
    }),
    item("Solar System Inquiry", "Scale Modeling Accuracy", ["Thinking Skills", "Self-Management Skills"], [
      "Critical Thingking",
      "InformationTransfer",
      "Organization skills",
    ], {
      NFI: "Does not attempt to represent relative size or distance.",
      PTE: "Uses a model with major errors in size or distance.",
      DE: "Shows some sense of scale, but several parts are inconsistent.",
      ME: "Builds a mostly accurate model using appropriate relative scale.",
      EE: "Creates a precise model and explains scale decisions clearly.",
    }),
    item("Solar System Inquiry", "Collaborative Inquiry", ["Social Skills", "Communication Skills"], [
      "Interpersonal relationships",
      "Social-emotional intelligence",
      "Exchanging-information",
    ], {
      NFI: "Does not participate in group research or model creation.",
      PTE: "Contributes minimally and waits for others to complete tasks.",
      DE: "Contributes occasionally but needs prompting to stay involved.",
      ME: "Works actively with peers and shares responsibilities fairly.",
      EE: "Facilitates group work and helps peers resolve task challenges.",
    }),
  ],

  ipa_sistem_tubuh: [
    item("Body System Inquiry", "Concept Explanation", ["Communication Skills", "Research Skills"], [
      "Literacy skills",
      "Textual Literacy",
    ], {
      NFI: "Cannot explain the body system or use relevant vocabulary.",
      PTE: "Gives very limited explanations with frequent concept errors.",
      DE: "Explains basic ideas but misses important relationships.",
      ME: "Explains the body system clearly using appropriate vocabulary.",
      EE: "Explains relationships within the body system with detail and clarity.",
    }),
  ],

  math_linear_equations: [
    item("Linear Equations", "Problem Translation", ["Thinking Skills", "Communication Skills"], [
      "InformationTransfer",
      "Literacy skills",
    ], {
      NFI: "Cannot translate a word problem into a mathematical expression.",
      PTE: "Identifies some numbers but forms an incorrect equation.",
      DE: "Creates a partial equation with some missing relationships.",
      ME: "Translates most word problems into correct linear equations.",
      EE: "Translates problems accurately and explains the equation structure.",
    }),
  ],

  math_geometry: [
    item("Geometry", "Shape Reasoning", ["Thinking Skills"], [
      "Critical Thingking",
      "Creative Thingking",
    ], {
      NFI: "Cannot identify shape properties or justify geometric choices.",
      PTE: "Recognizes simple shapes but gives weak reasoning.",
      DE: "Uses some properties to reason about shapes with support.",
      ME: "Explains shape properties and solves most geometry tasks correctly.",
      EE: "Applies shape properties flexibly and justifies solutions clearly.",
    }),
  ],

  math_statistics: [
    item("Statistics", "Data Interpretation", ["Research Skills", "Thinking Skills"], [
      "Textual Literacy",
      "Critical Thingking",
      "InformationTransfer",
    ], {
      NFI: "Cannot read the data display or identify basic information.",
      PTE: "Reads simple values but draws inaccurate conclusions.",
      DE: "Interprets some data correctly with teacher support.",
      ME: "Interprets data displays and explains reasonable conclusions.",
      EE: "Compares data patterns and explains conclusions with strong evidence.",
    }),
  ],
};

if (!baseATL.savedWeights) baseATL.savedWeights = {};
if (!baseATL.savedAssessments) baseATL.savedAssessments = {};

const getPersistentData = () => {
  const saved = localStorage.getItem("atl_framework_data");
  if (!saved) return baseATL;

  const parsed = JSON.parse(saved);
  return parsed.__version === ATL_DATA_VERSION ? parsed : baseATL;
};

export const dummyATL = getPersistentData();
export const saveATLData = (data) => {
  localStorage.setItem("atl_framework_data", JSON.stringify({ ...data, __version: ATL_DATA_VERSION }));
  window.dispatchEvent(new Event("atl-data-updated"));
};

export const subjectDisplayName = (subject) =>
  subject?.batchLabel || subject?.label || subject?.name || subject?.id || subject?.code || "";

export const ROLE_CODES = {
  ADMIN: "ROLE_ADMIN",
  ACADEMIC: "ROLE_ACADEMIC",
  EVALUATOR: "ROLE_EVALUATOR",
  HOMEROOM: "ROLE_HOMEROOM",
  SUBJECT_COORDINATOR: "ROLE_SUBJECT_COORDINATOR",
  ATL_EXPERT: "ROLE_ATL_EXPERT",
};

export const ROLE_LABELS = {
  [ROLE_CODES.ADMIN]: "Admin",
  [ROLE_CODES.ACADEMIC]: "Akademik",
  [ROLE_CODES.EVALUATOR]: "Evaluator",
  [ROLE_CODES.HOMEROOM]: "Wali Kelas",
  [ROLE_CODES.SUBJECT_COORDINATOR]: "PJ Mapel",
  [ROLE_CODES.ATL_EXPERT]: "ATL Expert",
};

const ROLE_ORDER = [
  ROLE_CODES.ADMIN,
  ROLE_CODES.ACADEMIC,
  ROLE_CODES.EVALUATOR,
  ROLE_CODES.HOMEROOM,
  ROLE_CODES.SUBJECT_COORDINATOR,
  ROLE_CODES.ATL_EXPERT,
];

export const getUserRoleCodes = (user = null) => {
  if (!user) return [];
  const explicitRoles = [
    ...(Array.isArray(user.roles) ? user.roles : []),
    ...(Array.isArray(user.roleCodes) ? user.roleCodes : []),
  ];
  const roleText = `${user.role || ""} ${user.roleLabel || ""} ${user.roleGroup || ""} ${explicitRoles.join(" ")}`.toLowerCase();
  const roles = new Set(explicitRoles.filter((role) => Object.values(ROLE_CODES).includes(role)));

  if (user.isSuperuser || roleText.includes("role_admin") || roleText.includes("admin")) {
    roles.add(ROLE_CODES.ADMIN);
  }
  if (roleText.includes("role_academic") || roleText.includes("akademik")) roles.add(ROLE_CODES.ACADEMIC);

  if (!roles.has(ROLE_CODES.ADMIN)) roles.add(ROLE_CODES.EVALUATOR);
  if (roleText.includes("role_homeroom") || roleText.includes("wali")) roles.add(ROLE_CODES.HOMEROOM);
  if (roleText.includes("role_subject_coordinator") || roleText.includes("pj mapel") || roleText.includes("penanggung") || roleText.includes("mapel")) {
    roles.add(ROLE_CODES.SUBJECT_COORDINATOR);
  }
  if (roleText.includes("role_atl_expert") || roleText.includes("fuzzy") || roleText.includes("expert")) roles.add(ROLE_CODES.ATL_EXPERT);

  return ROLE_ORDER.filter((role) => roles.has(role));
};

export const isAdminUser = (user = null) => getUserRoleCodes(user).includes(ROLE_CODES.ADMIN);
export const hasRole = (user = null, roleCode) => isAdminUser(user) || getUserRoleCodes(user).includes(roleCode);

export const getUserRoleNames = (user = null) =>
  getUserRoleCodes(user).map((roleCode) => ROLE_LABELS[roleCode] || roleCode);

export const getGrantedFeatures = (user = null) => {
  if (isAdminUser(user)) {
    return [
      "Semua dashboard dan monitoring sistem",
      "Academic Management",
      "Input Penilaian ATL",
      "ATL Reports",
      "Criteria Management",
      "Weight Management",
    ];
  }
  const roles = getUserRoleCodes(user);
  const features = ["Assessment Input"];
  if (roles.includes(ROLE_CODES.ACADEMIC)) features.push("Academic Review", "User Access Overview");
  if (roles.includes(ROLE_CODES.HOMEROOM)) features.push("Student Monitoring");
  if (roles.includes(ROLE_CODES.SUBJECT_COORDINATOR)) features.push("Subject Reports");
  if (roles.includes(ROLE_CODES.ATL_EXPERT)) features.push("Criteria Management", "Weight Management");
  return features;
};

export const canAccessRoute = (user = null, allowedRoles = []) => {
  if (!user) return false;
  if (!allowedRoles.length) return true;
  return allowedRoles.some((roleCode) => hasRole(user, roleCode));
};

export const getSidebarMenuGroups = () => {
  const main = [
    { icon: "space_dashboard", label: "Dashboard", key: "dashboard", to: "/dashboard" },
    { icon: "groups", label: "Student Management", key: "students", to: "/students" },
    { icon: "edit_note", label: "Input Penilaian ATL", key: "input-atl", to: "/input-atl" },
    { icon: "poll", label: "ATL Reports", key: "report", to: "/reports" },
  ];

  const config = [
    { icon: "school", label: "Academic Management", key: "academic", to: "/academic/manage" },
    { icon: "assignment", label: "Criteria Management", key: "criteria", to: "/atl/manage" },
    { icon: "tune", label: "Weight Management", key: "weight", to: "/atl/weight" },
  ];

  return { main, config };
};

export const filterSubjectsByUserAccess = (subjects = [], user = null) => {
  const items = Array.isArray(subjects) ? subjects : [];
  const roles = getUserRoleCodes(user);
  const allowedCodes = Array.isArray(user?.subjectAccess)
    ? user.subjectAccess.map((item) => String(item || "").toLowerCase()).filter(Boolean)
    : [];

  if (isAdminUser(user)) return items;
  if (allowedCodes.length === 0) {
    const needsSubjectScope = roles.includes(ROLE_CODES.SUBJECT_COORDINATOR) || roles.includes(ROLE_CODES.ATL_EXPERT);
    return needsSubjectScope ? [] : items;
  }

  const allowed = new Set(allowedCodes);
  return items.filter((subject) => allowed.has(String(subject?.id || subject?.code || "").toLowerCase()));
};

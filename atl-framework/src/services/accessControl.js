export const subjectDisplayName = (subject) =>
  subject?.batchLabel || subject?.label || subject?.name || subject?.id || subject?.code || "";

export const ROLE_CODES = {
  ADMIN: "ROLE_ADMIN",
  EVALUATOR: "ROLE_EVALUATOR",
  HOMEROOM: "ROLE_HOMEROOM",
  SUBJECT_COORDINATOR: "ROLE_SUBJECT_COORDINATOR",
  ATL_EXPERT: "ROLE_ATL_EXPERT",
};

export const ROLE_LABELS = {
  [ROLE_CODES.ADMIN]: "Admin",
  [ROLE_CODES.EVALUATOR]: "Evaluator",
  [ROLE_CODES.HOMEROOM]: "Wali Kelas",
  [ROLE_CODES.SUBJECT_COORDINATOR]: "PJ Mapel",
  [ROLE_CODES.ATL_EXPERT]: "ATL Expert",
};

const ROLE_ORDER = [
  ROLE_CODES.ADMIN,
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

  if (user.isSuperuser || roleText.includes("role_admin") || roleText.includes("admin") || roleText.includes("akademik")) {
    roles.add(ROLE_CODES.ADMIN);
  }

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
      "User Management",
      "Academic Management",
      "Input Penilaian ATL",
      "ATL Reports",
      "ATL Management",
      "Weight Management",
    ];
  }
  const roles = getUserRoleCodes(user);
  const features = ["Assessment Input"];
  if (roles.includes(ROLE_CODES.HOMEROOM)) features.push("Student Monitoring");
  if (roles.includes(ROLE_CODES.SUBJECT_COORDINATOR)) features.push("Subject Reports");
  if (roles.includes(ROLE_CODES.ATL_EXPERT)) features.push("ATL Criteria & Weight Management");
  return features;
};

export const canAccessRoute = (user = null, allowedRoles = []) => {
  if (!user) return false;
  if (isAdminUser(user)) return true;
  if (!Array.isArray(allowedRoles) || allowedRoles.length === 0) return true;
  const userRoles = getUserRoleCodes(user);
  return allowedRoles.some((role) => userRoles.includes(role));
};

export const getSidebarMenuGroups = (user = null) => {
  const roles = getUserRoleCodes(user);
  const admin = roles.includes(ROLE_CODES.ADMIN);
  const canHomeroom = admin || roles.includes(ROLE_CODES.HOMEROOM);
  const canReport = admin || roles.includes(ROLE_CODES.SUBJECT_COORDINATOR);
  const canExpert = admin || roles.includes(ROLE_CODES.ATL_EXPERT);

  const main = [
    { icon: "space_dashboard", label: "Dashboard", key: "dashboard", to: "/dashboard" },
  ];

  if (canHomeroom) {
    main.push({ icon: "groups", label: "Student Management", key: "students", to: "/students" });
  }

  main.push({ icon: "edit_note", label: "Input Penilaian ATL", key: "input-atl", to: "/input-atl" });

  if (canReport) {
    main.push({ icon: "poll", label: "ATL Reports", key: "report", to: "/reports" });
  }

  const config = [];
  if (admin) {
    config.push({ icon: "manage_accounts", label: "User Management", key: "user", to: "/settings/users" });
  }
  if (canExpert) {
    config.push({ icon: "assignment", label: "ATL Management", key: "atl", to: "/atl/manage" });
    config.push({ icon: "tune", label: "Weight Management", key: "weight", to: "/atl/weight" });
  }

  if (admin) {
    config.push({ icon: "school", label: "Academic Management", key: "academic", to: "/settings/users" });
  }

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

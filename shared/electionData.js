export const OPERATION_ROLES = ["Admin", "Response Team", "Supervisor", "Agent"];

export const rankLevel = (role) => {
  if (role === "Super Admin") return -1;
  const index = OPERATION_ROLES.indexOf(role);
  return index < 0 ? OPERATION_ROLES.length : index;
};

export const ranksBelow = (role) =>
  OPERATION_ROLES.slice(Math.max(rankLevel(role) + 1, 0));

export const canManageRank = (viewerRole, targetRole) =>
  rankLevel(viewerRole) < rankLevel(targetRole);

export const OYO_LGAS = [
  "Afijio", "Akinyele", "Atiba", "Atisbo", "Egbeda", "Ibadan North",
  "Ibadan North-East", "Ibadan North-West", "Ibadan South-East",
  "Ibadan South-West", "Ibarapa Central", "Ibarapa East", "Ibarapa North",
  "Ido", "Irepo", "Iseyin", "Itesiwaju", "Iwajowa", "Kajola", "Lagelu",
  "Ogbomoso North", "Ogbomoso South", "Ogo Oluwa", "Olorunsogo", "Oluyole",
  "Ona Ara", "Orelope", "Ori Ire", "Oyo East", "Oyo West", "Saki East",
  "Saki West", "Surulere",
];

export const UNIT_TYPES = [
  "Command Center",
  "Response Team",
  "Field Team",
  "Ward Desk",
];

export const WARDS = Array.from(
  { length: 20 },
  (_, index) => `Ward ${String(index + 1).padStart(2, "0")}`,
);

export const POLLING_UNITS = Array.from(
  { length: 50 },
  (_, index) => `PU ${String(index + 1).padStart(3, "0")}`,
);

export const normalizeCommand = (value) => String(value || "").trim();

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

export const NIGERIA_STATES = [
  "Abia", "Adamawa", "Akwa Ibom", "Anambra", "Bauchi", "Bayelsa", "Benue",
  "Borno", "Cross River", "Delta", "Ebonyi", "Edo", "Ekiti", "Enugu",
  "Gombe", "Imo", "Jigawa", "Kaduna", "Kano", "Katsina", "Kebbi",
  "Kogi", "Kwara", "Lagos", "Nasarawa", "Niger", "Ogun", "Ondo",
  "Osun", "Oyo", "Plateau", "Rivers", "Sokoto", "Taraba", "Yobe",
  "Zamfara", "FCT",
];

export const DEFAULT_REGISTRATION_STATE = "Oyo";

const REGISTRATION_LOCATION_DATA = {
  Oyo: {
    lgas: OYO_LGAS,
    wards: Array.from({ length: 20 }, (_, index) => `Ward ${String(index + 1).padStart(2, "0")}`),
    pollingUnits: Array.from({ length: 50 }, (_, index) => `PU ${String(index + 1).padStart(3, "0")}`),
  },
  FCT: {
    lgas: ["Abaji", "AMAC", "Bwari", "Gwagwalada", "Kuje", "Kwali"],
    wards: Array.from({ length: 12 }, (_, index) => `Ward ${String(index + 1).padStart(2, "0")}`),
    pollingUnits: Array.from({ length: 30 }, (_, index) => `PU ${String(index + 1).padStart(3, "0")}`),
  },
};

export const getRegistrationLocationOptions = (state) => {
  const normalizedState = String(state || DEFAULT_REGISTRATION_STATE).trim();
  const selected = REGISTRATION_LOCATION_DATA[normalizedState] || REGISTRATION_LOCATION_DATA[DEFAULT_REGISTRATION_STATE];
  return {
    lgas: selected?.lgas || [],
    wards: selected?.wards || [],
    pollingUnits: selected?.pollingUnits || [],
  };
};

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

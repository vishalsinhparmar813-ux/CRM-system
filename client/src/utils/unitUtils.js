
export const UnitTypeLabels = {
  SQUARE_FEET: "Sq. Ft.",
  SQUARE_METER: "Sq. M.",
  NOS: "NOS",
  SET: "SET",
};

export function getUnitLabel(unitType) {
  return UnitTypeLabels[unitType] || unitType; 
  // fallback: show the raw value if not in map
}

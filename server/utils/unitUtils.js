export const UnitTypeLabels = {
  SQUARE_FEET: "Sq. Ft.",
  SQUARE_METER: "Sq. M.",
  NOS: "Nos",
  SET: "Set",
};

export function getUnitLabel(unitType) {
  return UnitTypeLabels[unitType] || unitType; 
  // fallback: show the raw value if not in map
}
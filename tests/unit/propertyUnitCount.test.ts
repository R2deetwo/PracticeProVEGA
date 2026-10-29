import { describe, it, expect } from "vitest";
import {
  resolveOwnUnitCount,
  unitCountBase,
  unitCountLabel,
} from "../../src/utils/propertyUnitCount";

/**
 * propertyUnitCount — R41, the missing unit counts on the Properties list
 * (owner direction: "it doesn't actually say the number of units in the
 * actual app… it mentions it in that middle panel… we are supposed to
 * have that showing there"). The old list counted property ROWS that
 * share an address, so a multi-unit estate — ONE row with an embedded
 * units array — counted 1 and the chip (rendered only above 1) never
 * appeared. These tests pin the resolution order that fixed it.
 */
describe("propertyUnitCount — the R41 unit-count resolution", () => {
  it("the declared numberOfUnits field wins (what the forms write)", () => {
    expect(resolveOwnUnitCount({ numberOfUnits: 8 })).toBe(8);
    expect(resolveOwnUnitCount({ numberOfUnits: 24, units: [{}, {}] })).toBe(24);
  });

  it("the embedded units array is the fallback (Parkview's shape)", () => {
    // The demo estate's Parkview Gardens: one row, eight embedded units.
    expect(resolveOwnUnitCount({ units: [{}, {}, {}, {}, {}, {}, {}, {}] })).toBe(8);
    expect(resolveOwnUnitCount({ units: [] })).toBe(0);
    expect(resolveOwnUnitCount({})).toBe(0);
  });

  it("zero/negative garbage never counts", () => {
    expect(resolveOwnUnitCount({ numberOfUnits: 0, units: [] })).toBe(0);
    expect(resolveOwnUnitCount({ numberOfUnits: -3 })).toBe(0);
    expect(resolveOwnUnitCount({ numberOfUnits: Number.NaN })).toBe(0);
  });

  it("a row without its own inventory still contributes one (single-occupancy)", () => {
    // Lekki Heights shape: no units array, no numberOfUnits — the property
    // is its own one lease. The address-group count must not lose it.
    expect(unitCountBase({})).toBe(1);
    expect(unitCountBase({ units: [] })).toBe(1);
  });

  it("a multi-unit row contributes its own inventory as the group base", () => {
    // Parkview (8 embedded) grouped with a second bare row at the same
    // address → 8 + 1 = 9, exactly what the list's useMemo now computes.
    const parkview = { units: [{}, {}, {}, {}, {}, {}, {}, {}] };
    const sibling = {};
    expect(unitCountBase(parkview) + unitCountBase(sibling)).toBe(9);
  });

  it("the chip label is singular/plural correct, null when there is nothing to say", () => {
    expect(unitCountLabel(1)).toBe("1 Unit");
    expect(unitCountLabel(8)).toBe("8 Units");
    expect(unitCountLabel(0)).toBeNull();
    expect(unitCountLabel(Number.NaN)).toBeNull();
  });
});

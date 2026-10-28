import { describe, it, expect } from "vitest";
import {
  unitLabelForIndex,
  isBlockStyleLabel,
  UNITS_PER_BLOCK,
} from "../../src/utils/unitNaming";

/**
 * unitNaming — R39, the unit-numbering switch (owner direction: "A1–A6 /
 * B1–B6 numbering … should be just a flick of a switch"). These tests pin
 * the label arithmetic both schemes run, so the estate grid on the landing
 * page and the app's unit tabs can never drift apart.
 */
describe("unitNaming — the unit-numbering switch (R39)", () => {
  it("sequential is the classic default: Unit N", () => {
    expect(unitLabelForIndex(0)).toBe("Unit 1");
    expect(unitLabelForIndex(0, "sequential")).toBe("Unit 1");
    expect(unitLabelForIndex(11, "sequential")).toBe("Unit 12");
    expect(unitLabelForIndex(199, "sequential")).toBe("Unit 200");
  });

  it("blocks wrap every UNITS_PER_BLOCK units: A1–A6, B1–B6, C1…", () => {
    expect(UNITS_PER_BLOCK).toBe(6);
    expect(unitLabelForIndex(0, "blocks")).toBe("A1");
    expect(unitLabelForIndex(5, "blocks")).toBe("A6");
    expect(unitLabelForIndex(6, "blocks")).toBe("B1");
    expect(unitLabelForIndex(11, "blocks")).toBe("B6");
    expect(unitLabelForIndex(12, "blocks")).toBe("C1");
    // The landing estate's 24-unit grid: A1–A6 … D6.
    expect(unitLabelForIndex(23, "blocks")).toBe("D6");
  });

  it("blocks run past Z with spreadsheet-style double letters, never crashing", () => {
    // 26 letters × 6 units = 156 units before AA starts.
    expect(unitLabelForIndex(155, "blocks")).toBe("Z6");
    expect(unitLabelForIndex(156, "blocks")).toBe("AA1");
    expect(unitLabelForIndex(157, "blocks")).toBe("AA2");
  });

  it("a custom per-block size is honoured (4-per-block terraces)", () => {
    expect(unitLabelForIndex(3, "blocks", 4)).toBe("A4");
    expect(unitLabelForIndex(4, "blocks", 4)).toBe("B1");
  });

  it("negative indices degrade to a sequential label instead of throwing", () => {
    expect(unitLabelForIndex(-1)).toBe("Unit -1");
    expect(unitLabelForIndex(-1, "blocks")).toBe("Unit -1");
  });

  it("isBlockStyleLabel detects estates that already run letter+number labels", () => {
    expect(isBlockStyleLabel("A1")).toBe(true);
    expect(isBlockStyleLabel("B14")).toBe(true);
    expect(isBlockStyleLabel("AA12")).toBe(true);
    expect(isBlockStyleLabel("Unit 1")).toBe(false);
    expect(isBlockStyleLabel("Flat 3")).toBe(false);
    expect(isBlockStyleLabel("")).toBe(false);
    expect(isBlockStyleLabel(undefined)).toBe(false);
  });
});

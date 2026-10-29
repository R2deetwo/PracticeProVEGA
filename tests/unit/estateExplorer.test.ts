import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  ESTATE_PROPERTIES,
  unitCount,
  unitCountText,
  rentRange,
  occupancy,
} from "../../src/sites/atrium/sections/estate/estateDemoData";

/**
 * estateExplorer — R41, the interactive estate band (owner direction:
 * "the user is able to click on one of the properties… hover… a hint…
 * click on units… see the menu… click on more… even in this small space…
 * also on the phone"). These tests pin the band's structure — the two
 * playable frames, the honest INTERACTIVE PREVIEW labelling, the retired
 * static captures — and the demo dataset both frames run on, so the
 * replica can never drift from the estate the app itself ships.
 */
const R = (p: string) => readFileSync(join(__dirname, "../../", p), "utf8");

const atriumEstate = R("src/sites/atrium/sections/AtriumEstate.tsx");
const estateChrome = R("src/sites/atrium/sections/estate/estateChrome.tsx");
const estateExplorer = R("src/sites/atrium/sections/estate/EstateExplorer.tsx");
const estatePhone = R("src/sites/atrium/sections/estate/EstatePhoneExplorer.tsx");
const propertyManager = R("src/components/PropertyManagerView.tsx");

describe("estate band (R41) — the two playable frames", () => {
  it("hosts the interactive explorer + phone, not the retired captures", () => {
    expect(atriumEstate).toContain("import { EstateExplorer } from './estate/EstateExplorer'");
    expect(atriumEstate).toContain("import { EstatePhoneExplorer } from './estate/EstatePhoneExplorer'");
    expect(atriumEstate).toContain("<EstateExplorer />");
    expect(atriumEstate).toContain("<EstatePhoneExplorer />");
    // The R40 static captures are retired from this band — an <img> would
    // mean the interactivity regressed to a screenshot.
    expect(atriumEstate).not.toContain("atrium-estate-units.jpg");
    expect(atriumEstate).not.toContain("atrium-estate-mobile.jpg");
    expect(atriumEstate).not.toMatch(/<img[\s\S]*>/);
  });

  it("labels itself honestly as an interactive preview, never a live capture", () => {
    expect(atriumEstate).toContain("INTERACTIVE PREVIEW");
    expect(atriumEstate).not.toContain("LIVE CAPTURE");
  });

  it("the phone is a rendered screen, not a letterboxed image (the black void fix)", () => {
    // The phone renders at its true 390px layout and scales to the bezel —
    // no fixed-aspect <img> means no bars.
    expect(estatePhone).toContain("width: PHONE_W");
    expect(estatePhone).toContain("transform: `scale(${SCALE})`");
    expect(estatePhone).not.toMatch(/<img[\s\S]*>/);
    // The bottom nav is the Atrium product's own primary bar.
    for (const item of ["Home", "Properties", "Financials", "Tasks", "More"]) {
      expect(estatePhone).toContain(`label="${item}"`);
    }
  });
});

describe("estate band (R41) — the interaction contract", () => {
  it("hover hints, unit-chip counts, and the two-tier unit menu exist", () => {
    // The clickability hint on property cards.
    expect(estateChrome).toContain("Open →");
    // The unit-count chip (the same grammar the app's list now shows).
    expect(estateChrome).toContain("unitCountText(property)");
    // Tier 1 quick actions + the More/Less reveal.
    expect(estateChrome).toContain('<Receipt className="w-3 h-3" /> Receipt');
    expect(estateChrome).toContain('<Megaphone className="w-3 h-3" /> Demand');
    expect(estateChrome).toContain("{more ? 'Less' : 'More'}");
    // Tier 2 — "the rest of the things".
    expect(estateChrome).toContain("Unit Detail");
    expect(estateChrome).toContain("Quit Notice");
    expect(estateChrome).toContain("Legal File");
    expect(estateChrome).toContain("Term Progress");
    expect(estateChrome).toContain("Billing &amp; Payment History");
  });

  it("would-be mutations answer with an honest preview toast, never fake success", () => {
    expect(estateChrome).toContain("Preview — in the product");
    expect(estateChrome).not.toContain("addToast(`Unit marked");
  });

  it("the coach hint appears until the visitor plays", () => {
    expect(estateChrome).toContain("CoachHint");
    expect(estateExplorer).toContain('hintLabel="Click a property to explore"');
    expect(estatePhone).toContain('hintLabel="Tap a property to explore"');
  });

  it("the app's own list is wired to the fixed unit counts (same round)", () => {
    expect(propertyManager).toContain("unitCountBase(item.property)");
    expect(propertyManager).toContain("unitCountLabel(unitCount)");
  });
});

describe("estateDemoData — the estate both frames run on", () => {
  it("is the app's own demo portfolio, all four properties", () => {
    expect(ESTATE_PROPERTIES).toHaveLength(4);
    const addresses = ESTATE_PROPERTIES.map(p => p.address);
    expect(addresses[0]).toContain("Parkview Gardens");
    expect(addresses[1]).toContain("Lekki Heights");
    expect(addresses[2]).toContain("Warehouse Block 4");
    expect(addresses[3]).toContain("Horizon Plaza");
  });

  it("Parkview Gardens counts 8 units — the chip the list was missing", () => {
    const parkview = ESTATE_PROPERTIES[0];
    expect(parkview.units).toHaveLength(8);
    expect(unitCount(parkview)).toBe(8);
    expect(unitCountText(parkview)).toBe("8 Units");
  });

  it("Parkview's occupancy reads 5 / 2 / 1 like the app's Units tab", () => {
    const occ = occupancy(ESTATE_PROPERTIES[0]);
    expect(occ).toEqual({ occupied: 5, vacant: 2, maintenance: 1 });
  });

  it("the rent range matches the app's card: ₦3.2M – ₦8.5M", () => {
    const range = rentRange(ESTATE_PROPERTIES[0])!;
    expect(range[0]).toBe(3200000);
    expect(range[1]).toBe(8500000);
  });

  it("single-occupancy properties read '1 Unit'", () => {
    expect(unitCountText(ESTATE_PROPERTIES[1])).toBe("1 Unit");
    expect(unitCountText(ESTATE_PROPERTIES[2])).toBe("1 Unit");
    expect(unitCountText(ESTATE_PROPERTIES[3])).toBe("1 Unit");
  });

  it("every unit's dates stay in the future/past the demo estate defines", () => {
    const units = ESTATE_PROPERTIES.flatMap(p => p.units);
    // 7 of the 10 demo units carry leases (vacant + maintenance do not).
    expect(units.filter(u => u.leaseEnd).length).toBe(7);
    for (const u of units) {
      if (u.leaseEnd) {
        expect(u.leaseEnd.getTime()).toBeGreaterThan(Date.now());
        expect(u.leaseStart!.getTime()).toBeLessThan(Date.now());
      }
    }
  });
});

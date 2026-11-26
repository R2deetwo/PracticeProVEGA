import { describe, expect, it } from "vitest";
import { splitBracketedTitle } from "../../src/utils/bracketedTitle";

describe("splitBracketedTitle (Stage 2A)", () => {
    it("splits a trailing parenthetical qualifier off the main title", () => {
        expect(splitBracketedTitle("Client Interview Guide: Divorce (Abusive Husband)")).toEqual({
            main: "Client Interview Guide: Divorce",
            parenthetical: "(Abusive Husband)",
        });
    });

    it("keeps nested groups inside the qualifier", () => {
        expect(splitBracketedTitle("Suit Notes (Divorce, Custody (2))")).toEqual({
            main: "Suit Notes",
            parenthetical: "(Divorce, Custody (2))",
        });
    });

    it("passes plain titles through whole", () => {
        expect(splitBracketedTitle("Statement of Claim")).toEqual({
            main: "Statement of Claim",
            parenthetical: null,
        });
    });

    it("passes titles with an unbalanced or empty bracket through whole", () => {
        expect(splitBracketedTitle("Fee schedule (2026").parenthetical).toBeNull();
        expect(splitBracketedTitle("Fee schedule ()").parenthetical).toBeNull();
    });

    it("never emits an empty main when the bracket is the whole title", () => {
        // "(Exhibit A)" — bracket is the title's only content, not a qualifier.
        expect(splitBracketedTitle("(Exhibit A)")).toEqual({
            main: "(Exhibit A)",
            parenthetical: null,
        });
    });

    it("tolerates null/undefined/blank titles", () => {
        expect(splitBracketedTitle(null)).toEqual({ main: "", parenthetical: null });
        expect(splitBracketedTitle(undefined)).toEqual({ main: "", parenthetical: null });
        expect(splitBracketedTitle("   ")).toEqual({ main: "", parenthetical: null });
    });
});

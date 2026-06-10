import { mutation } from "./_generated/server";

// ─────────────────────────────────────────────────────────────────────────────
// SEED FUNCTION FOR LAW REPOSITORY
// Run this via the Convex dashboard or: npx convex run seedLegalRepo:seed
// ─────────────────────────────────────────────────────────────────────────────

export const seed = mutation({
    args: {},
    handler: async (ctx) => {
        const modules = [
            {
                moduleKey: "lagos_hc_civil_2019",
                name: "Lagos State High Court Civil Procedure Rules 2019",
                shortName: "Lagos HC Rules",
                category: "civil_procedure",
                jurisdiction: "Lagos State",
                authority: "Lagos State Judiciary",
                version: "2019 Edition",
                description: "Covers all originating processes (Writ, Originating Summons, Undefended List), motion practice, pre-trial case management, trial procedure, and judgment enforcement.",
                coverageAreas: ["Writ of Summons", "Originating Summons", "Undefended List (Debt Recovery)", "Motion on Notice", "Ex Parte Motion", "Enforce Judgment"],
                primaryMatterTypes: ["Civil Litigation", "Corporate & Commercial"],
                status: "active",
                isBundled: true,
                lastUpdated: "2024-01-01",
            },
            {
                moduleKey: "fhc_civil_2019",
                name: "Federal High Court (Civil Procedure) Rules 2019",
                shortName: "FHC Rules",
                category: "civil_procedure",
                jurisdiction: "Federal (All States)",
                authority: "Federal High Court of Nigeria",
                version: "2019 Edition",
                description: "Covers civil originating processes, motion practice, admiralty proceedings, intellectual property matters, banking & finance disputes, and judgment enforcement.",
                coverageAreas: ["Writ of Summons", "Originating Summons", "Undefended List (Debt Recovery)", "Motion on Notice", "Ex Parte Motion", "Enforce Judgment", "Tax Objection (FIRS)", "NUPRC License Application"],
                primaryMatterTypes: ["Civil Litigation", "Maritime & Admiralty", "Tax Law", "Oil & Gas"],
                status: "active",
                isBundled: true,
                lastUpdated: "2024-01-01",
            },
            {
                moduleKey: "nwlr",
                name: "Nigerian Weekly Law Reports (NWLR)",
                shortName: "NWLR Case Law",
                category: "case_law",
                jurisdiction: "Federal & All States",
                authority: "Nigerian Law Publications",
                version: "Current",
                description: "Full-text access to Nigerian Weekly Law Reports — searchable by court, subject matter, year, and principle.",
                coverageAreas: [],
                primaryMatterTypes: ["Civil Litigation", "Corporate & Commercial", "Tax Law", "Oil & Gas", "Family Law"],
                status: "coming_soon",
                isBundled: false,
                lastUpdated: "2024-01-01",
            }
        ];

        let inserted = 0;
        for (const mod of modules) {
            const existing = await ctx.db
                .query("legal_modules")
                .withIndex("by_moduleKey", q => q.eq("moduleKey", mod.moduleKey))
                .first();
            if (!existing) {
                await ctx.db.insert("legal_modules", mod);
                inserted++;
            }
        }

        return { message: `Seeded ${inserted} legal modules successfully.` };
    },
});

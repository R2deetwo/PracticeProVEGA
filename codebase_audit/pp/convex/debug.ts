import { query } from "./_generated/server";

export const testTables = query({
  args: {},
  handler: async (ctx) => {
    const tables = ["matters", "legal_modules", "statutes", "firm_licenses"];
    const results: Record<string, any> = {};
    for (const table of tables) {
      try {
        const count = (await ctx.db.query(table as any).collect()).length;
        results[table] = { status: "exists", count };
      } catch (err: any) {
        results[table] = { status: "error", message: err.message };
      }
    }
    return results;
  },
});

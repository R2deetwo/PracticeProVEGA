
import { mutation } from "./_generated/server";

export const runPhase1 = mutation({
  args: {},
  handler: async (ctx) => {
    const tables = ["firms", "matters", "properties", "users", "contacts", "tasks", "documents"];
    const results: Record<string, number> = {};

    for (const table of tables) {
      try {
        const records = await ctx.db.query(table as any).collect();
        let count = 0;
        for (const record of records) {
          const patch: any = {};
          
          if (record._version === undefined) patch._version = 1;
          if (!record.createdAt) patch.createdAt = new Date(record._creationTime).toISOString();
          if (!record.updatedAt) patch.updatedAt = new Date().toISOString();

          for (const [key, val] of Object.entries(record)) {
            if (typeof val === "string" && (
              key.toLowerCase().includes("amount") || 
              key.toLowerCase().includes("rate") || 
              key.toLowerCase().includes("price") || 
              key.toLowerCase().includes("balance") || 
              key.toLowerCase().includes("value") ||
              key.toLowerCase().includes("total")
            )) {
              const numValue = (val as string).replace(/[^\d.-]/g, '');
              const num = parseFloat(numValue);
              if (!isNaN(num) && num.toString() !== val) {
                patch[key] = num;
              }
            }
          }

          if (Object.keys(patch).length > 0) {
            await ctx.db.patch(record._id, patch);
            count++;
          }
        }
        results[table] = count;
      } catch (e) {
        console.error(`Migration failed for table ${table}:`, e);
        results[table] = -1;
      }
    }

    // Also include setDefaultProduct logic
    const firms = await ctx.db.query("firms").collect();
    let firmCount = 0;
    for (const firm of firms) {
      if (!firm.product) {
        await ctx.db.patch(firm._id, { product: "unified" });
        firmCount++;
      }
    }
    results["firms_product"] = firmCount;

    return results;
  },
});

export const setDefaultProduct = runPhase1; // Alias to make it work

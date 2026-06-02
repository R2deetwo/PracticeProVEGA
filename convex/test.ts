import { mutation } from "./_generated/server";
import { v } from "convex/values";

export const testInsertUndefined = mutation({
  args: {},
  handler: async (ctx) => {
    try {
      const id = await ctx.db.insert("properties", {
        firmId: "test_firm",
        contactId: "test_contact",
        address: "test_address",
        status: "Active",
        category: "Residential",
        // matterId is intentionally omitted
        rentalDetails: null
      });
      console.log("Success ID:", id);
      return id;
    } catch (e: any) {
      console.error("Insert error:", e);
      throw e;
    }
  }
});

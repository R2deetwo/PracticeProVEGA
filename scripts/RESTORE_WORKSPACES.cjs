const { ConvexHttpClient } = require("convex/browser");

const client = new ConvexHttpClient("https://keen-jaguar-204.convex.cloud");

async function check() {
    try {
        console.log("Checking keen-jaguar-204...");
        const result = await client.query("myFunctions:dumpAll", {});
        console.log("Found Users:", result.users.length);
        console.log("Found Firms:", result.firms.length);
        if (result.firms.length > 0) {
            console.log("Example Firm:", result.firms[0].name);
            const firmData = await client.query("myFunctions:getFirmData", { firmId: result.firms[0].id });
            console.log("Matters in Firm:", firmData?.matters?.length || 0);
        }
    } catch(e) {
        console.error("ERROR checking keen-jaguar-204:", e.message);
    }
}
check();

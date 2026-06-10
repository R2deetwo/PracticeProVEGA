const { ConvexHttpClient } = require("convex/browser");
const dotenv = require("dotenv");
dotenv.config({ path: ".env.local" });

const client = new ConvexHttpClient(process.env.CONVEX_URL);

async function run() {
    try {
        console.log("Fetching all properties...");
        const allProperties = await client.query("debug:dumpAll", { tableName: "properties" });
        console.log(`Total properties: ${allProperties.length}`);
        if (allProperties.length > 0) {
            console.log("Last 2 properties:", allProperties.slice(-2));
        }
    } catch (e) {
        console.error("Error:", e);
    }
}
run();

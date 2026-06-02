import { ConvexHttpClient } from "convex/browser";
import { EMPTY_APP_STATE } from "../src/utils/mockData";

const client = new ConvexHttpClient("https://keen-jaguar-204.convex.cloud");

async function seed() {
    console.log("Seeding system defaults...");

    const seedTable = async (table: string, items: any[]) => {
        let count = 0;
        for (const item of items) {
            const { id, ...data } = item;
            data.firmId = "system"; // Make them global defaults
            try {
                await client.mutation("myFunctions:createItem" as any, { table, data });
                count++;
            } catch (e) {
                console.error(`Failed to seed ${table}:`, e);
            }
        }
        console.log(`Seeded ${count} items into ${table}`);
    };

    await seedTable("eventTypes", EMPTY_APP_STATE.eventTypes || []);
    await seedTable("contactCategories", EMPTY_APP_STATE.contactCategories || []);
    await seedTable("documentCategories", EMPTY_APP_STATE.documentCategories || []);

    console.log("Seeding complete!");
}

seed();

import { ConvexHttpClient } from "convex/browser";

const client = new ConvexHttpClient("https://keen-jaguar-204.convex.cloud");

async function check() {
    try {
        console.log("Checking DB users...");
        // Since I added `resetPassword`, I can't easily dump passwords through existing queries.
        // Wait, what if I just log in using `login('badejo', 'admin')`?
        // I can just query the `dumpAll` to get the list of users, then maybe I can guess the password or check if login succeeds!
        const result = await client.query("myFunctions:dumpAll" as any, {});
        console.log("USERS:", result.users);
    } catch(e) {
        console.error(e);
    }
}
check();

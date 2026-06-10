import { ConvexClient } from "convex/browser";
import { v4 as uuidv4 } from "uuid";

// We use the production client URL
const clientUrl = "https://gregarious-malamute-537.convex.cloud";
const client = new ConvexClient(clientUrl);

async function runTest() {
  console.log("Testing createItem on production Convex instance...");
  try {
    const contactData = {
      firmId: "qx7btphwkn1whe3027bqcxbk6586jm0x",
      name: "Test Contact from Script",
      email: "testscript@example.com",
      phone: "1234567890",
      address: "123 Script Way",
      contactType: "Individual",
      category: "Client",
      id: uuidv4()
    };

    console.log("Sending payload...");
    const result = await client.mutation("myFunctions:createItem", {
      table: "contacts",
      data: contactData,
      userEmail: "Prototypechigo@gmail.com"
    });

    console.log("Success! Returned ID:", result);
  } catch (error) {
    console.error("Error occurred while calling mutation:");
    console.error(error);
  } finally {
    // ConvexClient keeps the connection open; force exit
    process.exit(0);
  }
}

runTest();

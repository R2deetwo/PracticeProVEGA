import { GoogleGenAI } from "@google/genai";
const API_KEY = "AIzaSyAHRNaN-z9DPm4wyNdvt2TQlBpTHHDyBkw";
const genAI = new GoogleGenAI({ apiKey: API_KEY });

async function test() {
    try {
        const model = genAI.getGenerativeModel({ model: "models/gemini-1.5-flash" });
        const result = await model.generateContent("hello");
        const response = await result.response;
        console.log(response.text());
    } catch (e) {
        console.error(e);
    }
}

test();

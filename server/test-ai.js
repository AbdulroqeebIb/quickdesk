require("dotenv").config();
const { GoogleGenAI } = require("@google/genai");
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function main() {
  const pager = await ai.models.list();
  const names = [];
  for await (const m of pager) {
    if (
      (m.supportedActions || []).includes("generateContent") &&
      /flash/i.test(m.name)
    ) {
      names.push(m.name.replace("models/", ""));
    }
  }
  console.log("Flash models for your key:", names.join(", "));
  for (const model of names.slice(0, 8)) {
    const start = Date.now();
    try {
      await Promise.race([
        ai.models.generateContent({
          model,
          contents: "Reply with one word: ok",
        }),
        new Promise((_, rej) =>
          setTimeout(() => rej(new Error("timeout 15s")), 15000),
        ),
      ]);
      console.log(`OK    ${model}  ${Date.now() - start}ms`);
    } catch (e) {
      console.log(`FAIL  ${model}  ${String(e.message).slice(0, 80)}`);
    }
  }
}
main();

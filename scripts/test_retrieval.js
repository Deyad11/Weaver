import { GoogleGenAI } from "@google/genai";
import { createClient } from "@supabase/supabase-js";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

async function testRetrieval(query) {
  console.log(`\nQuery: "${query}"`);
  console.log("---");

  const result = await ai.models.embedContent({
    model: "gemini-embedding-001",
    contents: query,
  });

  const queryEmbedding = result.embeddings[0].values;

  const { data, error } = await supabase.rpc("match_chunks", {
    query_embedding: queryEmbedding,
    match_character: "young_man",
    match_count: 3,
  });

  if (error) {
    console.error("Error:", error.message);
    return;
  }

  data.forEach((chunk, i) => {
    console.log(`${i + 1}. [${(chunk.similarity * 100).toFixed(1)}%] ${chunk.content.slice(0, 100)}...`);
  });
}

await testRetrieval("why does food taste like nothing");
await testRetrieval("tell me about your father");
await testRetrieval("what are you doing with your life now");
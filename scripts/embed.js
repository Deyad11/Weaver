import { GoogleGenAI } from "@google/genai";
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);
const profile = JSON.parse(readFileSync("./data/young_man.json", "utf-8"));

async function embedAndStore() {
  console.log(`Starting embedding for: ${profile.character_id}`);

  for (const chunk of profile.chunks) {
    console.log(`Embedding chunk: ${chunk.chunk_id}`);

    const result = await ai.models.embedContent({
      model: "gemini-embedding-001",
      contents: chunk.content,
    });

    const embedding = result.embeddings[0].values;

    const { error } = await supabase.from("character_chunks").insert({
      character_id: profile.character_id,
      chunk_id: chunk.chunk_id,
      content: chunk.content,
      embedding,
    });

    if (error) {
      console.error(`Failed to store ${chunk.chunk_id}:`, error.message);
    } else {
      console.log(`Stored: ${chunk.chunk_id}`);
    }
  }

  console.log("Done.");
}

embedAndStore();
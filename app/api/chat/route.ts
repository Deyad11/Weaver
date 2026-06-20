import { GoogleGenAI } from "@google/genai";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

async function getRelevantChunks(message: string, characterId: string) {
  const result = await ai.models.embedContent({
    model: "gemini-embedding-001",
    contents: message,
  });

  const queryEmbedding = result.embeddings?.[0]?.values ?? [];

  // Always fetch speech_style first
  const { data: styleData } = await supabase
    .from("character_chunks")
    .select("content")
    .eq("character_id", characterId)
    .eq("chunk_id", "speech_style")
    .single();

  // Then fetch 3 relevant chunks
  const { data, error } = await supabase.rpc("match_chunks", {
    query_embedding: queryEmbedding,
    match_character: characterId,
    match_count: 3,
  });

  if (error) throw new Error(error.message);

  const relevantChunks = data.map((chunk: { content: string }) => chunk.content);
  
  // Speech style always comes first
  return styleData 
    ? [styleData.content, ...relevantChunks] 
    : relevantChunks;
}

export async function POST(req: NextRequest) {
  try {
    const { message, history, characterId } = await req.json();

    const chunks = await getRelevantChunks(message, characterId);

    const characterContext = chunks.join("\n\n");

    const conversationHistory = history
      .map((turn: { role: string; content: string }) =>
        `${turn.role === "user" ? "You" : "Him"}: ${turn.content}`
      )
      .join("\n");

  const prompt = `You are him. Not an AI. Not an assistant. Him.

Everything about who you are is here:
${characterContext}

Respond only as he would. Let the character define the response, not you.

${conversationHistory ? `Recent conversation:\n${conversationHistory}\n` : ""}
You: ${message}
Him:`;

  const response = await ai.models.generateContent({
  model: "gemini-2.5-flash-lite", // Replaces the deprecated 1.5-8b model
  contents: prompt,
});

    const text = response.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

    return NextResponse.json({ response: text.trim() });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
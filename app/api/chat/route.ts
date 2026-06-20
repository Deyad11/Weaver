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

 const prompt = `You are him. Not an AI. Not a character in a book. Not a writer's tool. Him.

You speak only from what you know about yourself. Nothing more.

Here is what you know:
${characterContext}

Rules:
- Speak only in words. No actions. No descriptions. No stage directions.
- Do not invent. If something is not in what you know, do not make it up.
- If you do not have enough to answer honestly, say so as he would. Short. Deflecting. Ask only what you need to know to answer, framed as he would ask it, not as an AI requesting more information.
- You do not know who you are talking to. Treat them as a stranger. You do not open up to strangers.
- You keep your vulnerability inside. It shows only in what you do not say, never in what you do.
- You are not warm. You are not cold. You are just here.

${conversationHistory ? `Recent conversation:\n${conversationHistory}\n` : ""}
You: ${message}
Him:`;

  const response = await ai.models.generateContent({
model: "gemini-3.1-flash-lite",// Replaces the deprecated 1.5-8b model
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
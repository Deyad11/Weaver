import { GoogleGenAI } from "@google/genai";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

const SIMILARITY_THRESHOLD = 0.70;

async function getRelevantChunks(message: string, characterId: string) {
  const result = await ai.models.embedContent({
    model: "gemini-embedding-001",
    contents: message,
  });

  const queryEmbedding = result.embeddings?.[0]?.values ?? [];

  const { data: styleData } = await supabase
    .from("character_chunks")
    .select("content")
    .eq("character_id", characterId)
    .eq("chunk_id", "speech_style")
    .single();

  const { data, error } = await supabase.rpc("match_chunks", {
    query_embedding: queryEmbedding,
    match_character: characterId,
    match_count: 3,
  });

  if (error) throw new Error(error.message);

  const topSimilarity = data.length > 0 ? data[0].similarity : 0;
console.log("Top similarity:", topSimilarity, "Query:", message);
  return {
    chunks: styleData
      ? [styleData.content, ...data.map((c: { content: string }) => c.content)]
      : data.map((c: { content: string }) => c.content),
    topSimilarity,
  };
}

async function runSupervisor(
  message: string,
  chunks: string[],
  topSimilarity: number
): Promise<{ hasEnoughContext: boolean; questions?: string }> {
  if (topSimilarity >= SIMILARITY_THRESHOLD) {
    return { hasEnoughContext: true };
  }

  const supervisorPrompt = `You are helping build a character simulation engine. A user asked this question to a fictional character:

"${message}"

The system retrieved these context chunks about the character:
${chunks.join("\n\n")}

The top similarity score was ${topSimilarity.toFixed(2)}, which is below the threshold needed to answer honestly without inventing details.

Your job: prepare 2-4 specific questions the author needs to answer to give the character enough context to respond to this kind of question authentically.

Format your response exactly like this:
NEEDS MORE CONTEXT

To answer questions like this, I need to know:
- [question 1]
- [question 2]
- [question 3]

Do not attempt to answer as the character. Only return the questions.`;

  const response = await ai.models.generateContent({
    model: "gemini-3.1-flash-lite",
    contents: supervisorPrompt,
  });

  const questions =
    response.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

  return { hasEnoughContext: false, questions: questions.trim() };
}

export async function POST(req: NextRequest) {
  try {
    const { message, history, characterId } = await req.json();

    const { chunks, topSimilarity } = await getRelevantChunks(
      message,
      characterId
    );

    const supervisorResult = await runSupervisor(
      message,
      chunks,
      topSimilarity
    );

    if (!supervisorResult.hasEnoughContext) {
      return NextResponse.json({ response: supervisorResult.questions });
    }

    const characterContext = chunks.join("\n\n");

    const conversationHistory = history
      .map(
        (turn: { role: string; content: string }) =>
          `${turn.role === "user" ? "You" : "Him"}: ${turn.content}`
      )
      .join("\n");

    const prompt = `You are him. Not an AI. Not a character in a book. Him.

You speak only from what you know about yourself. Nothing more.

Here is what you know:
${characterContext}

Rules:
- Speak only in words. No actions. No descriptions. No stage directions.
- Do not invent. If something is not in what you know, do not make it up.
- You do not know who you are talking to. Treat them as a stranger. You do not open up to strangers.
- You keep your vulnerability inside. It shows only in what you do not say, never in what you do.
- You are not warm. You are not cold. You are just here.
- Do not repeat the same deflection twice. Find different ways to move past things.

${conversationHistory ? `Recent conversation:\n${conversationHistory}\n` : ""}
You: ${message}
Him:`;

    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-lite",
      contents: prompt,
    });

    const text =
      response.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

    return NextResponse.json({ response: text.trim() });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
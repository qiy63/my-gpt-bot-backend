import OpenAI from "openai";
import { Pinecone } from "@pinecone-database/pinecone";
import "dotenv/config";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
const index = pinecone.Index(process.env.INDEX_NAME);

function chunkText(text, size = 500) {
  const chunks = [];
  for (let i = 0; i < text.length; i += size) {
    chunks.push(text.slice(i, i + size));
  }
  return chunks;
}

export async function ingestText(text, sourceId, filename = "content.txt") {
  if (!text) return;

  const chunks = chunkText(text);
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const embedding = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: chunk,
    });

    await index.upsert([
      {
        id: `${sourceId}_chunk_${i}`,
        values: embedding.data[0].embedding,
        metadata: {
          text: chunk,
          source: sourceId,
          filename,
        },
      },
    ]);
  }
}

export async function removeVectors(sourceId) {
  try {
    await index.deleteMany({
      filter: { source: sourceId },
    });
  } catch (err) {
    console.warn(`Failed to remove vectors for ${sourceId}:`, err.message || err);
  }
}

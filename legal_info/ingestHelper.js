import OpenAI from "openai";
import { Pinecone } from "@pinecone-database/pinecone";
import fs from "fs";
import path from "path";
import "dotenv/config";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
const index = pinecone.Index(process.env.INDEX_NAME);

const allowedExt = new Set([".txt", ".pdf", ".doc", ".docx"]);

function chunkText(text, size = 500) {
  const chunks = [];
  for (let i = 0; i < text.length; i += size) {
    chunks.push(text.slice(i, i + size));
  }
  return chunks;
}

// Basic text extractor: currently only handles .txt. Other formats are skipped.
function extractText(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext !== ".txt") {
    console.warn(`Ingest skip: unsupported extraction for ${ext}. Only .txt ingested.`);
    return null;
  }
  return fs.readFileSync(filePath, "utf8");
}

export async function ingestFile(filePath, sourceId) {
  const ext = path.extname(filePath).toLowerCase();
  if (!allowedExt.has(ext)) {
    console.warn(`Ingest skip: ${filePath} has unsupported extension.`);
    return;
  }

  const text = extractText(filePath);
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
          filename: path.basename(filePath),
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

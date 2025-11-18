import OpenAI from "openai";
import { Pinecone } from "@pinecone-database/pinecone";
import "dotenv/config";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY});
const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY});
const index = pinecone.Index(process.env.INDEX_NAME);

async function ask(question) {
    
    // 1. conv question -> embedding

    const embedding = await openai.embeddings.create({

        model: "text-embedding-3-small",
        input: question

    });

    // 2. search pinecone

    const results = await index.query({

        vector: embedding.data[0].embedding,
        topK: 3,
        includeMetadata: true

    });

    const context = results.matches
        .map(match => match.metadata.text)
        .join("\n");

    // 3. ask gpt using context

    const response = await openai.chat.completions.create({

        model: "gpt-4o-mini",

        messages: [

            {

                role: "system",
                content:
                    "You are a Malaysian real estate law assistant. Only answer based on the provided documents."

            },

            {

                role: "user",
                content: `Context:\n${context}\n\nQuestion: ${question}`

            }

        ]

    });

    console.log("\n=== Answer ===\n");
    console.log(response.choices[0].message.content);

}

ask("What is the rule for eviction notices in Malaysia?");
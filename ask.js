import OpenAI from "openai";
import { Pinecone } from "@pinecone-database/pinecone";
import "dotenv/config";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
const index = pinecone.Index(process.env.INDEX_NAME);

export async function ask(question) {
    
    // 1. question → embedding
    const embedding = await openai.embeddings.create({

        model: "text-embedding-3-small",
        input: question

        
    });

    // 2. query pinecone
    const results = await index.query({

        vector: embedding.data[0].embedding,
        topK: 3,
        includeMetadata: true

    });

    const context = results.matches

        .map(match => match.metadata.text)
        .join("\n");

    // 3. GPT context
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

    const answer = response.choices[0].message.content;

    // log for backend
    console.log("\n=== Answer ===\n");
    console.log(answer);

    // 👉 RETURN the answer to server.js
    return answer;
}

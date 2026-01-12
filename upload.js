import OpenAI from "openai";
import { Pinecone } from "@pinecone-database/pinecone";
import "dotenv/config";
import fs from "fs";
import path from "path";

const openai = new OpenAI({

    apiKey: process.env.OPENAI_API_KEY

});

const pinecone = new Pinecone({

    apiKey: process.env.PINECONE_API_KEY

});

const index = pinecone.Index(process.env.INDEX_NAME);

// split long text to chunks
function chunkText(text, size=500){

    const chunks = [];

    for (let i = 0; i < text.length; i += size){

        chunks.push(text.slice(i, i + size));

    }

    return chunks;

}

// upload files in legal_info
async function uploadDocument() {
    
    const folder = "./legal_info";
    const files = fs.readdirSync(folder);
    const allowedExt = new Set([".txt", ".pdf", ".doc", ".docx"]);

    console.log(`Found ${files.length} documents.`);

    for (const file of files){

        const filePath = path.join(folder, file);
        const stat = fs.statSync(filePath);
        if (!stat.isFile()) {
            console.log(`Skipping non-file entry: ${file}`);
            continue;
        }
        const ext = path.extname(file).toLowerCase();
        if (!allowedExt.has(ext)) {
            console.log(`Skipping unsupported file type: ${file}`);
            continue;
        }

        const text = fs.readFileSync(filePath, "utf8");

        const chunks = chunkText(text);

        console.log(`Uploading ${file} with ${chunks.length} chunks...`);

        // upload chunks as vector
        for (let i = 0; i < chunks.length; i++){

            const chunk = chunks[i];

            const embedding = await openai.embeddings.create({

                model: "text-embedding-3-small",
                input: chunk

            });

            await index.upsert([

                {

                    id: `${file}_chunk_${i}`,
                    values: embedding.data[0].embedding,
                    metadata: {

                        text: chunk,
                        source: file

                    }

                }

            ]);

        }

        console.log(`${file} uploaded successfully.`);

    }

    console.log("\nAll documents uploaded.");

}

uploadDocument();

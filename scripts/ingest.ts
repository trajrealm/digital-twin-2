import { readFileSync, readdirSync } from 'fs';
import { resolve } from 'path';
import { OpenAI } from 'openai';
import { QdrantClient, PointStruct } from '@qdrant/js-client-rest';
import { createHash } from 'crypto';


const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const qdrant = new QdrantClient({
  url: process.env.QDRANT_URL,
  apiKey: process.env.QDRANT_API_KEY,
});

interface Source {
  path: string;
  type: 'resume' | 'blog' | 'project' | 'bio';
  title: string;
}

interface Chunk {
  sourceId: string;
  type: string;
  title: string;
  chunkIndex: number;
  text: string;
}

// Simple tokenizer (rough estimation - ~4 chars per token)
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

// Split text into chunks by paragraph, then group paragraphs into chunks
function chunkText(text: string, targetChunkSize = 1000): string[] {
  // Split by double newlines (paragraph boundaries)
  const paragraphs = text.split(/\n\n+/).filter((p) => p.trim().length > 0);

  const chunks: string[] = [];
  let currentChunk: string[] = [];
  let currentTokens = 0;

  for (const para of paragraphs) {
    const paraTokens = estimateTokens(para);

    // If adding this paragraph exceeds target size AND we have content, save chunk
    if (currentTokens + paraTokens > targetChunkSize && currentChunk.length > 0) {
      chunks.push(currentChunk.join('\n\n'));
      currentChunk = [para];
      currentTokens = paraTokens;
    } else {
      currentChunk.push(para);
      currentTokens += paraTokens;
    }
  }

  // Add final chunk
  if (currentChunk.length > 0) {
    chunks.push(currentChunk.join('\n\n'));
  }

  return chunks;
}

async function ingestSources() {
  try {
    console.log('Reading sources manifest...');
    const manifestPath = resolve('content/sources.json');
    const manifest: Source[] = JSON.parse(readFileSync(manifestPath, 'utf-8'));

    console.log(`Found ${manifest.length} sources to ingest`);

    for (const source of manifest) {
      console.log(`\nIngesting: ${source.title} (${source.type})`);
      
      const filePath = resolve(source.path);
      let content = '';

      try {
        content = readFileSync(filePath, 'utf-8');
      } catch (err) {
        console.warn(`  Warning: File not found at ${source.path}, skipping`);
        continue;
      }

      // Split into chunks
      const chunks = chunkText(content);
      console.log(`  Split into ${chunks.length} chunks`);

      // Generate embeddings and prepare points
      const points: PointStruct[] = [];

      for (let i = 0; i < chunks.length; i++) {
        const chunkText = chunks[i];

        console.log(`  Embedding chunk ${i + 1}/${chunks.length}...`);
        
        const embeddingResponse = await openai.embeddings.create({
          model: 'text-embedding-3-small',
          input: chunkText,
        });

        const embedding = embeddingResponse.data[0].embedding;

        // Create deterministic point ID
        const pointId = parseInt(
          createHash('md5').update(`${source.path}-${i}`).digest('hex').slice(0, 8),
          16
        );

        points.push({
          id: pointId,
          vector: embedding,
          payload: {
            source_id: source.path,
            type: source.type,
            title: source.title,
            chunk_index: i,
            text: chunkText,
          },
        });
      }

      // Upsert to Qdrant in batches to stay under the 32MB payload limit
      const batchSize = 100;
      const totalBatches = Math.ceil(points.length / batchSize);
      for (let b = 0; b < totalBatches; b++) {
        const batch = points.slice(b * batchSize, (b + 1) * batchSize);
        console.log(`  Upserting batch ${b + 1}/${totalBatches} (${batch.length} points)...`);
        await qdrant.upsert('knowledge_chunks', {
          wait: true,
          points: batch,
        });
      }

      console.log(`  Successfully ingested: ${source.title}`);
    }

    console.log('\n✓ Ingestion complete!');
  } catch (error) {
    console.error('Ingestion error:', error);
    process.exit(1);
  }
}

// Run ingestion
ingestSources();

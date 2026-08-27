---
name: ai-rag-pipeline-architect
description: Architect Retrieval-Augmented Generation (RAG) pipelines with smart document chunking, vector embeddings, semantic search, and reranking.
---

# RAG & Semantic Search Pipeline Architect

Use this skill when implementing AI document search, chat-with-PDF, or enterprise knowledge retrieval.

## Pipeline Architecture
1. **Chunking Strategy**: 500-1000 token chunks with 10-15% overlap using recursive text splitters.
2. **Embedding Model**: Generate embeddings (e.g. `text-embedding-3-small` or BGE-M3).
3. **Vector Database**: Store vectors with metadata filters in PostgreSQL (`pgvector`), Supabase, or Pinecone.
4. **Hybrid Search & Reranking**: Combine BM25 full-text keyword search with vector similarity, then apply Cross-Encoder reranking.

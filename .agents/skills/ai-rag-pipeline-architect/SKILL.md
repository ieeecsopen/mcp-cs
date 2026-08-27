---
name: ai-rag-pipeline-architect
description: Activate when architecting, implementing, or optimizing Retrieval-Augmented Generation (RAG) systems, semantic vector search, document chunking, hybrid search, and reranking pipelines — trigger phrasings include "build a RAG pipeline for my documents", "how do I chunk PDFs for vector search", "setup pgvector in PostgreSQL", "implement hybrid search with BM25", "reduce hallucinations in my AI assistant", or "audit my RAG retrieval accuracy". Enforces recursive chunking strategies, vector embeddings (text-embedding-3-small, BGE-M3), metadata filtering, and cross-encoder reranking.
version: 1.0.0
author: IEEE Computer Society of SLIIT
tags: [rag-pipeline, vector-database, embeddings, semantic-search, pgvector, hybrid-search, reranking, llm-engineering]
---

# RAG Pipeline & Semantic Search Architecture Runbook

## Mission

Build high-precision, hallucination-resistant Retrieval-Augmented Generation (RAG) pipelines. Naive RAG setups suffer from semantic drift, lost-in-the-middle context degradation, and high latency caused by unstructured text dumps. This skill establishes a production RAG architecture: recursive token-aware chunking, hybrid search (combining sparse BM25 keyword search with dense vector similarity), metadata filtering, and Cross-Encoder reranking.

---

## The Production Hybrid RAG Pipeline

```
  User Query
      │
      ├───────────────────────────────┐
      ▼ (Dense Vector Embedding)      ▼ (Sparse Keyword Extraction)
┌───────────────────────────┐   ┌───────────────────────────┐
│ Vector Similarity Search  │   │ BM25 Full-Text Keyword    │
│ (Cosine Distance / HNSW)  │   │ Search (Exact matches)    │
└─────────────┬─────────────┘   └─────────────┬─────────────┘
              │                               │
              └───────────────┬───────────────┘
                              ▼
                ┌───────────────────────────┐
                │ Reciprocal Rank Fusion    │
                │ (RRF Top 25 Candidates)   │
                └─────────────┬─────────────┘
                              ▼
                ┌───────────────────────────┐
                │ Cross-Encoder Reranker    │
                │ (Cohere / BGE Reranker)   │
                └─────────────┬─────────────┘
                              ▼
                ┌───────────────────────────┐
                │ Top 5 Reranked Passages   │
                │ -> LLM Prompt Generation  │
                └───────────────────────────┘
```

---

## Chunking & Embedding Strategy Matrix

```
┌────────────────────────────────────────────────────────────────────────────┐
│                       Optimal RAG Chunking Parameters                      │
├──────────────────────┬─────────────────────────────┬───────────────────────┤
│ Document Type        │ Chunk Size (Tokens)         │ Overlap (Tokens)      │
├──────────────────────┼─────────────────────────────┼───────────────────────┤
│ Code / API Specs     │ 256 - 512 tokens            │ 50 tokens (Function)  │
│ Academic Papers      │ 512 - 768 tokens            │ 100 tokens (15%)      │
│ Long Form Markdown   │ 500 - 1000 tokens           │ 100 tokens (10%)      │
└──────────────────────┴─────────────────────────────┴───────────────────────┘
```

---

## Quality Gate Checklist

- [ ] **Recursive Chunking Enforced**: Text split along natural sentence/paragraph boundaries rather than hard character counts.
- [ ] **Metadata Preserved**: Chunks retain source metadata (`doc_id`, `page_number`, `header_title`).
- [ ] **Vector Index Optimized**: PostgreSQL `pgvector` table uses `HNSW` or `IVFFlat` index with `vector_cosine_ops`.
- [ ] **Source Attributions Injected**: LLM prompts explicitly enforce citing retrieved document chunk IDs.

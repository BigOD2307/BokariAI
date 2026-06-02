# Bokari Citation Engine — Eval Report (2026-06-02)

**Queries:** 34  
**Corpus:** 53 articles (fixture with BGE-M3 embeddings)  
**K:** 10  
**Cosine weight:** 0.30  
**Embedding model:** baai/bge-m3 via OpenRouter  
**Rerank:** offline (topN=10, candidatePool=50)  

## Aggregate metrics

| Metric | BM25 only | Hybrid (BM25 + cosine) | Reranked (top-50 → rerank → top-K) | ΔHybrid | ΔRerank |
| --- | --- | --- | --- | --- | --- |
| NDCG@10 | 0.889 | 0.892 | 0.898 | +0.004 | +0.009 |
| MRR | 0.887 | 0.892 | 0.907 | +0.005 | +0.020 |
| Hit rate@10 | 0.971 | 0.971 | 0.971 | +0.000 | +0.000 |

## Per-query NDCG@K

| Query | BM25 | Hybrid | Reranked | ΔRerank | Topic |
| --- | --- | --- | --- | --- | --- |
| Bamako Mali nouveau président | 0.999 | 0.999 | 0.989 | -0.010 | africa |
| Nigeria election 2026 | 1.000 | 1.000 | 1.000 | +0.000 | africa |
| Sahel security crisis | 0.972 | 0.972 | 1.000 | +0.028 | africa |
| Sénégal Dakar actualité | 1.000 | 1.000 | 1.000 | +0.000 | africa |
| Ethiopia peace process | 1.000 | 1.000 | 1.000 | +0.000 | africa |
| CFA franc BCEAO | 1.000 | 1.000 | 1.000 | +0.000 | finance |
| AfCFTA free trade | 1.000 | 1.000 | 1.000 | +0.000 | finance |
| African AI startup funding | 0.515 | 0.635 | 0.964 | +0.449 | tech |
| mobile money M-Pesa | 0.606 | 0.606 | 0.834 | +0.228 | tech |
| Flutterwave Paystack | 1.000 | 1.000 | 1.000 | +0.000 | tech |
| African developer community | 0.930 | 0.930 | 0.921 | -0.009 | tech |
| BRVM UEMOA stock exchange | 1.000 | 1.000 | 1.000 | +0.000 | finance |
| African crypto adoption | 0.983 | 0.983 | 0.968 | -0.015 | finance |
| microfinance rural Africa | 0.964 | 0.964 | 0.964 | +0.000 | finance |
| Afrobeats Grammy nomination | 1.000 | 1.000 | 1.000 | +0.000 | art |
| Nollywood film industry | 1.000 | 1.000 | 1.000 | +0.000 | art |
| AFCON 2026 Morocco | 0.693 | 0.693 | 1.000 | +0.307 | sports |
| malaria vaccine Africa rollout | 1.000 | 1.000 | 1.000 | +0.000 | sante |
| Mali président inauguration | 0.988 | 0.988 | 0.965 | -0.022 | africa |
| Bamako n服的ceremony | 1.000 | 1.000 | 0.872 | -0.128 | africa |
| le nouveau dirigeant malien a prêté serment à Koulouba | 0.843 | 0.843 | 1.000 | +0.157 | africa |
| African artificial intelligence startup raises capital | 0.857 | 0.857 | 0.471 | -0.386 | tech |
| machine learning Africa venture investment | 0.498 | 0.498 | 0.362 | -0.136 | tech |
| Mali kɛntɛri sera kongo | 1.000 | 1.000 | 0.952 | -0.048 | africa |
| Bamako kuntigi kura | 0.957 | 0.957 | 0.907 | -0.050 | africa |
| Senegaal xibaar bi tey | 1.000 | 1.000 | 1.000 | +0.000 | africa |
| Dakar politig | 0.934 | 0.934 | 0.994 | +0.060 | africa |
| Najeriya fintech kudade | 1.000 | 1.000 | 1.000 | +0.000 | finance |
| Lagos kamfanin kuɗi | 0.934 | 0.934 | 0.917 | -0.017 | finance |
| Kenya wapangaji programu AI | 0.997 | 0.997 | 0.921 | -0.076 | tech |
| Nairobi mafunzo akili bandia | 0.996 | 0.996 | 0.985 | -0.012 | tech |
| African capital markets BRVM | 0.920 | 0.920 | 0.544 | -0.376 | finance |
| jeune startuppeur africain intelligence artificielle | 0.000 | 0.000 | 0.000 | +0.000 | tech |
| Nollywood film industry Nigeria | 0.629 | 0.629 | 1.000 | +0.371 | art |

## Notes

- **Relevance grades** are derived, not human-rated:
  - 3 = ≥50% of query tokens in title, or mustMatch in title
  - 2 = ≥30% of query tokens in title
  - 1 = any query token or mustMatch in body only
  - 0 = topic gate fails, or no overlap
- **Topic gate** is strict — articles in a different topic score 0 unless
  a mustMatch term is in the title.
- **Fixture** is 53 hand-written articles covering the 34 queries.  Real
  corpora (1000+ articles) will produce different absolute numbers but the
  relative BM25-vs-hybrid comparison should hold.
- **Rerank** uses offline mode.  In offline mode, the
  "cross-encoder" is a deterministic token-overlap scorer used for
  ranking-reorder regression tests.  The lift reported is the
  *theoretical ceiling* on this fixture, not the live production lift.

/**
 * @module cache/vector
 * @description Vector math + serialisation helpers shared by the
 * semantic cache.  Pulled out of `store.ts` so each file stays
 * under the 200-line quality bar.
 *
 * The packing format is a `Buffer` view over a `Float32Array` —
 * better-sqlite3 stores BLOBs as Buffers, and the F32A lets us
 * compute cosine similarity in a tight loop without GC churn.
 *
 * @author Amadou — Dicken AI
 * @version 1.0.0
 */

/** Pack a JS number[] into a Float32Array-backed Buffer for SQLite. */
export function packEmbedding(vec: number[]): Buffer {
  return Buffer.from(new Float32Array(vec).buffer);
}

/** Inverse of `packEmbedding`.  Allocates a new Float32Array. */
export function unpackEmbedding(buf: Buffer): Float32Array {
  // Slice the buffer so the F32A owns its memory and the GC can
  // free it independently of any other Buffer that happens to
  // share the pool.
  return new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4).slice();
}

/** Cosine similarity between two equally-sized vectors.
 *  Returns 0 if either is the zero vector or the lengths differ. */
export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    const av = a[i]!;
    const bv = b[i]!;
    dot += av * bv;
    na += av * av;
    nb += bv * bv;
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

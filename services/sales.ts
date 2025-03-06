import prisma from "@/lib/prisma";
import { generateEmbeddings } from "./message";

function cosineSimilarityOptimized(
  query: number[],
  queryNorm: number,
  saleEmbedding: number[]
): number {
  let dot = 0;
  let saleNormSquared = 0;
  for (let i = 0; i < query.length; i++) {
    dot += query[i] * saleEmbedding[i];
    saleNormSquared += saleEmbedding[i] ** 2;
  }
  return dot / (queryNorm * Math.sqrt(saleNormSquared));
}

// export async function retrieveRelevantSales(
//   userQuery: string
// ): Promise<string> {
//   const queryEmbedding = await generateEmbeddings(userQuery);
//   const queryNorm = Math.sqrt(
//     queryEmbedding.reduce((sum, val) => sum + val ** 2, 0)
//   );

//   // Fetch all sales records (for large datasets, consider batching or indexing)
//   const salesData = await prisma.sales.findMany({
//     where: { embedding: { not: Prisma.JsonNull } },
//     orderBy: { invoice: "desc" },
//   });

//   // Calculate similarity for each sale record
//   const scoredSales = salesData
//     .map((sale) => {
//       const saleEmbedding = sale.embedding as number[];
//       const cosineScore = cosineSimilarityOptimized(
//         queryEmbedding,
//         queryNorm,
//         saleEmbedding
//       );
//       const keywordScore = userQuery.includes(sale.invoice) ? 1.5 : 1;
//       return {
//         text: `Invoice: ${sale.invoice}, Customer: ${
//           sale.customer
//         }, PurchaseDate: ${sale.purchaseDate.toISOString()}, ItemDescription: ${
//           sale.item
//         }, Quantity: ${sale.quantity}, PricePerUnit: ${sale.price}, Total: ${
//           sale.total
//         }, Payment: ${sale.paymentMethod}, CustomerAddress: ${
//           sale.address
//         }, Notes: ${sale.comment}, ${sale.remarks}`,
//         score: cosineScore * keywordScore,
//       };
//     })
//     .sort((a, b) => b.score - a.score) // Sort by highest similarity
//     .slice(0, 20); // Keep top 10 matches

//   //   console.log(scoredSales, "CHECK SCORE");

//   return scoredSales.map((sale) => sale.text).join("\n");
// }

export type ScoredSale = {
  id: string;
  score: number;
};

export async function retrieveRelevantSalesRecords(
  userQuery: string,
  threshold: number = 0.7
): Promise<ScoredSale[]> {
  const queryEmbedding = await generateEmbeddings(userQuery.toUpperCase());

  const queryEmbeddingString = `[${queryEmbedding.join(",")}]`;
  const maxDistance = threshold;

  const scoredSales = await prisma.$queryRaw<ScoredSale[]>`
      SELECT 
      v.id,
      (v.embedding <=> (${queryEmbeddingString}::vector(4096))) AS score
    FROM "Vector" v
    WHERE v.embedding IS NOT NULL
    AND (v.embedding <=> (${queryEmbeddingString}::vector(4096))) <= ${maxDistance}
    ORDER BY v.embedding <=> (${queryEmbeddingString}::vector(4096));
    `;

  return scoredSales;
}

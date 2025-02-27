import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { tool } from "ai";
import { z } from "zod";
import { generateEmbeddings } from "./message";

export async function indexSalesData() {
  const salesData = await prisma.sales.findMany();

  for (const sale of salesData) {
    const text = `Invoice: ${sale.invoice}, Customer: ${sale.customer}, 
      Date: ${sale.purchaseDate.toISOString()}, Item: ${sale.item}, 
      Quantity: ${sale.quantity}, Price: ${sale.price}, Total: ${sale.total}, 
      Payment: ${sale.paymentMethod}`;

    const embedding = await generateEmbeddings(text);

    await prisma.sales.update({
      where: { id: sale.id },
      data: { embedding },
    });
  }
}

function cosineSimilarity(a: number[], b: number[]): number {
  const dot = a.reduce((sum, val, i) => sum + val * b[i], 0);
  const normA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
  const normB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
  return dot / (normA * normB);
}

export async function retrieveRelevantSales(
  userQuery: string
): Promise<string> {
  if (
    userQuery.toLowerCase().includes("total sum") ||
    userQuery.toLowerCase().includes("total sales") ||
    userQuery.toLowerCase().includes("how much was sold")
  ) {
    const totalSales = await prisma.sales.aggregate({
      _sum: { total: true },
    });

    return `The total sum of all sales is RM ${
      totalSales._sum.total?.toFixed(2) || 0
    }.`;
  }

  const queryEmbedding = await generateEmbeddings(userQuery);

  // Fetch all sales records (for large datasets, consider batching or indexing)
  const salesData = await prisma.sales.findMany({
    where: { embedding: { not: Prisma.JsonNull } },
    orderBy: { invoice: "desc" },
  });

  // Calculate similarity for each sale record
  const scoredSales = salesData
    .map((sale) => ({
      text: `Invoice: ${sale.invoice}, Customer: ${
        sale.customer
      }, PurchaseDate: ${sale.purchaseDate.toISOString()}, ItemDescription: ${
        sale.item
      }, Quantity: ${sale.quantity}, PricePerUnit: ${sale.price}, Total: ${
        sale.total
      }, Payment: ${sale.paymentMethod}, CustomerAddress: ${
        sale.address
      }, Notes: ${sale.comment}, ${sale.remarks}`,
      score: cosineSimilarity(queryEmbedding, sale.embedding as number[]),
    }))
    .sort((a, b) => b.score - a.score) // Sort by highest similarity
    .slice(0, 10); // Keep top 10 matches

  return scoredSales.map((sale) => sale.text).join("\n");
}

// export async function getTotalSales() {
//   const totalSales = await prisma.sales.aggregate({
//     _sum: { total: true },
//   });

//   return `The total sum of all sales is RM ${
//     totalSales._sum.total?.toFixed(2) || 0
//   }.`;
// }

export const getTotalSales = tool({
  description:
    "Calculate total sales, optionally filtered by month, year, or payment method",
  parameters: z.object({
    month: z.number().optional(), // Month filter (1-12)
    year: z.number().optional(), // Year filter (e.g., 2024)
    paymentMethod: z.string().optional(), // Payment method filter (e.g., "Credit Card")
  }),
  execute: async ({ month, year, paymentMethod }) => {
    try {
      // Build Prisma query filters dynamically
      const filters: any = {};

      if (month && year) {
        // Filter by a specific month and year
        filters.purchaseDate = {
          gte: new Date(year, month - 1, 1), // Start of month
          lt: new Date(year, month, 1), // Start of next month
        };
      } else if (year) {
        // Filter by a specific year
        filters.purchaseDate = {
          gte: new Date(year, 0, 1),
          lt: new Date(year + 1, 0, 1),
        };
      }

      if (paymentMethod) {
        filters.paymentMethod = paymentMethod;
      }

      // Prisma aggregation query
      const totalSales = await prisma.sales.aggregate({
        _sum: { total: true },
        where: filters,
      });

      return `The total sales${
        month && year
          ? ` for ${month}/${year}`
          : year
          ? ` for ${year}`
          : paymentMethod
          ? ` for payment method '${paymentMethod}'`
          : ""
      } is RM ${totalSales._sum.total?.toFixed(2) || 0}.`;
    } catch (error) {
      console.error("Error fetching total sales:", error);
      return "Failed to retrieve total sales.";
    }
  },
});

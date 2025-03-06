import prisma from "@/lib/prisma";
import { generateUUID } from "@/lib/utils";
import { generateEmbeddings } from "@/services/message";
import { auth } from "@clerk/nextjs/server";
import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import Papa from "papaparse";

type CSVDataType = {
  "Co./Last Name": string;
  "Addr 1 - Line 1": string;
  "- Line 2"?: string;
  "- Line 3"?: string;
  "- Line 4"?: string;
  "Destination Country": string;
  "Invoice #": string;
  Date: string; // Will be converted to Date
  Quantity: string; // Will be converted to number
  Description: string;
  Price: string; // Will be converted to number
  Total: string; // Will be converted to number
  Comment?: string;
  "Journal Memo"?: string;
  "Payment Method": string;
};

type VectorData = {
  id: string;
  embedding: number[]; // Adjust type as needed for your data
};

const wait = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

export async function POST(request: Request) {
  const session = await auth();

  if (!session || !session.userId) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return new Response(JSON.stringify({ error: "No file uploaded" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const fileBuffer = await file.arrayBuffer();
    const fileContent = Buffer.from(fileBuffer).toString("utf-8");
    const fileName: string = file.name;

    // Parse CSV content using PapaParse
    const { data, errors } = Papa.parse<CSVDataType>(fileContent, {
      header: true,
      skipEmptyLines: "greedy",
      transformHeader: (header) => header.trim(),
      delimiter: ",",
      quoteChar: '"',
    });

    if (errors.length) {
      return new Response(JSON.stringify({ error: "Error parsing CSV" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const cleanData = data.filter((row) => {
      if (
        !(
          row["Co./Last Name"].includes("IDEAL TECH SERVICES") ||
          Number(row["Quantity"]) < 0
        )
      )
        return row;
    });

    const parseDate = (dateString: string): Date => {
      const parts = dateString.split("/");
      if (parts.length !== 3) {
        throw new Error("Invalid date format, expected DD/MM/YYYY or DD/MM/YY");
      }
      const [day, month, yearStr] = parts;
      const dayNum = parseInt(day, 10);
      const monthNum = parseInt(month, 10);
      // If the year part is 2 digits, assume it's in the 2000s.
      const yearNum =
        yearStr.length === 2
          ? parseInt(yearStr, 10) + 2000
          : parseInt(yearStr, 10);
      return new Date(Date.UTC(yearNum, monthNum - 1, dayNum));
    };

    const existingSales = await prisma.sales.findMany({
      select: { invoice: true, item: true, total: true },
    });

    const existingSalesSet = new Set(
      existingSales.map((sale) => `${sale.invoice}-${sale.item}-${sale.total}`)
    );

    const newCleanData = cleanData.filter((row) => {
      const invoice = row["Invoice #"].trim();
      const item = row["Description"]?.trim() || "Undefined";
      const total = parseFloat(
        row["Total"].replace(/^RM/, "").replace(/,/g, "").trim()
      );
      return !existingSalesSet.has(`${invoice}-${item}-${total}`);
    });

    const chunkArray = <T>(array: T[], chunkSize: number): T[][] => {
      const results: T[][] = [];
      for (let i = 0; i < array.length; i += chunkSize) {
        results.push(array.slice(i, i + chunkSize));
      }
      return results;
    };

    // console.log(invoices.filter((item) => item.invoice === "J0125143"));
    // console.log(invoices[0]);

    const totalRows = newCleanData.length;
    const chunkSize = 50;
    const chunks = chunkArray(newCleanData, chunkSize);
    let overallProgress = 0;

    const stream = new ReadableStream({
      async start(controller) {
        for (const chunk of chunks) {
          // Batch embed: generate embeddings concurrently for the chunk.
          const invoiceChunk: Prisma.SalesCreateManyInput[] = await Promise.all(
            chunk.map(async (row) => {
              const customer = row["Addr 1 - Line 1"].includes(
                row["Co./Last Name"]
              )
                ? row["Addr 1 - Line 1"].trim()
                : `${row["Addr 1 - Line 1"].trim()}, ${row[
                    "Co./Last Name"
                  ].trim()}`;
              const address = [
                row["- Line 2"]?.trim(),
                row["- Line 3"]?.trim(),
                row["- Line 4"]?.trim(),
                row["Destination Country"].trim(),
              ]
                .filter(Boolean)
                .join(", ");
              const addressSanitise = address === "" ? "Undefined" : address;
              const item = row["Description"]?.trim();
              const itemSanitise =
                item === "" ? "Undefined" : item.toUpperCase();
              const quantity = parseInt(row["Quantity"], 10);
              const price = parseFloat(
                row["Price"].replace(/^RM/, "").replace(/,/g, "").trim()
              );
              const total = parseFloat(
                row["Total"].replace(/^RM/, "").replace(/,/g, "").trim()
              );
              const text = `Invoice: ${row[
                "Invoice #"
              ].trim()}, Customer: ${customer}, PurchaseDate: ${parseDate(
                row["Date"]
              ).toISOString()}, ItemDescription: ${itemSanitise}, Quantity: ${quantity}, PricePerUnit: ${price}, Total: ${total}, Payment: ${row[
                "Payment Method"
              ]?.trim()}, CustomerAddress: ${addressSanitise}, Notes: ${
                row["Comment"]?.trim() || ""
              }, ${row["Journal Memo"]?.trim() || ""}`;
              const paymentMethod = row["Payment Method"]?.trim();
              const paymentMethodSanitise =
                paymentMethod === "" ? "Undefined" : paymentMethod;
              const embedding = (await generateEmbeddings(
                itemSanitise
              )) as Prisma.InputJsonValue;

              return {
                id: generateUUID(),
                customer,
                invoice: row["Invoice #"].trim(),
                purchaseDate: parseDate(row["Date"]),
                address: addressSanitise,
                item: itemSanitise,
                quantity,
                price,
                total,
                comment: row["Comment"]?.trim() || "",
                remarks: row["Journal Memo"]?.trim() || "",
                paymentMethod: paymentMethodSanitise,
                embedding,
                createdAt: new Date(),
                updatedAt: new Date(),
              };
            })
          );

          const vectorData: VectorData[] = invoiceChunk
            .filter((invoice) => invoice.id !== undefined)
            .map((invoice) => ({
              id: invoice.id || "",
              embedding: invoice.embedding as number[],
            }));

          overallProgress += chunk.length;
          const embeddingProgress =
            JSON.stringify({
              id: fileName,
              phase: "embedding",
              progress: overallProgress,
              total: totalRows,
            }) + "\n";
          controller.enqueue(new TextEncoder().encode(embeddingProgress));

          // Batch upload with retries
          let inserted = false;
          let retries = 0;
          const maxRetries = 5;
          while (!inserted) {
            try {
              await prisma.sales.createMany({ data: invoiceChunk });
              await insertVectors(vectorData);
              inserted = true;
              const insertionProgress =
                JSON.stringify({
                  id: fileName,
                  phase: "insertion",
                  progress: overallProgress,
                  total: totalRows,
                }) + "\n";
              controller.enqueue(new TextEncoder().encode(insertionProgress));
            } catch (error: any) {
              if (
                error instanceof Prisma.PrismaClientKnownRequestError &&
                error.code === "P1017"
              ) {
                retries++;
                console.error(`P1017 error, retry ${retries}/${maxRetries}`);
                if (retries >= maxRetries) {
                  const errorMessage =
                    JSON.stringify({
                      id: fileName,
                      phase: "error",
                      message: "Max retries reached during insertion",
                    }) + "\n";
                  controller.enqueue(new TextEncoder().encode(errorMessage));
                  controller.close();
                  return;
                }
                await prisma.$disconnect();
                await prisma.$connect();
                await wait(500);
              } else {
                console.error(`Error: ${error.message}`);
                const errorMessage =
                  JSON.stringify({
                    id: fileName,
                    phase: "error",
                    message: `${error.message}`,
                  }) + "\n";
                controller.enqueue(new TextEncoder().encode(errorMessage));
                controller.close();
                return;
              }
            }
          }
        }
        controller.close();
      },
    });

    return new Response(stream, {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to process request" },
      { status: 500 }
    );
  }
}

async function insertVectors(vectorData: VectorData[]): Promise<void> {
  const query = Prisma.sql`
    INSERT INTO "Vector" (id, embedding) VALUES
    ${Prisma.join(
      vectorData.map(
        (v) => Prisma.sql`(${v.id}, ${formatEmbedding(v.embedding)}::vector)`
      )
    )}
  `;
  await prisma.$executeRaw(query);
}

function formatEmbedding(embedding: number[]): string {
  return `[${embedding.join(",")}]`;
}

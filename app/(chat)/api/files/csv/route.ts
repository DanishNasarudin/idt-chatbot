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
          row["Co./Last Name"].includes("IDEAL TECH SERVICES SDN BHD") ||
          row["Quantity"] === "-1"
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

    const chunkArray = <T>(array: T[], chunkSize: number): T[][] => {
      const results: T[][] = [];
      for (let i = 0; i < array.length; i += chunkSize) {
        results.push(array.slice(i, i + chunkSize));
      }
      return results;
    };

    // console.log(invoices.filter((item) => item.invoice === "J0125143"));
    // console.log(invoices[0]);

    const stream = new ReadableStream({
      async start(controller) {
        const invoices: Prisma.SalesCreateManyInput[] = [];
        const totalEmbeddingCount = cleanData.length;

        // Embedding Phase: Process each row sequentially
        for (let i = 0; i < cleanData.length; i++) {
          const row = cleanData[i];
          const customer = row["Addr 1 - Line 1"].includes(row["Co./Last Name"])
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
          ).toISOString()}, ItemDescription: ${row[
            "Description"
          ]?.trim()}, Quantity: ${quantity}, PricePerUnit: ${price}, Total: ${total}, Payment: ${row[
            "Payment Method"
          ]?.trim()}, CustomerAddress: ${address}, Notes: ${
            row["Comment"]?.trim() || ""
          }, ${row["Journal Memo"]?.trim() || ""}`;

          const embedding = (await generateEmbeddings(
            text
          )) as Prisma.InputJsonValue;

          invoices.push({
            id: generateUUID(),
            customer,
            invoice: row["Invoice #"].trim(),
            purchaseDate: parseDate(row["Date"]),
            address,
            item: row["Description"]?.trim(),
            quantity,
            price,
            total,
            comment: row["Comment"]?.trim() || "",
            remarks: row["Journal Memo"]?.trim() || "",
            paymentMethod: row["Payment Method"]?.trim(),
            embedding,
            createdAt: new Date(),
            updatedAt: new Date(),
          });

          // Send embedding progress update
          const embeddingProgress =
            JSON.stringify({
              phase: "embedding",
              progress: i + 1,
              total: totalEmbeddingCount,
            }) + "\n";
          controller.enqueue(new TextEncoder().encode(embeddingProgress));
        }

        // Filter out rows already in the DB
        const newInvoices = invoices.filter(
          (row) =>
            !existingSalesSet.has(`${row.invoice}-${row.item}-${row.total}`)
        );

        const totalInsertionCount = newInvoices.length;
        if (totalInsertionCount === 0) {
          const insertionProgress =
            JSON.stringify({
              phase: "insertion",
              progress: totalInsertionCount,
              total: totalInsertionCount,
            }) + "\n";
          controller.enqueue(new TextEncoder().encode(insertionProgress));
          controller.close();
          return;
        }

        // Insertion Phase: Insert new invoices in chunks
        const chunkSize = 50;
        const chunks = chunkArray(newInvoices, chunkSize);
        let insertedCount = 0;
        for (const chunk of chunks) {
          let inserted = false;
          let retries = 0;
          const maxRetries = 5;
          while (!inserted) {
            try {
              await prisma.sales.createMany({ data: chunk });
              inserted = true;
              insertedCount += chunk.length;
              const insertionProgress =
                JSON.stringify({
                  phase: "insertion",
                  progress: insertedCount,
                  total: totalInsertionCount,
                }) + "\n";
              controller.enqueue(new TextEncoder().encode(insertionProgress));
            } catch (error: any) {
              if (
                error instanceof Prisma.PrismaClientKnownRequestError &&
                error.code === "P1017"
              ) {
                retries++;
                console.error(
                  `P1017 error encountered, retry ${retries}/${maxRetries}`
                );
                if (retries >= maxRetries) {
                  const errorMessage =
                    JSON.stringify({
                      phase: "error",
                      message: "Max retries reached during insertion",
                    }) + "\n";
                  controller.enqueue(new TextEncoder().encode(errorMessage));
                  controller.close();
                  return;
                }
                await prisma.$disconnect();
                await prisma.$connect();
                await wait(1000);
              } else {
                const errorMessage =
                  JSON.stringify({
                    phase: "error",
                    message: error.message || "Unknown error during insertion",
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

import prisma from "@/lib/prisma";
import { generateUUID } from "@/lib/utils";
import { auth } from "@clerk/nextjs/server";
import { Sales } from "@prisma/client";
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

export async function POST(request: Request) {
  const session = await auth();

  if (!session || !session.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    const fileBuffer = await file.arrayBuffer();
    const fileContent = Buffer.from(fileBuffer).toString("utf-8");

    // Parse CSV content using PapaParse
    const { data, errors } = Papa.parse<CSVDataType>(fileContent, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim(),
      delimiter: ",",
      quoteChar: '"',
    });

    if (errors.length) {
      return NextResponse.json({ error: "Error parsing CSV" }, { status: 400 });
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
      const [day, month, year] = dateString.split("/").map(Number);
      const date = new Date(Date.UTC(year, month - 1, day));
      return date;
    };

    const existingSales = await prisma.sales.findMany({
      select: { invoice: true, item: true, total: true },
    });

    const existingSalesSet = new Set(
      existingSales.map((sale) => `${sale.invoice}-${sale.item}-${sale.total}`)
    );

    const invoices: Sales[] = cleanData
      .map((row) => {
        const customer = row["Addr 1 - Line 1"].includes(row["Co./Last Name"])
          ? row["Addr 1 - Line 1"].trim()
          : [row["Addr 1 - Line 1"].trim(), row["Co./Last Name"].trim()].join(
              ", "
            );

        if (row["Invoice #"] === "J0125143") console.log(row);
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

        return {
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
          createdAt: new Date(),
          updatedAt: new Date(),
        };
      })
      .filter(
        (row) =>
          !existingSalesSet.has(`${row.invoice}-${row.item}-${row.total}`)
      );

    // console.log(invoices.filter((item) => item.invoice === "J0125143"));
    // console.log(invoices[0]);

    if (invoices.length > 0) {
      await prisma.sales.createMany({ data: invoices });
      return NextResponse.json(
        { message: "Data inserted successfully" },
        { status: 200 }
      );
    } else {
      return NextResponse.json(
        { message: "Data existed in the database" },
        { status: 200 }
      );
    }
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to process request" },
      { status: 500 }
    );
  }
}

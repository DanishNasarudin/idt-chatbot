import { auth } from "@clerk/nextjs/server";
import { promises as fs } from "fs";
import { NextResponse } from "next/server";
import path from "path";
import { z } from "zod";

// Use Blob instead of File since File is not available in Node.js environment
const FileSchema = z.object({
  file: z
    .instanceof(Blob)
    .refine((file) => file.size <= 5 * 1024 * 1024, {
      message: "File size should be less than 5MB",
    })
    // Update the file type based on the kind of files you want to accept
    .refine((file) => ["image/jpeg", "image/png"].includes(file.type), {
      message: "File type should be JPEG or PNG",
    }),
});

export async function POST(request: Request) {
  const session = await auth();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (request.body === null) {
    return new Response("Request body is empty", { status: 400 });
  }

  console.log("PASS 1");

  try {
    const formData = await request.formData();
    const file = formData.get("file") as Blob;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    const validatedFile = FileSchema.safeParse({ file });

    if (!validatedFile.success) {
      const errorMessage = validatedFile.error.errors
        .map((error) => error.message)
        .join(", ");

      return NextResponse.json({ error: errorMessage }, { status: 400 });
    }

    console.log("PASS 2");

    // Retrieve the filename from the File object in formData
    const fileInput = formData.get("file") as File;
    const filename = fileInput.name;

    // Define and create a temporary folder inside the public directory for accessible URL
    const tempFolder = path.join(process.cwd(), "public", "tmp");
    await fs.mkdir(tempFolder, { recursive: true });

    // Write the file buffer to the temp folder
    const fileBuffer = await file.arrayBuffer();
    const filePath = path.join(tempFolder, filename);
    await fs.writeFile(filePath, Buffer.from(fileBuffer));

    // Construct an accessible URL for the uploaded file
    const fileUrl = new URL(`/tmp/${filename}`, request.url).toString();

    return NextResponse.json({
      message: "File stored temporarily",
      url: fileUrl,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to process request" },
      { status: 500 }
    );
  }
}

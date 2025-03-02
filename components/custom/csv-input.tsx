"use client";
import { Attachment } from "ai";
import { ChangeEvent, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "../ui/button";
import { Input } from "../ui/input";

export default function CSVInput() {
  const [attachments, setAttachments] = useState<Array<Attachment>>([]);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadQueue, setUploadQueue] = useState<Array<string>>([]);

  const uploadFile = async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch("/api/files/csv", {
      method: "POST",
      body: formData,
    });

    if (!response.body) {
      throw new Error("No response body");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        const messages = chunk.split("\n").filter(Boolean);
        messages.forEach((message) => {
          try {
            const data = JSON.parse(message);
            if (data.phase === "embedding") {
              toast.loading(`Embedding: ${data.progress} of ${data.total}`, {
                id: "csv-upload",
              });
            } else if (data.phase === "insertion") {
              toast.loading(`Insertion: ${data.progress} of ${data.total}`, {
                id: "csv-upload",
              });
            } else if (data.phase === "error") {
              toast.error(`Error: ${data.message}`, { id: "csv-upload" });
              throw new Error(`Error: ${data.message}`);
            }
          } catch (err) {
            console.error("Error parsing progress message", err);
          }
        });
      }
    } catch (error) {
      console.error("Stream encountered an error:", error);
      toast.error("An error occurred while processing the stream.", {
        id: "csv-upload",
      });
    }
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    setSelectedFiles(files);
  };

  const handleSubmit = async () => {
    if (selectedFiles.length === 0) {
      toast.error("Please select files before submitting!");
      return;
    }

    setUploadQueue(selectedFiles.map((file) => file.name));
    toast.loading("Uploading files..", { id: "csv-upload" });

    try {
      const uploadPromises = selectedFiles.map((file) => uploadFile(file));
      const uploadedAttachments = await Promise.all(uploadPromises);
      const successfullyUploadedAttachments = uploadedAttachments.filter(
        (attachment) => attachment !== undefined
      );

      setAttachments((currentAttachments) => [
        ...currentAttachments,
        ...successfullyUploadedAttachments,
      ]);

      toast.success("Files uploaded successfully!", { id: "csv-upload" });
      setSelectedFiles([]);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (error) {
      console.error("Error uploading files!", error);
      toast.error("Error uploading files!", { id: "csv-upload" });
    } finally {
      setUploadQueue([]);
    }
  };

  return (
    <div className="grid w-full max-w-sm items-center gap-1.5">
      <Input
        id="csv"
        type="file"
        multiple
        onChange={handleFileChange}
        ref={fileInputRef}
      />
      <Button onClick={handleSubmit}>Submit</Button>
    </div>
  );
}

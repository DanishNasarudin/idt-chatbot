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

    const fileName = file.name;
    toast.loading("Uploading files..", { id: `csv-upload-${fileName}` });

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
        if (done) {
          toast.success(`Files (${fileName}) uploaded successfully!`, {
            id: `csv-upload-${fileName}`,
          });
          break;
        }
        const chunk = decoder.decode(value, { stream: true });
        const messages = chunk.split("\n").filter(Boolean);
        messages.forEach((message) => {
          try {
            const data = JSON.parse(message);
            if (data.phase === "embedding") {
              toast.loading(
                `Embedding (${data.id}): ${data.progress} of ${data.total}`,
                {
                  id: `csv-upload-${data.id}`,
                }
              );
            } else if (data.phase === "insertion") {
              toast.loading(
                `Insertion (${data.id}): ${data.progress} of ${data.total}`,
                {
                  id: `csv-upload-${data.id}`,
                }
              );
            } else if (data.phase === "error") {
              toast.error(`Error (${data.id}): ${data.message}`, {
                id: `csv-upload-${data.id}`,
              });
              throw new Error(`Error: ${data.message}`);
            }
          } catch (err) {
            toast.error(`Error: ${fileName}`, {
              id: `csv-upload-${fileName}`,
            });
            console.error("Error parsing progress message", err);
          }
        });
      }
    } catch (error) {
      console.error("Stream encountered an error:", error);
      toast.error("An error occurred while processing the stream.", {
        id: `csv-upload-${fileName}`,
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

      setSelectedFiles([]);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (error) {
      console.error("Error uploading files!", error);
      toast.error("Error uploading files!");
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

"use server";
import { myProvider } from "@/lib/models";
import prisma from "@/lib/prisma";
import { Message, Prisma, Vote } from "@prisma/client";
import { Message as AIMessage, embed, generateText } from "ai";

export async function saveMessages({
  messages,
}: {
  messages: Message[];
}): Promise<{ count: number }> {
  // console.log(messages, "DEB");
  try {
    await prisma.chat.update({
      where: {
        id: messages[0].chatId,
      },
      data: {
        updatedAt: new Date(),
      },
    });
    return await prisma.message.createMany({
      data: messages.map((msg) => ({
        ...msg,
        content:
          msg.content === null
            ? Prisma.JsonNull
            : (msg.content as Prisma.InputJsonValue),
        parts:
          msg.parts === null
            ? Prisma.JsonNull
            : (msg.parts as Prisma.InputJsonValue),
      })),
    });
  } catch (error) {
    console.error("Failed to save messages in database", error);
    throw error;
  }
}

export async function getMessagesByChatId({
  id,
}: {
  id: string;
}): Promise<Message[]> {
  try {
    return await prisma.message.findMany({
      where: { chatId: id },
      orderBy: { createdAt: "asc" },
    });
  } catch (error) {
    console.error("Failed to get messages by chat id from database", error);
    throw error;
  }
}

export async function voteMessage({
  chatId,
  messageId,
  type,
}: {
  chatId: string;
  messageId: string;
  type: "up" | "down";
}): Promise<Vote | { count: number }> {
  try {
    const existingVote = await prisma.vote.findFirst({
      where: { messageId },
    });
    if (existingVote) {
      return await prisma.vote.updateMany({
        where: { messageId, chatId },
        data: { isUpvoted: type === "up" },
      });
    }
    return await prisma.vote.create({
      data: {
        chatId,
        messageId,
        isUpvoted: type === "up",
      },
    });
  } catch (error) {
    console.error("Failed to upvote message in database", error);
    throw error;
  }
}

export async function getVotesByChatId({
  id,
}: {
  id: string;
}): Promise<Vote[]> {
  try {
    return await prisma.vote.findMany({
      where: { chatId: id },
    });
  } catch (error) {
    console.error("Failed to get votes by chat id from database", error);
    throw error;
  }
}

export async function getMessageById({
  id,
}: {
  id: string;
}): Promise<Message[]> {
  try {
    return await prisma.message.findMany({
      where: { id },
    });
  } catch (error) {
    console.error("Failed to get message by id from database");
    throw error;
  }
}

export async function deleteMessagesByChatIdAfterTimestamp({
  chatId,
  timestamp,
}: {
  chatId: string;
  timestamp: Date;
}): Promise<{ count: number } | void> {
  try {
    const messagesToDelete = await prisma.message.findMany({
      select: { id: true },
      where: {
        chatId,
        createdAt: { gte: timestamp },
      },
    });
    const messageIds = messagesToDelete.map((message) => message.id);
    if (messageIds.length > 0) {
      await prisma.vote.deleteMany({
        where: {
          chatId,
          messageId: { in: messageIds },
        },
      });
      return await prisma.message.deleteMany({
        where: {
          chatId,
          id: { in: messageIds },
        },
      });
    }
  } catch (error) {
    console.error(
      "Failed to delete messages by id after timestamp from database"
    );
    throw error;
  }
}

export async function generateTitleFromUserMessage({
  message,
}: {
  message: AIMessage;
}) {
  const { text: title } = await generateText({
    model: myProvider.languageModel("small-model"),
    system: `\n
      - you will generate a short title based on the first message a user begins a conversation with
      - ensure it is not more than 80 characters long
      - the title should be a summary of the user's message
      - do not use quotes or colons`,
    prompt: JSON.stringify(message),
  });

  return title;
}

export async function generateEmbeddings(text: string): Promise<number[]> {
  const { embedding } = await embed({
    model: myProvider.textEmbeddingModel("embedding-model"),
    value: text,
  });

  return embedding; // Returns an array of numbers
}

export async function classifyUserQuery(userQuery: string): Promise<string> {
  const { text } = await generateText({
    model: myProvider.languageModel("small-model"),
    system: `
      Your job is to classify user queries into one of the following categories:
      - "TOTAL_SALES" → If the user is asking for the total sum of sales (e.g., "What is the total sum of sales?", "How much was sold in June?", "Total sales")
      - "INVOICE_SEARCH" → If the user is asking about specific invoices (e.g., "Show Apple invoices", "Find all purchases made by John Doe")
      - "OTHER" → If the query does not fit the above categories.

      Respond with ONLY one of the categories: "TOTAL_SALES", "INVOICE_SEARCH", or "OTHER".
      DO NOT respond in any other way.
    `,
    prompt: userQuery,
  });

  return text.trim(); // Expected output: "TOTAL_SALES", "INVOICE_SEARCH", or "OTHER"
}

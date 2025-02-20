import prisma from "@/lib/prisma";
import { Message, Prisma, Vote } from "@prisma/client";

export async function saveMessages({
  messages,
}: {
  messages: Message[];
}): Promise<{ count: number }> {
  try {
    return await prisma.message.createMany({
      data: messages.map((msg) => ({
        ...msg,
        content:
          msg.content === null
            ? Prisma.JsonNull
            : (msg.content as Prisma.InputJsonValue),
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

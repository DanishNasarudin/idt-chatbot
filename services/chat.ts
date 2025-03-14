"use server";

import prisma from "@/lib/prisma";
import { Chat } from "@prisma/client";
import { cookies } from "next/headers";

export async function saveChat({
  id,
  userId,
  title,
}: {
  id: string;
  userId: string;
  title: string;
}): Promise<Chat> {
  try {
    const data = await prisma.chat.create({
      data: {
        id,
        createdAt: new Date(),
        userId,
        title,
      },
    });

    return data;
  } catch (error) {
    console.error("Failed to save chat in database");
    throw error;
  }
}

export async function updateChatTitleById({
  id,
  title,
}: {
  id: string;
  title: string;
}) {
  try {
    return await prisma.chat.update({
      where: {
        id,
      },
      data: {
        title,
      },
    });
  } catch (error) {
    console.error("Failed to update chat in database");
    throw error;
  }
}

export async function deleteChatById({ id }: { id: string }): Promise<Chat> {
  try {
    await prisma.vote.deleteMany({ where: { chatId: id } });
    await prisma.message.deleteMany({ where: { chatId: id } });
    return await prisma.chat.delete({ where: { id } });
  } catch (error) {
    console.error("Failed to delete chat by id from database");
    throw error;
  }
}

export async function getChatsByUserId({
  id,
}: {
  id: string;
}): Promise<Chat[]> {
  try {
    return await prisma.chat.findMany({
      where: { userId: id },
      orderBy: { updatedAt: "desc" },
    });
  } catch (error) {
    console.error("Failed to get chats by user from database");
    throw error;
  }
}

export async function getChatById({
  id,
}: {
  id: string;
}): Promise<Chat | null> {
  try {
    return await prisma.chat.findUnique({
      where: { id },
    });
  } catch (error) {
    console.error("Failed to get chat by id from database");
    throw error;
  }
}

export async function saveChatModelAsCookie(model: string) {
  const cookieStore = await cookies();
  cookieStore.set("chat-model", model);
}

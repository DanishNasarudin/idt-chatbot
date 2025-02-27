import {
  UIMessage,
  createDataStreamResponse,
  smoothStream,
  streamText,
} from "ai";

import { myProvider, regularPrompt } from "@/lib/models";
import {
  generateUUID,
  getMostRecentUserMessage,
  sanitizeResponseMessages,
} from "@/lib/utils";

import prisma from "@/lib/prisma";
import { deleteChatById, getChatById, saveChat } from "@/services/chat";
import {
  classifyUserQuery,
  generateTitleFromUserMessage,
  saveMessages,
} from "@/services/message";
import { retrieveRelevantSales } from "@/services/sales";
import { auth } from "@clerk/nextjs/server";
import { Sales } from "@prisma/client";

export const maxDuration = 60;

export async function POST(request: Request) {
  const {
    id,
    messages,
    selectedChatModel,
  }: {
    id: string;
    messages: Array<UIMessage>;
    selectedChatModel: string;
  } = await request.json();

  const session = await auth();

  if (!session || !session.userId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const userMessage = getMostRecentUserMessage(messages);

  if (!userMessage) {
    return new Response("No user message found", { status: 400 });
  }

  const chat = await getChatById({ id });

  if (!chat) {
    const title = await generateTitleFromUserMessage({ message: userMessage });
    await saveChat({ id, userId: session.userId, title });
  }

  await saveMessages({
    messages: [
      {
        id: userMessage.id,
        role: userMessage.role,
        content: userMessage.content,
        parts: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        chatId: id,
      },
    ],
  });

  const queryType = await classifyUserQuery(userMessage.content);

  let relevantSalesData = "";

  if (queryType === "TOTAL_SALES") {
    const totalSales = await prisma.sales.aggregate({
      _sum: { total: true },
    });
    relevantSalesData = `The total sum of all sales is RM ${
      totalSales._sum.total?.toFixed(2) || 0
    }.`;
  } else if (queryType === "INVOICE_SEARCH" || queryType === "OTHER") {
    relevantSalesData = await retrieveRelevantSales(userMessage.content);
  }

  // const salesData = await prisma.sales.findMany({
  //   orderBy: { invoice: "desc" },
  // });
  // const formattedSales = formatSalesData(salesData.slice(50));
  // const relevantSalesData = await retrieveRelevantSales(userMessage.content);

  console.log(relevantSalesData, queryType, "CHECK SALES");

  const updatedPrompt = `
    ${relevantSalesData || "No sales data available"}
    Above is the sales data for context.

    ${regularPrompt}
    `;

  return createDataStreamResponse({
    execute: (dataStream) => {
      const result = streamText({
        model: myProvider.languageModel(selectedChatModel),
        system: updatedPrompt,
        messages,
        maxSteps: 5,
        experimental_transform: smoothStream({ chunking: "word" }),
        experimental_generateMessageId: generateUUID,
        onFinish: async ({ response, reasoning }) => {
          if (session.userId) {
            try {
              const sanitizedResponseMessages = sanitizeResponseMessages({
                messages: response.messages,
                reasoning,
              });

              await saveMessages({
                messages: sanitizedResponseMessages.map((message) => {
                  let extractedReasoning = "";
                  if (Array.isArray(message.content)) {
                    const reasoningPart = message.content.find(isReasoningPart);
                    if (reasoningPart) {
                      extractedReasoning = reasoningPart.reasoning;
                    }
                  }

                  return {
                    id: message.id,
                    chatId: id,
                    role: message.role,
                    content: message.content as any,
                    parts: [
                      { type: "reasoning", reasoning: extractedReasoning },
                    ],
                    createdAt: new Date(),
                    updatedAt: new Date(),
                  };
                }),
              });
            } catch (error) {
              console.error("Failed to save chat");
            }
          }
        },
        experimental_telemetry: {
          isEnabled: true,
          functionId: "stream-text",
        },
      });

      result.mergeIntoDataStream(dataStream, {
        sendReasoning: true,
      });
    },
    onError: (error) => {
      console.error(error);
      return "Oops, an error occured!";
    },
  });
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return new Response("Not Found", { status: 404 });
  }

  const session = await auth();

  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const chat = await getChatById({ id });

    if (chat?.userId !== session.userId) {
      return new Response("Unauthorized", { status: 401 });
    }

    await deleteChatById({ id });

    return new Response("Chat deleted", { status: 200 });
  } catch (error) {
    return new Response("An error occurred while processing your request", {
      status: 500,
    });
  }
}

function formatSalesData(sales: Sales[]) {
  return sales
    .map(
      (sale) =>
        `Invoice: ${sale.invoice}, Customer: ${sale.customer}, PurchaseDate: ${sale.purchaseDate}, ItemDescription: ${sale.item}, Quantity: ${sale.quantity}, PricePerUnit: ${sale.price}, Total: ${sale.total}, Payment: ${sale.paymentMethod}, CustomerAddress: ${sale.address}, Notes: ${sale.comment}, ${sale.remarks}`
    )
    .join("\n");
}

function isReasoningPart(
  part: any
): part is { type: "reasoning"; reasoning: string } {
  return part.type === "reasoning" && typeof part.reasoning === "string";
}

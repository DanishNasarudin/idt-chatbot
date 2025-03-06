import {
  createDataStreamResponse,
  generateText,
  InvalidToolArgumentsError,
  NoSuchToolError,
  smoothStream,
  streamText,
  ToolCallRepairError,
  ToolExecutionError,
  UIMessage,
} from "ai";
import {
  ZodDiscriminatedUnion,
  ZodEnum,
  ZodNativeEnum,
  ZodNumber,
  ZodObject,
  ZodString,
  ZodType,
} from "zod";

import { myProvider, regularPrompt } from "@/lib/models";
import {
  generateUUID,
  getMostRecentUserMessage,
  sanitizeResponseMessages,
} from "@/lib/utils";

import { deleteChatById, getChatById, saveChat } from "@/services/chat";
import { generateTitleFromUserMessage, saveMessages } from "@/services/message";
// import { retrieveRelevantSales } from "@/services/sales";
import { toolsMapping } from "@/services/tools";
import { auth } from "@clerk/nextjs/server";
import { Sales } from "@prisma-db-1/client";

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
    await saveChat({ id, userId: session.userId.trim(), title });
  }

  // console.log(userMessage, messages);

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

  // const queryType = await classifyUserQuery(userMessage.content);

  let relevantSalesData = "";
  if (
    selectedChatModel === "deepseek-r1:70b" ||
    selectedChatModel === "deepseek-r1:7b"
  ) {
    // relevantSalesData = await retrieveRelevantSales(userMessage.content);
    relevantSalesData = "";
  }

  // const salesData = await prisma.sales.findMany({
  //   orderBy: { invoice: "desc" },
  // });
  // const formattedSales = formatSalesData(salesData);

  const updatedPrompt = `
  ${userMessage.content}

  Below is the sales data for context:
  ${relevantSalesData || "No sales data available"}
  `;

  const contextMessage: UIMessage = {
    id: generateUUID(),
    role: "user",
    content: `### SALES DATA START
${relevantSalesData || "No sales data available"}
### SALES DATA END

INSTRUCTIONS: For any sales query, ONLY use the above data. Do NOT hallucinate or generate mock data.
Ensure invoice numbers, customer names, and all details exactly match the provided sales data.`,
    parts: [],
    createdAt: new Date(),
  };

  const sanitizeMessages = messages.map((message) => ({
    ...message,
    role: (message.role as any) === "tool" ? "assistant" : message.role,
  }));

  const messagesWithContext: UIMessage[] =
    selectedChatModel === "deepseek-r1:70b" ||
    selectedChatModel === "deepseek-r1:7b"
      ? [contextMessage, ...sanitizeMessages]
      : sanitizeMessages;

  const systemPrompt = (chatModel?: string) => {
    if (chatModel === "deepseek-r1:70b" || chatModel === "deepseek-r1:7b") {
      return `
    You are a friendly assistant named IdealAgent! Keep your responses concise and helpful.

    ### SALES DATA CONTEXT:
    - You have access to a structured dataset containing sales transactions.
    - The dataset includes details such as:
      - **Invoice Number** - Unique identifier for each transaction.
      - **Customer Name** - Name of the buyer.
      - **Purchase Date** - The date the transaction occurred.
      - **Address** - Customer's location details.
      - **Item Description** - The product or service purchased.
      - **Quantity** - Number of units bought.
      - **Price per Unit** - The cost of a single unit.
      - **Total Amount** - Total cost of the transaction.
      - **Payment Method** - The method used for payment (e.g., Credit Card, Cash).
      - **Additional Notes** - Any comments or remarks related to the sale.
    - The dataset is a list of purchased items with their respective details such as invoice. So expect the invoice to have duplicates.
    - The **Total Amount** can be 0 at some point, this indicate that the item was sold for free.
    - Each row is unique by combination of Invoice and Item Description.

    ### SALES DATA CONTENT:
    ${relevantSalesData || "No sales data available"}

    INSTRUCTIONS: For any sales query, ONLY use the above data. Do NOT hallucinate or generate mock data.
    Ensure invoice numbers, customer names, and all details exactly match the provided sales data.
    `;
    } else {
      return `${regularPrompt}`;
    }
  };

  // console.log(
  //   relevantSalesData,
  //   systemPrompt(),
  //   selectedChatModel,
  //   "CHECK SALES"
  // );

  // console.log(messagesWithContext, "CHECK MESSAGE");
  console.log(selectedChatModel, "CHAT MODEL");

  const experimentalActiveTools =
    selectedChatModel === "deepseek-r1:70b" ||
    selectedChatModel === "deepseek-r1:7b"
      ? []
      : Object.keys(toolsMapping);

  return createDataStreamResponse({
    execute: (dataStream) => {
      const result = streamText({
        model: myProvider.languageModel(selectedChatModel),
        system: systemPrompt(selectedChatModel),
        messages: messagesWithContext,
        maxSteps: 5,
        experimental_activeTools: experimentalActiveTools,
        tools: toolsMapping,
        experimental_repairToolCall: async ({
          toolCall,
          tools,
          error,
          messages,
          system,
          parameterSchema,
        }) => {
          if (NoSuchToolError.isInstance(error)) {
            return null;
          }

          const tool = tools[toolCall.toolName as keyof typeof tools];
          const expectedArgs = getExampleArgs(tool.parameters);

          console.log(tool.parameters, "PARAMETERS");
          console.log(toolCall.args, "ORI ARG");
          console.log(expectedArgs, "EXPECTEDD");
          console.log(JSON.stringify(parameterSchema(toolCall)), "SCHEMA ARG2");

          const { text: repairedArgs } = await generateText({
            model: myProvider.languageModel("small-model"),
            // schema: tool.parameters,
            system: `\n
            - you will fix the arguments format
            - you will respond only with the corrected argument
            - do not include explanation
            - do not include json word`,
            prompt: [
              `The model tried to call the tool "${toolCall.toolName}"` +
                ` with the following initial arguments:`,
              JSON.stringify(toolCall.args),
              `The tool accepts the following schema example:`,
              JSON.stringify(expectedArgs),
              `Please fix the arguments. Include the initial argument "value" value, do not include the "type" or "value" keys.`,
            ].join("\n"),
          });

          const flattenToolArgs = (obj: any): any => {
            if (typeof obj !== "object" || obj === null) return obj;
            if ("value" in obj && Object.keys(obj).length === 1)
              return obj.value;
            if (Array.isArray(obj)) return obj.map(flattenToolArgs);
            const newObj: Record<string, any> = {};
            for (const key in obj) {
              newObj[key] = flattenToolArgs(obj[key]);
            }
            return newObj;
          };

          const cleanedRepairedArgs = flattenToolArgs(repairedArgs);
          console.log(cleanedRepairedArgs, "CLEANED REPAIRED RESULT");
          console.log(
            JSON.stringify(cleanedRepairedArgs),
            "CLEANED REPAIRED RESULT"
          );

          return { ...toolCall, args: cleanedRepairedArgs };
        },
        experimental_transform: smoothStream({ chunking: "word" }),
        experimental_generateMessageId: generateUUID,
        onFinish: async ({ response, reasoning }) => {
          if (session.userId.trim()) {
            try {
              console.log(
                response,
                response.messages[0].content,
                response.messages[1],
                response.messages[2],
                "CHECK ALLL"
              );
              const sanitizedResponseMessages = sanitizeResponseMessages({
                messages: response.messages,
                reasoning,
              });

              await saveMessages({
                messages: sanitizedResponseMessages.map((message) => {
                  let extractedReasoning = "";

                  // console.log(message.content, "CHECK SANTI");

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
                    parts:
                      extractedReasoning === ""
                        ? []
                        : [
                            {
                              type: "reasoning",
                              reasoning: extractedReasoning,
                            },
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
      if (NoSuchToolError.isInstance(error)) {
        // handle the no such tool error
        return `No such tool exist!`;
      } else if (InvalidToolArgumentsError.isInstance(error)) {
        // handle the invalid tool arguments error
        return `Tool Arguments Invalid!`;
      } else if (ToolExecutionError.isInstance(error)) {
        // handle the tool execution error
        return `Tool Execution Failed!`;
      } else if (ToolCallRepairError.isInstance(error)) {
        return `Tool Repair Failed!`;
      } else {
        return "Oops, an error occured!";
      }
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

    if (chat?.userId.trim() !== session.userId!.trim()) {
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

function getExampleArgs<T extends ZodType<any, any, any>>(
  schema: T
): Record<string, any> | any {
  if (schema instanceof ZodObject) {
    const example: Record<string, any> = {};
    const shape = schema.shape;
    for (const key in shape) {
      const fieldSchema = shape[key];
      if (fieldSchema instanceof ZodEnum) {
        // For ZodEnum, return all options for 'sortBy', otherwise the first option.
        example[key] = fieldSchema._def.values;
      } else if (fieldSchema instanceof ZodNativeEnum) {
        example[key] = Object.values(fieldSchema.enum);
      } else if (
        fieldSchema instanceof ZodObject ||
        fieldSchema instanceof ZodDiscriminatedUnion
      ) {
        example[key] = getExampleArgs(fieldSchema);
      } else if (fieldSchema instanceof ZodString) {
        example[key] = "example";
      } else if (fieldSchema instanceof ZodNumber) {
        example[key] = 0;
      } else {
        example[key] = null;
      }
    }
    return example;
  } else if (schema instanceof ZodDiscriminatedUnion) {
    const [firstOption] = schema.options;
    return getExampleArgs(firstOption);
  } else if (schema instanceof ZodEnum) {
    return schema._def.values;
  } else if (schema instanceof ZodNativeEnum) {
    return Object.values(schema.enum);
  }
  throw new Error("Unsupported schema type");
}

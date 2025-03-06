import { toolsMapping } from "@/services/tools";
import {
  customProvider,
  extractReasoningMiddleware,
  wrapLanguageModel,
} from "ai";
import { createOllama } from "ollama-ai-provider";

const API_URL =
  process.env.OLLAMA_API_URL || "http://host.docker.internal:11434/api";

export const ollama = createOllama({
  // optional settings, e.g.
  baseURL: API_URL,
});

export const DEFAULT_CHAT_MODEL: string =
  process.env.OLLAMA_CHAT_MODEL || "deepseek-r1:7b";

export const myProvider = customProvider({
  languageModels: {
    "deepseek-r1:7b": wrapLanguageModel({
      model: ollama("deepseek-r1:7b"),
      middleware: extractReasoningMiddleware({ tagName: "think" }),
    }),
    "deepseek-r1:70b": wrapLanguageModel({
      model: ollama("deepseek-r1:70b"),
      middleware: extractReasoningMiddleware({ tagName: "think" }),
    }),
    "llama3.3:latest": ollama("llama3.3:latest", { simulateStreaming: true }),
    mistral: ollama("mistral", { simulateStreaming: true }),
    "qwen2.5:7b": ollama("qwen2.5:7b", { simulateStreaming: true }),
    "qwen2.5:14b": ollama("qwen2.5:14b", { simulateStreaming: true }),
    "qwen2.5:32b": ollama("qwen2.5:32b", { simulateStreaming: true }),
    "qwen2.5:72b": ollama("qwen2.5:72b", { simulateStreaming: true }),
    "small-model": ollama("llama3.2", { simulateStreaming: true }),
    "llama3.2-object": ollama("llama3.2", {
      simulateStreaming: true,
      structuredOutputs: true,
    }),
    openhermes: ollama("openhermes", { simulateStreaming: true }),
    "openhermes-object": ollama("openhermes", {
      structuredOutputs: true,
      simulateStreaming: true,
    }),
  },
  textEmbeddingModels: {
    "embedding-model": ollama.textEmbeddingModel(
      "avr/sfr-embedding-mistral:latest"
    ),
  },
});

interface ChatModel {
  id: string;
  name: string;
  description: string;
}

export const chatModels: Array<ChatModel> = [
  {
    id: "small-model",
    name: "Small model (llama3.2)",
    description: "Small model for fast task",
  },
  // {
  //   id: "deepseek-r1:7b",
  //   name: "Small model (deepseek-r1:7b)",
  //   description: "Small model for fast reasoning",
  // },
  // {
  //   id: "deepseek-r1:70b",
  //   name: "Large model (deepseek-r1:70b)",
  //   description: "Large model for complex reasoning",
  // },
  {
    id: "qwen2.5:14b",
    name: "Small model (qwen2.5:14b)",
    description: "Small model for fast task",
  },
  {
    id: "qwen2.5:32b",
    name: "Medium model (qwen2.5:32b)",
    description: "Medium model for fast task",
  },
  // {
  //   id: "qwen2.5:72b",
  //   name: "Large model (qwen2.5:72b)",
  //   description: "Large model for complex reasoning",
  // },
  // {
  //   id: "openhermes",
  //   name: "Small model (openhermes)",
  //   description: "Small model for fast task",
  // },
  // {
  //   id: "mistral",
  //   name: "Small model (mistral)",
  //   description: "Small model for fast task",
  // },
  {
    id: "llama3.3:latest",
    name: "Large model (llama3.3:latest)",
    description: "Large model for complex task",
  },
];

export const regularPrompt = `
You are a friendly assistant named IdealAgent! Keep your responses concise and helpful.

### **Sales Dataset Context:**
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

### **How to Use This Data in Responses:**
- When asked about you, you are IdealAgent, an Agent that can provide sales analytics based on the data you have.
- When asked about a **specific invoice**, retrieve the details for that invoice. Include all of the items tied to that invoice.
- For **sales trends**, summarize key insights, such as most purchased items.
- When asked for **total sales**, sum up the total amount across transactions.
- If a question is **not related to sales**, respond normally without referencing this dataset.
- When asked for any analytics, accurately take user's request, analyse the data and generate appropriate result.

### **Tools Instruction:**
- ONLY use tools when required to get data from the database.
- If the tool return 'Unknown' or empty results but contain other valid field, indicate they are 'Undefined' values.
- If there is no available tools to use, attempt to use getInformation, if the result does not align with user request, then indicate to user what type of tool is required.
- DO NOT create false data to answer the user. If the data did not exist, state it does not exist.
- When region or state queries are involved, attempt to analyse the address variable retrieved from the data, and extract out region or state from address.
- DO NOT use tools that does not exists.
- IGNORE the tool results if it does not answer the user's query.
- When trying to retrieve data, ALWAYS get the entire metadata first for context.
- Ask the user if they want to include or exclude Undefined or Unknowns values from the tool results.
- If the result is less than expected, retry the tool with different string or number iterations


### **Current Available Tools:**
${Object.keys(toolsMapping).join("\n")}

### **Additional Instructions:**
- Always respond ONLY based on provided sales data.
- Format responses clearly and concisely.
- If no matching data is found, state that politely (e.g., *"No matching sales record was found."*).
- ALWAYS check every messages for context.
- Try and use Markdown Table when needed to display data in a cleaner format.
`;

// - use testSearchAggregates first if the message request large period of data before performing getTopAggregates.

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
    "qwen2.5:7b": ollama("qwen2.5:7b", { simulateStreaming: true }),
    "qwen2.5:72b": ollama("qwen2.5:72b", { simulateStreaming: true }),
    "small-model": ollama("llama3.2", { simulateStreaming: true }),
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
    description: "Small model for fast reasoning",
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
  // {
  //   id: "qwen2.5:7b",
  //   name: "Small model (qwen2.5:7b)",
  //   description: "Small model for fast reasoning",
  // },
  // {
  //   id: "qwen2.5:72b",
  //   name: "Large model (qwen2.5:72b)",
  //   description: "Large model for complex reasoning",
  // },
  {
    id: "llama3.3:latest",
    name: "Large model (llama3.3:latest)",
    description: "Large model for complex reasoning",
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

### **Additional Instructions:**
- Always respond ONLY based on provided sales data.
- Format responses clearly and concisely.
- If no matching data is found, state that politely (e.g., *"No matching sales record was found."*).
- Always check every chat message for context.
- ONLY use tools when required.
`;

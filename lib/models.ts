import { customProvider } from "ai";
import { createOllama } from "ollama-ai-provider";

const ollama = createOllama({
  // optional settings, e.g.
  baseURL: "http://localhost:11434/api",
});

export const DEFAULT_CHAT_MODEL: string = "chat-model-small";

export const myProvider = customProvider({
  languageModels: {
    "chat-model": ollama("llama3.2"),
  },
});

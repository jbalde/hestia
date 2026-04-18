export interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LLMRequest {
  model: string;
  messages: LLMMessage[];
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
}

export interface LLMResponse {
  id: string;
  model: string;
  choices: Array<{
    message: LLMMessage;
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  userId: string;
  createdAt: Date;
}

export interface Conversation {
  id: string;
  userId: string;
  title?: string;
  messages: ChatMessage[];
  createdAt: Date;
  updatedAt: Date;
}

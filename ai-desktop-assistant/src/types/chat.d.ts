declare global {
  interface ChatMessage {
    id: string;
    content: string;
    isUser: boolean;
    timestamp: Date;
  }

  interface KnowledgeLibrary {
    id: string;
    name: string;
    documents: string[];
  }
}
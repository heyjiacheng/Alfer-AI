import {
  createContext,
  useContext,
  useState,
  ReactNode,
  useMemo,
  useEffect,
} from "react";
import { queryApi, conversationApi } from "../services/api";

export interface ChatMessage {
  id: string;
  content: string;
  isUser: boolean;
  timestamp: Date;
  sources?: Array<{
    document_name: string;
    content_preview: string;
    content?: string;
    page?: number;
    relevance_score?: number;
    metadata?: any;
  }>;
}

interface UploadedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  uploadTime: Date;
}

interface Conversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  files: UploadedFile[];
  createdAt: Date;
  messageCount: number;
}

export interface ChatContextType {
  conversations: Conversation[];
  activeConversation: Conversation | null;
  isLoading: boolean;
  createNewConversation: () => void;
  switchConversation: (conversationId: string | null) => void;
  sendMessage: (
    content: string,
    selectedLibraries: string[],
    useDirect: boolean,
    knowledgeBaseIds?: string[]
  ) => Promise<void>;
  addFiles: (files: UploadedFile[]) => void;
  removeFile: (fileId: string) => void;
  deleteConversation: (id: string) => void;
  updateConversationTitle: (id: string, newTitle: string) => void;
  selectedModel: string;
  setSelectedModel: (model: string) => void;
  selectedLibrary: string;
  setSelectedLibrary: (libraryId: string) => void;
  editMessage: (messageId: string, newContent: string) => Promise<void>;
}

const ChatContext = createContext<ChatContextType>(null!);

// 使用常量函数来确保热更新时引用稳定
export const useChat = () => useContext(ChatContext);

export function ChatProvider({ children }: Readonly<{ children: ReactNode }>) {
  // 使用 localStorage 初始化模型选择
  const [selectedModel, setSelectedModel] = useState(() => {
    const savedModel = localStorage.getItem("selectedAIModel");
    return savedModel || "gpt-4";
  });
  
  // 使用 localStorage 初始化知识库择
  const [selectedLibrary, setSelectedLibraryState] = useState<string>(() => {
    const savedLibrary = localStorage.getItem('selectedLibrary');
    return savedLibrary || '';
  });

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversation, setActiveConversation] =
    useState<Conversation | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // 当模型选择改变时保存到 localStorage
  useEffect(() => {
    localStorage.setItem("selectedAIModel", selectedModel);
  }, [selectedModel]);

  // 当知识库选择改变时保存到 localStorage
  useEffect(() => {
    localStorage.setItem("selectedLibrary", selectedLibrary || '');
    console.log("知识库选择已更新:", selectedLibrary);
  }, [selectedLibrary]);

  // 加载现有对话
  useEffect(() => {
    const loadConversations = async () => {
      try {
        setIsLoading(true);
        const conversationsData = await conversationApi.getAll();

        // 将后端数据转换为前端需要的格式
        const formattedConversations: Conversation[] = conversationsData.map(
          (conv: any) => ({
            id: conv.id.toString(),
            title: conv.title,
            messages: [], // 初始不加载消息内容，但预填充消息数量占位
            messageCount: conv.message_count || 0, // 新增: 存储消息数量
            files: [], // 这里也应该从后端加载文件，但需要有相应的API
            createdAt: new Date(conv.created_at),
          })
        );

        setConversations(formattedConversations);
      } catch (error) {
        console.error("Failed to load conversations:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadConversations();
  }, []);

  // 当切换对话时，加载对话的消息
  const loadConversationMessages = async (conversationId: string) => {
    try {
      setIsLoading(true);
      const conversationDetail = await conversationApi.get(conversationId);

      if (!conversationDetail) return;
      
      console.log("加载对话消息:", conversationDetail);

      // 将消息转换为前端格式，使用后端提供的唯一ID防止重复
      const messages: ChatMessage[] = conversationDetail.messages.map(
        (msg: any) => {
          let parsedSources = undefined;
          if (msg.sources) {
            try {
              // 如果已经是对象，不需要再次解析
              if (typeof msg.sources === 'object' && !Array.isArray(msg.sources) && msg.sources !== null) {
                parsedSources = msg.sources;
                console.log("源信息已经是对象:", parsedSources);
              } else if (typeof msg.sources === 'string') {
                parsedSources = JSON.parse(msg.sources);
                console.log("成功解析源信息字符串:", parsedSources);
              } else if (Array.isArray(msg.sources)) {
                parsedSources = msg.sources;
                console.log("源信息已经是数组:", parsedSources);
              }
            } catch (e) {
              console.error("解析源信息时出错:", e, "原始数据:", msg.sources);
              // 尝试更宽松的解析方式
              try {
                // 如果是JSON字符串但格式不规范
                if (typeof msg.sources === 'string') {
                  // 移除可能导致问题的特殊字符
                  const cleanedJson = msg.sources
                    .replace(/[\u0000-\u001F]+/g, '')
                    .replace(/\\'/g, "'")
                    .replace(/\\"/g, '"');
                  
                  if (cleanedJson.trim()) {
                    parsedSources = JSON.parse(cleanedJson);
                    console.log("通过清理后成功解析源信息", parsedSources);
                  }
                }
              } catch (cleanError) {
                console.error("尝试清理后解析仍然失败:", cleanError);
              }
            }
          }
          
          return {
            id: msg.id.toString(),
            content: msg.content,
            isUser: msg.message_type === "user",
            timestamp: new Date(msg.created_at),
            sources: parsedSources
          };
        }
      );

      // 检查并过滤掉重复的消息 (基于后端ID和内容的组合)
      const uniqueMessages = messages.reduce((acc: ChatMessage[], current) => {
        const isDuplicate = acc.some(
          (item) => 
            item.content === current.content && 
            item.isUser === current.isUser && 
            // 如果相邻消息类型相同且内容相同，则认为可能是重复的
            acc.findIndex(x => x.content === current.content && x.isUser === current.isUser) === 
            acc.length - 1
        );
        if (!isDuplicate) {
          acc.push(current);
        }
        return acc;
      }, []);

      // 加载该对话的文件信息（从localStorage）
      const savedFiles = JSON.parse(
        localStorage.getItem("conversationFiles") || "{}"
      );
      const files = savedFiles[conversationId] || [];

      // 更新当前对话的消息和文件
      const conversation = conversations.find((c) => c.id === conversationId);
      if (conversation) {
        const updatedConversation = {
          ...conversation,
          messages: uniqueMessages,
          files,
          messageCount: uniqueMessages.length, // 更新消息计数
        };

        setActiveConversation(updatedConversation);
        setConversations((prev) =>
          prev.map((c) => (c.id === conversationId ? updatedConversation : c))
        );
      }
    } catch (error) {
      console.error(
        `Failed to load messages for conversation ${conversationId}:`,
        error
      );
    } finally {
      setIsLoading(false);
    }
  };

  // 创建新对话
  const createNewConversation = async () => {
    try {
      setIsLoading(true);
      const response = await conversationApi.create({
        title: "new conversation",
      });

      if (!response || !response.conversation_id) {
        throw new Error("Failed to create conversation: Invalid response");
      }

      const newConversation: Conversation = {
        id: response.conversation_id.toString(),
        title: "new conversation",
        messages: [],
        files: [],
        messageCount: 0,
        createdAt: new Date(),
      };

      setConversations((prev) => [newConversation, ...prev]);
      setActiveConversation(newConversation);
    } catch (error) {
      console.error("Failed to create conversation:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // 切换对话
  const switchConversation = async (conversationId: string | null) => {
    if (!conversationId) {
      setActiveConversation(null);
      return;
    }

    try {
      setIsLoading(true);
      console.log(`切换到对话: ${conversationId}`);
      
      // 总是从后端重新加载消息，确保最新状态
      await loadConversationMessages(conversationId);
      
      console.log(`成功加载对话 ${conversationId} 的消息`);
    } catch (error) {
      console.error(`Failed to switch to conversation ${conversationId}:`, error);
      setActiveConversation(null);
    } finally {
      setIsLoading(false);
    }
  };

  // 修改添加文件的方法，将文件保存到后端
  const addFiles = async (newFiles: UploadedFile[]) => {
    if (!activeConversation) return;

    try {
      setIsLoading(true);

      // 更新本地状态
      const updatedConversation = {
        ...activeConversation,
        files: [...activeConversation.files, ...newFiles],
      };

      setActiveConversation(updatedConversation);
      setConversations((prev) =>
        prev.map((c) =>
          c.id === activeConversation.id ? updatedConversation : c
        )
      );

      // 将文件信息保存到后端
      // 注意：这里需要后端有相应的API支持
      // 如果没有，我们可以暂时使用localStorage作为临时解决方案

      // 临时解决方案：使用localStorage保存文件信息
      const savedFiles = JSON.parse(
        localStorage.getItem("conversationFiles") || "{}"
      );
      savedFiles[activeConversation.id] = updatedConversation.files;
      localStorage.setItem("conversationFiles", JSON.stringify(savedFiles));

      // 理想情况下，这里应该调用后端API保存文件信息
      // 例如: await fileApi.saveToConversation(activeConversation.id, newFiles);
    } catch (error) {
      console.error("Failed to save files:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // 同样修改removeFile方法
  const removeFile = async (fileId: string) => {
    if (!activeConversation) return;

    try {
      setIsLoading(true);

      const updatedConversation = {
        ...activeConversation,
        files: activeConversation.files.filter((f) => f.id !== fileId),
      };

      setActiveConversation(updatedConversation);
      setConversations((prev) =>
        prev.map((c) =>
          c.id === activeConversation.id ? updatedConversation : c
        )
      );

      // 更新localStorage中的文件信息
      const savedFiles = JSON.parse(
        localStorage.getItem("conversationFiles") || "{}"
      );
      savedFiles[activeConversation.id] = updatedConversation.files;
      localStorage.setItem("conversationFiles", JSON.stringify(savedFiles));

      // 理想情况下，调用后端API删除文件
      // 例如: await fileApi.removeFromConversation(activeConversation.id, fileId);
    } catch (error) {
      console.error("Failed to remove file:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // 发送消息时，将所选知识库信息也保存到会话中
  const sendMessage = async (
    content: string,
    selectedLibraries: string[] = [],
    useDirect: boolean = false, // 新增参数，是否直接与Ollama对话
    knowledgeBaseIds?: string[] // 新增参数：指定多个知识库ID
  ) => {
    if (!content.trim()) return;

    try {
      setIsLoading(true);

      // 创建用户消息
      const userMessage: ChatMessage = {
        id: Date.now().toString(),
        content,
        isUser: true,
        timestamp: new Date(),
      };

      let currentConversation = activeConversation;
      let conversationId: string;

      // 如果没有活动对话，创建一个新的
      if (!currentConversation) {
        try {
          // 先创建会话，再添加消息，避免本地先显示消息造成重复
          const response = await conversationApi.create({
            title:
              content.substring(0, 30) + (content.length > 30 ? "..." : ""),
            knowledge_base_id:
              !useDirect && selectedLibraries.length === 1
                ? selectedLibraries[0]
                : undefined,
          });

          if (!response || !response.conversation_id) {
            throw new Error("Failed to create conversation: Invalid response");
          }

          conversationId = response.conversation_id.toString();
          
          // 先添加消息到后端
          try {
            await conversationApi.addMessage(conversationId, {
              content,
              message_type: "user",
            });
          } catch (error) {
            console.error("Failed to save user message:", error);
          }

          // 从后端获取完整会话（包含消息）
          const conversationDetail = await conversationApi.get(conversationId);
          const messages = conversationDetail?.messages?.map((msg: any) => ({
            id: msg.id.toString(),
            content: msg.content,
            isUser: msg.message_type === "user",
            timestamp: new Date(msg.created_at),
          })) || [userMessage]; // 如果获取失败，使用本地创建的消息

          currentConversation = {
            id: conversationId,
            title:
              content.substring(0, 30) + (content.length > 30 ? "..." : ""),
            messages,
            files: [],
            messageCount: messages.length,
            createdAt: new Date(),
          };

          setConversations((prev) => [currentConversation!, ...prev]);
          setActiveConversation(currentConversation);
        } catch (error) {
          console.error("Failed to create conversation:", error);
          throw error;
        }
      } else {
        // 使用现有对话
        conversationId = currentConversation.id;

        // 添加消息到后端
        try {
          await conversationApi.addMessage(conversationId, {
            content,
            message_type: "user",
          });
          
          // 从后端检查是否已经添加成功
          const conversationDetail = await conversationApi.get(conversationId);
          const backendMessages = conversationDetail?.messages || [];
          
          // 检查后端是否已包含此消息
          const messageExists = backendMessages.some(
            (msg: any) => 
              msg.content === content && 
              msg.message_type === "user" &&
              // 检查是否是最新消息
              new Date(msg.created_at) > new Date(Date.now() - 60000) // 1分钟内创建的
          );
          
          // 只有当后端没有此消息时，才添加到本地状态
          if (!messageExists) {
            // 更新状态以显示用户消息
            currentConversation = {
              ...currentConversation,
              messages: [...currentConversation.messages, userMessage],
              messageCount: currentConversation.messageCount + 1,
            };

            setActiveConversation(currentConversation);
            setConversations((prev) =>
              prev.map((c) => (c.id === conversationId ? currentConversation! : c))
            );
          }
        } catch (error) {
          console.error("Failed to save user message:", error);
          // 如果添加到后端失败，仍然添加到本地状态，保证用户体验
          currentConversation = {
            ...currentConversation,
            messages: [...currentConversation.messages, userMessage],
            messageCount: currentConversation.messageCount + 1,
          };

          setActiveConversation(currentConversation);
          setConversations((prev) =>
            prev.map((c) => (c.id === conversationId ? currentConversation! : c))
          );
        }
      }

      // 查询知识库或直接对话
      let response;
      try {
        if (useDirect) {
          // 直接与Ollama对话
          console.log("使用直接对话模式");
          response = await queryApi.chat(content, conversationId);
        } else if (selectedLibraries.length > 1) {
          // 多知识库查询模式
          console.log("使用多知识库查询模式，知识库IDs:", selectedLibraries);
          response = await queryApi.query(
            content,
            undefined,
            conversationId,
            selectedLibraries // 传递所有选择的知识库
          );
        } else if (selectedLibraries.length === 1) {
          // 查询单一知识库
          console.log("使用单一知识库查询模式", selectedLibraries[0]);
          response = await queryApi.query(
            content,
            selectedLibraries[0],
            conversationId
          );
        } else {
          // 未选择知识库，使用直接对话模式
          console.log("未选择知识库，使用直接对话模式");
          response = await queryApi.query(content, undefined, conversationId);
        }

        // 处理响应中的来源
        const sources = response?.sources || [];
        console.log("获取的API响应:", response);
        console.log("解析的来源数据:", sources);
        
      } catch (error: any) {
        console.error("Failed to query:", error);
        // 检查是否是空知识库错误
        let errorMessage = "抱歉，查询时出错了。请稍后再试。";

        if (error.message && error.message.includes("400")) {
          // 尝试自动切换到直接对话模式
          try {
            console.log("知识库可能为空，尝试直接对话模式");
            // 显示错误消息并尝试使用直接对话模式
            errorMessage =
              "选择的知识库为空，没有文档可供参考。正在尝试直接对话模式...";

            // 创建临时错误消息
            const tempErrorMessage: ChatMessage = {
              id: Date.now().toString() + "-temp",
              content: errorMessage,
              isUser: false,
              timestamp: new Date(),
            };

            // 更新状态以显示临时错误消息
            currentConversation = {
              ...currentConversation,
              messages: [...currentConversation.messages, tempErrorMessage],
            };

            setActiveConversation(currentConversation);
            setConversations((prev) =>
              prev.map((c) =>
                c.id === conversationId ? currentConversation! : c
              )
            );

            // 尝试使用直接对话模式
            response = await queryApi.chat(content, conversationId);

            // 如果成功，移除临时错误消息
            currentConversation = {
              ...currentConversation,
              messages: currentConversation.messages.filter(
                (m) => m.id !== tempErrorMessage.id
              ),
            };

            setActiveConversation(currentConversation);
            setConversations((prev) =>
              prev.map((c) =>
                c.id === conversationId ? currentConversation! : c
              )
            );
          } catch (chatError) {
            console.error("Failed to fallback to chat:", chatError);
            errorMessage =
              "知识库为空且直接对话模式也失败。请上传文档到知识库或检查系统配置。";
            response = { answer: errorMessage };
          }
        } else {
          response = { answer: errorMessage };
        }
      }

      // 创建AI回复消息
      const aiMessage: ChatMessage = {
        id: Date.now().toString(),
        content: response?.answer || "抱歉，我找不到相关的答案。",
        isUser: false,
        timestamp: new Date(),
        sources: response?.sources || []
      };

      console.log("创建AI回复消息:", aiMessage);
      console.log("AI回复消息包含源信息:", aiMessage.sources);

      // 检查当前会话中是否已有相同内容的AI回复消息
      const aiMessageExists = currentConversation.messages.some(
        (msg) => !msg.isUser && msg.content === aiMessage.content
      );

      // 只有当不存在相同内容的AI回复时，才添加新消息
      if (!aiMessageExists) {
        // 更新状态以显示AI回复
        const updatedWithAI = {
          ...currentConversation,
          messages: [...currentConversation.messages, aiMessage],
          messageCount: currentConversation.messageCount + 1,
        };

        setActiveConversation(updatedWithAI);
        setConversations((prev) =>
          prev.map((c) => (c.id === conversationId ? updatedWithAI : c))
        );
      }
    } catch (error) {
      console.error("Error in message flow:", error);

      // 创建错误消息
      const errorMessage: ChatMessage = {
        id: Date.now().toString(),
        content: "对不起，处理您的请求时发生错误，请重试。",
        isUser: false,
        timestamp: new Date(),
      };

      // 更新状态以显示错误消息
      if (activeConversation) {
        setActiveConversation((prev) => ({
          ...prev!,
          messages: [...prev!.messages, errorMessage],
        }));

        setConversations((prev) =>
          prev.map((c) =>
            c.id === activeConversation.id
              ? { ...c, messages: [...c.messages, errorMessage] }
              : c
          )
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  const mockAIResponse = async (content: string, model: string) => {
    await new Promise((resolve) => setTimeout(resolve, 10000));
    const modelNames: { [key: string]: string } = {
      "deepseek-r1": "DeepSeek R1",
      "gpt-4": "ChatGPT-4",
      "claude-2": "Claude 2",
      gemini: "Google Gemini",
    };
    return `${modelNames[model]} 回复：${content} (模拟回复)`;
  };

  // Add these new methods
  const deleteConversation = async (id: string) => {
    try {
      await conversationApi.delete(id);
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (activeConversation?.id === id) {
        setActiveConversation(null);
      }
    } catch (error) {
      console.error(`Failed to delete conversation ${id}:`, error);
    }
  };

  const updateConversationTitle = (id: string, newTitle: string) => {
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, title: newTitle } : c))
    );
    if (activeConversation?.id === id) {
      setActiveConversation((prev) =>
        prev ? { ...prev, title: newTitle } : null
      );
    }
  };

  const editMessage = async (messageId: string, newContent: string) => {
    if (!activeConversation) return;

    setIsLoading(true);

    try {
      // 查找要编辑的消息索引
      const messageIndex = activeConversation.messages.findIndex(
        (msg) => msg.id === messageId
      );
      if (messageIndex === -1) return;

      // 确保这是用户消息
      const message = activeConversation.messages[messageIndex];
      if (!message.isUser) return;

      // 创建消息的更新副本
      const updatedMessage = { ...message, content: newContent };

      // 只保留到当前消息的所有消息，删除后面的所有消息
      const updatedMessages = [
        ...activeConversation.messages.slice(0, messageIndex),
        updatedMessage,
      ];

      // 更新会话
      const updatedConversation = {
        ...activeConversation,
        messages: updatedMessages,
      };

      setActiveConversation(updatedConversation);

      setConversations((prevConversations) =>
        prevConversations.map((conv) =>
          conv.id === activeConversation.id ? updatedConversation : conv
        )
      );

      // 直接生成新的 AI 响应
      const aiResponseContent = await mockAIResponse(newContent, selectedModel);

      // 创建新的 AI 消息
      const newAiMessage: ChatMessage = {
        id: Date.now().toString(), // 简单使用时间戳作为ID而不是UUID
        content: aiResponseContent || "I'm not sure how to respond to that.",
        isUser: false,
        timestamp: new Date(),
        // 注意：这是模拟回复，没有真实的sources数据
      };

      // 添加 AI 回复到会话中
      const conversationWithResponse = {
        ...updatedConversation,
        messages: [...updatedMessages, newAiMessage],
      };

      setActiveConversation(conversationWithResponse);

      setConversations((prevConversations) =>
        prevConversations.map((conv) =>
          conv.id === activeConversation.id ? conversationWithResponse : conv
        )
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Wrapped setter to validate model values
  const setSelectedLibrary = (libraryId: string) => {
    console.log("设置选择的知识库为:", libraryId);
    // 存储到 localStorage
    localStorage.setItem("selectedLibrary", libraryId || '');
    // 更新状态
    setSelectedLibraryState(libraryId);
  };

  // Update context value
  const contextValue = useMemo(
    () => ({
      conversations,
      activeConversation,
      isLoading,
      createNewConversation,
      switchConversation,
      sendMessage,
      addFiles,
      removeFile,
      deleteConversation,
      updateConversationTitle,
      selectedModel,
      setSelectedModel,
      selectedLibrary,
      setSelectedLibrary,
      editMessage,
    }),
    [
      conversations,
      activeConversation,
      isLoading,
      selectedModel,
      selectedLibrary,
    ]
  );

  return (
    <ChatContext.Provider value={contextValue}>{children}</ChatContext.Provider>
  );
}

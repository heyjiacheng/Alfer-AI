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

interface MessageHistoryEntry {
  original: ChatMessage;
  originalResponse?: ChatMessage; // 原始消息的AI回复
  edited: ChatMessage[];
  responses: ChatMessage[]; // 每个编辑版本对应的AI回复
}

interface MessageHistoryState {
  [messageId: string]: MessageHistoryEntry;
}

interface ChatContextType {
  conversations: Conversation[];
  activeConversation: Conversation | null;
  isLoading: boolean;
  createNewConversation: () => void;
  switchConversation: (conversationId: string | null) => void;
  sendMessage: (
    content: string,
    selectedLibraries: string[],
    useDirect: boolean
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
  messageHistory: MessageHistoryState;
  currentHistoryIndex: {[messageId: string]: number};
  navigateMessageHistory: (messageId: string, direction: 'forward' | 'backward') => void;
  hasMessageHistory: (messageId: string) => boolean;
  canNavigateMessageBackward: (messageId: string) => boolean;
  canNavigateMessageForward: (messageId: string) => boolean;
  getMessageVersionInfo: (messageId: string) => { current: number; total: number };
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
  const [selectedLibrary, setSelectedLibraryState] = useState(() => {
    const savedLibrary = localStorage.getItem('selectedLibrary');
    return savedLibrary || '';
  });

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversation, setActiveConversation] =
    useState<Conversation | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [messageHistory, setMessageHistory] = useState<MessageHistoryState>({});
  const [currentHistoryIndex, setCurrentHistoryIndex] = useState<{[messageId: string]: number}>({});

  // 当模型选择改变时保存到 localStorage
  useEffect(() => {
    localStorage.setItem("selectedAIModel", selectedModel);
  }, [selectedModel]);

  // 当知识库选择改变时保存到 localStorage
  useEffect(() => {
    const validModels = ["deepseek-r1", "gpt-4", "claude-2", "gemini", ""];
    if (validModels.includes(selectedLibrary)) {
      localStorage.setItem("selectedLibrary", selectedLibrary);
    }
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
        title: "New Conversation",
      });

      if (!response || !response.conversation_id) {
        throw new Error("Failed to create conversation: Invalid response");
      }

      const newConversation: Conversation = {
        id: response.conversation_id.toString(),
        title: "New Conversation",
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
    useDirect: boolean = false // 新增参数，是否直接与Ollama对话
  ) => {
    if (!content.trim()) return;

    try {
      setIsLoading(true);

      let finalContent = content.trim();
      
      // 创建新的消息对象
      const newUserMessage: ChatMessage = {
        id: Date.now().toString(),
        content: finalContent,
        isUser: true,
        timestamp: new Date(),
      };

      let currentConversation: Conversation;

      // 如果存在活动会话，将消息添加到该会话
      if (activeConversation) {
        // 不需要保存对话历史，现在我们保存消息级别的历史
        currentConversation = {
          ...activeConversation,
          messages: [...activeConversation.messages, newUserMessage],
          messageCount: activeConversation.messageCount + 1,
        };
      } else {
        // 否则创建新会话
        currentConversation = await createConversationWithMessage(finalContent);
      }

      // 更新活动会话和会话列表
      setActiveConversation(currentConversation);
      setConversations((prev) =>
        prev.map((conv) =>
          conv.id === currentConversation.id ? currentConversation : conv
        )
      );

      // 保存当前选择的知识库
      if (selectedLibraries.length > 0) {
        // Don't set the AI model to the selected knowledge base ID
        // localStorage.setItem("selectedLibrary", selectedLibraries[0]);
        // setSelectedLibrary(selectedLibraries[0]);
      }

      // 查询知识库或直接对话
      let response;
      try {
        if (useDirect) {
          // 直接与Ollama对话
          console.log("使用直接对话模式");
          response = await queryApi.chat(content, currentConversation.id);
        } else if (selectedLibraries.length === 1) {
          // 查询单一知识库
          response = await queryApi.query(
            content,
            selectedLibraries[0],
            currentConversation.id
          );
        } else {
          // 查询所有知识库
          response = await queryApi.query(content, undefined, currentConversation.id);
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
                c.id === currentConversation.id ? currentConversation! : c
              )
            );

            // 尝试使用直接对话模式
            response = await queryApi.chat(content, currentConversation.id);

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
                c.id === currentConversation.id ? currentConversation! : c
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

      // 处理AI回复
      const botMessage: ChatMessage = {
        id: Date.now().toString(),
        content: response?.answer || "Sorry, I couldn't process that request.",
        isUser: false,
        timestamp: new Date(),
        sources: processSourceInfo(response?.source_documents),
      };

      // 更新会话
      const updatedWithAI = {
        ...currentConversation,
        messages: [...currentConversation.messages, botMessage],
        messageCount: currentConversation.messageCount + 1,
      };

      // 不再需要保存对话的历史记录，我们现在使用消息级别的历史记录
      setActiveConversation(updatedWithAI);
      setConversations((prev) =>
        prev.map((c) => (c.id === currentConversation.id ? updatedWithAI : c))
      );
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

  // 修改导航函数以支持特定消息的历史导航
  const navigateMessageHistory = (messageId: string, direction: 'forward' | 'backward') => {
    if (!activeConversation) return;
    
    // 确保有历史记录
    const history = messageHistory[messageId];
    if (!history) {
      console.error("No message history found for message ID:", messageId);
      return;
    }
    
    // 从当前索引状态中获取当前索引，默认为0
    const currentIndex = currentHistoryIndex[messageId] ?? 0;
    console.log(`导航历史 - 当前索引: ${currentIndex}, 方向: ${direction}, 消息ID: ${messageId}`);
    console.log("历史记录:", history);
    
    // 计算新索引
    let newIndex = currentIndex;
    
    if (direction === 'backward') {
      // 向后 (查看历史)
      if (currentIndex > -1) {
        newIndex = currentIndex - 1;
      }
    } else if (direction === 'forward') {
      // 向前 (查看更新)
      if (currentIndex < history.edited.length - 1) {
        newIndex = currentIndex + 1;
      }
    }
    
    console.log(`新索引: ${newIndex}`);
    
    // 找到要修改的消息索引
    const messageIndex = activeConversation.messages.findIndex(
      (msg) => msg.id === messageId
    );
    
    if (messageIndex === -1) {
      console.error("Message not found in active conversation:", messageId);
      return;
    }
    
    // 创建会话消息的副本
    const updatedMessages = [...activeConversation.messages];
    
    // 根据索引获取要显示的消息和其对应的AI回复
    if (newIndex === -1) {
      // 显示原始消息和原始回复
      updatedMessages[messageIndex] = {...history.original}; // 创建副本以避免引用问题
      console.log("显示原始消息:", history.original);
      
      // 如果有原始AI回复，则也显示它
      if (history.originalResponse && messageIndex + 1 < updatedMessages.length) {
        if (!updatedMessages[messageIndex + 1].isUser) {
          // 如果下一条消息是AI消息，替换它
          updatedMessages[messageIndex + 1] = {...history.originalResponse};
          console.log("显示原始回复:", history.originalResponse);
        } else if (messageIndex + 1 === updatedMessages.length) {
          // 如果是最后一条消息，添加原始回复
          updatedMessages.push({...history.originalResponse});
          console.log("添加原始回复:", history.originalResponse);
        }
      }
    } else {
      // 显示编辑后的消息
      if (history.edited && history.edited.length > newIndex) {
        // 替换用户消息
        updatedMessages[messageIndex] = {...history.edited[newIndex]}; // 创建副本以避免引用问题
        console.log("显示编辑后的消息:", history.edited[newIndex], "索引:", newIndex);
        
        // 如果有对应的AI回复，则也显示它
        if (history.responses && history.responses.length > newIndex) {
          const aiResponse = history.responses[newIndex];
          if (messageIndex + 1 < updatedMessages.length) {
            if (!updatedMessages[messageIndex + 1].isUser) {
              // 如果下一条消息是AI消息，替换它
              updatedMessages[messageIndex + 1] = {...aiResponse};
              console.log("显示编辑版本的回复:", aiResponse);
            }
          } else {
            // 如果是最后一条消息，添加AI回复
            updatedMessages.push({...aiResponse});
            console.log("添加编辑版本的回复:", aiResponse);
          }
        }
      } else {
        console.error("No edited message found at index:", newIndex);
        return;
      }
    }
    
    // 更新会话，保留到AI回复为止
    const messageEndsAt = messageIndex + (
      messageIndex + 1 < updatedMessages.length && !updatedMessages[messageIndex + 1].isUser 
        ? 1  // 包含AI回复
        : 0  // 只有用户消息
    );
    
    const updatedConversation = {
      ...activeConversation,
      messages: updatedMessages.slice(0, messageEndsAt + 1)
    };
    
    // 更新当前索引
    setCurrentHistoryIndex(prev => ({
      ...prev,
      [messageId]: newIndex
    }));
    
    // 更新活动会话
    setActiveConversation(updatedConversation);
    
    // 更新会话列表
    setConversations(prev => 
      prev.map(conv => 
        conv.id === activeConversation.id ? updatedConversation : conv
      )
    );
  };
  
  // 保存原始消息到历史记录
  const saveOriginalMessage = (messageId: string, message: ChatMessage) => {
    console.log("保存原始消息:", messageId, message);
    
    // 使用函数式更新确保获取最新状态
    setMessageHistory(prevHistory => {
      // 如果已经有这个消息的历史记录，不要覆盖
      if (prevHistory[messageId]) {
        return prevHistory;
      }
      
      // 创建新的历史记录条目，确保类型正确
      const newEntry: MessageHistoryEntry = {
        original: { ...message }, // 创建深拷贝
        originalResponse: undefined, // 原始消息的AI回复
        edited: [],
        responses: []
      };
      
      // 返回更新后的历史记录
      const result: MessageHistoryState = {
        ...prevHistory,
        [messageId]: newEntry
      };
      
      return result;
    });
  };

  // 保存原始消息及其AI回复到历史记录
  const saveOriginalMessageWithResponse = (messageId: string, message: ChatMessage, response: ChatMessage) => {
    console.log("保存原始消息及回复:", messageId, message, response);
    
    setMessageHistory(prevHistory => {
      // 如果已经有这个消息的历史记录，不要覆盖
      if (prevHistory[messageId]) {
        return prevHistory;
      }
      
      // 创建新的历史记录条目，确保类型正确
      const newEntry: MessageHistoryEntry = {
        original: { ...message }, // 创建深拷贝
        originalResponse: { ...response }, // 原始消息的AI回复
        edited: [],
        responses: []
      };
      
      // 返回更新后的历史记录
      const result: MessageHistoryState = {
        ...prevHistory,
        [messageId]: newEntry
      };
      
      return result;
    });
  };
  
  // 存储编辑后的消息到历史记录
  const saveEditedMessage = (messageId: string, originalMessage: ChatMessage, editedMessage: ChatMessage) => {
    console.log("保存编辑后消息:", messageId, editedMessage);
    
    // 使用函数式更新确保获取最新状态
    setMessageHistory(prevHistory => {
      // 获取现有的历史记录，如果没有则创建新的
      const existingEntry = prevHistory[messageId] || {
        original: { ...originalMessage },
        originalResponse: undefined, // 原始消息的AI回复
        edited: [] as ChatMessage[],
        responses: [] as ChatMessage[]
      };
      
      // 创建新的编辑历史数组
      const updatedEdited = [...existingEntry.edited, { ...editedMessage }];
      
      // 创建更新后的历史记录条目，确保类型正确
      const updatedEntry: MessageHistoryEntry = {
        original: existingEntry.original,
        originalResponse: existingEntry.originalResponse, // 原始消息的AI回复
        edited: updatedEdited,
        responses: existingEntry.responses
      };
      
      console.log("更新后的历史记录条目:", updatedEntry);
      
      // 返回更新后的历史记录
      const result: MessageHistoryState = {
        ...prevHistory,
        [messageId]: updatedEntry
      };
      
      return result;
    });
    
    // 更新索引到新添加的编辑版本
    setMessageHistory(currentHistory => {
      const editedLength = (currentHistory[messageId]?.edited.length || 0);
      console.log(`消息 ${messageId} 的编辑历史长度: ${editedLength}`);
      
      // 更新当前历史索引状态
      setCurrentHistoryIndex(prevIndices => ({
        ...prevIndices,
        [messageId]: editedLength - 1 // 指向最新添加的编辑
      }));
      
      return currentHistory; // 不实际修改历史记录，只是为了触发更新
    });
  };
  
  // 保存编辑后的消息及其AI回复到历史记录
  const saveEditedMessageWithResponse = (messageId: string, originalMessage: ChatMessage, editedMessage: ChatMessage, aiResponse: ChatMessage) => {
    console.log("保存编辑后消息及回复:", messageId, editedMessage, aiResponse);
    
    // 使用函数式更新确保获取最新状态
    setMessageHistory(prevHistory => {
      // 获取现有的历史记录，如果没有则创建新的
      const existingEntry = prevHistory[messageId] || {
        original: { ...originalMessage },
        originalResponse: undefined,
        edited: [] as ChatMessage[],
        responses: [] as ChatMessage[]
      };
      
      // 创建新的编辑历史数组和响应数组
      const updatedEdited = [...existingEntry.edited, { ...editedMessage }];
      const updatedResponses = [...existingEntry.responses, { ...aiResponse }];
      
      // 创建更新后的历史记录条目，确保类型正确
      const updatedEntry: MessageHistoryEntry = {
        original: existingEntry.original,
        originalResponse: existingEntry.originalResponse,
        edited: updatedEdited,
        responses: updatedResponses
      };
      
      console.log("更新后的历史记录条目:", updatedEntry);
      
      // 返回更新后的历史记录
      const result: MessageHistoryState = {
        ...prevHistory,
        [messageId]: updatedEntry
      };
      
      return result;
    });
    
    // 更新索引到新添加的编辑版本
    setMessageHistory(currentHistory => {
      const editedLength = (currentHistory[messageId]?.edited.length || 0);
      console.log(`消息 ${messageId} 的编辑历史长度: ${editedLength}`);
      
      // 更新当前历史索引状态
      setCurrentHistoryIndex(prevIndices => ({
        ...prevIndices,
        [messageId]: editedLength - 1 // 指向最新添加的编辑
      }));
      
      return currentHistory; // 不实际修改历史记录，只是为了触发更新
    });
  };

  // 修改editMessage函数以使用新的辅助函数
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

      // 查找这条消息后面的AI回复（如果有）
      let aiResponse: ChatMessage | undefined;
      if (messageIndex + 1 < activeConversation.messages.length && 
          !activeConversation.messages[messageIndex + 1].isUser) {
        aiResponse = activeConversation.messages[messageIndex + 1];
        
        // 当首次编辑时，保存原始消息和它的AI回复
        if (!messageHistory[messageId]) {
          console.log("首次编辑，保存原始消息和回复");
          saveOriginalMessageWithResponse(messageId, message, aiResponse);
        }
      } else {
        // 如果没有对应的AI回复，只保存原始消息
        console.log("首次编辑，没有AI回复");
        saveOriginalMessage(messageId, message);
      }

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

      // 使用真实API获取AI回复，而不是模拟回复
      let response;
      try {
        // 根据当前会话的知识库设置选择查询方式
        const conversationLibraries = JSON.parse(localStorage.getItem('conversationLibraries') || '{}');
        const selectedLibraries = conversationLibraries[activeConversation.id] || [];
        const useDirect = selectedLibraries.length === 0;
        
        if (useDirect) {
          // 直接与AI对话
          response = await queryApi.chat(newContent, activeConversation.id);
        } else if (selectedLibraries.length === 1) {
          // 查询单一知识库
          response = await queryApi.query(
            newContent,
            selectedLibraries[0],
            activeConversation.id
          );
        } else {
          // 查询所有知识库
          response = await queryApi.query(newContent, undefined, activeConversation.id);
        }
      } catch (error) {
        console.error("Failed to get AI response:", error);
        response = { 
          answer: "Sorry, I couldn't generate a response. Please try again." 
        };
      }

      // 创建新的 AI 消息
      const newAiMessage: ChatMessage = {
        id: Date.now().toString(),
        content: response?.answer || "I'm not sure how to respond to that.",
        isUser: false,
        timestamp: new Date(),
        sources: processSourceInfo(response?.source_documents),
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

      // 保存编辑后的消息和对应的AI回复到历史记录
      saveEditedMessageWithResponse(messageId, message, updatedMessage, newAiMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // 添加辅助函数以判断消息是否有导航历史
  const hasMessageHistory = (messageId: string) => {
    return !!messageHistory[messageId] && 
          (messageHistory[messageId].edited.length > 0 || 
           JSON.stringify(messageHistory[messageId].original) !== 
           JSON.stringify(messageHistory[messageId].edited[messageHistory[messageId].edited.length - 1]));
  };
  
  // 判断是否可以向后导航
  const canNavigateMessageBackward = (messageId: string) => {
    if (!messageHistory[messageId]) return false;
    
    const currentIndex = currentHistoryIndex[messageId] ?? 0;
    return currentIndex > -1; // 可以后退到原始消息 (-1)
  };
  
  // 判断是否可以向前导航
  const canNavigateMessageForward = (messageId: string) => {
    if (!messageHistory[messageId]) return false;
    
    const currentIndex = currentHistoryIndex[messageId] ?? 0;
    return currentIndex < messageHistory[messageId].edited.length - 1;
  };
  
  // 获取当前消息的版本信息（供UI显示）
  const getMessageVersionInfo = (messageId: string) => {
    if (!messageHistory[messageId]) {
      return { current: 1, total: 1 }; // 没有历史记录时显示为 1/1
    }
    
    const history = messageHistory[messageId];
    const currentIndex = currentHistoryIndex[messageId] ?? 0;
    const totalVersions = history.edited.length + 1; // 原始消息 + 所有编辑版本
    
    // 计算当前版本号
    let currentVersion;
    if (currentIndex === -1) {
      currentVersion = 1; // 原始版本是第1版
    } else {
      currentVersion = currentIndex + 2; // 编辑版本从2开始
    }
    
    console.log(`消息 ${messageId} 的版本信息: 当前=${currentVersion}, 总共=${totalVersions}`);
    
    return { current: currentVersion, total: totalVersions };
  };

  // Wrapped setter to validate model values
  const setSelectedLibrary = (libraryId: string) => {
    const validModels = ["deepseek-r1", "gpt-4", "claude-2", "gemini", ""];
    if (validModels.includes(libraryId)) {
      setSelectedLibraryState(libraryId);
    } else {
      console.warn(`Invalid model: ${libraryId}. Must be one of: ${validModels.join(', ')}`);
    }
  };

  // Helper function to create a new conversation with an initial message
  const createConversationWithMessage = async (content: string): Promise<Conversation> => {
    try {
      // 创建一个新的会话
      const response = await conversationApi.create({
        title: content.substring(0, 30) + (content.length > 30 ? "..." : ""),
      });

      if (!response || !response.conversation_id) {
        throw new Error("Failed to create conversation: Invalid response");
      }

      const conversationId = response.conversation_id.toString();
      
      // 添加用户消息到会话
      await conversationApi.addMessage(conversationId, {
        content,
        message_type: "user",
      });

      // 从后端获取完整会话（包含消息）
      const conversationDetail = await conversationApi.get(conversationId);
      
      const messages = conversationDetail?.messages?.map((msg: any) => ({
        id: msg.id.toString(),
        content: msg.content,
        isUser: msg.message_type === "user",
        timestamp: new Date(msg.created_at),
      })) || [{ 
        id: Date.now().toString(),
        content,
        isUser: true,
        timestamp: new Date()
      }]; // 如果获取失败，使用本地创建的消息

      return {
        id: conversationId,
        title: content.substring(0, 30) + (content.length > 30 ? "..." : ""),
        messages,
        files: [],
        messageCount: messages.length,
        createdAt: new Date(),
      };
    } catch (error) {
      console.error("Failed to create conversation:", error);
      throw error;
    }
  };

  // Helper function to process source documents
  const processSourceInfo = (sourceDocuments: any[] | undefined) => {
    if (!sourceDocuments || !Array.isArray(sourceDocuments)) {
      return undefined;
    }
    
    try {
      return sourceDocuments.map(doc => ({
        document_name: doc.metadata?.source || doc.filename || 'Unknown source',
        content_preview: doc.page_content || doc.content || '',
        content: doc.page_content || doc.content || '',
        page: doc.metadata?.page || undefined,
        relevance_score: doc.score || undefined,
        metadata: doc.metadata || {}
      }));
    } catch (error) {
      console.error("Error processing source documents:", error);
      return undefined;
    }
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
      messageHistory,
      currentHistoryIndex,
      navigateMessageHistory,
      hasMessageHistory,
      canNavigateMessageBackward,
      canNavigateMessageForward,
      getMessageVersionInfo,
    }),
    [
      conversations,
      activeConversation,
      isLoading,
      selectedModel,
      selectedLibrary,
      messageHistory,
      currentHistoryIndex,
    ]
  );

  return (
    <ChatContext.Provider value={contextValue}>{children}</ChatContext.Provider>
  );
}

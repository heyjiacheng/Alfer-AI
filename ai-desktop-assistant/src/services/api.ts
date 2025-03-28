// API基础配置
const API_BASE_URL = "http://localhost:8080";

// Error handling function
const handleApiError = (error: any) => {
  console.error('API Error:', error);
  return { error: error.message || '未知错误' };
};

// 知识库API
export const knowledgeBaseApi = {
  // 获取所有知识库
  getAll: async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/knowledge-bases`);
      if (!response.ok) throw new Error(`HTTP error ${response.status}`);
      const data = await response.json();
      return data.knowledge_bases || [];
    } catch (error) {
      return handleApiError(error);
    }
  },

  // 获取单个知识库
  get: async (id: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/knowledge-bases/${id}`);
      if (!response.ok) throw new Error(`HTTP error ${response.status}`);
      return response.json();
    } catch (error) {
      return handleApiError(error);
    }
  },

  // 创建知识库
  create: async (data: { name: string; description: string }) => {
    try {
      const response = await fetch(`${API_BASE_URL}/knowledge-bases`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error(`HTTP error ${response.status}`);
      return response.json();
    } catch (error) {
      return handleApiError(error);
    }
  },

  // 更新知识库
  update: async (id: string, data: { name?: string; description?: string }) => {
    try {
      const response = await fetch(`${API_BASE_URL}/knowledge-bases/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error(`HTTP error ${response.status}`);
      return response.json();
    } catch (error) {
      return handleApiError(error);
    }
  },

  // 删除知识库
  delete: async (id: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/knowledge-bases/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error(`HTTP error ${response.status}`);
      return response.json();
    } catch (error) {
      return handleApiError(error);
    }
  },
};

// 文档API
export const documentApi = {
  // 获取所有文档
  getAll: async (knowledgeBaseId?: string) => {
    try {
      const url = knowledgeBaseId
        ? `${API_BASE_URL}/documents?knowledge_base_id=${knowledgeBaseId}`
        : `${API_BASE_URL}/documents`;

      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP error ${response.status}`);
      const data = await response.json();
      return data.documents || [];
    } catch (error) {
      return handleApiError(error);
    }
  },

  // 获取单个文档
  get: async (id: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/documents/${id}`);
      if (!response.ok) throw new Error(`HTTP error ${response.status}`);
      return response.json();
    } catch (error) {
      return handleApiError(error);
    }
  },

  // 上传文档到知识库
  upload: async (knowledgeBaseId: string, fileData: { name: string, file: ArrayBuffer }) => {
    try {
      // 创建FormData对象
      const formData = new FormData();
      const blob = new Blob([fileData.file], { type: 'application/octet-stream' });
      formData.append('file', blob, fileData.name);
      
      // 使用fetch上传文件
      const response = await fetch(`${API_BASE_URL}/upload/${knowledgeBaseId}`, {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) throw new Error(`HTTP error ${response.status}`);
      return response.json();
    } catch (error) {
      console.error(`文件上传失败:`, error);
      return handleApiError(error);
    }
  },

  // 下载文档
  download: async (id: string) => {
    try {
      // First check if the document exists
      const checkResponse = await fetch(`${API_BASE_URL}/documents/${id}`);
      if (!checkResponse.ok) {
        if (checkResponse.status === 404) {
          throw new Error(`Document ID ${id} not found`);
        }
        throw new Error(`HTTP error ${checkResponse.status}`);
      }

      // Then attempt to download
      const response = await fetch(`${API_BASE_URL}/documents/${id}/download`);
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error(`Download file for document ID ${id} not found`);
        }
        throw new Error(`HTTP error ${response.status}`);
      }
      return response.blob();
    } catch (error) {
      console.error(`文档下载失败 (ID: ${id}):`, error);
      return handleApiError(error);
    }
  },

  // Get download URL for a document
  getDownloadUrl: (id: string) => {
    // Validate ID format
    if (!id || isNaN(Number(id))) {
      console.warn(`Invalid document ID format: ${id}`);
      return null;
    }
    return `${API_BASE_URL}/documents/${id}/download`;
  },

  // 删除文档
  delete: async (id: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/documents/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error(`HTTP error ${response.status}`);
      return response.json();
    } catch (error) {
      return handleApiError(error);
    }
  },
};

// 查询API
export const queryApi = {
  // 查询知识库
  query: async (
    query: string,
    knowledgeBaseId?: string,
    conversationId?: string
  ) => {
    try {
      const payload: any = { query };

      if (knowledgeBaseId) {
        payload.knowledge_base_id = knowledgeBaseId;
      }

      if (conversationId) {
        payload.conversation_id = conversationId;
      }

      const response = await fetch(`${API_BASE_URL}/query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) throw new Error(`HTTP error ${response.status}`);
      return response.json();
    } catch (error) {
      return handleApiError(error);
    }
  },

  // 直接与Ollama模型对话
  chat: async (query: string, conversationId?: string) => {
    try {
      const payload: any = { query };

      if (conversationId) {
        payload.conversation_id = conversationId;
      }

      const response = await fetch(`${API_BASE_URL}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) throw new Error(`HTTP error ${response.status}`);
      return response.json();
    } catch (error) {
      return handleApiError(error);
    }
  },
};

// 会话API
export const conversationApi = {
  // 获取所有会话
  getAll: async (knowledgeBaseId?: string) => {
    try {
      const url = knowledgeBaseId
        ? `${API_BASE_URL}/conversations?knowledge_base_id=${knowledgeBaseId}&include_message_count=true`
        : `${API_BASE_URL}/conversations?include_message_count=true`;

      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP error ${response.status}`);
      const data = await response.json();
      return data.conversations || [];
    } catch (error) {
      return handleApiError(error);
    }
  },

  // 获取单个会话
  get: async (id: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/conversations/${id}`);
      if (!response.ok) throw new Error(`HTTP error ${response.status}`);
      return response.json();
    } catch (error) {
      return handleApiError(error);
    }
  },

  // 创建会话
  create: async (data: { title: string; knowledge_base_id?: string }) => {
    try {
      const response = await fetch(`${API_BASE_URL}/conversations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error(`HTTP error ${response.status}`);
      return response.json();
    } catch (error) {
      return handleApiError(error);
    }
  },

  // 删除会话
  delete: async (id: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/conversations/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error(`HTTP error ${response.status}`);
      return response.json();
    } catch (error) {
      return handleApiError(error);
    }
  },

  // 添加消息到会话
  addMessage: async (
    conversationId: string,
    data: { content: string; message_type: "user" | "assistant"; sources?: any }
  ) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/conversations/${conversationId}/messages`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        }
      );
      if (!response.ok) throw new Error(`HTTP error ${response.status}`);
      return response.json();
    } catch (error) {
      return handleApiError(error);
    }
  },
};

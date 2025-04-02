// API Base Configuration
const API_BASE_URL = "http://localhost:8080";

// Error handling function
const handleApiError = (error: any) => {
  console.error('API Error:', error);
  return { error: error.message || 'Unknown error' };
};

// Knowledge Base API
export const knowledgeBaseApi = {
  // Get All Knowledge Bases
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

  // Get Single Knowledge Base
  get: async (id: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/knowledge-bases/${id}`);
      if (!response.ok) throw new Error(`HTTP error ${response.status}`);
      return response.json();
    } catch (error) {
      return handleApiError(error);
    }
  },

  // Create Knowledge Base
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

  // Update Knowledge Base
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

  // Delete Knowledge Base
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

// Document API
export const documentApi = {
  // Get All Documents
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

  // Get Single Document
  get: async (id: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/documents/${id}`);
      if (!response.ok) throw new Error(`HTTP error ${response.status}`);
      return response.json();
    } catch (error) {
      return handleApiError(error);
    }
  },

  // Upload Document to Knowledge Base
  upload: async (knowledgeBaseId: string, fileData: { name: string, file: ArrayBuffer }) => {
    try {
      // Create FormData object
      const formData = new FormData();
      const blob = new Blob([fileData.file], { type: 'application/octet-stream' });
      formData.append('file', blob, fileData.name);
      
      // Use fetch to upload file
      const response = await fetch(`${API_BASE_URL}/upload/${knowledgeBaseId}`, {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) throw new Error(`HTTP error ${response.status}`);
      return response.json();
    } catch (error) {
      console.error(`File upload failed:`, error);
      return handleApiError(error);
    }
  },

  // Download Document
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
      console.error(`Document download failed (ID: ${id}):`, error);
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

  // Delete Document
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

// Query API
export const queryApi = {
  // Query Knowledge Base or Direct Chat
  query: async (
    query: string,
    knowledgeBaseId?: string,
    conversationId?: string,
    knowledgeBaseIds?: string[]
  ) => {
    try {
      const payload: any = { query };

      if (conversationId) {
        payload.conversation_id = conversationId;
      }

      // Handle knowledge base parameters, prioritize multiple knowledge base ID list
      if (knowledgeBaseIds && knowledgeBaseIds.length > 0) {
        // Use multiple knowledge base mode
        payload.knowledge_base_ids = knowledgeBaseIds;
        console.log(`Querying multiple knowledge bases: ${knowledgeBaseIds}`);
      } else if (knowledgeBaseId) {
        // Use single knowledge base mode
        payload.knowledge_base_id = knowledgeBaseId;
        console.log(`Querying knowledge base: ${knowledgeBaseId}`);
      } else {
        // Use direct chat mode
        console.log("Using direct chat mode");
      }

      console.log(`Using API endpoint: ${API_BASE_URL}/query`);
      console.log("Sending data:", payload);

      const response = await fetch(`${API_BASE_URL}/query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`API error (${response.status}): ${errorText}`);
        throw new Error(`HTTP error ${response.status}: ${errorText}`);
      }
      
      const result = await response.json();
      console.log("API response:", result);
      return result;
    } catch (error) {
      return handleApiError(error);
    }
  },

  // Directly use chat endpoint for AI conversation
  chat: async (query: string, conversationId?: string) => {
    try {
      console.log("Directly using chat endpoint");
      // Use explicit reference instead of this
      return queryApi.query(query, undefined, conversationId);
    } catch (error) {
      return handleApiError(error);
    }
  },
};

// Conversation API
export const conversationApi = {
  // Get All Conversations
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

  // Get Single Conversation
  get: async (id: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/conversations/${id}`);
      if (!response.ok) throw new Error(`HTTP error ${response.status}`);
      return response.json();
    } catch (error) {
      return handleApiError(error);
    }
  },

  // Create Conversation
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

  // Delete Conversation
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

  // Add Message to Conversation
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

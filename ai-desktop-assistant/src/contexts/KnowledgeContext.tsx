import { createContext, useContext, useState, useMemo, useEffect } from 'react';
import { knowledgeBaseApi, documentApi } from '../services/api';

export type KnowledgeLibrary = {
  id: string;
  name: string;
  description: string;
  documents: string[]; 
};

export type KnowledgeFolder = {
  id: string;
  name: string;
  libraries: string[];
};

interface KnowledgeContextType {
  readonly libraries: KnowledgeLibrary[];
  readonly folders: KnowledgeFolder[];
  readonly activeLib?: string;
  readonly selectedLibraryId: string | null;
  readonly createLibrary: (name: string, description: string) => Promise<string>;
  readonly deleteLibrary: (id: string) => void;
  readonly addDocumentToLib: (
    libId: string,
    doc: Omit<FileDocument, "id">
  ) => void;
  readonly updateLibrary: (
    id: string,
    newData: Partial<KnowledgeLibrary>
  ) => void;
  readonly removeDocumentFromLib: (libId: string, docId: string) => void;
  readonly setActiveLib: (id: string) => void;
  readonly selectLibrary: (id: string | null) => void;
  readonly documents: FileDocument[];
  readonly updateFolder: (id: string, name: string) => void;
  readonly deleteFolder: (id: string) => void;
}

const KnowledgeContext = createContext<KnowledgeContextType>(null!);

interface FileDocument {
  id: string;
  name: string;
  type: string;
  size: number;
  content: string;
  libraryId: string;
}

export function KnowledgeProvider({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const [libraries, setLibraries] = useState<KnowledgeLibrary[]>([]);
  const [folders, setFolders] = useState<KnowledgeFolder[]>([]);
  const [activeLib, setActiveLib] = useState<string>('');
  const [selectedLibraryId, setSelectedLibraryId] = useState<string | null>(null);
  const [documents, setDocuments] = useState<FileDocument[]>([]);

  // 初始化加载知识库和文件夹
  useEffect(() => {
    const fetchKnowledgeBases = async () => {
      try {
        // 加载文件夹
        try {
          const storedFolders = localStorage.getItem('knowledge_folders');
          if (storedFolders) {
            setFolders(JSON.parse(storedFolders));
          }
        } catch (e) {
          console.error('Failed to load folders from localStorage:', e);
          setFolders([]);
        }

        const backendLibraries = await knowledgeBaseApi.getAll();
        // 转换后端数据以匹配前端结构
        const transformedLibraries = backendLibraries.map((lib: any) => ({
          id: lib.id.toString(),
          name: lib.name,
          description: lib.description || '',
          documents: []
        }));
        setLibraries(transformedLibraries);

        // 加载所有文档
        const allDocuments = await documentApi.getAll();
        const transformedDocs = allDocuments.map((doc: any) => ({
          id: doc.id.toString(),
          name: doc.original_filename,
          type: getFileType(doc.original_filename),
          size: doc.file_size,
          libraryId: doc.knowledge_base_id.toString(),
          content: "", // 内容将在需要时加载
        }));
        setDocuments(transformedDocs);
      } catch (error) {
        console.error("Failed to fetch knowledge bases:", error);
      }
    };

    fetchKnowledgeBases();
  }, []);

  // 保存文件夹到本地存储
  useEffect(() => {
    if (folders.length > 0) {
      localStorage.setItem('knowledge_folders', JSON.stringify(folders));
    }
  }, [folders]);

  // 辅助函数：从文件名获取类型
  const getFileType = (filename: string) => {
    const extension = filename.split(".").pop()?.toLowerCase();
    if (!extension) return "application/octet-stream";

    const typeMap: Record<string, string> = {
      pdf: "application/pdf",
      doc: "application/msword",
      docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      txt: "text/plain",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      png: "image/png",
    };
    
    return typeMap[extension] || 'application/octet-stream';
  };

  // 更新文件夹
  const updateFolder = (id: string, name: string) => {
    setFolders(prev => 
      prev.map(folder => 
        folder.id === id ? { ...folder, name } : folder
      )
    );
  };

  // 删除文件夹
  const deleteFolder = (id: string) => {
    // 从文件夹中移除
    setFolders(prev => prev.filter(folder => folder.id !== id));
  };

  // 创建知识库
  const createLibrary = async (name: string, description: string): Promise<string> => {
    try {
      const response = await knowledgeBaseApi.create({
        name,
        description: description || '知识库'
      });

      const libraryId = response.knowledge_base_id.toString();
      const newLibrary: KnowledgeLibrary = {
        id: libraryId,
        name,
        description,
        documents: []
      };
      
      setLibraries(prev => [...prev, newLibrary]);
      
      return libraryId;
    } catch (error) {
      console.error("Failed to create knowledge base:", error);
      return "";
    }
  };

  // 删除知识库
  const deleteLibrary = async (id: string) => {
    try {
      await knowledgeBaseApi.delete(id);
      
      // 从库列表中移除
      setLibraries(prev => prev.filter(lib => lib.id !== id));
      
      // 同时删除此知识库下的所有文档记录
      setDocuments((prev) => prev.filter((doc) => doc.libraryId !== id));
    } catch (error) {
      console.error(`Failed to delete knowledge base ${id}:`, error);
    }
  };

  // 更新知识库
  const updateLibrary = async (
    id: string,
    newData: Partial<KnowledgeLibrary>
  ) => {
    try {
      const currentLib = libraries.find(lib => lib.id === id);
      if (!currentLib) return;
      
      await knowledgeBaseApi.update(id, {
        name: newData.name || currentLib.name,
        description: newData.description || currentLib.description
      });

      setLibraries((prev) =>
        prev.map((lib) => (lib.id === id ? { ...lib, ...newData } : lib))
      );
    } catch (error) {
      console.error(`Failed to update knowledge base ${id}:`, error);
    }
  };

  // 上传文档到知识库
  const addDocumentToLib = async (libId: string, docData: Omit<FileDocument, 'id'>) => {
    try {
      let fileData: ArrayBuffer;

      // 处理文件内容
      if (typeof docData.content === 'string') {
        // 如果内容是 base64 编码的字符串
        if (docData.content.startsWith('data:')) {
          // 处理 data URL 格式
          const base64Data = docData.content.split(',')[1];
          const binaryString = atob(base64Data);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          fileData = bytes.buffer;
        } else {
          // 普通字符串内容，使用 TextEncoder 编码
          const encoder = new TextEncoder();
          fileData = encoder.encode(docData.content).buffer;
        }
      } else {
        console.error('不支持的内容类型:', typeof docData.content);
        throw new Error('不支持的内容类型');
      }

      // 直接使用 fetch 上传
      const response = await documentApi.upload(libId, {
        name: docData.name,
        file: fileData
      });

      // 添加到前端状态
      const newDoc = {
        id: response.document_id.toString(),
        name: docData.name,
        type: docData.type,
        size: docData.size,
        content: docData.content,
        libraryId: libId
      };
      
      setDocuments(prev => [...prev, newDoc]);
      
      // 更新知识库状态
      setLibraries(prev => 
        prev.map(lib => 
          lib.id === libId 
            ? { ...lib, documents: [...lib.documents, newDoc.id] } 
            : lib
        )
      );

      return newDoc;
    } catch (error) {
      console.error(`Failed to add document to library ${libId}:`, error);
      throw error;
    }
  };

  // 从知识库移除文档
  const removeDocumentFromLib = async (libId: string, docId: string) => {
    try {
      await documentApi.delete(docId);

      setDocuments((prev) => prev.filter((doc) => doc.id !== docId));

      setLibraries((prev) =>
        prev.map((lib) =>
          lib.id === libId
            ? { ...lib, documents: lib.documents.filter((id) => id !== docId) }
            : lib
        )
      );
    } catch (error) {
      console.error(
        `Failed to remove document ${docId} from library ${libId}:`,
        error
      );
    }
  };

  const value = useMemo(() => ({
    libraries,
    folders,
    activeLib,
    selectedLibraryId,
    documents,
    createLibrary,
    deleteLibrary,
    addDocumentToLib,
    updateLibrary,
    removeDocumentFromLib,
    setActiveLib,
    selectLibrary: (id: string | null) => {
      console.log(`KnowledgeContext: 设置选择的知识库从 ${selectedLibraryId} 到 ${id}`);
      setSelectedLibraryId(id);
    },
    updateFolder,
    deleteFolder
  }), [libraries, folders, activeLib, selectedLibraryId, documents]);

  return (
    <KnowledgeContext.Provider value={value}>
      {children}
    </KnowledgeContext.Provider>
  );
}

export const useKnowledge = () => useContext(KnowledgeContext);

export interface ChatMessage {
  id: string;
  content: string;
  role: "user" | "ai";
  timestamp: Date;
  status?: "pending" | "sent" | "error";
}

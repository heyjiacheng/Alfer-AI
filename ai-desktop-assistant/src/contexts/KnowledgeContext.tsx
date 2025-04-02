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

  // Initialize knowledge base and folder loading
  useEffect(() => {
    const fetchKnowledgeBases = async () => {
      try {
        // Load folders
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
        // Convert backend data to match frontend structure
        const transformedLibraries = backendLibraries.map((lib: any) => ({
          id: lib.id.toString(),
          name: lib.name,
          description: lib.description || '',
          documents: []
        }));
        setLibraries(transformedLibraries);

        // Load all documents
        const allDocuments = await documentApi.getAll();
        const transformedDocs = allDocuments.map((doc: any) => ({
          id: doc.id.toString(),
          name: doc.original_filename,
          type: getFileType(doc.original_filename),
          size: doc.file_size,
          libraryId: doc.knowledge_base_id.toString(),
          content: "", // Content will be loaded when needed
        }));
        setDocuments(transformedDocs);
      } catch (error) {
        console.error("Failed to fetch knowledge bases:", error);
      }
    };

    fetchKnowledgeBases();
  }, []);

  // Save folders to local storage
  useEffect(() => {
    if (folders.length > 0) {
      localStorage.setItem('knowledge_folders', JSON.stringify(folders));
    }
  }, [folders]);

  // Helper function: Get type from filename
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

  // Update folder
  const updateFolder = (id: string, name: string) => {
    setFolders(prev => 
      prev.map(folder => 
        folder.id === id ? { ...folder, name } : folder
      )
    );
  };

  // Delete folder
  const deleteFolder = (id: string) => {
    // Remove from folder
    setFolders(prev => prev.filter(folder => folder.id !== id));
  };

  // Create knowledge base
  const createLibrary = async (name: string, description: string): Promise<string> => {
    try {
      const response = await knowledgeBaseApi.create({
        name,
        description: description || 'Knowledge Base'
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

  // Delete knowledge base
  const deleteLibrary = async (id: string) => {
    try {
      await knowledgeBaseApi.delete(id);
      
      // Remove from library list
      setLibraries(prev => prev.filter(lib => lib.id !== id));
      
      // Remove from library list
      setDocuments((prev) => prev.filter((doc) => doc.libraryId !== id));
    } catch (error) {
      console.error(`Failed to delete knowledge base ${id}:`, error);
    }
  };

  // Update knowledge base
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

  // Upload document to knowledge base
  const addDocumentToLib = async (libId: string, docData: Omit<FileDocument, 'id'>) => {
    try {
      let fileData: ArrayBuffer;

      // Process file content
      if (typeof docData.content === 'string') {
        // If content is base64 encoded string
        if (docData.content.startsWith('data:')) {
          // Process data URL format
          const base64Data = docData.content.split(',')[1];
          const binaryString = atob(base64Data);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          fileData = bytes.buffer;
        } else {
          // Normal string content, use TextEncoder to encode
          const encoder = new TextEncoder();
          fileData = encoder.encode(docData.content).buffer;
        }
      } else {
        console.error('Unsupported content type:', typeof docData.content);
        throw new Error('Unsupported content type');
      }

      // Directly use fetch to upload
      const response = await documentApi.upload(libId, {
        name: docData.name,
        file: fileData
      });

      // Add to frontend state
      const newDoc = {
        id: response.document_id.toString(),
        name: docData.name,
        type: docData.type,
        size: docData.size,
        content: docData.content,
        libraryId: libId
      };
      
      setDocuments(prev => [...prev, newDoc]);
      
      // Update knowledge base state
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

  // Remove document from knowledge base
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

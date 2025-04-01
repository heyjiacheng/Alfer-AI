import { useState, useMemo, useRef, useEffect } from "react";
import {
  Box,
  TextField,
  IconButton,
  Stack,
  Typography,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Paper,
  Button,
  Menu,
  CircularProgress,
  FormControlLabel,
  Switch,
  ListItemText,
  Drawer,
} from "@mui/material";
import SendIcon from "@mui/icons-material/Send";
import AttachFileIcon from "@mui/icons-material/AttachFile";
import MessageBubble from "./MessageBubble";
import SourceViewer from "./SourceViewer";
import FileUploadArea from "../file/FileUploadArea";
import { useChat, ChatMessage } from "../../contexts/ChatContext";
import { useKnowledge } from "../../contexts/KnowledgeContext";
import SearchIcon from "@mui/icons-material/Search";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown";
import CloseIcon from "@mui/icons-material/Close";
import { Checkbox } from "@mui/material";
import { useTheme } from "@mui/material/styles";

const CenteredBox = ({ children }: Readonly<{ children: React.ReactNode }>) => (
  <Box
    sx={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      height: "100vh",
      textAlign: "center",
      p: 3,
    }}
  >
    {children}
  </Box>
);

export default function ChatWindow() {
  const {
    activeConversation,
    isLoading,
    sendMessage,
    selectedLibrary,
    setSelectedLibrary,
    createNewConversation: contextCreateNewConversation,
  } = useChat();
  const { libraries, documents } = useKnowledge();
  const [input, setInput] = useState("");
  const [showFileUpload, setShowFileUpload] = useState(false);
  const [selectedLibraries, setSelectedLibraries] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const [knowledgeMenuOpen, setKnowledgeMenuOpen] = useState(false);
  const modelButtonRef = useRef(null);
  const knowledgeButtonRef = useRef(null);
  const homeKnowledgeButtonRef = useRef(null);
  const [homeKnowledgeMenuOpen, setHomeKnowledgeMenuOpen] = useState(false);
  const [conversationLibraries, setConversationLibraries] = useState<
    Record<string, string[]>
  >({});
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [currentSources, setCurrentSources] = useState<ChatMessage['sources']>([]);
  const theme = useTheme();

  const allLibraries = useMemo(() => libraries, [libraries]);

  const getDocumentCount = (libId: string) => {
    return documents.filter((doc) => doc.libraryId === libId).length;
  };

  useEffect(() => {
    if (activeConversation) {
      const savedLibraries = conversationLibraries[activeConversation.id];
      if (savedLibraries) {
        setSelectedLibraries(savedLibraries);
      } else {
        setSelectedLibraries([]);
      }
    } else {
      setSelectedLibraries([]);
    }
  }, [activeConversation, conversationLibraries]);

  const handleSend = async () => {
    if (!input.trim()) return;
    const messageContent = input.trim();
    setInput("");

    try {
      if (activeConversation) {
        updateConversationLibraries(activeConversation.id, selectedLibraries);
        
        // 更新发送消息逻辑 - 使用多知识库查询
        let useDirect = selectedLibraries.length === 0;
        
        console.log("发送消息:", messageContent);
        console.log("选择的知识库数量:", selectedLibraries.length);
        console.log("选择的知识库:", selectedLibraries);
        console.log("是否使用直接对话模式:", useDirect);
        
        if (selectedLibraries.length >= 1) {
          // 使用多知识库查询API - 可以同时查询多个知识库
          console.log("使用多知识库查询模式");
          await sendMessage(
            messageContent,
            selectedLibraries,
            false // 不使用直接对话模式
          );
        } else {
          // 没有选择知识库，使用直接对话模式
          console.log("没有选择知识库，使用直接对话模式");
          await sendMessage(
            messageContent,
            [],
            true
          );
        }
      } else {
        await createNewConversation(messageContent);
      }
    } catch (error) {
      console.error("Failed to send message:", error);
    }
  };

  useEffect(() => {
    if (sourcesOpen) {
      console.log("Source information drawer opened, current sources:", currentSources);
    }
  }, [sourcesOpen, currentSources]);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "start",
      });
    }
    
    // 调试：检查当前会话中的消息是否包含源信息
    if (activeConversation?.messages) {
      const messagesWithSources = activeConversation.messages.filter(
        msg => !msg.isUser && msg.sources && msg.sources.length > 0
      );
      if (messagesWithSources.length > 0) {
        console.log(`Current conversation contains ${messagesWithSources.length} messages with source information`);
      }
    }
  }, [activeConversation?.messages]);

  const toggleLibrarySelection = (libraryId: string) => {
    if (activeConversation) {
      setSelectedLibraries((prev) => {
        const newSelections = prev.includes(libraryId)
          ? prev.filter((id) => id !== libraryId)
          : [...prev, libraryId];

        setConversationLibraries((currentMap) => ({
          ...currentMap,
          [activeConversation.id]: newSelections,
        }));

        return newSelections;
      });
    } else {
      setSelectedLibraries((prev) =>
        prev.includes(libraryId)
          ? prev.filter((id) => id !== libraryId)
          : [...prev, libraryId]
      );
    }
  };

  const getSelectedLibrariesDisplay = () => {
    if (selectedLibraries.length === 0) {
      return "Knowledge Base";
    } else if (selectedLibraries.length === 1) {
      const lib = allLibraries.find((lib) => lib.id === selectedLibraries[0]);
      if (lib) {
        return lib.name.length > 8
          ? `${lib.name.substring(0, 8)}...`
          : lib.name;
      }
      return "Knowledge Base";
    } else {
      return `${selectedLibraries.length} Knowledge Bases`;
    }
  };

  const createNewConversation = async (message: string) => {
    try {
      const newConversationId = await createNewConversationInContext(
        message,
        contextCreateNewConversation
      );

      if (selectedLibraries.length > 0) {
        updateConversationLibraries(newConversationId, selectedLibraries);
      }
    } catch (error) {
      console.error("Failed to create new conversation:", error);
    }
  };

  const createNewConversationInContext = async (
    message: string,
    createNewConversationFunc: () => void
  ): Promise<string> => {
    createNewConversationFunc();

    const newConversation = {
      id: Date.now().toString(),
      title: message.substring(0, 30),
    };

    // 与 handleSend 保持一致的处理逻辑
    let useDirect = selectedLibraries.length === 0;
    
    console.log("创建新会话并发送消息:", message);
    console.log("选择的知识库数量:", selectedLibraries.length);
    console.log("选择的知识库:", selectedLibraries);
    console.log("是否使用直接对话模式:", useDirect);
    
    // 使用与 handleSend 相同的逻辑
    if (selectedLibraries.length >= 1) {
      // 使用多知识库查询API - 可以同时查询多个知识库
      console.log("使用多知识库查询模式");
      await sendMessage(
        message,
        selectedLibraries,
        false // 不使用直接对话模式
      );
    } else {
      // 没有选择知识库，使用直接对话模式
      console.log("没有选择知识库，使用直接对话模式");
      await sendMessage(
        message,
        [],
        true
      );
    }

    return newConversation.id;
  };

  const updateChatLibraries = (selections: string[]) => {
    if (activeConversation) {
      setSelectedLibraries(selections);
      setConversationLibraries((currentMap) => ({
        ...currentMap,
        [activeConversation.id]: selections,
      }));
    }
  };

  const clearLibrarySelection = () => {
    if (activeConversation) {
      setSelectedLibraries([]);
      setConversationLibraries((currentMap) => ({
        ...currentMap,
        [activeConversation.id]: [],
      }));
    } else {
      setSelectedLibraries([]);
    }
  };

  const updateConversationLibraries = (
    conversationId: string,
    libraries: string[]
  ) => {
    setConversationLibraries((prev) => ({
      ...prev,
      [conversationId]: libraries,
    }));
  };

  const handleViewSources = (sources: ChatMessage['sources']) => {
    console.log("ChatWindow接收到源信息数据:", sources);
    setCurrentSources(sources || []);
    setSourcesOpen(true);
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

  return (
    <Box
      sx={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        bgcolor: "background.default",
        position: "relative",
      }}
    >
      {!activeConversation ? (
        <CenteredBox>
          <Typography variant="h3" gutterBottom sx={{ fontWeight: 600, mb: 4 }}>
            Álfer AI Assistant
          </Typography>
          <Box sx={{ width: "100%", maxWidth: 850, px: 2 }}>
            <Paper
              elevation={3}
              sx={{
                borderRadius: 7,
                p: 1.5,
                bgcolor: "background.paper",
                boxShadow: "0 3px 10px rgba(0, 0, 0, 0.08)",
                mb: 2,
                width: "100%",
              }}
            >
              <TextField
                fullWidth
                variant="outlined"
                placeholder="Enter a message to start conversation..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                multiline
                maxRows={1}
                sx={{ 
                  mb: 1.5,
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 3,
                    '& fieldset': {
                      border: 'none',
                    },
                    '&:hover fieldset': {
                      border: 'none',
                    },
                    '&.Mui-focused fieldset': {
                      border: 'none',
                    }
                  },
                  '& .MuiInputBase-inputMultiline': {
                    py: 0.7,
                    px: 1.5,
                    lineHeight: 1.3
                  }
                }}
                InputProps={{
                  endAdornment: (
                    <IconButton
                      onClick={handleSend}
                      color="primary"
                      disabled={!input.trim()}
                      sx={{ 
                        width: 32,
                        height: 32,
                        p: 0.7,
                        mr: 0.5
                      }}
                    >
                      <SendIcon fontSize="small" />
                    </IconButton>
                  ),
                  sx: {
                    bgcolor: "transparent",
                  },
                }}
              />

            <Box
              sx={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                mb: 1,
              }}
            >
              <Box sx={{ display: "flex", gap: 1.5, flexGrow: 1 }}>
                <FormControl size="small" sx={{ 
                  minWidth: 115,
                  '& .MuiInputLabel-root': {
                    backgroundColor: theme => theme.palette.background.paper,
                    padding: '0 4px',
                    transform: 'translate(14px, -6px) scale(0.75)',
                    color: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.9)' : 'rgba(0, 0, 0, 0.9)',
                    '&.Mui-focused': {
                      color: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.9)' : 'rgba(0, 0, 0, 0.9)',
                    },
                    borderRadius: 8,
                    paddingLeft: '6px',
                    paddingRight: '6px'
                  },
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 3,
                    height: 36,
                    '& fieldset': {
                      borderColor: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.1)',
                    },
                    '&:hover fieldset': {
                      borderColor: 'primary.main',
                    },
                    '&.Mui-focused fieldset': {
                      borderColor: 'primary.main',
                    }
                  }
                }}>
                  <InputLabel 
                    id="home-ai-model-label" 
                    sx={{ 
                      fontSize: '0.85rem',
                      pointerEvents: 'none',
                      zIndex: 1,
                      borderRadius: 8
                    }}
                  >
                    AI Model
                  </InputLabel>
                  <Button
                    ref={modelButtonRef}
                    variant="outlined"
                    onClick={() => setModelMenuOpen(true)}
                    endIcon={<ArrowDropDownIcon sx={{ color: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }} />}
                    size="small"
                    aria-labelledby="home-ai-model-label"
                    sx={{ 
                      height: 36,
                      borderRadius: 3,
                      px: 1.5,
                      py: 0.4,
                      borderColor: modelMenuOpen 
                        ? 'primary.main'
                        : (theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.1)'),
                      textTransform: 'none',
                      fontSize: '0.85rem',
                      fontWeight: 'normal',
                      justifyContent: 'space-between',
                      minWidth: 115,
                      bgcolor: 'background.paper',
                      color: "text.primary",
                      display: 'flex',
                      '&:hover': {
                        borderColor: 'primary.main',
                        bgcolor: 'background.paper',
                      },
                      "& .MuiButton-endIcon": {
                        flexShrink: 0,
                        marginLeft: 'auto',
                        color: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)'
                      }
                    }}
                  >
                    <Typography
                      noWrap
                      sx={{ 
                        overflow: "hidden", 
                        textOverflow: "ellipsis",
                        fontSize: "0.85rem",
                        py: 0.7,
                        flex: '1',
                        textAlign: 'left',
                        pl: 0.5,
                        color: theme => theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.9)' : 'rgba(0, 0, 0, 0.9)',
                      }}
                    >
                      {selectedLibrary === "deepseek-r1" ? "DeepSeek R1" : selectedLibrary}
                    </Typography>
                  </Button>
                  <Menu
                    anchorEl={modelButtonRef.current}
                    open={modelMenuOpen}
                    onClose={() => setModelMenuOpen(false)}
                    anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
                    transformOrigin={{ vertical: "top", horizontal: "left" }}
                    sx={{ 
                      mt: 1,
                      '& .MuiMenuItem-root.Mui-selected': {
                        backgroundColor: theme => theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)',
                        '&:hover': {
                          backgroundColor: theme => theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.12)',
                        }
                      }
                    }}
                  >
                    <MenuItem
                      onClick={() => {
                        setSelectedLibrary("deepseek-r1");
                        setModelMenuOpen(false);
                      }}
                      selected={selectedLibrary === "deepseek-r1"}
                    >
                      DeepSeek R1
                    </MenuItem>
                    <MenuItem
                      onClick={() => {
                        setSelectedLibrary("gpt-4");
                        setModelMenuOpen(false);
                      }}
                      selected={selectedLibrary === "gpt-4"}
                    >
                      GPT-4
                    </MenuItem>
                    <MenuItem
                      onClick={() => {
                        setSelectedLibrary("claude-2");
                        setModelMenuOpen(false);
                      }}
                      selected={selectedLibrary === "claude-2"}
                    >
                      Claude 2
                    </MenuItem>
                    <MenuItem
                      onClick={() => {
                        setSelectedLibrary("gemini");
                        setModelMenuOpen(false);
                      }}
                      selected={selectedLibrary === "gemini"}
                    >
                      Gemini
                    </MenuItem>
                  </Menu>
                </FormControl>

                <FormControl size="small" sx={{ 
                  minWidth: 150,
                  position: 'relative',
                  '& .MuiInputLabel-root': {
                    backgroundColor: theme => theme.palette.background.paper,
                    padding: '0 4px',
                    transform: selectedLibraries.length > 0 || homeKnowledgeMenuOpen 
                      ? 'translate(14px, -6px) scale(0.75)'
                      : 'translate(14px, 8px) scale(1)',
                    color: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.9)' : 'rgba(0, 0, 0, 0.9)',
                    '&.Mui-focused': {
                      transform: 'translate(14px, -6px) scale(0.75)',
                      color: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.9)' : 'rgba(0, 0, 0, 0.9)',
                    },
                    borderRadius: 8,
                    paddingLeft: '6px',
                    paddingRight: '6px'
                  },
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 3,
                    height: 36,
                    '& fieldset': {
                      borderColor: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.1)',
                    },
                    '&:hover fieldset': {
                      borderColor: 'primary.main',
                    },
                    '&.Mui-focused fieldset': {
                      borderColor: 'primary.main',
                    }
                  }
                }}>
                  <InputLabel 
                    id="home-knowledge-base-label" 
                    sx={{ 
                      fontSize: '0.85rem',
                      pointerEvents: 'none',
                      zIndex: 1,
                      borderRadius: 8
                    }}
                  >
                    Knowledge Base
                  </InputLabel>
                  <Button
                    ref={homeKnowledgeButtonRef}
                    variant="outlined"
                    onClick={() => setHomeKnowledgeMenuOpen(true)}
                    endIcon={<ArrowDropDownIcon sx={{ color: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }} />}
                    size="small"
                    aria-labelledby="home-knowledge-base-label"
                    sx={{ 
                      height: 36,
                      borderRadius: 3,
                      px: 1.5,
                      py: 0.4,
                      borderColor: homeKnowledgeMenuOpen 
                        ? 'primary.main'
                        : (theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.1)'),
                      textTransform: 'none',
                      fontSize: '0.85rem',
                      fontWeight: 'normal',
                      justifyContent: 'space-between',
                      minWidth: 150,
                      bgcolor: 'background.paper',
                      color: "text.primary",
                      display: 'flex',
                      '&:hover': {
                        borderColor: 'primary.main',
                        bgcolor: 'background.paper',
                      },
                      "& .MuiButton-endIcon": {
                        flexShrink: 0,
                        marginLeft: 'auto',
                        color: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)'
                      }
                    }}
                  >
                    <Typography
                      noWrap
                      sx={{ 
                        overflow: "hidden", 
                        textOverflow: "ellipsis",
                        fontSize: "0.85rem",
                        py: 0.7,
                        flex: '1',
                        textAlign: 'left',
                        pl: 0.5,
                        color: theme => theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.9)' : 'rgba(0, 0, 0, 0.9)',
                        visibility: selectedLibraries.length > 0 ? 'visible' : 'hidden'
                      }}
                    >
                      {getSelectedLibrariesDisplay()}
                    </Typography>
                  </Button>
                  <Menu
                    anchorEl={homeKnowledgeButtonRef.current}
                    open={homeKnowledgeMenuOpen}
                    onClose={() => setHomeKnowledgeMenuOpen(false)}
                    anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
                    transformOrigin={{ vertical: "top", horizontal: "left" }}
                    sx={{ 
                      mt: 1,
                      '& .MuiMenuItem-root.Mui-selected': {
                        backgroundColor: theme => theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)',
                        '&:hover': {
                          backgroundColor: theme => theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.12)',
                        }
                      },
                      '& .MuiCheckbox-root.Mui-checked': {
                        color: theme => theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)',
                      }
                    }}
                  >
                    <MenuItem
                      onClick={() => {
                        if (activeConversation) {
                          setSelectedLibraries([]);
                        } else {
                          setSelectedLibraries([]);
                        }
                        setHomeKnowledgeMenuOpen(false);
                      }}
                    >
                      <Box sx={{ display: "flex", alignItems: "center" }}>
                        <Checkbox
                          checked={selectedLibraries.length === 0}
                          size="small"
                          sx={{ p: 0.5, mr: 1 }}
                        />
                        <Typography>直接对话</Typography>
                        <Typography variant="caption" sx={{ ml: 1, color: 'text.secondary' }}>
                          (不使用知识库)
                        </Typography>
                      </Box>
                    </MenuItem>
                    <Box sx={{ 
                      px: 2, 
                      py: 1, 
                      borderBottom: '1px solid',
                      borderColor: 'divider', 
                      display: 'flex', 
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}>
                      <Typography variant="caption" color="text.secondary">
                        选择知识库 (可多选，将同时搜索所有选择的知识库)
                      </Typography>
                    </Box>
                    {allLibraries.map((lib) => (
                      <MenuItem
                        key={lib.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleLibrarySelection(lib.id);
                        }}
                        sx={{ maxWidth: 250 }}
                      >
                        <Box
                          sx={{
                            display: "flex",
                            alignItems: "center",
                            width: "100%",
                            overflow: "hidden",
                          }}
                        >
                          <Checkbox
                            checked={selectedLibraries.includes(lib.id)}
                            size="small"
                            sx={{ p: 0.5, mr: 1, flexShrink: 0 }}
                          />
                          <Typography
                            noWrap
                            sx={{
                              flexGrow: 1,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              maxWidth: 140,
                            }}
                          >
                            {lib.name}
                          </Typography>
                          <Typography
                            variant="caption"
                            sx={{ ml: 1, flexShrink: 0 }}
                          >
                            ({getDocumentCount(lib.id)} files)
                          </Typography>
                        </Box>
                      </MenuItem>
                    ))}
                    <Box
                      sx={{ p: 1, display: "flex", justifyContent: "flex-end" }}
                    >
                      <Button
                        variant="contained"
                        size="small"
                        onClick={() => setHomeKnowledgeMenuOpen(false)}
                        sx={{ 
                          mt: 1,
                          backgroundColor: theme => theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)',
                          '&:hover': {
                            backgroundColor: theme => theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)',
                          }
                        }}
                      >
                        Confirm
                      </Button>
                    </Box>
                  </Menu>
                </FormControl>
              </Box>
            </Box>
            </Paper>
          </Box>
        </CenteredBox>
      ) : (
        <Box
          sx={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            height: "100%",
            position: "relative",
            backgroundColor: "background.default",
          }}
        >
          <Box
            sx={{
              flex: 1,
              overflowY: "auto",
              mb: 2,
              px: 2,
              "& > *": {
                maxWidth: "700px",
                mx: "auto",
                my: 1.5,
              },
            }}
          >
            {activeConversation?.messages.map((message) => (
              <MessageBubble
                key={message.id}
                message={message}
                isUser={message.isUser}
                onViewSources={handleViewSources}
              />
            ))}
            <div ref={messagesEndRef} />
          </Box>

          <Paper
            elevation={3}
            sx={{
              position: "sticky",
              bottom: 0,
              borderRadius: 7,
              p: 1,
              bgcolor: "background.paper",
              boxShadow: "0 3px 10px rgba(0, 0, 0, 0.08)",
              mx: "auto",
              mb: 2,
              width: "100%",
              maxWidth: 700,
            }}
          >
            <TextField
              fullWidth
              placeholder="Type a message..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              multiline
              maxRows={3}
              sx={{ 
                mb: 0.8,
                '& .MuiOutlinedInput-root': {
                  borderRadius: 3,
                  '& fieldset': {
                    border: 'none',
                  },
                  '&:hover fieldset': {
                    border: 'none',
                  },
                  '&.Mui-focused fieldset': {
                    border: 'none',
                  }
                },
                '& .MuiInputBase-inputMultiline': {
                  py: 0.5,
                  px: 1.5,
                  lineHeight: 1.4,
                  fontSize: '0.95rem',
                }
              }}
              disabled={isLoading}
            />

            <Box
              sx={{
                display: "flex",
                justifyContent: "flex-end",
                alignItems: "center",
              }}
            >
              <Box sx={{ 
                display: "flex", 
                gap: 1,
                ml: 1.5,
                mr: 'auto',
                mt: -0.5,
              }}>
                <Button
                  ref={modelButtonRef}
                  variant="outlined"
                  onClick={() => setModelMenuOpen(true)}
                  endIcon={<ArrowDropDownIcon sx={{ color: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }} />}
                  sx={{
                    borderRadius: 3,
                    textTransform: "none",
                    px: 1.2,
                    py: 0.2,
                    height: 30,
                    fontSize: "0.8rem",
                    bgcolor: "background.default",
                    borderColor: modelMenuOpen
                      ? 'primary.main'
                      : "rgba(0, 0, 0, 0.1)",
                    color: theme => theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.9)' : 'rgba(0, 0, 0, 0.9)',
                    minWidth: 90,
                    display: 'flex',
                    justifyContent: 'space-between',
                    "&:hover": {
                      bgcolor: "background.default",
                      borderColor: "primary.main",
                    },
                    "&:focus": {
                      bgcolor: "background.default",
                      borderColor: "primary.main",
                      boxShadow: 'none',
                    },
                    "& .MuiButton-endIcon": {
                      flexShrink: 0,
                      marginLeft: 'auto',
                      color: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)'
                    }
                  }}
                >
                  <Typography
                    noWrap
                    sx={{ 
                      overflow: "hidden", 
                      textOverflow: "ellipsis",
                      fontSize: "0.8rem",
                      lineHeight: 1,
                      flex: '1',
                      textAlign: 'left',
                      color: theme => theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.9)' : 'rgba(0, 0, 0, 0.9)'
                    }}
                  >
                    {["deepseek-r1", "gpt-4", "claude-2", "gemini"].includes(selectedLibrary)
                      ? selectedLibrary === "deepseek-r1" ? "DeepThink (R1)" : selectedLibrary
                      : "DeepThink (R1)"}
                  </Typography>
                </Button>
                <Menu
                  anchorEl={modelButtonRef.current}
                  open={modelMenuOpen}
                  onClose={() => setModelMenuOpen(false)}
                  sx={{
                    '& .MuiMenuItem-root.Mui-selected': {
                      backgroundColor: theme => theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)',
                      '&:hover': {
                        backgroundColor: theme => theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.12)',
                      }
                    }
                  }}
                >
                  <MenuItem
                    onClick={() => {
                      setSelectedLibrary("deepseek-r1");
                      setModelMenuOpen(false);
                    }}
                    selected={selectedLibrary === "deepseek-r1"}
                  >
                    DeepThink (R1)
                  </MenuItem>
                  <MenuItem
                    onClick={() => {
                      setSelectedLibrary("gpt-4");
                      setModelMenuOpen(false);
                    }}
                    selected={selectedLibrary === "gpt-4"}
                  >
                    GPT-4
                  </MenuItem>
                  <MenuItem
                    onClick={() => {
                      setSelectedLibrary("claude-2");
                      setModelMenuOpen(false);
                    }}
                    selected={selectedLibrary === "claude-2"}
                  >
                    Claude 2
                  </MenuItem>
                  <MenuItem
                    onClick={() => {
                      setSelectedLibrary("gemini");
                      setModelMenuOpen(false);
                    }}
                    selected={selectedLibrary === "gemini"}
                  >
                    Gemini
                  </MenuItem>
                </Menu>

                <Button
                  ref={knowledgeButtonRef}
                  variant="outlined"
                  onClick={() => setKnowledgeMenuOpen(true)}
                  sx={{
                    borderRadius: 3,
                    textTransform: "none",
                    px: 1.2,
                    py: 0.2,
                    height: 30,
                    fontSize: "0.8rem",
                    bgcolor: "background.default",
                    borderColor: knowledgeMenuOpen
                      ? 'primary.main'
                      : "rgba(0, 0, 0, 0.1)",
                    color: theme => theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.9)' : 'rgba(0, 0, 0, 0.9)',
                    maxWidth: 150,
                    minWidth: 120,
                    "&:hover": {
                      bgcolor: "background.default",
                      borderColor: "primary.main",
                    }
                  }}
                >
                  <Typography
                    noWrap
                    sx={{ 
                      overflow: "hidden", 
                      textOverflow: "ellipsis",
                      fontSize: "0.8rem",
                      lineHeight: 1,
                      color: theme => theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.9)' : 'rgba(0, 0, 0, 0.9)'
                    }}
                  >
                    {getSelectedLibrariesDisplay()}
                  </Typography>
                </Button>
                <Menu
                  anchorEl={knowledgeButtonRef.current}
                  open={knowledgeMenuOpen}
                  onClose={() => setKnowledgeMenuOpen(false)}
                  sx={{
                    '& .MuiMenuItem-root.Mui-selected': {
                      backgroundColor: theme => theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)',
                      '&:hover': {
                        backgroundColor: theme => theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.12)',
                      }
                    },
                    '& .MuiCheckbox-root.Mui-checked': {
                      color: theme => theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)',
                    }
                  }}
                >
                  <MenuItem
                    onClick={() => {
                      if (activeConversation) {
                        setSelectedLibraries([]);
                      } else {
                        setSelectedLibraries([]);
                      }
                      setKnowledgeMenuOpen(false);
                    }}
                  >
                    <Box sx={{ display: "flex", alignItems: "center" }}>
                      <Checkbox
                        checked={selectedLibraries.length === 0}
                        size="small"
                        sx={{ p: 0.5, mr: 1 }}
                      />
                      <Typography>直接对话</Typography>
                      <Typography variant="caption" sx={{ ml: 1, color: 'text.secondary' }}>
                        (不使用知识库)
                      </Typography>
                    </Box>
                  </MenuItem>
                  <Box sx={{ 
                    px: 2, 
                    py: 1, 
                    borderBottom: '1px solid',
                    borderColor: 'divider', 
                    display: 'flex', 
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <Typography variant="caption" color="text.secondary">
                      选择知识库 (可多选，将同时搜索所有选择的知识库)
                    </Typography>
                  </Box>
                  {allLibraries.map((lib) => (
                    <MenuItem
                      key={lib.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleLibrarySelection(lib.id);
                      }}
                      sx={{
                        display: "flex",
                        justifyContent: "space-between",
                        maxWidth: "250px",
                      }}
                    >
                      <Box
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          width: "100%",
                          overflow: "hidden",
                        }}
                      >
                        <Checkbox
                          checked={selectedLibraries.includes(lib.id)}
                          size="small"
                          sx={{ p: 0.5, mr: 1, flexShrink: 0 }}
                        />
                        <Typography
                          noWrap
                          sx={{
                            flexGrow: 1,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            maxWidth: "140px",
                          }}
                        >
                          {lib.name}
                        </Typography>
                        <Typography
                          variant="caption"
                          sx={{ ml: 1, flexShrink: 0 }}
                        >
                          ({getDocumentCount(lib.id)} files)
                        </Typography>
                      </Box>
                    </MenuItem>
                  ))}
                  <Box
                    sx={{ p: 1, display: "flex", justifyContent: "flex-end" }}
                  >
                    <Button
                      variant="contained"
                      size="small"
                      onClick={() => setKnowledgeMenuOpen(false)}
                      sx={{ 
                        mt: 1,
                        backgroundColor: theme => theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)',
                        '&:hover': {
                          backgroundColor: theme => theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)',
                        }
                      }}
                    >
                      Confirm
                    </Button>
                  </Box>
                </Menu>
              </Box>

              <Box sx={{ display: "flex", gap: 1 }}>
                <IconButton
                  onClick={() => {
                    console.log(
                      "File upload clicked, current state:",
                      !showFileUpload
                    );
                    setShowFileUpload(!showFileUpload);
                  }}
                  sx={{
                    color: "text.secondary",
                    p: 0.5,
                    width: 28,
                    height: 28,
                    "&:hover": { color: theme => theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)' },
                  }}
                >
                  <AttachFileIcon fontSize="small" />
                </IconButton>

                <IconButton
                  onClick={handleSend}
                  disabled={!input.trim()}
                  sx={{
                    backgroundColor: "background.default",
                    color: input.trim() ? (theme => theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)') : "text.disabled",
                    p: 0.5,
                    width: 28,
                    height: 28,
                    borderRadius: "50%",
                    "&:hover": {
                      backgroundColor: "background.default",
                      color: theme => theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.8)' : 'rgba(0, 0, 0, 0.8)',
                    },
                  }}
                >
                  <ArrowUpwardIcon fontSize="small" />
                </IconButton>
              </Box>
            </Box>
          </Paper>

          {showFileUpload && (
            <Box
              sx={{
                position: "fixed",
                bottom: "100px",
                right: "20px",
                width: "400px",
                zIndex: 1000,
                boxShadow: "0 0 20px rgba(0,0,0,0.2)",
              }}
            >
              <Paper
                elevation={5}
                sx={{
                  p: 3,
                  borderRadius: 3,
                  maxHeight: "60vh",
                  display: "flex",
                  flexDirection: "column",
                  backgroundColor: "background.paper",
                }}
              >
                <Typography variant="h6" gutterBottom>
                  Upload Files
                </Typography>
                <Box
                  sx={{
                    overflowY: "auto",
                    maxHeight: "calc(60vh - 80px)",
                  }}
                >
                  <FileUploadArea onClose={() => setShowFileUpload(false)} />
                </Box>
              </Paper>
            </Box>
          )}

          {/* Sources Drawer */}
          <Drawer
            anchor="right"
            open={sourcesOpen}
            onClose={() => setSourcesOpen(false)}
            sx={{
              width: 350,
              flexShrink: 0,
              '& .MuiDrawer-paper': {
                width: 350,
                backgroundColor: "background.paper",
              },
            }}
          >
            <Box sx={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              p: 2,
              borderBottom: '1px solid',
              borderColor: 'divider'
            }}>
              <Typography variant="h6">Sources</Typography>
              <IconButton onClick={() => setSourcesOpen(false)}>
                <CloseIcon />
              </IconButton>
            </Box>
            <SourceViewer sources={currentSources || []} />
          </Drawer>
        </Box>
      )}
    </Box>
  );
}

async function updateConversationLibraries(
  conversationId: string,
  libraries: string[]
) {
  console.log(
    `Updating conversation ${conversationId} with libraries:`,
    libraries
  );
}

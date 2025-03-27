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
import CloseIcon from "@mui/icons-material/Close";
import { Checkbox } from "@mui/material";

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
        await sendMessage(
          messageContent,
          selectedLibraries,
          selectedLibraries.length === 0
        );
      } else {
        await createNewConversation(messageContent);
      }
    } catch (error) {
      console.error("Failed to send message:", error);
    }
  };

  useEffect(() => {
    if (sourcesOpen) {
      console.log("打开了源信息抽屉，当前源数据:", currentSources);
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
        console.log(`当前会话包含 ${messagesWithSources.length} 条带有源信息的消息`);
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
      return "知识库";
    } else if (selectedLibraries.length === 1) {
      const lib = allLibraries.find((lib) => lib.id === selectedLibraries[0]);
      if (lib) {
        return lib.name.length > 8
          ? `${lib.name.substring(0, 8)}...`
          : lib.name;
      }
      return "知识库";
    } else {
      return `${selectedLibraries.length} 个知识库`;
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

    await sendMessage(
      message,
      selectedLibraries,
      selectedLibraries.length === 0
    );

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
          <Box sx={{ width: "100%", maxWidth: 800, px: 2 }}>
            <Box sx={{ mb: 1 }}>
              <TextField
                fullWidth
                variant="outlined"
                placeholder="输入消息开始对话..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                multiline
                maxRows={4}
                InputProps={{
                  endAdornment: (
                    <IconButton
                      onClick={handleSend}
                      color="primary"
                      disabled={!input.trim()}
                      sx={{ mb: 0.5 }}
                    >
                      <SendIcon />
                    </IconButton>
                  ),
                  sx: {
                    borderRadius: 4,
                    bgcolor: "background.paper",
                    "& textarea": { py: 1.2 },
                  },
                }}
              />
            </Box>

            <Box
              sx={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <Box sx={{ display: "flex", gap: 2, flexGrow: 1 }}>
                <FormControl size="small" sx={{ minWidth: 120 }}>
                  <InputLabel>AI 模型</InputLabel>
                  <Select
                    value={selectedLibrary}
                    onChange={(e) =>
                      setSelectedLibrary(e.target.value as string)
                    }
                    label="AI 模型"
                    sx={{
                      "& .MuiSelect-select": { py: 1, fontSize: "0.875rem" },
                    }}
                  >
                    <MenuItem value="deepseek-r1">DeepSeek R1</MenuItem>
                    <MenuItem value="gpt-4">GPT-4</MenuItem>
                    <MenuItem value="claude-2">Claude 2</MenuItem>
                    <MenuItem value="gemini">Gemini</MenuItem>
                  </Select>
                </FormControl>

                <FormControl size="small" sx={{ minWidth: 120 }}>
                  <InputLabel
                    shrink
                    sx={{
                      bgcolor: "background.default",
                      px: 0.5,
                      "&.MuiInputLabel-shrink": {
                        transform: "translate(9px, -8px) scale(0.75)",
                      },
                    }}
                  >
                    知识库选择
                  </InputLabel>
                  <Button
                    ref={homeKnowledgeButtonRef}
                    onClick={() => setHomeKnowledgeMenuOpen(true)}
                    sx={{
                      textTransform: "none",
                      justifyContent: "flex-start",
                      px: 1.5,
                      py: 1,
                      border: "1px solid rgba(0, 0, 0, 0.23)",
                      borderRadius: 1,
                      bgcolor: "background.default",
                      color: "text.primary",
                      fontSize: "0.875rem",
                      minHeight: 40,
                      maxWidth: 120,
                      "&:hover": {
                        bgcolor: "background.default",
                        borderColor: "primary.main",
                      },
                    }}
                  >
                    <Typography
                      noWrap
                      sx={{
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        maxWidth: "100%",
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
                    sx={{ mt: 1 }}
                  >
                    <MenuItem
                      onClick={() => {
                        if (activeConversation) {
                          setSelectedLibraries([]);
                        } else {
                          setSelectedLibraries([]);
                        }
                        setSelectedLibrary("");
                        setHomeKnowledgeMenuOpen(false);
                      }}
                    >
                      <Box sx={{ display: "flex", alignItems: "center" }}>
                        <Checkbox
                          checked={selectedLibraries.length === 0}
                          size="small"
                          sx={{ p: 0.5, mr: 1 }}
                        />
                        不使用知识库
                      </Box>
                    </MenuItem>
                    {allLibraries.map((lib) => (
                      <MenuItem
                        key={lib.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleLibrarySelection(lib.id);
                          setHomeKnowledgeMenuOpen(false);
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
                            ({getDocumentCount(lib.id)}个文件)
                          </Typography>
                        </Box>
                      </MenuItem>
                    ))}
                  </Menu>
                </FormControl>
              </Box>

              <Typography
                variant="body2"
                sx={{
                  color: "text.secondary",
                  ml: 1,
                  mt: -1,
                }}
              >
                按下 Enter 发送，Shift + Enter 换行
              </Typography>
            </Box>
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
          }}
        >
          <Box
            sx={{
              flex: 1,
              overflowY: "auto",
              mb: 2,
              px: 2,
              "& > *": {
                maxWidth: "800px",
                mx: "auto",
                my: 2,
              },
            }}
          >
            {activeConversation.messages.map((message) => (
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
              p: 2,
              bgcolor: "background.paper",
              boxShadow: "0 3px 10px rgba(0, 0, 0, 0.08)",
              mx: "auto",
              mb: 2,
              width: "100%",
              maxWidth: 800,
            }}
          >
            <TextField
              fullWidth
              placeholder="输入消息..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              multiline
              maxRows={4}
              sx={{ mb: 2 }}
              disabled={isLoading}
            />

            <Box
              sx={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <Box sx={{ display: "flex", gap: 1 }}>
                <Button
                  ref={modelButtonRef}
                  variant="outlined"
                  onClick={() => setModelMenuOpen(true)}
                  startIcon={
                    <Box
                      component="span"
                      sx={{
                        width: 20,
                        height: 20,
                        borderRadius: "50%",
                        bgcolor: "primary.light",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <span style={{ color: "white", fontSize: "14px" }}>
                        AI
                      </span>
                    </Box>
                  }
                  sx={{
                    borderRadius: 20,
                    textTransform: "none",
                    px: 2,
                    py: 0.5,
                    bgcolor: "background.default",
                    borderColor: "divider",
                    color: "text.primary",
                    "&:hover": {
                      bgcolor: "background.default",
                      borderColor: "primary.main",
                    },
                  }}
                >
                  {["deepseek-r1", "gpt-4", "claude-2", "gemini"].includes(selectedLibrary)
                    ? selectedLibrary === "deepseek-r1" ? "DeepThink (R1)" : selectedLibrary
                    : "DeepThink (R1)"}
                </Button>
                <Menu
                  anchorEl={modelButtonRef.current}
                  open={modelMenuOpen}
                  onClose={() => setModelMenuOpen(false)}
                >
                  <MenuItem
                    onClick={() => {
                      setSelectedLibrary("deepseek-r1");
                      setModelMenuOpen(false);
                    }}
                  >
                    DeepThink (R1)
                  </MenuItem>
                  <MenuItem
                    onClick={() => {
                      setSelectedLibrary("gpt-4");
                      setModelMenuOpen(false);
                    }}
                  >
                    GPT-4
                  </MenuItem>
                  <MenuItem
                    onClick={() => {
                      setSelectedLibrary("claude-2");
                      setModelMenuOpen(false);
                    }}
                  >
                    Claude 2
                  </MenuItem>
                  <MenuItem
                    onClick={() => {
                      setSelectedLibrary("gemini");
                      setModelMenuOpen(false);
                    }}
                  >
                    Gemini
                  </MenuItem>
                </Menu>

                <Button
                  ref={knowledgeButtonRef}
                  variant="outlined"
                  onClick={() => setKnowledgeMenuOpen(true)}
                  startIcon={<SearchIcon />}
                  sx={{
                    borderRadius: 20,
                    textTransform: "none",
                    px: 2,
                    py: 0.5,
                    bgcolor: "background.default",
                    borderColor: "divider",
                    color: "text.primary",
                    maxWidth: 150,
                    "&:hover": {
                      bgcolor: "background.default",
                      borderColor: "primary.main",
                    },
                    "& .MuiButton-startIcon": {
                      flexShrink: 0,
                    },
                    "& .MuiButton-endIcon": {
                      flexShrink: 0,
                    },
                  }}
                >
                  <Typography
                    noWrap
                    sx={{ overflow: "hidden", textOverflow: "ellipsis" }}
                  >
                    {getSelectedLibrariesDisplay()}
                  </Typography>
                </Button>
                <Menu
                  anchorEl={knowledgeButtonRef.current}
                  open={knowledgeMenuOpen}
                  onClose={() => setKnowledgeMenuOpen(false)}
                >
                  <MenuItem
                    onClick={() => {
                      if (activeConversation) {
                        setSelectedLibraries([]);
                      } else {
                        setSelectedLibraries([]);
                      }
                      setSelectedLibrary("");
                      setKnowledgeMenuOpen(false);
                    }}
                  >
                    <Box sx={{ display: "flex", alignItems: "center" }}>
                      <Checkbox
                        checked={selectedLibraries.length === 0}
                        size="small"
                        sx={{ p: 0.5, mr: 1 }}
                      />
                      不使用知识库
                    </Box>
                  </MenuItem>
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
                          ({getDocumentCount(lib.id)}个文档)
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
                      sx={{ mt: 1 }}
                    >
                      确认
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
                    p: 1,
                    "&:hover": { color: "primary.main" },
                  }}
                >
                  <AttachFileIcon />
                </IconButton>

                <IconButton
                  onClick={handleSend}
                  disabled={!input.trim()}
                  sx={{
                    bgcolor: "background.default",
                    color: input.trim() ? "primary.main" : "text.disabled",
                    p: 1,
                    borderRadius: "50%",
                    "&:hover": {
                      bgcolor: "background.default",
                      color: "primary.dark",
                    },
                  }}
                >
                  <ArrowUpwardIcon />
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
                }}
              >
                <Typography variant="h6" gutterBottom>
                  上传文件
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
              <Typography variant="h6">参考来源</Typography>
              <IconButton onClick={() => setSourcesOpen(false)}>
                <CloseIcon />
              </IconButton>
            </Box>
            <SourceViewer sources={currentSources} />
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

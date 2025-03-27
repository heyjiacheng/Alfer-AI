import { useState } from "react";
import {
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Box,
  IconButton,
  TextField,
  Button,
  Typography,
  alpha,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import { useChat } from "../../contexts/ChatContext";
import { Delete, Edit } from "@mui/icons-material";

interface ChatHistoryProps {
  hideNewConversationButton?: boolean;
}

export default function ChatHistory({ hideNewConversationButton = false }: ChatHistoryProps) {
  const { conversations, activeConversation, createNewConversation, switchConversation, deleteConversation, updateConversationTitle } = useChat();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");

  const handleRename = (id: string) => {
    if (newTitle.trim()) {
      updateConversationTitle(id, newTitle.trim());
    }
    setEditingId(null);
    setNewTitle('');
  };

  // 将对话按日期分组
  const getConversationsByDate = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);
    
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const groups: {[key: string]: typeof conversations} = {
      'Today': [],
      'Yesterday': [],
      'Previous 7 Days': [],
      'Previous 30 Days': [],
      'Older': []
    };
    
    conversations.forEach(convo => {
      const convoDate = new Date(convo.createdAt || Date.now());
      
      if (convoDate >= today) {
        groups['Today'].push(convo);
      } else if (convoDate >= yesterday) {
        groups['Yesterday'].push(convo);
      } else if (convoDate >= weekAgo) {
        groups['Previous 7 Days'].push(convo);
      } else if (convoDate >= thirtyDaysAgo) {
        groups['Previous 30 Days'].push(convo);
      } else {
        groups['Older'].push(convo);
      }
    });
    
    return groups;
  };

  const conversationGroups = getConversationsByDate();

  return (
    <Box sx={{ 
      width: '100%',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* 固定在顶部的新建对话按钮 - 可以隐藏 */}
      {!hideNewConversationButton && (
        <Box sx={{ 
          p: 2, 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          position: 'sticky',
          top: 0,
          zIndex: 10,
          backgroundColor: 'transparent',
        }}>
          <Button 
            fullWidth
            variant="contained"
            startIcon={<AddIcon />}
            onClick={createNewConversation} 
            sx={{
              borderRadius: 2,
              py: 0.8,
              boxShadow: 'none',
              '&:hover': {
                boxShadow: '0 2px 5px rgba(0,0,0,0.08)'
              }
            }}
            color="primary">
              新建对话
          </Button>
        </Box>
      )}
      
      {/* 可滚动的对话列表，按日期分组 */}
      <Box sx={{ 
        overflowY: 'auto',
        flex: 1,
        px: 2,
        pt: 1
      }}>
        {Object.entries(conversationGroups).map(([groupName, convos]) => 
          convos.length > 0 && (
            <Box key={groupName} sx={{ mb: 3 }}>
              <Typography 
                variant="body2" 
                color="text.secondary"
                sx={{ 
                  px: 1.5, 
                  mb: 1, 
                  fontWeight: 'medium',
                  fontSize: '0.85rem'
                }}
              >
                {groupName}
              </Typography>
              
              <List sx={{
                p: 0,
                '& .MuiListItem-root': {
                  p: 0.5,
                }
              }}>
                {convos.map(convo => (
                  <ListItem 
                    key={convo.id} 
                    disablePadding
                    sx={{
                      mb: 0.5,
                    }}
                  >
                    <ListItemButton
                      selected={convo.id === activeConversation?.id}
                      onClick={() => switchConversation(convo.id)}
                      sx={{
                        borderRadius: 2,
                        transition: 'all 0.2s',
                        py: 1.2,
                        position: 'relative',
                        overflowX: 'hidden',
                        '&:hover': {
                          backgroundColor: theme => alpha(theme.palette.action.hover, 0.5),
                          boxShadow: '0 1px 6px rgba(0,0,0,0.05)',
                          '& .action-buttons': {
                            opacity: 1,
                            right: 8
                          }
                        },
                        '&.Mui-selected': {
                          backgroundColor: theme => alpha(theme.palette.primary.light, 0.08),
                          '&:hover': {
                            backgroundColor: theme => alpha(theme.palette.primary.light, 0.15),
                          }
                        }
                      }}
                    >
                      {editingId === convo.id ? (
                        <TextField
                          value={newTitle}
                          onChange={(e) => setNewTitle(e.target.value)}
                          onBlur={() => handleRename(convo.id)}
                          onKeyPress={(e) => e.key === 'Enter' && handleRename(convo.id)}
                          autoFocus
                          size="small"
                          fullWidth
                          sx={{
                            '& .MuiOutlinedInput-root': {
                              borderRadius: 1.5
                            }
                          }}
                        />
                      ) : (
                        <>
                          <ListItemText
                            primary={
                              <Typography
                                noWrap
                                sx={{
                                  fontWeight: convo.id === activeConversation?.id ? 'medium' : 'normal',
                                  pr: 7, // 为按钮留出空间
                                  color: theme => convo.id === activeConversation?.id 
                                    ? theme.palette.text.primary 
                                    : alpha(theme.palette.text.primary, 0.95)
                                }}
                              >
                                {convo.title}
                              </Typography>
                            }
                            onDoubleClick={(e) => {
                              e.stopPropagation();
                              setEditingId(convo.id);
                              setNewTitle(convo.title);
                            }}
                          />
                          <Box 
                            className="action-buttons"
                            sx={{ 
                              position: 'absolute', 
                              right: -100, // 初始隐藏
                              top: '50%',
                              transform: 'translateY(-50%)',
                              display: 'flex',
                              opacity: 0,
                              transition: 'all 0.2s ease-in-out',
                              backdropFilter: 'blur(4px)',
                              backgroundColor: theme => alpha(theme.palette.background.paper, 0.4),
                              borderRadius: 1,
                              py: 0.2
                            }}
                          >
                            <IconButton
                              size="small"
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingId(convo.id);
                                setNewTitle(convo.title);
                              }}
                              sx={{ mx: 0.2 }}
                            >
                              <Edit fontSize="small" />
                            </IconButton>
                            <IconButton
                              size="small"
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteConversation(convo.id);
                              }}
                              sx={{ mx: 0.2 }}
                            >
                              <Delete fontSize="small" />
                            </IconButton>
                          </Box>
                        </>
                      )}
                    </ListItemButton>
                  </ListItem>
                ))}
              </List>
            </Box>
          )
        )}
      </Box>
    </Box>
  );
}

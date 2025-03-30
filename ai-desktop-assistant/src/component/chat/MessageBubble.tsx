import React, { useState } from 'react';
import { Box, Typography, Paper, IconButton, TextField, Button, Avatar, Divider, useTheme } from '@mui/material';
import { ChatMessage, useChat  } from '../../contexts/ChatContext';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import EditIcon from '@mui/icons-material/Edit';
import SourceIcon from '@mui/icons-material/Source';

interface MessageBubbleProps {
  message: ChatMessage;
  isUser: boolean;
  onViewSources?: (sources: ChatMessage['sources']) => void;
}

export default React.memo(function MessageBubble({ message, isUser, onViewSources }: MessageBubbleProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState(message.content);
  const { editMessage } = useChat();
  const theme = useTheme(); // 获取当前主题

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditedContent(message.content);
  };

  const handleSave = () => {
    if (editedContent.trim() && editedContent !== message.content) {
      editMessage(message.id, editedContent);
    }
    setIsEditing(false);
  };

  const handleViewSources = () => {
    console.log("View source button clicked, message sources:", message.sources);
    if (message.sources && message.sources.length > 0 && onViewSources) {
      onViewSources(message.sources);
    }
  };

  // Only show sources button if the message is from AI and has sources with actual content
  const hasSources = !isUser && 
    message.sources && 
    Array.isArray(message.sources) && 
    message.sources.length > 0;

  // 根据换行符拆分内容
  const contentLines = message.content.split('\n');

  // 根据主题决定颜色
  const isDarkMode = theme.palette.mode === 'dark';
  const userBubbleBgColor = isDarkMode ? 'rgba(75, 75, 75, 0.95)' : 'rgba(230, 230, 230, 0.95)';
  const dividerColor = isDarkMode ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)';
  const sourceBtnBgColor = isDarkMode ? 'rgba(70, 70, 70, 0.9)' : 'rgba(220, 220, 220, 0.9)';
  const sourceBtnTextColor = isDarkMode ? 'rgba(255, 255, 255, 0.9)' : 'rgba(60, 60, 60, 0.9)';
  
  return (
    <Box sx={{
      display: 'flex', 
      flexDirection: 'column',
      alignItems: 'center', // 居中显示所有消息
      mb: isUser ? 2 : 3, // AI回复底部间距更大
      position: 'relative',
      width: '100%'
    }}>
      {!isUser && (
        // AI回复上方分隔线
        <Box 
          sx={{ 
            width: '100%', 
            maxWidth: '650px',
            mb: 1.5,
            mt: 1
          }}
        >
          <Divider light sx={{ borderColor: dividerColor }} />
        </Box>
      )}
      
      <Box sx={{ 
        display: 'flex',
        flexDirection: 'column',
        alignItems: isUser ? 'flex-end' : 'flex-start',
        width: '100%',
        maxWidth: '650px' // 限制宽度，保持居中
      }}>
        {isUser ? (
          // 用户消息 - 使用灰色背景框
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', width: '100%' }}>
            <Paper
              elevation={1}
              sx={{
                maxWidth: '80%',
                bgcolor: userBubbleBgColor, // 根据主题调整背景色
                color: 'text.primary',
                borderRadius: 3.5, // 更圆润的边角
                p: 2,
                boxShadow: isDarkMode ? '0 1px 3px rgba(0,0,0,0.3)' : '0 1px 2px rgba(0,0,0,0.1)',
                wordWrap: 'break-word',
                whiteSpace: 'pre-wrap',
                overflowWrap: 'break-word',
                wordBreak: 'break-word'
              }}
            >
              {isEditing ? (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <TextField
                    fullWidth
                    multiline
                    value={editedContent}
                    onChange={(e) => setEditedContent(e.target.value)}
                    variant="outlined"
                    size="small"
                    autoFocus
                  />
                  <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                    <Button size="small" onClick={handleCancel}>Cancel</Button>
                    <Button size="small" variant="contained" onClick={handleSave}>Send</Button>
                  </Box>
                </Box>
              ) : (
                <Typography variant="body1" component="div" sx={{ 
                  lineHeight: 1.6,
                  fontSize: '0.95rem'
                }}>
                  {contentLines.map((line, index) => (
                    <span key={index}>
                      {line}
                      {index < contentLines.length - 1 && <br />}
                    </span>
                  ))}
                </Typography>
              )}
            </Paper>
          </Box>
        ) : (
          // AI消息 - 直接显示，没有背景框
          <Box sx={{ 
            width: '100%', 
            pl: 0.5, 
            pr: 0.5,
            position: 'relative'
          }}>
            {/* 左侧回答标记 */}
            <Box 
              sx={{ 
                position: 'absolute',
                left: -10,
                top: 0,
                bottom: 0,
                width: 3,
                borderRadius: 2,
                bgcolor: 'primary.light',
                opacity: isDarkMode ? 0.8 : 0.7, // 深色模式下稍微提高不透明度
                display: { xs: 'none', sm: 'block' }
              }} 
            />
            
            <Typography 
              variant="body1" 
              component="div" 
              sx={{ 
                lineHeight: 1.6,
                color: 'text.primary',
                wordWrap: 'break-word',
                whiteSpace: 'pre-wrap',
                overflowWrap: 'break-word',
                wordBreak: 'break-word',
                fontSize: '0.95rem',
                fontWeight: 400,
                pl: 1.5
              }}
            >
              {contentLines.map((line, index) => (
                <span key={index}>
                  {line}
                  {index < contentLines.length - 1 && <br />}
                </span>
              ))}
            </Typography>
            
            {hasSources && (
              <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-start', pl: 1.5 }}>
                <Button 
                  startIcon={<SourceIcon />} 
                  size="small" 
                  variant="contained"
                  color="inherit" 
                  onClick={handleViewSources}
                  sx={{
                    bgcolor: sourceBtnBgColor,
                    color: sourceBtnTextColor,
                    borderRadius: 2.5, // 更圆润的边角
                    boxShadow: isDarkMode ? '0 2px 8px rgba(0,0,0,0.3)' : '0 2px 4px rgba(0,0,0,0.1)',
                    '&:hover': {
                      bgcolor: isDarkMode ? 'rgba(80, 80, 80, 0.95)' : 'rgba(210, 210, 210, 0.95)',
                      boxShadow: isDarkMode ? '0 4px 12px rgba(0,0,0,0.4)' : '0 4px 8px rgba(0,0,0,0.15)',
                    }
                  }}
                >
                  Sources ({message.sources?.length})
                </Button>
              </Box>
            )}
          </Box>
        )}
        
        {/* 编辑图标移至气泡外部，并减小尺寸 */}
        {isUser && !isEditing && (
          <IconButton 
            size="small" 
            onClick={handleEdit}
            sx={{ 
              padding: 0.5,
              mt: 0.5,
              opacity: 0.5, 
              '&:hover': { opacity: 1 },
              color: 'text.secondary'
            }}
          >
            <EditIcon fontSize="small" sx={{ fontSize: '0.9rem' }} />
          </IconButton>
        )}
      </Box>
      
      {!isUser && (
        // AI回复下方分隔线
        <Box 
          sx={{ 
            width: '100%', 
            maxWidth: '650px',
            mt: 1.5
          }}
        >
          <Divider light sx={{ borderColor: dividerColor }} />
        </Box>
      )}
    </Box>
  );
});
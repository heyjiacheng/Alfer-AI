import React, { useState } from 'react';
import { Box, Typography, Paper, IconButton, TextField, Button, Avatar, useTheme } from '@mui/material';
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

  // 检测并处理代码块
  const processedContent = React.useMemo(() => {
    let inCodeBlock = false;
    let codeBlockStart = -1;
    const blocks = [];

    for (let i = 0; i < contentLines.length; i++) {
      const line = contentLines[i];
      
      if (line.trim().startsWith('```')) {
        if (!inCodeBlock) {
          // 开始代码块
          inCodeBlock = true;
          codeBlockStart = i;
        } else {
          // 结束代码块
          inCodeBlock = false;
          blocks.push({
            type: 'code',
            start: codeBlockStart,
            end: i,
          });
        }
      }
    }

    return blocks;
  }, [contentLines]);

  // 根据主题决定颜色
  const isDarkMode = theme.palette.mode === 'dark';
  const userBubbleBgColor = isDarkMode ? 'rgba(75, 75, 75, 0.95)' : 'rgba(230, 230, 230, 0.95)';
  const dividerColor = isDarkMode ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)';
  const sourceBtnBgColor = isDarkMode ? 'rgba(70, 70, 70, 0.9)' : 'rgba(220, 220, 220, 0.9)';
  const sourceBtnTextColor = isDarkMode ? 'rgba(255, 255, 255, 0.9)' : 'rgba(60, 60, 60, 0.9)';
  const codeBlockBgColor = isDarkMode ? 'rgba(45, 45, 45, 0.95)' : 'rgba(240, 240, 240, 0.95)';
  
  // 渲染单行文本，应用适当的样式
  const renderTextLine = (line: string, index: number, isFirstLine: boolean) => {
    // 检查是否在代码块内
    const isInCodeBlock = processedContent.some(
      block => block.type === 'code' && index > block.start && index < block.end
    );
    const isCodeBlockDelimiter = line.trim().startsWith('```');
    
    if (isCodeBlockDelimiter) {
      return null; // 不显示代码块分隔符
    }
    
    if (isInCodeBlock) {
      return (
        <Box 
          component="span" 
          key={index}
          sx={{
            fontFamily: '"Space Mono", monospace',
            fontSize: '0.9rem',
            whiteSpace: 'pre-wrap',
            display: 'block',
            lineHeight: 1.5
          }}
        >
          {line}
        </Box>
      );
    }
    
    // 普通文本行
    return (
      <span 
        key={index} 
        style={
          isFirstLine && !isUser ? { 
            fontSize: '1.1rem', 
            fontWeight: 500,
            display: 'block',
            marginBottom: '8px'
          } : {}
        }
      >
        {line}
        {index < contentLines.length - 1 && <br />}
      </span>
    );
  };

  // 渲染代码块
  const renderCodeBlock = (startIndex: number, endIndex: number) => {
    const codeContent = contentLines.slice(startIndex + 1, endIndex).join('\n');
    const language = contentLines[startIndex].trim().replace('```', '');
    
    return (
      <Box 
        key={`code-${startIndex}`}
        sx={{
          backgroundColor: codeBlockBgColor,
          padding: 1.5,
          borderRadius: 1,
          marginY: 1.5,
          overflowX: 'auto',
          position: 'relative'
        }}
      >
        {language && (
          <Typography 
            variant="caption" 
            sx={{ 
              position: 'absolute',
              top: 0,
              right: 8,
              color: 'text.secondary',
              fontSize: '0.75rem',
              fontFamily: '"Space Mono", monospace'
            }}
          >
            {language}
          </Typography>
        )}
        <Typography
          component="pre"
          sx={{
            fontFamily: '"Space Mono", monospace',
            fontSize: '0.9rem',
            lineHeight: 1.5,
            margin: 0,
            overflowX: 'auto',
            whiteSpace: 'pre-wrap'
          }}
        >
          {codeContent}
        </Typography>
      </Box>
    );
  };

  // 渲染完整内容
  const renderContent = () => {
    if (processedContent.length === 0) {
      // 没有代码块，正常渲染
      return contentLines.map((line, index) => 
        renderTextLine(line, index, index === 0)
      );
    }
    
    // 有代码块，分段渲染
    const result = [];
    let lastEnd = 0;
    
    processedContent.forEach(block => {
      // 添加代码块前的普通文本
      if (block.start > lastEnd) {
        for (let i = lastEnd; i < block.start; i++) {
          result.push(renderTextLine(contentLines[i], i, i === 0));
        }
      }
      
      // 添加代码块
      result.push(renderCodeBlock(block.start, block.end));
      
      lastEnd = block.end + 1;
    });
    
    // 添加最后一个代码块后的普通文本
    if (lastEnd < contentLines.length) {
      for (let i = lastEnd; i < contentLines.length; i++) {
        result.push(renderTextLine(contentLines[i], i, false));
      }
    }
    
    return result;
  };
  
  return (
    <Box sx={{
      display: 'flex', 
      flexDirection: 'column',
      alignItems: 'center', // 居中显示所有消息
      mb: isUser ? 2 : 3, // AI回复底部间距更大
      position: 'relative',
      width: '100%'
    }}>
      <Box sx={{ 
        display: 'flex',
        flexDirection: 'column',
        alignItems: isUser ? 'flex-end' : 'flex-start',
        width: '100%',
        maxWidth: isEditing ? '800px' : '650px' // 编辑状态下增加最大宽度
      }}>
        {isUser ? (
          // 用户消息 - 使用灰色背景框
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', width: '100%' }}>
            <Paper
              elevation={1}
              sx={{
                maxWidth: isEditing ? '98%' : '80%',
                width: isEditing ? '98%' : 'auto',
                bgcolor: userBubbleBgColor, // 根据主题调整背景色
                color: 'text.primary',
                borderRadius: 3.5, // 更圆润的边角
                p: isEditing ? 1.5 : 2,
                boxShadow: isDarkMode ? '0 1px 3px rgba(0,0,0,0.3)' : '0 1px 2px rgba(0,0,0,0.1)',
                wordWrap: 'break-word',
                whiteSpace: 'pre-wrap',
                overflowWrap: 'break-word',
                wordBreak: 'break-word'
              }}
            >
              {isEditing ? (
                <Box 
                  sx={{ 
                    display: 'flex', 
                    flexDirection: 'column', 
                    gap: 1,
                    transition: 'all 0.3s ease-in-out',
                    animation: 'fadeIn 0.2s ease-in-out',
                    '@keyframes fadeIn': {
                      '0%': {
                        opacity: 0,
                        transform: 'translateY(-5px)'
                      },
                      '100%': {
                        opacity: 1,
                        transform: 'translateY(0)'
                      }
                    }
                  }}
                >
                  <TextField
                    fullWidth
                    multiline
                    value={editedContent}
                    onChange={(e) => setEditedContent(e.target.value)}
                    variant="outlined"
                    size="small"
                    autoFocus
                    minRows={1}
                    maxRows={5}
                    inputProps={{
                      style: {
                        width: '100%'
                      }
                    }}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        borderRadius: 2,
                        backgroundColor: 'transparent',
                        '& fieldset': {
                          border: 'none',
                        },
                        '&:hover fieldset': {
                          border: 'none',
                        },
                        '&.Mui-focused fieldset': {
                          border: 'none',
                        },
                        minHeight: '32px',
                        padding: '2px 8px'
                      },
                      '& .MuiInputBase-inputMultiline': {
                        fontFamily: '"Hedvig Sans Serif", sans-serif',
                        fontSize: '1.05rem',
                        lineHeight: 1.3,
                        padding: '4px 8px',
                        maxHeight: '80px',
                        minHeight: '28px',
                        whiteSpace: 'pre-wrap',
                        overflowWrap: 'normal',
                        wordBreak: 'normal'
                      },
                      width: '100%'
                    }}
                  />
                  <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1.5 }}>
                    <Button 
                      size="small" 
                      onClick={handleCancel}
                      sx={{
                        textTransform: 'none',
                        color: isDarkMode ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.6)',
                        fontFamily: '"Space Mono", monospace',
                        fontSize: '0.85rem',
                        py: 0.6,
                        minWidth: 70,
                        borderRadius: 2,
                        '&:hover': {
                          backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.04)',
                        }
                      }}
                    >
                      Cancel
                    </Button>
                    <Button 
                      size="small" 
                      variant="contained" 
                      onClick={handleSave}
                      sx={{
                        textTransform: 'none',
                        backgroundColor: theme.palette.primary.main,
                        color: 'white',
                        fontFamily: '"Space Mono", monospace',
                        fontSize: '0.85rem',
                        py: 0.6,
                        minWidth: 70,
                        borderRadius: 2,
                        boxShadow: isDarkMode ? '0 2px 6px rgba(0,0,0,0.3)' : '0 2px 4px rgba(0,0,0,0.15)',
                        '&:hover': {
                          backgroundColor: theme.palette.primary.dark,
                          boxShadow: isDarkMode ? '0 3px 8px rgba(0,0,0,0.4)' : '0 3px 6px rgba(0,0,0,0.2)',
                        }
                      }}
                    >
                      Send
                    </Button>
                  </Box>
                </Box>
              ) : (
                <Typography variant="body1" component="div" sx={{ 
                  lineHeight: 1.7,
                  fontSize: '1.1rem',
                  fontFamily: '"Hedvig Sans Serif", sans-serif'
                }}>
                  {renderContent()}
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
            <Typography 
              variant="body1" 
              component="div" 
              sx={{ 
                lineHeight: 1.7,
                color: 'text.primary',
                wordWrap: 'break-word',
                whiteSpace: 'pre-wrap',
                overflowWrap: 'break-word',
                wordBreak: 'break-word',
                fontSize: '1.1rem',
                fontWeight: 400,
                pl: 1.5,
                fontFamily: '"Hedvig Sans Serif", sans-serif'
              }}
            >
              {renderContent()}
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
                    },
                    fontFamily: '"Space Mono", monospace',
                    fontSize: '0.85rem'
                  }}
                >
                  Sources ({message.sources?.length})
                </Button>
              </Box>
            )}
          </Box>
        )}
        
        {/* 编辑图标移至气泡外部，并改进样式 */}
        {isUser && !isEditing && (
          <IconButton 
            size="small" 
            onClick={handleEdit}
            sx={{ 
              padding: 0.6,
              mt: 0.8,
              opacity: 0.4, 
              transition: 'all 0.2s ease',
              backgroundColor: isDarkMode ? 'rgba(60, 60, 60, 0.4)' : 'rgba(230, 230, 230, 0.5)',
              '&:hover': { 
                opacity: 1,
                backgroundColor: isDarkMode ? 'rgba(80, 80, 80, 0.7)' : 'rgba(210, 210, 210, 0.8)',
                transform: 'scale(1.1)'
              },
              color: 'text.secondary',
              ml: 1
            }}
          >
            <EditIcon fontSize="small" sx={{ fontSize: '0.9rem' }} />
          </IconButton>
        )}
      </Box>
    </Box>
  );
});
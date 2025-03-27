import React, { useState } from 'react';
import { Box, Typography, Paper, IconButton, TextField, Button, Avatar } from '@mui/material';
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

  return (
    <Box sx={{
      display: 'flex', 
      flexDirection: 'column',
      alignItems: isUser ? 'flex-end' : 'flex-start',
      mb: 2,
      position: 'relative'
    }}>
      <Box sx={{ 
        display: 'flex',
        justifyContent: isUser ? 'flex-end' : 'flex-start',
        width: '100%'
      }}>
        {!isUser && (
          <Box sx={{ mr: 1 }}>
            <Avatar 
              src="/path/to/ai-avatar.png"
              alt="AI"
              sx={{ width: 36, height: 36 }}
            />
          </Box>
        )}
        
        <Paper
          elevation={1}
          sx={{
            maxWidth: '80%',
            bgcolor: isUser ? 'primary.main' : 'background.paper',
            color: isUser ? 'primary.contrastText' : 'text.primary',
            borderRadius: 4,
            p: 2,
            boxShadow: 1,
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
            <>
              <Typography variant="body1" component="div" sx={{ 
                lineHeight: 1.6,
                '& a': {
                  color: isUser ? '#fff' : 'primary.main',
                  wordBreak: 'break-all'
                }
              }}>
                {message.content.split('\n').map((line, index) => (
                  <span key={index}>
                    {line}
                    <br />
                  </span>
                ))}
              </Typography>
              
              {hasSources && (
                <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
                  <Button 
                    startIcon={<SourceIcon />} 
                    size="small" 
                    variant="contained"
                    color="info" 
                    onClick={handleViewSources}
                    sx={{
                      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                      '&:hover': {
                        boxShadow: '0 4px 8px rgba(0,0,0,0.15)',
                      }
                    }}
                  >
                    Sources ({message.sources?.length})
                  </Button>
                </Box>
              )}
            </>
          )}
        </Paper>
      </Box>
      
      {/* 编辑图标移至气泡外部，并减小尺寸 */}
      {isUser && !isEditing && (
        <IconButton 
          size="small" 
          onClick={handleEdit}
          sx={{ 
            padding: 0.5,  // 减小内边距
            mt: 0.5,
            opacity: 0.5, 
            '&:hover': { opacity: 1 } 
          }}
        >
          <EditIcon fontSize="small" sx={{ fontSize: '0.9rem' }} />
        </IconButton>
      )}
    </Box>
  );
});
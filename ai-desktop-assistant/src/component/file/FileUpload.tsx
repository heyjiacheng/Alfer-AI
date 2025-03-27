import { useDropzone } from 'react-dropzone';
import { Box, Typography, IconButton, List, ListItem, ListItemText, CircularProgress } from '@mui/material';
import { Delete, InsertDriveFile, Close } from '@mui/icons-material';
import { useChat } from '../../contexts/ChatContext';
import { documentApi } from '../../services/api';
import { useKnowledge } from '../../contexts/KnowledgeContext';
import { useState } from 'react';

interface FileUploadAreaProps {
  onClose: () => void;
}

export default function FileUploadArea({ onClose }: Readonly<FileUploadAreaProps>) {
  const { activeConversation, addFiles, removeFile } = useChat();
  const files = activeConversation?.files || [];
  const { activeLib } = useKnowledge();
  const [uploading, setUploading] = useState(false);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: async (acceptedFiles: File[]) => {
      if (!activeLib) {
        console.error('No active library selected');
        return;
      }

      setUploading(true);
      
      try {
        const uploadPromises = acceptedFiles.map(async (file) => {
          try {
            // 读取文件为ArrayBuffer
            const arrayBuffer = await file.arrayBuffer();
            
            // 直接使用fetch API上传
            const response = await documentApi.upload(activeLib, {
              name: file.name,
              file: arrayBuffer
            });
            
            // 成功后将文件添加到聊天上下文
            addFiles([{
              id: response.document_id,
              name: file.name,
              size: file.size,
              type: file.type,
              uploadTime: new Date()
            }]);
            
            return { success: true };
          } catch (error) {
            console.error(`Failed to upload ${file.name}:`, error);
            return { success: false };
          }
        });
        
        await Promise.all(uploadPromises);
      } catch (error) {
        console.error('Upload failed:', error);
      } finally {
        setUploading(false);
      }
    },
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg'],
      'application/pdf': ['.pdf'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'text/plain': ['.txt']
    },
    maxSize: 20 * 1024 * 1024 // 20MB
  });

  return (
    <Box sx={{ 
      mb: 2,
      border: '1px solid #eee',
      borderRadius: 2,
      p: 2,
      position: 'relative'
    }}>
      <IconButton 
        onClick={onClose}
        sx={{ position: 'absolute', right: 8, top: 8 }}
      >
        <Close fontSize="small" />
      </IconButton>

      <Box
        {...getRootProps()}
        sx={{
          border: '2px dashed',
          borderColor: isDragActive ? 'primary.main' : 'divider',
          borderRadius: 2,
          p: 2,
          textAlign: 'center',
          cursor: 'pointer',
          bgcolor: isDragActive ? 'action.hover' : 'background.paper',
          mb: 2,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100px'
        }}
      >
        <input {...getInputProps()} />
        {uploading ? (
          <CircularProgress size={24} />
        ) : (
          <>
            <InsertDriveFile fontSize="large" color="action" />
            <Typography variant="body2" color="textSecondary">
              {isDragActive ? '释放文件以上传' : '拖放文件至此或点击上传'}
            </Typography>
            <Typography variant="caption" color="textSecondary" sx={{ mt: 1 }}>
              支持PDF, Word, 文本, 图片 (最大20MB)
            </Typography>
          </>
        )}
      </Box>

      {files.length > 0 && (
        <List dense>
          {files.map((file) => (
            <ListItem key={file.id}>
              <InsertDriveFile color="action" sx={{ mr: 1 }} />
              <ListItemText
                primary={file.name}
                secondary={`${(file.size / 1024).toFixed(1)}KB`}
              />
              <IconButton 
                edge="end" 
                onClick={() => removeFile(file.id)}
                size="small"
              >
                <Delete fontSize="small" />
              </IconButton>
            </ListItem>
          ))}
        </List>
      )}
    </Box>
  );
}
import { useDropzone, type FileError } from 'react-dropzone';
import { Box, Typography, IconButton, List, ListItem, ListItemText, ListItemAvatar, Avatar } from '@mui/material';
import { Delete, InsertDriveFile, Close } from '@mui/icons-material';
import { useChat } from '../../contexts/ChatContext';

interface FileUploadAreaProps {
  onClose: () => void;
}

export default function FileUploadArea({ onClose }: Readonly<FileUploadAreaProps>) {
  const { activeConversation, addFiles, removeFile } = useChat();
  
  const files = activeConversation?.files || [];

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: async (acceptedFiles, rejectedFiles) => {
      const mappedFiles = acceptedFiles.map((file: File) => ({
        id: Math.random().toString(36).slice(2, 9),
        name: file.name,
        size: file.size,
        type: file.type,
        uploadTime: new Date()
      }));
      addFiles(mappedFiles);
    },
    onDropRejected: (rejectedFiles) => {
      rejectedFiles.forEach(({ file, errors }) => {
        errors.forEach(error => {
          if (error.code === 'file-too-large') {
            alert(`文件 ${file.name} 过大: ${error.message}`);
          }
        });
      });
    },
    validator: (file) => {
      if (file.size > 30 * 1024 * 1024) {
        return {
          code: 'file-too-large',
          message: `文件超过30MB限制 (当前: ${(file.size/1024/1024).toFixed(1)}MB)`
        } satisfies FileError;
      }
      
      const invalidCharacters = /[\\/:*?"<>|]/.test(file.name);
      const isHiddenFile = file.name.startsWith('.') || file.name.startsWith('~$');
      
      if (invalidCharacters) {
        return {
          code: 'invalid-filename',
          message: '文件名包含非法字符'
        } satisfies FileError;
      }
      
      if (isHiddenFile) {
        return {
          code: 'hidden-file',
          message: '不支持隐藏文件'
        } satisfies FileError;
      }

      return null;
    },
    accept: {
      'application/*': ['.pdf', '.doc', '.docx'],
      'image/*': ['.png', '.jpg', '.jpeg'],
      'text/plain': ['.txt']
    },
    maxSize: 30 * 1024 * 1024,
    multiple: true
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
          mb: 2
        }}
      >
        <input {...getInputProps()} />
        <InsertDriveFile fontSize="large" color="action" />
        <Typography variant="body2" color="textSecondary">
          {isDragActive ? '释放文件以上传' : '拖放文件至此或点击上传'}
        </Typography>
      </Box>

      <Typography variant="caption" sx={{ mt: 1, display: 'block' }}>
        支持格式：PDF（最大30MB）, Word, 文本, 图片
      </Typography>

      {files.length > 0 && (
        <Box sx={{ 
          display: 'flex', 
          alignItems: 'center',
          mb: 1,
          color: 'text.secondary'
        }}>
          <InsertDriveFile fontSize="small" color="inherit" />
          <Typography variant="body2" sx={{ ml: 1 }}>
            {files.length}个文件已准备就绪
          </Typography>
        </Box>
      )}

      <List sx={{ maxHeight: 200, overflow: 'auto' }}>
        {files.map((file, index) => (
          <ListItem 
            key={index} 
            secondaryAction={
              <IconButton edge="end" onClick={() => removeFile(file.id)}>
                <Delete fontSize="small" />
              </IconButton>
            }
            sx={{ py: 0.5 }}
          >
            <ListItemAvatar sx={{ minWidth: 40 }}>
              <Avatar sx={{ width: 28, height: 28 }}>
                <InsertDriveFile fontSize="small" />
              </Avatar>
            </ListItemAvatar>
            <ListItemText 
              primary={
                <Typography 
                  variant="body2" 
                  noWrap 
                  sx={{ 
                    maxWidth: '180px', 
                    overflow: 'hidden', 
                    textOverflow: 'ellipsis' 
                  }}
                >
                  {file.name}
                </Typography>
              }
              secondary={`${(file.size / 1024).toFixed(1)}KB`}
            />
          </ListItem>
        ))}
      </List>
    </Box>
  );
}
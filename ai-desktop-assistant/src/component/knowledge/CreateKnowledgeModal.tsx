import { useState, useEffect } from 'react';
import { 
  Dialog, 
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField, 
  Button, 
  Box, 
  IconButton, 
  List, 
  ListItem, 
  ListItemText, 
  CircularProgress, 
  Typography, 
  Divider,
  Chip,
  alpha
} from '@mui/material';
import { useDropzone } from 'react-dropzone';
import { Delete, Close, InsertDriveFile, Add } from '@mui/icons-material';
import { useKnowledge } from '../../contexts/KnowledgeContext';

interface CreateKnowledgeModalProps {
  open: boolean;
  onClose: () => void;
  library?: any;
  mode: "create" | "edit";
}

export default function CreateKnowledgeModal({ open, onClose, library, mode }: CreateKnowledgeModalProps) {
  const { 
    createLibrary, 
    updateLibrary, 
    addDocumentToLib, 
    removeDocumentFromLib, 
    deleteLibrary, 
    documents
  } = useKnowledge();
  
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) {
      setName('');
      setDescription('');
      setFiles([]);
    }
    if (mode === "edit" && library) {
      setName(library.name);
      setDescription(library.description || '');
    }
  }, [open, mode, library]);

  const { getRootProps, getInputProps } = useDropzone({
    onDrop: (acceptedFiles) => {
      setFiles((prev) => [...prev, ...acceptedFiles]);
    },
    accept: {
      'application/pdf': ['.pdf'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'text/plain': ['.txt'],
      'application/json': ['.json']
    }
  });

  const handleSubmit = async () => {
    setLoading(true);
    try {
      if (mode === "create") {
        // Create library first
        const newLibId = await createLibrary(name, description);
        
        // Add documents to the newly created library
        for (const file of files) {
          const content = await readFileContents(file);
          await addDocumentToLib(newLibId, {
            name: file.name,
            type: file.type,
            size: file.size,
            content,
            libraryId: newLibId,
          });
        }
      } else if (library) {
        // Update library name and description
        await updateLibrary(library.id, { 
          name, 
          description
        });
        
        // Add new documents
        for (const file of files) {
          const content = await readFileContents(file);
          await addDocumentToLib(library.id, {
            name: file.name,
            type: file.type,
            size: file.size,
            content,
            libraryId: library.id,
          });
        }
      }
      onClose();
    } catch (error) {
      console.error("处理知识库操作时出错:", error);
      // 这里可以添加错误提示UI
    } finally {
      setLoading(false);
    }
  };

  // 根据文件类型选择合适的读取方法
  const readFileContents = (file: File): Promise<string> => {
    if (file.type === 'text/plain') {
      // 文本文件可以直接读取文本内容
      return file.text();
    } else {
      // 对于 PDF 和其他二进制文件，使用 readAsDataURL
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          if (typeof reader.result === 'string') {
            resolve(reader.result);
          } else {
            reject(new Error('读取文件失败'));
          }
        };
        reader.onerror = () => reject(new Error('读取文件失败'));
        reader.readAsDataURL(file);
      });
    }
  };

  const existingDocuments = documents.filter((doc) =>
    mode === "edit" && library ? doc.libraryId === library.id : false
  );

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="md" 
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 3,
          overflow: 'hidden'
        }
      }}
    >
      <DialogTitle sx={{ 
        p: 3,
        paddingBottom: 1,
        position: 'relative',
        fontWeight: 'medium'
      }}>
        {mode === 'create' ? '创建知识库' : '编辑知识库'}
        <IconButton 
          sx={{ position: 'absolute', right: 8, top: 8 }} 
          onClick={onClose}
        >
          <Close />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ 
        p: 3, 
        pt: 2,
        bgcolor: theme => alpha(theme.palette.background.paper, 0.9),
        backdropFilter: 'blur(10px)',
      }}>
        <Box sx={{ mb: 3 }}>
          <TextField
            fullWidth
            label="知识库名称"
            value={name}
            onChange={(e) => setName(e.target.value)}
            sx={{ mb: 2 }}
            variant="outlined"
          />
          
          <TextField
            fullWidth
            label="知识库描述"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            sx={{ mb: 2 }}
            multiline
            rows={2}
            variant="outlined"
            placeholder="描述这个知识库的内容和用途"
          />
        </Box>

        <Divider sx={{ my: 2 }} />
        
        <Typography variant="subtitle1" sx={{ mb: 1 }}>
          添加文档
        </Typography>

        <Box {...getRootProps()} sx={{ 
          border: '2px dashed #ccc', 
          p: 3, 
          mb: 2, 
          cursor: 'pointer',
          borderRadius: 2,
          bgcolor: theme => alpha(theme.palette.background.default, 0.4),
          '&:hover': { borderColor: 'primary.main' }
        }}>
          <input {...getInputProps()} />
          <Box textAlign="center">
            <InsertDriveFile fontSize="large" color="action" />
            <Typography>拖放文件至此或点击上传</Typography>
            <Typography variant="caption" color="text.secondary">
              支持PDF、Word、TXT和JSON格式
            </Typography>
          </Box>
        </Box>

        <Typography variant="subtitle1" gutterBottom>
          已上传文档
          {(existingDocuments.length > 0 || files.length > 0) && 
            <Chip 
              label={existingDocuments.length + files.length} 
              size="small" 
              sx={{ ml: 1 }} 
              color="primary" 
              variant="outlined"
            />
          }
        </Typography>

        <List sx={{ 
          maxHeight: 200, 
          overflow: 'auto',  
          mb: 2,
          bgcolor: theme => alpha(theme.palette.background.paper, 0.3),
          borderRadius: 1,
          '&::-webkit-scrollbar': {
            width: '6px',
          },
          '&::-webkit-scrollbar-thumb': {
            backgroundColor: theme => alpha(theme.palette.text.secondary, 0.1),
            borderRadius: '6px',
          }
        }}>
          {existingDocuments.length === 0 && files.length === 0 && (
            <ListItem sx={{ py: 3 }}>
              <ListItemText 
                primary={
                  <Typography 
                    align="center" 
                    color="text.secondary"
                  >
                    暂无文档
                  </Typography>
                } 
              />
            </ListItem>
          )}
          
          {existingDocuments.map((doc) => (
            <ListItem key={doc.id} secondaryAction={
              <IconButton 
                edge="end" 
                onClick={() => removeDocumentFromLib(doc.libraryId, doc.id)}
                size="small"
                sx={{
                  color: 'error.main',
                  '&:hover': {
                    bgcolor: theme => alpha(theme.palette.error.main, 0.1)
                  }
                }}
              >
                <Delete fontSize="small" />
              </IconButton>
            }>
              <ListItemText 
                primary={
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <InsertDriveFile fontSize="small" sx={{ mr: 1, opacity: 0.6 }} />
                    <Typography 
                      noWrap 
                      sx={{ 
                        maxWidth: '280px', 
                        overflow: 'hidden', 
                        textOverflow: 'ellipsis' 
                      }}
                    >
                      {doc.name}
                    </Typography>
                  </Box>
                } 
                secondary={`${(doc.size / 1024).toFixed(1)}KB`} 
              />
            </ListItem>
          ))}
          {files.map((file, index) => (
            <ListItem key={`${file.name}-${file.size}-${index}`} secondaryAction={
              <IconButton 
                edge="end" 
                onClick={() => setFiles(files.filter((_, i) => i !== index))}
                size="small"
                sx={{
                  color: 'error.main',
                  '&:hover': {
                    bgcolor: theme => alpha(theme.palette.error.main, 0.1)
                  }
                }}
              >
                <Delete fontSize="small" />
              </IconButton>
            }>
              <ListItemText 
                primary={
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <InsertDriveFile fontSize="small" sx={{ mr: 1, opacity: 0.6 }} />
                    <Typography 
                      noWrap 
                      sx={{ 
                        maxWidth: '280px', 
                        overflow: 'hidden', 
                        textOverflow: 'ellipsis' 
                      }}
                    >
                      {file.name}
                    </Typography>
                  </Box>
                } 
                secondary={`${(file.size / 1024).toFixed(1)}KB`} 
              />
            </ListItem>
          ))}
        </List>
      </DialogContent>

      <DialogActions sx={{ p: 3, pt: 1, gap: 2 }}>
        {mode === 'edit' && (
          <Button 
            variant="outlined" 
            color="error"
            onClick={() => {
              deleteLibrary(library.id);
              onClose();
            }}
            startIcon={<Delete />}
          >
            删除知识库
          </Button>
        )}
        <Box sx={{ flexGrow: 1 }} />
        <Button 
          variant="contained" 
          onClick={handleSubmit}
          disabled={loading || !name.trim()}
        >
          {loading ? <CircularProgress size={24} /> : mode === 'create' ? '创建知识库' : '保存更改'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

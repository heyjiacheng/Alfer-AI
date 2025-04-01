import { useState, useEffect, useCallback } from 'react';
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

// 辅助函数：将字节转换为可读格式
const bytesToSize = (bytes: number): string => {
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  if (bytes === 0) return '0 Byte';
  const i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)).toString());
  return Math.round(bytes / Math.pow(1024, i)) + ' ' + sizes[i];
};

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
      
      // 在更新状态之前直接关闭窗口，减少状态变化导致的闪烁
      onClose();
    } catch (error) {
      console.error("Error processing knowledge base operation:", error);
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
            reject(new Error('Failed to read file'));
          }
        };
        reader.onerror = () => reject(new Error('Failed to read file'));
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
        fontWeight: 'medium',
        fontFamily: '"Sora", sans-serif'
      }}>
        {mode === 'create' ? 'Create Knowledge Base' : 'Edit Knowledge Base'}
        <IconButton 
          sx={{ position: 'absolute', right: 8, top: 8 }} 
          onClick={() => {
            // 在对话框关闭时立即执行关闭函数
            onClose();
          }}
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
        <Box sx={{ mb: 3, mt: 1.5 }}>
          <TextField
            fullWidth
            label="Knowledge Base Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            sx={{ 
              mb: 2,
              '& .MuiInputLabel-root': {
                fontFamily: '"Space Mono", monospace'
              },
              '& .MuiOutlinedInput-input': {
                fontFamily: '"Space Mono", monospace'
              }
            }}
            variant="outlined"
            required
          />
          
          <TextField
            fullWidth
            label="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            sx={{ 
              mb: 2,
              '& .MuiInputLabel-root': {
                fontFamily: '"Space Mono", monospace'
              },
              '& .MuiOutlinedInput-input': {
                fontFamily: '"Space Mono", monospace'
              }
            }}
            multiline
            rows={2}
            variant="outlined"
          />
        </Box>

        <Divider sx={{ my: 2 }} />
        
        <Typography variant="subtitle1" sx={{ mb: 1 }}>
          Add Documents
        </Typography>

        <Box 
          {...getRootProps()} 
          sx={{
            border: '2px dashed',
            borderColor: 'divider',
            borderRadius: 2,
            p: 3,
            textAlign: 'center',
            cursor: 'pointer',
            bgcolor: theme => alpha(theme.palette.background.default, 0.4),
            '&:hover': {
              borderColor: 'primary.main',
              bgcolor: theme => alpha(theme.palette.background.default, 0.6),
            },
            mb: 2
          }}
        >
          <input {...getInputProps()} />
          <InsertDriveFile sx={{ fontSize: 40, color: 'text.secondary', mb: 1 }} />
          <Typography sx={{ fontFamily: '"Sora", sans-serif', mb: 1 }}>
            Drag & drop files here, or click to select files
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ fontFamily: '"Space Mono", monospace' }}>
            Supports PDF, Word, TXT and JSON formats
          </Typography>
        </Box>

        <Typography variant="subtitle1" gutterBottom>
          Uploaded Documents
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

        {existingDocuments.length > 0 && (
          <>
            <Typography variant="subtitle1" sx={{ fontFamily: '"Sora", sans-serif', fontWeight: 600, mt: 3, mb: 1 }}>
              Documents
            </Typography>
            <List sx={{ 
              bgcolor: theme => alpha(theme.palette.background.default, 0.4),
              borderRadius: 2,
              overflow: 'hidden'
            }}>
              {existingDocuments.map((doc) => (
                <ListItem
                  key={doc.id}
                  secondaryAction={
                    <IconButton 
                      edge="end"
                      onClick={() => {
                        if (library) {
                          removeDocumentFromLib(library.id, doc.id);
                        }
                      }}
                    >
                      <Delete fontSize="small" />
                    </IconButton>
                  }
                >
                  <ListItemText 
                    primary={doc.name} 
                    primaryTypographyProps={{ 
                      fontFamily: '"Space Mono", monospace',
                      fontSize: '0.9rem'
                    }}
                    secondary={`${bytesToSize(doc.size)}`} 
                    secondaryTypographyProps={{ 
                      fontFamily: '"Space Mono", monospace',
                      fontSize: '0.75rem'
                    }}
                  />
                </ListItem>
              ))}
            </List>
          </>
        )}

        {files.map((file, index) => (
          <ListItem 
            key={index}
            secondaryAction={
              <IconButton 
                edge="end" 
                onClick={() => setFiles(prev => prev.filter((_, i) => i !== index))}
              >
                <Delete fontSize="small" />
              </IconButton>
            }
          >
            <ListItemText 
              primary={file.name} 
              primaryTypographyProps={{ 
                fontFamily: '"Space Mono", monospace',
                fontSize: '0.9rem'
              }}
              secondary={bytesToSize(file.size)} 
              secondaryTypographyProps={{ 
                fontFamily: '"Space Mono", monospace',
                fontSize: '0.75rem'
              }}
            />
          </ListItem>
        ))}
      </DialogContent>

      <DialogActions sx={{ p: 3, pt: 2 }}>
        {mode === "edit" && (
          <Button 
            onClick={async () => {
              if (library) {
                await deleteLibrary(library.id);
                onClose();
              }
            }} 
            color="error"
            variant="outlined"
            startIcon={<Delete />}
            sx={{ 
              mr: 'auto',
              fontFamily: '"Space Mono", monospace',
              textTransform: 'none'
            }}
          >
            Delete
          </Button>
        )}
        <Button 
          onClick={onClose} 
          sx={{ 
            fontFamily: '"Space Mono", monospace',
            textTransform: 'none'
          }}
        >
          Cancel
        </Button>
        <Button 
          onClick={handleSubmit} 
          variant="contained" 
          disabled={!name.trim() || loading}
          sx={{ 
            fontFamily: '"Space Mono", monospace',
            textTransform: 'none'
          }}
        >
          {loading ? (
            <CircularProgress size={24} />
          ) : mode === 'create' ? 'Create' : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

import { Accordion, AccordionSummary, Typography, List, ListItemButton, Box, IconButton, alpha, Button, Tooltip, TextField, Dialog, DialogTitle, DialogContent, DialogActions } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { useKnowledge, KnowledgeLibrary, KnowledgeFolder } from '../../contexts/KnowledgeContext';
import CreateKnowledgeModal from './CreateKnowledgeModal';
import { Edit, Delete, Add, Folder, FolderOutlined, MoreVert } from '@mui/icons-material';
import { useState } from 'react';

export default function KnowledgeBase() {
  const { libraries, folders, deleteLibrary, documents, updateFolder, deleteFolder } = useKnowledge();
  const [knowledgeModalOpen, setKnowledgeModalOpen] = useState(false);
  const [selectedLib, setSelectedLib] = useState<KnowledgeLibrary | null>(null);
  const [editFolderDialogOpen, setEditFolderDialogOpen] = useState(false);
  const [editFolderData, setEditFolderData] = useState<{id: string, name: string} | null>(null);
  
  const handleEdit = (lib: KnowledgeLibrary) => {
    setSelectedLib(lib);
    setKnowledgeModalOpen(true);
  };

  const handleCreateKnowledge = () => {
    setSelectedLib(null);
    setKnowledgeModalOpen(true);
  };

  const getDocumentCount = (libId: string) => {
    return documents.filter(doc => doc.libraryId === libId).length;
  };

  const handleEditFolder = (folder: KnowledgeFolder) => {
    setEditFolderData({
      id: folder.id,
      name: folder.name
    });
    setEditFolderDialogOpen(true);
  };

  const submitEditFolder = () => {
    if (editFolderData && editFolderData.name.trim()) {
      updateFolder(editFolderData.id, editFolderData.name);
      setEditFolderDialogOpen(false);
      setEditFolderData(null);
    }
  };

  return (
    <Box sx={{ px: 2, py: 1 }}>
      <CreateKnowledgeModal
        open={knowledgeModalOpen}
        onClose={() => {
          setKnowledgeModalOpen(false);
          setSelectedLib(null);
        }}
        library={selectedLib}
        mode={selectedLib ? 'edit' : 'create'}
      />

      {/* 编辑文件夹对话框 */}
      <Dialog 
        open={editFolderDialogOpen} 
        onClose={() => setEditFolderDialogOpen(false)}
        PaperProps={{
          sx: { borderRadius: 2 }
        }}
      >
        <DialogTitle>编辑文件夹</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="文件夹名称"
            fullWidth
            variant="outlined"
            value={editFolderData?.name || ''}
            onChange={(e) => setEditFolderData(prev => prev ? {...prev, name: e.target.value} : null)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditFolderDialogOpen(false)}>取消</Button>
          <Button 
            onClick={submitEditFolder} 
            disabled={!editFolderData?.name.trim()}
            variant="contained"
          >
            保存
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* 移除知识库标题，但保留一些间距 */}
      <Box sx={{ 
        mb: 1
      }}>
      </Box>
      
      {/* 知识库列表 */}
      <List sx={{ pt: 0.5, pb: 0 }}>
        {libraries.map(lib => (
          <ListItemButton 
            key={lib.id} 
            sx={{ 
              position: 'relative',
              pl: 3,
              pr: 2,
              py: 1,
              mb: 0.5,
              borderRadius: 2,
              transition: 'all 0.2s',
              '&:hover': {
                backgroundColor: theme => alpha(theme.palette.action.hover, 0.5),
                boxShadow: '0 1px 6px rgba(0,0,0,0.05)',
                '& .action-buttons': {
                  opacity: 1,
                  right: 8
                }
              },
            }}
          >
            <Box sx={{ 
              display: 'flex', 
              alignItems: 'center', 
              width: '100%', 
              overflow: 'hidden' 
            }}>
              <Typography 
                noWrap 
                sx={{ 
                  textOverflow: 'ellipsis', 
                  overflow: 'hidden',
                  fontSize: '0.9rem'
                }}
              >
                {lib.name}
              </Typography>
              <Typography variant="caption" sx={{ ml: 1, flexShrink: 0, color: 'text.secondary' }}>
                ({getDocumentCount(lib.id)}个文件)
              </Typography>
            </Box>
            <Box 
              className="action-buttons"
              sx={{ 
                position: 'absolute', 
                right: -60, 
                display: 'flex', 
                gap: 0.5,
                opacity: 0,
                transition: 'all 0.2s ease-in-out',
                backdropFilter: 'blur(4px)',
                backgroundColor: theme => alpha(theme.palette.background.paper, 0.4),
                borderRadius: 1,
                py: 0.2
              }}
            >
              <IconButton onClick={(e) => { e.stopPropagation(); handleEdit(lib); }} size="small" sx={{ mx: 0.2 }}>
                <Edit fontSize="small" />
              </IconButton>
              <IconButton onClick={(e) => { e.stopPropagation(); deleteLibrary(lib.id); }} size="small" sx={{ mx: 0.2 }}>
                <Delete fontSize="small" color="error" />
              </IconButton>
            </Box>
          </ListItemButton>
        ))}
      </List>
      
    </Box>
  );
}
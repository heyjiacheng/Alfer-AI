import { Accordion, AccordionSummary, Typography, List, ListItem, ListItemButton, Box, IconButton, alpha, Button, Tooltip, TextField, Dialog, DialogTitle, DialogContent, DialogActions, ListItemText } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { useKnowledge, KnowledgeLibrary, KnowledgeFolder } from '../../contexts/KnowledgeContext';
import CreateKnowledgeModal from './CreateKnowledgeModal';
import { Edit, Delete, Add, Folder, FolderOutlined, MoreVert } from '@mui/icons-material';
import { useState, useCallback, useMemo } from 'react';

export default function KnowledgeBase() {
  const { libraries, folders, deleteLibrary, documents, updateFolder, deleteFolder, selectedLibraryId, selectLibrary } = useKnowledge();
  const [knowledgeModalOpen, setKnowledgeModalOpen] = useState(false);
  const [selectedLib, setSelectedLib] = useState<KnowledgeLibrary | null>(null);
  const [editFolderDialogOpen, setEditFolderDialogOpen] = useState(false);
  const [editFolderData, setEditFolderData] = useState<{id: string, name: string} | null>(null);
  const [forceRender, setForceRender] = useState(0);
  
  const handleEdit = useCallback((lib: KnowledgeLibrary) => {
    setSelectedLib(lib);
    setKnowledgeModalOpen(true);
  }, []);

  const handleCreateKnowledge = useCallback(() => {
    setSelectedLib(null);
    setKnowledgeModalOpen(true);
  }, []);

  const getDocumentCount = useCallback((libId: string) => {
    return documents.filter(doc => doc.libraryId === libId).length;
  }, [documents]);

  const handleEditFolder = useCallback((folder: KnowledgeFolder) => {
    setEditFolderData({
      id: folder.id,
      name: folder.name
    });
    setEditFolderDialogOpen(true);
  }, []);

  const submitEditFolder = useCallback(() => {
    if (editFolderData && editFolderData.name.trim()) {
      updateFolder(editFolderData.id, editFolderData.name);
      setEditFolderDialogOpen(false);
      setEditFolderData(null);
    }
  }, [editFolderData, updateFolder]);

  // 处理知识库点击
  const handleLibraryClick = useCallback((libId: string) => {
    console.log("当前选中的知识库:", selectedLibraryId);
    console.log("点击的知识库:", libId);
    
    // 如果点击的是已选中的知识库，则取消选择
    if (libId === selectedLibraryId) {
      console.log("取消选择知识库");
      selectLibrary(null);
    } else {
      console.log("选择新的知识库:", libId);
      selectLibrary(libId);
    }
  }, [selectLibrary, selectedLibraryId]);

  // 使用useMemo缓存列表，避免重新渲染时的闪烁
  const libraryList = useMemo(() => {
    return libraries.map(lib => (
      <ListItem 
        key={`${lib.id}-${lib.name}-${forceRender}`}
        disablePadding 
        sx={{ 
          mb: 0.01, // 调整为与ChatHistory完全一致
        }}
      >
        <ListItemButton
          onClick={(e) => {
            // 只有当点击的不是按钮时才执行选择知识库操作
            if (!e.defaultPrevented) {
              handleLibraryClick(lib.id);
            }
          }}
          sx={{ 
            position: 'relative',
            pl: 2,
            pr: 2,
            py: 0.6,
            borderRadius: 2,
            transition: 'all 0.2s',
            width: '100%',
            maxWidth: '100%',
            overflowX: 'hidden',
            display: 'flex !important',
            visibility: 'visible !important',
            zIndex: 1,
            cursor: 'pointer',
            '&:hover': {
              backgroundColor: theme => alpha(theme.palette.action.hover, 0.15),
              boxShadow: '0 1px 6px rgba(0,0,0,0.05)',
              '& .action-buttons': {
                opacity: 1,
                right: 8,
                pointerEvents: 'auto' // 确保hover时按钮可点击
              }
            }
          }}
        >
          {/* 使用ListItemText包装Typography以保持一致 */}
          <ListItemText
            primary={
              <Box sx={{ 
                display: 'flex !important', 
                alignItems: 'center', 
                width: '100%', 
                overflow: 'hidden',
                visibility: 'visible !important',
                opacity: '1 !important',
                zIndex: 1,
                position: 'relative',
                pointerEvents: 'none' // 让点击事件穿透到ListItemButton
              }}>
                {/* 使用单一层而非双层结构 */}
                <Typography 
                  noWrap 
                  sx={{ 
                    textOverflow: 'ellipsis', 
                    overflow: 'hidden',
                    fontSize: '0.9rem',
                    pr: 1,
                    fontWeight: 'normal',
                    color: theme => alpha(theme.palette.text.primary, 0.95),
                    visibility: 'visible !important',
                    opacity: '1 !important',
                    display: 'block !important',
                    zIndex: 1,
                    pointerEvents: 'none' // 让点击事件穿透
                  }}
                >
                  {lib.name}
                </Typography>
                <Typography 
                  variant="caption" 
                  sx={{ 
                    ml: 0.3, 
                    flexShrink: 0, 
                    color: 'text.secondary', 
                    visibility: 'visible !important', 
                    opacity: '1 !important',
                    display: 'block !important',
                    zIndex: 1,
                    pointerEvents: 'none' // 让点击事件穿透
                  }}
                >
                  ({getDocumentCount(lib.id)} files)
                </Typography>
              </Box>
            }
            sx={{
              display: 'block !important', 
              visibility: 'visible !important',
              opacity: '1 !important',
              position: 'relative',
              pointerEvents: 'none' // 让点击事件穿透到ListItemButton
            }}
          />
          <Box 
            className="action-buttons"
            sx={{ 
              position: 'absolute', 
              right: -100,
              top: '50%',
              transform: 'translateY(-50%)',
              display: 'flex', 
              gap: 0.5,
              opacity: 0,
              transition: 'all 0.2s ease-in-out',
              backdropFilter: 'blur(4px)',
              backgroundColor: theme => alpha(theme.palette.background.paper, 0.4),
              borderRadius: 1,
              py: 0.2,
              zIndex: 10,
              pointerEvents: 'none' // 默认不接收点击事件，只在hover时接收
            }}
          >
            <IconButton 
              onClick={(e) => { 
                e.preventDefault(); // 防止事件冒泡
                e.stopPropagation(); // 阻止事件冒泡
                handleEdit(lib); 
              }} 
              size="small" 
              sx={{ 
                mx: 0.2,
                zIndex: 20
              }}
            >
              <Edit fontSize="small" />
            </IconButton>
            <IconButton 
              onClick={(e) => { 
                e.preventDefault(); // 防止事件冒泡
                e.stopPropagation(); // 阻止事件冒泡
                deleteLibrary(lib.id); 
              }} 
              size="small" 
              sx={{ 
                mx: 0.2,
                zIndex: 20
              }}
            >
              <Delete fontSize="small" />
            </IconButton>
          </Box>
        </ListItemButton>
      </ListItem>
    ));
  }, [libraries, forceRender, getDocumentCount, handleLibraryClick, handleEdit, deleteLibrary]);

  const handleModalClose = useCallback(() => {
    // 立即设置状态，避免闪烁
    setSelectedLib(null);
    setKnowledgeModalOpen(false);
    // 使用requestAnimationFrame替代setTimeout，更符合浏览器渲染周期
    requestAnimationFrame(() => {
      setForceRender(prev => prev + 1);
    });
  }, []);

  return (
    <Box sx={{ px: 2, py: 0 }}>
      <CreateKnowledgeModal
        open={knowledgeModalOpen}
        onClose={handleModalClose}
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
        <DialogTitle>Edit Folder</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Folder Name"
            fullWidth
            variant="outlined"
            value={editFolderData?.name || ''}
            onChange={(e) => setEditFolderData(prev => prev ? {...prev, name: e.target.value} : null)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditFolderDialogOpen(false)}>Cancel</Button>
          <Button 
            onClick={submitEditFolder} 
            disabled={!editFolderData?.name.trim()}
            variant="contained"
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* 移除知识库标题，间距更小 */}
      <Box sx={{ mb: 0.2 }}></Box>
      
      {/* 知识库列表，防止水平滚动 */}
      <List 
        sx={{ 
          pt: 0, 
          pb: 0, 
          width: '100%', 
          overflowX: 'hidden',
          px: 0, // 移除水平内边距
          '& .MuiListItem-root': {
            p: 0.5, // 与ChatHistory完全一致
          }
        }}
      >
        {libraryList}
      </List>
      
    </Box>
  );
}
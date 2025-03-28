import React, { useState, useEffect } from 'react';
import { Modal, Box, IconButton, Typography, Alert, Button } from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import CloseIcon from '@mui/icons-material/Close';
import LaunchIcon from '@mui/icons-material/Launch';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';

interface PDFViewerProps {
  isOpen: boolean;
  onClose: () => void;
  fileUrl: string;
  fileName: string;
  targetPage?: number;
  highlightText?: string;
}

const PDFViewer: React.FC<PDFViewerProps> = ({ 
  isOpen, 
  onClose, 
  fileUrl, 
  fileName,
  targetPage = 1,
  highlightText 
}) => {
  const [modalWidth, setModalWidth] = useState<number>(900);
  const [error, setError] = useState<boolean>(false);
  const [currentViewerUrl, setCurrentViewerUrl] = useState<string>("");
  const [instanceKey, setInstanceKey] = useState<number>(0);
  
  // 当modal打开时，计算并设置一个新的viewer URL以确保PDF重新加载
  useEffect(() => {
    if (isOpen) {
      const newUrl = (() => {
        let url = fileUrl;
        const separator = url.includes('?') ? '&' : '?';
        url += `${separator}cb=${new Date().getTime()}`;
        url += `#page=${targetPage}`;
        if (highlightText && highlightText.trim()) {
          const searchText = encodeURIComponent(highlightText.trim().substring(0, 30));
          url += `&search=${searchText}`;
        }
        return url;
      })();

      setError(false);
      // Increase the delay to 300ms to ensure the modal mounts before setting the URL
      setTimeout(() => {
        setCurrentViewerUrl(newUrl);
        const checkUrl = async () => {
          try {
            const response = await fetch(newUrl, { method: 'HEAD' });
            setError(!response.ok);
          } catch (e) {
            setError(true);
          }
        };
        checkUrl();
      }, 300);
    }
  }, [isOpen, fileUrl, targetPage, highlightText]);

  // 当modal关闭时，清除当前的viewer URL
  useEffect(() => {
    if (!isOpen) {
      setCurrentViewerUrl("");
    }
  }, [isOpen]);

  // 处理窗口大小调整
  useEffect(() => {
    const handleResize = () => {
      setModalWidth(Math.min(900, window.innerWidth * 0.9));
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // 处理下载PDF
  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = fileUrl;
    link.download = fileName || 'document.pdf';
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // 提取文档ID显示
  const getDocumentId = () => {
    const match = fileUrl.match(/\/documents\/(\d+)\/download/);
    return match ? match[1] : '未知';
  };

  useEffect(() => {
    if (isOpen) {
      setInstanceKey(prev => prev + 1);
    }
  }, [isOpen]);

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      keepMounted={false}
      aria-labelledby="pdf-viewer-modal"
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}
    >
      <Box
        sx={{
          bgcolor: 'background.paper',
          boxShadow: 24,
          p: 2,
          borderRadius: 2,
          maxWidth: modalWidth,
          maxHeight: '90vh',
          width: modalWidth,
          display: 'flex',
          flexDirection: 'column',
          height: '85vh'
        }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6" component="h2" sx={{ flexGrow: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {fileName}
            <Typography variant="caption" display="block" color="text.secondary">
              {`文档ID: ${getDocumentId()}`}
            </Typography>
          </Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              variant="outlined"
              size="small"
              startIcon={<DownloadIcon />}
              onClick={handleDownload}
            >
              下载
            </Button>
            <Button
              variant="outlined"
              size="small"
              startIcon={<LaunchIcon />}
              href={currentViewerUrl}
              target="_blank"
            >
              新窗口
            </Button>
            <IconButton onClick={onClose} size="small">
              <CloseIcon />
            </IconButton>
          </Box>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }} icon={<ErrorOutlineIcon />}>
            无法加载PDF文件。请使用下载或新窗口按钮访问文档。
          </Alert>
        )}

        {/* PDF内容区域 */}
        <Box sx={{ 
          flex: 1,
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 1,
          overflow: 'hidden'
        }}>
          { currentViewerUrl ? (
            <object 
              key={`${instanceKey}-${currentViewerUrl}`}
              data={currentViewerUrl}
              type="application/pdf" 
              width="100%" 
              height="100%"
              style={{ flexGrow: 1 }}
            >
              <Box sx={{ 
                p: 3, 
                textAlign: 'center', 
                height: '100%', 
                display: 'flex', 
                flexDirection: 'column', 
                justifyContent: 'center', 
                alignItems: 'center' 
              }}>
                <Typography variant="body1" gutterBottom>
                  您的浏览器无法直接显示PDF
                </Typography>
                <Box sx={{ mt: 2, display: 'flex', gap: 2 }}>
                  <Button variant="contained" onClick={handleDownload}>
                    下载PDF文件
                  </Button>
                  <Button variant="outlined" href={currentViewerUrl} target="_blank">
                    新窗口打开
                  </Button>
                </Box>
              </Box>
            </object>
          ) : (
            <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Typography>加载PDF中...</Typography>
            </Box>
          )}
        </Box>
        
        {/* 页面信息提示条 */}
        {(targetPage > 1 || highlightText) && (
          <Box sx={{ 
            mt: 1, 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center',
            py: 1
          }}>
            {targetPage > 1 && (
              <Typography variant="caption" color="text.secondary" sx={{ mr: 2 }}>
                已跳转至第 {targetPage} 页
              </Typography>
            )}
            {highlightText && (
              <Typography variant="caption" color="text.secondary">
                搜索文本: {highlightText.substring(0, 20)}{highlightText.length > 20 ? '...' : ''}
              </Typography>
            )}
          </Box>
        )}
      </Box>
    </Modal>
  );
};

export default PDFViewer; 
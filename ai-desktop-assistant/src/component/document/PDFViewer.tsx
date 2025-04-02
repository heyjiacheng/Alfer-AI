import React, { useState, useRef, useEffect } from 'react';
import { Modal, Box, IconButton, Typography, Alert, Button, CircularProgress, Paper, Tooltip, Divider } from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import CloseIcon from '@mui/icons-material/Close';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import FormatQuoteIcon from '@mui/icons-material/FormatQuote';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';

// Import PDF viewer components
import { Viewer, Worker } from '@react-pdf-viewer/core';
import { defaultLayoutPlugin, ToolbarSlot } from '@react-pdf-viewer/default-layout';
import { pageNavigationPlugin } from '@react-pdf-viewer/page-navigation';
import { zoomPlugin } from '@react-pdf-viewer/zoom';

// Import styles
import '@react-pdf-viewer/core/lib/styles/index.css';
import '@react-pdf-viewer/default-layout/lib/styles/index.css';
import '@react-pdf-viewer/page-navigation/lib/styles/index.css';
import './PDFViewerStyles.css';

interface PDFViewerProps {
  isOpen: boolean;
  onClose: () => void;
  fileUrl: string;
  fileName: string;
  targetPage?: number;
  chunkText?: string; // 源文本内容
}

const PDFViewer: React.FC<PDFViewerProps> = ({ 
  isOpen, 
  onClose, 
  fileUrl, 
  fileName,
  targetPage = 1,
  chunkText
}) => {
  const [modalWidth, setModalWidth] = useState<number>(900); // 默认宽度
  const [error, setError] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [pdfLoaded, setPdfLoaded] = useState<boolean>(false);
  const [sourceTextCopied, setSourceTextCopied] = useState<boolean>(false);
  const [showSidebar, setShowSidebar] = useState<boolean>(false);
  
  // 创建插件实例
  const pageNavigationPluginInstance = pageNavigationPlugin();
  const { jumpToPage } = pageNavigationPluginInstance;
  
  // 创建缩放插件
  const zoomPluginInstance = zoomPlugin();
  
  // 创建默认布局插件，但移除上传、下载和打印工具
  const defaultLayoutPluginInstance = defaultLayoutPlugin({
    renderToolbar: (Toolbar) => (
      <Toolbar>
        {(slots: ToolbarSlot) => {
          const {
            CurrentPageInput,
            NumberOfPages,
            GoToNextPage,
            GoToPreviousPage,
            Zoom,
            ZoomIn,
            ZoomOut,
          } = slots;

          return (
            <div className="rpv-toolbar">
              <div className="rpv-toolbar__left">
                <div className="rpv-toolbar__item">
                  <GoToPreviousPage />
                </div>
                <div className="rpv-toolbar__item">
                  <CurrentPageInput />
                </div>
                <div className="rpv-core__display--hidden rpv-core__display--block-medium">
                  <div className="rpv-toolbar__item">
                    <NumberOfPages />
                  </div>
                </div>
                <div className="rpv-toolbar__item">
                  <GoToNextPage />
                </div>
              </div>
              <div className="rpv-toolbar__center">
              </div>
              <div className="rpv-toolbar__right">
                <div className="rpv-toolbar__item">
                  <ZoomOut />
                </div>
                <div className="rpv-toolbar__item">
                  <Zoom />
                </div>
                <div className="rpv-toolbar__item">
                  <ZoomIn />
                </div>
              </div>
            </div>
          );
        }}
      </Toolbar>
    ),
  });
  
  // 创建引用以存储查看器实例
  const viewerRef = useRef<any>(null);
  
  // 定义worker URL，包含fallback
  const [workerUrl, setWorkerUrl] = useState<string>('/pdf/pdf.worker.min.js');
  
  // 检查worker文件是否存在，否则使用CDN
  useEffect(() => {
    fetch('/pdf/pdf.worker.min.js', { method: 'HEAD' })
      .then(response => {
        if (!response.ok) {
          console.warn('本地PDF worker未找到，使用CDN备选');
          setWorkerUrl('https://unpkg.com/pdfjs-dist@3.4.120/build/pdf.worker.min.js');
        }
      })
      .catch(() => {
        console.warn('检查PDF worker时出错，使用CDN备选');
        setWorkerUrl('https://unpkg.com/pdfjs-dist@3.4.120/build/pdf.worker.min.js');
      });
  }, []);
  
  // 处理窗口大小调整
  useEffect(() => {
    const handleResize = () => {
      // 根据是否显示侧边栏调整宽度
      const baseWidth = showSidebar ? 1100 : 900;
      setModalWidth(Math.min(baseWidth, window.innerWidth * 0.95));
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    
    return () => window.removeEventListener('resize', handleResize);
  }, [showSidebar]);
  
  // 初始化
  useEffect(() => {
    if (isOpen) {
      // 打开时重置状态
      setLoading(true);
      setError(false);
      setPdfLoaded(false);
      setSourceTextCopied(false);
      setShowSidebar(false);
      
      // 检查文件URL有效性
      if (fileUrl) {
        const checkUrl = async () => {
          try {
            const response = await fetch(fileUrl, { method: 'HEAD' });
            if (!response.ok) {
              console.error(`文档获取失败: ${response.status}`);
              setError(true);
            }
          } catch (e) {
            console.error('检查文档时出错:', e);
            setError(true);
          } finally {
            setLoading(false);
          }
        };
        
        checkUrl();
      }
    }
  }, [isOpen, fileUrl]);
  
  // 处理复制源文本
  const handleCopySourceText = () => {
    if (chunkText) {
      navigator.clipboard.writeText(chunkText)
        .then(() => {
          setSourceTextCopied(true);
          setTimeout(() => setSourceTextCopied(false), 2000);
        })
        .catch(err => console.error('复制文本失败:', err));
    }
  };
  
  // 当PDF加载完成时的回调
  const handleDocumentLoad = () => {
    setPdfLoaded(true);
    
    // 设置默认缩放
    setTimeout(() => {
      try {
        const scaleActualButtons = document.querySelectorAll('.rpv-zoom__popover-target-scale-actual');
        if (scaleActualButtons.length > 0) {
          (scaleActualButtons[0] as HTMLButtonElement).click();
        }
      } catch (error) {
        console.warn('设置缩放失败:', error);
      }
    }, 300);
  };
  
  // 当PDF视图准备就绪时跳转到指定页面
  useEffect(() => {
    if (pdfLoaded && !loading && !error && targetPage && targetPage > 1) {
      setTimeout(() => {
        try {
          jumpToPage(targetPage - 1);
        } catch (err) {
          console.error('页面跳转失败:', err);
        }
      }, 500);
    }
  }, [pdfLoaded, loading, error, targetPage, jumpToPage]);
  
  // 处理下载
  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = fileUrl;
    link.download = fileName || 'document.pdf';
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  // 提取文档ID以显示
  const getDocumentId = () => {
    const match = fileUrl.match(/\/documents\/(\d+)\/download/);
    return match ? match[1] : '未知';
  };
  
  // 切换侧边栏显示
  const toggleSidebar = () => {
    setShowSidebar(prev => !prev);
  };
  
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
          height: '85vh',
          transition: 'max-width 0.3s ease-in-out, width 0.3s ease-in-out'
        }}
      >
        {/* 头部区域 */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6" component="h2" sx={{ flexGrow: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {fileName}
            <Typography variant="caption" display="block" color="text.secondary">
              {`document ID: ${getDocumentId()}`}
            </Typography>
          </Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            {chunkText && (
              <Button
                variant="outlined"
                size="small"
                color={showSidebar ? "primary" : "inherit"}
                startIcon={showSidebar ? <KeyboardArrowRightIcon /> : <FormatQuoteIcon />}
                onClick={toggleSidebar}
              >
                {showSidebar ? "hide text" : "retrieved text"}
              </Button>
            )}
            <Button
              variant="outlined"
              size="small"
              startIcon={<DownloadIcon />}
              onClick={handleDownload}
            >
              download
            </Button>
            <IconButton onClick={onClose} size="small">
              <CloseIcon />
            </IconButton>
          </Box>
        </Box>
        
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} icon={<ErrorOutlineIcon />}>
            cannot load PDF file. please use the download button to access the document.
          </Alert>
        )}
        
        {/* 主内容区域 */}
        <Box sx={{ 
          flex: 1, 
          display: 'flex', 
          flexDirection: 'row', 
          gap: 2,
          height: 'calc(100% - 80px)',
          overflow: 'hidden'
        }}>
          {/* PDF查看区域 */}
          <Box sx={{ 
            flex: showSidebar ? '1 1 65%' : '1 1 100%',
            display: 'flex',
            flexDirection: 'column',
            position: 'relative',
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 1,
            overflow: 'hidden',
            height: '100%',
            minWidth: 0,
            transition: 'flex 0.3s ease-in-out'
          }}>
            {loading ? (
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                <CircularProgress size={40} />
                <Typography variant="body1" sx={{ ml: 2 }}>
                  loading PDF...
                </Typography>
              </Box>
            ) : error ? (
              <Box sx={{ 
                p: 3, 
                textAlign: 'center', 
                height: '100%', 
                display: 'flex', 
                flexDirection: 'column', 
                justifyContent: 'center', 
                alignItems: 'center' 
              }}>
                <ErrorOutlineIcon sx={{ fontSize: 48, color: 'error.main', mb: 2 }} />
                <Typography variant="body1" gutterBottom>
                  cannot load PDF file
                </Typography>
                <Box sx={{ mt: 2, display: 'flex', gap: 2 }}>
                  <Button variant="contained" onClick={handleDownload}>
                    download PDF file
                  </Button>
                </Box>
              </Box>
            ) : (
              <Worker workerUrl={workerUrl}>
                <div style={{ height: '100%' }} ref={viewerRef}>
                  <Viewer
                    fileUrl={fileUrl}
                    plugins={[
                      defaultLayoutPluginInstance,
                      pageNavigationPluginInstance,
                      zoomPluginInstance,
                    ]}
                    defaultScale={1.0}
                    onDocumentLoad={handleDocumentLoad}
                    renderError={(error: any) => {
                      console.error('PDF渲染错误:', error);
                      setError(true);
                      return (
                        <Alert severity="error" sx={{ m: 2 }}>
                          PDF rendering failed: {error.message || 'unknown error'}
                        </Alert>
                      );
                    }}
                  />
                </div>
              </Worker>
            )}
            
            {/* 页面跳转信息 */}
            {(!loading && !error && targetPage > 1) && (
              <Box sx={{ 
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0, 
                display: 'flex', 
                justifyContent: 'center', 
                alignItems: 'center',
                py: 1,
                bgcolor: 'rgba(255, 255, 255, 0.9)',
                borderTop: '1px solid',
                borderColor: 'divider',
              }}>
                <Typography variant="caption" color="text.secondary">
                  jumped to page {targetPage}
                </Typography>
              </Box>
            )}
          </Box>
          
          {/* 右侧文本预览区域 */}
          {showSidebar && chunkText && (
            <Paper 
              elevation={1} 
              className="source-text-sidebar"
              sx={{ 
                flex: '1 1 35%',
                p: 2,
                borderLeft: '4px solid',
                borderColor: 'primary.main',
                backgroundColor: 'rgba(250, 250, 245, 0.98)',
                display: 'flex',
                flexDirection: 'column',
                maxWidth: '35%',
                height: '100%',
                overflow: 'hidden'
              }}
            >
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="subtitle1" color="primary" fontWeight="medium">
                  <FormatQuoteIcon fontSize="small" sx={{ verticalAlign: 'middle', mr: 1 }} />
                  retrieved text content
                </Typography>
                <Box sx={{ display: 'flex', gap: 0.5 }}>
                  <Tooltip title={sourceTextCopied ? "copied" : "copy full text"}>
                    <IconButton 
                      size="small" 
                      onClick={handleCopySourceText} 
                      color={sourceTextCopied ? "success" : "default"}
                    >
                      <ContentCopyIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="hide text">
                    <IconButton 
                      size="small" 
                      onClick={toggleSidebar}
                    >
                      <KeyboardArrowRightIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Box>
              </Box>
              <Divider sx={{ mb: 2 }} />
              <Box sx={{ overflow: 'auto', flex: 1 }}>
                <Typography variant="body2" sx={{ 
                  whiteSpace: 'pre-wrap', 
                  lineHeight: 1.6,
                  fontFamily: 'system-ui, -apple-system, sans-serif',
                  color: 'text.primary'
                }}>
                  {chunkText}
                </Typography>
              </Box>
              {targetPage > 0 && (
                <Box sx={{ mt: 2, pt: 1, borderTop: '1px solid', borderColor: 'divider' }}>
                  <Typography variant="caption" color="text.secondary" align="center" display="block">
                    content from page {targetPage}
                  </Typography>
                </Box>
              )}
            </Paper>
          )}
        </Box>
      </Box>
    </Modal>
  );
};

export default PDFViewer; 
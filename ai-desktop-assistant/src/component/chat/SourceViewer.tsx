import React, { useEffect, useState } from 'react';
import { Box, Typography, Paper, List, ListItem, Divider, Card, CardContent, Chip, Button, Alert } from '@mui/material';
import { ChatMessage } from '../../contexts/ChatContext';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import PDFViewer from '../document/PDFViewer';
import { documentApi } from '../../services/api';

interface Source {
  document_name: string;
  content_preview: string;
  content?: string;
  page?: number;
  page_label?: string;
  relevance_score?: number;
  metadata?: any;
  document_id?: string;
}

interface SourceViewerProps {
  sources: Source[];
}

export default function SourceViewer({ sources }: SourceViewerProps) {
  const [selectedPdf, setSelectedPdf] = useState<{
    url: string;
    name: string;
    page?: number;
    chunkText?: string;
  } | null>(null);

  useEffect(() => {
    console.log("SourceViewer接收到源信息:", sources);
  }, [sources]);

  const handleOpenPdf = async (source: Source) => {
    // Get document ID from source if available
    const documentName = source?.document_name || '未知文档';
    
    // Better page extraction with fallbacks and validation
    let pageNumber = 1; // Default to page 1
    let pageLabel = null; // For display purposes
    
    // First, try to get the label information (shows what's on the PDF)
    if (source?.page_label) {
      pageLabel = source.page_label;
      console.log(`获取PDF标签页码: ${pageLabel}`);
      
      // If page label is numeric, use it for navigation
      if (typeof pageLabel === 'string' && /^\d+$/.test(pageLabel)) {
        try {
          pageNumber = parseInt(pageLabel, 10);
          console.log(`使用页面标签作为跳转页码: ${pageNumber}`);
        } catch (e) {
          console.warn(`无法解析页面标签 "${pageLabel}" 为数字`);
        }
      }
    } else if (source?.metadata?.page_label) {
      pageLabel = source.metadata.page_label;
      console.log(`从metadata获取页面标签: ${pageLabel}`);
      
      // If page label is numeric, use it for navigation
      if (typeof pageLabel === 'string' && /^\d+$/.test(pageLabel)) {
        try {
          pageNumber = parseInt(pageLabel, 10);
          console.log(`使用metadata页面标签作为跳转页码: ${pageNumber}`);
        } catch (e) {
          console.warn(`无法解析metadata页面标签 "${pageLabel}" 为数字`);
        }
      }
    }
    
    // If no valid page label is found, fall back to page number
    if (!pageNumber || pageNumber < 1) {
      // Try different ways to get the page number
      if (typeof source?.page === 'number') {
        pageNumber = source.page;
        console.log(`直接从source.page获取页码: ${pageNumber}`);
      } else if (source?.metadata?.page && typeof source.metadata.page === 'number') {
        pageNumber = source.metadata.page;
        console.log(`从source.metadata.page获取页码: ${pageNumber}`);
      } else if (source?.metadata?.page && typeof source.metadata.page === 'string') {
        // Try parsing string to number
        const parsed = parseInt(source.metadata.page, 10);
        if (!isNaN(parsed)) {
          pageNumber = parsed;
          console.log(`从string类型的metadata.page解析页码: ${pageNumber}`);
        }
      }
    }
    
    // Ensure page number is at least 1
    pageNumber = Math.max(1, pageNumber);
    
    console.log(`准备打开文档: ${documentName}，页码: ${pageNumber}${pageLabel ? ` (标签: ${pageLabel})` : ''}`);
    
    // Construct document URL
    const documentId = extractDocumentId(source);
    if (!documentId) {
      console.error("无法获取文档ID:", source);
      alert(`无法访问文档: ${documentName}。此文档可能已被删除或不再可用。`);
      return;
    }

    // Use the document download API to get the PDF file URL
    const pdfUrl = documentApi.getDownloadUrl(documentId);
    if (!pdfUrl) {
      console.error("无效的文档ID格式:", documentId);
      alert(`无效的文档ID格式: ${documentId}`);
      return;
    }
    
    // 在打开文档前验证文档是否存在
    try {
      // 使用HEAD请求检查文档是否存在
      const response = await fetch(pdfUrl, { method: 'HEAD' });
      if (!response.ok) {
        console.error(`文档不存在，状态码: ${response.status}`);
        alert(`无法访问文档 "${documentName}"。此文档可能已被删除或不再可用。错误代码: ${response.status}`);
        return;
      }
    } catch (error) {
      console.error("检查文档存在性时出错:", error);
      alert(`访问文档 "${documentName}" 时发生错误。请稍后再试。`);
      return;
    }
    
    console.log(`打开PDF文档: ${documentName}, ID: ${documentId}, 页码: ${pageNumber}`);
    console.log(`PDF URL: ${pdfUrl}`);
    
    // 记录所有可用信息，用于调试
    console.log('文档源数据:', source);
    console.log('提取的ID:', documentId);
    console.log('页码信息:', pageNumber);
    
    // 提取要高亮的chunk文本内容
    const chunkText = getHighlightableText(source);
    console.log('要高亮的文本:', chunkText ? chunkText.substring(0, 100) + '...' : 'None');
    
    // 打开文档查看器，传递整个chunk的文本内容作为高亮
    setSelectedPdf({
      url: pdfUrl,
      name: documentName,
      page: pageNumber,
      chunkText: chunkText
    });
  };

  // 从源数据中提取可高亮的文本内容
  const getHighlightableText = (source: Source): string => {
    // 提取完整的chunk内容用于高亮
    let text = '';
    
    // 首先尝试使用完整内容
    if (source.content && source.content.trim()) {
      text = source.content.trim();
      console.log('使用完整content内容进行高亮');
    } 
    // 退而求其次使用内容预览
    else if (source.content_preview && source.content_preview.trim()) {
      text = source.content_preview.trim();
      console.log('使用content_preview内容进行高亮');
    }
    
    if (text) {
      console.log(`提取到高亮文本，长度:${text.length}字符`);
      return text;
    }
    
    console.log('未找到可用于高亮的文本内容');
    return '';
  };

  // 更新 extractDocumentId 函数，优先使用后端提供的 document_id
  const extractDocumentId = (source: Source): string => {
    // 记录所有提取尝试
    console.log("正在尝试从源数据提取文档ID");
    
    // 首先尝试直接获取后端提供的 document_id
    if (source.document_id) {
      console.log(`使用后端提供的文档ID: ${source.document_id}`);
      return source.document_id.toString();
    }
    
    // 然后尝试从源数据的其他字段中获取ID
    let documentId = (source as any)?.document_id;
    
    // 如果存在metadata，尝试从中提取
    if (!documentId && source?.metadata) {
      documentId = source.metadata.document_id;
    }
    
    // 如果找到了ID，直接返回
    if (documentId) {
      console.log(`找到文档ID: ${documentId}`);
      return documentId.toString();
    }
    
    // 如果无法提取文档ID，返回错误信息
    console.error("无法提取文档ID，内容预览:", source.content_preview);
    return "";
  };

  // 截取内容只显示前十个词
  const truncateContent = (content: string): string => {
    if (!content) return '没有可用的内容预览';
    
    // 分割内容为词
    const words = content.trim().split(/\s+/);
    
    // 如果不足10个词，直接返回
    if (words.length <= 10) return content;
    
    // 否则返回前10个词加省略号
    return words.slice(0, 10).join(' ') + '...';
  };

  const handleClosePdf = () => {
    setSelectedPdf(null);
  };

  if (!sources || !Array.isArray(sources) || sources.length === 0) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography variant="body1" color="text.secondary">
          没有可用的参考来源
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 1, height: '100%', overflow: 'auto' }}>
      <Typography variant="h6" gutterBottom>
        参考来源 ({sources.length})
      </Typography>
      <List>
        {sources.map((source: Source, index) => (
          <React.Fragment key={index}>
            {index > 0 && <Divider variant="inset" component="li" />}
            <ListItem alignItems="flex-start" sx={{ flexDirection: 'column', py: 2 }}>
              <Card variant="outlined" sx={{ width: '100%', mb: 1 }}>
                <CardContent sx={{ '&:last-child': { pb: 2 } }}>
                  <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                    {source?.document_name || '未知文档'}
                  </Typography>
                  
                  <Box sx={{ display: 'flex', gap: 1, mb: 1, flexWrap: 'wrap' }}>
                    {((source?.page !== undefined) || (source?.page_label !== undefined) || 
                      (source?.metadata && (source.metadata.page !== undefined || source.metadata.page_label !== undefined))) && (
                      <Chip 
                        size="small" 
                        label={`页码: ${
                          source?.page_label || source?.metadata?.page_label || 
                          source?.page || source?.metadata?.page || 'N/A'
                        }${
                          source?.page_label && source?.page && source.page_label !== source.page.toString() ? 
                          ` (内部: ${source.page})` : ''
                        }`} 
                        variant="outlined" 
                      />
                    )}
                    {source?.relevance_score !== undefined && (
                      <Chip 
                        size="small" 
                        label={`相关度: ${(typeof source.relevance_score === 'number') 
                          ? source.relevance_score.toFixed(2) 
                          : source.relevance_score}`} 
                        variant="outlined" 
                        color="primary"
                      />
                    )}
                    {source?.metadata?.total_pages && (
                      <Chip 
                        size="small" 
                        label={`总页数: ${source.metadata.total_pages}`} 
                        variant="outlined" 
                      />
                    )}
                  </Box>
                  
                  <Typography variant="body2" color="text.secondary" sx={{ 
                    bgcolor: 'background.default', 
                    p: 1, 
                    borderRadius: 1,
                    maxHeight: '150px',
                    overflow: 'auto'
                  }}>
                    {truncateContent(source?.content_preview || source?.content || '')}
                  </Typography>
                  
                  <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
                    <Button 
                      startIcon={<PictureAsPdfIcon />}
                      size="small" 
                      variant="outlined"
                      onClick={() => handleOpenPdf(source)}
                    >
                      查看文档
                    </Button>
                  </Box>
                </CardContent>
              </Card>
            </ListItem>
          </React.Fragment>
        ))}
      </List>

      {/* PDF Viewer Modal */}
      {selectedPdf && (
        <PDFViewer
          isOpen={!!selectedPdf}
          onClose={handleClosePdf}
          fileUrl={selectedPdf.url}
          fileName={selectedPdf.name}
          targetPage={selectedPdf.page}
          chunkText={selectedPdf.chunkText}
        />
      )}
    </Box>
  );
} 
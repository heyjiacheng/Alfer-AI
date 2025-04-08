import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { Box, Typography, Paper, List, ListItem, Divider, Card, CardContent, Chip, Button, Alert, IconButton } from '@mui/material';
import { ChatMessage } from '../../contexts/ChatContext';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import PDFViewer from '../document/PDFViewer';
import { documentApi } from '../../services/api';
import { useTheme } from '@mui/material/styles';
import { useKnowledge } from '../../contexts/KnowledgeContext';
import { KnowledgeLibrary } from '../../contexts/KnowledgeContext';
import ExpandLess from '@mui/icons-material/ExpandLess';
import ExpandMore from '@mui/icons-material/ExpandMore';
import { alpha } from '@mui/material/styles';

interface Source {
  document_name: string;
  content_preview: string;
  content?: string;
  page?: number;
  page_label?: string;
  relevance_score?: number;
  metadata?: any;
  document_id?: string;
  knowledge_base_id?: number | string;
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
  const { libraries: knowledgeBases } = useKnowledge();

  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    console.log("SourceViewer received source information:", sources);
  }, [sources]);

  const handleDocumentClick = useCallback(async (source: any) => {
    if (!source) return;
    
    const documentId = source?.document_id;
    const documentName = source?.document_name || 'Unknown document';
    let pageNumber = 1; // Default page number is 1
    let pageLabel = null;
    
    // Extract page information from source
    if (source.page_label) {
      pageLabel = source.page_label;
      console.log(`Getting PDF label page number: ${pageLabel}`);
      
      // Try to convert page label to number if possible
      if (typeof pageLabel === 'string' && /^\d+$/.test(pageLabel)) {
        pageNumber = parseInt(pageLabel, 10);
        console.log(`Using page label as jump page number: ${pageNumber}`);
      } else {
        console.warn(`Cannot parse page label "${pageLabel}" as a number`);
      }
    }
    // If no direct page label, try to get from metadata
    else if (source.metadata && source.metadata.page_label) {
      pageLabel = source.metadata.page_label;
      console.log(`Getting page label from metadata: ${pageLabel}`);
      
      // Try to convert page label to number if possible
      if (typeof pageLabel === 'string' && /^\d+$/.test(pageLabel)) {
        pageNumber = parseInt(pageLabel, 10);
        console.log(`Using metadata page label as jump page number: ${pageNumber}`);
      } else {
        console.warn(`Cannot parse metadata page label "${pageLabel}" as a number`);
      }
    }
    
    // If no valid page number from label, try to get from page property directly
    if (pageNumber === 1) {
      if (source.page && typeof source.page === 'number') {
        pageNumber = source.page;
        console.log(`Getting page number directly from source.page: ${pageNumber}`);
      }
      else if (source.metadata && source.metadata.page && typeof source.metadata.page === 'number') {
        pageNumber = source.metadata.page;
        console.log(`Getting page number from source.metadata.page: ${pageNumber}`);
      }
      // Handle string page numbers
      else if (source.metadata && source.metadata.page && typeof source.metadata.page === 'string') {
        try {
          pageNumber = parseInt(source.metadata.page.trim(), 10);
          console.log(`Parsing page number from string type metadata.page: ${pageNumber}`);
          if (isNaN(pageNumber)) pageNumber = 1;
        } catch (e) {
          pageNumber = 1;
        }
      }
    }
    
    console.log(`Preparing to open document: ${documentName}, page number: ${pageNumber}${pageLabel ? ` (label: ${pageLabel})` : ''}`);
    
    if (!documentId) {
      // If document ID is not available, do not attempt to open
      console.error("Cannot get document ID:", source);
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
  }, []);

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
          No available reference sources
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 1, height: '100%', overflow: 'auto' }}>
      <List>
        {sources.map((source: Source, index) => (
          <React.Fragment key={index}>
            {index > 0 && <Divider variant="inset" component="li" />}
            <ListItem alignItems="flex-start" sx={{ flexDirection: 'column', py: 2 }}>
              <Card variant="outlined" sx={{ 
                width: '100%', 
                mb: 1,
                borderRadius: 3,
                boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                '&:hover': {
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                }
              }}>
                <CardContent sx={{ '&:last-child': { pb: 2 } }}>
                  <Box sx={{ display: 'flex', gap: 1, mb: 1.5, flexWrap: 'wrap' }}>
                    {((source?.page !== undefined) || (source?.page_label !== undefined) || 
                      (source?.metadata && (source.metadata.page !== undefined || source.metadata.page_label !== undefined))) && (
                      <Chip 
                        size="small" 
                        label={`Page number: ${
                          source?.page_label || source?.metadata?.page_label || 
                          source?.page || source?.metadata?.page || 'N/A'
                        }${
                          source?.page_label && source?.page && source.page_label !== source.page.toString() ? 
                          ` (internal: ${source.page})` : ''
                        }`} 
                        variant="outlined"
                        sx={{ borderRadius: 2 }}
                      />
                    )}
                    {source?.relevance_score !== undefined && (
                      <Chip 
                        size="small" 
                        label={`Relevance: ${(typeof source.relevance_score === 'number') 
                          ? source.relevance_score.toFixed(2) 
                          : source.relevance_score}`} 
                        variant="outlined" 
                        sx={{ 
                          borderRadius: 2,
                          color: 'text.secondary',
                          borderColor: 'text.secondary'
                        }}
                      />
                    )}
                    {source?.knowledge_base_id && (
                      <Chip 
                        size="small" 
                        label={`Knowledge Base: ${
                          knowledgeBases.find((kb: KnowledgeLibrary) => kb.id === source.knowledge_base_id?.toString())?.name || 
                          source.knowledge_base_id
                        }`}
                        variant="outlined"
                        sx={{ borderRadius: 2 }}
                      />
                    )}
                  </Box>
                  
                  <Typography variant="body2" color="text.secondary" sx={{ 
                    bgcolor: 'background.default', 
                    p: 1.5, 
                    borderRadius: 2,
                    maxHeight: '150px',
                    overflow: 'auto',
                    fontSize: '0.9rem',
                    lineHeight: 1.5
                  }}>
                    {truncateContent(source?.content_preview || source?.content || '')}
                  </Typography>
                  
                  <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
                    <Button 
                      startIcon={<PictureAsPdfIcon />}
                      size="small" 
                      variant="outlined"
                      onClick={() => handleDocumentClick(source)}
                      sx={{ 
                        borderRadius: 2,
                        textTransform: 'none',
                        fontSize: '0.85rem',
                        color: 'text.secondary',
                        borderColor: 'text.secondary',
                        '&:hover': {
                          borderColor: 'text.primary',
                          color: 'text.primary'
                        }
                      }}
                    >
                      View
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
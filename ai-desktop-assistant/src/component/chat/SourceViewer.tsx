import React, { useEffect } from 'react';
import { Box, Typography, Paper, List, ListItem, Divider, Card, CardContent, Chip } from '@mui/material';
import { ChatMessage } from '../../contexts/ChatContext';

interface SourceViewerProps {
  sources: ChatMessage['sources'];
}

export default function SourceViewer({ sources }: SourceViewerProps) {
  useEffect(() => {
    console.log("SourceViewer接收到源信息:", sources);
  }, [sources]);

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
        {sources.map((source, index) => (
          <React.Fragment key={index}>
            {index > 0 && <Divider variant="inset" component="li" />}
            <ListItem alignItems="flex-start" sx={{ flexDirection: 'column', py: 2 }}>
              <Card variant="outlined" sx={{ width: '100%', mb: 1 }}>
                <CardContent sx={{ '&:last-child': { pb: 2 } }}>
                  <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                    {source?.document_name || '未知文档'}
                  </Typography>
                  
                  <Box sx={{ display: 'flex', gap: 1, mb: 1, flexWrap: 'wrap' }}>
                    {((source?.page !== undefined) || (source?.metadata && source.metadata.page !== undefined)) && (
                      <Chip 
                        size="small" 
                        label={`页码: ${source?.page || (source?.metadata && source.metadata.page) || 'N/A'}`} 
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
                    {source?.content_preview || source?.content || '没有可用的内容预览'}
                  </Typography>
                </CardContent>
              </Card>
            </ListItem>
          </React.Fragment>
        ))}
      </List>
    </Box>
  );
} 
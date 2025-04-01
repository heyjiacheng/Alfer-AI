import { MenuItem, Select, FormControl, InputLabel, ListItemText, Box, Typography } from '@mui/material';
import { useChat } from '../../contexts/ChatContext';
import { useKnowledge } from '../../contexts/KnowledgeContext';
import { useEffect } from 'react';

export default function LibrarySelector() {
  const { selectedLibrary, setSelectedLibrary } = useChat();
  const { libraries } = useKnowledge();
  
  // 调试日志
  useEffect(() => {
    console.log('Current library in LibrarySelector:', selectedLibrary);
    console.log('Libraries available:', libraries);
  }, [selectedLibrary, libraries]);

  const handleLibraryChange = (value: string) => {
    console.log('Setting library to:', value);
    setSelectedLibrary(value);
  };

  return (
    <FormControl variant="outlined" size="small" sx={{ minWidth: 150, m: 1 }}>
      <InputLabel id="library-select-label">知识库</InputLabel>
      <Select
        labelId="library-select-label"
        value={selectedLibrary || ""}
        onChange={(e) => handleLibraryChange(e.target.value)}
        label="知识库"
        renderValue={(selected) => {
          if (!selected) {
            return <Typography sx={{ color: 'text.secondary', fontStyle: 'italic' }}>直接对话</Typography>;
          }
          
          const lib = libraries.find(l => l.id === selected);
          return lib ? lib.name : "直接对话";
        }}
      >
        <MenuItem value="">
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Typography>直接对话</Typography>
            <Typography variant="caption" sx={{ ml: 1, color: 'text.secondary' }}>
              (不使用知识库)
            </Typography>
          </Box>
        </MenuItem>
        
        {libraries.map((lib) => (
          <MenuItem key={lib.id} value={lib.id}>
            <ListItemText 
              primary={lib.name} 
              secondary={lib.description || "没有描述"}
              secondaryTypographyProps={{ noWrap: true, style: { maxWidth: '200px' } }}
            />
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
} 
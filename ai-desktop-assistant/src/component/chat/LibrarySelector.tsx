import { MenuItem, Select, FormControl, InputLabel, ListItemText, Box, Typography } from '@mui/material';
import { useChat } from '../../contexts/ChatContext';
import { useKnowledge } from '../../contexts/KnowledgeContext';
import { useEffect } from 'react';

export default function LibrarySelector() {
  const { selectedLibrary, setSelectedLibrary } = useChat();
  const { libraries } = useKnowledge();
  
  // Debug logs
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
      <InputLabel id="library-select-label">Knowledge Base</InputLabel>
      <Select
        labelId="library-select-label"
        value={selectedLibrary || ""}
        onChange={(e) => handleLibraryChange(e.target.value)}
        label="Knowledge Base"
        renderValue={(selected) => {
          if (!selected) {
            return <Typography sx={{ color: 'text.secondary', fontStyle: 'italic' }}>Direct Chat</Typography>;
          }
          
          const lib = libraries.find(l => l.id === selected);
          return lib ? lib.name : "Direct Chat";
        }}
      >
        <MenuItem value="">
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Typography>Direct Chat</Typography>
            <Typography variant="caption" sx={{ ml: 1, color: 'text.secondary' }}>
              (No knowledge base)
            </Typography>
          </Box>
        </MenuItem>
        
        {libraries.map((lib) => (
          <MenuItem key={lib.id} value={lib.id}>
            <ListItemText 
              primary={lib.name} 
              secondary={lib.description || "No description"}
              secondaryTypographyProps={{ noWrap: true, style: { maxWidth: '200px' } }}
            />
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
} 
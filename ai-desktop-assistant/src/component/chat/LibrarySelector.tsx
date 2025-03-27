import { MenuItem, Select, FormControl, InputLabel, ListItemText, Checkbox } from '@mui/material';
import { useChat } from '../../contexts/ChatContext';
import { useKnowledge } from '../../contexts/KnowledgeContext';
import { useEffect } from 'react';

export default function LibrarySelector() {
  const { selectedLibrary, setSelectedLibrary } = useChat();
  const { libraries } = useKnowledge();
  
  // 调试日志
  useEffect(() => {
    console.log('Current library in LibrarySelector:', selectedLibrary);
    console.log('localStorage library value:', localStorage.getItem('selectedLibrary'));
  }, [selectedLibrary]);

  const handleLibraryChange = (value: string) => {
    console.log('Setting library to:', value);
    setSelectedLibrary(value);
    // 直接设置 localStorage 作为双重保证
    localStorage.setItem('selectedLibrary', value);
  };

  return (
    <FormControl variant="outlined" size="small" sx={{ minWidth: 150, m: 1 }}>
      <InputLabel id="library-select-label">知识库</InputLabel>
      <Select
        labelId="library-select-label"
        value={selectedLibrary}
        onChange={(e) => handleLibraryChange(e.target.value)}
        label="知识库"
      >
        <MenuItem value="">
          <em>全部知识库</em>
        </MenuItem>
        {libraries.map((lib) => (
          <MenuItem key={lib.id} value={lib.id}>
            <ListItemText primary={lib.name} />
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
} 
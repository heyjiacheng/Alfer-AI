import { MenuItem, Select, FormControl, InputLabel } from '@mui/material';
import { useChat } from '../../contexts/ChatContext';
import { useEffect } from 'react';

export default function ModelSelector() {
  const { selectedModel, setSelectedModel } = useChat();
  
  // 调试日志
  useEffect(() => {
    console.log('Current model in ModelSelector:', selectedModel);
    console.log('localStorage model value:', localStorage.getItem('selectedAIModel'));
  }, [selectedModel]);

  const handleModelChange = (value: string) => {
    console.log('Setting model to:', value);
    setSelectedModel(value);
    // 直接设置 localStorage 作为双重保证
    localStorage.setItem('selectedAIModel', value);
  };

  return (
    <FormControl variant="outlined" size="small" sx={{ minWidth: 120, m: 1 }}>
      <InputLabel id="model-select-label">AI 模型</InputLabel>
      <Select
        labelId="model-select-label"
        value={selectedModel}
        onChange={(e) => handleModelChange(e.target.value)}
        label="AI 模型"
      >
        <MenuItem value="deepseek-r1">DeepSeek R1</MenuItem>
        <MenuItem value="gpt-4">GPT-4</MenuItem>
        <MenuItem value="claude-2">Claude 2</MenuItem>
        <MenuItem value="gemini">Google Gemini</MenuItem>
      </Select>
    </FormControl>
  );
}
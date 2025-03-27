// App.tsx
import { Box, ThemeProvider as MuiThemeProvider, createTheme, CssBaseline } from '@mui/material';
import { KnowledgeProvider } from './contexts/KnowledgeContext';
import { BrowserRouter } from 'react-router-dom';
import { ChatProvider } from './contexts/ChatContext';
import LeftSidebar from './component/layout/LeftSidebar.tsx';
import ChatWindow from './component/chat/ChatWindow.tsx';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';

function ThemeWrapper({ children }: { children: React.ReactNode }) {
  const { isDarkMode } = useTheme();
  
  const theme = createTheme({
    palette: {
      mode: isDarkMode ? 'dark' : 'light',
      primary: {
        main: '#562858',
      },
      background: {
        default: isDarkMode ? '#121212' : '#f5f5f5',
        paper: isDarkMode ? '#1E1E1E' : '#FFFFFF'
      }
    }
  });

  return (
    <MuiThemeProvider theme={theme}>
      <CssBaseline />
      {children}
    </MuiThemeProvider>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <ThemeWrapper>
        <BrowserRouter>
          <KnowledgeProvider>
            <ChatProvider>
              <Box sx={{ 
                display: 'flex', 
                height: '100vh',
                bgcolor: 'background.default',
                borderLeft: '1px solid #ddd',
                borderRight: '1px solid #ddd'
              }}>
                <LeftSidebar />
                <ChatWindow />
              </Box>
            </ChatProvider>
          </KnowledgeProvider>
        </BrowserRouter>
      </ThemeWrapper>
    </ThemeProvider>
  );
}
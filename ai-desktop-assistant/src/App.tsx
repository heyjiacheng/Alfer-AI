// App.tsx
import { Box, ThemeProvider as MuiThemeProvider, createTheme, CssBaseline } from '@mui/material';
import { KnowledgeProvider } from './contexts/KnowledgeContext';
import { BrowserRouter } from 'react-router-dom';
import { ChatProvider } from './contexts/ChatContext';
import LeftSidebar from './component/layout/LeftSidebar.tsx';
import ChatWindow from './component/chat/ChatWindow.tsx';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';

// 声明自定义主题变体
declare module '@mui/material/styles' {
  interface Theme {
    status: {
      danger: string;
    };
  }
  interface ThemeOptions {
    status?: {
      danger?: string;
    };
  }
}

// 声明自定义字体变体
declare module '@mui/material/styles/createTypography' {
  interface Typography {
    spaceMono: React.CSSProperties;
  }
  interface TypographyOptions {
    spaceMono?: React.CSSProperties;
  }
}

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
    },
    typography: {
      fontFamily: [
        '-apple-system',
        'BlinkMacSystemFont',
        '"Segoe UI"',
        'Roboto',
        '"Helvetica Neue"',
        'Arial',
        'sans-serif',
        '"Apple Color Emoji"',
        '"Segoe UI Emoji"',
        '"Segoe UI Symbol"',
      ].join(','),
      spaceMono: {
        fontFamily: '"Space Mono", monospace',
      }
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: `
          @font-face {
            font-family: 'Space Mono';
            font-style: normal;
            font-display: swap;
            font-weight: 400;
            src: local('Space Mono'), local('SpaceMono-Regular'), url(https://fonts.gstatic.com/s/spacemono/v6/i7dPIFZifjKcF5UAWdDRYEF8RQ.woff2) format('woff2');
          }
        `,
      },
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
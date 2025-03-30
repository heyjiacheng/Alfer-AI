import { Box, Button, IconButton, Typography, alpha, useMediaQuery, useTheme as useMuiTheme } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import MenuIcon from '@mui/icons-material/Menu';
import { useKnowledge } from '../../contexts/KnowledgeContext';
import KnowledgeBase from '../knowledge/KnowledgeBase';
import ChatHistory from '../../component/chat/ChatHistory.tsx';
import { useTheme } from '../../contexts/ThemeContext';
import Brightness4Icon from '@mui/icons-material/Brightness4';
import Brightness7Icon from '@mui/icons-material/Brightness7';
import CreateKnowledgeModal from '../knowledge/CreateKnowledgeModal';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useChat } from '../../contexts/ChatContext';

export default function LeftSidebar() {
  const { createLibrary } = useKnowledge();
  const { isDarkMode, toggleTheme } = useTheme();
  const [modalOpen, setModalOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [contentVisible, setContentVisible] = useState(true);
  const { switchConversation, createNewConversation } = useChat();
  const navigate = useNavigate();
  const muiTheme = useMuiTheme();
  const isMobile = useMediaQuery(muiTheme.breakpoints.down('md'));

  useEffect(() => {
    if (isMobile) {
      setIsCollapsed(true);
      setContentVisible(false);
    }
  }, [isMobile]);

  const handleLogoClick = () => {
    switchConversation(null as unknown as string);
    navigate('/');
  };

  const toggleSidebar = () => {
    if (isCollapsed) {
      setIsCollapsed(false);
      setTimeout(() => setContentVisible(true), 100);
    } else {
      setContentVisible(false);
      setTimeout(() => setIsCollapsed(true), 200);
    }
  };

  return (
    <>
      {isCollapsed && (
        <IconButton
          onClick={toggleSidebar}
          sx={{
            position: 'fixed',
            top: 20,
            left: 20,
            zIndex: 1200,
            backgroundColor: theme => alpha(theme.palette.background.paper, 0.7),
            backdropFilter: 'blur(5px)',
            '&:hover': {
              backgroundColor: theme => alpha(theme.palette.background.paper, 0.9),
            },
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            borderRadius: 2
          }}
        >
          <MenuIcon />
        </IconButton>
      )}
      
      <Box sx={{ 
        width: isCollapsed ? 0 : 320,
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        bgcolor: theme => alpha(theme.palette.background.paper, 0.3),
        backdropFilter: 'blur(10px)',
        boxShadow: theme => `0px 0px 15px ${alpha(theme.palette.common.black, 0.02)}`,
        transition: theme => theme.transitions.create(['width'], {
          easing: theme.transitions.easing.easeInOut,
          duration: theme.transitions.duration.standard,
        }),
        overflow: 'hidden',
      }}>
        <Box sx={{ 
          opacity: contentVisible ? 1 : 0,
          visibility: contentVisible ? 'visible' : 'hidden',
          transition: theme => theme.transitions.create(['opacity', 'visibility'], {
            easing: theme.transitions.easing.easeInOut,
            duration: contentVisible ? '0.3s' : '0.2s',
            delay: contentVisible ? '0.1s' : '0s'
          }),
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
        }}>
          <Box sx={{ 
            p: 2,
            display: 'flex',
            flexDirection: 'column',
            gap: 1.5,
            position: 'relative'
          }}>
            <IconButton
              onClick={toggleSidebar}
              sx={{
                position: 'absolute',
                top: 10,
                right: 10,
                zIndex: 1,
                backgroundColor: 'transparent',
                '&:hover': {
                  backgroundColor: theme => alpha(theme.palette.action.hover, 0.3),
                }
              }}
              size="small"
            >
              <ChevronLeftIcon fontSize="small" />
            </IconButton>
            
            <Box 
              onClick={handleLogoClick}
              sx={{ 
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                mb: 2,
                cursor: 'pointer',
                '&:hover': { opacity: 0.8 }
              }}
            >
              <img 
                src="/logo.png" 
                alt="Logo" 
                style={{ height: 36, width: 36 }} 
              />
              <Typography variant="h6" component="div">
                Álfer AI
              </Typography>
            </Box>
            
            <Box sx={{ 
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              width: '100%'
            }}>
              <Button
                fullWidth
                variant="contained"
                onClick={() => setModalOpen(true)}
                sx={{ 
                  py: 0.5,
                  borderRadius: 2,
                  bgcolor: 'rgba(0, 0, 0, 0.1)',
                  color: 'text.primary',
                  boxShadow: 'none',
                  textAlign: 'left',
                  justifyContent: 'flex-start',
                  pl: 2,
                  border: '1px solid',
                  borderColor: theme => theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.25)' : 'rgba(0, 0, 0, 0.15)',
                  '&:hover': {
                    bgcolor: 'rgba(0, 0, 0, 0.15)',
                    boxShadow: 'none',
                    borderColor: theme => theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.35)' : 'rgba(0, 0, 0, 0.25)'
                  }
                }}
              >
                New Knowledge Base
              </Button>
            </Box>
          </Box>

          <Box sx={{ 
            height: '35%',
            overflow: 'hidden',
            overflowX: 'hidden',
            '&:hover': { overflow: 'auto', overflowX: 'hidden' },
            '&::-webkit-scrollbar': {
              width: '6px',
            },
            '&::-webkit-scrollbar-thumb': {
              backgroundColor: theme => alpha(theme.palette.text.secondary, 0.1),
              borderRadius: '6px',
            },
            mb: -0.5
          }}>
            <KnowledgeBase />
          </Box>

          <Box sx={{ 
            p: 2, 
            pt: 1,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center'
          }}>
            <Button
              fullWidth
              variant="contained"
              onClick={createNewConversation}
              sx={{ 
                py: 0.5,
                borderRadius: 2,
                bgcolor: 'rgba(0, 0, 0, 0.1)',
                color: 'text.primary',
                boxShadow: 'none',
                textAlign: 'left',
                justifyContent: 'flex-start',
                pl: 2,
                border: '1px solid', 
                borderColor: theme => theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.25)' : 'rgba(0, 0, 0, 0.15)',
                '&:hover': {
                  bgcolor: 'rgba(0, 0, 0, 0.15)',
                  boxShadow: 'none',
                  borderColor: theme => theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.35)' : 'rgba(0, 0, 0, 0.25)'
                }
              }}
            >
              New Conversation
            </Button>
          </Box>

          <Box sx={{ 
            height: '55%',
            overflow: 'hidden',
            '&:hover': { overflow: 'auto' },
            '&::-webkit-scrollbar': {
              width: '6px',
            },
            '&::-webkit-scrollbar-thumb': {
              backgroundColor: theme => alpha(theme.palette.text.secondary, 0.1),
              borderRadius: '6px',
            }
          }}>
            <ChatHistory hideNewConversationButton={true} />
          </Box>

          <Box sx={{ 
            mt: 'auto', 
            p: 2, 
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'center'
          }}>
            <IconButton 
              onClick={toggleTheme}
              color="inherit"
              size="small"
              sx={{
                borderRadius: 2,
                p: 1
              }}
            >
              {isDarkMode ? <Brightness7Icon /> : <Brightness4Icon />}
            </IconButton>
          </Box>
        </Box>

        <CreateKnowledgeModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          mode="create"
        />
      </Box>
    </>
  );
}
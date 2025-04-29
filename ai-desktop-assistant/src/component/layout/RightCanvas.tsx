import { useState, useCallback, useRef, useEffect } from 'react';
import { ReactFlow, Controls, Background, ReactFlowProvider, addEdge, 
  ConnectionMode, applyNodeChanges, applyEdgeChanges, useReactFlow, 
  type NodeChange, type EdgeChange, type Connection, type Edge, type Node } from 'reactflow';
import { Box, Modal } from '@mui/material';
import 'reactflow/dist/style.css';
import { useTheme } from '../../contexts/ThemeContext';
import { Fullscreen, FullscreenExit } from '@mui/icons-material';

// Clearly define node types required by React Flow
interface MindMapNode extends Node {
  id: string;
  position: { x: number; y: number };
  data: { label: string };
  type: 'default';
}

const initialNodes: MindMapNode[] = [
  {
    id: '1',
    position: { x: 0, y: 0 },
    data: { label: 'Node 1' },
    type: 'default'
  },
  {
    id: '2',
    position: { x: 200, y: 100 },
    data: { label: 'Node 2' },
    type: 'default'
  },
];

// Move FlowComponent to an external component
interface FlowComponentProps {
  nodes: MindMapNode[];
  edges: Edge[];
  isDarkMode: boolean;
  isFullscreen: boolean;
  setIsFullscreen: (value: boolean) => void;
  setNodes: React.Dispatch<React.SetStateAction<MindMapNode[]>>;
  setEdges: (edges: Edge[]) => void;
  nodeIdCounter: number;
  setNodeIdCounter: React.Dispatch<React.SetStateAction<number>>;
}

// Add custom modal component
const EditModal = ({ 
  open,
  defaultValue,
  onClose,
  onConfirm
}: {
  open: boolean;
  defaultValue: string;
  onClose: () => void;
  onConfirm: (value: string) => void;
}) => {
  const [inputValue, setInputValue] = useState(defaultValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      // Reset input when modal opens
      setInputValue(defaultValue);
      if (inputRef.current) {
        inputRef.current.focus();
        inputRef.current.select();
      }
    }
  }, [open, defaultValue]); // Add defaultValue dependency

  const handleConfirm = () => {
    onConfirm(inputValue);
    // No need to reset here, since useEffect will handle it on next open
  };

  const handleCancel = () => {
    onClose();
    // No need to reset here, since useEffect will handle it on next open
  };

  return (
    <Modal open={open} onClose={handleCancel}>
      <Box sx={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 300,
        bgcolor: 'background.paper',
        boxShadow: 24,
        p: 3,
        borderRadius: 2
      }}>
        <input
          ref={inputRef}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleConfirm()}
          style={{
            width: '100%',
            padding: '8px',
            marginBottom: '16px'
          }}
        />
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <button onClick={handleConfirm}>Confirm</button>
          <button onClick={handleCancel}>Cancel</button>
        </div>
      </Box>
    </Modal>
  );
};

const FlowComponent = ({
  nodes,
  edges,
  isDarkMode,
  isFullscreen,
  setIsFullscreen,
  setNodes,
  setEdges,
  nodeIdCounter,
  setNodeIdCounter
}: FlowComponentProps) => {
  const { deleteElements } = useReactFlow();
  const [editingNode, setEditingNode] = useState<MindMapNode | null>(null);

  // Full type annotation callback function
  const onNodesChange = useCallback(
    (changes: NodeChange[]) => setNodes(
      applyNodeChanges(changes, nodes) as MindMapNode[]
    ),
    [nodes, setNodes]
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => setEdges(applyEdgeChanges(changes, edges)),
    [edges, setEdges]
  );

  const onConnect = useCallback(
    (connection: Connection) => setEdges(addEdge(connection, edges)),
    [edges, setEdges]
  );

  // Add new node handler
  const addNode = useCallback(() => {
    const newId = nodeIdCounter.toString();
    const newNode: MindMapNode = {
      id: newId,
      position: { 
        x: nodes[nodes.length - 1]?.position.x + 50 || 0,
        y: nodes[nodes.length - 1]?.position.y + 50 || 0
      },
      data: { label: `Node ${nodeIdCounter}` },
      type: 'default'
    };
    
    setNodeIdCounter(prev => prev + 1);
    setNodes(prevNodes => [...prevNodes, newNode]);
  }, [nodes, setNodes, nodeIdCounter, setNodeIdCounter]);

  // Delete selected elements handler
  const deleteSelected = useCallback(() => {
    const selectedNodes = nodes.filter(node => node.selected);
    const selectedEdges = edges.filter(edge => edge.selected);
    
    deleteElements({ nodes: selectedNodes, edges: selectedEdges });
  }, [nodes, edges, deleteElements]);

  const isValidConnection = (connection: Connection) => {
    return connection.source !== connection.target;
  };

  const handleNodeDoubleClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      const currentNode = nodes.find(n => n.id === node.id);
      if (currentNode) {
        setEditingNode(currentNode);
      }
    },
    [nodes]
  );

  const handleConfirmEdit = useCallback((newLabel: string) => {
    if (editingNode && newLabel.trim() !== '') {
      setNodes((prevNodes: MindMapNode[]) => 
        prevNodes.map((n: MindMapNode) => 
          n.id === editingNode.id 
            ? { ...n, data: { ...n.data, label: newLabel } } 
            : n
        )
      );
    }
    setEditingNode(null);
  }, [editingNode, setNodes]);

  return (
    <>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        connectionMode={ConnectionMode.Strict}
        fitView
        defaultEdgeOptions={{
          type: 'smoothstep',
          style: {
            stroke: isDarkMode ? '#fff' : '#000',
          },
        }}
        connectionRadius={20}
        isValidConnection={isValidConnection}
        onNodeDoubleClick={handleNodeDoubleClick}
      >
        <Background />
        {isFullscreen && (
          <div style={{
            position: 'absolute',
            left: '16px',
            top: '16px',
            zIndex: 10,
            display: 'flex',
            gap: '8px'
          }}>
            <button 
              onClick={addNode}
              style={{ 
                padding: '6px 8px',
                background: isDarkMode ? 'rgba(0, 0, 0, 0.7)' : 'rgba(255, 255, 255, 0.9)',
                border: `1px solid ${isDarkMode ? '#555' : '#ccc'}`,
                borderRadius: '4px',
                cursor: 'pointer',
                color: isDarkMode ? '#fff' : '#000',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
              }}
            >
              Add
            </button>
            <button 
              onClick={deleteSelected}
              style={{ 
                padding: '6px 8px',
                background: isDarkMode ? 'rgba(0, 0, 0, 0.7)' : 'rgba(255, 255, 255, 0.9)',
                border: `1px solid ${isDarkMode ? '#555' : '#ccc'}`,
                borderRadius: '4px',
                cursor: 'pointer',
                color: isDarkMode ? '#fff' : '#000',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
              }}
            >
              Del
            </button>
          </div>
        )}
        <Controls
          showZoom={isFullscreen}
          showFitView={isFullscreen}
          showInteractive={isFullscreen}
        >
          <button 
            onClick={() => setIsFullscreen(!isFullscreen)} 
            style={{ 
              padding: 1,
              minWidth: 10,
              minHeight: 10,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            {isFullscreen ? (
              <FullscreenExit fontSize="small" />
            ) : (
              <Fullscreen fontSize="small" />
            )}
          </button>
        </Controls>
      </ReactFlow>

      <EditModal
        open={!!editingNode}
        defaultValue={editingNode?.data.label ?? ''}
        onClose={() => setEditingNode(null)}
        onConfirm={handleConfirmEdit}
      />
    </>
  );
};

export default function RightCanvas() {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [nodes, setNodes] = useState<MindMapNode[]>(initialNodes);
  const [edges, setEdges] = useState<Edge[]>([]);
  const { isDarkMode } = useTheme();
  
  // Add node ID counter
  const [nodeIdCounter, setNodeIdCounter] = useState(
    Math.max(...initialNodes.map(n => parseInt(n.id))) + 1
  );

  return (
    <>
      {/* Default small window - Display when not fullscreen */}
      {!isFullscreen && (
        <Box sx={{
          position: 'relative',
          width: '100%',
          height: '100%',
          borderRadius: 2,
          boxShadow: 3,
          overflow: 'hidden',
          bgcolor: 'background.paper',
          '& .react-flow__controls-button:not(:last-child)': {
            display: 'none' // Hide all controls except fullscreen button
          }
        }}>
          <ReactFlowProvider>
            <FlowComponent
              nodes={nodes}
              edges={edges}
              isDarkMode={isDarkMode}
              isFullscreen={false} // Force small window mode
              setIsFullscreen={setIsFullscreen}
              setNodes={setNodes}
              setEdges={setEdges}
              nodeIdCounter={nodeIdCounter}
              setNodeIdCounter={setNodeIdCounter}
            />
          </ReactFlowProvider>
        </Box>
      )}

      {/* Fullscreen modal */}
      <Modal
        open={isFullscreen}
        onClose={() => setIsFullscreen(false)}
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginLeft: '320px', // Keep sidebar space
          width: 'calc(100% - 320px)'
        }}
      >
        <Box sx={{
          width: '95%',
          height: '95%',
          bgcolor: 'background.paper',
          borderRadius: 2,
          overflow: 'hidden',
          boxShadow: 24,
          position: 'relative' // Fix positioning issue
        }}>
          <ReactFlowProvider>
            <FlowComponent
              nodes={nodes}
              edges={edges}
              isDarkMode={isDarkMode}
              isFullscreen={true} // Force fullscreen mode
              setIsFullscreen={setIsFullscreen}
              setNodes={setNodes}
              setEdges={setEdges}
              nodeIdCounter={nodeIdCounter}
              setNodeIdCounter={setNodeIdCounter}
            />
          </ReactFlowProvider>
        </Box>
      </Modal>
    </>
  );
}
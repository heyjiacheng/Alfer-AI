# Backend_Red_Panda Project Documentation

## Project Overview

Backend_Red_Panda is a knowledge base document management and query system that allows users to upload, manage documents, and perform semantic queries on these documents. The system utilizes vector databases and large language models to achieve intelligent understanding and response capabilities for documents.

## System Architecture

The project mainly consists of the following parts:

1. **Web API Service**: RESTful API based on Flask framework
2. **Document Processing System**: Responsible for document upload, text extraction, and embedding
3. **Vector Database**: Stores semantic vector representations of documents
4. **Query Processing System**: Processes user queries, retrieves relevant document fragments, and uses LLM to generate answers
5. **Session Management System**: Stores and manages conversation history between users and the system

## Core Functional Modules

### 1. Knowledge Base Management

Knowledge Base is a logical collection of documents. The system supports creating multiple knowledge bases, each containing multiple documents.

#### Main Features:
- Create new knowledge base
- Get knowledge base list
- View specific knowledge base details
- Update knowledge base information
- Delete knowledge base

### 2. Document Management

The system supports uploading, downloading, and managing various types of documents (mainly PDF files).

#### Main Features:
- Upload documents to specified knowledge base
- Get list of all documents
- View specific document details
- Download documents
- Delete documents

#### Document Processing Flow:
1. Upload file to temporary directory
2. Perform text extraction (supporting various methods, including OCR)
3. Text chunking processing
4. Generate text embedding vectors
5. Store in vector database
6. Save document metadata to SQLite database

### 3. Vector Embedding System

This system is responsible for converting documents into vector representations to support semantic retrieval.

#### Main Features:
- Document text extraction
- Text chunking
- Vector embedding generation
- Vector storage

#### Technical Highlights:
- Support for multiple text extraction methods
- OCR processing for scanned PDFs
- Intelligent text chunking algorithm
- Use of high-quality text embedding models

### 4. Query Processing System

This system processes user queries, retrieves relevant documents, and uses large language models to generate answers.

#### Main Features:
- Receive user queries
- Query vectorization
- Multi-knowledge base retrieval
- Relevant document fragment retrieval
- Answer generation
- Source document tracing

#### Technical Highlights:
- Multi-query generation technique (generating multiple query variants to improve recall)
- Document relevance scoring
- Reranking of retrieved documents
- Generate answers with source document references

### 5. Session Management System

This system manages conversation history between users and the system.

#### Main Features:
- Create new conversation
- Get conversation list
- View specific conversation details
- Delete conversation
- Add messages to conversation

## Technical Implementation

### Database Structure

The system uses SQLite database to store metadata:

#### Main Tables:
1. **knowledge_bases**: Stores knowledge base information
   - id, name, description, created_at

2. **documents**: Stores document metadata
   - id, original_filename, stored_filename, upload_date, file_path, file_size, metadata, knowledge_base_id, extraction_failed

3. **conversations**: Stores conversation information
   - id, title, created_at, knowledge_base_id

4. **conversation_messages**: Stores conversation messages
   - id, conversation_id, message_type, content, timestamp, sources

### Core Technologies Used

1. **Frameworks and Libraries**:
   - Flask: Web API framework
   - Langchain: LLM application framework
   - Ollama: Locally deployed LLM service

2. **Models**:
   - Text generation: deepseek-r1:1.5b (default, configurable in environment variables)
   - Text embedding: nomic-embed-text

3. **Document Processing**:
   - Multiple text extractors: PyPDFLoader, UnstructuredPDFLoader
   - Text chunking: RecursiveCharacterTextSplitter
   - OCR processing: pdf2image

4. **Vector Storage**:
   - Chroma vector database

## API Endpoints

### Knowledge Base Management
- `GET /knowledge-bases` - Get all knowledge bases
- `POST /knowledge-bases` - Create new knowledge base
- `GET /knowledge-bases/<kb_id>` - Get specific knowledge base details
- `PUT /knowledge-bases/<kb_id>` - Update knowledge base information
- `DELETE /knowledge-bases/<kb_id>` - Delete knowledge base

### Document Management
- `GET /documents` - Get all documents
- `GET /documents?knowledge_base_id=<kb_id>` - Get documents for a specific knowledge base
- `GET /documents/<doc_id>` - Get specific document details
- `GET /documents/<doc_id>/download` - Download document
- `DELETE /documents/<doc_id>` - Delete document
- `POST /upload/<kb_id>` - Upload document to specified knowledge base

### Query Functionality
- `POST /query` - Process query request

### Session Management
- `GET /conversations` - Get all conversations
- `GET /conversations?knowledge_base_id=<kb_id>` - Get conversations for a specific knowledge base
- `POST /conversations` - Create new conversation
- `GET /conversations/<conv_id>` - Get specific conversation details
- `DELETE /conversations/<conv_id>` - Delete conversation
- `POST /conversations/<conv_id>/messages` - Add message to conversation

## Deployment and Configuration

### Environment Setup
1. Install Ollama and download required models:
```bash
# Download language model
ollama run deepseek-r1:1.5b
# Download text embedding model
ollama pull nomic-embed-text
```

2. Install dependencies:
```bash
pip install -r requirements.txt
```

3. Start backend service:
```bash
python3 app.py
```

### Configuration Options
The system provides configuration options through environment variables, which can be set in the `.env` file:
- `TEMP_FOLDER`: Temporary folder path
- `DOCS_STORAGE`: Document storage path
- `DB_PATH`: Database file path
- `LLM_MODEL`: Language model name to use

## Usage Flow Example

### Basic Usage Flow
1. Create knowledge base
2. Upload documents to knowledge base
3. Create new conversation
4. Send query, get answer

### Query Example
When querying, you must specify the knowledge base ID to query, which can be a single or multiple knowledge bases:
```json
{
  "query": "What are the main technologies in the document?",
  "knowledge_base_id": 1
}
```

You can also use direct conversation mode without specifying a knowledge base:
```json
{
  "query": "What is the weather like today?"
}
```

## Advanced Features

### Multi-Knowledge Base Query
The system supports querying multiple knowledge bases simultaneously:
```json
{
  "query": "What are the main technical features?",
  "knowledge_base_ids": [1, 2, 3]
}
```

### Conversation Continuation
You can continue a previous conversation by providing a conversation ID:
```json
{
  "query": "Tell me more about this technology",
  "conversation_id": 123,
  "knowledge_base_id": 1
}
```

## Error Handling

The system provides detailed error messages when an exception occurs, including:
- Missing required parameters
- Knowledge base not found
- Document not found
- File operation errors
- Model initialization errors

## Performance Optimization

The system implements several performance optimizations:
- Vector database for fast semantic retrieval
- Document chunking for efficient processing
- Text embedding caching
- Document relevance scoring
- Multi-query technique to improve recall

## Security Considerations

- File validation to prevent uploading malicious files
- Input validation for all API endpoints
- Resource usage limits to prevent abuse
- Error handling to prevent information leakage

## Future Development

Planned future features:
- Support for more document formats
- More powerful search filtering options
- User authentication and authorization
- Integration with more LLM models
- Performance optimizations for large document collections
- Web UI improvements 
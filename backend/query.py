import os
import json
from typing import List, Dict, Any, Optional
import numpy as np

from langchain_community.chat_models import ChatOllama
from langchain.prompts import ChatPromptTemplate, PromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain_core.documents import Document
from langchain.retrievers.multi_query import MultiQueryRetriever
from get_vector_db import get_vector_db
from db_utils import get_db_connection

# Use environment variables for configuration
LLM_MODEL = os.getenv('LLM_MODEL', 'gemma3:latest')
DB_PATH = os.getenv('DB_PATH', './documents.db')

def get_prompt() -> tuple:
    """
    Create query and answer prompt templates
    
    Returns:
        tuple: A tuple containing query prompt template and answer prompt template
    """
    # Multiple query prompt template - using English prompts for better performance
    query_prompt = PromptTemplate(
        input_variables=["question"],
        template="""You are an AI assistant. Your task is to generate five different versions 
        of the user's question to help retrieve relevant information from a vector database.
        By generating multiple perspectives of the question, you can help overcome some limitations
        of distance-based similarity search. Provide these alternative questions separated by line breaks.
        
        Original question: {question}""",
    )

    # Answer prompt template - using English prompts and ensuring no internal thought process is output
    answer_prompt = ChatPromptTemplate.from_template("""You are an AI assistant from a sweden company named Alfer-AI. Your task is to answer the question based on the context below.
                                                      Provide a direct, concise answer.
    
    Context:
    {context}
    
    Question: {question}
    
    Please provide a clear, professional answer with the language of the question:
    """)

    return query_prompt, answer_prompt

def get_document_metadata(doc_source: str) -> Optional[str]:
    """
    Get the original filename of a document from the database
    
    Parameters:
        doc_source: Document source path
        
    Returns:
        str: Original filename or None
    """
    if not doc_source:
        return None
        
    source_file = os.path.basename(doc_source)
    conn = get_db_connection(DB_PATH)
    cursor = conn.cursor()
    
    try:
        cursor.execute(
            "SELECT original_filename FROM documents WHERE stored_filename = ?", 
            (source_file,)
        )
        result = cursor.fetchone()
        if result:
            return result[0]
        return source_file
    except Exception as e:
        print(f"Error getting document metadata: {str(e)}")
        return source_file
    finally:
        conn.close()

def calculate_relevance_score(query_embedding, doc_embedding):
    """
    Calculate similarity score between query and document embeddings
    
    Parameters:
        query_embedding: Query embedding vector
        doc_embedding: Document embedding vector
        
    Returns:
        float: Similarity score (0-100)
    """
    # Use cosine similarity to calculate relevance
    dot_product = np.dot(query_embedding, doc_embedding)
    query_norm = np.linalg.norm(query_embedding)
    doc_norm = np.linalg.norm(doc_embedding)
    
    if query_norm == 0 or doc_norm == 0:
        return 0
    
    cosine_similarity = dot_product / (query_norm * doc_norm)
    # Convert similarity to percentage score
    return float(max(0, min(100, (cosine_similarity + 1) * 50)))

def format_sources(retrieved_docs: List[Document], query_embedding=None, doc_embeddings=None) -> List[Dict[str, Any]]:
    """
    Format retrieved document source information, including relevance scores
    
    Parameters:
        retrieved_docs: List of retrieved documents
        query_embedding: Query embedding vector (optional)
        doc_embeddings: Document embedding vectors (optional)
        
    Returns:
        List[Dict[str, Any]]: Formatted source information list
    """
    sources = []
    
    # Get database connection
    conn = get_db_connection(DB_PATH)
    cursor = conn.cursor()
    
    for i, doc in enumerate(retrieved_docs):
        # Extract document content
        content = doc.page_content
        
        # Get document metadata
        metadata = doc.metadata
        source_path = metadata.get('source') if metadata else None
        
        # Check if document exists in database
        if source_path:
            source_file = os.path.basename(source_path)
            cursor.execute(
                "SELECT id, original_filename FROM documents WHERE stored_filename = ?", 
                (source_file,)
            )
            result = cursor.fetchone()
            if not result:
                # Skip non-existent document
                print(f"Skipping non-existent document: {source_path}")
                continue
                
            document_id = result['id']
            document_name = result['original_filename']
        else:
            document_name = "Unknown Document"
            # If no source path, document ID cannot be determined
            document_id = None
        
        # Calculate relevance score (if embedding vectors are provided)
        relevance_score = None
        if query_embedding is not None and doc_embeddings is not None and i < len(doc_embeddings):
            relevance_score = calculate_relevance_score(query_embedding, doc_embeddings[i])
        
        # Try to extract page number information from metadata, ensuring it's a numeric type
        page_number = None
        page_label = None
        
        # First try to get page label, which is usually the actual page number displayed in PDF
        if metadata and 'page_label' in metadata:
            try:
                page_label = metadata['page_label']
                # If page label is numeric, convert to integer for jumping
                if isinstance(page_label, str) and page_label.isdigit():
                    page_number = int(page_label)
            except (ValueError, TypeError):
                pass
        
        # If no label or cannot parse, fall back to index page number
        if page_number is None and metadata and 'page' in metadata:
            try:
                # If it's a string, try to convert to integer
                if isinstance(metadata['page'], str):
                    page_number = int(metadata['page'].strip())
                else:
                    page_number = int(metadata['page'])
                
                # Ensure page number is valid (greater than 0)
                if page_number < 1:
                    page_number = 1
            except (ValueError, TypeError):
                print(f"Cannot parse page number: {metadata['page']}, using default value 1")
                page_number = 1
        
        # Create source information object
        source_info = {
            "document_name": document_name,
            "document_id": document_id,  # Add document ID
            "content": content,           # Keep full content for highlighting
            "content_preview": content[:400] + "..." if len(content) > 400 else content,  # Increase preview length to 400 characters
            "relevance_score": relevance_score,
            "page": page_number,  # Directly include processed page number
            "page_label": page_label  # Include original page label
        }
        
        # If there are other metadata, they can be added
        if metadata:
            # Filter out unnecessary large metadata (like embedding vectors)
            filtered_metadata = {k: v for k, v in metadata.items() 
                               if k not in ['source'] and not isinstance(v, (list, np.ndarray)) 
                               or (isinstance(v, list) and len(v) < 20)}
            source_info["metadata"] = filtered_metadata
        
        sources.append(source_info)
    
    # Close database connection
    conn.close()
    
    # Sort sources by relevance score (if any)
    if sources and sources[0].get("relevance_score") is not None:
        sources.sort(key=lambda x: x.get("relevance_score", 0), reverse=True)
        # Filter out sources with relevance score below 70
        sources = [s for s in sources if s.get("relevance_score", 0) >= 70]
    
    return sources

def rerank_documents(query: str, docs: List[Document]) -> List[Document]:
    """
    Re-rank documents to find the most relevant document to the query
    
    Parameters:
        query: User query
        docs: List of retrieved documents
        
    Returns:
        List[Document]: Re-ranked document list
    """
    try:
        # Here you can use third-party re-ranking model, such as CrossEncoder in sentence-transformers
        # Simple implementation: Sort by keyword matching score
        from collections import Counter
        
        # Split query into keywords
        import re
        # Remove punctuation and convert to lowercase
        query_clean = re.sub(r'[^\w\s]', '', query.lower())
        query_terms = set(query_clean.split())
        
        # Calculate how many documents contain how many query keywords
        doc_scores = []
        for doc in docs:
            content_clean = re.sub(r'[^\w\s]', '', doc.page_content.lower())
            content_terms = Counter(content_clean.split())
            
            # Calculate keyword matching score
            score = sum(content_terms[term] for term in query_terms if term in content_terms)
            doc_scores.append((doc, score))
        
        # Sort by score in descending order
        doc_scores.sort(key=lambda x: x[1], reverse=True)
        return [doc for doc, _ in doc_scores]
    except Exception as e:
        print(f"Error re-ranking documents: {str(e)}")
        return docs  # Return original document order if error

def perform_query(input_query: str, kb_id: Optional[int] = None, kb_ids: Optional[List[int]] = None) -> Optional[Dict[str, Any]]:
    """
    Execute query and return answer and sources
    
    Parameters:
        input_query: User input query
        kb_id: Knowledge base ID (optional, single knowledge base query)
        kb_ids: Knowledge base ID list (optional, multiple knowledge base queries)
        
    Returns:
        Dict[str, Any]: Response object containing answer and source information, failure returns dictionary with error information
    """
    if not input_query:
        return {"error": "Query content cannot be empty", "detail": "Please provide a valid query"}
    
    try:
        # Get model name from environment variable and try to match installed model
        import subprocess
        model_name = os.getenv('LLM_MODEL', 'deepseek-r1:14b')
        embedding_model_name = os.getenv('TEXT_EMBEDDING_MODEL', 'nomic-embed-text')
        
        print(f"Using language model: {model_name}")
        print(f"Using embedding model: {embedding_model_name}")
        
        # Initialize language model
        try:
            llm = ChatOllama(model=model_name)
        except Exception as model_error:
            print(f"Error initializing language model: {str(model_error)}")
            # Try using any available model that has been installed
            try:
                process = subprocess.run(['ollama', 'list'], capture_output=True, text=True)
                models = process.stdout.strip().split('\n')[1:]  # Skip title line
                if models:
                    # Extract name of first available model
                    available_model = models[0].split()[0]
                    print(f"Trying to use available model: {available_model}")
                    llm = ChatOllama(model=available_model)
                else:
                    return {
                        "error": "Cannot initialize language model",
                        "detail": f"Specified model {model_name} is not available and no other available models"
                    }
            except Exception as fallback_error:
                return {
                    "error": "Cannot initialize language model",
                    "detail": f"Original error: {str(model_error)}, Fallback error: {str(fallback_error)}"
                }
                
        # If kb_ids are provided, use multiple knowledge base query mode
        if kb_ids and len(kb_ids) > 0:
            print(f"Using multiple knowledge base query mode, Knowledge Base IDs: {kb_ids}")
            return query_multiple_knowledge_bases(input_query, kb_ids, llm)
                
        # If no knowledge base ID is provided, use direct dialog mode
        if kb_id is None and (not kb_ids or len(kb_ids) == 0):
            print("No knowledge base ID provided, using direct dialog mode")
            return direct_ai_chat(input_query, llm)
        
        # Verify knowledge base ID (if provided)
        if kb_id is not None:
            from db_utils import check_knowledge_base_exists
            if not check_knowledge_base_exists(DB_PATH, kb_id):
                return {
                    "error": "Knowledge base does not exist",
                    "detail": f"Knowledge base with ID {kb_id} does not exist"
                }
        
        # Get vector database instance
        try:
            db = get_vector_db(kb_id)
            # Check if vector database is empty
            if hasattr(db, '_collection') and db._collection.count() == 0:
                print(f"Knowledge base {kb_id} is empty, switching to direct dialog mode")
                return direct_ai_chat(input_query, llm, kb_id)
        except Exception as db_error:
            print(f"Error getting vector database: {str(db_error)}, switching to direct dialog mode")
            return direct_ai_chat(input_query, llm, kb_id)
        
        # Get prompt templates
        query_prompt, answer_prompt = get_prompt()

        # Set multiple query retriever
        try:
            retriever = MultiQueryRetriever.from_llm(
                retriever=db.as_retriever(search_kwargs={"k": 8}),
                llm=llm,
                prompt=query_prompt
            )
        except Exception as retriever_error:
            print(f"Error creating retriever: {str(retriever_error)}, switching to direct dialog mode")
            return direct_ai_chat(input_query, llm, kb_id)
        
        # Execute retrieval to get relevant documents
        try:
            retrieved_docs = retriever.get_relevant_documents(input_query)
        except Exception as retrieve_error:
            print(f"Error retrieving documents: {str(retrieve_error)}, switching to direct dialog mode")
            return direct_ai_chat(input_query, llm, kb_id)
        
        if not retrieved_docs:
            print("No relevant documents found, switching to direct dialog mode")
            return direct_ai_chat(input_query, llm, kb_id)
        
        # Re-rank documents to improve relevance
        reranked_docs = rerank_documents(input_query, retrieved_docs)
        
        # Only use the top 4 most relevant documents
        top_docs = reranked_docs[:4]
        
        # Get and format source information (including relevance scores)
        try:
            # Try to get embedding vectors to calculate relevance
            from langchain_community.embeddings import OllamaEmbeddings
            embedding_model = OllamaEmbeddings(model=embedding_model_name)
            query_embedding = embedding_model.embed_query(input_query)
            doc_embeddings = [embedding_model.embed_query(doc.page_content) for doc in top_docs]
            sources = format_sources(top_docs, query_embedding, doc_embeddings)
            
            # Filter out documents with relevance score below 70
            relevant_sources = [s for s in sources if s.get("relevance_score", 0) >= 70]
        except Exception as embed_error:
            print(f"Error calculating relevance score: {str(embed_error)}")
            # Continue without calculating relevance score
            sources = format_sources(top_docs)
            relevant_sources = sources
        
        # If no high relevance documents, use AI to directly answer the question
        if not relevant_sources:
            print("No high relevance documents found, using AI to directly answer the question")
            try:
                direct_prompt = ChatPromptTemplate.from_template("""You are an AI assistant from a sweden company named Alfer-AI. 
                Your task is to answer the question based on your knowledge.
                If you don't know the answer, just say you don't have enough information.
                
                Question: {question}
                
                Please provide a clear, professional answer with the language of the question:
                """)
                
                formatted_prompt = direct_prompt.format(question=input_query)
                raw_answer = llm.invoke(formatted_prompt).content
                
                response = {
                    "answer": raw_answer,
                    "sources": sources,  # Include all sources even if they're low relevance
                    "query": {
                        "original": input_query,
                        "kb_id": kb_id
                    },
                    "note": "No highly relevant information found in the knowledge base. This answer is based on the AI's general knowledge."
                }
                
                return response
            except Exception as llm_error:
                print(f"Error generating direct answer: {str(llm_error)}")
                return {
                    "error": "Cannot generate answer",
                    "detail": str(llm_error)
                }
        
        # Use high relevance documents as context
        context = "\n\n".join([s["content"] for s in relevant_sources])
        
        # Generate answer
        try:
            formatted_prompt = answer_prompt.format(context=context, question=input_query)
            raw_answer = llm.invoke(formatted_prompt).content
        except Exception as llm_error:
            print(f"Error generating answer: {str(llm_error)}")
            return {
                "error": "Cannot generate answer",
                "detail": str(llm_error)
            }
        
        # Assemble final response
        response = {
            "answer": raw_answer,
            "sources": sources,  # Include all sources even if they're low relevance
            "query": {
                "original": input_query,
                "kb_id": kb_id
            }
        }
        
        return response
    except Exception as e:
        print(f"Error executing query: {str(e)}")
        import traceback
        traceback.print_exc()
        return {
            "error": "Query execution failed",
            "detail": str(e)
        }

def query_multiple_knowledge_bases(input_query: str, kb_ids: List[int], llm) -> Dict[str, Any]:
    """
    Query multiple knowledge bases and merge results
    
    Parameters:
        input_query: User input query
        kb_ids: Knowledge base ID list
        llm: Language model instance
        
    Returns:
        Dict[str, Any]: Response object containing answer and merged source information
    """
    try:
        print(f"Starting query multiple knowledge bases: {kb_ids}")
        
        # Get prompt templates
        query_prompt, answer_prompt = get_prompt()
        
        # Store all knowledge base's relevant documents
        all_sources = []
        all_docs = []
        
        # Get embedding model
        embedding_model_name = os.getenv('TEXT_EMBEDDING_MODEL', 'nomic-embed-text')
        from langchain_community.embeddings import OllamaEmbeddings
        embedding_model = OllamaEmbeddings(model=embedding_model_name)
        
        # Query each knowledge base
        for kb_id in kb_ids:
            try:
                print(f"Querying knowledge base {kb_id}")
                
                # Verify knowledge base existence
                from db_utils import check_knowledge_base_exists
                if not check_knowledge_base_exists(DB_PATH, kb_id):
                    print(f"Knowledge base {kb_id} does not exist, skipping")
                    continue
                
                # Get vector database instance
                db = get_vector_db(kb_id)
                
                # Check if vector database is empty
                if hasattr(db, '_collection') and db._collection.count() == 0:
                    print(f"Knowledge base {kb_id} is empty, skipping")
                    continue
                
                # Set multiple query retriever
                try:
                    retriever = MultiQueryRetriever.from_llm(
                        retriever=db.as_retriever(search_kwargs={"k": 5}),  # Each knowledge base gets fewer documents
                        llm=llm,
                        prompt=query_prompt
                    )
                    
                    # Execute retrieval to get relevant documents
                    docs = retriever.get_relevant_documents(input_query)
                    
                    if docs:
                        # Re-rank documents to improve relevance
                        reranked_docs = rerank_documents(input_query, docs)
                        
                        # Only keep the most relevant top 3 documents, avoid too many documents
                        top_docs = reranked_docs[:3]
                        
                        # Calculate embedding vectors
                        query_embedding = embedding_model.embed_query(input_query)
                        doc_embeddings = [embedding_model.embed_query(doc.page_content) for doc in top_docs]
                        
                        # Format source information
                        sources = format_sources(top_docs, query_embedding, doc_embeddings)
                        
                        # Filter out documents with relevance score below 65 (slightly lower threshold for multi-knowledge base query)
                        relevant_sources = [s for s in sources if s.get("relevance_score", 0) >= 65]
                        
                        if relevant_sources:
                            # Add knowledge base ID to source information
                            for source in relevant_sources:
                                source["knowledge_base_id"] = kb_id
                            
                            # Add relevant documents and source information to total list
                            all_sources.extend(relevant_sources)
                            all_docs.extend(top_docs)
                            
                            print(f"Found {len(relevant_sources)} relevant sources from knowledge base {kb_id}")
                        else:
                            print(f"Knowledge base {kb_id} did not find high relevance documents")
                    else:
                        print(f"Knowledge base {kb_id} did not find relevant documents")
                except Exception as e:
                    print(f"Error querying knowledge base {kb_id}: {str(e)}")
                    continue
            except Exception as e:
                print(f"Error processing knowledge base {kb_id}: {str(e)}")
                continue
        
        # If no relevant sources found, use direct dialog mode
        if not all_sources:
            print("No relevant information found in all knowledge bases, using direct dialog mode")
            return direct_ai_chat(input_query, llm)
        
        # Sort all sources by relevance score
        all_sources.sort(key=lambda x: x.get("relevance_score", 0), reverse=True)
        
        # Limit to use at most 10 sources, avoid too long context
        top_sources = all_sources[:10]
        
        # Use high relevance documents as context
        context = "\n\n".join([s["content"] for s in top_sources])
        
        # Generate answer
        try:
            # Use multiple knowledge base template
            multi_kb_prompt = ChatPromptTemplate.from_template("""You are an AI assistant from a sweden company named Alfer-AI. 
            Your task is to answer the question based on the context provided from multiple knowledge bases.
            Synthesize information from all relevant sources to provide a comprehensive answer.
            Make sure to consider information from all knowledge bases.
            
            Context:
            {context}
            
            Question: {question}
            
            Please provide a clear, professional answer with the language of the question:
            """)
            
            formatted_prompt = multi_kb_prompt.format(context=context, question=input_query)
            raw_answer = llm.invoke(formatted_prompt).content
            
            # Assemble final response
            response = {
                "answer": raw_answer,
                "sources": top_sources,
                "query": {
                    "original": input_query,
                    "kb_ids": kb_ids
                },
                "is_multi_kb_query": True
            }
            
            return response
        except Exception as llm_error:
            print(f"Error generating multi-knowledge base answer: {str(llm_error)}")
            return {
                "error": "Cannot generate answer",
                "detail": str(llm_error)
            }
    except Exception as e:
        print(f"Error querying multiple knowledge bases: {str(e)}")
        import traceback
        traceback.print_exc()
        return direct_ai_chat(input_query, llm)

def direct_ai_chat(input_query: str, llm, kb_id=None):
    """
    Use AI directly for dialog, without using knowledge base
    
    Parameters:
        input_query: User input query
        llm: Language model instance
        kb_id: Knowledge base ID (optional, only for recording)
        
    Returns:
        Dict[str, Any]: Response object containing answer
    """
    try:
        # Use simple prompt template for direct dialog
        direct_prompt = ChatPromptTemplate.from_template("""You are an AI assistant from a sweden company named Alfer-AI. 
        Your task is to answer the question based on your knowledge.
        If you don't know the answer, just say you don't have enough information.
        
        Question: {question}
        
        Please provide a clear, professional answer with the language of the question:
        """)
        
        formatted_prompt = direct_prompt.format(question=input_query)
        raw_answer = llm.invoke(formatted_prompt).content
        
        response = {
            "answer": raw_answer,
            "sources": [],  # No knowledge base documents as source
            "query": {
                "original": input_query,
                "kb_id": kb_id
            },
            "is_direct_chat": True  # Mark this is direct dialog mode
        }
        
        return response
    except Exception as e:
        print(f"Error in direct dialog mode: {str(e)}")
        return {
            "error": "Answer generation failed",
            "detail": str(e)
        }
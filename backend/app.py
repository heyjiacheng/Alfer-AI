import os
import sqlite3
import tempfile
from datetime import datetime
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS  # Import the CORS extension
from embed import embed_document
from query import perform_query
from db_utils import init_database, get_db_connection, create_conversation, get_conversation, get_conversations, delete_conversation, save_conversation_message
import json


# Define constants
TEMP_FOLDER = os.getenv('TEMP_FOLDER', './_temp')
DOCS_STORAGE = os.getenv('DOCS_STORAGE', './documents')
DB_PATH = os.getenv('DB_PATH', './documents.db')

# Ensure necessary directories exist
os.makedirs(TEMP_FOLDER, exist_ok=True)
os.makedirs(DOCS_STORAGE, exist_ok=True)

# Initialize Flask application
app = Flask(__name__)
# Enable CORS for all routes
CORS(app, origins="*")
# Initialize database
init_database(DB_PATH)

# ================ Knowledge Base Management API ================

@app.route('/knowledge-bases', methods=['GET'])
def list_knowledge_bases():
    """Get all knowledge bases list"""
    conn = get_db_connection(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM knowledge_bases ORDER BY created_at DESC")
    knowledge_bases = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return jsonify({"knowledge_bases": knowledge_bases})

@app.route('/knowledge-bases', methods=['POST'])
def create_knowledge_base():
    """Create a new knowledge base"""
    data = request.get_json()
    
    if not data or 'name' not in data:
        return jsonify({"error": "name is required"}), 400
    
    name = data.get('name')
    description = data.get('description', '')
    
    conn = get_db_connection(DB_PATH)
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO knowledge_bases (name, description) VALUES (?, ?)",
        (name, description)
    )
    kb_id = cursor.lastrowid
    conn.commit()
    conn.close()
    
    return jsonify({
        "message": "success with knowledge",
        "knowledge_base_id": kb_id
    }), 201

@app.route('/knowledge-bases/<int:kb_id>', methods=['GET'])
def get_knowledge_base(kb_id):
    """Get specific knowledge base and its documents"""
    conn = get_db_connection(DB_PATH)
    cursor = conn.cursor()
    
    # Get knowledge base details
    cursor.execute("SELECT * FROM knowledge_bases WHERE id = ?", (kb_id,))
    kb = cursor.fetchone()
    
    if not kb:
        conn.close()
        return jsonify({"error": "knowledge base not found"}), 404
    
    # Get all documents in this knowledge base
    cursor.execute(
        "SELECT id, original_filename, upload_date, file_size FROM documents WHERE knowledge_base_id = ? ORDER BY upload_date DESC", 
        (kb_id,)
    )
    documents = [dict(row) for row in cursor.fetchall()]
    
    kb_dict = dict(kb)
    kb_dict['documents'] = documents
    
    conn.close()
    return jsonify(kb_dict)

@app.route('/knowledge-bases/<int:kb_id>', methods=['PUT'])
def update_knowledge_base(kb_id):
    """Update knowledge base information"""
    data = request.get_json()
    
    if not data:
        return jsonify({"error": "no data provided"}), 400
    
    name = data.get('name')
    description = data.get('description')
    
    updates = []
    params = []
    
    if name:
        updates.append("name = ?")
        params.append(name)
    
    if description is not None:
        updates.append("description = ?")
        params.append(description)
    
    if not updates:
        return jsonify({"error": "no valid update fields"}), 400
    
    conn = get_db_connection(DB_PATH)
    cursor = conn.cursor()
    
    # Check if knowledge base exists
    cursor.execute("SELECT id FROM knowledge_bases WHERE id = ?", (kb_id,))
    if not cursor.fetchone():
        conn.close()
        return jsonify({"error": "knowledge base not found"}), 404
    
    # Update knowledge base
    query = f"UPDATE knowledge_bases SET {', '.join(updates)} WHERE id = ?"
    params.append(kb_id)
    cursor.execute(query, params)
    conn.commit()
    conn.close()
    
    return jsonify({"message": "knowledge base updated"})

@app.route('/knowledge-bases/<int:kb_id>', methods=['DELETE'])
def delete_knowledge_base(kb_id):
    """Delete knowledge base and all its documents"""
    conn = get_db_connection(DB_PATH)
    cursor = conn.cursor()
    
    # Check if knowledge base exists
    cursor.execute("SELECT id FROM knowledge_bases WHERE id = ?", (kb_id,))
    if not cursor.fetchone():
        conn.close()
        return jsonify({"error": "knowledge base not found"}), 404
    
    # Get all documents in this knowledge base
    cursor.execute("SELECT file_path FROM documents WHERE knowledge_base_id = ?", (kb_id,))
    documents = cursor.fetchall()
    
    # Delete file system documents
    for doc in documents:
        file_path = doc[0]
        if os.path.exists(file_path):
            os.remove(file_path)
    
    # Delete database documents
    cursor.execute("DELETE FROM documents WHERE knowledge_base_id = ?", (kb_id,))
    
    # Delete knowledge base
    cursor.execute("DELETE FROM knowledge_bases WHERE id = ?", (kb_id,))
    
    conn.commit()
    conn.close()
    
    return jsonify({"message": "knowledge base deleted"})

# ================ Document Management API ================

@app.route('/documents', methods=['GET'])
def list_documents():
    """Get document list, can filter by knowledge base"""
    kb_id = request.args.get('knowledge_base_id')
    
    conn = get_db_connection(DB_PATH)
    cursor = conn.cursor()
    
    if kb_id:
        try:
            kb_id = int(kb_id)
            cursor.execute(
                "SELECT id, original_filename, upload_date, file_size, knowledge_base_id FROM documents WHERE knowledge_base_id = ? ORDER BY upload_date DESC", 
                (kb_id,)
            )
        except ValueError:
            conn.close()
            return jsonify({"error": "invalid knowledge base id"}), 400
    else:
        cursor.execute("SELECT id, original_filename, upload_date, file_size, knowledge_base_id FROM documents ORDER BY upload_date DESC")
    
    documents = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return jsonify({"documents": documents})

@app.route('/documents/<int:doc_id>', methods=['GET'])
def get_document(doc_id):
    """Get single document detailed information"""
    conn = get_db_connection(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM documents WHERE id = ?", (doc_id,))
    document = cursor.fetchone()
    conn.close()
    
    if document:
        return jsonify(dict(document))
    else:
        return jsonify({"error": "document not found"}), 404

@app.route('/documents/<int:doc_id>/download', methods=['GET'])
def download_document(doc_id):
    """Download document file"""
    conn = get_db_connection(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT file_path, original_filename FROM documents WHERE id = ?", (doc_id,))
    result = cursor.fetchone()
    conn.close()
    
    if not result:
        return jsonify({"error": "document not found"}), 404
    
    file_path, original_filename = result
    
    if not os.path.exists(file_path):
        return jsonify({"error": "file not found"}), 404
    
    return send_file(file_path, download_name=original_filename, as_attachment=True)

@app.route('/documents/<int:doc_id>', methods=['DELETE'])
def delete_document(doc_id):
    """Delete document"""
    conn = get_db_connection(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT file_path FROM documents WHERE id = ?", (doc_id,))
    result = cursor.fetchone()
    
    if not result:
        conn.close()
        return jsonify({"error": "document not found"}), 404
    
    file_path = result[0]
    
    # Delete database record
    cursor.execute("DELETE FROM documents WHERE id = ?", (doc_id,))
    conn.commit()
    conn.close()
    
    # Delete file
    if os.path.exists(file_path):
        os.remove(file_path)
    
    return jsonify({"message": "document deleted"})

# ================ Embedding and Query API ================

@app.route('/embed', methods=['POST'])
def route_embed():
    """Upload and embed document"""
    if 'file' not in request.files:
        return jsonify({"error": "please upload a file"}), 400

    file = request.files['file']

    if file.filename == '':
        return jsonify({"error": "no file selected"}), 400
    
    # Get knowledge base ID, default to 1
    kb_id = request.form.get('knowledge_base_id', 1)
    try:
        kb_id = int(kb_id)
    except ValueError:
        return jsonify({"error": "invalid knowledge base id"}), 400
    
    success, doc_id, message = embed_document(file, kb_id)

    if success:
        # Check if the file was saved but content extraction failed
        if "content extraction failed" in message:
            return jsonify({
                "warning": "File saved but content cannot be searched",
                "message": "The file was saved to the knowledge base but could not be processed for search. It may be corrupted or password-protected.",
                "document_id": doc_id,
                "technical_details": message
            }), 201  # 201 Created - since we did create a record, just with limitations
        else:
            return jsonify({
                "message": "success with embedding",
                "document_id": doc_id
            }), 200
    else:
        return jsonify({
            "error": message
        }), 400

@app.route('/query', methods=['POST'])
def route_query():
    """Query document content and return with source information"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({"error": "please provide a request body"}), 400
            
        user_query = data.get('query')
        kb_id = data.get('knowledge_base_id')
        kb_ids = data.get('knowledge_base_ids')  # New parameter: multiple knowledge base IDs
        conversation_id = data.get('conversation_id')
        
        if not user_query:
            return jsonify({"error": "please provide a query"}), 400
        
        # Verify knowledge base ID (if provided)
        if kb_id is not None:
            try:
                kb_id = int(kb_id)
                conn = get_db_connection(DB_PATH)
                cursor = conn.cursor()
                cursor.execute("SELECT id FROM knowledge_bases WHERE id = ?", (kb_id,))
                kb_exists = cursor.fetchone() is not None
                
                # Check if knowledge base contains documents
                cursor.execute("SELECT COUNT(*) FROM documents WHERE knowledge_base_id = ?", (kb_id,))
                doc_count = cursor.fetchone()[0]
                conn.close()
                
                if not kb_exists:
                    return jsonify({"error": "knowledge base not found", "detail": f"Knowledge base ID {kb_id} does not exist"}), 404
                
                if doc_count == 0:
                    return jsonify({
                        "error": "knowledge base is empty", 
                        "detail": f"Knowledge base ID {kb_id} has no documents. Please upload documents first."
                    }), 400
            except ValueError:
                return jsonify({"error": "invalid knowledge base id"}), 400
        
        # Verify multiple knowledge base IDs (if provided)
        valid_kb_ids = []
        if kb_ids:
            try:
                # Ensure kb_ids is a list
                if not isinstance(kb_ids, list):
                    return jsonify({"error": "knowledge_base_ids must be an array"}), 400
                
                conn = get_db_connection(DB_PATH)
                cursor = conn.cursor()
                
                for id in kb_ids:
                    try:
                        kb_id_int = int(id)
                        # Verify knowledge base existence
                        cursor.execute("SELECT id FROM knowledge_bases WHERE id = ?", (kb_id_int,))
                        if cursor.fetchone():
                            # Check if there are documents
                            cursor.execute("SELECT COUNT(*) FROM documents WHERE knowledge_base_id = ?", (kb_id_int,))
                            if cursor.fetchone()[0] > 0:
                                valid_kb_ids.append(kb_id_int)
                    except (ValueError, TypeError):
                        # Skip invalid ID
                        continue
                
                conn.close()
                
                if len(valid_kb_ids) == 0 and len(kb_ids) > 0:
                    return jsonify({
                        "error": "no valid knowledge bases", 
                        "detail": "None of the provided knowledge base IDs are valid or contain documents."
                    }), 400
                    
                print(f"Valid knowledge base IDs: {valid_kb_ids}")
                
            except Exception as e:
                return jsonify({"error": "error validating knowledge base ids", "detail": str(e)}), 400
        
        # Verify conversation ID (if provided)
        if conversation_id is not None:
            try:
                conversation_id = int(conversation_id)
                conversation = get_conversation(DB_PATH, conversation_id)
                if not conversation:
                    return jsonify({"error": "conversation not found", "detail": f"Conversation ID {conversation_id} does not exist"}), 404
            except ValueError:
                return jsonify({"error": "invalid conversation id"}), 400
        
        # Execute query to get answer
        # Prioritize multi-knowledge base mode, then single knowledge base mode, then direct conversation mode
        if valid_kb_ids and len(valid_kb_ids) > 0:
            print(f"Using multi-knowledge base query mode, knowledge base IDs: {valid_kb_ids}")
            response = perform_query(user_query, None, valid_kb_ids)
        elif kb_id is not None:
            print(f"Using single knowledge base query mode, knowledge base ID: {kb_id}")
            response = perform_query(user_query, kb_id)
        else:
            print("Using direct conversation mode")
            response = perform_query(user_query)
        
        # Check if query failed
        if response and "error" in response:
            # If perform_query returned error information, return to client
            return jsonify(response), 400
            
        # Process conversation history
        if conversation_id:
            try:
                # Save user question to conversation history
                save_conversation_message(DB_PATH, conversation_id, 'user', user_query)
                
                # Save AI answer to conversation history
                sources_json = json.dumps(response.get('sources', [])) if response.get('sources') else None
                save_conversation_message(DB_PATH, conversation_id, 'assistant', response.get('answer', ''), sources_json)
                
                # Add conversation ID to response
                response['conversation_id'] = conversation_id
                
            except Exception as e:
                print(f"Error saving conversation history: {str(e)}")
                # Add warning but continue returning query result
                response['warning'] = "Failed to save conversation history"
        
        # Ensure response can be correctly serialized as JSON
        return jsonify(response), 200
    except Exception as e:
        print(f"Query processing error: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": f"error with query", "detail": str(e)}), 500

@app.route('/chat', methods=['POST'])
def route_direct_chat():
    """Direct chat with AI, without using knowledge base"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({"error": "please provide a request body"}), 400
            
        user_query = data.get('query')
        conversation_id = data.get('conversation_id')
        
        if not user_query:
            return jsonify({"error": "please provide a query"}), 400
            
        # Verify conversation ID (if provided)
        if conversation_id is not None:
            try:
                conversation_id = int(conversation_id)
                conversation = get_conversation(DB_PATH, conversation_id)
                if not conversation:
                    return jsonify({"error": "conversation not found", "detail": f"Conversation ID {conversation_id} does not exist"}), 404
            except ValueError:
                return jsonify({"error": "invalid conversation id"}), 400
        
        # Directly call perform_query without providing kb_id, this will trigger direct conversation mode
        response = perform_query(user_query)
        
        # Process conversation history
        if conversation_id:
            try:
                # Save user question to conversation history
                save_conversation_message(DB_PATH, conversation_id, 'user', user_query)
                
                # Save AI answer to conversation history
                sources_json = json.dumps(response.get('sources', [])) if response.get('sources') else None
                save_conversation_message(DB_PATH, conversation_id, 'assistant', response.get('answer', ''), sources_json)
                
                # Add conversation ID to response
                response['conversation_id'] = conversation_id
                
            except Exception as e:
                print(f"Error saving conversation history: {str(e)}")
                # Add warning but continue returning query result
                response['warning'] = "Failed to save conversation history"
        
        # Ensure response can be correctly serialized as JSON
        return jsonify(response), 200
    except Exception as e:
        print(f"Direct conversation processing error: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": f"error with chat", "detail": str(e)}), 500

# Add a new route, simplify document upload
@app.route('/upload/<int:kb_id>', methods=['POST'])
def upload_document_simple(kb_id):
    """Simplified document upload interface, receive knowledge base ID via URL path"""
    try:
        print(f"Received upload request, knowledge base ID: {kb_id}")
        print(f"Request content type: {request.content_type}")
        print(f"Request size: {request.content_length} bytes")
        print(f"Request headers: {dict(request.headers)}")
        
        # Check if it's a regular form upload
        if request.files and 'file' in request.files:
            print("Get file from form data")
            file = request.files['file']
        # Check if it's direct binary data (Tauri's upload API)
        elif request.data:
            print("Get direct binary data from request body")
            
            # Try to get filename from various header information
            filename = None
            
            # Try to get filename from URL parameters
            if request.args.get('path'):
                filename = os.path.basename(request.args.get('path'))
                print(f"Extract filename from URL parameter path: {filename}")
            # Extract filename from Content-Disposition header
            elif 'Content-Disposition' in request.headers:
                content_disp = request.headers.get('Content-Disposition', '')
                if 'filename=' in content_disp:
                    filename = content_disp.split('filename=')[1].strip('"\'')
                    print(f"Extract filename from Content-Disposition: {filename}")
            # Check custom header
            elif 'X-File-Path' in request.headers:
                path = request.headers.get('X-File-Path')
                filename = os.path.basename(path)
                print(f"Extract filename from X-File-Path header: {filename}")
            
            # Use default filename if filename cannot be obtained
            if not filename:
                filename = f"upload_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf"
                print(f"Use default filename: {filename}")
            
            # Create temporary file - directly use system temporary directory
            temp_file_path = os.path.join(TEMP_FOLDER, f"{datetime.now().timestamp()}_{filename}")
            print(f"Create temporary file: {temp_file_path}")
            
            # Ensure request data is not corrupted
            print(f"Received data size: {len(request.data)} bytes")
            
            # Save binary data to temporary file
            with open(temp_file_path, 'wb') as f:
                f.write(request.data)
            
            # Verify file integrity
            actual_size = os.path.getsize(temp_file_path)
            expected_size = request.content_length
            print(f"Written file size: {actual_size} bytes, expected size: {expected_size} bytes")
            
            if expected_size and abs(actual_size - expected_size) > 100:  # Allow 100-byte error
                print(f"Warning: File size mismatch! Actual: {actual_size}, Expected: {expected_size}")
            
            # Open temporary file as FileStorage object
            from werkzeug.datastructures import FileStorage
            file = FileStorage(
                stream=open(temp_file_path, 'rb'),
                filename=filename,
                content_type=request.content_type or 'application/octet-stream'
            )
        else:
            return jsonify({"error": "No uploaded file found"}), 400

        if not file or file.filename == '':
            return jsonify({"error": "No file selected"}), 400
        
        # Verify knowledge base existence
        conn = get_db_connection(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM knowledge_bases WHERE id = ?", (kb_id,))
        kb = cursor.fetchone()
        conn.close()
        
        if not kb:
            return jsonify({
                "error": "knowledge base not found",
                "detail": f"Knowledge base ID {kb_id} does not exist"
            }), 404
        
        print(f"Processing file upload: {file.filename} to knowledge base {kb_id}")
        success, doc_id, message = embed_document(file, kb_id)

        # Clean up temporary file (if exists)
        if 'temp_file_path' in locals() and os.path.exists(temp_file_path):
            try:
                # Close file stream
                if hasattr(file, 'stream') and hasattr(file.stream, 'close'):
                    file.stream.close()
                os.remove(temp_file_path)
                print(f"Temporary file deleted: {temp_file_path}")
            except Exception as e:
                print(f"Failed to delete temporary file: {str(e)}")

        if success:
            # Check if file was saved but content extraction failed
            if "content extraction failed" in message:
                return jsonify({
                    "warning": "File saved but content cannot be searched",
                    "message": "File saved to knowledge base but could not be processed for search. It may be corrupted or password-protected.",
                    "document_id": doc_id,
                    "technical_details": message
                }), 201
            else:
                return jsonify({
                    "message": "Document embedding success",
                    "document_id": doc_id
                }), 200
        else:
            return jsonify({
                "error": message
            }), 400
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({
            "error": "File upload processing failed",
            "detail": str(e)
        }), 500

# ================ Conversation History API ================

@app.route('/conversations', methods=['GET'])
def list_conversations():
    """Get conversation history list, can filter by knowledge base"""
    kb_id = request.args.get('knowledge_base_id')
    limit = request.args.get('limit', 20, type=int)
    offset = request.args.get('offset', 0, type=int)
    
    try:
        if kb_id:
            kb_id = int(kb_id)
    except ValueError:
        return jsonify({"error": "invalid knowledge base id"}), 400
    
    conversations = get_conversations(DB_PATH, kb_id, limit, offset)
    return jsonify({"conversations": conversations})

@app.route('/conversations', methods=['POST'])
def create_new_conversation():
    """Create new conversation"""
    data = request.get_json()
    
    if not data or 'title' not in data:
        return jsonify({"error": "title is required"}), 400
    
    title = data.get('title')
    kb_id = data.get('knowledge_base_id')
    
    try:
        # If knowledge base ID is provided, verify its existence
        if kb_id:
            kb_id = int(kb_id)
            conn = get_db_connection(DB_PATH)
            cursor = conn.cursor()
            cursor.execute("SELECT id FROM knowledge_bases WHERE id = ?", (kb_id,))
            kb = cursor.fetchone()
            conn.close()
            
            if not kb:
                return jsonify({"error": "knowledge base not found"}), 404
    except ValueError:
        return jsonify({"error": "invalid knowledge base id"}), 400
    
    conversation_id = create_conversation(DB_PATH, title, kb_id)
    
    return jsonify({
        "message": "conversation created",
        "conversation_id": conversation_id
    }), 201

@app.route('/conversations/<int:conversation_id>', methods=['GET'])
def get_conversation_detail(conversation_id):
    """Get single conversation detailed information and its message history"""
    conversation = get_conversation(DB_PATH, conversation_id)
    
    if not conversation:
        return jsonify({"error": "conversation not found"}), 404
    
    return jsonify(conversation)

@app.route('/conversations/<int:conversation_id>', methods=['DELETE'])
def delete_conversation_by_id(conversation_id):
    """Delete conversation history"""
    success = delete_conversation(DB_PATH, conversation_id)
    
    if not success:
        return jsonify({"error": "conversation not found or could not be deleted"}), 404
    
    return jsonify({"message": "conversation deleted"})

@app.route('/conversations/<int:conversation_id>/messages', methods=['POST'])
def add_conversation_message(conversation_id):
    """Add new message to conversation"""
    data = request.get_json()
    
    if not data or 'content' not in data or 'message_type' not in data:
        return jsonify({"error": "content and message_type are required"}), 400
    
    content = data.get('content')
    message_type = data.get('message_type')
    sources = data.get('sources')
    
    # Verify message type
    if message_type not in ['user', 'assistant']:
        return jsonify({"error": "message_type must be 'user' or 'assistant'"}), 400
    
    # Verify conversation existence
    conversation = get_conversation(DB_PATH, conversation_id)
    if not conversation:
        return jsonify({"error": "conversation not found"}), 404
    
    # If sources are provided and not a string, convert to JSON string
    if sources and not isinstance(sources, str):
        sources = json.dumps(sources)
    
    # Save message
    message_id = save_conversation_message(DB_PATH, conversation_id, message_type, content, sources)
    
    return jsonify({
        "message": "message added",
        "message_id": message_id
    }), 201

if __name__ == '__main__':
    app.run(port=8080, debug=True)
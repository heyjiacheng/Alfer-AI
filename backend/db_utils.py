import sqlite3

def get_db_connection(db_path):
    """Create a database connection and set row_factory to sqlite3.Row"""
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    return conn

def init_database(db_path):
    """Initialize database, create necessary tables and add default knowledge base"""
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Create knowledge base table
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS knowledge_bases (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    ''')
    
    # Check if knowledge_base_id column and extraction_failed column exist in documents table
    cursor.execute("PRAGMA table_info(documents)")
    columns = [info[1] for info in cursor.fetchall()]
    
    # Check if documents table exists
    table_exists = False
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='documents'")
    if cursor.fetchone():
        table_exists = True
    
    if not table_exists:
        # Create documents table
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS documents (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            original_filename TEXT NOT NULL,
            stored_filename TEXT NOT NULL,
            upload_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            file_path TEXT NOT NULL,
            file_size INTEGER,
            metadata TEXT,
            knowledge_base_id INTEGER,
            extraction_failed BOOLEAN DEFAULT 0,
            FOREIGN KEY (knowledge_base_id) REFERENCES knowledge_bases(id)
        )
        ''')
    else:
        # Add possibly missing columns
        if 'knowledge_base_id' not in columns:
            # Add knowledge_base_id column
            cursor.execute("ALTER TABLE documents ADD COLUMN knowledge_base_id INTEGER")
            # Set default knowledge base ID for existing documents
            cursor.execute("UPDATE documents SET knowledge_base_id = 1 WHERE knowledge_base_id IS NULL")
        
        if 'extraction_failed' not in columns:
            # Add extraction_failed column
            cursor.execute("ALTER TABLE documents ADD COLUMN extraction_failed BOOLEAN DEFAULT 0")
    
    # If no knowledge base exists, add default knowledge base
    # cursor.execute("SELECT COUNT(*) FROM knowledge_bases")
    # if cursor.fetchone()[0] == 0:
    #     cursor.execute("INSERT INTO knowledge_bases (name, description) VALUES (?, ?)",
    #                  ("Default Knowledge Base", "System default knowledge base"))
    
    conn.commit()
    conn.close()

def save_document_metadata(db_path, original_filename, stored_filename, file_path, file_size, kb_id=1, extraction_failed=False):
    """Save document metadata to database"""
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO documents (original_filename, stored_filename, file_path, file_size, knowledge_base_id, extraction_failed) VALUES (?, ?, ?, ?, ?, ?)",
        (original_filename, stored_filename, file_path, file_size, kb_id, 1 if extraction_failed else 0)
    )
    doc_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return doc_id

def check_knowledge_base_exists(db_path, kb_id):
    """Check if knowledge base exists"""
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    cursor.execute("SELECT id FROM knowledge_bases WHERE id = ?", (kb_id,))
    exists = cursor.fetchone() is not None
    conn.close()
    return exists

def save_conversation_message(db_path, conversation_id, message_type, content, sources=None):
    """
    Save conversation message to database
    
    Parameters:
        db_path: Database path
        conversation_id: Conversation ID
        message_type: Message type ('user' or 'assistant')
        content: Message content
        sources: Referenced source information (JSON string)
        
    Returns:
        int: New message ID
    """
    conn = get_db_connection(db_path)
    cursor = conn.cursor()
    
    # Save message
    cursor.execute(
        "INSERT INTO conversation_messages (conversation_id, message_type, content, sources) VALUES (?, ?, ?, ?)",
        (conversation_id, message_type, content, sources)
    )
    
    # Update conversation's update time
    cursor.execute(
        "UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        (conversation_id,)
    )
    
    message_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return message_id

def create_conversation(db_path, title, kb_id=None):
    """
    Create new conversation history
    
    Parameters:
        db_path: Database path
        title: Conversation title
        kb_id: Knowledge base ID (optional)
        
    Returns:
        int: New conversation ID
    """
    conn = get_db_connection(db_path)
    cursor = conn.cursor()
    
    cursor.execute(
        "INSERT INTO conversations (title, knowledge_base_id) VALUES (?, ?)",
        (title, kb_id)
    )
    
    conversation_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return conversation_id

def get_conversation(db_path, conversation_id):
    """
    Get detailed information and all messages for a single conversation
    
    Parameters:
        db_path: Database path
        conversation_id: Conversation ID
        
    Returns:
        dict: Dictionary containing conversation details and message list
    """
    conn = get_db_connection(db_path)
    cursor = conn.cursor()
    
    # Get conversation details
    cursor.execute(
        "SELECT * FROM conversations WHERE id = ?", 
        (conversation_id,)
    )
    conversation = cursor.fetchone()
    
    if not conversation:
        conn.close()
        return None
    
    # Get all messages for this conversation
    cursor.execute(
        "SELECT * FROM conversation_messages WHERE conversation_id = ? ORDER BY created_at ASC",
        (conversation_id,)
    )
    messages = [dict(row) for row in cursor.fetchall()]
    
    # Convert to dictionary
    conversation_dict = dict(conversation)
    conversation_dict['messages'] = messages
    
    conn.close()
    return conversation_dict

def get_conversations(db_path, kb_id=None, limit=20, offset=0):
    """
    Get conversation list, can filter by knowledge base
    
    Parameters:
        db_path: Database path
        kb_id: Knowledge base ID (optional)
        limit: Maximum number of records to return
        offset: Pagination start position
        
    Returns:
        list: Conversation list
    """
    conn = get_db_connection(db_path)
    cursor = conn.cursor()
    
    # Build query SQL
    query = "SELECT * FROM conversations"
    params = []
    
    if kb_id:
        query += " WHERE knowledge_base_id = ?"
        params.append(kb_id)
    
    query += " ORDER BY updated_at DESC LIMIT ? OFFSET ?"
    params.extend([limit, offset])
    
    cursor.execute(query, params)
    conversations = [dict(row) for row in cursor.fetchall()]
    
    # Get the last message of each conversation
    for conversation in conversations:
        conversation_id = conversation['id']
        cursor.execute(
            "SELECT * FROM conversation_messages WHERE conversation_id = ? ORDER BY created_at DESC LIMIT 1",
            (conversation_id,)
        )
        last_message = cursor.fetchone()
        if last_message:
            conversation['last_message'] = dict(last_message)
    
    conn.close()
    return conversations

def delete_conversation(db_path, conversation_id):
    """
    Delete a conversation and all its messages
    
    Parameters:
        db_path: Database path
        conversation_id: Conversation ID
        
    Returns:
        bool: Whether the deletion was successful
    """
    try:
        conn = get_db_connection(db_path)
        cursor = conn.cursor()
        
        # Check if conversation exists
        cursor.execute("SELECT id FROM conversations WHERE id = ?", (conversation_id,))
        if not cursor.fetchone():
            conn.close()
            return False
        
        # Delete all related messages
        cursor.execute("DELETE FROM conversation_messages WHERE conversation_id = ?", (conversation_id,))
        
        # Delete conversation
        cursor.execute("DELETE FROM conversations WHERE id = ?", (conversation_id,))
        
        conn.commit()
        conn.close()
        return True
    except Exception as e:
        print(f"Error deleting conversation: {str(e)}")
        return False 
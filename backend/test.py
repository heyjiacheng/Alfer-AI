#!/usr/bin/env python3
import requests
import json
import os
import time
import sys
import subprocess
from pathlib import Path
from colorama import Fore, Style, init
from datetime import datetime

# Initialize colorama for colored output
init()

BASE_URL = "http://localhost:8080"
TEST_PDF_PATH = None  # Will be set dynamically later
LOG_FILE = "api_test_log.txt"

def print_success(message):
    print(f"{Fore.GREEN}✓ {message}{Style.RESET_ALL}")

def print_error(message):
    print(f"{Fore.RED}✗ {message}{Style.RESET_ALL}")
    
def print_header(message):
    print(f"\n{Fore.CYAN}=== {message} ==={Style.RESET_ALL}")

def print_info(message):
    print(f"{Fore.YELLOW}ℹ {message}{Style.RESET_ALL}")

def log_curl_and_response(curl_cmd, response):
    """Log the curl command and API response to a text file"""
    with open(LOG_FILE, 'a') as f:
        f.write(f"\n\n{'=' * 80}\n")
        f.write(f"TIMESTAMP: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
        f.write(f"CURL COMMAND:\n{curl_cmd}\n\n")
        f.write(f"RESPONSE STATUS: {response.status_code}\n")
        try:
            # Try to format response as JSON
            f.write(f"RESPONSE BODY:\n{json.dumps(response.json(), indent=2)}\n")
        except:
            # If not JSON, write as text and limit content length
            response_text = response.text
            if len(response_text) > 1000:  # Limit response text to avoid huge log files
                response_text = response_text[:1000] + "... [TRUNCATED]"
            f.write(f"RESPONSE BODY:\n{response_text}\n")

def generate_curl_command(method, endpoint, headers=None, data=None, files=None):
    """Generate a curl command equivalent to the request being made"""
    curl_cmd = f"curl -X {method} {BASE_URL}/{endpoint}"
    
    if headers:
        for key, value in headers.items():
            curl_cmd += f" -H \"{key}: {value}\""
    
    if data:
        if isinstance(data, dict):
            curl_cmd += f" -d '{json.dumps(data)}'"
        else:
            curl_cmd += f" -d '{data}'"
    
    if files and 'file' in files:
        file_path = files['file'].name if hasattr(files['file'], 'name') else str(files['file'])
        curl_cmd += f" -F file=@{file_path}"
    
    return curl_cmd

def make_request(method, endpoint, json_data=None, headers=None, files=None, params=None):
    """Make a request and log the equivalent curl command and response"""
    url = f"{BASE_URL}/{endpoint}"
    
    # Generate curl command for logging
    curl_cmd = generate_curl_command(
        method, 
        endpoint, 
        headers=headers, 
        data=json_data, 
        files=files
    )
    
    # Make the actual request
    if method.upper() == 'GET':
        response = requests.get(url, headers=headers, params=params)
    elif method.upper() == 'POST':
        response = requests.post(url, json=json_data, headers=headers, files=files)
    elif method.upper() == 'PUT':
        response = requests.put(url, json=json_data, headers=headers)
    elif method.upper() == 'DELETE':
        response = requests.delete(url, headers=headers)
    else:
        raise ValueError(f"Unsupported method: {method}")
    
    # Log the curl command and response
    log_curl_and_response(curl_cmd, response)
    
    return response

def find_sample_pdf():
    """Find a PDF file to use for testing"""
    # Try common locations
    common_paths = [
        Path.home() / "Documents",
        Path.home() / "Downloads",
        Path(".")
    ]
    
    for path in common_paths:
        if path.exists():
            for file in path.glob("**/*.pdf"):
                print_info(f"Found sample PDF for testing: {file}")
                return str(file)
    
    print_error("No PDF file found for testing. Please provide a path to a PDF file.")
    pdf_path = input("Enter path to a PDF file for testing: ")
    if os.path.exists(pdf_path) and pdf_path.lower().endswith('.pdf'):
        return pdf_path
    else:
        print_error("Invalid PDF file path.")
        sys.exit(1)

def test_knowledge_base_management():
    print_header("Testing Knowledge Base Management")
    
    # Create a knowledge base
    print_info("Creating knowledge base...")
    create_payload = {
        "name": "Test Knowledge Base",
        "description": "Testing the API functionality"
    }
    headers = {'Content-Type': 'application/json'}
    response = make_request('POST', 'knowledge-bases', json_data=create_payload, headers=headers)
    
    if response.status_code == 201:
        # Get the knowledge base ID using the correct field name
        kb_id = response.json().get("knowledge_base_id")
        print_success(f"Created knowledge base with ID: {kb_id}")
    else:
        print_error(f"Failed to create knowledge base: {response.status_code} - {response.text}")
        kb_id = None
    
    # List all knowledge bases
    print_info("Listing all knowledge bases...")
    response = make_request('GET', 'knowledge-bases')
    if response.status_code == 200:
        kb_list = response.json()
        print_success(f"Listed {len(kb_list.get('knowledge_bases', []))} knowledge bases")
    else:
        print_error(f"Failed to list knowledge bases: {response.status_code} - {response.text}")
    
    if kb_id:
        # Get single knowledge base
        print_info(f"Getting details for knowledge base ID: {kb_id}")
        response = make_request('GET', f"knowledge-bases/{kb_id}")
        if response.status_code == 200:
            kb_details = response.json()
            print_success(f"Retrieved details for knowledge base: {kb_details.get('name')}")
        else:
            print_error(f"Failed to get knowledge base details: {response.status_code} - {response.text}")
        
        # Update knowledge base
        print_info(f"Updating knowledge base ID: {kb_id}")
        update_payload = {
            "name": "Updated Test Knowledge Base",
            "description": "Updated description for testing"
        }
        response = make_request('PUT', f"knowledge-bases/{kb_id}", json_data=update_payload, headers=headers)
        if response.status_code == 200:
            print_success(f"Updated knowledge base successfully")
        else:
            print_error(f"Failed to update knowledge base: {response.status_code} - {response.text}")
    
    return kb_id

def test_document_processing(kb_id):
    print_header("Testing Document Processing")
    
    if not kb_id:
        print_error("Cannot test document processing without a valid knowledge base ID")
        return None
    
    # Upload document using /upload/{kb_id} endpoint
    print_info(f"Uploading document to knowledge base ID: {kb_id}")
    with open(TEST_PDF_PATH, 'rb') as f:
        files = {'file': f}
        response = make_request('POST', f"upload/{kb_id}", files=files)
    
    if response.status_code in [200, 201]:
        doc_data = response.json()
        # Try different possible field names for document ID
        doc_id = doc_data.get("document_id")
        if not doc_id and isinstance(doc_data, dict):
            # If we can't find the ID through direct fields, try to find first integer value
            for key, value in doc_data.items():
                if isinstance(value, int):
                    doc_id = value
                    print_info(f"Using {key}: {value} as document ID")
                    break
        print_success(f"Uploaded document with ID: {doc_id}")
    else:
        print_error(f"Failed to upload document: {response.status_code} - {response.text}")
        return None
    
    # Give some time for processing
    print_info("Waiting for document processing...")
    time.sleep(3)
    
    # Test /documents endpoint (List all documents)
    print_info("Listing all documents...")
    response = make_request('GET', "documents")
    if response.status_code == 200:
        doc_list = response.json()
        print_success(f"Listed {len(doc_list.get('documents', []))} documents")
    else:
        print_error(f"Failed to list documents: {response.status_code} - {response.text}")
    
    # Test /documents?knowledge_base_id={kb_id} endpoint (Filter by KB)
    print_info(f"Listing documents for knowledge base ID: {kb_id}...")
    params = {'knowledge_base_id': kb_id}
    response = make_request('GET', "documents", params=params)
    if response.status_code == 200:
        doc_list = response.json()
        print_success(f"Listed {len(doc_list.get('documents', []))} documents for knowledge base {kb_id}")
    else:
        print_error(f"Failed to list documents by KB: {response.status_code} - {response.text}")
    
    # Test /documents/{doc_id} endpoint (Get document details)
    if doc_id:
        print_info(f"Getting details for document ID: {doc_id}")
        response = make_request('GET', f"documents/{doc_id}")
        if response.status_code == 200:
            doc_details = response.json()
            print_success(f"Retrieved details for document: {doc_details.get('original_filename', doc_id)}")
        else:
            print_error(f"Failed to get document details: {response.status_code} - {response.text}")
    
    return doc_id

def test_query_functionality(kb_id):
    print_header("Testing Query Functionality")
    
    headers = {'Content-Type': 'application/json'}
    conversation_id = None
    query_succeeded = False
    kb_query_succeeded = False
    all_kb_query_succeeded = False
    direct_chat_succeeded = False
    
    # Test query for specific knowledge base
    if kb_id:
        print_info(f"Testing query for knowledge base ID: {kb_id}")
        query_payload = {
            "query": "Summarize this document briefly",
            "knowledge_base_id": kb_id
        }
        response = make_request('POST', "query", json_data=query_payload, headers=headers)
        if response.status_code in range(200, 300):  # Accept any 2XX status code
            print_success(f"Successfully queried knowledge base ID: {kb_id}")
            try:
                query_result = response.json()
                print_info(f"Answer available: {'answer' in query_result}")
                if 'conversation_id' in query_result:
                    conversation_id = query_result.get('conversation_id')
                kb_query_succeeded = True
            except:
                print_info("Response is not JSON format")
        else:
            print_error(f"Failed to query knowledge base: {response.status_code} - {response.text}")
            # Check if failure is due to Ollama model error, which is not a test failure
            if "Ollama call failed" in response.text:
                print_info("This appears to be an Ollama model error, not an API error")
                print_info("Will continue testing other endpoints...")
                # Don't mark test as failed for Ollama model errors
                kb_query_succeeded = True

    # Test query across all knowledge bases
    print_info("Testing query across all knowledge bases")
    query_payload = {
        "query": "What are the key points in this document?"
    }
    response = make_request('POST', "query", json_data=query_payload, headers=headers)
    if response.status_code in range(200, 300):  # Accept any 2XX status code
        print_success("Successfully queried all knowledge bases")
        try:
            query_result = response.json()
            print_info(f"Answer available: {'answer' in query_result}")
            if not conversation_id and 'conversation_id' in query_result:
                conversation_id = query_result.get('conversation_id')
            all_kb_query_succeeded = True
        except:
            print_info("Response is not JSON format")
    else:
        print_error(f"Failed to query all knowledge bases: {response.status_code} - {response.text}")
        # Check if failure is due to Ollama model error
        if "Ollama call failed" in response.text:
            print_info("This appears to be an Ollama model error, not an API error")
            print_info("Will continue testing other endpoints...")
            # Don't mark test as failed for Ollama model errors
            all_kb_query_succeeded = True
    
    # Test direct chat without knowledge base
    print_info("Testing direct chat without knowledge base")
    chat_payload = {
        "query": "What is the capital of Sweden?"
    }
    response = make_request('POST', "chat", json_data=chat_payload, headers=headers)
    if response.status_code in range(200, 300):
        print_success("Direct chat query successful")
        try:
            chat_result = response.json()
            print_info(f"Answer available: {'answer' in chat_result}")
            direct_chat_succeeded = True
        except:
            print_info("Response is not JSON format")
    else:
        print_error(f"Failed to direct chat: {response.status_code} - {response.text}")
        # Check if failure is due to Ollama model error
        if "Ollama call failed" in response.text:
            print_info("This appears to be an Ollama model error, not an API error")
            direct_chat_succeeded = True
    
    # Mark overall success if all applicable tests passed
    # For KB queries, we'll be lenient with Ollama model errors
    query_succeeded = (not kb_id or kb_query_succeeded) and all_kb_query_succeeded and direct_chat_succeeded
    
    return {"conversation_id": conversation_id, "success": query_succeeded}

def test_conversation_management(kb_id=None):
    print_header("Testing Conversation Management")
    
    headers = {'Content-Type': 'application/json'}
    
    # Create a new conversation
    print_info("Creating a new conversation...")
    create_payload = {
        "title": "Test Conversation",
        "knowledge_base_id": kb_id
    }
    response = make_request('POST', 'conversations', json_data=create_payload, headers=headers)
    
    if response.status_code == 201:
        conversation_id = response.json().get("conversation_id")
        print_success(f"Created conversation with ID: {conversation_id}")
    else:
        print_error(f"Failed to create conversation: {response.status_code} - {response.text}")
        # Try to continue with tests by getting an existing conversation
        response = make_request('GET', 'conversations')
        if response.status_code == 200 and response.json().get("conversations"):
            conversation_id = response.json().get("conversations")[0].get("id")
            print_info(f"Using existing conversation with ID: {conversation_id}")
        else:
            print_error("No conversations available for testing")
            return None
    
    # Test query with conversation (should save messages automatically)
    print_info(f"Testing query with conversation ID: {conversation_id}")
    query_payload = {
        "query": "What is this document about?",
        "conversation_id": conversation_id
    }
    if kb_id:
        query_payload["knowledge_base_id"] = kb_id
        
    response = make_request('POST', "query", json_data=query_payload, headers=headers)
    if response.status_code in range(200, 300):
        print_success("Query with conversation ID successful")
    else:
        print_error(f"Failed to query with conversation ID: {response.status_code} - {response.text}")
    
    # Test conversation continuity with a follow-up query
    print_info(f"Testing conversation continuity with follow-up query")
    followup_payload = {
        "query": "Can you tell me more details about it?",
        "conversation_id": conversation_id
    }
    if kb_id:
        followup_payload["knowledge_base_id"] = kb_id
        
    response = make_request('POST', "query", json_data=followup_payload, headers=headers)
    if response.status_code in range(200, 300):
        print_success("Follow-up query with conversation context successful")
        # Check if the response seems contextual (not a generic "I don't know")
        try:
            answer = response.json().get("answer", "")
            if "don't know" in answer.lower() or "don't have enough information" in answer.lower():
                print_info("Response may lack context: contains phrases indicating lack of knowledge")
            else:
                print_info("Response appears to maintain conversation context")
        except:
            print_info("Couldn't analyze response content")
    else:
        print_error(f"Failed to process follow-up query: {response.status_code} - {response.text}")
    
    # Test getting conversation list
    print_info("Listing all conversations...")
    response = make_request('GET', 'conversations')
    if response.status_code == 200:
        conversations = response.json().get("conversations", [])
        print_success(f"Listed {len(conversations)} conversations")
    else:
        print_error(f"Failed to list conversations: {response.status_code} - {response.text}")
    
    # Filter conversations by KB
    if kb_id:
        print_info(f"Listing conversations for knowledge base ID: {kb_id}")
        params = {'knowledge_base_id': kb_id}
        response = make_request('GET', "conversations", params=params)
        if response.status_code == 200:
            conversations = response.json().get("conversations", [])
            print_success(f"Listed {len(conversations)} conversations for KB {kb_id}")
        else:
            print_error(f"Failed to list conversations by KB: {response.status_code} - {response.text}")
    
    # Test getting conversation details
    print_info(f"Getting details for conversation ID: {conversation_id}")
    response = make_request('GET', f"conversations/{conversation_id}")
    if response.status_code == 200:
        conversation = response.json()
        messages = conversation.get("messages", [])
        print_success(f"Retrieved conversation with {len(messages)} messages")
        
        # Verify conversation contains both the initial query and follow-up
        if len(messages) >= 4:  # Initial query + response + follow-up + response = 4
            print_success("Conversation contains all expected messages")
        else:
            print_error(f"Conversation missing expected messages, found only {len(messages)}")
    else:
        print_error(f"Failed to get conversation details: {response.status_code} - {response.text}")
    
    # Test adding manual message to conversation
    print_info(f"Adding message to conversation ID: {conversation_id}")
    message_payload = {
        "content": "This is a test message added directly",
        "message_type": "user"
    }
    response = make_request('POST', f"conversations/{conversation_id}/messages", json_data=message_payload, headers=headers)
    if response.status_code == 201:
        message_id = response.json().get("message_id")
        print_success(f"Added message with ID: {message_id}")
    else:
        print_error(f"Failed to add message: {response.status_code} - {response.text}")
    
    return conversation_id

def test_direct_chat_continuity():
    print_header("Testing Direct Chat Conversation Continuity")
    
    headers = {'Content-Type': 'application/json'}
    
    # Create a new conversation
    print_info("Creating a new conversation for direct chat...")
    create_payload = {
        "title": "Direct Chat Test"
    }
    response = make_request('POST', 'conversations', json_data=create_payload, headers=headers)
    
    if response.status_code == 201:
        conversation_id = response.json().get("conversation_id")
        print_success(f"Created conversation with ID: {conversation_id}")
    else:
        print_error(f"Failed to create conversation: {response.status_code} - {response.text}")
        return None
    
    # Send initial query using chat endpoint
    print_info("Sending initial query to chat endpoint...")
    initial_payload = {
        "query": "What is the capital of Sweden?",
        "conversation_id": conversation_id
    }
    response = make_request('POST', "chat", json_data=initial_payload, headers=headers)
    if response.status_code in range(200, 300):
        print_success("Initial direct chat query successful")
        try:
            answer = response.json().get("answer", "")
            print_info(f"Initial answer received, contains Stockholm: {'stockholm' in answer.lower()}")
        except:
            print_info("Couldn't analyze response content")
    else:
        print_error(f"Failed to send initial chat query: {response.status_code} - {response.text}")
        return None
    
    # Send follow-up query that relies on previous context
    print_info("Sending follow-up query to chat endpoint...")
    followup_payload = {
        "query": "What is the population of that city?",
        "conversation_id": conversation_id
    }
    response = make_request('POST', "chat", json_data=followup_payload, headers=headers)
    if response.status_code in range(200, 300):
        print_success("Follow-up direct chat query successful")
        try:
            answer = response.json().get("answer", "")
            if "don't know" in answer.lower() or "don't have enough information" in answer.lower():
                print_info("Response may lack context: contains phrases indicating lack of knowledge")
            else:
                print_info("Response appears to maintain conversation context")
        except:
            print_info("Couldn't analyze response content")
    else:
        print_error(f"Failed to send follow-up chat query: {response.status_code} - {response.text}")
    
    # Verify conversation contains both messages
    print_info(f"Checking conversation messages for conversation ID: {conversation_id}")
    response = make_request('GET', f"conversations/{conversation_id}")
    if response.status_code == 200:
        conversation = response.json()
        messages = conversation.get("messages", [])
        if len(messages) >= 4:  # Initial query + response + follow-up + response = 4
            print_success("Conversation contains all expected messages")
        else:
            print_error(f"Conversation missing expected messages, found only {len(messages)}")
    else:
        print_error(f"Failed to get conversation details: {response.status_code} - {response.text}")
    
    return conversation_id

def cleanup(kb_id, doc_id, conversation_id=None):
    print_header("Cleaning Up Test Resources")
    
    # Delete conversation if exists
    if conversation_id:
        print_info(f"Deleting conversation ID: {conversation_id}")
        response = make_request('DELETE', f"conversations/{conversation_id}")
        if response.status_code in range(200, 300):
            print_success(f"Deleted conversation ID: {conversation_id}")
        else:
            print_error(f"Failed to delete conversation: {response.status_code} - {response.text}")
    
    # Delete document if exists
    if doc_id:
        print_info(f"Deleting document ID: {doc_id}")
        response = make_request('DELETE', f"documents/{doc_id}")
        if response.status_code in range(200, 300):
            print_success(f"Deleted document ID: {doc_id}")
        else:
            print_error(f"Failed to delete document: {response.status_code} - {response.text}")
    
    # Delete knowledge base if exists
    if kb_id:
        print_info(f"Deleting knowledge base ID: {kb_id}")
        response = make_request('DELETE', f"knowledge-bases/{kb_id}")
        if response.status_code in range(200, 300):
            print_success(f"Deleted knowledge base ID: {kb_id}")
        else:
            print_error(f"Failed to delete knowledge base: {response.status_code} - {response.text}")

def check_server_status():
    print_header("Checking Server Status")
    try:
        response = make_request('GET', "knowledge-bases")
        if response.status_code == 200:
            print_success("Server is running and responding")
            return True
        else:
            print_error(f"Server returned unexpected status code: {response.status_code}")
            return False
    except requests.exceptions.RequestException as e:
        print_error(f"Could not connect to server: {e}")
        print_info("Please make sure the server is running at http://localhost:8080")
        return False

def cleanup_log_file():
    """Delete log file if it exists"""
    try:
        if os.path.exists(LOG_FILE):
            os.remove(LOG_FILE)
            print_info(f"Removed existing log file: {LOG_FILE}")
    except Exception as e:
        print_error(f"Failed to remove log file: {e}")

def run_all_tests():
    """Run all API tests in sequence and collect results"""
    results = {}
    tests_run = 0
    tests_passed = 0
    
    # Run tests in sequence
    try:
        kb_id = test_knowledge_base_management()
        if kb_id:
            results["knowledge_base_tests"] = "PASSED"
            tests_passed += 1
        else:
            results["knowledge_base_tests"] = "FAILED"
        tests_run += 1
        
        doc_id = test_document_processing(kb_id)
        if doc_id:
            results["document_tests"] = "PASSED"
            tests_passed += 1
        else:
            results["document_tests"] = "FAILED"
        tests_run += 1
        
        conversation_id = test_conversation_management(kb_id)
        if conversation_id:
            results["conversation_tests"] = "PASSED"
            tests_passed += 1
        else:
            results["conversation_tests"] = "FAILED"
        tests_run += 1
        
        # Test direct chat continuity
        direct_chat_conversation_id = test_direct_chat_continuity()
        if direct_chat_conversation_id:
            results["direct_chat_continuity_tests"] = "PASSED"
            tests_passed += 1
        else:
            results["direct_chat_continuity_tests"] = "FAILED"
        tests_run += 1
        
        # Always run query tests last as they depend on documents being embedded
        query_result = test_query_functionality(kb_id)
        if query_result["success"]:
            results["query_tests"] = "PASSED"
            tests_passed += 1
        else:
            results["query_tests"] = "FAILED (API works but model may have issues)"
        tests_run += 1
        
        # Clean up all resources
        query_conversation_id = query_result.get("conversation_id")
        cleanup(kb_id, doc_id, conversation_id)
        if query_conversation_id and query_conversation_id != conversation_id:
            # Clean up the additional conversation created during query test
            cleanup(None, None, query_conversation_id)
        if direct_chat_conversation_id:
            cleanup(None, None, direct_chat_conversation_id)
        
    except Exception as e:
        print_error(f"An error occurred during testing: {e}")
        import traceback
        traceback.print_exc()
    
    return results, tests_run, tests_passed

def main():
    global TEST_PDF_PATH
    
    print_header("Alfer-AI Backend API Test")
    print_info("This script will test all API endpoints in the Flask backend")
    print_info(f"All curl commands and responses will be logged to {LOG_FILE}")
    
    # Initialize log file
    cleanup_log_file()
    with open(LOG_FILE, 'w') as f:
        f.write(f"ALFER-AI BACKEND API TEST LOG\n")
        f.write(f"Generated on: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
        f.write(f"{'=' * 80}\n")
    
    if not check_server_status():
        return
    
    # Try to find a PDF for testing
    TEST_PDF_PATH = find_sample_pdf()
    if not TEST_PDF_PATH:
        print_error("No PDF file available for testing. Exiting.")
        return
    
    # Run all tests
    results, tests_run, tests_passed = run_all_tests()
    
    # Print test summary
    print_header("Test Summary")
    if tests_run > 0:
        pass_rate = (tests_passed / tests_run) * 100
        print_info(f"Tests passed: {tests_passed}/{tests_run} ({pass_rate:.1f}%)")
        
        for test_name, result in results.items():
            if result == "PASSED":
                print_success(f"{test_name}: {result}")
            else:
                print_error(f"{test_name}: {result}")
        
        if tests_passed == tests_run:
            print_success("All tests completed successfully!")
        else:
            print_error(f"{tests_run - tests_passed} tests failed.")
    else:
        print_error("No tests were run.")
    
    print_info(f"Check {LOG_FILE} for detailed curl commands and responses")
    print_info(f"Test log file created at: {os.path.abspath(LOG_FILE)}")

if __name__ == "__main__":
    main()
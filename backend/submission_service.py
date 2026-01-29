"""
Submission processing service
Handles URL, text, and PDF submissions and processes them to extract graph data
"""
from typing import Optional, Dict, Any, Tuple
from datetime import datetime
import json
import os
import logging
import requests
from urllib.parse import urlparse
from bs4 import BeautifulSoup
import PyPDF2
import pdfplumber
from io import BytesIO

from neon_database import neon_db
from models import SubmissionCreate, SubmissionResponse, GraphData
from services import search_with_ai, extract_graph_data_from_cypher_results
from database import db
from sql_security import validate_limit, validate_offset, validate_id

logger = logging.getLogger(__name__)

# Directory for storing uploaded files
UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

def extract_text_from_url(url: str) -> Tuple[str, Optional[str]]:
    """
    Extract text content from a URL
    Returns (text_content, error_message)
    """
    try:
        response = requests.get(url, timeout=30, headers={
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        })
        response.raise_for_status()
        
        soup = BeautifulSoup(response.content, 'html.parser')
        
        # Remove script and style elements
        for script in soup(["script", "style"]):
            script.decompose()
        
        # Get text
        text = soup.get_text()
        
        # Clean up whitespace
        lines = (line.strip() for line in text.splitlines())
        chunks = (phrase.strip() for line in lines for phrase in line.split("  "))
        text = ' '.join(chunk for chunk in chunks if chunk)
        
        return text[:50000], None  # Limit to 50k characters
    except Exception as e:
        logger.error(f"Error extracting text from URL {url}: {e}")
        return "", str(e)

def extract_text_from_pdf(file_path: str) -> Tuple[str, Optional[str]]:
    """
    Extract text content from a PDF file
    Returns (text_content, error_message)
    """
    try:
        text_content = ""
        
        # Try pdfplumber first (better for complex PDFs)
        try:
            with pdfplumber.open(file_path) as pdf:
                for page in pdf.pages:
                    page_text = page.extract_text()
                    if page_text:
                        text_content += page_text + "\n"
        except Exception as e:
            logger.warning(f"pdfplumber failed, trying PyPDF2: {e}")
            # Fallback to PyPDF2
            with open(file_path, 'rb') as file:
                pdf_reader = PyPDF2.PdfReader(file)
                for page in pdf_reader.pages:
                    text_content += page.extract_text() + "\n"
        
        return text_content[:50000], None  # Limit to 50k characters
    except Exception as e:
        logger.error(f"Error extracting text from PDF {file_path}: {e}")
        return "", str(e)

def process_submission_content(content: str, tags: list = None) -> Dict[str, Any]:
    """
    Process submission content to generate graph data using AI
    Returns processing result with graph data
    """
    try:
        # Use AI service to generate Cypher query from content
        # For now, we'll use the existing search_with_ai function
        # In the future, this could be enhanced to extract entities/relationships from the content
        
        # Generate a query from the content
        query_prompt = f"Analyze the following content and create a knowledge graph representation:\n\n{content[:10000]}"
        
        graph_data, generated_query = search_with_ai(query_prompt)
        
        return {
            "graph_data": graph_data.model_dump() if hasattr(graph_data, 'model_dump') else graph_data,
            "generated_query": generated_query,
            "nodes_count": len(graph_data.nodes) if hasattr(graph_data, 'nodes') else 0,
            "links_count": len(graph_data.links) if hasattr(graph_data, 'links') else 0,
            "tags": tags or []
        }
    except Exception as e:
        logger.error(f"Error processing submission content: {e}")
        raise

def create_submission(user_id: str, submission_data: SubmissionCreate, file_path: Optional[str] = None, file_name: Optional[str] = None, file_size: Optional[int] = None) -> Optional[SubmissionResponse]:
    """Create a new submission record"""
    try:
        query = """
        INSERT INTO submissions (user_id, submission_type, input_data, input_url, file_path, file_name, file_size, status, tags, created_at)
        VALUES (%s, %s, %s, %s, %s, %s, %s, 'pending', %s, CURRENT_TIMESTAMP)
        RETURNING id, user_id, submission_type, input_data, input_url, file_path, file_name, file_size, status, processing_result, tags, created_at, processed_at
        """
        
        tags_array = submission_data.tags or []
        
        params = (
            user_id,
            submission_data.submission_type,
            submission_data.input_data,
            submission_data.input_url,
            file_path,
            file_name,
            file_size,
            tags_array
        )
        
        result = neon_db.execute_write_query(query, params)
        
        if result and len(result) > 0:
            row = result[0]
            return SubmissionResponse(
                id=str(row['id']),
                user_id=str(row['user_id']),
                submission_type=row['submission_type'],
                input_data=row.get('input_data'),
                input_url=row.get('input_url'),
                file_name=row.get('file_name'),
                file_size=row.get('file_size'),
                status=row['status'],
                processing_result=row.get('processing_result'),
                tags=row.get('tags', []),
                created_at=row['created_at'],
                processed_at=row.get('processed_at')
            )
        return None
    except Exception as e:
        logger.error(f"Error creating submission: {e}")
        return None

def process_submission(submission_id: str) -> Optional[SubmissionResponse]:
    """Process a submission and update its status"""
    try:
        # Validate submission_id
        validated_id = validate_id(submission_id)
        if not validated_id:
            logger.error(f"Invalid submission_id: {submission_id}")
            return None
        
        # Get submission
        query = """
        SELECT id, user_id, submission_type, input_data, input_url, file_path, file_name, tags
        FROM submissions
        WHERE id = %s
        """
        result = neon_db.execute_query(query, (validated_id,))
        
        if not result or len(result) == 0:
            return None
        
        submission = result[0]
        
        # Update status to processing
        update_status_query = """
        UPDATE submissions
        SET status = 'processing'
        WHERE id = %s
        """
        neon_db.execute_write_query(update_status_query, (validated_id,))
        
        # Extract content based on type
        content = ""
        error_msg = None
        
        if submission['submission_type'] == 'text':
            content = submission.get('input_data', '')
        elif submission['submission_type'] == 'url':
            content, error_msg = extract_text_from_url(submission.get('input_url', ''))
        elif submission['submission_type'] == 'pdf':
            file_path = submission.get('file_path')
            if file_path and os.path.exists(file_path):
                content, error_msg = extract_text_from_pdf(file_path)
            else:
                error_msg = "PDF file not found"
        
        if error_msg or not content:
            # Update status to failed
            update_failed_query = """
            UPDATE submissions
            SET status = 'failed', processing_result = %s, processed_at = CURRENT_TIMESTAMP
            WHERE id = %s
            """
            error_result = json.dumps({"error": error_msg or "No content extracted"})
            neon_db.execute_write_query(update_failed_query, (error_result, submission_id))
            return None
        
        # Process content to generate graph data
        tags = submission.get('tags', [])
        processing_result = process_submission_content(content, tags)
        
        # Update submission with results
        update_complete_query = """
        UPDATE submissions
        SET status = 'completed', processing_result = %s, processed_at = CURRENT_TIMESTAMP
        WHERE id = %s
        RETURNING id, user_id, submission_type, input_data, input_url, file_path, file_name, file_size, status, processing_result, tags, created_at, processed_at
        """
        
        result_json = json.dumps(processing_result)
        update_result = neon_db.execute_write_query(update_complete_query, (result_json, validated_id))
        
        if update_result and len(update_result) > 0:
            row = update_result[0]
            return SubmissionResponse(
                id=str(row['id']),
                user_id=str(row['user_id']),
                submission_type=row['submission_type'],
                input_data=row.get('input_data'),
                input_url=row.get('input_url'),
                file_name=row.get('file_name'),
                file_size=row.get('file_size'),
                status=row['status'],
                processing_result=row.get('processing_result'),
                tags=row.get('tags', []),
                created_at=row['created_at'],
                processed_at=row.get('processed_at')
            )
        
        return None
    except Exception as e:
        logger.error(f"Error processing submission: {e}")
        # Update status to failed
        try:
            update_failed_query = """
            UPDATE submissions
            SET status = 'failed', processing_result = %s, processed_at = CURRENT_TIMESTAMP
            WHERE id = %s
            """
            # Validate submission_id again in exception handler
            validated_id = validate_id(submission_id)
            if validated_id:
                error_result = json.dumps({"error": str(e)})
                neon_db.execute_write_query(update_failed_query, (error_result, validated_id))
        except:
            pass
        return None

def get_submission(submission_id: str) -> Optional[SubmissionResponse]:
    """Get a submission by ID"""
    try:
        # Validate submission_id
        validated_id = validate_id(submission_id)
        if not validated_id:
            logger.error(f"Invalid submission_id: {submission_id}")
            return None
        
        query = """
        SELECT id, user_id, submission_type, input_data, input_url, file_path, file_name, file_size, status, processing_result, tags, created_at, processed_at
        FROM submissions
        WHERE id = %s
        """
        result = neon_db.execute_query(query, (validated_id,))
        
        if result and len(result) > 0:
            row = result[0]
            processing_result = row.get('processing_result')
            if isinstance(processing_result, str):
                processing_result = json.loads(processing_result)
            
            return SubmissionResponse(
                id=str(row['id']),
                user_id=str(row['user_id']),
                submission_type=row['submission_type'],
                input_data=row.get('input_data'),
                input_url=row.get('input_url'),
                file_name=row.get('file_name'),
                file_size=row.get('file_size'),
                status=row['status'],
                processing_result=processing_result,
                tags=row.get('tags', []),
                created_at=row['created_at'],
                processed_at=row.get('processed_at')
            )
        return None
    except Exception as e:
        logger.error(f"Error getting submission: {e}")
        return None

def get_user_submissions(user_id: str, limit: Optional[int] = 50, offset: Optional[int] = 0) -> list:
    """Get all submissions for a user"""
    try:
        # Validate inputs
        validated_user_id = validate_id(user_id)
        if not validated_user_id:
            logger.error(f"Invalid user_id: {user_id}")
            return []
        
        validated_limit = validate_limit(limit, default=50)
        validated_offset = validate_offset(offset)
        
        query = """
        SELECT id, user_id, submission_type, input_data, input_url, file_path, file_name, file_size, status, processing_result, tags, created_at, processed_at
        FROM submissions
        WHERE user_id = %s
        ORDER BY created_at DESC
        LIMIT %s OFFSET %s
        """
        result = neon_db.execute_query(query, (validated_user_id, validated_limit, validated_offset))
        
        submissions = []
        for row in result:
            processing_result = row.get('processing_result')
            if isinstance(processing_result, str):
                try:
                    processing_result = json.loads(processing_result)
                except:
                    processing_result = None
            
            submissions.append(SubmissionResponse(
                id=str(row['id']),
                user_id=str(row['user_id']),
                submission_type=row['submission_type'],
                input_data=row.get('input_data'),
                input_url=row.get('input_url'),
                file_name=row.get('file_name'),
                file_size=row.get('file_size'),
                status=row['status'],
                processing_result=processing_result,
                tags=row.get('tags', []),
                created_at=row['created_at'],
                processed_at=row.get('processed_at')
            ))
        
        return submissions
    except Exception as e:
        logger.error(f"Error getting user submissions: {e}")
        return []

def get_all_submissions(limit: Optional[int] = 100, offset: Optional[int] = 0) -> list:
    """Get all submissions (for admin)"""
    try:
        # Validate limit and offset
        validated_limit = validate_limit(limit)
        validated_offset = validate_offset(offset)
        
        query = """
        SELECT s.id, s.user_id, s.submission_type, s.input_data, s.input_url, s.file_path, s.file_name, s.file_size, s.status, s.processing_result, s.tags, s.created_at, s.processed_at,
               u.email as user_email, u.full_name as user_name
        FROM submissions s
        LEFT JOIN users u ON s.user_id = u.id
        ORDER BY s.created_at DESC
        LIMIT %s OFFSET %s
        """
        result = neon_db.execute_query(query, (validated_limit, validated_offset))
        
        submissions = []
        for row in result:
            processing_result = row.get('processing_result')
            if isinstance(processing_result, str):
                try:
                    processing_result = json.loads(processing_result)
                except:
                    processing_result = None
            
            submissions.append({
                "id": str(row['id']),
                "user_id": str(row['user_id']),
                "user_email": row.get('user_email'),
                "user_name": row.get('user_name'),
                "submission_type": row['submission_type'],
                "input_data": row.get('input_data'),
                "input_url": row.get('input_url'),
                "file_name": row.get('file_name'),
                "file_size": row.get('file_size'),
                "status": row['status'],
                "processing_result": processing_result,
                "tags": row.get('tags', []),
                "created_at": row['created_at'].isoformat() if row.get('created_at') else None,
                "processed_at": row['processed_at'].isoformat() if row.get('processed_at') else None
            })
        
        return submissions
    except Exception as e:
        logger.error(f"Error getting all submissions: {e}")
        return []

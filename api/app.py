# Import required FastAPI components for building the API
from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
# Import Pydantic for data validation and settings management
from pydantic import BaseModel, Field, validator
# Import OpenAI client for interacting with OpenAI's API
from openai import OpenAI
import os
import logging
import time
from typing import Optional, List
from datetime import datetime
import json

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize FastAPI application with enhanced metadata
app = FastAPI(
    title="AI Chat Assistant API",
    description="A modern chat API powered by OpenAI's GPT models with streaming responses",
    version="2.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# Configure CORS (Cross-Origin Resource Sharing) middleware
# This allows the API to be accessed from different domains/origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows requests from any origin
    allow_credentials=True,  # Allows cookies to be included in requests
    allow_methods=["*"],  # Allows all HTTP methods (GET, POST, etc.)
    allow_headers=["*"],  # Allows all headers in requests
)

# Add trusted host middleware for security
app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=["*"]  # Configure this properly for production
)

# In-memory storage for rate limiting (use Redis in production)
request_counts = {}

# Define the data model for chat requests using Pydantic with enhanced validation
class ChatRequest(BaseModel):
    developer_message: str = Field(..., min_length=1, max_length=4000, description="System prompt defining AI behavior")
    user_message: str = Field(..., min_length=1, max_length=4000, description="User's message to the AI")
    model: Optional[str] = Field(default="gpt-4.1-mini", description="OpenAI model to use")
    api_key: str = Field(..., min_length=20, description="OpenAI API key")
    temperature: Optional[float] = Field(default=0.7, ge=0.0, le=2.0, description="Response creativity (0-2)")
    max_tokens: Optional[int] = Field(default=1000, ge=1, le=4000, description="Maximum response length")

    @validator('model')
    def validate_model(cls, v):
        allowed_models = ["gpt-4.1-mini", "gpt-4", "gpt-3.5-turbo", "gpt-4-turbo"]
        if v not in allowed_models:
            raise ValueError(f"Model must be one of: {', '.join(allowed_models)}")
        return v

    @validator('api_key')
    def validate_api_key(cls, v):
        if not v.startswith('sk-'):
            raise ValueError("API key must start with 'sk-'")
        return v

# Define response models
class ChatResponse(BaseModel):
    message: str
    model: str
    timestamp: datetime
    tokens_used: Optional[int] = None

class HealthResponse(BaseModel):
    status: str
    timestamp: datetime
    version: str
    uptime: float

class ErrorResponse(BaseModel):
    error: str
    detail: str
    timestamp: datetime

# Rate limiting function
def check_rate_limit(client_ip: str, limit: int = 10, window: int = 60):
    """Simple rate limiting - 10 requests per minute per IP"""
    current_time = time.time()
    if client_ip not in request_counts:
        request_counts[client_ip] = []
    
    # Remove old requests outside the window
    request_counts[client_ip] = [req_time for req_time in request_counts[client_ip] 
                                if current_time - req_time < window]
    
    if len(request_counts[client_ip]) >= limit:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Rate limit exceeded. Maximum {limit} requests per {window} seconds."
        )
    
    request_counts[client_ip].append(current_time)

# Dependency to get client IP
def get_client_ip(request):
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0]
    return request.client.host

# Define the main chat endpoint that handles POST requests
@app.post("/api/chat", response_model=ChatResponse)
async def chat(
    request: ChatRequest,
    client_ip: str = Depends(get_client_ip)
):
    """
    Stream chat responses from OpenAI's API with enhanced error handling and validation.
    
    - **developer_message**: System prompt that defines the AI's behavior
    - **user_message**: The user's message to the AI
    - **model**: OpenAI model to use (default: gpt-4.1-mini)
    - **api_key**: Your OpenAI API key
    - **temperature**: Controls response randomness (0.0-2.0)
    - **max_tokens**: Maximum tokens in response
    """
    try:
        # Rate limiting
        check_rate_limit(client_ip)
        
        # Log the request
        logger.info(f"Chat request from {client_ip} using model {request.model}")
        
        # Initialize OpenAI client with the provided API key
        client = OpenAI(api_key=request.api_key)
        
        # Create an async generator function for streaming responses
        async def generate():
            try:
                # Create a streaming chat completion request
                stream = client.chat.completions.create(
                    model=request.model,
                    messages=[
                        {"role": "system", "content": request.developer_message},
                        {"role": "user", "content": request.user_message}
                    ],
                    stream=True,  # Enable streaming response
                    temperature=request.temperature,
                    max_tokens=request.max_tokens
                )
                
                # Yield each chunk of the response as it becomes available
                for chunk in stream:
                    if chunk.choices[0].delta.content is not None:
                        yield chunk.choices[0].delta.content
                        
            except Exception as e:
                logger.error(f"Error in streaming response: {str(e)}")
                yield f"\n\n[Error: {str(e)}]"

        # Return a streaming response to the client
        return StreamingResponse(
            generate(), 
            media_type="text/plain",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Streaming": "true"
            }
        )
    
    except HTTPException:
        # Re-raise HTTP exceptions (like rate limiting)
        raise
    except Exception as e:
        # Handle any other errors that occur during processing
        logger.error(f"Unexpected error in chat endpoint: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, 
            detail=f"An unexpected error occurred: {str(e)}"
        )

# Enhanced health check endpoint
@app.get("/api/health", response_model=HealthResponse)
async def health_check():
    """
    Check the health and status of the API.
    
    Returns:
    - **status**: Current API status
    - **timestamp**: Current server time
    - **version**: API version
    - **uptime**: Server uptime in seconds
    """
    return HealthResponse(
        status="healthy",
        timestamp=datetime.now(),
        version="2.0.0",
        uptime=time.time()  # This would be better calculated from startup time
    )

# New endpoint to get available models
@app.get("/api/models")
async def get_models():
    """
    Get list of available OpenAI models.
    
    Returns a list of model names and their descriptions.
    """
    models = [
        {
            "id": "gpt-4.1-mini",
            "name": "GPT-4.1 Mini",
            "description": "Fast and efficient model for most tasks",
            "max_tokens": 4000,
            "cost_per_1k_tokens": 0.00015
        },
        {
            "id": "gpt-4",
            "name": "GPT-4",
            "description": "Most capable model for complex reasoning",
            "max_tokens": 8192,
            "cost_per_1k_tokens": 0.03
        },
        {
            "id": "gpt-3.5-turbo",
            "name": "GPT-3.5 Turbo",
            "description": "Fast and cost-effective for simple tasks",
            "max_tokens": 4096,
            "cost_per_1k_tokens": 0.002
        },
        {
            "id": "gpt-4-turbo",
            "name": "GPT-4 Turbo",
            "description": "Latest GPT-4 model with improved performance",
            "max_tokens": 128000,
            "cost_per_1k_tokens": 0.01
        }
    ]
    return {"models": models}

# New endpoint for API key validation
@app.post("/api/validate-key")
async def validate_api_key(request: ChatRequest):
    """
    Validate an OpenAI API key without making a full request.
    
    This endpoint checks if the provided API key is valid by making a minimal API call.
    """
    try:
        client = OpenAI(api_key=request.api_key)
        
        # Make a minimal test request
        response = client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[{"role": "user", "content": "Hello"}],
            max_tokens=5
        )
        
        return {
            "valid": True,
            "message": "API key is valid",
            "model_tested": "gpt-3.5-turbo"
        }
        
    except Exception as e:
        return {
            "valid": False,
            "message": f"API key validation failed: {str(e)}",
            "model_tested": None
        }

# Error handlers for better user experience
@app.exception_handler(HTTPException)
async def http_exception_handler(request, exc):
    """Custom HTTP exception handler with detailed error information"""
    return {
        "error": "HTTP Error",
        "detail": exc.detail,
        "status_code": exc.status_code,
        "timestamp": datetime.now()
    }

@app.exception_handler(Exception)
async def general_exception_handler(request, exc):
    """General exception handler for unexpected errors"""
    logger.error(f"Unhandled exception: {str(exc)}")
    return {
        "error": "Internal Server Error",
        "detail": "An unexpected error occurred",
        "status_code": 500,
        "timestamp": datetime.now()
    }

# Entry point for running the application directly
if __name__ == "__main__":
    import uvicorn
    # Start the server on all network interfaces (0.0.0.0) on port 8000
    logger.info("Starting AI Chat Assistant API server...")
    uvicorn.run(
        app, 
        host="0.0.0.0", 
        port=8000,
        log_level="info",
        access_log=True
    )

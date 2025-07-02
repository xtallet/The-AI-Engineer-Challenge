# Import required FastAPI components for building the API
from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.responses import StreamingResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
# Import Pydantic for data validation and settings management
from pydantic import BaseModel
# Import OpenAI client for interacting with OpenAI's API
from openai import OpenAI
import os
from typing import Optional
from aimakerspace.text_utils import PDFLoader, CharacterTextSplitter
from aimakerspace.vectordatabase import VectorDatabase
import shutil
import tempfile
from aimakerspace.openai_utils.embedding import EmbeddingModel

# Initialize FastAPI application with a title
app = FastAPI(title="OpenAI Chat API")

# Configure CORS (Cross-Origin Resource Sharing) middleware
# This allows the API to be accessed from different domains/origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows requests from any origin
    allow_credentials=True,  # Allows cookies to be included in requests
    allow_methods=["*"],  # Allows all HTTP methods (GET, POST, etc.)
    allow_headers=["*"],  # Allows all headers in requests
)

# Define the data model for chat requests using Pydantic
# This ensures incoming request data is properly validated
class ChatRequest(BaseModel):
    developer_message: str  # Message from the developer/system
    user_message: str      # Message from the user
    model: Optional[str] = "gpt-4.1-mini"  # Optional model selection with default
    api_key: str          # OpenAI API key for authentication

# Define the main chat endpoint that handles POST requests
@app.post("/api/chat")
async def chat(request: ChatRequest):
    try:
        # Initialize OpenAI client with the provided API key
        client = OpenAI(api_key=request.api_key)
        
        # Create an async generator function for streaming responses
        async def generate():
            # Create a streaming chat completion request
            stream = client.chat.completions.create(
                model=request.model,
                messages=[
                    {"role": "developer", "content": request.developer_message},
                    {"role": "user", "content": request.user_message}
                ],
                stream=True  # Enable streaming response
            )
            
            # Yield each chunk of the response as it becomes available
            for chunk in stream:
                if chunk.choices[0].delta.content is not None:
                    yield chunk.choices[0].delta.content

        # Return a streaming response to the client
        return StreamingResponse(generate(), media_type="text/plain")
    
    except Exception as e:
        # Handle any errors that occur during processing
        raise HTTPException(status_code=500, detail=str(e))

# Define a health check endpoint to verify API status
@app.get("/api/health")
async def health_check():
    return {"status": "ok"}

# In-memory storage for demo (not production safe)
pdf_vector_db = None
pdf_chunks = None

@app.post("/api/pdf/upload")
async def upload_pdf(file: UploadFile = File(...), api_key: str = Form(...)):
    try:
        # Save uploaded PDF to a temp file
        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
            shutil.copyfileobj(file.file, tmp)
            tmp_path = tmp.name
        # Load and split PDF
        loader = PDFLoader(tmp_path)
        documents = loader.load_documents()
        splitter = CharacterTextSplitter(chunk_size=1000, chunk_overlap=200)
        global pdf_chunks, pdf_vector_db
        pdf_chunks = splitter.split_texts(documents)
        # Build vector DB with user-supplied API key
        class UserEmbeddingModel(EmbeddingModel):
            def __init__(self, api_key, embeddings_model_name: str = "text-embedding-3-small"):
                self.openai_api_key = api_key
                self.async_client = None
                self.client = None
                self.embeddings_model_name = embeddings_model_name
                import openai
                openai.api_key = api_key
                from openai import AsyncOpenAI, OpenAI
                self.async_client = AsyncOpenAI(api_key=api_key)
                self.client = OpenAI(api_key=api_key)
        vector_db = VectorDatabase(embedding_model=UserEmbeddingModel(api_key))
        import asyncio
        vector_db = await vector_db.abuild_from_list(pdf_chunks)
        pdf_vector_db = vector_db
        return {"status": "success", "num_chunks": len(pdf_chunks)}
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})

class PDFChatRequest(BaseModel):
    query: str
    api_key: str = None
    k: int = 3
    model: Optional[str] = "gpt-4.1-mini"

@app.post("/api/pdf/chat")
async def chat_with_pdf(request: PDFChatRequest):
    try:
        global pdf_vector_db, pdf_chunks
        if pdf_vector_db is None or pdf_chunks is None:
            return JSONResponse(status_code=400, content={"error": "No PDF indexed. Please upload a PDF first."})
        # Retrieve top-k relevant chunks
        top_chunks = pdf_vector_db.search_by_text(request.query, k=request.k, return_as_text=True)
        # Compose context for RAG
        context = "\n---\n".join(top_chunks)
        prompt = f"You are a helpful assistant. Use the following PDF context to answer the user's question.\n\nContext:\n{context}\n\nQuestion: {request.query}\nAnswer:"
        # Use OpenAI API for completion
        client = OpenAI(api_key=request.api_key) if request.api_key else OpenAI()
        completion = client.chat.completions.create(
            model=request.model,
            messages=[{"role": "system", "content": prompt}],
            max_tokens=512
        )
        answer = completion.choices[0].message.content
        return {"answer": answer, "context": context}
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})

# Entry point for running the application directly
if __name__ == "__main__":
    import uvicorn
    # Start the server on all network interfaces (0.0.0.0) on port 8000
    uvicorn.run(app, host="0.0.0.0", port=8000)

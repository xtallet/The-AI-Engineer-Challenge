from dotenv import load_dotenv
load_dotenv()

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
import uuid
from aimakerspace.openai_utils.embedding import EmbeddingModel
from qdrant_client import QdrantClient
from qdrant_client.http.models import PointStruct, VectorParams, Distance, Filter, FieldCondition, MatchValue

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

# Example Qdrant endpoint: https://2dcff33f-3246-426d-a078-7cc2e2757e2b.us-east4-0.gcp.cloud.qdrant.io:6333
QDRANT_URL = os.environ.get("QDRANT_URL")  # Set this in your environment, e.g. https://2dcff33f-3246-426d-a078-7cc2e2757e2b.us-east4-0.gcp.cloud.qdrant.io:6333
QDRANT_API_KEY = os.environ.get("QDRANT_API_KEY")  # Set this in your environment
COLLECTION_NAME = "pdf_vectors"
EMBEDDING_SIZE = 1536  # OpenAI embedding size

if not QDRANT_URL:
    raise RuntimeError("QDRANT_URL environment variable is not set. Please set it in your deployment environment.")
if not QDRANT_API_KEY:
    raise RuntimeError("QDRANT_API_KEY environment variable is not set. Please set it in your deployment environment.")

qdrant = QdrantClient(url=QDRANT_URL, api_key=QDRANT_API_KEY)

# Ensure collection exists
try:
    qdrant.get_collection(COLLECTION_NAME)
except Exception:
    qdrant.recreate_collection(
        collection_name=COLLECTION_NAME,
        vectors_config=VectorParams(size=EMBEDDING_SIZE, distance=Distance.COSINE)
    )
    # Crear índices para los filtros
    qdrant.create_payload_index(
        collection_name=COLLECTION_NAME,
        field_name="user_id",
        field_schema="keyword"
    )
    qdrant.create_payload_index(
        collection_name=COLLECTION_NAME,
        field_name="pdf_id",
        field_schema="keyword"
    )

# Asegurar que los índices existen aunque la colección ya exista
qdrant.create_payload_index(
    collection_name=COLLECTION_NAME,
    field_name="user_id",
    field_schema="keyword"
)
qdrant.create_payload_index(
    collection_name=COLLECTION_NAME,
    field_name="pdf_id",
    field_schema="keyword"
)

@app.post("/api/pdf/upload")
async def upload_pdf(file: UploadFile = File(...), api_key: str = Form(...), user_id: str = Form("default"), pdf_id: str = Form("default")):
    print("[DEBUG] Received API key:", api_key)
    try:
        # Save uploaded PDF to a temp file
        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
            shutil.copyfileobj(file.file, tmp)
            tmp_path = tmp.name
        print("[DEBUG] PDF saved to temp path:", tmp_path)
        # Load and split PDF
        loader = PDFLoader(tmp_path)
        documents = loader.load_documents()
        print("[DEBUG] PDF loaded. Number of documents:", len(documents))
        splitter = CharacterTextSplitter(chunk_size=1000, chunk_overlap=200)
        global pdf_chunks, pdf_vector_db
        pdf_chunks = splitter.split_texts(documents)
        print("[DEBUG] Chunks creados:", len(pdf_chunks))
        # Get embeddings
        embedding_model = EmbeddingModel(embeddings_model_name="text-embedding-3-small", openai_api_key=api_key)
        print("[DEBUG] Obteniendo embeddings...")
        embeddings = embedding_model.get_embeddings(pdf_chunks)
        print("[DEBUG] Embeddings obtenidos:", len(embeddings))
        # Store in Qdrant
        points = [
            PointStruct(
                id=str(uuid.uuid4()),
                vector=embedding,
                payload={"text": chunk, "user_id": user_id, "pdf_id": pdf_id}
            )
            for chunk, embedding in zip(pdf_chunks, embeddings)
        ]
        print("[DEBUG] Haciendo upsert a Qdrant...", "Num points:", len(points))
        qdrant.upsert(collection_name=COLLECTION_NAME, points=points)
        print("[DEBUG] Upsert a Qdrant completado")
        pdf_vector_db = VectorDatabase(embedding_model=embedding_model)
        return {"status": "success", "num_chunks": len(pdf_chunks)}
    except Exception as e:
        print("[ERROR] Exception in /api/pdf/upload:", str(e))
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
        # Get embedding for query
        embedding_model = EmbeddingModel(embeddings_model_name="text-embedding-3-small", openai_api_key=request.api_key)
        query_embedding = embedding_model.get_embedding(request.query)
        # Search Qdrant for top-k relevant chunks
        search_result = qdrant.search(
            collection_name=COLLECTION_NAME,
            query_vector=query_embedding,
            limit=request.k,
            query_filter=Filter(
                must=[
                    FieldCondition(key="user_id", match=MatchValue(value="default")),
                    FieldCondition(key="pdf_id", match=MatchValue(value="default")),
                ]
            )
        )
        top_chunks = [hit.payload["text"] for hit in search_result]
        context = "\n---\n".join(top_chunks)
        system_message = (
            "You are an expert insurance assistant. Use the provided insurance policy context to answer the user's question as clearly and accurately as possible. "
            "If the answer is not in the context, say 'I could not find this information in your policy.'\n"
        )
        prompt = f"{system_message}\nContext:\n{context}\n\nQuestion: {request.query}\nAnswer:"
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

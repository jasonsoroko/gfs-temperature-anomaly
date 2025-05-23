from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime
import logging
from .api.temperature import router as temperature_router

# Configure logging
logging.basicConfig(level=logging.INFO)

app = FastAPI(title="GFS Temperature Anomaly API", version="1.0.0")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify exact origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(temperature_router)

@app.get("/")
def root():
    return {
        "message": "GFS Temperature Anomaly API", 
        "status": "running",
        "docs": "/docs"
    }

@app.get("/health")
def health():
    return {"status": "healthy", "timestamp": datetime.utcnow()}
from fastapi import FastAPI
from datetime import datetime

app = FastAPI(title="GFS Temperature Anomaly API")

@app.get("/")
def root():
    return {"message": "GFS Temperature Anomaly API", "status": "running"}

@app.get("/health")
def health():
    return {"status": "healthy", "timestamp": datetime.utcnow()}

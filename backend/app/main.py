from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[1] / ".env")

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import analizar, repregunta

app = FastAPI(
    title="Evalia API",
    description="backend de evaluacion de exposiciones orales",
    version="1.0.0"
)

#Comunicaciones con el frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

#registro de routers
app.include_router(analizar.router, prefix="/api")
app.include_router(repregunta.router, prefix="/api")

@app.get("/")
async def inicio():
    return {
        "message": "API de Evalia funcionando",
        "estado":"activo"
    }

@app.get("/health")
async def health():
    return{
        "status":"ok"
    }

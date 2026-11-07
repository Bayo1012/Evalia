from fastapi import APIRouter

router = APIRouter(
    prefix="/repregunta",
    tags=["Repreguntas"]
)


@router.get("/")
async def inicio_repreguntas():
    return {
        "estado": "activo",
        "mensaje": "Módulo de repreguntas disponible"
    }
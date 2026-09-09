from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routes.cutout import router as cutout_router
from app.routes.analyze import router as analyze_router
from app.config import settings

app = FastAPI(
    title="GDP Vision Service",
    version="1.0.0",
    description="Dedicated background cutout and visual analysis microservice for GDP Design Engine.",
)

if settings.enable_cors:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

app.include_router(cutout_router)
app.include_router(analyze_router)

@app.get("/health", tags=["System"])
async def health_check():
    return {
        "status": "healthy",
        "service": settings.service_name,
        "model": settings.model_name,
    }

@app.get("/", tags=["System"])
async def root():
    return {
        "service": "GDP Vision Service",
        "docs": "/docs",
        "health": "/health",
    }

import os
from pydantic import BaseModel

class Settings(BaseModel):
    service_name: str = "gdp-vision-service"
    secret_key: str = os.getenv("VISION_SERVICE_SECRET", "gdp-vision-dev-secret")
    model_name: str = os.getenv("VISION_MODEL_NAME", "u2net")
    max_image_size_mb: int = int(os.getenv("MAX_IMAGE_SIZE_MB", "15"))
    enable_cors: bool = True

settings = Settings()

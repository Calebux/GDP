# GDP Vision Microservice (D-17)

A dedicated, lightweight Python FastAPI service that executes high-frequency vision workloads:
- Background Cutouts via `rembg` U2Net / BiRefNet.
- Canvas Ink Coverage & Visual Density Analysis.
- Visual Center of Mass & Skew Calculation.

---

## 1. Local Development Setup

```bash
cd services/vision

# Create virtual environment
python -m venv .venv
source .venv/bin/activate  # Or on Windows: .venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Run development server
uvicorn app.main:app --reload --port 8000
```

Interactive API documentation available at `http://localhost:8000/docs`.

---

## 2. Docker Deployment

```bash
docker build -t gdp-vision-service .
docker run -p 8000:8000 -e VISION_SERVICE_SECRET=your-secret gdp-vision-service
```

---

## 3. Endpoints

- `GET /health`: Liveness and model readiness probe.
- `POST /v1/cutout`: Multipart image upload returning transparent PNG.
- `POST /v1/cutout/json`: JSON base64 cutout with bounding box.
- `POST /v1/analyze`: Ink coverage and center of mass analysis.

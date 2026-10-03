from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from crawlflow.api.routes import health, runs, workflows
from crawlflow.demo import router as demo_router

app = FastAPI(title="Crawlflow", version="0.2.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:5173", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(demo_router)
app.include_router(health.router)
app.include_router(workflows.router)
app.include_router(runs.router)

"""Rokadly API server."""
import logging
from fastapi import FastAPI, APIRouter
from starlette.middleware.cors import CORSMiddleware
import os

from core import client, ensure_indexes, today_ist
import routes_admin
import routes_entry
import routes_cash
import routes_recon
import routes_reports

app = FastAPI(title="Rokadly", version="1.0")

api_router = APIRouter(prefix="/api")


@api_router.get("/")
async def root():
    return {"app": "Rokadly", "today": today_ist(), "status": "ok"}


api_router.include_router(routes_admin.router)
api_router.include_router(routes_entry.router)
api_router.include_router(routes_cash.router)
api_router.include_router(routes_recon.router)
api_router.include_router(routes_reports.router)

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO,
                    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


@app.on_event("startup")
async def startup():
    await ensure_indexes()
    logger.info("Rokadly indexes ensured")


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()

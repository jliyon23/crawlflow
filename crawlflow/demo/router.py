"""Deterministic fake store locator used by the bundled examples.

  GET /demo/search?zip=10001&page=1   HTML results, 3 stores per page, 2 pages
  GET /demo/api/store/{store_id}      JSON detail for one store
  GET /demo/api/nearby?lat=..&lng=..  JSON list under $.data.stores[*]
  POST /demo/api/search {"zip", "page"} JSON list + next_page cursor
"""

from __future__ import annotations

import hashlib
from html import escape

from fastapi import APIRouter, Body, HTTPException
from fastapi.responses import HTMLResponse

router = APIRouter(prefix="/demo", include_in_schema=False)

CITIES = [
    ("New York", "NY"),
    ("Chicago", "IL"),
    ("Austin", "TX"),
    ("Denver", "CO"),
    ("Seattle", "WA"),
    ("Miami", "FL"),
]
STREETS = ["Main St", "Oak Ave", "Market St", "2nd Ave", "Elm St", "Pine Rd"]
PER_PAGE = 3
PAGES = 2


def _n(text: str) -> int:
    return int(hashlib.sha1(text.encode()).hexdigest()[:8], 16)


def _store(store_id: str) -> dict:
    zip_code, _, idx = store_id.partition("-")
    if not (zip_code.isdigit() and idx.isdigit()):
        raise HTTPException(404, "unknown store")
    h = _n(store_id)
    city, state = CITIES[h % len(CITIES)]
    return {
        "id": store_id,
        "name": f"Demo Market #{idx} ({zip_code})",
        "address": {
            "street": f"{100 + h % 900} {STREETS[h % len(STREETS)]}",
            "city": city,
            "state": state,
            "zip": zip_code,
        },
        "phone": f"(555) {h % 900 + 100:03d}-{h % 9000 + 1000:04d}",
        "hours": [
            {"day": "Mon-Fri", "open": "08:00", "close": "21:00"},
            {"day": "Sat-Sun", "open": "09:00", "close": "18:00"},
        ],
        "geo": {"lat": round(25 + (h % 2000) / 100, 5), "lng": round(-120 + (h % 4000) / 100, 5)},
        "url": f"/demo/stores/{store_id}",
    }


@router.get("/search", response_class=HTMLResponse)
def search(zip: str = "", page: int = 1):
    if not zip.isdigit():
        return HTMLResponse("<html><body><p class='empty'>Enter a ZIP code</p></body></html>")
    start = (page - 1) * PER_PAGE
    ids = [f"{zip}-{i}" for i in range(start + 1, start + PER_PAGE + 1)] if 1 <= page <= PAGES else []
    cards = "\n".join(
        f"""<div class="store" data-store-id="{escape(sid)}">
  <h3 class="name">{escape(_store(sid)['name'])}</h3>
  <a class="details" href="/demo/stores/{escape(sid)}">Details</a>
</div>"""
        for sid in ids
    )
    nxt = f'<a class="next" href="/demo/search?zip={escape(zip)}&amp;page={page + 1}">Next</a>' if page < PAGES else ""
    return HTMLResponse(f"<html><body><h1>Stores near {escape(zip)}</h1>\n{cards}\n{nxt}</body></html>")


@router.get("/api/store/{store_id}")
def store_detail(store_id: str):
    return {"status": "ok", "data": {"store": _store(store_id)}}


@router.post("/api/search")
def api_search(body: dict = Body(...)):
    zip_code = str(body.get("zip", ""))
    page = int(body.get("page") or 1)
    if not zip_code.isdigit():
        raise HTTPException(400, "zip is required")
    start = (page - 1) * PER_PAGE
    stores = [_store(f"{zip_code}-{i}") for i in range(start + 1, start + PER_PAGE + 1)] if page <= PAGES else []
    return {
        "data": {"stores": [{"id": s["id"], "name": s["name"]} for s in stores]},
        "next_page": page + 1 if page < PAGES else None,
    }


@router.get("/api/nearby")
def nearby(lat: float, lng: float, limit: int = 4):
    key = f"{lat:.2f},{lng:.2f}"
    zip_code = str(10000 + _n(key) % 89999)
    stores = [_store(f"{zip_code}-{i}") for i in range(1, max(1, min(limit, 10)) + 1)]
    return {"query": {"lat": lat, "lng": lng}, "data": {"count": len(stores), "stores": stores}}

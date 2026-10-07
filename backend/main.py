import os
import hmac
import hashlib
import json
import math
from typing import Any

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, Header, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from supabase import create_client, Client


load_dotenv()


# =========================
# ENVIRONMENT
# =========================

SUPABASE_URL = os.getenv(
    "SUPABASE_URL",
    ""
)

SUPABASE_SERVICE_ROLE_KEY = os.getenv(
    "SUPABASE_SERVICE_ROLE_KEY",
    ""
)

CROWD_INGEST_SECRET = os.getenv(
    "CROWD_INGEST_SECRET",
    ""
)

OVERPASS_URL = os.getenv(
    "OVERPASS_URL",
    "https://overpass-api.de/api/interpreter"
)

ROUTING_BASE_URL = os.getenv(
    "ROUTING_BASE_URL",
    "https://router.project-osrm.org"
)

CORS_ORIGINS = [
    x.strip()
    for x in os.getenv(
        "CORS_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173"
    ).split(",")
    if x.strip()
]


# =========================
# APP
# =========================

app = FastAPI(
    title="PujaPath Live API",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =========================
# SUPABASE
# =========================

sb: Client | None = (
    create_client(
        SUPABASE_URL,
        SUPABASE_SERVICE_ROLE_KEY
    )
    if SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
    else None
)


# =========================
# HEALTH
# =========================

@app.get("/health")
def health():
    return {
        "ok": True,
        "supabase_configured": bool(sb),
        "synthetic_data": False,
    }


# =========================
# PANDALS
# =========================

@app.get("/api/pandals")
def get_pandals(
    zone: str | None = Query(default=None)
):
    if not sb:
        raise HTTPException(
            503,
            "Supabase is not configured"
        )

    q = (
        sb.table("pandals")
        .select(
            "id,name,zone,latitude,longitude,address,verified"
        )
    )

    if zone:
        q = q.eq("zone", zone)

    return q.execute().data


# =========================
# CROWD
# =========================

@app.get("/api/crowd")
def get_crowd(
    pandal_id: str | None = Query(default=None)
):
    if not sb:
        raise HTTPException(
            503,
            "Supabase is not configured"
        )

    q = (
        sb.table("crowd_updates")
        .select(
            "id,pandal_id,level,queue_minutes,"
            "source,reported_at,expires_at"
        )
        .order(
            "reported_at",
            desc=True
        )
        .limit(200)
    )

    if pandal_id:
        q = q.eq(
            "pandal_id",
            pandal_id
        )

    rows = q.execute().data

    from datetime import datetime, timezone

    now = datetime.now(timezone.utc)

    out = []

    for row in rows:
        try:
            exp = datetime.fromisoformat(
                row["expires_at"].replace(
                    "Z",
                    "+00:00"
                )
            )

            if exp > now:
                out.append(row)

        except Exception:
            continue

    return out


# =========================
# CROWD INGEST
# =========================

@app.post("/api/ingest/crowd")
async def ingest_crowd(
    payload: dict[str, Any],
    x_crowd_signature: str = Header(default="")
):
    if not CROWD_INGEST_SECRET:
        raise HTTPException(
            503,
            "Crowd ingest secret is not configured"
        )

    canonical = json.dumps(
        payload,
        separators=(",", ":"),
        sort_keys=True
    ).encode()

    expected = hmac.new(
        CROWD_INGEST_SECRET.encode(),
        canonical,
        hashlib.sha256
    ).hexdigest()

    if not hmac.compare_digest(
        expected,
        x_crowd_signature
    ):
        raise HTTPException(
            401,
            "Invalid crowd feed signature"
        )

    required = [
        "pandal_id",
        "level",
        "source",
        "reported_at",
        "expires_at",
    ]

    missing = [
        k
        for k in required
        if k not in payload
    ]

    if missing:
        raise HTTPException(
            422,
            f"Missing: {', '.join(missing)}"
        )

    if payload["level"] not in {
        "low",
        "medium",
        "high",
    }:
        raise HTTPException(
            422,
            "level must be low, medium, or high"
        )

    if not sb:
        raise HTTPException(
            503,
            "Supabase is not configured"
        )

    row = {
        k: payload[k]
        for k in required
    }

    row["queue_minutes"] = payload.get(
        "queue_minutes"
    )

    return (
        sb.table("crowd_updates")
        .insert(row)
        .execute()
        .data
    )


# =========================
# NEARBY ESSENTIALS
# =========================

# =========================
# NEARBY ESSENTIALS
# =========================

@app.post("/api/nearby")
async def nearby(body: dict[str, Any]):
    try:
        lat = float(body.get("lat"))
        lon = float(body.get("lon"))
        radius = int(body.get("radius", 1500))
    except (TypeError, ValueError):
        raise HTTPException(
            status_code=400,
            detail="Invalid latitude, longitude, or radius"
        )

    if not (-90 <= lat <= 90 and -180 <= lon <= 180):
        raise HTTPException(
            status_code=400,
            detail="Invalid coordinates"
        )

    radius = max(200, min(radius, 3000))

    query = f"""
[out:json][timeout:20];

(
  nwr(around:{radius},{lat},{lon})["amenity"="atm"];

  nwr(around:{radius},{lat},{lon})["station"="subway"];
  nwr(around:{radius},{lat},{lon})["subway"="yes"];
  nwr(around:{radius},{lat},{lon})["railway"="subway_entrance"];

  nwr(around:{radius},{lat},{lon})["railway"="station"];
  nwr(around:{radius},{lat},{lon})["railway"="halt"];

  nwr(around:{radius},{lat},{lon})["highway"="bus_stop"];
  nwr(around:{radius},{lat},{lon})["amenity"="bus_station"];

  nwr(around:{radius},{lat},{lon})["amenity"="hospital"];
  nwr(around:{radius},{lat},{lon})["amenity"="police"];
  nwr(around:{radius},{lat},{lon})["amenity"="toilets"];
  nwr(around:{radius},{lat},{lon})["amenity"="restaurant"];
  nwr(around:{radius},{lat},{lon})["amenity"="drinking_water"];
  nwr(around:{radius},{lat},{lon})["tourism"="hotel"];
);

out center tags;
"""

    endpoints = [
        OVERPASS_URL,
        "https://overpass.private.coffee/api/interpreter",
        "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
    ]

    headers = {
        "User-Agent": "PujaPath-Live/1.0",
        "Accept": "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
    }

    errors = []

    for endpoint in endpoints:
        try:
            async with httpx.AsyncClient(
                timeout=30.0,
                follow_redirects=True,
                headers=headers,
            ) as client:

                response = await client.post(
                    endpoint,
                    content="data=" + query,
                )

                if response.status_code != 200:
                    errors.append(
                        f"{endpoint} -> "
                        f"HTTP {response.status_code}: "
                        f"{response.text[:200]}"
                    )
                    continue

                result = response.json()

                return result.get("elements", [])

        except httpx.TimeoutException:
            errors.append(
                f"{endpoint} -> timeout"
            )

        except Exception as error:
            errors.append(
                f"{endpoint} -> {str(error)}"
            )

    raise HTTPException(
        status_code=502,
        detail={
            "message": "Nearby service unavailable",
            "errors": errors,
        },
    )


# =========================
# TRANSPORT HELPERS
# =========================

def distance_km(
    lat1: float,
    lon1: float,
    lat2: float,
    lon2: float
) -> float:

    radius = 6371

    d_lat = math.radians(
        lat2 - lat1
    )

    d_lon = math.radians(
        lon2 - lon1
    )

    a = (
        math.sin(d_lat / 2) ** 2
        +
        math.cos(
            math.radians(lat1)
        )
        *
        math.cos(
            math.radians(lat2)
        )
        *
        math.sin(d_lon / 2) ** 2
    )

    c = (
        2
        * math.atan2(
            math.sqrt(a),
            math.sqrt(1 - a)
        )
    )

    return radius * c


def get_element_coordinates(
    element: dict[str, Any]
):
    lat = element.get("lat")
    lon = element.get("lon")

    if lat is None:
        lat = (
            element
            .get("center", {})
            .get("lat")
        )

    if lon is None:
        lon = (
            element
            .get("center", {})
            .get("lon")
        )

    try:
        return (
            float(lat),
            float(lon)
        )
    except (
        TypeError,
        ValueError
    ):
        return None


def is_metro(
    tags: dict[str, Any]
) -> bool:

    return (
        tags.get("station")
        == "subway"
        or
        tags.get("subway")
        == "yes"
        or
        tags.get("railway")
        == "subway_entrance"
        or
        (
            tags.get("railway")
            == "station"
            and
            tags.get("subway")
            == "yes"
        )
    )


def is_train(
    tags: dict[str, Any]
) -> bool:

    return (
        not is_metro(tags)
        and
        tags.get("railway")
        in {
            "station",
            "halt",
            "stop"
        }
    )


def is_bus(
    tags: dict[str, Any]
) -> bool:

    return (
        tags.get("highway")
        == "bus_stop"
        or
        tags.get("amenity")
        == "bus_station"
        or
        (
            tags.get(
                "public_transport"
            )
            == "platform"
            and
            tags.get("bus")
            == "yes"
        )
    )


def nearest_transport(
    items: list[dict[str, Any]],
    checker
):
    matches = [
        item
        for item in items
        if checker(item["tags"])
    ]

    if not matches:
        return None

    matches.sort(
        key=lambda item:
            item["distance"]
    )

    return matches[0]


# =========================
# TRANSPORT API
# =========================

@app.get("/api/transport")
async def transport(
    lat: float = Query(...),
    lon: float = Query(...),
    radius: int = Query(
        default=3000,
        ge=500,
        le=5000
    )
):

    if not (
        -90 <= lat <= 90
        and -180 <= lon <= 180
    ):
        raise HTTPException(
            422,
            "Invalid coordinates"
        )

    query = f"""
    [out:json][timeout:20];

    (
        /* =========================
           METRO
           ========================= */

        nwr(
            around:{radius},{lat},{lon}
        )["station"="subway"];

        nwr(
            around:{radius},{lat},{lon}
        )["subway"="yes"];

        nwr(
            around:{radius},{lat},{lon}
        )["railway"="subway_entrance"];

        nwr(
            around:{radius},{lat},{lon}
        )["railway"="station"]["subway"="yes"];

        nwr(
            around:{radius},{lat},{lon}
        )["public_transport"="station"]["subway"="yes"];


        /* =========================
           TRAIN
           ========================= */

        nwr(
            around:{radius},{lat},{lon}
        )["railway"="station"];

        nwr(
            around:{radius},{lat},{lon}
        )["railway"="halt"];

        nwr(
            around:{radius},{lat},{lon}
        )["railway"="stop"];


        /* =========================
           BUS
           ========================= */

        nwr(
            around:{radius},{lat},{lon}
        )["highway"="bus_stop"];

        nwr(
            around:{radius},{lat},{lon}
        )["amenity"="bus_station"];

        nwr(
            around:{radius},{lat},{lon}
        )["public_transport"="platform"]["bus"="yes"];
    );

    out center tags;
    """

    endpoints = [
        OVERPASS_URL,
        "https://overpass.private.coffee/api/interpreter",
    ]

    data = None
    last_error = None

    headers = {
        "User-Agent": "PujaPath-Live/1.0",
        "Accept": "application/json",
    }

    for endpoint in endpoints:

        try:
            async with httpx.AsyncClient(
                timeout=25,
                follow_redirects=True,
                headers=headers
            ) as client:

                response = await client.post(
                    endpoint,
                    data={
                        "data": query
                    }
                )

                if response.status_code != 200:
                    last_error = (
                        f"Overpass {response.status_code}: "
                        f"{response.text[:300]}"
                    )
                    continue

                data = response.json()
                break

        except Exception as error:
            last_error = error

    if data is None:
        raise HTTPException(
            503,
            "Transport service unavailable: "
            + str(last_error)
        )

    elements = data.get(
        "elements",
        []
    )

    items = []

    for element in elements:

        coordinates = (
            get_element_coordinates(
                element
            )
        )

        if not coordinates:
            continue

        item_lat, item_lon = coordinates

        tags = element.get(
            "tags",
            {}
        )

        name = (
            tags.get("name")
            or
            tags.get("name:en")
            or
            tags.get("ref")
            or
            "Unnamed Stop"
        )

        distance = distance_km(
            lat,
            lon,
            item_lat,
            item_lon
        )

        items.append({
            "name": name,
            "distance": round(
                distance,
                3
            ),
            "lat": item_lat,
            "lon": item_lon,
            "tags": tags,
        })

    metro = nearest_transport(
        items,
        is_metro
    )

    train = nearest_transport(
        items,
        is_train
    )

    bus = nearest_transport(
        items,
        is_bus
    )

    return {
        "metro": metro,
        "train": train,
        "bus": bus,
    }


# =========================
# ROAD ROUTE
# =========================

@app.get("/api/route")
async def route(
    points: str
):

    coords = ";".join(
        p.strip()
        for p in points.split(";")
        if p.strip()
    )

    if len(
        coords.split(";")
    ) < 2:
        raise HTTPException(
            422,
            "Provide at least two points"
        )

    url = (
        f"{ROUTING_BASE_URL.rstrip('/')}"
        f"/route/v1/foot/{coords}"
    )

    params = {
        "alternatives": "true",
        "steps": "true",
        "geometries": "geojson",
        "overview": "full",
    }

    async with httpx.AsyncClient(
        timeout=20
    ) as client:

        r = await client.get(
            url,
            params=params
        )

        r.raise_for_status()

        return r.json()
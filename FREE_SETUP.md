# PujaPath — ₹0 Development Setup

This project is designed so you can learn and develop it without purchasing paid APIs.

## What can be free
- Frontend: React + Vite (local)
- Map: Leaflet + OpenStreetMap (respect attribution and tile policy)
- Nearby places: OpenStreetMap + Overpass (respect public endpoint limits)
- Routing: OSRM-compatible public endpoint for low-volume development, or self-host later
- Backend: FastAPI + Python (local)
- Database/Auth/Realtime: Supabase free tier where available, or run equivalent services locally

## Important limits
“Free” does not mean unlimited. Hosted free tiers and public APIs can have quotas, rate limits and changing terms. Do not bypass them.

## Live crowd data
There is no universal public Kolkata crowd API included in this project. The app only accepts crowd data from an authorised source through the signed endpoint:

POST /api/ingest/crowd

Until you connect a genuine source, the app must show “Live feed unavailable”. Do not insert made-up crowd values.

## Zero-cost learning path
1. Run frontend and backend locally.
2. Create a free Supabase project if you want hosted auth/database/realtime.
3. Use OpenStreetMap/Overpass/OSRM carefully for development.
4. Build and test friend sharing only with explicit consent.
5. Add a real organiser/official crowd provider only when you have an authorised feed.

## Security reminders
- Never put SUPABASE_SERVICE_ROLE_KEY in frontend code.
- Use HTTPS for deployed location-sharing features.
- Use private realtime channels and RLS.
- Expire location sharing automatically.
- Add moderation and reporting for photo posts.

# PujaPath Live — real-data web app starter

This version wires the UI to real services rather than demo placeholders.

### Live pieces
- Supabase PostgreSQL stores verified pandals and crowd updates.
- Supabase Realtime streams crowd updates to the browser.
- Supabase Realtime private Broadcast channels carry opted-in friend locations.
- Browser Geolocation supplies the user's own live position only after permission.
- Overpass queries OpenStreetMap for nearby toilets, hospitals, police, restaurants, hotels and railway stations.
- OSRM-compatible routing is called through the backend for walking routes.
- No fallback fake values are returned when a provider is unavailable.

### Start
Backend:
```bash
cd backend
python -m venv .venv
# Windows: .venv\\Scripts\\activate
# Linux/macOS: source .venv/bin/activate
pip install -r requirements.txt
# copy .env.example to .env and fill secrets
uvicorn main:app --reload --port 8000
```
Frontend:
```bash
cd frontend
npm install
# copy .env.example to .env and fill Supabase URL/key
npm run dev
```
Tests:
```bash
cd backend
pytest -q
```

### Crowd: this is where the actual live feed enters
There is not a universal public Kolkata crowd stream built into this code. Your authorised organiser/traffic/police/event provider must POST signed updates to `/api/ingest/crowd`.

Canonical JSON is sorted by key and emitted without spaces. HMAC-SHA256 of that exact UTF-8 string, using `CROWD_INGEST_SECRET`, goes into `X-Crowd-Signature`.

Example payload:
```json
{"pandal_id":"UUID","level":"high","queue_minutes":45,"source":"organiser-abc","reported_at":"2026-10-01T18:30:00+05:30","expires_at":"2026-10-01T18:45:00+05:30"}
```

If no authorised feed is connected, the API returns no crowd data rather than inventing one.

### Location sharing
Use private Realtime topics named `group:<group_uuid>`. Users must authenticate, belong to the group, and explicitly start sharing. Stop sharing revokes the browser watcher. For production, add server-side share-expiry/revocation and a dedicated group-join RPC instead of allowing arbitrary membership inserts.

Supabase recommends private Realtime channels and lets RLS policies on `realtime.messages` decide who can receive or send broadcasts. Broadcast is the recommended Realtime option for scalable/security-sensitive updates. See official docs: https://supabase.com/docs/guides/realtime/authorization and https://supabase.com/docs/guides/realtime/subscribing-to-database-changes

### Map / OSM notes
The browser uses the standard OpenStreetMap raster tile URL and includes attribution. OpenStreetMap's tile service is best-effort and has usage requirements, including attribution and no bulk/offline prefetch. For a festival-scale production app, use a tile provider sized for your traffic or self-host the map stack.

Overpass public endpoints can be overloaded; cache small-area results or use your own/commercial provider for production traffic. Nominatim public usage has strict limits, so it is not used directly here for high-volume search.

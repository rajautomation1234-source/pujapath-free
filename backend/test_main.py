from fastapi.testclient import TestClient
from main import app
client=TestClient(app)

def test_health():
    r=client.get('/health')
    assert r.status_code==200
    assert r.json()['synthetic_data'] is False

def test_route_validation():
    r=client.get('/api/route',params={'points':'22.5,88.3'})
    assert r.status_code==422

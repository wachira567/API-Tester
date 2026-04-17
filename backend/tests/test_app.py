import json
from pathlib import Path

from app import create_app


def test_health_endpoint():
    app = create_app()
    client = app.test_client()

    response = client.get('/api/health')
    assert response.status_code == 200
    payload = response.get_json()
    assert payload['ok'] is True
    assert 'dbEnabled' in payload


def test_analyze_requires_filename():
    app = create_app()
    client = app.test_client()

    response = client.get('/api/analyze')
    assert response.status_code == 400
    assert 'filename is required' in response.get_json()['error']


def test_import_collection_and_list(tmp_path: Path, monkeypatch):
    monkeypatch.setenv('COLLECTION_PATH', str(tmp_path / 'collections'))
    monkeypatch.setenv('ENVIRONMENT_PATH', str(tmp_path / 'environments'))
    monkeypatch.setenv('POSTMAN_PATH', str(tmp_path / 'postman'))

    (tmp_path / 'collections').mkdir(parents=True, exist_ok=True)
    (tmp_path / 'environments').mkdir(parents=True, exist_ok=True)
    (tmp_path / 'postman').mkdir(parents=True, exist_ok=True)

    app = create_app()
    client = app.test_client()

    sample = {
        'info': {'name': 'test'},
        'item': [
            {
                'name': 'Ping',
                'request': {'method': 'GET', 'url': {'raw': '{{base_url}}/health'}},
                'response': [{'code': 200}],
            }
        ],
    }

    response = client.post(
        '/api/import',
        json={
            'kind': 'collection',
            'filename': 'sample-collection.json',
            'content': json.dumps(sample),
        },
    )

    assert response.status_code == 200
    payload = response.get_json()
    assert payload['imported']['filename'].startswith('imported-collections/')
    assert isinstance(payload['items'], list)

    listed = client.get('/api/collections')
    assert listed.status_code == 200
    items = listed.get_json()
    assert any(i['filename'].startswith('imported-collections/') for i in items)

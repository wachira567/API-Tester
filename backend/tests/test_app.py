import json
from pathlib import Path

from app import create_app


def test_health_endpoint():
    app = create_app()
    app.config['RATELIMIT_ENABLED'] = False
    client = app.test_client()

    response = client.get('/api/health', headers={'x-user-id': 'test-user'})
    assert response.status_code == 200
    payload = response.get_json()
    assert payload['ok'] is True
    assert 'dbEnabled' in payload


def test_auth_required_when_guest_disabled(monkeypatch):
    monkeypatch.setenv('API_TESTER_ALLOW_GUEST_USER', 'false')
    app = create_app()
    app.config['RATELIMIT_ENABLED'] = False
    client = app.test_client()

    response = client.get('/api/collections')
    assert response.status_code == 401
    assert 'Authentication required' in response.get_json()['error']


def test_analyze_requires_filename():
    app = create_app()
    app.config['RATELIMIT_ENABLED'] = False
    client = app.test_client()

    response = client.get('/api/analyze', headers={'x-user-id': 'test-user'})
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
    app.config['RATELIMIT_ENABLED'] = False
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
        headers={'x-user-id': 'test-user'},
        json={
            'kind': 'collection',
            'filename': 'sample-collection.json',
            'content': json.dumps(sample),
        },
    )

    assert response.status_code == 200
    payload = response.get_json()
    assert payload['imported']['filename'].startswith(
        ('imported-collections/', 'db-collections/')
    )
    assert isinstance(payload['items'], list)

    listed = client.get('/api/collections', headers={'x-user-id': 'test-user'})
    assert listed.status_code == 200
    items = listed.get_json()
    assert any(
        i['filename'].startswith(('imported-collections/', 'db-collections/'))
        for i in items
    )


def test_collections_are_user_scoped():
    app = create_app()
    app.config['RATELIMIT_ENABLED'] = False
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
        headers={'x-user-id': 'user-a'},
        json={
            'kind': 'collection',
            'filename': 'user-a-only.json',
            'content': json.dumps(sample),
        },
    )
    assert response.status_code == 200

    user_a_items = client.get('/api/collections', headers={'x-user-id': 'user-a'}).get_json()
    user_b_items = client.get('/api/collections', headers={'x-user-id': 'user-b'}).get_json()

    user_a_filenames = {item['filename'] for item in user_a_items}
    user_b_filenames = {item['filename'] for item in user_b_items}

    assert user_a_filenames
    assert user_a_filenames.isdisjoint(user_b_filenames)

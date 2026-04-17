import json
import os
import subprocess

def recursive_filter(items, passed_names):
    filtered_items = []
    for item in items:
        if 'item' in item:
            # It's a folder
            sub_items = recursive_filter(item['item'], passed_names)
            if sub_items:
                item['item'] = sub_items
                filtered_items.append(item)
        else:
            # It's a request
            name = item.get('name', '')
            req_url = item.get('request', {}).get('url', {})
            url_str = req_url.get('raw', '') if isinstance(req_url, dict) else str(req_url)
            
            is_auth = 'Login' in name or 'Auth' in name or '/login' in url_str
            
            if name in passed_names and not is_auth:
                # Skip passed endpoints that aren't authentication
                continue
                
            # If it's a customer-specific endpoint, ensure it uses customer_token
            if '/customer/' in url_str and isinstance(item.get('request', {}).get('auth', {}).get('bearer'), list):
                for bearer in item['request']['auth']['bearer']:
                    if bearer.get('key') == 'token':
                        bearer['value'] = '{{customer_token}}'
            
            # Inject robust token-saving script
            events = item.get('event', [])
            test_event = next((e for e in events if e.get('listen') == 'test'), None)
            token_script = """
if (pm.response.code >= 200 && pm.response.code < 300) {
    try {
        var jsonData = pm.response.json();
        if (jsonData.token) {
            if (pm.request.url.getPath().includes('customer')) {
                pm.environment.set("customer_token", jsonData.token);
                console.log("Saved customer_token");
            } else {
                pm.environment.set("auth_token", jsonData.token);
                pm.environment.set("token", jsonData.token);
                console.log("Saved auth_token");
            }
        }
    } catch(e) {}
}
"""
            if test_event:
                if isinstance(test_event.get('script', {}).get('exec'), list):
                    test_event['script']['exec'].append(token_script)
            else:
                events.append({
                    "listen": "test",
                    "script": {
                        "type": "text/javascript",
                        "exec": token_script.split('\n')
                    }
                })
                item['event'] = events

            filtered_items.append(item)
            
    return filtered_items

def main():
    print("Loading baseline...")
    with open('postman/latest_baseline.json', 'r') as f:
        baseline = json.load(f)
        
    passed_names = set()
    for run in baseline.get('run', {}).get('executions', []):
        code = run.get('response', {}).get('code', 0)
        name = run.get('item', {}).get('name')
        if str(code).startswith('2'):
            passed_names.add(name)

    print(f"Found {len(passed_names)} previously passed endpoints.")
    
    print("Loading main collection...")
    with open('postman/Gavo_API_v3_Passing.json', 'r') as f:
        coll = json.load(f)
        
    coll['item'] = recursive_filter(coll.get('item', []), passed_names)
    
    out_file = 'postman/Gavo_API_v3_Remaining.json'
    with open(out_file, 'w') as f:
        json.dump(coll, f, indent=2)
        
    print(f"Created optimized collection: {out_file}")
    print("Run this collection using: newman run postman/Gavo_API_v3_Remaining.json -e postman/Gavo_V3_API_Environment.json")

if __name__ == '__main__':
    main()

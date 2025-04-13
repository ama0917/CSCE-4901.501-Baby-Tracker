import requests

BASE_URL = "http://localhost:8000"
TOKEN = "YOUR_FIREBASE_JWT_TOKEN_HERE"
HEADERS = {
    "Authorization": f"Bearer {TOKEN}",
    "Content-Type": "application/json"
}

def test_profile():
    res = requests.get(f"{BASE_URL}/profile", headers=HEADERS)
    print("GET /profile:", res.status_code, res.json())

def test_add_child():
    payload = {
        "name": "Tom",
        "dob": "2025-04-09"
    }
    res = requests.post(f"{BASE_URL}/children/", headers=HEADERS, json=payload)
    print("POST /children/:", res.status_code, res.json())
    return res.json().get("child_id")

def test_log_activity(child_id):
    payload = {
        "timestamp": "2025-04-10T09:00:00",
        "type": "meal"
    }
    res = requests.post(f"{BASE_URL}/log/?child_id={child_id}", headers=HEADERS, json=payload)
    print("POST /log/:", res.status_code, res.json())

def test_get_logs(child_id):
    res = requests.get(f"{BASE_URL}/logs/?child_id={child_id}", headers=HEADERS)
    print("GET /logs/:", res.status_code, res.json())

def test_reports(child_id):
    for report_type in ["excel", "pdf", "json"]:
        res = requests.get(f"{BASE_URL}/report/{report_type}?child_id={child_id}", headers=HEADERS)
        print(f"GET /report/{report_type}:", res.status_code)
        if "application/json" in res.headers.get("Content-Type", ""):
            print(res.json())

if __name__ == "__main__":
    test_profile()
    child_id = test_add_child()
    if child_id:
        test_log_activity(child_id)
        test_get_logs(child_id)
        test_reports(child_id)

from flask import Flask, jsonify
from threading import Thread
import os

app = Flask(__name__)

# 🔹 Absolute path to serviceAccountKey.json using raw string to avoid Windows backslash issues
SERVICE_ACCOUNT_PATH = r"C:\Users\cneno\Downloads\CSCE-4901.501-Baby-Tracker-main\CSCE-4901.501-Baby-Tracker-main\backend\serviceAccountKey.json"

# 🔹 Debug check: confirm Python can see the file
print("[Debug] Checking if service account file exists at path:")
print(SERVICE_ACCOUNT_PATH)
print("[Debug] Exists?", os.path.isfile(SERVICE_ACCOUNT_PATH))

# Set environment variable before importing backup_service
os.environ["FIREBASE_SERVICE_ACCOUNT"] = SERVICE_ACCOUNT_PATH
print(f"[Flask] FIREBASE_SERVICE_ACCOUNT set to: {os.environ['FIREBASE_SERVICE_ACCOUNT']}")

# Import after setting the environment variable
from backup_service import start_automatic_backup

@app.route('/')
def index():
    return jsonify({"status": "ok", "message": "Backup service available"}), 200

def start_background_tasks():
    try:
        backup_thread = Thread(target=start_automatic_backup)
        backup_thread.daemon = True
        backup_thread.start()
    except Exception as e:
        print(f"[Flask] Failed to start backup thread: {e}")

if __name__ == "__main__":
    start_background_tasks()
    # Disable reloader to avoid environment variable issues in child process
    app.run(debug=True, host='127.0.0.1', port=5001, use_reloader=False)



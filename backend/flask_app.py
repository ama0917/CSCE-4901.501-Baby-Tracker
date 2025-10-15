from flask import Flask, jsonify, send_file, request
from threading import Thread
import os
from cryptography.fernet import Fernet
from backup_service import start_automatic_backup, restore_backup

app = Flask(__name__)

# 🔹 Absolute path to serviceAccountKey.json
SERVICE_ACCOUNT_PATH = r"C:\Users\cneno\Downloads\CSCE-4901.501-Baby-Tracker-main\CSCE-4901.501-Baby-Tracker-main\backend\serviceAccountKey.json"

# 🔹 Debug check: confirm Python can see the file
print("[Debug] Checking if service account file exists at path:")
print(SERVICE_ACCOUNT_PATH)
print("[Debug] Exists?", os.path.isfile(SERVICE_ACCOUNT_PATH))

# Set environment variable for Firebase service account
os.environ["FIREBASE_SERVICE_ACCOUNT"] = SERVICE_ACCOUNT_PATH
print(f"[Flask] FIREBASE_SERVICE_ACCOUNT set to: {os.environ['FIREBASE_SERVICE_ACCOUNT']}")

# 🔹 Load encryption key from environment variable
KEY = os.environ.get("BACKUP_KEY")
if not KEY:
    raise ValueError("Environment variable BACKUP_KEY not set!")
cipher = Fernet(KEY.encode())

# --- Routes ---

@app.route('/')
def index():
    return jsonify({"status": "ok", "message": "Backup service available"}), 200

# 🔹 Route to download the latest encrypted backup
@app.route('/download-backup', methods=['GET'])
def download_backup():
    backup_path = os.path.join("backend", "backup_data_encrypted.db")
    if not os.path.exists(backup_path):
        return jsonify({"success": False, "error": "No backup found"}), 404
    return send_file(backup_path, as_attachment=True)

# 🔹 Route to restore from the encrypted backup
@app.route('/restore-backup', methods=['POST'])
def restore_backup_route():
    try:
        data = request.get_json(silent=True)
        if not data or "user_id" not in data:
            # Allow fallback for testing if user_id not sent
            user_id = "default_user"
            print("[Warning] No user_id provided, using default_user")
        else:
            user_id = data["user_id"]

        print(f"[Flask] Restore backup requested for user_id: {user_id}")
        print(f"[Flask] Restore backup requested.")
        restore_backup(user_id)
        #print(f"[Flask] Backup restored successfully for user_id: {user_id}")
        print(f"[Flask] Backup restored successfully!")
        
        return jsonify({"success": True, "message": f"Backup restored for user {user_id}"})
    except Exception as e:
        # 🔹 Print full error to terminal for debugging
        print("[Error] Exception during restore-backup:", e, flush=True)
        return jsonify({"success": False, "error": str(e)}), 500

# --- Background Tasks ---

def start_background_tasks():
    try:
        backup_thread = Thread(target=start_automatic_backup)
        backup_thread.daemon = True
        backup_thread.start()
        print("[Flask] Automatic backup thread started")
    except Exception as e:
        print(f"[Flask] Failed to start backup thread: {e}")

# --- Run App ---

if __name__ == "__main__":
    start_background_tasks()
    # Use 0.0.0.0 if you want LAN access from phone, or 127.0.0.1 for localhost only
    app.run(debug=True, host='0.0.0.0', port=5001, use_reloader=False)



from flask import Flask, jsonify, send_file, request
from threading import Thread
import os
from cryptography.fernet import Fernet
from backup_service import start_automatic_backup

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
def restore_backup():
    try:
        backup_path = os.path.join("backend", "backup_data_encrypted.db")
        if not os.path.exists(backup_path):
            return jsonify({"success": False, "error": "No backup found"}), 404

        # Decrypt backup in memory
        with open(backup_path, "rb") as f:
            encrypted_data = f.read()
        decrypted_data = cipher.decrypt(encrypted_data)

        # Write temporarily for restoring
        temp_path = os.path.join("backend", "temp_restored.db")
        with open(temp_path, "wb") as f:
            f.write(decrypted_data)

        # 🔹 Call your existing Firebase restore logic here
        # from backup_service import restore_to_firebase
        # restore_to_firebase(temp_path)

        # Remove temporary unencrypted file
        os.remove(temp_path)

        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

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

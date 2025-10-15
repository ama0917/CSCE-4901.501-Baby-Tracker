import os
import json
import sqlite3
import time
from datetime import datetime
from threading import Thread
from cryptography.fernet import Fernet
import firebase_admin
from firebase_admin import credentials, firestore

# -------------------------------
# Load encryption key
# -------------------------------
KEY = os.environ.get("BACKUP_KEY")
if not KEY:
    raise ValueError("Environment variable BACKUP_KEY not set!")
cipher = Fernet(KEY.encode())
print(f"[Backup] Encryption key loaded successfully.")

# -------------------------------
# Setup backup folder and paths
# -------------------------------
backup_folder = os.path.join(os.path.dirname(__file__), "backups")
os.makedirs(backup_folder, exist_ok=True)
backup_json_path = os.path.join(backup_folder, "backup_data.json")
backup_db_path = os.path.join(backup_folder, "backup_data.db")
backup_db_encrypted_path = os.path.join(backup_folder, "backup_data_encrypted.db")
print(f"[Backup] Backup folder: {os.path.abspath(backup_folder)}")

# -------------------------------
# Initialize Firebase
# -------------------------------
db = None
try:
    service_account_env = os.getenv('FIREBASE_SERVICE_ACCOUNT')
    cred = None

    if service_account_env and os.path.isfile(service_account_env):
        cred = credentials.Certificate(service_account_env)
        print(f"[Firebase] Using service account from environment: {service_account_env}")
    else:
        default_sa = os.path.join(os.path.dirname(__file__), 'serviceAccountKey.json')
        if os.path.isfile(default_sa):
            cred = credentials.Certificate(default_sa)
            print(f"[Firebase] Using default service account: {default_sa}")
        else:
            raise FileNotFoundError("No valid Firebase service account file found.")

    if not firebase_admin._apps:
        firebase_admin.initialize_app(cred)
    db = firestore.client()
    print("[Firebase] Firestore client initialized successfully.")

except Exception as e:
    print(f"[Firebase] Error initializing Firestore: {e}")
    db = None

# -------------------------------
# Helper to convert Firestore types
# -------------------------------
def convert_firestore_types(obj):
    if isinstance(obj, dict):
        return {k: convert_firestore_types(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [convert_firestore_types(v) for v in obj]
    elif isinstance(obj, datetime):
        return obj.isoformat()
    else:
        return obj

# -------------------------------
# Backup function
# -------------------------------
def backup_data():
    print("[Backup] Starting backup...")
    if db is None:
        print("[Backup] No Firestore client; skipping backup.")
        return

    collections_to_backup = ["users", "children", "diaperLogs", "feedLogs", "sleepLogs"]
    backup = {"timestamp": datetime.utcnow().isoformat()}

    try:
        # Fetch all collections
        for collection_name in collections_to_backup:
            collection_ref = db.collection(collection_name)
            documents = collection_ref.stream()
            collection_data = {}
            for doc in documents:
                collection_data[doc.id] = convert_firestore_types(doc.to_dict())
            backup[collection_name] = collection_data

        # 🔹 Optional JSON backup (commented out for security)
        """
        with open(backup_json_path, "w", encoding="utf-8") as f:
            json.dump(backup, f, indent=4)
        print(f"[Backup] JSON backup saved at {backup_json_path}")
        """

        # Save SQLite backup
        conn = sqlite3.connect(backup_db_path)
        cursor = conn.cursor()

        for collection_name in collections_to_backup:
            cursor.execute(f'''
                CREATE TABLE IF NOT EXISTS "{collection_name}" (
                    id TEXT PRIMARY KEY,
                    data TEXT
                )
            ''')
            cursor.execute(f'DELETE FROM "{collection_name}"')
            for doc_id, doc_data in backup[collection_name].items():
                cursor.execute(f'INSERT INTO "{collection_name}" (id, data) VALUES (?, ?)',
                               (doc_id, json.dumps(doc_data)))

        conn.commit()
        conn.close()
        print(f"[Backup] SQLite backup created at {backup_db_path}")

        # Encrypt SQLite backup
        with open(backup_db_path, "rb") as f:
            db_bytes = f.read()
        encrypted_data = cipher.encrypt(db_bytes)
        with open(backup_db_encrypted_path, "wb") as f:
            f.write(encrypted_data)
        print(f"[Backup] Encrypted backup created at {backup_db_encrypted_path}")

        # Remove unencrypted SQLite file
        os.remove(backup_db_path)
        print(f"[Backup] Removed unencrypted SQLite file.")

    except Exception as e:
        print(f"[Backup] Error during backup: {e}")

# -------------------------------
# Restore function
# -------------------------------
def restore_backup(user_id):
    print(f"[Restore] Starting restore for user {user_id}...")
    if db is None:
        print("[Restore] No Firestore client; cannot restore data.")
        return

    if not os.path.isfile(backup_db_encrypted_path):
        print(f"[Restore] Encrypted backup not found at {backup_db_encrypted_path}")
        return

    try:
        # Decrypt backup
        with open(backup_db_encrypted_path, "rb") as f:
            encrypted_bytes = f.read()
        decrypted_bytes = cipher.decrypt(encrypted_bytes)

        # Temporarily write decrypted DB
        temp_db_path = backup_db_path
        with open(temp_db_path, "wb") as f:
            f.write(decrypted_bytes)

        # Connect and restore data
        conn = sqlite3.connect(temp_db_path)
        cursor = conn.cursor()

        # Restore children
        cursor.execute('SELECT id, data FROM "children"')
        children_rows = cursor.fetchall()
        user_children_ids = []

        for child_id, child_json in children_rows:
            child_data = json.loads(child_json)
            if child_data.get("userId") == user_id:
                user_children_ids.append(child_id)
                db.collection("children").document(child_id).set(child_data)
        print(f"[Restore] Restored {len(user_children_ids)} children for user {user_id}")

        # Restore logs
        log_collections = ["diaperLogs", "feedLogs", "sleepLogs"]
        for collection_name in log_collections:
            cursor.execute(f'SELECT id, data FROM "{collection_name}"')
            rows = cursor.fetchall()
            restored_count = 0
            for doc_id, doc_json in rows:
                doc_data = json.loads(doc_json)
                if doc_data.get("childId") in user_children_ids:
                    db.collection(collection_name).document(doc_id).set(doc_data)
                    restored_count += 1
            print(f"[Restore] Restored {restored_count} documents in {collection_name}")

        conn.close()
        os.remove(temp_db_path)
        print("[Restore] Temporary decrypted file removed. Restore completed.")

    except Exception as e:
        print(f"[Restore] Error during restore: {e}")

# -------------------------------
# Automatic backup scheduler
# -------------------------------
def start_automatic_backup(interval_seconds=3600):
    def run():
        while True:
            print("[Backup Scheduler] Running scheduled backup...")
            backup_data()
            print(f"[Backup Scheduler] Next backup in {interval_seconds} seconds.")
            time.sleep(interval_seconds)

    t = Thread(target=run, daemon=True)
    t.start()
    print("[Backup Scheduler] Backup thread started.")

# -------------------------------
# If run as main, perform one-time backup
# -------------------------------
if __name__ == "__main__":
    backup_data()

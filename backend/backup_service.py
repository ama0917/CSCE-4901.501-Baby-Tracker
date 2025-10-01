import os
import json
import firebase_admin
from firebase_admin import credentials, firestore
from datetime import datetime
import sqlite3
import time
from cryptography.fernet import Fernet

# 🔹 Load encryption key from environment variable
KEY = os.environ.get("BACKUP_KEY")
if not KEY:
    raise ValueError("Environment variable BACKUP_KEY not set!")
cipher = Fernet(KEY.encode())

# Setup backup folder path
backup_folder = "backups"
if not os.path.exists(backup_folder):
    os.makedirs(backup_folder)

# Paths for backup files
backup_json_path = os.path.join(backup_folder, "backup_data.json")
backup_db_path = os.path.join(backup_folder, "backup_data.db")
backup_db_encrypted_path = os.path.join(backup_folder, "backup_data_encrypted.db")

# 🔹 Initialize Firebase Admin SDK safely
db = None
try:
    service_account_env = os.getenv('FIREBASE_SERVICE_ACCOUNT')
    cred = None

    if service_account_env:
        print(f"[Firebase] Using service account from environment: {service_account_env}")
        if os.path.isfile(service_account_env):
            cred = credentials.Certificate(service_account_env)
        else:
            raise FileNotFoundError(f"Service account file not found at {service_account_env}")

    if not cred:
        default_sa = os.path.join(os.path.dirname(__file__), 'serviceAccountKey.json')
        print(f"[Firebase] Falling back to default service account path: {default_sa}")
        if os.path.isfile(default_sa):
            cred = credentials.Certificate(default_sa)
        else:
            raise FileNotFoundError(f"Service account file not found at {default_sa}")

    if not firebase_admin._apps:
        firebase_admin.initialize_app(cred)
        db = firestore.client()
        print("[Firebase] Successfully initialized Firestore client.")
    else:
        db = firestore.client()
        print("[Firebase] Firebase already initialized, using existing app.")

except Exception as e:
    print(f"[Firebase] Error initializing Firebase Admin SDK: {e}")
    db = None


def convert_firestore_types(obj):
    """Recursively convert Firestore-specific types to JSON-serializable."""
    if isinstance(obj, dict):
        return {k: convert_firestore_types(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [convert_firestore_types(v) for v in obj]
    elif isinstance(obj, datetime):
        return obj.isoformat()
    else:
        return obj


def backup_data():
    try:
        if db is None:
            print('[Backup] No Firestore client available; skipping Firestore backup.')
            return

        collections_to_backup = ["users", "children", "diaperLogs", "feedLogs", "sleepLogs"]

        backup = {"timestamp": datetime.utcnow().isoformat()}

        for collection_name in collections_to_backup:
            collection_ref = db.collection(collection_name)
            documents = collection_ref.stream()

            collection_data = {}
            for doc in documents:
                doc_data = convert_firestore_types(doc.to_dict())
                collection_data[doc.id] = doc_data

            backup[collection_name] = collection_data

        # 🔹 Save backup to JSON (currently disabled)
        """
        with open(backup_json_path, "w", encoding="utf-8") as json_file:
            json.dump(backup, json_file, indent=4, ensure_ascii=False)
        """

        # Save backup to SQLite database
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
                cursor.execute(
                    f'INSERT INTO "{collection_name}" (id, data) VALUES (?, ?)',
                    (doc_id, json.dumps(doc_data))
                )

        conn.commit()
        conn.close()
        print(f"[Backup] SQLite backup created at {backup_db_path}")
        # print(f"[Backup] JSON backup created at {backup_json_path}")  # Commented out

        # 🔹 Encrypt SQLite backup
        with open(backup_db_path, "rb") as f:
            db_data = f.read()
        encrypted_db_data = cipher.encrypt(db_data)
        with open(backup_db_encrypted_path, "wb") as f:
            f.write(encrypted_db_data)

        # Remove unencrypted SQLite file
        os.remove(backup_db_path)
        print(f"[Backup] Encrypted SQLite backup created at {backup_db_encrypted_path}")

    except Exception as e:
        print(f"[Backup] Error during backup: {e}")


def start_automatic_backup():
    while True:
        print("[Backup Scheduler] Starting automatic backup...")
        backup_data()
        print("[Backup Scheduler] Backup complete. Next backup in 1 hour.")
        time.sleep(3600)


if __name__ == "__main__":
    backup_data()


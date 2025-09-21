import os
import json
import firebase_admin
from firebase_admin import credentials, firestore
from datetime import datetime
import sqlite3
import time

# Setup backup folder path
backup_folder = "backups"
if not os.path.exists(backup_folder):
    os.makedirs(backup_folder)

# Paths for backup files
backup_json_path = os.path.join(backup_folder, "backup_data.json")
backup_db_path = os.path.join(backup_folder, "backup_data.db")

# Initialize Firebase Admin SDK (robustly)
db = None
try:
    service_account_env = os.getenv('FIREBASE_SERVICE_ACCOUNT')
    cred = None

    # Try environment variable first. It may be a path or a JSON string.
    if service_account_env:
        # If it points to an existing file path, use it
        if os.path.isfile(service_account_env):
            cred = credentials.Certificate(service_account_env)
        else:
            # If it looks like JSON, try parsing it
            try:
                sa_dict = json.loads(service_account_env)
                cred = credentials.Certificate(sa_dict)
            except Exception:
                # Not a JSON string; fall through to try default file below
                cred = None

    # If no valid env var credential, try the local service account file
    if not cred:
        default_sa = os.path.join(os.path.dirname(__file__), 'firebase-service-account.json')
        if os.path.isfile(default_sa):
            cred = credentials.Certificate(default_sa)

    if not cred:
        raise ValueError('No valid Firebase service account found (FIREBASE_SERVICE_ACCOUNT unset or invalid, and firebase-service-account.json not present)')

    firebase_admin.initialize_app(cred)
    db = firestore.client()
    print('[Firebase] Successfully initialized Firestore client.')
except Exception as e:
    # Don't crash the whole process — log and allow the app to run without backup functionality.
    print(f"[Firebase] Error initializing Firebase Admin SDK: {e}")
    db = None

def backup_data():
    try:
        if db is None:
            print('[Backup] No Firestore client available; skipping Firestore backup.')
            return
        #  data to backup
        collections_to_backup = ["users", "children", "diaperLogs", "feedLogs", "sleepLogs"]

        backup = {"timestamp": datetime.utcnow().isoformat()}

        for collection_name in collections_to_backup:
            collection_ref = db.collection(collection_name)
            documents = collection_ref.stream()

            collection_data = {}
            for doc in documents:
                doc_data = doc.to_dict()

                def convert_firestore_types(obj): # convert time to iso format
                    if isinstance(obj, dict):
                        return {k: convert_firestore_types(v) for k, v in obj.items()}
                    elif isinstance(obj, list):
                        return [convert_firestore_types(v) for v in obj]
                    elif isinstance(obj, datetime):
                        return obj.isoformat()
                    else:
                        return obj

                collection_data[doc.id] = convert_firestore_types(doc_data)

            backup[collection_name] = collection_data

        # Save backup to JSON
        with open(backup_json_path, "w") as json_file:
            json.dump(backup, json_file, indent=4)

        # Save backup to SQLite database
        conn = sqlite3.connect(backup_db_path)
        cursor = conn.cursor()

        for collection_name in collections_to_backup:
            # Create a table for each collection
            cursor.execute(f'''
                CREATE TABLE IF NOT EXISTS {collection_name} (
                    id TEXT PRIMARY KEY,
                    data TEXT
                )
            ''')
            # Clear existing table data
            cursor.execute(f'DELETE FROM {collection_name}')

            # Insert documents into the table
            for doc_id, doc_data in backup[collection_name].items():
                cursor.execute(
                    f'INSERT INTO {collection_name} (id, data) VALUES (?, ?)',
                    (doc_id, json.dumps(doc_data))
                )

        conn.commit()
        conn.close()
        print(f"[Backup] SQLite backup created at {backup_db_path}")

    except Exception as e:
        print(f"[Backup] Error during backup: {e}")

def start_automatic_backup():
    while True:
        print("[Backup Scheduler] Starting automatic backup...")
        backup_data()
        print("[Backup Scheduler] Backup complete. Next backup in 1 hour.")
        time.sleep(3600)    # backup database every hour
        #time.sleep(60)     # 1-minute backups for testing

if __name__ == "__main__":
    backup_data()

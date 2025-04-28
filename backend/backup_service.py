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

# Initialize Firebase Admin SDK
try:
    cred = credentials.Certificate(os.getenv('FIREBASE_SERVICE_ACCOUNT'))
    firebase_admin.initialize_app(cred)
    print("[Firebase] Successfully initialized Firestore client.")
except Exception as e:
    print(f"[Firebase] Error initializing Firebase Admin SDK: {e}")
    raise

# Firestore client
db = firestore.client()

def backup_data():
    try:
        # Collections you want to back up
        collections_to_backup = ["users", "children", "diaperLogs", "feedLogs", "sleepLogs"]

        backup = {"timestamp": datetime.utcnow().isoformat()}

        for collection_name in collections_to_backup:
            collection_ref = db.collection(collection_name)
            documents = collection_ref.stream()

            collection_data = {}
            for doc in documents:
                collection_data[doc.id] = doc.to_dict()

            backup[collection_name] = collection_data

        # Save backup to JSON
        def convert_firestore_types(obj):
            if isinstance(obj, datetime):
                return obj.isoformat()
            return obj

        with open(backup_json_path, "w") as json_file:
            json.dump(backup, json_file, indent=4, default=convert_firestore_types)

       

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
        # time.sleep(3600)  # Uncomment for 1-hour real backups
        time.sleep(60)     # 1-minute backups for testing

if __name__ == "__main__": # Run backup immediately (optional)
    backup_data()




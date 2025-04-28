import os
import json
import time
import sqlite3
import firebase_admin
from firebase_admin import credentials, firestore
from datetime import datetime



backup_folder = os.path.join(os.getcwd(), "backups")  # path setup to create backups folder if not already there
backup_json_path = os.path.join(backup_folder, "backup_data.json")
backup_sqlite_path = os.path.join(backup_folder, "backup_data.db")



if not os.path.exists(backup_folder): # Ensure the backups folder exists
    os.makedirs(backup_folder)
    print(f"[Setup] Created backup folder at {backup_folder}")


SERVICE_ACCOUNT_FILE = os.getenv('FIREBASE_SERVICE_ACCOUNT') # Initialize Firebase Admin SDK
if not SERVICE_ACCOUNT_FILE:
    raise ValueError("FIREBASE_SERVICE_ACCOUNT environment variable not set!")

try:
    cred = credentials.Certificate(SERVICE_ACCOUNT_FILE)
    firebase_admin.initialize_app(cred)
    db = firestore.client()
    print("[Firebase] Successfully initialized Firestore client.")
except Exception as e:
    print(f"[Firebase] Error initializing Firebase Admin SDK: {e}")
    raise

def backup_data():
    try:
        print(f"[Backup] Starting backup at {datetime.now()}...")
 
        users_ref = db.collection('users') # Fetch data from Firestore
        babies_ref = db.collection('babies')

        users_data = {doc.id: doc.to_dict() for doc in users_ref.stream()}
        babies_data = {doc.id: doc.to_dict() for doc in babies_ref.stream()}

        backup = {
            "timestamp": datetime.utcnow().isoformat(),
            "users": users_data,
            "babies": babies_data
        }

        
        with open(backup_json_path, "w") as json_file: # Save backup database to JSON file
            json.dump(backup, json_file, indent=4)

        print(f"[Backup] Data successfully backed up to {backup_json_path}")

        
        conn = sqlite3.connect(backup_sqlite_path) # Save to SQLite database
        cursor = conn.cursor()

        # Create tables if they don't exist
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                data TEXT
            )
        ''')

        cursor.execute('''
            CREATE TABLE IF NOT EXISTS babies (
                id TEXT PRIMARY KEY,
                data TEXT
            )
        ''')

        
        cursor.execute('DELETE FROM users') # Clear existing data to avoid duplicates
        cursor.execute('DELETE FROM babies')

        
        for user_id, user_data in users_data.items(): # Insert example user data
            cursor.execute('INSERT INTO users (id, data) VALUES (?, ?)', (user_id, json.dumps(user_data)))

        
        for baby_id, baby_data in babies_data.items(): # Insert example baby data
            cursor.execute('INSERT INTO babies (id, data) VALUES (?, ?)', (baby_id, json.dumps(baby_data)))

        conn.commit()
        conn.close()

        print(f"[Backup] Data successfully backed up to {backup_sqlite_path}")
        print(f"[Backup] Backup completed at {datetime.now()}.")

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




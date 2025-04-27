import os
import json
import firebase_admin
from firebase_admin import credentials, firestore
import time
import datetime
from google.auth.exceptions import RefreshError


SERVICE_ACCOUNT_FILE = os.getenv('FIREBASE_SERVICE_ACCOUNT') # firebase private key going through this environment variable

if not SERVICE_ACCOUNT_FILE:
    raise ValueError("FIREBASE_SERVICE_ACCOUNT environment variable not set!")

# Initialize Firebase Admin SDK
try:
    cred = credentials.Certificate(SERVICE_ACCOUNT_FILE)
    firebase_admin.initialize_app(cred)
    db = firestore.client()
    print("[Firebase] Successfully initialized Firestore client.")
except Exception as e:
    print(f"[Firebase] Error initializing Firebase Admin SDK: {e}")
    raise

def backup_firebase_database():
    try:
        print(f"[Backup] Starting backup at {datetime.datetime.now()}...")

        
        collections = db.collections() # placeholder code, will be replaced.
        for collection in collections:
            docs = collection.stream()
            for doc in docs:
                print(f"Document {doc.id}: {doc.to_dict()}")
        
        
        print(f"[Backup] Backup completed at {datetime.datetime.now()}.") # supposed to write data to a local file

    except Exception as e:
        print(f"[Backup] Error during backup: {e}")

def start_automatic_backup():
    while True:
        print("[Backup Scheduler] Starting automatic backup...")
        backup_firebase_database()
        print("[Backup Scheduler] Backup complete. Next backup in 1 hour.")
        #time.sleep(3600)  # Sleep for 1 hour
        time.sleep(60) # sleep for 1 minute for testing.



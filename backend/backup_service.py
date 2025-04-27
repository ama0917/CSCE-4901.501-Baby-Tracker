import os
import datetime
import threading
import time
import schedule
import firebase_admin
from firebase_admin import credentials, storage

# Initialize Firebase (only once)
if not firebase_admin._apps:
    cred = credentials.Certificate('backend/firebase-service-account.json')
    firebase_admin.initialize_app(cred, {
        'storageBucket': 'babytracker-ab1ed.appspot.com'  # Corrected your storage bucket
    })

LOCAL_BACKUP_FOLDER = 'backend/backups'  # creates backup folder

def create_local_backup(file_data: bytes, filename: str) -> str:
    """Saves the backup file locally and returns the local file path."""
    os.makedirs(LOCAL_BACKUP_FOLDER, exist_ok=True)  # Ensure backups folder exists
    file_path = os.path.join(LOCAL_BACKUP_FOLDER, filename)
    with open(file_path, 'wb') as f:
        f.write(file_data)
    print(f"[Local Backup] Backup saved locally at {file_path}")
    return file_path

def upload_backup_to_firebase(file_path: str, user_id: str):
    """Uploads the backup file to Firebase Storage under user's folder."""
    bucket = storage.bucket()
    filename = os.path.basename(file_path)
    blob = bucket.blob(f'backups/{user_id}/{filename}')
    blob.upload_from_filename(file_path)
    print(f"[Firebase Upload] Backup uploaded to Firebase Storage at backups/{user_id}/{filename}")

def backup_user_data(file_data: bytes, user_id: str):
    """Creates both local and Firebase backups."""
    timestamp = datetime.datetime.now().strftime('%Y%m%d-%H%M%S')
    filename = f'backup-{timestamp}.db'
    local_file_path = create_local_backup(file_data, filename)
    upload_backup_to_firebase(local_file_path, user_id)
    print(f"[Backup Complete] Local + Firebase backup done for user: {user_id}")

def automatic_hourly_backup():
    test_data = b"This is an automatic hourly backup"
    test_user_id = "automatic_user"
    backup_user_data(test_data, test_user_id)

def start_backup_scheduler():
    schedule.every(1).hours.do(automatic_hourly_backup)
    while True:
        schedule.run_pending()
        time.sleep(60)  # Wait for 1 minute
        #time.sleep(3600)  # Wait for 1 hour

def trigger_backup():
    """Manually triggers a backup."""
    test_data = b"Manual trigger backup"
    test_user_id = "manual_trigger_user"
    backup_user_data(test_data, test_user_id)

# Start the scheduler in a background thread
scheduler_thread = threading.Thread(target=start_backup_scheduler)
scheduler_thread.daemon = True
scheduler_thread.start()

if __name__ == "__main__":
    # Manual test backup system
    test_data = b"Manual test backup"
    test_user_id = "manual_test_user"
    backup_user_data(test_data, test_user_id)


import os
import datetime
import firebase_admin
from firebase_admin import credentials, storage

# Initialize Firebase (only once)
if not firebase_admin._apps:
    cred = credentials.Certificate('backend/firebase-service-account.json')
    firebase_admin.initialize_app(cred, {
        'storageBucket': 'babytracker-ab1ed.firebasestorage.app'
    })


LOCAL_BACKUP_FOLDER = 'backend/backups' # creates backup folder

def create_local_backup(file_data: bytes, filename: str) -> str:
    """Saves the backup file locally and returns the local file path."""
    
    os.makedirs(LOCAL_BACKUP_FOLDER, exist_ok=True) # Ensure backups folder exists

    
    file_path = os.path.join(LOCAL_BACKUP_FOLDER, filename) # Full path

    
    with open(file_path, 'wb') as f: # Save file
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
    
    timestamp = datetime.datetime.now().strftime('%Y%m%d-%H%M%S') # Generate filename based on timestamp
    filename = f'backup-{timestamp}.db'  

    
    local_file_path = create_local_backup(file_data, filename) # Save locally

    
    upload_backup_to_firebase(local_file_path, user_id) # Upload to Firebase

    print(f"[Backup Complete] Local + Firebase backup done for user: {user_id}")


if __name__ == "__main__":
    # Testing manually
    test_data = b"This is test backup data"
    test_user_id = "testuser123"

    backup_user_data(test_data, test_user_id)

import os
import datetime
import threading
import time
import schedule

LOCAL_BACKUP_FOLDER = 'backend/backups'  # Creates backup folder

def create_local_backup(file_data: bytes, filename: str) -> str:
    """Saves the backup file locally and returns the local file path."""
    os.makedirs(LOCAL_BACKUP_FOLDER, exist_ok=True)  # Ensure backups folder exists
    file_path = os.path.join(LOCAL_BACKUP_FOLDER, filename)
    with open(file_path, 'wb') as f:
        f.write(file_data)
    print(f"[Local Backup] Backup saved locally at {file_path}")
    return file_path

def backup_user_data(file_data: bytes, user_id: str):
    """Creates only local backups (no Firebase)."""
    timestamp = datetime.datetime.now().strftime('%Y%m%d-%H%M%S')
    filename = f'backup-{timestamp}.db'
    local_file_path = create_local_backup(file_data, filename)
    print(f"[Backup Complete] Local backup done for user: {user_id}")

def automatic_hourly_backup():
    test_data = b"This is an automatic hourly backup"
    test_user_id = "automatic_user"
    backup_user_data(test_data, test_user_id)

def start_backup_scheduler():
    schedule.every(1).hours.do(automatic_hourly_backup)
    while True:
        schedule.run_pending()
        time.sleep(60)  # Wait for 1 minute
        #time.sleep(3600) # wait for 1 hour

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


from flask import Flask
from backup_service import start_automatic_backup

app = Flask(__name__)

if __name__ == "__main__":
    # Start the automatic backup in the background
    from threading import Thread
    backup_thread = Thread(target=start_automatic_backup)
    backup_thread.daemon = True
    backup_thread.start()

    app.run(debug=True)

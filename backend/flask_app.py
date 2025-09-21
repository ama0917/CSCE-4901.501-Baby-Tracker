from flask import Flask, jsonify
from backup_service import start_automatic_backup
from threading import Thread

app = Flask(__name__)


@app.route('/')
def index():
    return jsonify({"status": "ok", "message": "Backup service available"}), 200


def start_background_tasks():
    # Start the automatic backup in the background when the server starts serving requests
    try:
        backup_thread = Thread(target=start_automatic_backup)
        backup_thread.daemon = True
        backup_thread.start()
    except Exception as e:
        print(f"[Flask] Failed to start backup thread: {e}")


if __name__ == "__main__":
    # When run directly, also start the backup thread and run the app
    # Start background tasks only in the reloader's main process to avoid duplication
    if os.environ.get('WERKZEUG_RUN_MAIN') == 'true' or not os.environ.get('WERKZEUG_RUN_MAIN'):
        start_background_tasks()

    app.run(debug=True, host='127.0.0.1', port=5001)

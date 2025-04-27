import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from flask import Flask, request
import firebase_admin
from firebase_admin import credentials, auth
from backend.backup_service import backup_user_data, trigger_backup  # 'trigger_backup' is the manual backup function

app = Flask(__name__)


@app.route('/trigger_backup', methods=['GET']) # path for manual backup 
def trigger_backup_route():
    try:
        trigger_backup()  # Call the backup function here
        return "Backup triggered successfully!", 200
    except Exception as e:
        return str(e), 500


@app.route('/backup', methods=['POST']) # Route for backup via user request
def backup_route():
   
    id_token = request.headers.get('Authorization')  # Firebase ID token from Authorization header

    if not id_token:
        return {'error': 'Missing Authorization Token'}, 401

    try:
        decoded_token = auth.verify_id_token(id_token)
        user_id = decoded_token['uid']  # Extract user ID securely
    except Exception as e:
        print(e)
        return {'error': 'Invalid token'}, 401

    
    file_data = request.data # Receive backup file data

    backup_user_data(file_data, user_id)

    return {'status': 'Backup completed successfully!'}

if __name__ == "__main__":
    app.run(debug=True)


import firebase_admin
from firebase_admin import credentials, firestore
import os
from dotenv import load_dotenv

load_dotenv()

# Path to Firebase credentials
cred_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
cred = credentials.Certificate(cred_path)
firebase_admin.initialize_app(cred)

# Firestore client
db = firestore.client()

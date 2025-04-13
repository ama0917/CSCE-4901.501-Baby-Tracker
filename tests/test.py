from firebase_admin import credentials, initialize_app

cred = credentials.Certificate("firebase-service-account.json")
initialize_app(cred)

print("Firebase initialized successfully!")

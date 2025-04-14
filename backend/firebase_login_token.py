import pyrebase

firebase_config = {
    "apiKey": "AIzaSyBMq6GqUrmSro2knerMeUdtJMMrdt6MGu8",
    "authDomain": "csce-4901-testdatabase.firebaseapp.com",
    "projectId": "csce-4901-testdatabase",
    "storageBucket": "csce-4901-testdatabase.appspot.com",
    "messagingSenderId": "your-sender-id",      
    "appId": "your-app-id",                       
    "databaseURL": ""                             # Not needed for Firestore

}

firebase = pyrebase.initialize_app(firebase_config)
auth = firebase.auth()

email = "testuser@example.com"
password = "password123"

user = auth.sign_in_with_email_and_password(email, password)
id_token = user['idToken']

print("Firebase ID Token:")
print(id_token)

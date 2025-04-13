import firebase_admin
from firebase_admin import credentials, auth

cred = credentials.Certificate("backend/firebase-service-account.json")
firebase_admin.initialize_app(cred)

# Replace this with the email of an existing user in Firebase Auth
email = "testuser@example.com"

try:
    user = auth.get_user_by_email(email)
    print("User found:", user.uid)
except:
    # If user doesn't exist, create one
    user = auth.create_user(email=email, password="password123")
    print("User created:", user.uid)

# Generate a custom token
token = auth.create_custom_token(user.uid)
print("\n Custom Token:")
print(token.decode("utf-8"))

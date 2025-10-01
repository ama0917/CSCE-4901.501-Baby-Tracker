"""
Simple test script to verify Firebase Admin credentials and do a small Firestore read.

Usage:
  # using venv where firebase-admin is installed
  . .venv_test/bin/activate
  python3 backend/test_firestore.py

It will try, in order:
 - FIREBASE_SERVICE_ACCOUNT env var as a file path
 - backend/serviceAccountKey.json (fallback file)

It prints a short success/failure message and will not print full secrets.
"""
import os
import sys
import firebase_admin
from firebase_admin import credentials, firestore


def load_credentials():
    service_account_env = os.getenv('FIREBASE_SERVICE_ACCOUNT')

    if service_account_env and os.path.isfile(service_account_env):
        return credentials.Certificate(service_account_env)

    # fallback to bundled file
    fallback = os.path.join(os.path.dirname(__file__), 'serviceAccountKey.json')
    if os.path.isfile(fallback):
        return credentials.Certificate(fallback)

    return None


def main():
    cred = load_credentials()
    if not cred:
        print('[test_firestore] No credentials found. Set FIREBASE_SERVICE_ACCOUNT or provide serviceAccountKey.json')
        sys.exit(2)

    try:
        # initialize a temporary app so we don't interfere with other code
        app = firebase_admin.initialize_app(cred, name='test-app')
        db = firestore.client(app=app)

        # Try a simple read: list up to 1 user document, or fallback to listing collections
        try:
            users_ref = db.collection('users').limit(1).stream()
            docs = list(users_ref)
            print(f'[test_firestore] Successfully read from Firestore; found {len(docs)} document(s) in "users" collection.')
        except Exception:
            cols = list(db.collections())
            print(f'[test_firestore] Could not read "users" (may be absent). Found {len(cols)} top-level collection(s).')

    except Exception as e:
        print(f'[test_firestore] Firebase initialization failed: {e}')
        sys.exit(1)
    finally:
        # cleanup app
        try:
            firebase_admin.delete_app(firebase_admin.get_app('test-app'))
        except Exception:
            pass


if __name__ == '__main__':
    main()

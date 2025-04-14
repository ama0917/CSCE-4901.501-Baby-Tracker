from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.responses import FileResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
from firebase_admin import credentials, firestore, initialize_app
from backend.auth import get_current_user
from backend.models import Child, ActivityLog
from backend.database import db
import pandas as pd
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter
from tempfile import NamedTemporaryFile
import datetime
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()


# FastAPI app and security
app = FastAPI(
    title="Child Activity Tracker API",
    description="API for tracking child activities and generating reports",
    version="1.0.0",
    openapi_tags=[
        {"name": "profile", "description": "User profile operations"},
    ]
)

security = HTTPBearer()

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Replace "*" with specific origins in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# User profile endpoint
@app.get("/profile")
async def get_profile(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    current_user=Depends(get_current_user)
):
    return {
        "uid": current_user["uid"],
        "email": current_user["email"],
        "role": current_user.get("role", "parent")
    }

# Child tracking endpoints
@app.post("/children/", status_code=status.HTTP_201_CREATED)
async def add_child(
    child: Child,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    current_user=Depends(get_current_user)
):
    """
    Endpoint to add a new child to the current user's account.
    Ensures the user document exists in Firestore before adding the child.
    """
    try:
        # Ensure the user document exists in Firestore
        db.collection("users").document(current_user["uid"]).set({
            "email": current_user["email"],
            "created": firestore.SERVER_TIMESTAMP
        }, merge=True)

        # Convert the child data to a dictionary and format the date of birth
        child_data = child.dict()
        child_data["dob"] = child_data["dob"].isoformat()  # Convert date to ISO format string

        # Add the child to the Firestore database under the current user's collection
        doc_ref = db.collection("users").document(current_user["uid"]).collection("children").document() 
        doc_ref.set(child_data)

        # Return a success message along with the generated child ID
        return {"message": "Child added successfully", "child_id": doc_ref.id}
    except Exception as e:
        # Raise an HTTP exception if an error occurs
        raise HTTPException(status_code=500, detail=f"Failed to add child: {e}")

@app.get("/children/", status_code=status.HTTP_200_OK)
async def get_children(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    current_user=Depends(get_current_user)
):
    try:
        children_ref = db.collection("users").document(current_user["uid"]).collection("children")
        children = [doc.to_dict() | {"id": doc.id} for doc in children_ref.stream()]
        return {"children": children}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to retrieve children: {str(e)}")

# Activity logging endpoints
@app.post("/log/")
async def log_activity(
    log: ActivityLog,
    child_id: str,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    current_user=Depends(get_current_user)
):
    log_ref = db.collection("users").document(current_user["uid"])\
        .collection("children").document(child_id).collection("logs")
    log_ref.add(log.dict())
    return {"message": "Activity logged"}

@app.get("/logs/")
async def get_logs(
    child_id: str,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    current_user=Depends(get_current_user)
):
    logs_ref = db.collection("users").document(current_user["uid"])\
        .collection("children").document(child_id).collection("logs")
    logs = [doc.to_dict() | {"id": doc.id} for doc in logs_ref.stream()]
    return logs

# Report export endpoints
@app.get("/report/excel")
async def generate_excel_report(
    child_id: str,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    current_user=Depends(get_current_user)
):
    logs_ref = db.collection("users").document(current_user["uid"])\
        .collection("children").document(child_id).collection("logs")
    logs = [doc.to_dict() for doc in logs_ref.stream()]
    
    if not logs:
        return {"message": "No logs found"}
    
    df = pd.DataFrame(logs)
    
    # Handle missing or invalid timestamps
    if "timestamp" in df.columns:
        df["timestamp"] = pd.to_datetime(df["timestamp"], errors='coerce')
        if df["timestamp"].isnull().any():
            return {"message": "Some logs have invalid timestamps"}
    else:
        return {"message": "Missing timestamp in logs"}
    
    with NamedTemporaryFile(delete=False, suffix=".xlsx") as tmp:
        df.to_excel(tmp.name, index=False)
        return FileResponse(tmp.name, filename="report.xlsx", media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")

@app.get("/report/pdf")
async def generate_pdf_report(
    child_id: str,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    current_user=Depends(get_current_user)
):
    logs_ref = db.collection("users").document(current_user["uid"])\
        .collection("children").document(child_id).collection("logs")
    logs = [doc.to_dict() for doc in logs_ref.stream()]
    
    if not logs:
        return {"message": "No logs found for this child"}
    
    df = pd.DataFrame(logs)
    
    # Handle missing or invalid timestamps
    if "timestamp" in df.columns:
        df["timestamp"] = pd.to_datetime(df["timestamp"], errors='coerce')
        if df["timestamp"].isnull().any():
            return {"message": "Some logs have invalid timestamps"}
    else:
        return {"message": "Missing timestamp in logs"}
    
    logs = df.sort_values(by="timestamp").to_dict(orient="records")
    
    with NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
        c = canvas.Canvas(tmp.name, pagesize=letter)
        width, height = letter
        c.setFont("Helvetica-Bold", 16)
        c.drawString(72, height - 72, f"Activity Report for Child ID: {child_id}")
        c.setFont("Helvetica", 12)
        y = height - 100
        for log in logs:
            text = f"{log.get('timestamp', '')} – {log.get('type', '').capitalize()}"
            c.drawString(72, y, text)
            y -= 20
            if y < 72:
                c.showPage()
                y = height - 72
        c.save()
    return FileResponse(tmp.name, filename="child_report.pdf", media_type="application/pdf")

@app.get("/report/json")
async def generate_json_report(
    child_id: str,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    current_user=Depends(get_current_user)
):
    logs_ref = db.collection("users").document(current_user["uid"])\
        .collection("children").document(child_id).collection("logs")
    logs = [doc.to_dict() | {"id": doc.id} for doc in logs_ref.stream()]
    return {"child_id": child_id, "log_count": len(logs), "logs": logs}

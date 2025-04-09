from fastapi import FastAPI, Depends
from auth import get_current_user
from models import Child, ActivityLog
from database import db
import datetime

app = FastAPI()

@app.get("/profile")
def get_profile(current_user=Depends(get_current_user)):
    return {"uid": current_user["uid"], "email": current_user["email"], "role": current_user.get("role", "parent")}

@app.post("/children/")
def add_child(child: Child, current_user=Depends(get_current_user)):
    children_ref = db.collection("users").document(current_user["uid"]).collection("children")
    new_doc = children_ref.document()
    new_doc.set(child.dict())
    return {"message": "Child added", "child_id": new_doc.id}

@app.get("/children/")
def get_children(current_user=Depends(get_current_user)):
    children_ref = db.collection("users").document(current_user["uid"]).collection("children")
    children = [doc.to_dict() | {"id": doc.id} for doc in children_ref.stream()]
    return children

@app.post("/log/")
def log_activity(log: ActivityLog, child_id: str, current_user=Depends(get_current_user)):
    log_ref = db.collection("users").document(current_user["uid"]).collection("children").document(child_id).collection("logs")
    log_ref.add(log.dict())
    return {"message": "Activity logged"}

@app.get("/logs/")
def get_logs(child_id: str, current_user=Depends(get_current_user)):
    logs_ref = db.collection("users").document(current_user["uid"]).collection("children").document(child_id).collection("logs")
    logs = [doc.to_dict() | {"id": doc.id} for doc in logs_ref.stream()]
    return logs

from pydantic import BaseModel
from typing import Optional
import datetime

class User(BaseModel):
    email: str
    role: str = "parent"

class Child(BaseModel):
    name: str
    dob: datetime.date

class ActivityLog(BaseModel):
    type: str  # feeding, sleep, diaper
    timestamp: Optional[datetime.datetime] = datetime.datetime.utcnow()
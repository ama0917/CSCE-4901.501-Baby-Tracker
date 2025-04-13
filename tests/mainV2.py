# from fastapi import FastAPI, Depends, HTTPException
# from fastapi.responses import FileResponse
# from firebase_admin import firestore
# from auth import get_current_user, role_required
# import pandas as pd
# from reportlab.pdfgen import canvas
# from reportlab.lib.pagesizes import letter
# from tempfile import NamedTemporaryFile

# app = FastAPI()
# db = firestore.client()

# @app.get("/report/excel")
# def generate_excel_report(child_id: str, current_user=Depends(get_current_user)):
#     logs_ref = db.collection("users").document(current_user["uid"])        .collection("children").document(child_id).collection("logs")
#     logs = [doc.to_dict() for doc in logs_ref.stream()]

#     if not logs:
#         return {"message": "No logs found"}

#     df = pd.DataFrame(logs)
#     df["timestamp"] = pd.to_datetime(df["timestamp"])

#     with NamedTemporaryFile(delete=False, suffix=".xlsx") as tmp:
#         df.to_excel(tmp.name, index=False)
#         return FileResponse(tmp.name, filename="report.xlsx", media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")

# @app.get("/report/pdf")
# def generate_pdf_report(child_id: str, current_user=Depends(get_current_user)):
#     logs_ref = db.collection("users").document(current_user["uid"])        .collection("children").document(child_id).collection("logs")
#     logs = [doc.to_dict() for doc in logs_ref.stream()]

#     if not logs:
#         return {"message": "No logs found for this child"}

#     logs.sort(key=lambda x: x["timestamp"])

#     with NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
#         c = canvas.Canvas(tmp.name, pagesize=letter)
#         width, height = letter

#         c.setFont("Helvetica-Bold", 16)
#         c.drawString(72, height - 72, f"Activity Report for Child ID: {child_id}")

#         c.setFont("Helvetica", 12)
#         y = height - 100
#         for log in logs:
#             text = f"{log.get('timestamp', '')} – {log.get('type', '').capitalize()}"
#             c.drawString(72, y, text)
#             y -= 20
#             if y < 72:
#                 c.showPage()
#                 y = height - 72

#         c.save()

#     return FileResponse(tmp.name, filename="child_report.pdf", media_type="application/pdf")

# @app.get("/report/json")
# def generate_json_report(child_id: str, current_user=Depends(get_current_user)):
#     logs_ref = db.collection("users").document(current_user["uid"])        .collection("children").document(child_id).collection("logs")
#     logs = [doc.to_dict() | {"id": doc.id} for doc in logs_ref.stream()]
#     return {"child_id": child_id, "log_count": len(logs), "logs": logs}

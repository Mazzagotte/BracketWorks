
FROM python:3.11-slim

WORKDIR /app
COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY app /app/app
EXPOSE 8000
# Use shell form so ${PORT} is expanded; falls back to 8000 if PORT is unset
CMD uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}

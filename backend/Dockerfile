FROM python:3.11-slim

WORKDIR /app
COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY alembic.ini /app/alembic.ini
COPY alembic /app/alembic
COPY start.sh /app/start.sh
COPY app /app/app
RUN chmod +x /app/start.sh
EXPOSE 8000
CMD ["/app/start.sh"]

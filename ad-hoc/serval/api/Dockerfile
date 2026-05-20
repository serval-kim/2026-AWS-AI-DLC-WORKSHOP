FROM python:3.11-slim

WORKDIR /app

# Install Python dependencies
COPY api/requirements.txt /app/api/requirements.txt
RUN pip install --no-cache-dir -r /app/api/requirements.txt

# Copy shared module
COPY shared/ /app/shared/

# Copy api module
COPY api/ /app/api/

ENV PYTHONPATH=/app
ENV PYTHONUNBUFFERED=1

EXPOSE 8000

CMD ["uvicorn", "api.main:app", "--host", "0.0.0.0", "--port", "8000"]

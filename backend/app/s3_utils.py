import os
import boto3
from fastapi import UploadFile
from botocore.exceptions import NoCredentialsError, ClientError

AWS_ACCESS_KEY_ID = os.getenv("AWS_ACCESS_KEY_ID")
AWS_SECRET_ACCESS_KEY = os.getenv("AWS_SECRET_ACCESS_KEY")
AWS_STORAGE_BUCKET_NAME = os.getenv("AWS_STORAGE_BUCKET_NAME")
AWS_S3_REGION_NAME = os.getenv("AWS_S3_REGION_NAME", "us-east-1")

def is_s3_configured() -> bool:
    return bool(AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY and AWS_STORAGE_BUCKET_NAME)

def upload_file_to_s3(file: UploadFile, filename: str, content_type: str = None) -> str:
    """
    Uploads a file to AWS S3 bucket.
    If S3 configuration is missing, it falls back to local disk storage.
    Returns the public URL (or local path /uploads/filename) of the uploaded file.
    """
    if not is_s3_configured():
        # Local fallback
        os.makedirs("uploads", exist_ok=True)
        filepath = os.path.join("uploads", filename)
        file.file.seek(0)
        content = file.file.read()
        with open(filepath, "wb") as f:
            f.write(content)
        return f"/uploads/{filename}"

    # S3 Upload
    s3_client = boto3.client(
        "s3",
        aws_access_key_id=AWS_ACCESS_KEY_ID,
        aws_secret_access_key=AWS_SECRET_ACCESS_KEY,
        region_name=AWS_S3_REGION_NAME
    )
    
    try:
        file.file.seek(0)
        try:
            s3_client.upload_fileobj(
                file.file,
                AWS_STORAGE_BUCKET_NAME,
                filename,
                ExtraArgs={
                    "ContentType": content_type or file.content_type or "image/jpeg",
                    "ACL": "public-read"
                }
            )
        except ClientError as ce:
            # If ACL public-read is blocked by Bucket Settings, retry without ACL
            if "AccessDenied" in str(ce):
                print("[S3 WARNING] ACL public-read blocked. Retrying upload without ACL...")
                file.file.seek(0)
                s3_client.upload_fileobj(
                    file.file,
                    AWS_STORAGE_BUCKET_NAME,
                    filename,
                    ExtraArgs={
                        "ContentType": content_type or file.content_type or "image/jpeg"
                    }
                )
            else:
                raise ce
        return f"https://{AWS_STORAGE_BUCKET_NAME}.s3.{AWS_S3_REGION_NAME}.amazonaws.com/{filename}"
    except Exception as e:
        # Fallback to local storage on any other S3 error
        print(f"[S3 ERROR] Failed to upload to S3: {e}. Falling back to local storage.")
        os.makedirs("uploads", exist_ok=True)
        filepath = os.path.join("uploads", filename)
        file.file.seek(0)
        content = file.file.read()
        with open(filepath, "wb") as f:
            f.write(content)
        return f"/uploads/{filename}"

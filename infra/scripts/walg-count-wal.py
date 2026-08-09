#!/usr/bin/env python3
"""Count WAL files in R2 wal_005/ prefix using boto3."""
import os
import sys

try:
    import boto3
except ImportError:
    print("0")
    sys.exit(0)

access_key = os.environ.get("AWS_ACCESS_KEY_ID", "")
secret_key = os.environ.get("AWS_SECRET_ACCESS_KEY", "")
endpoint = os.environ.get("AWS_ENDPOINT", "")

if not (access_key and secret_key and endpoint):
    print("0")
    sys.exit(0)

s3 = boto3.client(
    "s3",
    endpoint_url=endpoint,
    aws_access_key_id=access_key,
    aws_secret_access_key=secret_key,
    region_name="auto",
)

try:
    r = s3.list_objects_v2(Bucket="wwf-backups", Prefix="wal_005/")
    print(r.get("KeyCount", 0))
except Exception:
    print("0")

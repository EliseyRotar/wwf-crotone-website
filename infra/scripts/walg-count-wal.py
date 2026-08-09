#!/usr/bin/env python3
"""Count WAL files in R2 wal_005/ prefix using stdlib only.

Uses virtual-hosted bucket addressing (bucket in hostname) because R2
rejects path-style LIST requests with SignatureDoesNotMatch on virtual-
hosted-only buckets.
"""
import hmac
import hashlib
import datetime
import urllib.request
import urllib.error
import re
import sys
import os

access_key = os.environ.get("AWS_ACCESS_KEY_ID", "")
secret_key = os.environ.get("AWS_SECRET_ACCESS_KEY", "")
endpoint = os.environ.get("AWS_ENDPOINT", "")
if not (access_key and secret_key and endpoint):
    print("0")
    sys.exit(0)

# Endpoint like https://72bc...r2.cloudflarestorage.com → host = bucket.endpoint
endpoint_host = endpoint.replace("https://", "").replace("http://", "")
bucket = "wwf-backups"
host = f"{bucket}.{endpoint_host}"  # virtual-hosted


def sign(k, m):
    return hmac.new(k, m.encode(), hashlib.sha256).digest()


def derive_key(date_stamp, region, service):
    return sign(sign(sign(("AWS4" + date_stamp).encode(), date_stamp), region), service)


t = datetime.datetime.now(datetime.timezone.utc)
amz_date = t.strftime("%Y%m%dT%H%M%SZ")
date_stamp = t.strftime("%Y%m%d")

# Virtual-hosted: bucket name is in the Host header, NOT in the URI path
canonical_uri = "/wal_005/"
canonical_querystring = "list-type=2"
canonical_headers = (
    f"host:{host}\n"
    f"x-amz-content-sha256:UNSIGNED-PAYLOAD\n"
    f"x-amz-date:{amz_date}\n"
)
signed_headers = "host;x-amz-content-sha256;x-amz-date"
payload_hash = "UNSIGNED-PAYLOAD"

canonical_request = (
    f"GET\n{canonical_uri}\n{canonical_querystring}\n"
    f"{canonical_headers}\n{signed_headers}\n{payload_hash}"
)

algorithm = "AWS4-HMAC-SHA256"
credential_scope = f"{date_stamp}/auto/s3/aws4_request"
string_to_sign = (
    f"{algorithm}\n{amz_date}\n{credential_scope}\n"
    f"{hashlib.sha256(canonical_request.encode()).hexdigest()}"
)

signing_key = derive_key(date_stamp, "auto", "s3")
signature = hmac.new(signing_key, string_to_sign.encode(), hashlib.sha256).hexdigest()

authorization_header = (
    f"{algorithm} Credential={access_key}/{credential_scope}, "
    f"SignedHeaders={signed_headers}, Signature={signature}"
)

url = f"https://{host}{canonical_uri}?{canonical_querystring}"
req = urllib.request.Request(url)
req.add_header("Authorization", authorization_header)
req.add_header("x-amz-date", amz_date)
req.add_header("x-amz-content-sha256", "UNSIGNED-PAYLOAD")

try:
    response = urllib.request.urlopen(req, timeout=10)
    body = response.read().decode()
    keys = re.findall(r"<Key>([^<]+)</Key>", body)
    print(len(keys))
except urllib.error.HTTPError as e:
    print("0")
except Exception as e:
    print("0")

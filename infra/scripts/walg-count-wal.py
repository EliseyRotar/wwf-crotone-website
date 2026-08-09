#!/usr/bin/env python3
"""Count WAL files in R2 wal_005/ prefix using stdlib only."""
import hmac
import hashlib
import datetime
import urllib.request
import urllib.error
import re
import sys

# Read env from env or argv
import os
access_key = os.environ.get("AWS_ACCESS_KEY_ID", "")
secret_key = os.environ.get("AWS_SECRET_ACCESS_KEY", "")
endpoint = os.environ.get("AWS_ENDPOINT", "")
if not (access_key and secret_key and endpoint):
    print("0")
    sys.exit(0)

# Parse endpoint host
endpoint_host = endpoint.replace("https://", "").replace("http://", "")
bucket = "wwf-backups"


def sign(k, m):
    return hmac.new(k, m.encode(), hashlib.sha256).digest()


def derive_key(date_stamp, region, service):
    k1 = sign(("AWS4" + date_stamp).encode(), date_stamp)
    k2 = sign(k1, region)
    k3 = sign(k2, service)
    return k3


t = datetime.datetime.now(datetime.timezone.utc)
amz_date = t.strftime("%Y%m%dT%H%M%SZ")
date_stamp = t.strftime("%Y%m%d")

canonical_uri = f"/{bucket}/wal_005/"
canonical_querystring = "list-type=2"
canonical_headers = (
    f"host:{endpoint_host}\n"
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

url = f"https://{endpoint_host}{canonical_uri}?{canonical_querystring}"
req = urllib.request.Request(url)
req.add_header("Authorization", authorization_header)
req.add_header("x-amz-date", amz_date)
req.add_header("x-amz-content-sha256", "UNSIGNED-PAYLOAD")

try:
    response = urllib.request.urlopen(req, timeout=10)
    body = response.read().decode()
    # Count <Key> entries (one per file)
    keys = re.findall(r"<Key>([^<]+)</Key>", body)
    print(len(keys))
except urllib.error.HTTPError as e:
    # 404 = no files yet, that's OK
    if e.code == 404:
        print("0")
    else:
        print(f"0")
except Exception as e:
    print(f"0")

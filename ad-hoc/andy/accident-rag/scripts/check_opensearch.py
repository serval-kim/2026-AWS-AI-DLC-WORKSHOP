"""Diagnose OpenSearch connectivity and auth without writing data.

Steps:
  1. STS GetCallerIdentity (확인 IAM principal)
  2. OpenSearch GET / (cluster info, signed)
  3. GET /_cluster/health
  4. HEAD /<index>
"""

from __future__ import annotations

import os
import sys

import boto3
from botocore.exceptions import ClientError
from opensearchpy import OpenSearch, RequestsHttpConnection
from requests_aws4auth import AWS4Auth

try:
    from dotenv import load_dotenv

    load_dotenv()
except ImportError:
    pass


def main() -> int:
    region = os.environ.get("AWS_REGION", "us-east-1")
    endpoint = os.environ.get("OPENSEARCH_ENDPOINT", "")
    index = os.environ.get("OPENSEARCH_INDEX", "accident-law")
    serverless = os.environ.get("OPENSEARCH_SERVERLESS", "0").lower() in {"1", "true", "yes"}

    if not endpoint:
        print("OPENSEARCH_ENDPOINT not set", file=sys.stderr)
        return 1
    host = endpoint.replace("https://", "").rstrip("/")

    print(f"region            = {region}")
    print(f"endpoint host     = {host}")
    print(f"index             = {index}")
    print(f"serverless        = {serverless}")

    # 1. STS
    try:
        ident = boto3.client("sts", region_name=region).get_caller_identity()
        print(f"caller arn        = {ident['Arn']}")
    except ClientError as exc:
        print(f"STS FAILED: {exc}", file=sys.stderr)
        return 2

    # 2. Build signed client
    creds = boto3.Session().get_credentials()
    if creds is None:
        print("No AWS credentials found", file=sys.stderr)
        return 3
    frozen = creds.get_frozen_credentials()
    service = "aoss" if serverless else "es"
    auth = AWS4Auth(
        frozen.access_key,
        frozen.secret_key,
        region,
        service,
        session_token=frozen.token,
    )
    client = OpenSearch(
        hosts=[{"host": host, "port": 443}],
        http_auth=auth,
        use_ssl=True,
        verify_certs=True,
        connection_class=RequestsHttpConnection,
        timeout=30,
    )

    # 3. Cluster info
    try:
        info = client.info()
        print(f"cluster info      = name={info.get('cluster_name')} version={info.get('version', {}).get('number')}")
    except Exception as exc:  # noqa: BLE001
        print(f"GET / FAILED: {exc}", file=sys.stderr)
        return 4

    # 4. Cluster health
    try:
        health = client.cluster.health()
        print(f"cluster health    = status={health.get('status')} nodes={health.get('number_of_nodes')}")
    except Exception as exc:  # noqa: BLE001
        print(f"GET /_cluster/health FAILED: {exc}", file=sys.stderr)

    # 5. Index existence
    try:
        exists = client.indices.exists(index=index)
        print(f"index '{index}' exists = {exists}")
        if exists:
            count = client.count(index=index).get("count")
            print(f"index doc count    = {count}")
    except Exception as exc:  # noqa: BLE001
        print(f"HEAD /{index} FAILED: {exc}", file=sys.stderr)

    print("OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

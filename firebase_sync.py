"""
Firebase Realtime Database synchronization module for WinGo Lottery Bot.
Handles real-time sync to https://gsgssnn-580ca-default-rtdb.firebaseio.com.
Supports dual-mode: direct REST API (zero credential dependencies) and firebase-admin SDK.
"""

import os
import time
import json
import logging
from datetime import datetime, timezone
from typing import Dict, Any, Optional

try:
    import requests
    from requests.adapters import HTTPAdapter
    from urllib3.util.retry import Retry
    HAS_REQUESTS = True
except ImportError:
    import urllib.request
    import urllib.error
    HAS_REQUESTS = False

logger = logging.getLogger("firebase_sync")

DEFAULT_DATABASE_URL = "https://gsgssnn-580ca-default-rtdb.firebaseio.com"
DEFAULT_PROJECT_ID = "gsgssnn-580ca"


class FirebaseSyncManager:
    """
    Manages persistent state and synchronized nodes in Firebase Realtime Database.
    Node structure:
      /current_prediction
        - current_period: str
        - target_period: str
        - prediction: "BIG" | "SMALL"
        - previous_status: "WIN" | "LOSS" | "PENDING"
        - confidence: int
        - win_rate: float
        - streak_count: int
        - last_updated: ISO-8601 string
        - timestamp_ms: int
    """

    def __init__(self, database_url: Optional[str] = None, project_id: Optional[str] = None):
        self.database_url = (database_url or os.getenv("FIREBASE_DATABASE_URL", DEFAULT_DATABASE_URL)).rstrip("/")
        self.project_id = project_id or os.getenv("FIREBASE_PROJECT_ID", DEFAULT_PROJECT_ID)
        self.admin_app = None
        self.use_admin_sdk = False

        if HAS_REQUESTS:
            self.session = requests.Session()
            retries = Retry(
                total=3,
                backoff_factor=0.5,
                status_forcelist=[500, 502, 503, 504],
                allowed_methods=["GET", "PUT", "PATCH"]
            )
            self.session.mount("https://", HTTPAdapter(max_retries=retries))
        else:
            self.session = None

        # Check if Firebase Admin SDK service account key exists
        service_account_path = os.getenv("FIREBASE_SERVICE_ACCOUNT_KEY", "serviceAccountKey.json")
        if os.path.exists(service_account_path):
            try:
                import firebase_admin
                from firebase_admin import credentials, db

                if not firebase_admin._apps:
                    cred = credentials.Certificate(service_account_path)
                    self.admin_app = firebase_admin.initialize_app(cred, {
                        'databaseURL': self.database_url,
                        'projectId': self.project_id
                    })
                else:
                    self.admin_app = firebase_admin.get_app()
                self.use_admin_sdk = True
                logger.info(f"Firebase Admin SDK initialized successfully for project: {self.project_id}")
            except Exception as e:
                logger.warning(f"Could not initialize Firebase Admin SDK ({e}). Defaulting to REST API.")
                self.use_admin_sdk = False
        else:
            logger.info("Operating Firebase sync in native Realtime Database REST API mode.")

    def _http_request(self, method: str, url: str, data: Optional[Dict] = None) -> Optional[Dict]:
        """Unified HTTP method supporting requests or standard urllib."""
        if HAS_REQUESTS and self.session:
            resp = self.session.request(method, url, json=data, timeout=6)
            if resp.status_code in (200, 204):
                try:
                    return resp.json()
                except Exception:
                    return {"status": "ok"}
            return None
        else:
            # Fallback to standard library urllib
            req_data = json.dumps(data).encode("utf-8") if data else None
            req = urllib.request.Request(
                url,
                data=req_data,
                headers={"Content-Type": "application/json", "User-Agent": "WinGoBot/1.0"},
                method=method
            )
            with urllib.request.urlopen(req, timeout=6) as response:
                content = response.read().decode("utf-8")
                try:
                    return json.loads(content)
                except Exception:
                    return {"status": "ok"}

    def update_current_prediction(
        self,
        current_period: str,
        target_period: str,
        prediction: str,
        previous_status: str = "PENDING",
        confidence: int = 75,
        win_rate: float = 0.0,
        streak_count: int = 0,
        extra_data: Optional[Dict[str, Any]] = None
    ) -> bool:
        """
        Synchronize the /current_prediction node in Firebase RTDB.
        """
        now = datetime.now(timezone.utc)
        payload = {
            "current_period": str(current_period),
            "target_period": str(target_period),
            "prediction": prediction.upper(),
            "previous_status": previous_status.upper(),
            "confidence": int(confidence),
            "win_rate": float(win_rate),
            "streak_count": int(streak_count),
            "last_updated": now.isoformat(),
            "timestamp_ms": int(time.time() * 1000)
        }

        if extra_data:
            payload["details"] = extra_data

        if self.use_admin_sdk:
            try:
                from firebase_admin import db
                ref = db.reference("current_prediction")
                ref.set(payload)
                logger.info(f"Firebase Admin: Updated /current_prediction -> Target Period {target_period}: {prediction}")
                return True
            except Exception as e:
                logger.error(f"Firebase Admin update failed: {e}. Falling back to REST API.")

        # REST API sync mode
        endpoint = f"{self.database_url}/current_prediction.json"
        try:
            res = self._http_request("PATCH", endpoint, payload)
            if res is not None:
                logger.info(f"Firebase REST: Synced /current_prediction for Target {target_period} ({prediction})")
                return True
            return False
        except Exception as err:
            logger.error(f"Error syncing to Firebase RTDB: {err}")
            return False

    def push_history_record(self, period: str, record_data: Dict[str, Any]) -> bool:
        """
        Store individual resolved round record into /history/{period} for auditing.
        """
        if self.use_admin_sdk:
            try:
                from firebase_admin import db
                ref = db.reference(f"history/{period}")
                ref.set(record_data)
                return True
            except Exception as e:
                logger.error(f"Firebase Admin history push failed: {e}")

        endpoint = f"{self.database_url}/history/{period}.json"
        try:
            res = self._http_request("PUT", endpoint, record_data)
            return res is not None
        except Exception as err:
            logger.error(f"Error archiving to Firebase RTDB history: {err}")
            return False

    def get_current_prediction(self) -> Optional[Dict[str, Any]]:
        """Fetch current state from Firebase RTDB."""
        endpoint = f"{self.database_url}/current_prediction.json"
        try:
            return self._http_request("GET", endpoint)
        except Exception as err:
            logger.error(f"Error reading from Firebase RTDB: {err}")
        return None

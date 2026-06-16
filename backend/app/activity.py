"""Utility for writing activity logs from any router."""
import json
from sqlalchemy.orm import Session
from app.models import ActivityLog


def log(
    db: Session,
    actor_role: str,
    actor_id: int,
    actor_name: str,
    action: str,
    target: str = None,
    detail: dict | str = None,
    ip: str = None,
):
    entry = ActivityLog(
        actor_role=actor_role,
        actor_id=actor_id,
        actor_name=actor_name,
        action=action,
        target=target,
        detail=json.dumps(detail) if isinstance(detail, dict) else detail,
        ip_address=ip,
    )
    db.add(entry)
    # caller commits

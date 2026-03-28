import os
import uuid
import mimetypes
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_

from app.core.database import get_db
from app.core.deps import get_current_user, get_current_tenant_id
from app.services.crud import CRUDService
from app.models.global_models import User
from app.models.documents import Document, Attachment

router = APIRouter(prefix="/documents", tags=["documents"])

# Base upload directory — override via environment variable in production
UPLOAD_DIR = Path(os.environ.get("UPLOAD_DIR", "/tmp/erp_uploads"))
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _paginate(page: int, per_page: int):
    return (page - 1) * per_page, per_page


def _list_response(items: list, total: int, page: int, per_page: int) -> dict:
    return {
        "data": items,
        "total": total,
        "page": page,
        "per_page": per_page,
        "pages": (total + per_page - 1) // per_page,
    }


def _row_to_dict(obj) -> dict:
    return {c.name: getattr(obj, c.name) for c in obj.__table__.columns}


# ---------------------------------------------------------------------------
# Documents CRUD
# ---------------------------------------------------------------------------

document_service = CRUDService(Document)


@router.get("")
async def list_documents(
    page: int = Query(1, ge=1),
    per_page: int = Query(25, ge=1, le=200),
    search: Optional[str] = None,
    category: Optional[str] = None,
    documentable_type: Optional[str] = None,
    documentable_id: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    skip, limit = _paginate(page, per_page)
    filters: dict = {}
    if category:
        filters["category"] = category
    if documentable_type:
        filters["documentable_type"] = documentable_type
    if documentable_id:
        filters["documentable_id"] = documentable_id
    items, total = await document_service.get_list(
        db, tenant_id, skip=skip, limit=limit,
        search=search, search_fields=["title", "description"],
        filters=filters or None,
    )
    return _list_response([_row_to_dict(i) for i in items], total, page, per_page)


@router.get("/{id}")
async def get_document(
    id: int,
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    obj = await document_service.get_by_id(db, id, tenant_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Document not found")
    result = await db.execute(
        select(Attachment).where(Attachment.document_id == id).order_by(Attachment.id)
    )
    attachments = result.scalars().all()
    data = _row_to_dict(obj)
    data["attachments"] = [_row_to_dict(a) for a in attachments]
    return data


@router.post("", status_code=201)
async def create_document(
    data: dict,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
):
    obj = await document_service.create(db, data, tenant_id, user.id)
    await db.commit()
    await db.refresh(obj)
    return _row_to_dict(obj)


@router.put("/{id}")
async def update_document(
    id: int,
    data: dict,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
):
    obj = await document_service.update(db, id, data, tenant_id, user.id)
    if not obj:
        raise HTTPException(status_code=404, detail="Document not found")
    await db.commit()
    await db.refresh(obj)
    return _row_to_dict(obj)


@router.delete("/{id}", status_code=204)
async def delete_document(
    id: int,
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    # Also remove attachment files from disk
    result = await db.execute(
        select(Attachment).where(Attachment.document_id == id)
    )
    for attachment in result.scalars().all():
        _remove_file(attachment.file_path)

    deleted = await document_service.delete(db, id, tenant_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Document not found")
    await db.commit()


# ---------------------------------------------------------------------------
# Attachments
# ---------------------------------------------------------------------------

def _remove_file(file_path: str) -> None:
    try:
        p = Path(file_path)
        if p.exists():
            p.unlink()
    except Exception:
        pass  # Best-effort removal; log in production


@router.post("/{id}/attachments", status_code=201)
async def upload_attachment(
    id: int,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant_id),
):
    """Upload a file attachment to a document."""
    document = await document_service.get_by_id(db, id, tenant_id)
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    # Determine storage path
    ext = Path(file.filename).suffix if file.filename else ""
    stored_name = f"{uuid.uuid4().hex}{ext}"
    dest_dir = UPLOAD_DIR / str(tenant_id) / str(id)
    dest_dir.mkdir(parents=True, exist_ok=True)
    dest_path = dest_dir / stored_name

    # Save to disk
    contents = await file.read()
    dest_path.write_bytes(contents)

    mime_type = file.content_type or mimetypes.guess_type(file.filename or "")[0]
    attachment = Attachment(
        document_id=id,
        file_name=file.filename or stored_name,
        file_path=str(dest_path),
        mime_type=mime_type,
        file_size=len(contents),
        uploaded_by=user.id,
    )
    db.add(attachment)
    await db.flush()
    await db.commit()
    await db.refresh(attachment)
    return _row_to_dict(attachment)


@router.get("/{id}/attachments/{attachment_id}/download")
async def download_attachment(
    id: int,
    attachment_id: int,
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    """Stream-download a specific attachment."""
    document = await document_service.get_by_id(db, id, tenant_id)
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    result = await db.execute(
        select(Attachment).where(
            and_(Attachment.id == attachment_id, Attachment.document_id == id)
        )
    )
    attachment = result.scalar_one_or_none()
    if not attachment:
        raise HTTPException(status_code=404, detail="Attachment not found")

    file_path = Path(attachment.file_path)
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found on server")

    return FileResponse(
        path=str(file_path),
        filename=attachment.file_name,
        media_type=attachment.mime_type or "application/octet-stream",
    )


@router.delete("/{id}/attachments/{attachment_id}", status_code=204)
async def delete_attachment(
    id: int,
    attachment_id: int,
    db: AsyncSession = Depends(get_db),
    tenant_id: int = Depends(get_current_tenant_id),
):
    """Delete an attachment record and remove its file from disk."""
    document = await document_service.get_by_id(db, id, tenant_id)
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    result = await db.execute(
        select(Attachment).where(
            and_(Attachment.id == attachment_id, Attachment.document_id == id)
        )
    )
    attachment = result.scalar_one_or_none()
    if not attachment:
        raise HTTPException(status_code=404, detail="Attachment not found")

    _remove_file(attachment.file_path)
    await db.delete(attachment)
    await db.commit()

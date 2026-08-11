"""Auth, users, stores, banks + requests, settings, audit log, bootstrap."""
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from core import (db, new_id, now_utc, today_ist, clean, audit, get_current_user,
                  require_role, hash_password, verify_password, make_token,
                  normalize_name, require_store_access, MANAGER_PERMS)

router = APIRouter()


class LoginIn(BaseModel):
    username: str
    password: str


@router.post("/auth/login")
async def login(payload: LoginIn):
    user = await db.users.find_one({"username": payload.username.strip().lower()}, {"_id": 0})
    if not user or not verify_password(payload.password, user.get("password_hash", "")):
        raise HTTPException(401, "Invalid username or password")
    if not user.get("active", True):
        raise HTTPException(403, "Account deactivated")
    user.pop("password_hash", None)
    return {"token": make_token(user["id"]), "user": user}


@router.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return {"user": user, "today": today_ist()}


@router.get("/bootstrap")
async def bootstrap(user: dict = Depends(get_current_user)):
    stores = await db.stores.find({}, {"_id": 0}).sort("name", 1).to_list(50)
    banks = await db.banks.find({"active": True}, {"_id": 0}).sort("display_order", 1).to_list(200)
    settings = await db.settings.find_one({"key": "global"}, {"_id": 0}) or {}
    return {"user": user, "today": today_ist(), "stores": stores, "banks": banks,
            "settings": settings, "manager_perms": MANAGER_PERMS}


# ---------------- Users ----------------

class UserIn(BaseModel):
    username: str
    password: str
    name: str
    role: str
    store_id: Optional[str] = None
    store_ids: Optional[List[str]] = None
    manager_permissions: Optional[Dict[str, Dict[str, bool]]] = None


@router.get("/users")
async def list_users(user: dict = Depends(require_role("admin"))):
    users = await db.users.find({}, {"_id": 0, "password_hash": 0}).sort("name", 1).to_list(200)
    return {"users": users}


@router.post("/users", status_code=201)
async def create_user(payload: UserIn, user: dict = Depends(require_role("admin"))):
    if payload.role not in ("admin", "manager", "accountant", "cashier"):
        raise HTTPException(400, "Invalid role")
    if payload.role == "cashier" and not payload.store_id:
        raise HTTPException(400, "Cashier requires a store")
    doc = {"id": new_id(), "username": payload.username.strip().lower(),
           "password_hash": hash_password(payload.password), "name": payload.name.strip(),
           "role": payload.role, "store_id": payload.store_id,
           "store_ids": payload.store_ids or [],
           "manager_permissions": payload.manager_permissions or {},
           "active": True, "assignment_history": [], "created_at": now_utc()}
    dup = await db.users.find_one({"username": doc["username"]})
    if dup:
        raise HTTPException(409, "Username already exists")
    await db.users.insert_one(dict(doc))
    doc.pop("password_hash")
    await audit(user, "user.create", "user", doc["id"], after=doc)
    return {"user": clean(doc)}


class UserUpdate(BaseModel):
    name: Optional[str] = None
    active: Optional[bool] = None
    store_id: Optional[str] = None
    store_ids: Optional[List[str]] = None
    manager_permissions: Optional[Dict[str, Dict[str, bool]]] = None
    password: Optional[str] = None


@router.patch("/users/{user_id}")
async def update_user(user_id: str, payload: UserUpdate,
                      user: dict = Depends(require_role("admin"))):
    target = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    if not target:
        raise HTTPException(404, "User not found")
    upd: Dict[str, Any] = {}
    if payload.name is not None:
        upd["name"] = payload.name.strip()
    if payload.active is not None:
        upd["active"] = payload.active
    if payload.store_id is not None and payload.store_id != target.get("store_id"):
        upd["store_id"] = payload.store_id
        await db.users.update_one({"id": user_id}, {"$push": {"assignment_history": {
            "from_store": target.get("store_id"), "to_store": payload.store_id,
            "by": user["id"], "at": now_utc()}}})
    if payload.store_ids is not None:
        upd["store_ids"] = payload.store_ids
    if payload.manager_permissions is not None:
        upd["manager_permissions"] = payload.manager_permissions
    if payload.password:
        upd["password_hash"] = hash_password(payload.password)
    if upd:
        await db.users.update_one({"id": user_id}, {"$set": upd})
    updated = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    await audit(user, "user.update", "user", user_id, before=target, after=updated)
    return {"user": updated}


# ---------------- Stores ----------------

class StoreIn(BaseModel):
    name: str
    code: str
    type: str  # main | branch


@router.get("/stores")
async def list_stores(user: dict = Depends(get_current_user)):
    stores = await db.stores.find({}, {"_id": 0}).sort("name", 1).to_list(50)
    return {"stores": stores}


@router.post("/stores", status_code=201)
async def create_store(payload: StoreIn, user: dict = Depends(require_role("admin"))):
    if payload.type not in ("main", "branch"):
        raise HTTPException(400, "type must be main or branch")
    doc = {"id": new_id(), "name": payload.name.strip(), "code": payload.code.strip().upper(),
           "type": payload.type, "active": True, "created_at": now_utc()}
    await db.stores.insert_one(dict(doc))
    await audit(user, "store.create", "store", doc["id"], after=doc)
    return {"store": clean(doc)}


class StoreUpdate(BaseModel):
    name: Optional[str] = None
    type: Optional[str] = None
    active: Optional[bool] = None


@router.patch("/stores/{store_id}")
async def update_store(store_id: str, payload: StoreUpdate,
                       user: dict = Depends(require_role("admin"))):
    store = await db.stores.find_one({"id": store_id}, {"_id": 0})
    if not store:
        raise HTTPException(404, "Store not found")
    upd = {k: v for k, v in payload.model_dump().items() if v is not None}
    if upd:
        await db.stores.update_one({"id": store_id}, {"$set": upd})
    await audit(user, "store.update", "store", store_id, before=store, after=upd)
    return {"ok": True}


# ---------------- Banks ----------------

class BankIn(BaseModel):
    name: str
    home_store_id: Optional[str] = None
    account_label: Optional[str] = None


@router.get("/banks")
async def list_banks(include_inactive: bool = False, user: dict = Depends(get_current_user)):
    q = {} if include_inactive else {"active": True}
    banks = await db.banks.find(q, {"_id": 0}).sort("display_order", 1).to_list(200)
    return {"banks": banks}


@router.post("/banks", status_code=201)
async def create_bank(payload: BankIn, user: dict = Depends(require_role("admin"))):
    norm = normalize_name(payload.name)
    dup = await db.banks.find_one({"normalized_name": norm}, {"_id": 0})
    if dup:
        raise HTTPException(409, f"Bank already exists as '{dup['name']}'")
    count = await db.banks.count_documents({})
    doc = {"id": new_id(), "name": payload.name.strip(), "normalized_name": norm,
           "home_store_id": payload.home_store_id, "account_label": payload.account_label,
           "display_order": count + 1, "active": True, "created_at": now_utc()}
    await db.banks.insert_one(dict(doc))
    await audit(user, "bank.create", "bank", doc["id"], after=doc)
    return {"bank": clean(doc)}


class BankUpdate(BaseModel):
    name: Optional[str] = None
    home_store_id: Optional[str] = None
    account_label: Optional[str] = None
    active: Optional[bool] = None


@router.patch("/banks/{bank_id}")
async def update_bank(bank_id: str, payload: BankUpdate,
                      user: dict = Depends(require_role("admin"))):
    bank = await db.banks.find_one({"id": bank_id}, {"_id": 0})
    if not bank:
        raise HTTPException(404, "Bank not found")
    upd = {k: v for k, v in payload.model_dump().items() if v is not None}
    if "name" in upd:
        upd["normalized_name"] = normalize_name(upd["name"])
    if upd:
        await db.banks.update_one({"id": bank_id}, {"$set": upd})
    await audit(user, "bank.update", "bank", bank_id, before=bank, after=upd)
    return {"ok": True}


class BankOrderIn(BaseModel):
    ordered_ids: List[str]


@router.post("/banks/reorder")
async def reorder_banks(payload: BankOrderIn, user: dict = Depends(require_role("admin"))):
    for i, bid in enumerate(payload.ordered_ids):
        await db.banks.update_one({"id": bid}, {"$set": {"display_order": i + 1}})
    await audit(user, "bank.reorder", "bank", "order", after={"order": payload.ordered_ids})
    return {"ok": True}


# ---------------- Bank requests ----------------

class BankRequestIn(BaseModel):
    name: str
    note: Optional[str] = None


@router.post("/bank-requests", status_code=201)
async def create_bank_request(payload: BankRequestIn, user: dict = Depends(get_current_user)):
    norm = normalize_name(payload.name)
    existing_bank = await db.banks.find_one({"normalized_name": norm, "active": True}, {"_id": 0})
    if existing_bank:
        return {"request": None, "existing_bank": existing_bank,
                "message": f"Bank already exists as '{existing_bank['name']}'"}
    doc = {"id": new_id(), "name": payload.name.strip(), "normalized_name": norm,
           "note": payload.note, "requested_by": user["id"], "requested_by_name": user["name"],
           "store_id": user.get("store_id"), "status": "pending",
           "resolved_bank_id": None, "created_at": now_utc()}
    await db.bank_requests.insert_one(dict(doc))
    await audit(user, "bank_request.create", "bank_request", doc["id"], after=doc)
    return {"request": clean(doc), "existing_bank": None}


@router.get("/bank-requests")
async def list_bank_requests(status: Optional[str] = None,
                             user: dict = Depends(get_current_user)):
    q: Dict[str, Any] = {}
    if user["role"] != "admin":
        q["requested_by"] = user["id"]
    if status:
        q["status"] = status
    reqs = await db.bank_requests.find(q, {"_id": 0}).sort("created_at", -1).to_list(200)
    return {"requests": reqs}


class BankRequestResolve(BaseModel):
    action: str  # approve | reject | merge
    corrected_name: Optional[str] = None
    home_store_id: Optional[str] = None
    merge_bank_id: Optional[str] = None
    note: Optional[str] = None


@router.post("/bank-requests/{req_id}/resolve")
async def resolve_bank_request(req_id: str, payload: BankRequestResolve,
                               user: dict = Depends(require_role("admin"))):
    req = await db.bank_requests.find_one({"id": req_id}, {"_id": 0})
    if not req:
        raise HTTPException(404, "Request not found")
    if req["status"] != "pending":
        raise HTTPException(400, "Request already resolved")
    if payload.action == "approve":
        name = (payload.corrected_name or req["name"]).strip()
        norm = normalize_name(name)
        dup = await db.banks.find_one({"normalized_name": norm}, {"_id": 0})
        if dup:
            bank_id = dup["id"]
        else:
            count = await db.banks.count_documents({})
            bank = {"id": new_id(), "name": name, "normalized_name": norm,
                    "home_store_id": payload.home_store_id, "account_label": None,
                    "display_order": count + 1, "active": True, "created_at": now_utc()}
            await db.banks.insert_one(dict(bank))
            bank_id = bank["id"]
        await db.bank_requests.update_one({"id": req_id}, {"$set": {
            "status": "approved", "resolved_bank_id": bank_id,
            "resolved_by": user["id"], "resolved_at": now_utc(), "resolve_note": payload.note}})
    elif payload.action == "merge":
        if not payload.merge_bank_id:
            raise HTTPException(400, "merge_bank_id required")
        await db.bank_requests.update_one({"id": req_id}, {"$set": {
            "status": "merged", "resolved_bank_id": payload.merge_bank_id,
            "resolved_by": user["id"], "resolved_at": now_utc(), "resolve_note": payload.note}})
    elif payload.action == "reject":
        await db.bank_requests.update_one({"id": req_id}, {"$set": {
            "status": "rejected", "resolved_by": user["id"],
            "resolved_at": now_utc(), "resolve_note": payload.note}})
    else:
        raise HTTPException(400, "Invalid action")
    await audit(user, f"bank_request.{payload.action}", "bank_request", req_id,
                before=req, reason=payload.note)
    return {"ok": True}


# ---------------- Settings & audit ----------------

class SettingsIn(BaseModel):
    allow_manager_finalize_main: Optional[bool] = None


@router.patch("/settings")
async def update_settings(payload: SettingsIn, user: dict = Depends(require_role("admin"))):
    upd = {k: v for k, v in payload.model_dump().items() if v is not None}
    await db.settings.update_one({"key": "global"}, {"$set": upd}, upsert=True)
    await audit(user, "settings.update", "settings", "global", after=upd)
    return {"ok": True}


@router.get("/audit-log")
async def audit_log(entity: Optional[str] = None, store_id: Optional[str] = None,
                    business_date: Optional[str] = None, actor_id: Optional[str] = None,
                    limit: int = 200,
                    user: dict = Depends(require_role("admin"))):
    q: Dict[str, Any] = {}
    if entity:
        q["entity"] = entity
    if store_id:
        q["store_id"] = store_id
    if business_date:
        q["business_date"] = business_date
    if actor_id:
        q["actor_id"] = actor_id
    logs = await db.audit_log.find(q, {"_id": 0}).sort("ts", -1).to_list(min(limit, 500))
    return {"logs": logs}

from authx import TokenPayload
from fastapi import APIRouter, Depends, Response

from app.core.database import SessionDep
from app.core.security import auth
from app.modules.auth import service
from app.modules.auth.dependencies import CurrentUser
from app.modules.auth.schemas import LoginRequest, MeRead

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login")
def login(data: LoginRequest, response: Response, session: SessionDep):
    user = service.authenticate(session, data.email, data.password)
    auth.set_access_cookies(auth.create_access_token(uid=str(user.id)), response)
    auth.set_refresh_cookies(auth.create_refresh_token(uid=str(user.id)), response)
    return {"message": "Sesión iniciada"}


@router.get("/me", response_model=MeRead)
def get_me(current_user: CurrentUser, session: SessionDep):
    return MeRead(
        user_name=current_user.nombre,
        company_name=service.get_company_name(session, current_user.id),
    )


@router.post("/logout")
def logout(response: Response):
    auth.unset_cookies(response)
    return {"message": "Sesión cerrada"}


@router.post("/refresh")
def refresh(
    response: Response, session: SessionDep, payload: TokenPayload = Depends(auth.refresh_token_required)
):
    user = service.get_active_user(session, int(payload.sub))
    auth.set_access_cookies(auth.create_access_token(uid=str(user.id)), response)
    return {"message": "Token renovado"}

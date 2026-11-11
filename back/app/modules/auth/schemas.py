from sqlmodel import SQLModel


class LoginRequest(SQLModel):
    email: str
    password: str


class MeRead(SQLModel):
    user_name: str
    company_name: str

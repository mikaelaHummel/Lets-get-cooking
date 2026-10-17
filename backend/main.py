from typing import Optional
import os
import psycopg
from dotenv import load_dotenv
from fastapi import FastAPI
import jwt
from jwt import PyJWKClient
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

load_dotenv()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["Authorization"],
)

AUTH0_DOMAIN = os.environ["AUTH0_DOMAIN"]
AUTH0_AUDIENCE = os.environ["AUTH0_AUDIENCE"]

security = HTTPBearer()

jwks_client = PyJWKClient(
    f"https://{AUTH0_DOMAIN}/.well-known/jwks.json"
)

def verify_token(
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    try:
        signing_key = jwks_client.get_signing_key_from_jwt(
            credentials.credentials
        )

        payload = jwt.decode(
            credentials.credentials,
            signing_key.key,
            algorithms=["RS256"],
            audience=AUTH0_AUDIENCE,
            issuer=f"https://{AUTH0_DOMAIN}/"
        )

        return payload

    except jwt.PyJWTError:
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired access token"
        )

class Recipe(BaseModel):
    title: str
    ingredients: list[str]
    instructions: list[str]
    prepTime: Optional[str] = None
    cookTime: Optional[str] = None
    servings: Optional[str] = None

@app.get("/")
def home():
    return {"message": "Let's Get Cooking backend is running!"}



@app.get("/test-db")
def test_database():
    with psycopg.connect(os.environ["DATABASE_URL"]) as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) FROM profiles;")
            count = cur.fetchone()[0]

    return {"profile_count": count}

@app.get("/me")
def get_current_user(payload: dict = Depends(verify_token)):
    return {
        "auth0_id": payload["sub"]
    }

@app.post("/recipes")
def save_recipe(
    recipe: Recipe,
    payload: dict = Depends(verify_token)
):
    auth0_id = payload["sub"]

    with psycopg.connect(os.environ["DATABASE_URL"]) as conn:
        with conn.cursor() as cur:

            # Make sure this user has a profile
            cur.execute(
                """
                INSERT INTO profiles (auth0_id, display_name)
                VALUES (%s, %s)
                ON CONFLICT (auth0_id) DO NOTHING
                """,
                (auth0_id, "New Chef")
            )

            # Save the recipe
            cur.execute(
                """
                INSERT INTO recipes
                (user_id, title, ingredients, instructions,
                 prep_time, cook_time, servings)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                RETURNING id
                """,
                (
                    auth0_id,
                    recipe.title,
                    psycopg.types.json.Jsonb(recipe.ingredients),
                    psycopg.types.json.Jsonb(recipe.instructions),
                    recipe.prepTime,
                    recipe.cookTime,
                    recipe.servings
                )
            )

            recipe_id = cur.fetchone()[0]

    return {
        "message": "Recipe saved successfully!",
        "recipe_id": recipe_id
    }
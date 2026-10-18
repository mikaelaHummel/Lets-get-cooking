from typing import Optional, Any, Dict
import os
import time
import traceback
import psycopg
from dotenv import load_dotenv
from fastapi import FastAPI, Depends, HTTPException
import jwt
from jwt import PyJWKClient
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from google import genai





#hello



load_dotenv()








app = FastAPI()








app.add_middleware(
  CORSMiddleware,
  allow_origins=["http://localhost:5173"],
  allow_credentials=False,
  allow_methods=["GET", "POST","DELETE"],
  allow_headers=["Authorization", "Content-Type"],
)








AUTH0_DOMAIN = os.environ["AUTH0_DOMAIN"]
AUTH0_AUDIENCE = os.environ["AUTH0_AUDIENCE"]








# Initialize Google GenAI Client
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
client = genai.Client(api_key=GEMINI_API_KEY) if GEMINI_API_KEY else None








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




class GroceryItem(BaseModel):
    name: str



class Recipe(BaseModel):
  title: str
  ingredients: list[str]
  instructions: list[str]
  prepTime: Optional[str] = None
  cookTime: Optional[str] = None
  servings: Optional[str] = None








class ChatRequest(BaseModel):
  prompt: str
  recipeData: Optional[Dict[str, Any]] = None








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

@app.post("/groceries")
def add_grocery(
    item: GroceryItem,
    payload: dict = Depends(verify_token)
):
    auth0_id = payload["sub"]
    name = item.name.strip()

    if not name:
        raise HTTPException(status_code=400, detail="Grocery name cannot be empty")

    with psycopg.connect(os.environ["DATABASE_URL"]) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO profiles (auth0_id, display_name)
                VALUES (%s, %s)
                ON CONFLICT (auth0_id) DO NOTHING
                """,
                (auth0_id, "New Chef")
            )

            cur.execute(
                """
                INSERT INTO groceries (user_id, name)
                VALUES (%s, %s)
                RETURNING id
                """,
                (auth0_id, name)
            )

            item_id = cur.fetchone()[0]

    return {"id": item_id, "name": name}

@app.get("/groceries")
def get_groceries(payload: dict = Depends(verify_token)):
    auth0_id = payload["sub"]

    with psycopg.connect(os.environ["DATABASE_URL"]) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, name
                FROM groceries
                WHERE user_id = %s
                ORDER BY created_at ASC, id ASC
                """,
                (auth0_id,)
            )

            rows = cur.fetchall()

    return [
        {"id": row[0], "name": row[1]}
        for row in rows
    ]

@app.delete("/groceries/{item_id}")
def delete_grocery(
    item_id: int,
    payload: dict = Depends(verify_token)
):
    auth0_id = payload["sub"]

    with psycopg.connect(os.environ["DATABASE_URL"]) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                DELETE FROM groceries
                WHERE id = %s AND user_id = %s
                RETURNING id
                """,
                (item_id, auth0_id)
            )

            deleted = cur.fetchone()

    if deleted is None:
        raise HTTPException(
            status_code=404,
            detail="Grocery item not found"
        )

    return {"message": "Grocery item deleted successfully!"}

@app.get("/recipes")
def get_recipes(payload: dict = Depends(verify_token)):
    auth0_id = payload["sub"]

    with psycopg.connect(os.environ["DATABASE_URL"]) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, title, ingredients, instructions,
                       prep_time, cook_time, servings
                FROM recipes
                WHERE user_id = %s
                ORDER BY created_at DESC
                """,
                (auth0_id,)
            )

            rows = cur.fetchall()

    return [
        {
            "id": row[0],
            "title": row[1],
            "ingredients": row[2],
            "instructions": row[3],
            "prepTime": row[4],
            "cookTime": row[5],
            "servings": row[6]
        }
        for row in rows
    ]




@app.post("/recipes")
def save_recipe(
  recipe: Recipe,
  payload: dict = Depends(verify_token)
):
  auth0_id = payload["sub"]








  with psycopg.connect(os.environ["DATABASE_URL"]) as conn:
      with conn.cursor() as cur:








          cur.execute(
              """
              INSERT INTO profiles (auth0_id, display_name)
              VALUES (%s, %s)
              ON CONFLICT (auth0_id) DO NOTHING
              """,
              (auth0_id, "New Chef")
          )








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


@app.delete("/recipes/{recipe_id}")
def delete_recipe(
    recipe_id: int,
    payload: dict = Depends(verify_token)
):
    auth0_id = payload["sub"]

    with psycopg.connect(os.environ["DATABASE_URL"]) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                DELETE FROM recipes
                WHERE id = %s AND user_id = %s
                RETURNING id
                """,
                (recipe_id, auth0_id)
            )

            deleted = cur.fetchone()

    if deleted is None:
        raise HTTPException(
            status_code=404,
            detail="Recipe not found"
        )

    return {"message": "Recipe deleted successfully!"}





@app.post("/api/chat")
def chat_with_sous_chef(request: ChatRequest):
   if not client:
       raise HTTPException(
           status_code=500,
           detail="GEMINI_API_KEY is not configured on the server."
       )


   try:
       is_parsing = "Extract and format a structured recipe" in request.prompt


       if is_parsing:
           full_prompt = (
               f"{request.prompt}\n\n"
               "Return ONLY a JSON object matching this schema:\n"
               "{\n"
               '  "title": "Recipe Title",\n'
               '  "ingredients": ["1 cup flour", "2 eggs"],\n'
               '  "instructions": ["Step 1...", "Step 2..."],\n'
               '  "prepTime": "15 mins",\n'
               '  "cookTime": "30 mins",\n'
               '  "servings": "4"\n'
               "}"
           )
       else:
           recipe_context = str(request.recipeData) if request.recipeData else "No active recipe currently open."
           full_prompt = (
               "You are Sous-Chef AI, a helpful culinary assistant.\n"
               f"Current Recipe Context: {recipe_context}\n"
               f"User Input: {request.prompt}\n\n"
               "CRITICAL INSTRUCTION: You MUST ALWAYS respond with a JSON object ONLY using this exact structure:\n"
               "{\n"
               '  "message": "Write your friendly response/explanation to the user here.",\n'
               '  "updatedRecipe": null OR {\n'
               '    "title": "Recipe Title",\n'
               '    "ingredients": ["..."],\n'
               '    "instructions": ["..."],\n'
               '    "prepTime": "...",\n'
               '    "cookTime": "...",\n'
               '    "servings": "..."\n'
               '  }\n'
               "}\n\n"
               "If the user asks to substitute, change, reduce, scale, adjust, or modify any ingredient/step, "
               "you MUST provide the complete updated recipe object inside 'updatedRecipe'. "
               "If it is just a general question without recipe alterations, set 'updatedRecipe' to null."
           )


       # Smart retry loop with exponential backoff for 503 and 429
       response = None
       max_retries = 3
       for attempt in range(max_retries):
           try:
               response = client.models.generate_content(
                   model="gemini-3.8-flash",
                   contents=full_prompt,
                   config={"response_mime_type": "application/json"}
               )
               break
           except Exception as e:
               error_str = str(e)
               if ("503" in error_str or "429" in error_str) and attempt < max_retries - 1:
                   time.sleep((attempt + 1) * 3)
                   continue
               else:
                   raise e


       return {"response": response.text}


   except Exception as e:
       print(f"Gemini Chat Error: {str(e)}")
       traceback.print_exc()
       raise HTTPException(
           status_code=500,
           detail=f"Error processing Gemini chat: {str(e)}"
       )

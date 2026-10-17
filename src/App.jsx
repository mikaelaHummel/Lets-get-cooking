import { useState } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { parseRecipe } from './services/aiService';
import heroImg from './assets/hero.png';
import reactLogo from './assets/react.svg';
import viteLogo from './assets/vite.svg';
import './App.css';

function App() {
  const { loginWithRedirect, logout, isAuthenticated, isLoading, user, getAccessTokenSilently } = useAuth0();
  const [recipeUrl, setRecipeUrl] = useState('');
  const [recipeCard, setRecipeCard] = useState(null);
  const [parsingLoading, setParsingLoading] = useState(false);

  // Connected to your Gemini AI service!
  const handleImport = async () => {
    if (!recipeUrl.trim()) {
      alert('Please enter a recipe text or URL first!');
      return;
    }

    setParsingLoading(true);
    setRecipeCard(null);

    try {
      const data = await parseRecipe(recipeUrl);
      console.log('Gemini Parsed Recipe:', data);
      setRecipeCard(data);
    } catch (error) {
      console.error(error);
      alert('Error parsing recipe with Gemini. Check your console or API key.');
    } finally {
      setParsingLoading(false);
    }
  };



  // Test whether Python recognizes our logged-in Auth0 user
async function checkBackendUser() {
  try {
    const token = await getAccessTokenSilently();

    const response = await fetch('http://localhost:8000/me', {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    const data = await response.json();
    console.log('Backend user:', data);

  } catch (error) {
    console.error('Backend authentication failed:', error);
  }
}

async function handleSaveRecipe() {
  if (!recipeCard) return;

  try {
    const token = await getAccessTokenSilently();

    const response = await fetch('http://localhost:8000/recipes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(recipeCard)
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(JSON.stringify(data));
    }

    console.log('Saved recipe:', data);
    alert('Recipe saved successfully!');

  } catch (error) {
    console.error('Error saving recipe:', error);
    alert('Could not save recipe. Check the console.');
  }
}

  return (
    <>
      <section id="center">
        <div>
          <h1>Lets Get Cooking!</h1>
          <p>
            Your digital one stop cookbook. Save, swap, shop, and connect.
          </p>
          
          {/* Auth0 Login Section */}
          {isLoading ? (
            <p>Checking login status...</p>
          ) : isAuthenticated ? (
            <div>
              <p>Welcome, {user?.name}!</p>
              <p>You are logged in!</p>
              <button onClick={checkBackendUser}>
                Test Backend Connection
              </button>
              <button
                onClick={() =>
                  logout({
                    logoutParams: {
                      returnTo: window.location.origin
                    }
                  })
                }
              >
                Log Out
              </button>
            </div>
          ) : (
            <button onClick={() => loginWithRedirect()}>
              Log In
            </button>
          )}

          {/* Recipe Input Section linked to Gemini */}
          <div style={{ marginTop: '20px' }}>
            <input
              type="text"
              placeholder="Paste recipe text or details..."
              value={recipeUrl}
              onChange={(event) => setRecipeUrl(event.target.value)}
              style={{ padding: '10px', width: '70%', marginRight: '10px', borderRadius: '6px' }}
            />
            <button onClick={handleImport} disabled={parsingLoading}>
              {parsingLoading ? 'Extracting Recipe...' : 'Import Recipe'}
            </button>
          </div>

          {/* Render the Recipe Card once Gemini responds */}
          {recipeCard && (
            <div style={{ marginTop: '25px', padding: '20px', border: '2px solid #ddd', borderRadius: '12px', textAlign: 'left', backgroundColor: '#fff', color: '#333' }}>
              <h2 style={{ marginTop: 0 }}>{recipeCard.title}</h2>
              <p><strong>Prep:</strong> {recipeCard.prepTime} | <strong>Cook:</strong> {recipeCard.cookTime} | <strong>Servings:</strong> {recipeCard.servings}</p>
              
              <h3>Ingredients</h3>
              <ul>
                {recipeCard.ingredients?.map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>

              <h3>Instructions</h3>
              <ol>
                {recipeCard.instructions?.map((step, index) => (
                  <li key={index} style={{ marginBottom: '6px' }}>{step}</li>
                ))}
              </ol>
                {isAuthenticated && (
                <button onClick={handleSaveRecipe}>
                Save Recipe
              </button>
                )}
            </div>
          )}
        </div>
      </section>

      <div className="ticks"></div>

      <section id="next-steps">
        <div id="docs">
          <svg className="icon" role="presentation" aria-hidden="true">
            <use href="/icons.svg#documentation-icon"></use>
          </svg>
          <h2>Documentation</h2>
          <p>Your questions, answered</p>
          <ul>
            <li>
              <a href="https://vite.dev/" target="_blank">
                <img className="logo" src={viteLogo} alt="" />
                Explore Vite
              </a>
            </li>
            <li>
              <a href="https://react.dev/" target="_blank">
                <img className="button-icon" src={reactLogo} alt="" />
                Learn more
              </a>
            </li>
          </ul>
        </div>
        <div id="social">
          <svg className="icon" role="presentation" aria-hidden="true">
            <use href="/icons.svg#social-icon"></use>
          </svg>
          <h2>Connect with us</h2>
          <p>Join the Vite community</p>
          <ul>
            <li>
              <a href="https://github.com/vitejs/vite" target="_blank">
                <svg
                  className="button-icon"
                  role="presentation"
                  aria-hidden="true"
                >
                  <use href="/icons.svg#github-icon"></use>
                </svg>
                GitHub
              </a>
            </li>
            <li>
              <a href="https://chat.vite.dev/" target="_blank">
                <svg
                  className="button-icon"
                  role="presentation"
                  aria-hidden="true"
                >
                  <use href="/icons.svg#discord-icon"></use>
                </svg>
                Discord
              </a>
            </li>
            <li>
              <a href="https://x.com/vite_js" target="_blank">
                <svg
                  className="button-icon"
                  role="presentation"
                  aria-hidden="true"
                >
                  <use href="/icons.svg#x-icon"></use>
                </svg>
                X.com
              </a>
            </li>
            <li>
              <a href="https://bsky.app/profile/vite.dev" target="_blank">
                <svg
                  className="button-icon"
                  role="presentation"
                  aria-hidden="true"
                >
                  <use href="/icons.svg#bluesky-icon"></use>
                </svg>
                Bluesky
              </a>
            </li>
          </ul>
        </div>
      </section>

      <div className="ticks"></div>
      <section id="spacer"></section>
    </>
  );
}

export default App; // (or export default App)
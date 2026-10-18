import { useEffect, useState } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { parseRecipe } from './services/aiService';
import RecipeChat from './components/RecipeChat';

const SOURCES = ['TikTok', 'Instagram', 'YouTube', 'Google'];


function currentRoute() {
  return window.location.hash.slice(1) || '/';
}

function App() {
  const {
    loginWithRedirect,
    logout,
    isAuthenticated,
    isLoading,
    user,
    getAccessTokenSilently,
  } = useAuth0();

  const [route, setRoute] = useState(currentRoute);
  const [recipeUrl, setRecipeUrl] = useState('');
  const [source, setSource] = useState('');
  const [recipes, setRecipes] = useState([]);
  const [groceries, setGroceries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [addingItem, setAddingItem] = useState(false);
  const [itemName, setItemName] = useState('');
  const [itemStatus, setItemStatus] = useState('');
  const [recipeBackRoute, setRecipeBackRoute] = useState('/');
  const [previewRecipe, setPreviewRecipe] = useState(null);
  const [savingRecipe, setSavingRecipe] = useState(false);

  useEffect(() => {
  if (isLoading) return;

  if (isAuthenticated) {
    loadSavedRecipes();
  } else {
    setRecipes([]);
  }
}, [isAuthenticated, isLoading, getAccessTokenSilently]);

  useEffect(() => {
    function handleRouteChange() {
      const nextRoute = currentRoute();

      setRoute(nextRoute);

      // Discard the temporary recipe when leaving its card.
      setPreviewRecipe((preview) =>
        preview && nextRoute === `/recipe/${preview.id}`
          ? preview
          : null
      );

      window.scrollTo({ top: 0 });
    }

    window.addEventListener('hashchange', handleRouteChange);

    return () =>
      window.removeEventListener('hashchange', handleRouteChange);
  }, []);

  useEffect(() => {
    const checked = groceries.filter((item) => item.checkedAt);
    if (!checked.length) return;

    const nextDeadline = Math.min(
      ...checked.map((item) => item.checkedAt + 3000)
    );

    const timer = window.setTimeout(() => {
      const now = Date.now();

      setGroceries((items) =>
        items.filter(
          (item) => !item.checkedAt || item.checkedAt + 3000 > now
        )
      );
    }, Math.max(0, nextDeadline - Date.now()));

    return () => window.clearTimeout(timer);
  }, [groceries]);

  function navigate(path) {
    window.location.hash = path;
  }

  function openRecipe(recipe) {
    setRecipeBackRoute(route === '/cookbook' ? '/cookbook' : '/');
    navigate(`/recipe/${recipe.id}`);
  }

  async function importRecipe(event) {
    event.preventDefault();

    if (loading) return;

    if (!source) {
      setStatus('Please select a recipe type first.');
      return;
    }

    if (!recipeUrl.trim()) {
      setStatus('Paste a recipe link first.');
      return;
    }

    setLoading(true);
    setStatus('Reading your recipe...');

    try {
      // Keeps your existing Gemini API service.
      const card = await parseRecipe(recipeUrl.trim());

      const recipe = {
        id: crypto.randomUUID(),
        source,
        card,
      };

      setPreviewRecipe(recipe);
      setRecipeUrl('');
      setStatus('');
      setRecipeBackRoute('/');
      navigate(`/recipe/${recipe.id}`);
    } catch (error) {
      console.error('Recipe import failed:', error);
      setStatus('Unable to import this recipe. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  function addGrocery(event) {
    event.preventDefault();

    const name = itemName.trim();
    if (!name) return;

    setGroceries((items) => [
      ...items,
      {
        id: crypto.randomUUID(),
        name,
        checkedAt: null,
      },
    ]);

    setItemName('');
    setItemStatus(`${name} added.`);
  }

  function toggleGrocery(id) {
    setGroceries((items) =>
      items.map((item) =>
        item.id === id
          ? {
              ...item,
              checkedAt: item.checkedAt ? null : Date.now(),
            }
          : item
      )
    );
  }

  const recipeId = route.startsWith('/recipe/')
    ? route.slice('/recipe/'.length)
    : null;

  const selectedRecipe =
    previewRecipe?.id === recipeId
      ? previewRecipe
      : recipes.find((recipe) => recipe.id === recipeId);
      

  async function handleSaveRecipe(card) {
    if (!card || !selectedRecipe || savingRecipe) return;

    if (!isAuthenticated) {
      loginWithRedirect();
      return;
    }

    const recipeToSave = {
      ...selectedRecipe,
      card,
    };

    setSavingRecipe(true);

    try {
      const token = await getAccessTokenSilently();

      const response = await fetch('http://localhost:8000/recipes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(card),
      });

      if (!response.ok) {
        throw new Error(`Could not save recipe (${response.status}).`);
      }

      // Add to the visible lists only AFTER a successful database save.
      setRecipes((items) => [
        recipeToSave,
        ...items.filter((recipe) => recipe.id !== recipeToSave.id),
      ]);

      setPreviewRecipe((preview) =>
        preview?.id === recipeToSave.id ? null : preview
      );

      alert('Recipe saved successfully!');
    } catch (error) {
      console.error('Error saving recipe:', error);
      alert('Could not save recipe. Please try again.');
    } finally {
      setSavingRecipe(false);
    }
  }

  async function handleDeleteRecipe(recipe) {
  if (!recipe.id || !/^\d+$/.test(String(recipe.id))) {
    alert('This recipe has not been saved to your cookbook yet.');
    return;
  }

  const confirmed = window.confirm(
    `Are you sure you want to permanently delete "${recipe.card.title}"?`
  );

  if (!confirmed) return;

  try {
    const token = await getAccessTokenSilently();

    const response = await fetch(
      `http://localhost:8000/recipes/${recipe.id}`,
      {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );

    if (!response.ok) {
      throw new Error('Could not delete recipe');
    }

    setRecipes((items) =>
      items.filter((item) => item.id !== recipe.id)
    );

    navigate('/cookbook');

  } catch (error) {
    console.error('Error deleting recipe:', error);
    alert('Could not delete recipe. Please try again.');
  }
}

  async function loadSavedRecipes() {
  try {
    const token = await getAccessTokenSilently();

    const response = await fetch('http://localhost:8000/recipes', {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    if (!response.ok) {
      throw new Error('Could not load recipes');
    }

    const data = await response.json();

    const savedRecipes = data.map((recipe) => ({
      id: String(recipe.id),
      source: 'Saved Recipe',
      card: recipe
    }));

    setRecipes(savedRecipes);

  } catch (error) {
    console.error('Error loading saved recipes:', error);
  }
}

  function handleRecipeUpdate(updatedCard) {
    if (!selectedRecipe) return;

    // An AI-edited recipe becomes a preview until explicitly saved.
    setPreviewRecipe({
      ...selectedRecipe,
      card: updatedCard,
    });
  }

  return (
    <>
      <header className="header">
        <button
          className="cookbook-button"
          type="button"
          aria-label="Open my cookbook"
          title="My cookbook"
          onClick={() => navigate('/cookbook')}
        >
          <img src="/cookbook.png" alt="" />
        </button>

        <h1 className="header__title">Let&apos;s Get Cooking!</h1>

        <button
          className="signin"
          type="button"
          disabled={isLoading}
          onClick={() => {
            if (isAuthenticated) {
              logout({
                logoutParams: {
                  returnTo: window.location.origin,
                },
              });
            } else {
              loginWithRedirect();
            }
          }}
        >
          <span className="signin__text">
            {isLoading
              ? 'Loading...'
              : isAuthenticated
                ? 'Sign out'
                : 'Sign in'}
          </span>

          <span className="signin__icon">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              aria-hidden="true"
            >
              <circle cx="12" cy="7" r="3.5" />
              <path d="M5 21v-3a7 7 0 0 1 14 0v3" />
            </svg>
          </span>
        </button>
      </header>

      {route === '/' && (
        <main className="home-page">
          <section className="card import-card">
            <h2>Add A New Recipe</h2>

            <form className="import-form" onSubmit={importRecipe}>
              <div className="link-row">
                <label htmlFor="recipe-url">Link:</label>

                <input
                  id="recipe-url"
                  type="url"
                  placeholder="Paste a recipe link here"
                  value={recipeUrl}
                  onChange={(event) => setRecipeUrl(event.target.value)}
                  disabled={loading}
                  required
                />

                <button
                  className="enter-button"
                  type="submit"
                  disabled={loading}
                >
                  {loading ? '...' : 'ENTER'}
                </button>
              </div>

              <div
                className="source-row"
                role="group"
                aria-label="Recipe type — select one"
              >
                <span>Type:</span>

                <div className="source-buttons">
                  {SOURCES.map((name) => (
                    <button
                      className="source-button"
                      type="button"
                      key={name}
                      aria-pressed={source === name}
                      disabled={loading}
                      onClick={() => {
                        setSource((current) =>
                          current === name ? '' : name
                        );
                        setStatus('');
                      }}
                    >
                      {name}
                    </button>
                  ))}
                </div>
              </div>

              <p className="import-status" role="status">
                {status}
              </p>
            </form>
          </section>

          <div className="home-panels">
            <section className="card home-panel">
              <h2>See What&apos;s Cooking</h2>
              <hr className="recipe-divider" />

              {recipes.length === 0 ? (
                <p className="empty-text">
                  Nothing yet. Add a recipe above!
                </p>
              ) : (
                <ul className="recent-list">
                  {recipes.slice(0, 3).map((recipe) => (
                    <li className="recent-item" key={recipe.id}>
                      <div>
                        <span className="recent-source">
                          {recipe.source}
                        </span>
                        <span className="recent-title">
                          {recipe.card.title}
                        </span>
                      </div>

                      <button
                        className="button small-button"
                        type="button"
                        onClick={() => openRecipe(recipe)}
                      >
                        view
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="card home-panel">
              <h2>Your Grocery List</h2>

              <p className="grocery-count">
                &mdash; {groceries.length}{' '}
                {groceries.length === 1 ? 'item' : 'items'} &mdash;
              </p>

              <div className="grocery-actions">
                <button
                  className="button"
                  type="button"
                  onClick={() => navigate('/groceries')}
                >
                  view list
                </button>

                <button
                  className="button"
                  type="button"
                  aria-expanded={addingItem}
                  aria-controls="add-grocery-form"
                  onClick={() => {
                    setAddingItem((open) => !open);
                    setItemStatus('');
                  }}
                >
                  {addingItem ? 'done' : 'add item'}
                </button>
              </div>

              {addingItem && (
                <form
                  id="add-grocery-form"
                  className="add-grocery-form"
                  onSubmit={addGrocery}
                >
                  <label htmlFor="grocery-name">New item</label>

                  <div className="add-grocery-row">
                    <input
                      id="grocery-name"
                      type="text"
                      placeholder="e.g. eggs"
                      value={itemName}
                      onChange={(event) => {
                        setItemName(event.target.value);
                        setItemStatus('');
                      }}
                      autoFocus
                      required
                    />

                    <button
                      className="button small-button"
                      type="submit"
                      disabled={!itemName.trim()}
                    >
                      Add
                    </button>
                  </div>

                  <p className="item-status" role="status">
                    {itemStatus}
                  </p>
                </form>
              )}
            </section>
          </div>
        </main>
      )}

      {route === '/groceries' && (
        <main className="detail-page grocery-page">
          <button
            className="button back-button"
            type="button"
            onClick={() => navigate('/')}
          >
            ← Back to home
          </button>

          <h2 className="page-title">Your Grocery List</h2>

          <section className="card grocery-sheet">
            {groceries.length === 0 ? (
              <p className="empty-text">Your grocery list is empty.</p>
            ) : (
              <>
                <p className="grocery-hint">
                  Check an item to remove it in 3 seconds.
                  Uncheck it to keep it.
                </p>

                <ul className="grocery-list">
                  {groceries.map((item) => (
                    <li key={item.id}>
                      <label
                        className={`grocery-check ${
                          item.checkedAt ? 'is-checked' : ''
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={Boolean(item.checkedAt)}
                          onChange={() => toggleGrocery(item.id)}
                        />
                        <span>{item.name}</span>
                      </label>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>
        </main>
      )}

      {route === '/cookbook' && (
        <main className="detail-page">
          <button
            className="button back-button"
            type="button"
            onClick={() => navigate('/')}
          >
            ← Back to home
          </button>

          {recipes.length === 0 ? (
            <p className="empty-text">Your cookbook is empty.</p>
          ) : (
            <div className="cookbook-grid">
              {recipes.map((recipe) => (
                <button
                  className="card cookbook-tile"
                  type="button"
                  key={recipe.id}
                  onClick={() => openRecipe(recipe)}
                >
                  <span className="cookbook-title">
                    {recipe.card.title}
                  </span>
                  <span className="cookbook-source">
                    {recipe.source}
                  </span>
                </button>
              ))}
            </div>
          )}
        </main>
      )}

      {recipeId && (
        <main className="detail-page">
          <button
            className="button back-button"
            type="button"
            onClick={() => navigate(recipeBackRoute)}
          >
            {recipeBackRoute === '/cookbook'
              ? '← Back to cookbook'
              : '← Back to home'}
          </button>

          {selectedRecipe ? (
            <>
              <h2 className="page-title">
                {selectedRecipe.card.title}
              </h2>

              <article className="card recipe-sheet">
                <div className="recipe-meta">
                  <span>
                    <strong>Prep:</strong>{' '}
                    {selectedRecipe.card.prepTime}
                  </span>
                  <span>
                    <strong>Cook:</strong>{' '}
                    {selectedRecipe.card.cookTime}
                  </span>
                  <span>
                    <strong>Servings:</strong>{' '}
                    {selectedRecipe.card.servings}
                  </span>
                </div>

                <h3>Ingredients</h3>
                <ul>
                  {selectedRecipe.card.ingredients?.map((item, index) => (
                    <li key={index}>{item}</li>
                  ))}
                </ul>

                <h3>Instructions</h3>
                <ol>
                  {selectedRecipe.card.instructions?.map((step, index) => (
                    <li key={index}>{step}</li>
                  ))}
                </ol>

                {isAuthenticated && previewRecipe?.id === selectedRecipe.id && (
                  <button
                    className="button"
                    type="button"
                    disabled={savingRecipe}
                    onClick={() => handleSaveRecipe(selectedRecipe.card)}
                  >
                    {savingRecipe ? 'Saving...' : 'Save Recipe'}
                  </button>
                )}
                {isAuthenticated && /^\d+$/.test(String(selectedRecipe.id)) && (
                <button
                   className="button"
                    type="button"
                    onClick={() => handleDeleteRecipe(selectedRecipe)}
                  >
                    Delete Recipe
                  </button>
                )}
                <RecipeChat
                currentRecipe={selectedRecipe.card}
                onUpdateRecipe={(updatedCard) => {
                  const variationName = window.prompt(
                    'What would you like to name this recipe variation?',
                    `${selectedRecipe.card.title} (Substitute)`
                  );

                  if (variationName === null) return;

                  const newRecipe = {
                    id: crypto.randomUUID(),
                    source: 'AI Substitute',
                    card: {
                      ...updatedCard,
                      title: variationName.trim() ||
                        `${selectedRecipe.card.title} (Substitute)`
                    }
                  };

                  setRecipes((items) => [newRecipe, ...items]);

                  setRecipeBackRoute('/cookbook');
                  navigate(`/recipe/${newRecipe.id}`);
                }}
              />

              </article>
            </>
          ) : (
            <p className="empty-text">This recipe could not be found.</p>
          )}
        </main>
      )}
    </>
  );
}

export default App;
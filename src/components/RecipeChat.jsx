// src/components/RecipeChat.jsx
import React, { useState } from 'react';
import { chatWithRecipeAssistant } from '../services/aiService';

export default function RecipeChat({ currentRecipe, onUpdateRecipe }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    { sender: 'chef', text: 'Hi! Need substitutions, dietary adjustments, or cooking tips for this recipe?' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [proposedRecipe, setProposedRecipe] = useState(null);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userText = input.trim();
    setInput('');
    setMessages((prev) => [...prev, { sender: 'user', text: userText }]);
    setLoading(true);

    try {
      const response = await chatWithRecipeAssistant(currentRecipe, userText);
      
      // Add chef reply to message history
      setMessages((prev) => [...prev, { sender: 'chef', text: response.reply }]);

      // If AI proposed a recipe change, store it so user can confirm
      if (response.updatedRecipe) {
        setProposedRecipe(response.updatedRecipe);
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { sender: 'chef', text: "Sorry, I ran into an issue answering that. Please try again!" }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleApplyChanges = () => {
    if (proposedRecipe) {
      onUpdateRecipe(proposedRecipe);
      setMessages((prev) => [
        ...prev,
        { sender: 'chef', text: '✅ Recipe card updated with the changes!' }
      ]);
      setProposedRecipe(null);
    }
  };

  const handleRejectChanges = () => {
    setProposedRecipe(null);
    setMessages((prev) => [
      ...prev,
      { sender: 'chef', text: 'No problem! Kept the original recipe card as is.' }
    ]);
  };

  return (
    <div style={styles.container}>
      {/* Floating Action Button */}
      <button 
        style={styles.fab} 
        onClick={() => setIsOpen(!isOpen)}
        title="Recipe Assistant"
      >
        {isOpen ? '❌' : '👨‍🍳'}
      </button>

      {/* Chat Box Panel */}
      {isOpen && (
        <div style={styles.chatWindow}>
          {/* Header */}
          <div style={styles.header}>
            <span style={{ fontSize: '1.2rem' }}>👨‍🍳 Sous-Chef AI</span>
            <button style={styles.closeBtn} onClick={() => setIsOpen(false)}>✕</button>
          </div>

          {/* Messages Container */}
          <div style={styles.messageList}>
            {messages.map((msg, idx) => (
              <div 
                key={idx} 
                style={{
                  ...styles.bubble,
                  alignSelf: msg.sender === 'user' ? 'flex-end' : 'flex-start',
                  backgroundColor: msg.sender === 'user' ? '#007bff' : '#f1f1f1',
                  color: msg.sender === 'user' ? '#fff' : '#333',
                }}
              >
                {msg.text}
              </div>
            ))}
            {loading && (
              <div style={{ ...styles.bubble, alignSelf: 'flex-start', backgroundColor: '#f1f1f1' }}>
                👨‍🍳 Thinking...
              </div>
            )}
          </div>

          {/* Confirmation Prompt Banner */}
          {proposedRecipe && (
            <div style={styles.proposalBanner}>
              <p style={{ margin: '0 0 6px 0', fontSize: '0.85rem', fontWeight: 'bold' }}>
                Update recipe card with these changes?
              </p>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button style={styles.approveBtn} onClick={handleApplyChanges}>Yes, Update</button>
                <button style={styles.rejectBtn} onClick={handleRejectChanges}>No, Keep</button>
              </div>
            </div>
          )}

          {/* Input Form */}
          <form onSubmit={handleSend} style={styles.inputArea}>
            <input
              type="text"
              placeholder="Ask about substitutions..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              style={styles.inputField}
            />
            <button type="submit" disabled={loading} style={styles.sendBtn}>
              Send
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

// Inline Styles for bottom-right corner positioning
const styles = {
  container: {
    position: 'fixed',
    bottom: '20px',
    right: '20px',
    zIndex: 1000,
  },
  fab: {
    width: '56px',
    height: '56px',
    borderRadius: '50%',
    backgroundColor: '#ff6b6b',
    border: 'none',
    boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
    cursor: 'pointer',
    fontSize: '24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatWindow: {
    position: 'absolute',
    bottom: '70px',
    right: '0',
    width: '320px',
    height: '420px',
    backgroundColor: '#ffffff',
    borderRadius: '12px',
    boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    border: '1px solid #eee',
  },
  header: {
    backgroundColor: '#ff6b6b',
    color: '#fff',
    padding: '12px 16px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontWeight: 'bold',
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: '#fff',
    fontSize: '16px',
    cursor: 'pointer',
  },
  messageList: {
    flex: 1,
    padding: '12px',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  bubble: {
    maxWidth: '80%',
    padding: '8px 12px',
    borderRadius: '16px',
    fontSize: '0.9rem',
    lineHeight: '1.3',
  },
  proposalBanner: {
    backgroundColor: '#fff3cd',
    borderTop: '1px solid #ffeeba',
    padding: '8px 12px',
  },
  approveBtn: {
    backgroundColor: '#28a745',
    color: '#fff',
    border: 'none',
    padding: '4px 8px',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '0.8rem',
  },
  rejectBtn: {
    backgroundColor: '#6c757d',
    color: '#fff',
    border: 'none',
    padding: '4px 8px',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '0.8rem',
  },
  inputArea: {
    display: 'flex',
    padding: '8px',
    borderTop: '1px solid #eee',
    backgroundColor: '#fff',
  },
  inputField: {
    flex: 1,
    padding: '8px',
    border: '1px solid #ccc',
    borderRadius: '4px',
    fontSize: '0.85rem',
  },
  sendBtn: {
    marginLeft: '6px',
    backgroundColor: '#ff6b6b',
    color: '#fff',
    border: 'none',
    padding: '8px 12px',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '0.85rem',
  },
};
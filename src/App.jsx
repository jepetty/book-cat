import { useState } from 'react';
import { getRandomBook } from './data/books';
import './App.css';

function App() {
  const [book, setBook] = useState(null);

  const handleRecommendBook = () => {
    const randomBook = getRandomBook();
    setBook(randomBook);
  };

  return (
    <div className="app">
      <div className="container">
        <h1>📚 Book Recommender</h1>
        <p className="subtitle">Discover Booker Prize winning and shortlisted books</p>
        
        <button className="recommend-btn" onClick={handleRecommendBook}>
          Recommend me a book!
        </button>

        {book && (
          <div className="book-card">
            <h2 className="book-title">{book.title}</h2>
            <p className="book-author">by {book.author}</p>
            <div className="book-details">
              <span className={`status ${book.status.toLowerCase()}`}>
                {book.status}
              </span>
              <span className="year">{book.year}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;

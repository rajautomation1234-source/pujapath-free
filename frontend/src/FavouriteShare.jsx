import React, { useEffect, useState } from "react";

const FAVORITES_KEY = "pujapath_favorite_pandals";

function FavouriteShare({ pandals = [], onClose }) {
  const [favoriteIds, setFavoriteIds] = useState([]);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const loadFavorites = () => {
      try {
        const saved = localStorage.getItem(FAVORITES_KEY);

        if (!saved) {
          setFavoriteIds([]);
          return;
        }

        const parsed = JSON.parse(saved);

        if (Array.isArray(parsed)) {
  // Supports array format
  setFavoriteIds(parsed.map(String));
} else if (
  parsed &&
  typeof parsed === "object"
) {
  // Supports the format used by Checklist.jsx
  const activeFavorites = Object.keys(parsed).filter(
    (id) => parsed[id] === true
  );

  setFavoriteIds(activeFavorites.map(String));
} else {
  setFavoriteIds([]);
}
      } catch (error) {
        console.error("Failed to load favourites:", error);
        setFavoriteIds([]);
      }
    };

    loadFavorites();

    const interval = setInterval(loadFavorites, 1000);

    const handleStorageChange = () => {
      loadFavorites();
    };

    window.addEventListener("storage", handleStorageChange);

    return () => {
      clearInterval(interval);
      window.removeEventListener(
        "storage",
        handleStorageChange
      );
    };
  }, []);

  const favoritePandals = pandals.filter((pandal) =>
    favoriteIds.includes(String(pandal.id))
  );

  const shareText =
    favoritePandals.length > 0
      ? [
          "❤️ My Favourite Puja Pandals",
          "",
          ...favoritePandals.map(
            (pandal, index) =>
              `${index + 1}. ${pandal.name}`
          ),
          "",
          "📍 PujaPath Live",
        ].join("\n")
      : "❤️ My Favourite Puja Pandals\n\nNo favourite pandals added yet.";

  const shareList = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: "My Favourite Puja Pandals",
          text: shareText,
        });

        return;
      }

      await navigator.clipboard.writeText(shareText);

      setCopied(true);

      setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch (error) {
      console.error("Share cancelled or failed:", error);
    }
  };

  const copyList = async () => {
    try {
      await navigator.clipboard.writeText(shareText);

      setCopied(true);

      setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch (error) {
      console.error("Copy failed:", error);

      // Fallback for browsers where clipboard API is unavailable
      try {
        const textarea = document.createElement("textarea");

        textarea.value = shareText;
        textarea.style.position = "absolute";
        textarea.style.left = "-9999px";

        document.body.appendChild(textarea);
        textarea.select();

        document.execCommand("copy");
        document.body.removeChild(textarea);

        setCopied(true);

        setTimeout(() => {
          setCopied(false);
        }, 2000);
      } catch (fallbackError) {
        console.error(
          "Clipboard fallback failed:",
          fallbackError
        );
      }
    }
  };

  return (
    <div className="favourite-share-overlay">
      <div className="favourite-share-card">
        {/* Header */}

        <div className="favourite-share-header">
          <div>
            <h2>❤️ Share Favourite List</h2>

            <p>
              Share your favourite Puja pandals with
              friends and family.
            </p>
          </div>

          <button
            type="button"
            className="favourite-share-close"
            onClick={onClose}
            aria-label="Close favourite share"
          >
            ✕
          </button>
        </div>

        {/* Count */}

        <div className="favourite-share-summary">
          <div className="favourite-share-summary-icon">
            ❤️
          </div>

          <div>
            <strong>
              {favoritePandals.length}
            </strong>

            <span>
              Favourite{" "}
              {favoritePandals.length === 1
                ? "Pandal"
                : "Pandals"}
            </span>
          </div>
        </div>

        {/* Empty State */}

        {favoritePandals.length === 0 ? (
          <div className="favourite-share-empty">
            <div className="favourite-share-empty-icon">
              💔
            </div>

            <h3>No Favourite Pandals Yet</h3>

            <p>
              Open the Pandal Checklist and tap the ❤️
              button on pandals you love.
            </p>
          </div>
        ) : (
          <>
            {/* Favourite list */}

            <div className="favourite-share-list">
              {favoritePandals.map(
                (pandal, index) => (
                  <div
                    className="favourite-share-item"
                    key={pandal.id}
                  >
                    <div className="favourite-share-number">
                      {index + 1}
                    </div>

                    <div className="favourite-share-info">
                      <strong>
                        {pandal.name}
                      </strong>

                      {pandal.zone && (
                        <small>
                          📍 {pandal.zone}
                        </small>
                      )}

                      {pandal.address && (
                        <small>
                          {pandal.address}
                        </small>
                      )}
                    </div>

                    <div className="favourite-heart">
                      ❤️
                    </div>
                  </div>
                )
              )}
            </div>

            {/* Preview */}

            <div className="favourite-share-preview">
              <div className="favourite-share-preview-title">
                📤 Share Preview
              </div>

              <pre>{shareText}</pre>
            </div>
          </>
        )}

        {/* Actions */}

        <div className="favourite-share-actions">
          <button
            type="button"
            className="favourite-share-main-button"
            onClick={shareList}
          >
            📤 Share List
          </button>

          <button
            type="button"
            className="favourite-share-copy-button"
            onClick={copyList}
          >
            {copied ? "✅ Copied!" : "📋 Copy List"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default FavouriteShare;
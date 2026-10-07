import React, { useEffect, useState } from "react";
import "./Checklist.css";

const STORAGE_KEY = "pujapath_visited_pandals";
const FAVORITES_STORAGE_KEY = "pujapath_favorite_pandals";

const zones = [
  "North Kolkata",
  "Central Kolkata",
  "South Kolkata",
];

export default function Checklist({ pandals = [], onClose }) {
 const [visited, setVisited] = useState({});
const [favorites, setFavorites] = useState({});
const [showPandalList, setShowPandalList] = useState(false);
const [favoriteOnly, setFavoriteOnly] = useState(false);
const [searchTerm, setSearchTerm] = useState("");
const [unvisitedOnly, setUnvisitedOnly] = useState(false);
const [notes, setNotes] = useState({});
  // Load saved visited pandals
  useEffect(() => {
  try {
    const savedVisited = localStorage.getItem(STORAGE_KEY);
    const savedFavorites = localStorage.getItem(FAVORITES_STORAGE_KEY);
    const savedNotes = localStorage.getItem("pujapath_pandal_notes");

    if (savedVisited) {
      setVisited(JSON.parse(savedVisited));
    }

    if (savedFavorites) {
      setFavorites(JSON.parse(savedFavorites));
    }
    if (savedNotes) {
  setNotes(JSON.parse(savedNotes));
}
  } catch (error) {
    console.error("Could not load checklist:", error);
  }
}, []);

  const getPandalId = (pandal) => {
    return pandal.id ?? pandal._id ?? pandal.name;
  };

  const getPandalName = (pandal) => {
    return (
      pandal.name ??
      pandal.pandal_name ??
      pandal.title ??
      "Unnamed Pandal"
    );
  };

  const getPandalZone = (pandal) => {
    return (
      pandal.zone ??
      pandal.category ??
      pandal.area ??
      ""
    );
  };

  const getZonePandals = (zone) => {
    return pandals.filter(
      (pandal) =>
        getPandalZone(pandal).toLowerCase() === zone.toLowerCase()
    );
  };

  const toggleVisited = (pandalId) => {
    setVisited((previous) => {
      const updated = {
        ...previous,
        [pandalId]: !previous[pandalId],
      };

      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(updated)
      );

      return updated;
    });
  };
  const toggleFavorite = (pandalId) => {
  setFavorites((previous) => {
    const updated = {
      ...previous,
      [pandalId]: !previous[pandalId],
    };

    localStorage.setItem(
      FAVORITES_STORAGE_KEY,
      JSON.stringify(updated)
    );

    return updated;
  });
};
const saveNote = (pandalId, noteText) => {
  setNotes((previous) => {
    const updated = {
      ...previous,
      [pandalId]: noteText,
    };

    localStorage.setItem(
      "pujapath_pandal_notes",
      JSON.stringify(updated)
    );

    return updated;
  });
};
  const totalPandals = pandals.length;

  const totalVisited = pandals.filter(
    (pandal) => visited[getPandalId(pandal)]
  ).length;

  const totalRemaining = totalPandals - totalVisited;
  const totalFavorites = pandals.filter(
  (pandal) => favorites[getPandalId(pandal)]
).length;
const filteredPandals = pandals.filter((pandal) => {
  const matchesFavorite =
    !favoriteOnly || favorites[getPandalId(pandal)];

  const matchesUnvisited =
    !unvisitedOnly || !visited[getPandalId(pandal)];

  const matchesSearch =
    getPandalName(pandal)
      .toLowerCase()
      .includes(searchTerm.toLowerCase());

  return (
    matchesFavorite &&
    matchesUnvisited &&
    matchesSearch
  );
});
  const progress =
    totalPandals > 0
      ? Math.round((totalVisited / totalPandals) * 100)
      : 0;
  const achievements = [
  {
    id: "first",
    icon: "🌱",
    title: "First Pandal",
    description: "Visit your first pandal",
    required: 1,
  },
  {
    id: "ten",
    icon: "🎉",
    title: "Pandal Explorer",
    description: "Visit 10 pandals",
    required: 10,
  },
  {
    id: "twentyFive",
    icon: "🏆",
    title: "Puja Explorer",
    description: "Visit 25 pandals",
    required: 25,
  },
  {
    id: "halfway",
    icon: "🔥",
    title: "Halfway There",
    description: "Visit 54 pandals",
    required: 54,
  },
  {
    id: "master",
    icon: "👑",
    title: "Durga Puja Master",
    description: "Visit all 108 pandals",
    required: 108,
  },
];
  return (
    <div className="checklist-page">
      <button
  type="button"
  className="checklist-back-button"
  onClick={onClose}
>
  ← Back to App
</button>
      {/* Header */}
      <div className="checklist-page-header">
        <h1>🪔 Durga Puja Pandal Checklist</h1>

        <p>
          Tick the Pandals you have visited to create your personal checklist
        </p>
      </div>

      {/* Open Checklist Button */}
      <div className="checklist-open-area">
        <button
          className="open-checklist-button"
          onClick={() => setShowPandalList(true)}
        >
          📋 Open Pandal Checklist
        </button>
      </div>

      {/* Statistics */}
      <div className="checklist-stats">

        <div className="stat-card">
          <span>Total Pandals</span>
          <strong>{totalPandals}</strong>
        </div>

        <div className="stat-card">
          <span>Visited</span>
          <strong>{totalVisited}</strong>
        </div>

        <div className="stat-card">
          <span>Remaining</span>
          <strong>{totalRemaining}</strong>
        </div>

        <div className="stat-card">
          <span>Progress</span>
          <strong>{progress}%</strong>
        </div>
        <div className="stat-card">
  <span>❤️ Favorites</span>
  <strong>{totalFavorites}</strong>
</div>
      </div>

      {/* Zone cards */}
      <div className="zone-summary-grid">
        {zones.map((zone) => {
          const zonePandals = getZonePandals(zone);

          const zoneVisited = zonePandals.filter(
            (pandal) => visited[getPandalId(pandal)]
          ).length;

          const zoneUnvisited =
            zonePandals.length - zoneVisited;

          const zoneProgress =
            zonePandals.length > 0
              ? Math.round(
                  (zoneVisited / zonePandals.length) * 100
                )
              : 0;

          return (
            <div
              className="zone-summary-card"
              key={zone}
            >
              <h2>📍 {zone}</h2>

              <p>
                Visited: <strong>{zoneVisited}</strong>
              </p>

              <p>
                Unvisited: <strong>{zoneUnvisited}</strong>
              </p>

              <div className="progress-bar">
                <div
                  className="progress-fill"
                  style={{
                    width: `${zoneProgress}%`,
                  }}
                />
              </div>

              <small>
                {zoneProgress}% complete
              </small>
            </div>
          );
        })}

      </div>
      {/* Achievements */}
<div className="achievements-section">

  <div className="achievements-header">
    <h2>🏆 Achievements</h2>

    <p>
      Unlock badges by visiting more pandals
    </p>
  </div>

  <div className="achievements-grid">

    {achievements.map((achievement) => {
      const unlocked =
        totalVisited >= achievement.required;

      return (
        <div
          className={`achievement-card ${
            unlocked ? "unlocked" : "locked"
          }`}
          key={achievement.id}
        >

          <div className="achievement-icon">
            {unlocked ? achievement.icon : "🔒"}
          </div>

          <div className="achievement-info">

            <h3>
              {achievement.title}
            </h3>

            <p>
              {achievement.description}
            </p>

            <span>
              {totalVisited} / {achievement.required}
            </span>

          </div>

        </div>
      );
    })}

  </div>

</div>

      {/* Pandal checklist */}
      {showPandalList && (
        <div className="pandal-list-screen">

          <div className="pandal-list-header">
            <button
              className="back-checklist-button"
              onClick={() => setShowPandalList(false)}
            >
              ← Back
            </button>

            <h2>📋 Pandal Checklist</h2>

            <button
              className="close-checklist-button"
              onClick={onClose}
            >
              ×
            </button>
          </div>

          <div className="pandal-list-content">
            <div className="pandal-search">
  <input
    type="text"
    placeholder="🔎 Search pandals..."
    value={searchTerm}
    onChange={(event) => setSearchTerm(event.target.value)}
  />

  {searchTerm && (
    <button
      type="button"
      onClick={() => setSearchTerm("")}
      title="Clear search"
    >
      ×
    </button>
  )}
</div>
         <div className="favorite-filter">

  <button
    type="button"
    className={
      !favoriteOnly && !unvisitedOnly
        ? "filter-active"
        : ""
    }
    onClick={() => {
      setFavoriteOnly(false);
      setUnvisitedOnly(false);
    }}
  >
    📋 All Pandals
  </button>

  <button
    type="button"
    className={
      unvisitedOnly ? "filter-active" : ""
    }
    onClick={() => {
      setFavoriteOnly(false);
      setUnvisitedOnly(true);
    }}
  >
    ⭕ Unvisited
  </button>

  <button
    type="button"
    className={
      favoriteOnly ? "filter-active" : ""
    }
    onClick={() => {
      setUnvisitedOnly(false);
      setFavoriteOnly(true);
    }}
  >
    ❤️ Favorites ({totalFavorites})
  </button>

</div>
{favoriteOnly && totalFavorites === 0 && (
  <div className="no-favorites">
    <div className="no-favorites-icon">
      ❤️
    </div>

    <h3>No Favorite Pandals Yet</h3>

    <p>
      Tap the 🤍 icon beside any pandal
      to add it to your favorites.
    </p>

    <button
      type="button"
      onClick={() => setFavoriteOnly(false)}
    >
      📋 View All Pandals
    </button>
  </div>
)}

{searchTerm.trim() && filteredPandals.length === 0 && !(favoriteOnly && totalFavorites === 0) && (
  <div className="no-favorites">
    <div className="no-favorites-icon">
      🔎
    </div>

    <h3>No Pandals Found</h3>

    <p>
      No pandal matches your search.
      Try a different name.
    </p>

    <button
      type="button"
      onClick={() => setSearchTerm("")}
    >
      ✕ Clear Search
    </button>
  </div>
)}

{zones.map((zone) => {
 const zonePandals = getZonePandals(zone).filter(
  (pandal) => {
    const matchesFavorite =
      !favoriteOnly || favorites[getPandalId(pandal)];

    const matchesUnvisited =
      !unvisitedOnly || !visited[getPandalId(pandal)];

    const matchesSearch =
      getPandalName(pandal)
        .toLowerCase()
        .includes(searchTerm.toLowerCase());

    return (
      matchesFavorite &&
      matchesUnvisited &&
      matchesSearch
    );
  }
);

  if (
  (favoriteOnly || searchTerm.trim()) &&
  zonePandals.length === 0
) {
  return null;
}

              const zoneVisited = zonePandals.filter(
                (pandal) => visited[getPandalId(pandal)]
              ).length;

              const zoneUnvisited =
                zonePandals.length - zoneVisited;

              return (
                <section
                  className="checklist-zone"
                  key={zone}
                >

                  <div className="checklist-zone-header">

                    <div>
                      <h3>{zone}</h3>

                      <div className="checklist-counts">
                        <span className="visited-count">
                          ✓ Visited: {zoneVisited}
                        </span>

                        <span className="unvisited-count">
                          ○ Unvisited: {zoneUnvisited}
                        </span>
                      </div>
                    </div>

                    <span className="zone-total">
                      {zonePandals.length} pandals
                    </span>

                  </div>

                  <div className="checklist-list">

                    {zonePandals.map((pandal) => {
                      const id = getPandalId(pandal);
                      const isVisited = !!visited[id];

                      return (
                        <label
                          className={`checklist-item ${
                            isVisited ? "is-visited" : ""
                          }`}
                          key={id}
                        >

                          <input
                            type="checkbox"
                            checked={isVisited}
                            onChange={() =>
                              toggleVisited(id)
                            }
                          />

                          <span className="checklist-checkbox">
                            {isVisited ? "✓" : ""}
                          </span>

                          <span className="checklist-name">
                            {getPandalName(pandal)}
                          </span>
                          <div className="pandal-note">
  <textarea
    placeholder="📝 Add a note..."
    value={notes[id] || ""}
    onChange={(event) =>
      saveNote(id, event.target.value)
    }
    onClick={(event) => {
      event.stopPropagation();
    }}
  />
</div>
                            <button
  type="button"
  className={`favorite-button ${
    favorites[id] ? "is-favorite" : ""
  }`}
  onClick={(event) => {
    event.preventDefault();
    event.stopPropagation();
    toggleFavorite(id);
  }}
  title={
    favorites[id]
      ? "Remove from favorites"
      : "Add to favorites"
  }
>
  {favorites[id] ? "❤️" : "🤍"}
</button>
                        </label>
                      );
                    })}

                  </div>

                </section>
              );
            })}

          </div>
        </div>
      )}

    </div>
  );
}
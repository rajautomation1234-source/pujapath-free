
import React, { useState } from "react";
import "./Settings.css";

export default function Settings({ onBack }) {
  const [showClearModal, setShowClearModal] = useState(false);
  const [clearing, setClearing] = useState(false);

  function clearPujaData() {
    setClearing(true);

    try {
      const keysToRemove = [];

      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);

        if (key && key.startsWith("pujapath_")) {
          keysToRemove.push(key);
        }
      }

      keysToRemove.forEach((key) => localStorage.removeItem(key));

      setShowClearModal(false);
      window.location.reload();
    } catch (error) {
      console.error("Unable to clear Puja data:", error);
      window.alert("Could not clear your data. Please try again.");
      setClearing(false);
    }
  }

  return (
    <main className="puja-settings">
      <header className="settings-header">
        <button
          className="settings-back"
          onClick={() => {
  onBack();
  window.scrollTo({ top: 0, behavior: "auto" });
}}
          type="button"
        >
          ← Back
        </button>

        <h1>Settings</h1>
        <p>Manage your PujaPath experience</p>
      </header>

      {/* CLEAR PUJA DATA — NOW FIRST */}
      <section className="settings-card danger-card">
        <div className="settings-icon">🗑️</div>

        <div className="settings-card-content">
          <h2>Clear Puja Data</h2>

          <p>
            Remove saved checklist, favorites, planner and
            other browser data stored with the PujaPath prefix.
          </p>

          <button
            type="button"
            className="clear-puja-button"
            onClick={() => setShowClearModal(true)}
          >
            Clear Puja Data
          </button>
        </div>
      </section>

      {/* GENERAL SETTINGS — NOW BELOW */}
      <section className="settings-card">
        <div className="settings-icon">⚙️</div>

        <div className="settings-card-content">
          <h2>General Settings</h2>
          <p>Manage your PujaPath preferences here.</p>
        </div>
      </section>

      {/* EXISTING YES / NO CONFIRMATION MODAL */}
      {showClearModal && (
        <div
          className="puja-modal-overlay"
          onMouseDown={(event) => {
            if (
              event.target === event.currentTarget &&
              !clearing
            ) {
              setShowClearModal(false);
            }
          }}
        >
          <section
            className="puja-confirm-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="clear-modal-title"
          >
            <div className="puja-modal-icon">🗑️</div>

            <h2 id="clear-modal-title">Are you sure?</h2>

            <p>
              This will delete saved PujaPath browser data.
              This action cannot be undone.
            </p>

            <div className="puja-modal-actions">
              <button
                type="button"
                className="keep-data-button"
                disabled={clearing}
                onClick={() => setShowClearModal(false)}
              >
                No, Keep My Data
              </button>

              <button
                type="button"
                className="confirm-clear-button"
                disabled={clearing}
                onClick={clearPujaData}
              >
                {clearing
                  ? "Clearing..."
                  : "Yes, Clear Data"}
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

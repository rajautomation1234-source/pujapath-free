
import React, { useState } from "react";
import "./ProfileMenu.css";

export default function ProfileMenu({
  user,
  onOpenSettings,
  onSignOut,
}) {
  const [open, setOpen] = useState(false);

  const email = user?.email || "";
  const initial = email ? email[0].toUpperCase() : "U";

  return (
    <div className="profile-menu">
      <button
        type="button"
        className="profile-avatar"
        aria-label="Open profile menu"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        {initial}
      </button>

      <button
        type="button"
        className="profile-dots"
        aria-label="More options"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        ⋮
      </button>

      {open && (
        <>
          <button
            className="profile-menu-backdrop"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
          />

          <div className="profile-dropdown">
            <div className="profile-summary">
              <div className="profile-avatar small">
                {initial}
              </div>
              <div>
                <strong>Your Profile</strong>
                <p>{email || "PujaPath user"}</p>
              </div>
            </div>

            <button
              type="button"
              className="profile-menu-item"
              onClick={() => {
                setOpen(false);
                onOpenSettings();
              }}
            >
              <span>⚙️</span>
              <span>
                <strong>Settings</strong>
                <small>Preferences and data management</small>
              </span>
            </button>

            <button
              type="button"
              className="profile-menu-item"
              onClick={() => {
                setOpen(false);
                window.alert("Help & Support coming soon.");
              }}
            >
              <span>❔</span>
              <span>
                <strong>Help &amp; Support</strong>
                <small>Get help using PujaPath</small>
              </span>
            </button>

            <button
              type="button"
              className="profile-menu-item logout"
              onClick={onSignOut}
            >
              <span>↪</span>
              <strong>Sign out</strong>
            </button>
          </div>
        </>
      )}
    </div>
  );
}

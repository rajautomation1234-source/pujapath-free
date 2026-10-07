import React, { useEffect, useState } from "react";

const VISITED_KEY = "pujapath_visited_pandals";
const ZONE_BADGE_KEY = "pujapath_zone_badge_dates";

function ZoneBadge({ pandals = [] }) {
  const [visitedIds, setVisitedIds] = useState([]);
  const [badgeDates, setBadgeDates] = useState({});

  useEffect(() => {
    const loadData = () => {
      try {
        // Load visited pandals
        const savedVisited =
  localStorage.getItem(VISITED_KEY);

if (savedVisited) {
  const parsedVisited = JSON.parse(savedVisited);

  if (Array.isArray(parsedVisited)) {
    // Array format
    setVisitedIds(parsedVisited.map(String));
  } else if (
    parsedVisited &&
    typeof parsedVisited === "object"
  ) {
    // Checklist-এর object format
    const activeVisitedIds = Object.keys(
      parsedVisited
    ).filter(
      (id) => parsedVisited[id] === true
    );

    setVisitedIds(
      activeVisitedIds.map(String)
    );
  } else {
    setVisitedIds([]);
  }
} else {
  setVisitedIds([]);
}

        // Load already-earned zone badge dates
        const savedDates =
          localStorage.getItem(ZONE_BADGE_KEY);

        if (savedDates) {
          const parsedDates = JSON.parse(savedDates);

          if (
            parsedDates &&
            typeof parsedDates === "object"
          ) {
            setBadgeDates(parsedDates);
          }
        }
      } catch (error) {
        console.error(
          "Failed to load zone badge data:",
          error
        );
      }
    };

    loadData();

    // Keep badge status updated
    const interval = setInterval(loadData, 1000);

    const handleStorageChange = () => {
      loadData();
    };

    window.addEventListener(
      "storage",
      handleStorageChange
    );

    return () => {
      clearInterval(interval);

      window.removeEventListener(
        "storage",
        handleStorageChange
      );
    };
  }, []);

  // Group pandals by zone
  const zones = {};

  pandals.forEach((pandal) => {
    const zone = pandal.zone || "Other";

    if (!zones[zone]) {
      zones[zone] = {
        total: 0,
        visited: 0,
      };
    }

    zones[zone].total += 1;

    if (visitedIds.includes(String(pandal.id))) {
      zones[zone].visited += 1;
    }
  });

  /*
   * Check whether a zone is complete.
   * Complete means:
   *
   * visited === total
   */
  const isZoneComplete = (zoneData) => {
    return (
      zoneData.total > 0 &&
      zoneData.visited === zoneData.total
    );
  };

  /*
   * Save the date when a zone becomes complete
   */
  useEffect(() => {
    if (Object.keys(zones).length === 0) {
      return;
    }

    const updatedDates = {
      ...badgeDates,
    };

    let changed = false;

    Object.entries(zones).forEach(
      ([zoneName, zoneData]) => {
        const completed = isZoneComplete(zoneData);

        if (
          completed &&
          !updatedDates[zoneName]
        ) {
          updatedDates[zoneName] =
            new Date().toISOString().split("T")[0];

          changed = true;
        }
      }
    );

    if (changed) {
      setBadgeDates(updatedDates);

      localStorage.setItem(
        ZONE_BADGE_KEY,
        JSON.stringify(updatedDates)
      );
    }
  }, [pandals, visitedIds, badgeDates]);

  const getBadgeIcon = (zoneName) => {
    const name = zoneName.toLowerCase();

    if (name.includes("north")) {
      return "🏯";
    }

    if (name.includes("central")) {
      return "🪔";
    }

    if (name.includes("south")) {
      return "🎡";
    }

    return "🏆";
  };

  const zoneEntries = Object.entries(zones);

  return (
    <section className="zone-badge-card">
      <div className="zone-badge-header">
        <div>
          <h2>🏆 Zone Badges</h2>

          <p>
            Complete every pandal in a zone to unlock
            its badge.
          </p>
        </div>
      </div>

      {zoneEntries.length === 0 ? (
        <div className="zone-badge-empty">
          No zone data available.
        </div>
      ) : (
        <div className="zone-badge-grid">
          {zoneEntries.map(
            ([zoneName, zoneData]) => {
              const completed =
                isZoneComplete(zoneData);

              const badgeDate =
                badgeDates[zoneName];

              return (
                <div
                  key={zoneName}
                  className={`zone-achievement ${
                    completed
                      ? "zone-achievement-unlocked"
                      : "zone-achievement-locked"
                  }`}
                >
                  {/* Badge */}
                  <div className="zone-medal">
                    <div className="zone-medal-inner">
                      <span className="zone-medal-icon">
                        {completed
                          ? getBadgeIcon(zoneName)
                          : "🔒"}
                      </span>

                      <span className="zone-medal-count">
                        {zoneData.visited}/
                        {zoneData.total}
                      </span>
                    </div>
                  </div>

                  {/* Name */}
                  <h3>
                    {zoneName}
                  </h3>

                  {/* Description */}
                  <p>
                    {completed
                      ? "All pandals completed"
                      : `Visit all ${zoneData.total} pandals`}
                  </p>

                  {/* Status */}
                  {completed ? (
                    <div className="zone-earned">
                      ✅ Badge Earned
                    </div>
                  ) : (
                    <div className="zone-locked">
                      🔒 {zoneData.visited}/
                      {zoneData.total} visited
                    </div>
                  )}

                  {/* Date */}
                  {completed && badgeDate && (
                    <small>
                      Earned {badgeDate}
                    </small>
                  )}
                </div>
              );
            }
          )}
        </div>
      )}
    </section>
  );
}

export default ZoneBadge;
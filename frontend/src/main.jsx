import React, {
  useEffect,
  useRef,
  useState
} from 'react';

import Checklist from "./Checklist";
import PujaPlanner from "./PujaPlanner";
import BudgetTracker from "./BudgetTracker";
import WeatherCard from "./WeatherCard";
import ZoneBadge from "./ZoneBadge";
import FavouriteShare from "./FavouriteShare";
import InfoPage from "./InfoPage";
import { createRoot } from 'react-dom/client';
import { createClient } from '@supabase/supabase-js';

import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete L.Icon.Default.prototype._getIconUrl;

L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow
});

import './style.css';

/* =========================================================
   GENERAL HELPERS
========================================================= */

function getDistanceKm(
  lat1,
  lon1,
  lat2,
  lon2
) {
  const R = 6371;

  const dLat =
    ((lat2 - lat1) * Math.PI) / 180;

  const dLon =
    ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(
      (lat1 * Math.PI) / 180
    ) *
      Math.cos(
        (lat2 * Math.PI) / 180
      ) *
      Math.sin(dLon / 2) ** 2;

  const c =
    2 *
    Math.atan2(
      Math.sqrt(a),
      Math.sqrt(1 - a)
    );

  return R * c;
}

/* =========================================================
   REALISTIC WALKING ETA
========================================================= */

const WALKING_SPEED_KMH = 4.5;

function getWalkingDurationSeconds(
  distanceMeters
) {
  const distance = Math.max(
    0,
    Number(distanceMeters) || 0
  );

  if (distance <= 0) {
    return 0;
  }

  const metersPerSecond =
    (WALKING_SPEED_KMH * 1000) /
    3600;

  return (
    distance /
    metersPerSecond
  );
}

function formatDuration(seconds) {
  const safeSeconds =
    Math.max(
      0,
      Number(seconds) || 0
    );

  const totalMinutes =
    Math.ceil(
      safeSeconds / 60
    );

  const hours =
    Math.floor(
      totalMinutes / 60
    );

  const minutes =
    totalMinutes % 60;

  if (hours > 0) {
    return `${hours} hr ${minutes} min`;
  }

  return `${minutes} min`;
}

/* =========================================================
   NAVIGATION INSTRUCTIONS
========================================================= */

function getNavigationInstruction(step) {
  const maneuver =
    step?.maneuver || {};

  const type =
    maneuver.type || '';

  const modifier =
    maneuver.modifier || '';

  if (type === 'depart') {
    return '🟢 Start walking';
  }

  if (type === 'arrive') {
    return '🎉 You have arrived';
  }

  if (type === 'turn') {
    if (
      modifier === 'left'
    ) {
      return '↰ Turn left';
    }

    if (
      modifier === 'right'
    ) {
      return '↱ Turn right';
    }

    if (
      modifier === 'sharp left'
    ) {
      return '↙️ Sharp left';
    }

    if (
      modifier === 'sharp right'
    ) {
      return '↘️ Sharp right';
    }

    if (
      modifier === 'slight left'
    ) {
      return '↖️ Slight left';
    }

    if (
      modifier === 'slight right'
    ) {
      return '↗️ Slight right';
    }
  }

  if (type === 'continue') {
    return '⬆️ Continue straight';
  }

  if (type === 'merge') {
    return '🔀 Merge';
  }

  if (type === 'fork') {
    if (
      modifier === 'left'
    ) {
      return '↖️ Keep left';
    }

    if (
      modifier === 'right'
    ) {
      return '↗️ Keep right';
    }

    return '⬆️ Keep straight';
  }

  if (
    type === 'roundabout' ||
    type === 'rotary'
  ) {
    return '🔄 Enter roundabout';
  }

  return '⬆️ Continue';
}

/* =========================================================
   ANGLE HELPERS
========================================================= */

function normalizeAngle(deg) {
  return (
    ((deg % 360) + 360) %
    360
  );
}

function shortestAngleDelta(
  from,
  to
) {
  let delta =
    normalizeAngle(to) -
    normalizeAngle(from);

  if (delta > 180) {
    delta -= 360;
  }

  if (delta < -180) {
    delta += 360;
  }

  return delta;
}

function circularMean(
  degrees
) {
  if (
    !Array.isArray(degrees) ||
    degrees.length === 0
  ) {
    return null;
  }

  let sinSum = 0;
  let cosSum = 0;

  degrees.forEach(
    (degree) => {
      const radians =
        (normalizeAngle(
          degree
        ) *
          Math.PI) /
        180;

      sinSum += Math.sin(
        radians
      );

      cosSum += Math.cos(
        radians
      );
    }
  );

  return normalizeAngle(
    (Math.atan2(
      sinSum / degrees.length,
      cosSum / degrees.length
    ) *
      180) /
      Math.PI
  );
}

/* =========================================================
   BEARING
========================================================= */

function getBearingDegrees(
  lat1,
  lon1,
  lat2,
  lon2
) {
  const y =
    Math.sin(
      ((lon2 - lon1) *
        Math.PI) /
        180
    ) *
    Math.cos(
      (lat2 * Math.PI) / 180
    );

  const x =
    Math.cos(
      (lat1 * Math.PI) / 180
    ) *
      Math.sin(
        (lat2 * Math.PI) / 180
      ) -
    Math.sin(
      (lat1 * Math.PI) / 180
    ) *
      Math.cos(
        (lat2 * Math.PI) / 180
      ) *
      Math.cos(
        ((lon2 - lon1) *
          Math.PI) /
          180
      );

  return normalizeAngle(
    (Math.atan2(y, x) *
      180) /
      Math.PI
  );
}

/* =========================================================
   LOCAL XY
========================================================= */

function getLocalXY(
  lat,
  lon,
  refLat
) {
  const metersPerDegreeLat =
    111320;

  const metersPerDegreeLon =
    111320 *
    Math.cos(
      (refLat * Math.PI) /
        180
    );

  return {
    x:
      lon *
      metersPerDegreeLon,

    y:
      lat *
      metersPerDegreeLat
  };
}

/* =========================================================
   CLOSEST POINT ON SEGMENT
========================================================= */

function closestPointOnSegment(
  lat,
  lon,
  aLat,
  aLon,
  bLat,
  bLon
) {
  const refLat =
    (lat +
      aLat +
      bLat) /
    3;

  const p =
    getLocalXY(
      lat,
      lon,
      refLat
    );

  const a =
    getLocalXY(
      aLat,
      aLon,
      refLat
    );

  const b =
    getLocalXY(
      bLat,
      bLon,
      refLat
    );

  const abx =
    b.x - a.x;

  const aby =
    b.y - a.y;

  const apx =
    p.x - a.x;

  const apy =
    p.y - a.y;

  const ab2 =
    abx * abx +
    aby * aby;

  const t =
    ab2 > 0
      ? Math.max(
          0,
          Math.min(
            1,
            (apx * abx +
              apy * aby) /
              ab2
          )
        )
      : 0;

  const x =
    a.x + abx * t;

  const y =
    a.y + aby * t;

  const dx =
    p.x - x;

  const dy =
    p.y - y;

  return {
    lat:
      aLat +
      (bLat - aLat) * t,

    lon:
      aLon +
      (bLon - aLon) * t,

    distanceMeters:
      Math.sqrt(
        dx * dx + dy * dy
      ),

    t
  };
}

/* =========================================================
   CLOSEST POINT ON COMPLETE ROUTE
========================================================= */

function getClosestPointOnRoute(
  lat,
  lon,
  coordinates
) {
  if (
    !Array.isArray(
      coordinates
    ) ||
    coordinates.length < 2
  ) {
    return null;
  }

  let best = null;

  let distanceBeforeSegment =
    0;

  for (
    let i = 0;
    i <
      coordinates.length - 1;
    i += 1
  ) {
    const a =
      coordinates[i];

    const b =
      coordinates[i + 1];

    const segment =
      closestPointOnSegment(
        lat,
        lon,
        a[1],
        a[0],
        b[1],
        b[0]
      );

    const segmentLength =
      getDistanceKm(
        a[1],
        a[0],
        b[1],
        b[0]
      ) * 1000;

    if (
      !best ||
      segment.distanceMeters <
        best.distanceMeters
    ) {
      best = {
        lat:
          segment.lat,

        lon:
          segment.lon,

        distanceMeters:
          segment.distanceMeters,

        progressMeters:
          distanceBeforeSegment +
          segmentLength *
            segment.t,

        segmentIndex: i
      };
    }

    distanceBeforeSegment +=
      segmentLength;
  }

  return best;
}

/* =========================================================
   ROUTE-AWARE CLOSEST POINT

   Prevents GPS jumping to another part of
   the route far ahead or behind.
========================================================= */

function getClosestPointNearProgress(
  lat,
  lon,
  coordinates,
  currentProgress,
  maxForwardMeters = 160
) {
  if (
    !Array.isArray(
      coordinates
    ) ||
    coordinates.length < 2
  ) {
    return null;
  }

  let best = null;

  let distanceBeforeSegment =
    0;

  for (
    let i = 0;
    i <
      coordinates.length - 1;
    i += 1
  ) {
    const a =
      coordinates[i];

    const b =
      coordinates[i + 1];

    const segmentLength =
      getDistanceKm(
        a[1],
        a[0],
        b[1],
        b[0]
      ) * 1000;

    const segmentStartProgress =
      distanceBeforeSegment;

    const segmentEndProgress =
      distanceBeforeSegment +
      segmentLength;

    // Ignore parts of route that are
    // already behind us.
    if (
      segmentEndProgress <
      currentProgress - 20
    ) {
      distanceBeforeSegment +=
        segmentLength;

      continue;
    }

    // Do not search too far ahead.
    if (
      segmentStartProgress >
      currentProgress +
        maxForwardMeters
    ) {
      break;
    }

    const point =
      closestPointOnSegment(
        lat,
        lon,
        a[1],
        a[0],
        b[1],
        b[0]
      );

    const progress =
      distanceBeforeSegment +
      segmentLength *
        point.t;

    if (
      !best ||
      point.distanceMeters <
        best.distanceMeters
    ) {
      best = {
        lat:
          point.lat,

        lon:
          point.lon,

        distanceMeters:
          point.distanceMeters,

        progressMeters:
          progress,

        segmentIndex: i
      };
    }

    distanceBeforeSegment +=
      segmentLength;
  }

  return best;
}

/* =========================================================
   GET BEST GPS POSITION

   Uses multiple fixes and keeps the
   most accurate one.
========================================================= */

function getBestCurrentPosition({
  durationMs = 8000,
  targetAccuracy = 40
} = {}) {
  return new Promise(
    (resolve, reject) => {
      if (
        !navigator.geolocation
      ) {
        reject(
          new Error(
            'Geolocation is not supported'
          )
        );

        return;
      }

      let bestPosition =
        null;

      let finished =
        false;

      let watchId =
        null;

      let timerId =
        null;

      const finish = (
        error = null
      ) => {
        if (finished) {
          return;
        }

        finished = true;

        if (
          watchId !== null
        ) {
          navigator.geolocation.clearWatch(
            watchId
          );
        }

        if (
          timerId !== null
        ) {
          window.clearTimeout(
            timerId
          );
        }

        if (error) {
          reject(error);
        } else if (
          bestPosition
        ) {
          resolve(
            bestPosition
          );
        } else {
          reject(
            new Error(
              'No location fix received'
            )
          );
        }
      };

      watchId =
        navigator.geolocation.watchPosition(
          (position) => {
            const accuracy =
              Number(
                position.coords
                  .accuracy
              );

            if (
              !bestPosition
            ) {
              bestPosition =
                position;
            } else {
              const bestAccuracy =
                Number(
                  bestPosition
                    .coords
                    .accuracy
                );

              if (
                Number.isFinite(
                  accuracy
                ) &&
                accuracy <
                  bestAccuracy
              ) {
                bestPosition =
                  position;
              }
            }

            if (
              Number.isFinite(
                accuracy
              ) &&
              accuracy <=
                targetAccuracy
            ) {
              finish();
            }
          },
          (error) => {
            finish(error);
          },
          {
            enableHighAccuracy:
              true,

            maximumAge: 0,

            timeout:
              durationMs
          }
        );

      timerId =
        window.setTimeout(
          () => {
            finish();
          },
          durationMs
        );
    }
  );
}

/* =========================================================
   SUPABASE
========================================================= */

const supabase =
  createClient(
    import.meta.env
      .VITE_SUPABASE_URL,

    import.meta.env
      .VITE_SUPABASE_PUBLISHABLE_KEY
  );

/* =========================================================
   API
========================================================= */

const API =
  import.meta.env
    .VITE_API_URL ||
  'http://localhost:8000';

/* =========================================================
   APP
========================================================= */

function App() {
  /* =======================================================
     AUTH
  ======================================================= */

  const [session, setSession] =
    useState(null);

  const [email, setEmail] =
    useState('');

  const [password, setPassword] =
    useState('');

  const [newPassword, setNewPassword] =
    useState('');

  const [recoveryMode, setRecoveryMode] =
    useState(false);

  /* =======================================================
     MAIN APP STATE
  ======================================================= */

  const [pandals, setPandals] =
    useState([]);

  const [crowd, setCrowd] =
    useState([]);

  const [nearby, setNearby] =
    useState([]);

  const [userLocation, setUserLocation] =
    useState(null);

  const [routeData, setRouteData] =
    useState(null);

  const [navigationSteps, setNavigationSteps] =
    useState([]);

  const [currentStepIndex, setCurrentStepIndex] =
    useState(0);

  const [remainingDistance, setRemainingDistance] =
    useState(0);

  const [remainingTime, setRemainingTime] =
    useState(0);

  const [
    distanceToCurrentManeuver,
    setDistanceToCurrentManeuver
  ] = useState(0);

  const [selectedPandal, setSelectedPandal] =
    useState(null);

  const [nearestPandals, setNearestPandals] =
    useState([]);

  const [showChecklist, setShowChecklist] =
    useState(false);

  const [showPlanner, setShowPlanner] =
    useState(false);
  const [infoPage, setInfoPage] = useState(null);
  const [
    showBudgetTracker,
    setShowBudgetTracker
  ] = useState(false);

  const [
    showFavouriteShare,
    setShowFavouriteShare
  ] = useState(false);

  /* =======================================================
     NEAREST 3 PANDALS
  ======================================================= */

  function findNearestPandals(
    currentPandal
  ) {
    const currentLat =
      Number(
        currentPandal.latitude
      );

    const currentLon =
      Number(
        currentPandal.longitude
      );

    if (
      !Number.isFinite(
        currentLat
      ) ||
      !Number.isFinite(
        currentLon
      )
    ) {
      setNearestPandals([]);
      return;
    }

    const nearbyPandals =
      pandals
        .filter(
          (p) =>
            p.id !==
            currentPandal.id
        )
        .filter(
          (p) =>
            Number.isFinite(
              Number(
                p.latitude
              )
            ) &&
            Number.isFinite(
              Number(
                p.longitude
              )
            )
        )
        .map((p) => {
          const distance =
            getDistanceKm(
              currentLat,
              currentLon,
              Number(
                p.latitude
              ),
              Number(
                p.longitude
              )
            );

          return {
            ...p,
            distanceKm:
              distance
          };
        })
        .sort(
          (a, b) =>
            a.distanceKm -
            b.distanceKm
        )
        .slice(0, 3);

    setNearestPandals(
      nearbyPandals
    );
  }

  /* =======================================================
     GROUP SHARING
  ======================================================= */

  const [groupId, setGroupId] =
    useState('');

  const [invite, setInvite] =
    useState('');

  const [sharing, setSharing] =
    useState(false);

  const [friendLoc, setFriendLoc] =
    useState(null);

  /* =======================================================
     UI
  ======================================================= */

  const [status, setStatus] =
    useState('Starting…');

  const [zoneFilter, setZoneFilter] =
    useState('All zones');

  const [searchTerm, setSearchTerm] =
    useState('');

  const filteredPandals =
    pandals.filter(
      (pandal) => {
        const matchesZone =
          zoneFilter ===
            'All zones' ||
          pandal.zone ===
            zoneFilter;

        const matchesSearch =
          String(
            pandal.name || ''
          )
            .toLowerCase()
            .includes(
              searchTerm
                .toLowerCase()
            );

        return (
          matchesZone &&
          matchesSearch
        );
      }
    );

  /* =======================================================
     MAP REFS
  ======================================================= */

  const mapRef =
    useRef(null);

  const mapObj =
    useRef(null);

  const routeLayer =
    useRef(null);

  const friendMarker =
    useRef(null);
  const userMarker =
  useRef(null);  
  const destinationMarker =
  useRef(null);
  const locationChannel =
    useRef(null);

  const watchId =
    useRef(null);

  /* =======================================================
     NAVIGATION REFS
  ======================================================= */

  const navigationMarker =
    useRef(null);

  const navigationWatchId =
    useRef(null);

  const lastNavigationPosition =
    useRef(null);

  const navigationStepIndexRef =
    useRef(0);

  const navigationStepsRef =
    useRef([]);

  const navigationRemainingDistanceRef =
    useRef(0);

  const navigationRemainingTimeRef =
    useRef(0);

  const navigationOriginalDistanceRef =
    useRef(0);

  const navigationOriginalTimeRef =
    useRef(0);

  const navigationHeadingRef =
    useRef(null);

  const navigationVisualHeadingRef =
    useRef(null);

  const navigationDirectionPositionRef =
    useRef(null);

  const navigationLastAcceptedPositionRef =
    useRef(null);

  const navigationRouteCoordinatesRef =
    useRef([]);

  const navigationRouteProgressRef =
    useRef(0);

  const navigationRouteTotalDistanceRef =
    useRef(0);

  const navigationRawHistoryRef =
    useRef([]);

  const navigationAnimationFrameRef =
    useRef(null);

  const navigationHeadingAnimationFrameRef =
    useRef(null);

  /* =======================================================
     SMOOTH MARKER POSITION
  ======================================================= */

  const navigationTargetPositionRef =
    useRef(null);

  const navigationDisplayedPositionRef =
    useRef(null);

  /* =======================================================
     GPS DISPLACEMENT TRACKING
  ======================================================= */

  const navigationLastGpsTimeRef =
    useRef(null);

  const navigationLastGpsPositionRef =
    useRef(null);

  /* =======================================================
     WALKING SPEED
  ======================================================= */

  const navigationWalkingSpeedRef =
    useRef(
      WALKING_SPEED_KMH
    );

  /* =======================================================
     COMPASS
  ======================================================= */

  const navigationOrientationHistoryRef =
    useRef([]);

  const navigationDeviceHeadingRef =
    useRef(null);

  const navigationOrientationCleanupRef =
    useRef(null);

  const navigationLastAcceptedRawRef =
    useRef(null);

  const navigationLastPanPositionRef =
    useRef(null);

  /* =======================================================
     AUTH SESSION
  ======================================================= */

  useEffect(() => {
    let subscription;

    const initAuth =
      async () => {
        const { data } =
          await supabase.auth.getSession();

        setSession(
          data.session
        );
      };

    initAuth();

    const authListener =
      supabase.auth.onAuthStateChange(
        (
          event,
          currentSession
        ) => {
          setSession(
            currentSession
          );

          if (
            event ===
            'PASSWORD_RECOVERY'
          ) {
            setRecoveryMode(
              true
            );

            setStatus(
              'Choose a new password'
            );
          }

          if (
            event ===
            'SIGNED_OUT'
          ) {
            setRecoveryMode(
              false
            );

            setNewPassword('');
          }
        }
      );

    subscription =
      authListener.data
        .subscription;

    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  /* =======================================================
     LOAD PANDALS
  ======================================================= */

  useEffect(() => {
    fetch(
      API + '/api/pandals'
    )
      .then(
        (response) => {
          if (
            !response.ok
          ) {
            throw new Error(
              'Pandal API error'
            );
          }

          return response.json();
        }
      )
      .then(
        (data) => {
          setPandals(
            Array.isArray(data)
              ? data
              : []
          );
        }
      )
      .catch(() => {
        setStatus(
          'Pandal data unavailable'
        );
      });
  }, []);

  /* =======================================================
     INITIALIZE MAP
  ======================================================= */

  useEffect(() => {
    if (
      !mapRef.current
    ) {
      return;
    }

    mapObj.current =
      L.map(
        mapRef.current
      ).setView(
        [
          22.5726,
          88.3639
        ],
        12
      );

    L.tileLayer(
      'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      {
        attribution:
          '© OpenStreetMap contributors',

        maxZoom: 19
      }
    ).addTo(
      mapObj.current
    );

    return () => {
      if (
        mapObj.current
      ) {
        mapObj.current.remove();
        mapObj.current =
          null;
      }
    };
  }, []);
  /* =======================================================
   LIVE USER LOCATION
======================================================= */

useEffect(() => {
  if (!navigator.geolocation) {
    return;
  }

  let centered = false;

  const watchId =
    navigator.geolocation.watchPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lon = position.coords.longitude;

        if (
          !Number.isFinite(lat) ||
          !Number.isFinite(lon)
        ) {
          return;
        }

        setUserLocation({
          lat,
          lon
        });

        // Center the map only the first time GPS is received
        if (
          !centered &&
          mapObj.current
        ) {
          mapObj.current.setView(
            [lat, lon],
            15
          );

          centered = true;
        }
      },
      (error) => {
        console.log(
          '📍 User location unavailable:',
          error.message
        );
      },
      {
        enableHighAccuracy: true,
        maximumAge: 5000,
        timeout: 15000
      }
    );

  return () => {
    navigator.geolocation.clearWatch(
      watchId
    );
  };
}, []);
  /* =======================================================
     PANDAL MARKERS
  ======================================================= */

  useEffect(() => {
    if (
      !mapObj.current
    ) {
      return;
    }

    mapObj.current.eachLayer(
      (layer) => {
        if (
          layer instanceof
            L.Marker &&
          layer !==
            navigationMarker.current &&
          layer !==
            friendMarker.current
        ) {
          mapObj.current.removeLayer(
            layer
          );
        }
      }
    );

    filteredPandals.forEach(
      (pandal) => {
        const latitude =
          Number(
            pandal.latitude
          );

        const longitude =
          Number(
            pandal.longitude
          );

        if (
          !Number.isFinite(
            latitude
          ) ||
          !Number.isFinite(
            longitude
          )
        ) {
          return;
        }

        L.marker([
          latitude,
          longitude
        ])
          .addTo(
            mapObj.current
          )
          .bindPopup(
            `<b>${esc(
              pandal.name
            )}</b><br>${esc(
              pandal.zone
            )}`
          );
      }
    );
  }, [
    filteredPandals
  ]);
  /* =======================================================
   DESTINATION BLUE MARKER
======================================================= */

useEffect(() => {
  if (!mapObj.current) {
    return;
  }

  if (destinationMarker.current) {
    destinationMarker.current.remove();
    destinationMarker.current = null;
  }

  if (!selectedPandal) {
    return;
  }

  const lat = Number(selectedPandal.latitude);
  const lon = Number(selectedPandal.longitude);

  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lon)
  ) {
    return;
  }

  destinationMarker.current =
    L.circleMarker(
      [lat, lon],
      {
        radius: 10,
        color: '#ffffff',
        weight: 3,
        fillColor: '#1a73e8',
        fillOpacity: 1
      }
    )
      .addTo(mapObj.current)
      .bindPopup(
        '📍 ' +
          (selectedPandal.name ||
            'Destination')
      );
}, [selectedPandal]);

  /* =======================================================
     SHOW ROUTE
  ======================================================= */

  useEffect(() => {
    if (
      !mapObj.current ||
      !routeData?.routes
        ?.length
    ) {
      return;
    }

    if (
      routeLayer.current
    ) {
      mapObj.current.removeLayer(
        routeLayer.current
      );

      routeLayer.current =
        null;
    }

    const route =
      routeData.routes[0];

    if (
      !route?.geometry
    ) {
      return;
    }

    routeLayer.current =
      L.geoJSON(
        route.geometry
      ).addTo(
        mapObj.current
      );

    mapObj.current.fitBounds(
      routeLayer.current.getBounds(),
      {
        padding: [
          30,
          30
        ]
      }
    );
  }, [
    routeData
  ]);

  /* =======================================================
     FRIEND LOCATION LISTENER
  ======================================================= */

  useEffect(() => {
    if (
      !session ||
      !groupId
    ) {
      return;
    }

    const channel =
      supabase
        .channel(
          'group:' +
            groupId,
          {
            config: {
              private: true
            }
          }
        )
        .on(
          'broadcast',
          {
            event:
              'location'
          },
          ({
            payload
          }) => {
            if (
              payload.user_id !==
              session.user.id
            ) {
              setFriendLoc(
                payload
              );
            }
          }
        )
        .subscribe();

    locationChannel.current =
      channel;

    return () => {
      supabase.removeChannel(
        channel
      );

      if (
        locationChannel.current ===
        channel
      ) {
        locationChannel.current =
          null;
      }
    };
  }, [
    session,
    groupId
  ]);

  /* =======================================================
     SHARE LOCATION
  ======================================================= */

  useEffect(() => {
    if (
      !session ||
      !groupId ||
      !sharing
    ) {
      return;
    }

    const startSharing =
      async () => {
        if (
          !locationChannel.current
        ) {
          const channel =
            supabase
              .channel(
                'group:' +
                  groupId,
                {
                  config: {
                    private:
                      true
                  }
                }
              )
              .on(
                'broadcast',
                {
                  event:
                    'location'
                },
                ({
                  payload
                }) => {
                  if (
                    payload.user_id !==
                    session.user.id
                  ) {
                    setFriendLoc(
                      payload
                    );
                  }
                }
              );

          const result =
            await channel.subscribe();

          if (
            result !==
            'SUBSCRIBED'
          ) {
            setStatus(
              'Private channel failed'
            );

            return;
          }

          locationChannel.current =
            channel;
        }

        if (
          !navigator.geolocation
        ) {
          setStatus(
            'Geolocation is not supported'
          );

          return;
        }

        watchId.current =
          navigator.geolocation.watchPosition(
            (
              position
            ) => {
              if (
                !locationChannel.current
              ) {
                return;
              }

              locationChannel.current.send(
                {
                  type:
                    'broadcast',

                  event:
                    'location',

                  payload: {
                    user_id:
                      session.user.id,

                    lat:
                      position.coords
                        .latitude,

                    lon:
                      position.coords
                        .longitude,

                    accuracy:
                      position.coords
                        .accuracy,

                    at:
                      new Date().toISOString()
                  }
                }
              );
            },
            () => {
              setStatus(
                'Location permission denied/unavailable'
              );
            },
            {
              enableHighAccuracy:
                true,

              maximumAge:
                5000,

              timeout:
                15000
            }
          );
      };

    startSharing();

    return () => {
      if (
        watchId.current !==
        null
      ) {
        navigator.geolocation.clearWatch(
          watchId.current
        );

        watchId.current =
          null;
      }
    };
  }, [
    session,
    groupId,
    sharing
  ]);

  /* =======================================================
     FRIEND MARKER
  ======================================================= */

  useEffect(() => {
    if (
      friendMarker.current
    ) {
      friendMarker.current.remove();

      friendMarker.current =
        null;
    }

    if (
      friendLoc &&
      mapObj.current
    ) {
      friendMarker.current =
        L.marker([
          friendLoc.lat,
          friendLoc.lon
        ])
          .addTo(
            mapObj.current
          )
          .bindPopup(
            'Friend shared location<br>' +
              new Date(
                friendLoc.at
              ).toLocaleTimeString()
          );

      mapObj.current.setView(
        [
          friendLoc.lat,
          friendLoc.lon
        ],
        15
      );
    }
  }, [
    friendLoc
  ]);
/* =======================================================
   USER LOCATION BLUE DOT
======================================================= */

useEffect(() => {
  if (!mapObj.current) {
    return;
  }

  if (userMarker.current) {
    userMarker.current.remove();
    userMarker.current = null;
  }

  if (
    userLocation &&
    Number.isFinite(userLocation.lat) &&
    Number.isFinite(userLocation.lon)
  ) {
    userMarker.current = L.circleMarker(
      [
        userLocation.lat,
        userLocation.lon
      ],
      {
        radius: 8,
        color: '#ffffff',
        weight: 3,
        fillColor: '#4285F4',
        fillOpacity: 1
      }
    )
      .addTo(mapObj.current)
      .bindPopup('📍 Your current location');
  }
}, [userLocation]);

  /* =======================================================
     AUTH ACTIONS
  ======================================================= */

  async function auth(
    mode
  ) {
    if (
      !email ||
      !password
    ) {
      return alert(
        'Enter email and password'
      );
    }

    const fn =
      mode === 'signup'
        ? supabase.auth.signUp.bind(
            supabase.auth
          )
        : supabase.auth.signInWithPassword.bind(
            supabase.auth
          );

    const {
      data,
      error
    } = await fn({
      email,
      password
    });

    if (error) {
      alert(
        error.message
      );

      return;
    }

    setSession(
      data.session || null
    );
  }

  /* =======================================================
     RESET PASSWORD
  ======================================================= */

  async function resetPassword() {
    if (!email) {
      return alert(
        'Enter your email first'
      );
    }

    const {
      error
    } =
      await supabase.auth.resetPasswordForEmail(
        email,
        {
          redirectTo:
            window.location.origin
        }
      );

    if (error) {
      alert(
        error.message
      );

      return;
    }

    alert(
      'Password reset email sent. Check your inbox.'
    );
  }

  /* =======================================================
     UPDATE PASSWORD
  ======================================================= */

  async function updatePassword() {
    if (!newPassword) {
      return alert(
        'Enter your new password'
      );
    }

    if (
      newPassword.length <
      6
    ) {
      return alert(
        'Password should be at least 6 characters'
      );
    }

    const {
      error
    } =
      await supabase.auth.updateUser(
        {
          password:
            newPassword
        }
      );

    if (error) {
      alert(
        error.message
      );

      return;
    }

    alert(
      'Password updated successfully!'
    );

    setNewPassword('');
    setRecoveryMode(
      false
    );

    setStatus(
      'Password updated'
    );

    await supabase.auth.signOut();
  }

  /* =======================================================
     CREATE GROUP
  ======================================================= */

  async function createGroup() {
    if (!session) {
      return alert(
        'Sign in first'
      );
    }

    const inviteCode =
      'P' +
      Math.random()
        .toString(36)
        .slice(2, 8)
        .toUpperCase();

    const {
      data,
      error
    } =
      await supabase
        .from('groups')
        .insert({
          name:
            'Puja Friends',

          created_by:
            session.user.id,

          invite_code:
            inviteCode
        })
        .select(
          'id,invite_code'
        )
        .single();

    if (error) {
      return alert(
        error.message
      );
    }

    await supabase
      .from(
        'group_members'
      )
      .insert({
        group_id:
          data.id,

        user_id:
          session.user.id,

        can_share_location:
          true
      });

    setGroupId(
      data.id
    );

    setInvite(
      data.invite_code
    );

    setStatus(
      'Private group connected'
    );
  }

  /* =======================================================
     JOIN GROUP
  ======================================================= */

  async function joinGroup() {
    if (
      !session ||
      !invite
    ) {
      return alert(
        'Sign in and enter an invite code'
      );
    }

    const {
      data,
      error
    } =
      await supabase
        .from('groups')
        .select(
          'id,invite_code,expires_at'
        )
        .eq(
          'invite_code',
          invite
        )
        .single();

    if (error) {
      return alert(
        'Group not found'
      );
    }

    const {
      error: memberError
    } =
      await supabase
        .from(
          'group_members'
        )
        .insert({
          group_id:
            data.id,

          user_id:
            session.user.id,

          can_share_location:
            false
        });

    if (
      memberError
    ) {
      return alert(
        memberError.message
      );
    }

    setGroupId(
      data.id
    );

    setStatus(
      'Joined group'
    );
  }

  /* =======================================================
     TOGGLE SHARING
  ======================================================= */

  function toggleShare() {
    if (!session) {
      return alert(
        'Sign in first'
      );
    }

    setSharing(
      (value) =>
        !value
    );
  }

  /* =======================================================
     NEARBY ESSENTIALS
  ======================================================= */

  async function findNearest() {
  if (!navigator.geolocation) {
    return alert('Geolocation is not supported');
  }

  const runNearby = async (lat, lon) => {
    setUserLocation({
      lat,
      lon
    });

    const response = await fetch(
      API + '/api/nearby',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          lat,
          lon,
          radius: 1000
        })
      }
    );

    if (!response.ok) {
      throw new Error('Nearby API error');
    }

    const data = await response.json();

    setNearby(
      Array.isArray(data)
        ? data
        : []
    );
  };

  if (
    userLocation &&
    Number.isFinite(userLocation.lat) &&
    Number.isFinite(userLocation.lon)
  ) {
    try {
      await runNearby(
        userLocation.lat,
        userLocation.lon
      );
      return;
    } catch (error) {
      console.log(
        'Nearby API failed:',
        error
      );
    }
  }

  navigator.geolocation.getCurrentPosition(
    async (position) => {
      try {
        await runNearby(
          position.coords.latitude,
          position.coords.longitude
        );
      } catch (error) {
        console.error(
          'Nearby API error:',
          error
        );
        alert('Nearby data unavailable');
      }
    },
    (error) => {
      console.log(
        'GPS error:',
        error.code,
        error.message
      );

      alert(
        'Could not get your location. Please allow location access and try again.'
      );
    },
    {
      enableHighAccuracy: true,
      maximumAge: 10000,
      timeout: 30000
    }
  );
}
  /* =======================================================
     STOP NAVIGATION
  ======================================================= */

  function stopNavigationTracking() {
    if (
      navigationWatchId.current !==
      null
    ) {
      navigator.geolocation.clearWatch(
        navigationWatchId.current
      );

      navigationWatchId.current =
        null;
    }

    if (
      navigationAnimationFrameRef.current !==
      null
    ) {
      cancelAnimationFrame(
        navigationAnimationFrameRef.current
      );

      navigationAnimationFrameRef.current =
        null;
    }

    if (
      navigationHeadingAnimationFrameRef.current !==
      null
    ) {
      cancelAnimationFrame(
        navigationHeadingAnimationFrameRef.current
      );

      navigationHeadingAnimationFrameRef.current =
        null;
    }

    if (
      navigationOrientationCleanupRef.current
    ) {
      navigationOrientationCleanupRef.current();

      navigationOrientationCleanupRef.current =
        null;
    }
  }

  /* =======================================================
     DEVICE COMPASS

     Compass is deliberately NOT allowed to rotate
     the triangle while the user is standing still.
  ======================================================= */

  async function startDeviceOrientationTracking() {
    if (
      typeof window ===
        'undefined' ||
      !window.DeviceOrientationEvent
    ) {
      console.log(
        '🧭 Device orientation unavailable in this browser'
      );

      return;
    }

    try {
      const requestPermission =
        window
          .DeviceOrientationEvent
          .requestPermission;

      if (
        typeof requestPermission ===
        'function'
      ) {
        const permission =
          await requestPermission.call(
            window.DeviceOrientationEvent
          );

        if (
          permission !==
          'granted'
        ) {
          console.log(
            '🧭 Device orientation permission not granted'
          );

          return;
        }
      }
    } catch (
      error
    ) {
      console.log(
        '🧭 Device orientation permission unavailable',
        error
      );

      return;
    }

    const orientationHandler =
      (event) => {
        let heading =
          null;

        if (
          Number.isFinite(
            Number(
              event.webkitCompassHeading
            )
          )
        ) {
          heading =
            normalizeAngle(
              Number(
                event.webkitCompassHeading
              )
            );
        } else if (
          Number.isFinite(
            Number(
              event.alpha
            )
          )
        ) {
          const screenAngle =
            Number(
              window.screen
                ?.orientation
                ?.angle
            ) || 0;

          heading =
            normalizeAngle(
              360 -
                Number(
                  event.alpha
                ) +
                screenAngle
            );
        }

        if (
          !Number.isFinite(
            heading
          )
        ) {
          return;
        }

        const history = [
          ...navigationOrientationHistoryRef.current,
          heading
        ].slice(-7);

        navigationOrientationHistoryRef.current =
          history;

        const averagedHeading =
          circularMean(
            history
          );

        if (
          averagedHeading !==
          null
        ) {
          navigationDeviceHeadingRef.current =
            averagedHeading;
        }
      };

    window.addEventListener(
      'deviceorientationabsolute',
      orientationHandler,
      true
    );

    window.addEventListener(
      'deviceorientation',
      orientationHandler,
      true
    );

    navigationOrientationCleanupRef.current =
      () => {
        window.removeEventListener(
          'deviceorientationabsolute',
          orientationHandler,
          true
        );

        window.removeEventListener(
          'deviceorientation',
          orientationHandler,
          true
        );
      };

    console.log(
      '🧭 Device orientation tracking enabled'
    );
  }

  /* =======================================================
     SMOOTH MARKER POSITION

     ONE continuous animation loop.
     Every GPS fix only changes the target.
  ======================================================= */

  function animateNavigationMarker(
    targetLat,
    targetLon
  ) {
    const marker =
      navigationMarker.current;

    if (!marker) {
      return;
    }

    navigationTargetPositionRef.current =
      {
        lat:
          targetLat,

        lon:
          targetLon
      };

    if (
      !navigationDisplayedPositionRef.current
    ) {
      const current =
        marker.getLatLng();

      navigationDisplayedPositionRef.current =
        {
          lat:
            current.lat,

          lon:
            current.lng
        };
    }

    if (
      navigationAnimationFrameRef.current !==
      null
    ) {
      return;
    }

    const animate =
      () => {
        const currentMarker =
          navigationMarker.current;

        const target =
          navigationTargetPositionRef.current;

        const displayed =
          navigationDisplayedPositionRef.current;

        if (
          !currentMarker ||
          !target ||
          !displayed
        ) {
          navigationAnimationFrameRef.current =
            null;

          return;
        }

        const targetDistance =
          getDistanceKm(
            displayed.lat,
            displayed.lon,
            target.lat,
            target.lon
          ) * 1000;

        let smoothing =
          0.18;

        if (
          targetDistance >
          30
        ) {
          smoothing =
            0.32;
        } else if (
          targetDistance >
          10
        ) {
          smoothing =
            0.24;
        }

        const nextLat =
          displayed.lat +
          (
            target.lat -
            displayed.lat
          ) *
            smoothing;

        const nextLon =
          displayed.lon +
          (
            target.lon -
            displayed.lon
          ) *
            smoothing;

        navigationDisplayedPositionRef.current =
          {
            lat:
              nextLat,

            lon:
              nextLon
          };

        currentMarker.setLatLng(
          [
            nextLat,
            nextLon
          ]
        );

        const remaining =
          getDistanceKm(
            nextLat,
            nextLon,
            target.lat,
            target.lon
          ) * 1000;

        if (
          remaining >
          0.7
        ) {
          navigationAnimationFrameRef.current =
            requestAnimationFrame(
              animate
            );
        } else {
          navigationDisplayedPositionRef.current =
            {
              lat:
                target.lat,

              lon:
                target.lon
            };

          currentMarker.setLatLng(
            [
              target.lat,
              target.lon
            ]
          );

          navigationAnimationFrameRef.current =
            null;
        }
      };

    navigationAnimationFrameRef.current =
      requestAnimationFrame(
        animate
      );
  }

  /* =======================================================
     SMOOTH TRIANGLE HEADING
  ======================================================= */

  function animateTriangleToHeading(
    targetHeading
  ) {
    const marker =
      navigationMarker.current;

    if (!marker) {
      return;
    }

    const markerElement =
      marker.getElement();

    const triangle =
      markerElement?.querySelector(
        '.nav-triangle'
      );

    if (!triangle) {
      return;
    }

    const startHeading =
      navigationVisualHeadingRef.current ??
      targetHeading;

    const delta =
      shortestAngleDelta(
        startHeading,
        targetHeading
      );

    const finalHeading =
      startHeading +
      delta;

    if (
      navigationHeadingAnimationFrameRef.current !==
      null
    ) {
      cancelAnimationFrame(
        navigationHeadingAnimationFrameRef.current
      );
    }

    const startTime =
      performance.now();

    const turnDegrees =
      Math.abs(delta);

    const duration =
      Math.max(
        180,
        Math.min(
          550,
          180 +
            turnDegrees *
              2.5
        )
      );

    const frame =
      (now) => {
        const progress =
          Math.min(
            1,
            (now -
              startTime) /
              duration
          );

        const eased =
          1 -
          Math.pow(
            1 - progress,
            3
          );

        const visualHeading =
          startHeading +
          (
            finalHeading -
            startHeading
          ) *
            eased;

        navigationVisualHeadingRef.current =
          visualHeading;

        triangle.style.transform =
          `rotate(${visualHeading}deg)`;

        if (
          progress <
          1
        ) {
          navigationHeadingAnimationFrameRef.current =
            requestAnimationFrame(
              frame
            );
        } else {
          navigationHeadingAnimationFrame.current =
            null;

          navigationVisualHeadingRef.current =
            normalizeAngle(
              finalHeading
            );
        }
      };

    navigationHeadingAnimationFrameRef.current =
      requestAnimationFrame(
        frame
      );
  }

  /* =======================================================
     WALKING ETA
  ======================================================= */

  function updateNavigationTime() {
    const remaining =
      Math.max(
        0,
        Number(
          navigationRemainingDistanceRef.current
        ) || 0
      );

    const speedKmh =
      Math.max(
        3.2,
        Math.min(
          5.8,
          Number(
            navigationWalkingSpeedRef.current
          ) ||
            WALKING_SPEED_KMH
        )
      );

    const metersPerSecond =
      (speedKmh * 1000) /
      3600;

    const nextTime =
      metersPerSecond >
      0
        ? remaining /
          metersPerSecond
        : getWalkingDurationSeconds(
            remaining
          );

    navigationRemainingTimeRef.current =
      nextTime;

    setRemainingTime(
      nextTime
    );
  }

  /* =======================================================
     PLAN ROUTE + START LIVE NAVIGATION
  ======================================================= */

  async function planRoute(
    pandal
  ) {
    if (
      !navigator.geolocation
    ) {
      alert(
        'Geolocation is not supported'
      );

      return;
    }

    stopNavigationTracking();

    navigationRawHistoryRef.current =
      [];

    navigationOrientationHistoryRef.current =
      [];

    navigationDeviceHeadingRef.current =
      null;

    navigationLastAcceptedRawRef.current =
      null;

    navigationLastPanPositionRef.current =
      null;

    navigationRouteProgressRef.current =
      0;

    navigationHeadingRef.current =
      null;

    navigationVisualHeadingRef.current =
      null;

    navigationTargetPositionRef.current =
      null;

    navigationDisplayedPositionRef.current =
      null;

    navigationLastGpsTimeRef.current =
      null;

    navigationLastGpsPositionRef.current =
      null;

    navigationWalkingSpeedRef.current =
      WALKING_SPEED_KMH;

    setSelectedPandal(
      pandal
    );

    setRouteData(
      null
    );

    setNavigationSteps(
      []
    );

    setCurrentStepIndex(
      0
    );

    setRemainingDistance(
      0
    );

    setRemainingTime(
      0
    );

    setDistanceToCurrentManeuver(
      0
    );

    await startDeviceOrientationTracking();

    try {
      /* ---------------------------------------------------
         GET BEST START POSITION
      --------------------------------------------------- */

      const position =
        await getBestCurrentPosition(
          {
            durationMs:
              8000,

            targetAccuracy:
              40
          }
        );

      const startLat =
        Number(
          position.coords
            .latitude
        );

      const startLon =
        Number(
          position.coords
            .longitude
        );

      const endLat =
        Number(
          pandal.latitude
        );

      const endLon =
        Number(
          pandal.longitude
        );

      if (
        !Number.isFinite(
          startLat
        ) ||
        !Number.isFinite(
          startLon
        ) ||
        !Number.isFinite(
          endLat
        ) ||
        !Number.isFinite(
          endLon
        )
      ) {
        throw new Error(
          'Invalid route coordinates'
        );
      }

      /* ---------------------------------------------------
         GET ROUTE FROM BACKEND
      --------------------------------------------------- */

      const points =
        `${startLon},${startLat};${endLon},${endLat}`;

      const response =
        await fetch(
          `${API}/api/route?points=${encodeURIComponent(
            points
          )}`
        );

      if (
        !response.ok
      ) {
        throw new Error(
          'Route API error'
        );
      }

      const data =
        await response.json();

      const route =
        data.routes?.[0];

      if (!route) {
        throw new Error(
          'No route returned'
        );
      }

      setRouteData(
        data
      );

      /* ---------------------------------------------------
         NAVIGATION STEPS
      --------------------------------------------------- */

      const steps =
        route.legs?.[0]
          ?.steps || [];

      navigationStepsRef.current =
        steps;

      navigationStepIndexRef.current =
        0;

      setNavigationSteps(
        steps
      );

      setCurrentStepIndex(
        0
      );

      /* ---------------------------------------------------
         ROUTE DISTANCE

         IMPORTANT:
         We intentionally do NOT use route.duration
         as walking ETA.
      --------------------------------------------------- */

      const routeDistance =
        Number(
          route.distance
        ) || 0;

      const routeWalkingDuration =
        getWalkingDurationSeconds(
          routeDistance
        );

      setRemainingDistance(
        routeDistance
      );

      setRemainingTime(
        routeWalkingDuration
      );

      navigationRemainingDistanceRef.current =
        routeDistance;

      navigationRemainingTimeRef.current =
        routeWalkingDuration;

      navigationOriginalDistanceRef.current =
        routeDistance;

      navigationOriginalTimeRef.current =
        routeWalkingDuration;

      /* ---------------------------------------------------
         ROUTE COORDINATES
      --------------------------------------------------- */

      const routeCoordinates =
        route.geometry?.type ===
        'LineString'
          ? route.geometry
              .coordinates || []
          : [];

      navigationRouteCoordinatesRef.current =
        routeCoordinates;

      navigationRouteTotalDistanceRef.current =
        routeDistance;

      navigationRouteProgressRef.current =
        0;

      /* ---------------------------------------------------
         INITIAL GPS HISTORY
      --------------------------------------------------- */

      const initialAccuracy =
        Number(
          position.coords
            .accuracy
        );

      navigationRawHistoryRef.current =
        [
          {
            lat:
              startLat,

            lon:
              startLon,

            at:
              Date.now(),

            accuracy:
              Number.isFinite(
                initialAccuracy
              )
                ? initialAccuracy
                : 9999,

            speed:
              Number(
                position.coords
                  .speed
              ),

            heading:
              Number(
                position.coords
                  .heading
              )
          }
        ];

      navigationLastAcceptedPositionRef.current =
        {
          lat:
            startLat,

          lon:
            startLon
        };

      navigationLastAcceptedRawRef.current =
        {
          lat:
            startLat,

          lon:
            startLon
        };

      navigationLastGpsPositionRef.current =
        {
          lat:
            startLat,

          lon:
            startLon
        };

      navigationLastGpsTimeRef.current =
        Date.now();

      /* ---------------------------------------------------
         INITIAL ROUTE BEARING
      --------------------------------------------------- */

      const firstRoutePoint =
        getClosestPointOnRoute(
          startLat,
          startLon,
          routeCoordinates
        );

      const firstSegmentA =
        firstRoutePoint
          ? routeCoordinates[
              firstRoutePoint
                .segmentIndex
            ]
          : null;

      const firstSegmentB =
        firstRoutePoint
          ? routeCoordinates[
              firstRoutePoint
                .segmentIndex +
                1
            ]
          : null;

      let firstRouteBearing =
        null;

      if (
        firstSegmentA &&
        firstSegmentB
      ) {
        firstRouteBearing =
          getBearingDegrees(
            firstSegmentA[1],
            firstSegmentA[0],
            firstSegmentB[1],
            firstSegmentB[0]
          );
      }

      if (
        !Number.isFinite(
          firstRouteBearing
        )
      ) {
        firstRouteBearing =
          Number(
            steps[0]
              ?.maneuver
              ?.bearing_after
          );
      }

      if (
        !Number.isFinite(
          firstRouteBearing
        )
      ) {
        firstRouteBearing =
          0;
      }

      navigationHeadingRef.current =
        normalizeAngle(
          firstRouteBearing
        );

      navigationVisualHeadingRef.current =
        navigationHeadingRef.current;

      /* ---------------------------------------------------
         DEBUG LOGS
      --------------------------------------------------- */

      if (
        steps.length > 0
      ) {
        const firstStep =
          steps[0];

        console.log(
          '🧭 FIRST STEP:',
          firstStep
        );

        console.log(
          '➡️ Maneuver:',
          firstStep.maneuver
        );

        console.log(
          '📏 Distance:',
          firstStep.distance,
          'meters'
        );

        console.log(
          '🛣️ Road:',
          firstStep.name
        );

        console.log(
          '🗣️ Instruction:',
          getNavigationInstruction(
            firstStep
          )
        );
      }

      console.log(
        '🧭 Navigation steps:',
        steps
      );

      console.log(
        '🚶 Walking ETA:',
        formatDuration(
          routeWalkingDuration
        )
      );

      /* ---------------------------------------------------
         CREATE TRIANGLE
      --------------------------------------------------- */

      if (
        mapObj.current
      ) {
        const triangleIcon =
          L.divIcon({
            className:
              'navigation-icon',

            html: `
              <div
                class="nav-triangle-wrapper"
                style="
                  width:44px;
                  height:44px;
                  display:flex;
                  align-items:center;
                  justify-content:center;
                  pointer-events:none;
                "
              >
                <div
                  class="nav-triangle"
                  style="
                    width:0;
                    height:0;
                    border-left:13px solid transparent;
                    border-right:13px solid transparent;
                    border-bottom:34px solid #e60000;
                    filter:drop-shadow(0 2px 3px rgba(0,0,0,0.45));
                    transform:rotate(${navigationHeadingRef.current}deg);
                    transform-origin:center center;
                    transition:none;
                    will-change:transform;
                  "
                ></div>
              </div>
            `,

            iconSize: [
              44,
              44
            ],

            iconAnchor: [
              22,
              22
            ]
          });

        if (
          navigationMarker.current
        ) {
          navigationMarker.current.remove();
        }

        navigationMarker.current =
          L.marker(
            [
              startLat,
              startLon
            ],
            {
              icon:
                triangleIcon,

              zIndexOffset:
                10000
            }
          ).addTo(
            mapObj.current
          );

        navigationTargetPositionRef.current =
          {
            lat:
              startLat,

            lon:
              startLon
          };

        navigationDisplayedPositionRef.current =
          {
            lat:
              startLat,

            lon:
              startLon
          };

        mapObj.current.setView(
          [
            startLat,
            startLon
          ],
          17,
          {
            animate:
              true
          }
        );

        console.log(
          '🔺 Navigation triangle created:',
          startLat,
          startLon,
          '| initial accuracy:',
          Math.round(
            Number.isFinite(
              initialAccuracy
            )
              ? initialAccuracy
              : 9999
          ),
          'm'
        );
      }

      /* ---------------------------------------------------
         LIVE GPS TRACKING
      --------------------------------------------------- */

      navigationWatchId.current =
        navigator.geolocation.watchPosition(
          (
            watchPosition
          ) => {
            const lat =
              Number(
                watchPosition
                  .coords
                  .latitude
              );

            const lon =
              Number(
                watchPosition
                  .coords
                  .longitude
              );

            const accuracy =
              Number(
                watchPosition
                  .coords
                  .accuracy
              );

            const speed =
              Number(
                watchPosition
                  .coords
                  .speed
              );

            const gpsHeading =
              Number(
                watchPosition
                  .coords
                  .heading
              );

            if (
              !Number.isFinite(
                lat
              ) ||
              !Number.isFinite(
                lon
              )
            ) {
              return;
            }

            const now =
              Number.isFinite(
                watchPosition.timestamp
              )
                ? watchPosition.timestamp
                : Date.now();

            const safeAccuracy =
              Number.isFinite(
                accuracy
              ) &&
              accuracy > 0
                ? accuracy
                : 9999;

            /* ---------------------------------------------
               SAVE RAW GPS HISTORY
            --------------------------------------------- */

            const history =
              [
                ...navigationRawHistoryRef.current,
                {
                  lat,
                  lon,
                  at:
                    now,
                  accuracy:
                    safeAccuracy,
                  speed,
                  heading:
                    gpsHeading
                }
              ].filter(
                (item) =>
                  now -
                    item.at <=
                  10000
              );

            navigationRawHistoryRef.current =
              history.slice(
                -10
              );

            const routeCoordinatesNow =
              navigationRouteCoordinatesRef.current;

            if (
              routeCoordinatesNow.length <
              2
            ) {
              return;
            }

            /* ---------------------------------------------
               RAW GPS MOVEMENT
            --------------------------------------------- */

            const previousGps =
              navigationLastGpsPositionRef.current;

            const previousGpsTime =
              navigationLastGpsTimeRef.current;

            let gpsMovementMeters =
              0;

            let gpsDeltaTime =
              0;

            if (
              previousGps &&
              previousGpsTime
            ) {
              gpsMovementMeters =
                getDistanceKm(
                  previousGps.lat,
                  previousGps.lon,
                  lat,
                  lon
                ) * 1000;

              gpsDeltaTime =
                Math.max(
                  0.5,
                  (
                    now -
                    previousGpsTime
                  ) / 1000
                );
            }

            const calculatedSpeed =
              gpsDeltaTime >
              0
                ? gpsMovementMeters /
                  gpsDeltaTime
                : 0;

            const reportedSpeed =
              Number.isFinite(
                speed
              ) &&
              speed >= 0
                ? speed
                : 0;

            const effectiveSpeed =
              reportedSpeed >
              0.1
                ? reportedSpeed
                : calculatedSpeed;

            /* ---------------------------------------------
               MOVEMENT CONFIDENCE

               GPS movement is only considered real when
               accuracy is reasonable.
            --------------------------------------------- */

            const speedEvidence =
              safeAccuracy <=
                60 &&
              reportedSpeed >=
                0.8;

            const movementEvidence =
              safeAccuracy <=
                80 &&
              gpsMovementMeters >=
                4;

            const isMoving =
              speedEvidence ||
              movementEvidence;

            /* ---------------------------------------------
               MAP MATCHING
            --------------------------------------------- */

            const currentProgress =
              navigationRouteProgressRef.current;

            const closestRoutePoint =
              getClosestPointNearProgress(
                lat,
                lon,
                routeCoordinatesNow,
                currentProgress,
                160
              );

            let candidateLat =
              lat;

            let candidateLon =
              lon;

            let candidateProgress =
              currentProgress;

            let candidateSegmentIndex =
              null;

            let candidateSnapDistance =
              Infinity;

            if (
              closestRoutePoint
            ) {
              candidateLat =
                closestRoutePoint.lat;

              candidateLon =
                closestRoutePoint.lon;

              candidateProgress =
                closestRoutePoint.progressMeters;

              candidateSegmentIndex =
                closestRoutePoint.segmentIndex;

              candidateSnapDistance =
                closestRoutePoint.distanceMeters;
            }

            const snapLimit =
              Math.min(
                75,
                Math.max(
                  25,
                  safeAccuracy *
                    0.75
                )
              );

            const progressForward =
              candidateProgress -
              currentProgress;

            /* ---------------------------------------------
               JUMP PROTECTION
            --------------------------------------------- */

            const implausibleHugeJump =
              progressForward >
                120 &&
              gpsMovementMeters <
                80;

            const goodMapMatch =
              closestRoutePoint !==
                null &&
              candidateSnapDistance <=
                snapLimit;

            const routeProgressValid =
              progressForward >=
                2 &&
              progressForward <=
                120;

            const movementValid =
              gpsMovementMeters >=
                4 &&
              gpsMovementMeters <=
                100;

            const positionCanBeAccepted =
              !implausibleHugeJump &&
              isMoving &&
              safeAccuracy <=
                80 &&
              goodMapMatch &&
              (
                routeProgressValid ||
                movementValid
              );

            /* ---------------------------------------------
               ACCEPT POSITION
            --------------------------------------------- */

            if (
              positionCanBeAccepted
            ) {
              const acceptedProgress =
                Math.max(
                  currentProgress,
                  candidateProgress
                );

              navigationRouteProgressRef.current =
                Math.min(
                  navigationRouteTotalDistanceRef.current,
                  acceptedProgress
                );

              navigationLastAcceptedPositionRef.current =
                {
                  lat:
                    candidateLat,

                  lon:
                    candidateLon
                };

              navigationLastAcceptedRawRef.current =
                {
                  lat,
                  lon
                };

              /* -------------------------------------------
                 OBSERVED WALKING SPEED

                 Only use measured speed when movement is
                 sufficiently reliable.
              ------------------------------------------- */

              if (
                isMoving &&
                safeAccuracy <=
                  60 &&
                Number.isFinite(
                  effectiveSpeed
                ) &&
                effectiveSpeed >=
                  0.5 &&
                effectiveSpeed <=
                  2.0
              ) {
                const measuredSpeedKmh =
                  effectiveSpeed *
                  3.6;

                const clampedSpeed =
                  Math.max(
                    3.2,
                    Math.min(
                      5.8,
                      measuredSpeedKmh
                    )
                  );

                navigationWalkingSpeedRef.current =
                  navigationWalkingSpeedRef.current *
                    0.85 +
                  clampedSpeed *
                    0.15;
              }

              const remaining =
                Math.max(
                  0,
                  navigationRouteTotalDistanceRef.current -
                    navigationRouteProgressRef.current
                );

              navigationRemainingDistanceRef.current =
                remaining;

              setRemainingDistance(
                remaining
              );

              updateNavigationTime();

              /* -------------------------------------------
                 SMOOTH TRIANGLE POSITION
              ------------------------------------------- */

              animateNavigationMarker(
                candidateLat,
                candidateLon
              );

              /* -------------------------------------------
                 KEEP USER CENTERED
              ------------------------------------------- */

              if (
                mapObj.current
              ) {
                const center =
                  mapObj.current.getCenter();

                const distanceFromCenter =
                  getDistanceKm(
                    center.lat,
                    center.lng,
                    candidateLat,
                    candidateLon
                  ) * 1000;

                if (
                  distanceFromCenter >
                  35
                ) {
                  mapObj.current.panTo(
                    [
                      candidateLat,
                      candidateLon
                    ],
                    {
                      animate:
                        true,

                      duration:
                        0.3
                    }
                  );
                }

                navigationLastPanPositionRef.current =
                  {
                    lat:
                      candidateLat,

                    lon:
                      candidateLon
                  };
              }

              console.log(
                '✅ GPS accepted | accuracy:',
                Math.round(
                  safeAccuracy
                ),
                'm | movement:',
                Math.round(
                  gpsMovementMeters
                ),
                'm | progress:',
                Math.round(
                  Math.max(
                    0,
                    progressForward
                  )
                ),
                'm | remaining:',
                Math.round(
                  remaining
                ),
                'm | walking speed:',
                navigationWalkingSpeedRef.current.toFixed(
                  1
                ),
                'km/h'
              );
            } else {
              console.log(
                '🧊 GPS ignored | accuracy:',
                Math.round(
                  safeAccuracy
                ),
                'm | movement:',
                Math.round(
                  gpsMovementMeters
                ),
                'm | route progress:',
                Math.round(
                  progressForward
                ),
                'm | snap:',
                Number.isFinite(
                  candidateSnapDistance
                )
                  ? Math.round(
                      candidateSnapDistance
                    )
                  : '--',
                'm'
              );
            }

            /* ---------------------------------------------
               HEADING

               Priority:
               1. GPS course
               2. calculated GPS movement bearing
               3. route bearing

               Compass is intentionally NOT used when the
               user is stationary.
            --------------------------------------------- */

            let nextHeading =
              null;

            if (
              isMoving &&
              safeAccuracy <=
                60 &&
              Number.isFinite(
                gpsHeading
              ) &&
              gpsHeading >=
                0 &&
              gpsHeading <=
                360 &&
              reportedSpeed >=
                0.8
            ) {
              nextHeading =
                normalizeAngle(
                  gpsHeading
                );
            } else if (
              isMoving &&
              gpsMovementMeters >=
                5 &&
              previousGps
            ) {
              nextHeading =
                getBearingDegrees(
                  previousGps.lat,
                  previousGps.lon,
                  lat,
                  lon
                );
            } else if (
              positionCanBeAccepted &&
              candidateSegmentIndex !==
                null &&
              routeCoordinatesNow[
                candidateSegmentIndex
              ] &&
              routeCoordinatesNow[
                candidateSegmentIndex +
                  1
              ]
            ) {
              const a =
                routeCoordinatesNow[
                  candidateSegmentIndex
                ];

              const b =
                routeCoordinatesNow[
                  candidateSegmentIndex +
                    1
                ];

              nextHeading =
                getBearingDegrees(
                  a[1],
                  a[0],
                  b[1],
                  b[0]
                );
            }

            if (
              nextHeading !==
              null
            ) {
              const previousHeading =
                navigationHeadingRef.current ??
                nextHeading;

              const rawDelta =
                shortestAngleDelta(
                  previousHeading,
                  nextHeading
                );

              if (
                Math.abs(
                  rawDelta
                ) >= 5 ||
                positionCanBeAccepted
              ) {
                const smoothing =
                  0.22;

                const smoothedHeading =
                  normalizeAngle(
                    previousHeading +
                      rawDelta *
                        smoothing
                  );

                navigationHeadingRef.current =
                  smoothedHeading;

                animateTriangleToHeading(
                  smoothedHeading
                );

                console.log(
                  '🧭 Stable heading:',
                  Math.round(
                    smoothedHeading
                  ),
                  '°'
                );
              }
            }

            /* ---------------------------------------------
               CURRENT MANEUVER
            --------------------------------------------- */

            const displayPosition =
              navigationLastAcceptedPositionRef.current ||
              {
                lat:
                  navigationDisplayedPositionRef.current
                    ?.lat ??
                  lat,

                lon:
                  navigationDisplayedPositionRef.current
                    ?.lon ??
                  lon
              };

            const stepsNow =
              navigationStepsRef.current;

            const stepIndex =
              navigationStepIndexRef.current;

            if (
              stepsNow.length >
                0 &&
              stepsNow[
                stepIndex
              ]?.maneuver
                ?.location
            ) {
              const currentStep =
                stepsNow[
                  stepIndex
                ];

              const [
                stepLon,
                stepLat
              ] =
                currentStep
                  .maneuver
                  .location;

              const distanceToStep =
                getDistanceKm(
                  displayPosition.lat,
                  displayPosition.lon,
                  stepLat,
                  stepLon
                ) * 1000;

              setDistanceToCurrentManeuver(
                Math.max(
                  0,
                  Math.round(
                    distanceToStep
                  )
                )
              );

              if (
                positionCanBeAccepted &&
                distanceToStep <=
                  22 &&
                stepIndex <
                  stepsNow.length -
                    1
              ) {
                navigationStepIndexRef.current =
                  stepIndex +
                  1;

                setCurrentStepIndex(
                  stepIndex +
                    1
                );

                console.log(
                  '➡️ Next navigation step:',
                  stepIndex +
                    1
                );
              }
            }

            /* ---------------------------------------------
               UPDATE LAST RAW GPS FIX
            --------------------------------------------- */

            navigationLastGpsPositionRef.current =
              {
                lat,
                lon
              };

            navigationLastGpsTimeRef.current =
              now;

            console.log(
              '📍 Live GPS:',
              lat,
              lon,
              '| accuracy:',
              Math.round(
                safeAccuracy
              ),
              'm | GPS speed:',
              Number.isFinite(
                speed
              )
                ? speed.toFixed(
                    2
                  )
                : 'null',
              'm/s'
            );
          },
          (
            error
          ) => {
            console.error(
              'GPS tracking error:',
              error
            );
          },
          {
            enableHighAccuracy:
              true,

            maximumAge:
              0,

            timeout:
              15000
          }
        );
    } catch (
      error
    ) {
      console.error(
        'Initial GPS error:',
        error
      );

      alert(
        'Location unavailable'
      );
    }
  }

  /* =======================================================
     CLEAR ROUTE
  ======================================================= */

  function clearRoute() {
    stopNavigationTracking();

    navigationRawHistoryRef.current =
      [];

    navigationOrientationHistoryRef.current =
      [];

    navigationDeviceHeadingRef.current =
      null;

    navigationLastAcceptedRawRef.current =
      null;

    navigationLastPanPositionRef.current =
      null;

    navigationRouteCoordinatesRef.current =
      [];

    navigationRouteProgressRef.current =
      0;

    navigationHeadingRef.current =
      null;

    navigationVisualHeadingRef.current =
      null;

    navigationTargetPositionRef.current =
      null;

    navigationDisplayedPositionRef.current =
      null;

    navigationLastGpsTimeRef.current =
      null;

    navigationLastGpsPositionRef.current =
      null;

    navigationWalkingSpeedRef.current =
      WALKING_SPEED_KMH;

    setNavigationSteps(
      []
    );

    setCurrentStepIndex(
      0
    );

    setDistanceToCurrentManeuver(
      0
    );

    setRemainingDistance(
      0
    );

    setRemainingTime(
      0
    );

    setRouteData(
      null
    );

    setSelectedPandal(
      null
    );

    navigationRouteTotalDistanceRef.current =
      0;

    navigationRemainingDistanceRef.current =
      0;

    navigationRemainingTimeRef.current =
      0;

    navigationOriginalDistanceRef.current =
      0;

    navigationOriginalTimeRef.current =
      0;

    navigationLastAcceptedPositionRef.current =
      null;

    navigationDirectionPositionRef.current =
      null;

    if (
      navigationMarker.current &&
      mapObj.current
    ) {
      mapObj.current.removeLayer(
        navigationMarker.current
      );

      navigationMarker.current =
        null;
    }

    if (
      routeLayer.current &&
      mapObj.current
    ) {
      mapObj.current.removeLayer(
        routeLayer.current
      );

      routeLayer.current =
        null;
    }
  }

  /* =======================================================
     CLEANUP
  ======================================================= */

  useEffect(() => {
    return () => {
      stopNavigationTracking();
    };
  }, []);

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <div>

      {/* =================================================
          HEADER
      ================================================= */}

      <header>
        <div className="brand">
          <img
            src="/maa-durga-logo.png"
            alt="Maa Durga"
            className="brand-logo"
          />

          <h1>
            PujaPath Live
          </h1>
        </div>

        <span>
          {status}
        </span>
      </header>

      <main>

        {/* =================================================
            AUTH
        ================================================= */}

        <section className="auth">

          {recoveryMode ? (
            <>
              <h3>
                🔐 Reset your password
              </h3>

              <input
                placeholder="New password"
                type="password"
                value={
                  newPassword
                }
                onChange={(e) =>
                  setNewPassword(
                    e.target.value
                  )
                }
              />

              <button
                onClick={
                  updatePassword
                }
              >
                Update password
              </button>
            </>
          ) : !session ? (
            <>
              <input
                placeholder="Email"
                value={email}
                onChange={(e) =>
                  setEmail(
                    e.target.value
                  )
                }
              />

              <input
                placeholder="Password"
                type="password"
                value={password}
                onChange={(e) =>
                  setPassword(
                    e.target.value
                  )
                }
              />

              <button
                onClick={() =>
                  auth(
                    'signin'
                  )
                }
              >
                Sign in
              </button>

              <button
                onClick={() =>
                  auth(
                    'signup'
                  )
                }
              >
                Sign up
              </button>

              <button
                onClick={
                  resetPassword
                }
              >
                Forgot password?
              </button>
            </>
          ) : (
            <button
              onClick={() =>
                supabase.auth.signOut()
              }
            >
              Sign out
            </button>
          )}
        </section>

        {/* =================================================
            HERO
        ================================================= */}

        <section className="hero">

          <h2>
            Live pandal map
          </h2>

          <div className="maa-durga-banner">
            <img
              src="/maa-durga.jpg"
              alt="Maa Durga drawing"
              className="maa-durga-image"
            />
          </div>

          <div className="puja-ticker">
            <div className="puja-ticker-track">
              🌺 মা আসছেন • শুভ মহালয়া •
              শারদীয়া শুভেচ্ছা • পুজোর আনন্দে মাতুক
              কলকাতা • সবাইকে শারদীয়ার শুভেচ্ছা •
              🪔 জয় মা দুর্গা 🪔 • 🌺 মা আসছেন •
              শুভ মহালয়া • শারদীয়া শুভেচ্ছা 🌺
            </div>
          </div>

          <select
            className="field"
            value={
              zoneFilter
            }
            onChange={(e) =>
              setZoneFilter(
                e.target.value
              )
            }
          >
            <option value="All zones">
              All zones
            </option>

            <option value="North Kolkata">
              North Kolkata
            </option>

            <option value="Central Kolkata">
              Central Kolkata
            </option>

            <option value="South Kolkata">
              South Kolkata
            </option>
          </select>

          <button
            onClick={
              findNearest
            }
          >
            Nearby essentials
          </button>

          <button
            onClick={() =>
              setShowChecklist(
                true
              )
            }
          >
            📋 Pandal Checklist
          </button>

          <button
            onClick={() =>
              setShowPlanner(
                true
              )
            }
          >
            🗓️ Puja Day Planner
          </button>

          <button
            onClick={() =>
              setShowBudgetTracker(
                true
              )
            }
          >
            💰 Puja Budget Tracker
          </button>

          <button
            onClick={() =>
              setShowFavouriteShare(
                true
              )
            }
          >
            ❤️ Share Favourite List
          </button>

          <WeatherCard />

          <ZoneBadge
            pandals={
              pandals
            }
          />

        </section>

        {/* =================================================
            MAP
        ================================================= */}

        <div
          id="map"
          ref={mapRef}
        ></div>

        {/* =================================================
            ROUTE SUMMARY
        ================================================= */}

        {routeData?.routes
          ?.length > 0 &&
          selectedPandal && (
            <section
              className="card"
              style={{
                marginTop:
                  '18px'
              }}
            >
              <h3>
                🗺️ Route Summary
              </h3>

              <p>
                <strong>
                  Destination:
                </strong>{' '}
                {
                  selectedPandal.name
                }
              </p>

              <p>
                📏 Distance:{' '}
                {(
                  routeData
                    .routes[0]
                    .distance /
                  1000
                ).toFixed(1)}{' '}
                km
              </p>

              <button
                className="btn ghost"
                style={{
                  marginTop:
                    '10px'
                }}
                onClick={
                  clearRoute
                }
              >
                ❌ Clear Route
              </button>

              <p>
                🚶 Walking time:{' '}
                {formatDuration(
                  getWalkingDurationSeconds(
                    routeData
                      .routes[0]
                      .distance
                  )
                )}
              </p>
            </section>
          )}

        {/* =================================================
            LIVE NAVIGATION
        ================================================= */}

        {navigationSteps.length >
          0 && (
          <section
            className="card"
            style={{
              marginTop:
                '18px',

              border:
                '2px solid #176b48',

              padding:
                '18px',

              background:
                '#f4fff8'
            }}
          >
            <h3>
              🧭 Live Navigation
            </h3>

            <div
              style={{
                fontSize:
                  '22px',

                fontWeight:
                  '700',

                marginTop:
                  '10px'
              }}
            >
              {
                getNavigationInstruction(
                  navigationSteps[
                    currentStepIndex
                  ]
                )
              }
            </div>

            <p
              style={{
                fontSize:
                  '18px'
              }}
            >
              📏{' '}
              {distanceToCurrentManeuver >
              0
                ? distanceToCurrentManeuver
                : '--'}{' '}
              meters to maneuver
            </p>

            <p
              style={{
                fontSize:
                  '17px',

                fontWeight:
                  '700'
              }}
            >
              🛣️{' '}
              {Math.max(
                0,
                Math.round(
                  remainingDistance
                )
              )}{' '}
              m remaining
            </p>

            <p
              style={{
                fontSize:
                  '17px',

                fontWeight:
                  '700'
              }}
            >
              ⏱️ ~
              {formatDuration(
                remainingTime
              )}{' '}
              remaining
            </p>

            <p>
              📍 Destination:{' '}
              {
                selectedPandal?.name
              }
            </p>
          </section>
        )}

        {/* =================================================
            PANDAL LIST
        ================================================= */}

        <section
          className="card"
          style={{
            marginTop:
              '18px'
          }}
        >
          <h3>
            🪔 Pandal List
          </h3>

          <input
            className="field"
            placeholder="🔎 Search pandal by name..."
            value={
              searchTerm
            }
            onChange={(e) =>
              setSearchTerm(
                e.target.value
              )
            }
          />

          <p>
            Showing{' '}
            {
              filteredPandals.length
            }{' '}
            pandals
          </p>

          <div
            style={{
              display:
                'grid',

              gap:
                '10px'
            }}
          >
            {filteredPandals.map(
              (pandal) => (
                <div
                  key={
                    pandal.id
                  }
                  style={{
                    padding:
                      '12px',

                    border:
                      '1px solid #ddd',

                    borderRadius:
                      '10px'
                  }}
                >
                  <strong>
                    {
                      pandal.name
                    }
                  </strong>

                  <div>
                    {
                      pandal.zone
                    }
                  </div>

                  <small>
                    {pandal.address ||
                      'Address unavailable'}
                  </small>

                  {/* Nearest 3 */}

                  <button
                    type="button"
                    className="btn ghost"
                    style={{
                      marginTop:
                        '8px'
                    }}
                    onClick={() =>
                      findNearestPandals(
                        pandal
                      )
                    }
                  >
                    📍 Nearest 3
                  </button>

                  {/* Plan route */}

                  <button
                    type="button"
                    className="btn ghost"
                    style={{
                      marginTop:
                        '8px'
                    }}
                    onClick={() =>
                      planRoute(
                        pandal
                      )
                    }
                  >
                    🗺️ Plan route
                  </button>
                </div>
              )
            )}
          </div>

          {/* =================================================
              NEAREST 3 RESULT
          ================================================= */}

          {nearestPandals.length >
            0 && (
            <div
              className="card"
              style={{
                marginTop:
                  '18px'
              }}
            >
              <h3>
                📍 Nearest 3 Pandals
              </h3>

              <p>
                🪔 Nearby pandals from
                your selected pandal
              </p>

              {nearestPandals.map(
                (
                  pandal,
                  index
                ) => {
                  const meters =
                    Math.round(
                      pandal.distanceKm *
                        1000
                    );

                  const walkingMinutes =
                    Math.max(
                      1,
                      Math.round(
                        (
                          pandal.distanceKm /
                          4.5
                        ) *
                          60
                      )
                    );

                  return (
                    <div
                      key={
                        pandal.id
                      }
                      style={{
                        padding:
                          '12px',

                        border:
                          '1px solid #ddd',

                        borderRadius:
                          '10px',

                        marginTop:
                          '10px'
                      }}
                    >
                      <strong>
                        {
                          index + 1
                        }️⃣{' '}
                        {
                          pandal.name
                        }
                      </strong>

                      <div>
                        📏{' '}
                        {
                          meters
                        }{' '}
                        m
                      </div>

                      <div>
                        🚶{' '}
                        {
                          walkingMinutes
                        }{' '}
                        min walk
                      </div>

                      <small>
                        {pandal.address ||
                          'Address unavailable'}
                      </small>
                    </div>
                  );
                }
              )}
            </div>
          )}
        </section>

        {/* =================================================
            NEARBY ESSENTIALS
        ================================================= */}

        <section
          className="card"
          style={{
            marginTop:
              '18px'
          }}
        >
          <h3>
            📍 Nearby Essentials &
            Transport
          </h3>

          {nearby.length ===
          0 ? (
            <p>
              Click “Nearby essentials”
              to find nearby places.
            </p>
          ) : (
            <div
              style={{
                display:
                  'grid',

                gap:
                  '10px'
              }}
            >
              {nearby.map(
                (item) => {
                  const tags =
                    item.tags ||
                    {};

                  const itemLat =
                    item.lat ??
                    item.center
                      ?.lat;

                  const itemLon =
                    item.lon ??
                    item.center
                      ?.lon;

                  const distance =
                    userLocation &&
                    itemLat != null &&
                    itemLon != null
                      ? getDistanceKm(
                          userLocation.lat,
                          userLocation.lon,
                          itemLat,
                          itemLon
                        ).toFixed(
                          1
                        )
                      : null;

                  let type =
                    '📍 Place';

                  if (
                    tags.highway ===
                      'bus_stop' ||
                    tags.bus ===
                      'yes'
                  ) {
                    type =
                      '🚌 Bus Stop';
                  } else if (
                    tags.railway ===
                      'station' &&
                    tags.station ===
                      'subway'
                  ) {
                    type =
                      '🚇 Metro';
                  } else if (
                    tags.railway ===
                    'station'
                  ) {
                    type =
                      '🚆 Railway Station';
                  } else if (
                    tags.amenity ===
                    'hospital'
                  ) {
                    type =
                      '🏥 Hospital';
                  } else if (
                    tags.amenity ===
                    'police'
                  ) {
                    type =
                      '👮 Police';
                  } else if (
                    tags.amenity ===
                    'toilets'
                  ) {
                    type =
                      '🚻 Toilet';
                  } else if (
                    tags.amenity ===
                    'restaurant'
                  ) {
                    type =
                      '🍴 Restaurant';
                  } else if (
                    tags.tourism ===
                    'hotel'
                  ) {
                    type =
                      '🏨 Hotel';
                  } else if (
                    tags.amenity ===
                    'drinking_water'
                  ) {
                    type =
                      '💧 Drinking Water';
                  }

                  const name =
                    tags.name ||
                    tags[
                      'name:en'
                    ] ||
                    tags[
                      'name:bn'
                    ] ||
                    'Unnamed place';

                  return (
                    <div
                      key={`${item.type}-${item.id}`}
                      style={{
                        padding:
                          '12px',

                        border:
                          '1px solid #ddd',

                        borderRadius:
                          '10px'
                      }}
                    >
                      <strong>
                        {
                          type
                        }
                      </strong>

                      <div>
                        {
                          name
                        }
                      </div>

                      {tags[
                        'addr:street'
                      ] && (
                        <small>
                          {
                            tags[
                              'addr:street'
                            ]
                          }
                        </small>
                      )}

                      {distance && (
                        <small
                          style={{
                            display:
                              'block',

                            marginTop:
                              '4px',

                            fontWeight:
                              '700'
                          }}
                        >
                          📏{' '}
                          {
                            distance
                          }{' '}
                          km away
                        </small>
                      )}

                      {itemLat !=
                        null &&
                        itemLon !=
                          null && (
                          <button
                            className="btn ghost"
                            style={{
                              marginTop:
                                '8px'
                            }}
                            onClick={() =>
                              window.open(
                                `https://www.openstreetmap.org/?mlat=${itemLat}&mlon=${itemLon}#map=18/${itemLat}/${itemLon}`,
                                '_blank',
                                'noopener,noreferrer'
                              )
                            }
                          >
                            🗺️ Open Map ↗
                          </button>
                        )}
                    </div>
                  );
                }
              )}
            </div>
          )}
        </section>

        {/* =================================================
            CHECKLIST
        ================================================= */}

        {showChecklist && (
          <Checklist
            pandals={
              pandals
            }
            onClose={() =>
              setShowChecklist(
                false
              )
            }
          />
        )}

        {/* =================================================
            PLANNER
        ================================================= */}

        {showPlanner && (
          <PujaPlanner
            pandals={
              pandals
            }
            onClose={() =>
              setShowPlanner(
                false
              )
            }
          />
        )}

        {/* =================================================
            BUDGET
        ================================================= */}

        {showBudgetTracker && (
          <BudgetTracker
            onClose={() =>
              setShowBudgetTracker(
                false
              )
            }
          />
        )}

        {/* =================================================
            FAVOURITE SHARE
        ================================================= */}

        {showFavouriteShare && (
          <FavouriteShare
            pandals={
              pandals
            }
            onClose={() =>
              setShowFavouriteShare(
                false
              )
            }
          />
        )}

           {infoPage && (
  <InfoPage
    page={infoPage}
    onBack={() => setInfoPage(null)}
  />
)}

</main>

      {/* =================================================
          FOOTER
      ================================================= */}
      <footer className="site-footer">

        <div className="footer-links">

  <button
    type="button"
    onClick={() => setInfoPage("About Us")}
  >
    About Us
  </button>

  <button
    type="button"
    onClick={() => setInfoPage("Our Vision")}
  >
    Our Vision
  </button>

  <button
    type="button"
    onClick={() => setInfoPage("Privacy Policy")}
  >
    Privacy Policy
  </button>

  <button
    type="button"
    onClick={() => setInfoPage("Terms")}
  >
    Terms
  </button>

  <button
    type="button"
    onClick={() => setInfoPage("Location Policy")}
  >
    Location Policy
  </button>

  <button
    type="button"
    onClick={() => setInfoPage("Safety")}
  >
    Safety
  </button>

  <button
    type="button"
    onClick={() => setInfoPage("Contact")}
  >
    Contact
  </button>

  <button
    type="button"
    onClick={() => setInfoPage("User Guide")}
  >
    User Guide
  </button>

</div>

        <div className="footer-copy">
          © 2026 PujaPath Live
        </div>

        <div className="footer-created">
          Created by Raju ❤️
        </div>

      </footer>
    </div>
  );
}

/* =========================================================
   ESCAPE HTML
========================================================= */

const esc = (
  value
) =>
  String(value).replace(
    /[&<>"']/g,
    (character) =>
      ({
        '&':
          '&amp;',

        '<':
          '&lt;',

        '>':
          '&gt;',

        '"':
          '&quot;',

        "'":
          '&#39;'
      })[
        character
      ]
  );

/* =========================================================
   REACT ROOT
========================================================= */

createRoot(
  document.getElementById(
    'root'
  )
).render(
  <App />
);
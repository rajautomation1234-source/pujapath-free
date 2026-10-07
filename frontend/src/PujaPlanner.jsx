import React, { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "./PujaPlanner.css";

export default function PujaPlanner({ pandals = [], onClose }) {
  // =========================
  // ACTIVE DAY
  // =========================
  const [activeDay, setActiveDay] = useState(() => {
    const savedDay = localStorage.getItem("pujapath_active_day");
    return savedDay ? Number(savedDay) : 1;
  });

  // =========================
  // DAYS
  // =========================
  const [days, setDays] = useState(() => {
    const savedDays = localStorage.getItem("pujapath_planner_days");

    if (savedDays) {
      try {
        const parsed = JSON.parse(savedDays);

        if (
          Array.isArray(parsed) &&
          parsed.length > 0
        ) {
          return parsed;
        }
      } catch (error) {
        console.error(
          "Failed to load planner data:",
          error
        );
      }
    }

    return [
      {
        id: 1,
        name: "Day 1",
        pandals: [],
      },
    ];
  });

  // =========================
  // UI STATE
  // =========================
  const [
    showPandalPicker,
    setShowPandalPicker,
  ] = useState(false);

  const [
    routeInfo,
    setRouteInfo,
  ] = useState({
    distance: 0,
    duration: 0,
  });

  // =========================
  // TRANSPORT STATE
  // =========================
  const [
    selectedTransportPandal,
    setSelectedTransportPandal,
  ] = useState(null);

  const [
    transportInfo,
    setTransportInfo,
  ] = useState({
    metro: null,
    train: null,
    bus: null,
  });

  const [
    transportLoading,
    setTransportLoading,
  ] = useState(false);

  const [
    transportError,
    setTransportError,
  ] = useState("");

  // Fast in-memory cache
  const transportCache =
    useRef(new Map());

  // =========================
  // API
  // =========================
  const API =
    import.meta.env.VITE_API_URL ||
    "http://localhost:8000";

  // =========================
  // MAP REFS
  // =========================
  const plannerMapRef =
    useRef(null);

  const plannerMapObject =
    useRef(null);

  const plannerRouteLayer =
    useRef(null);

  const plannerMarkersLayer =
    useRef(null);

  const transportMarker =
    useRef(null);

  // =========================
  // SAVE DAYS
  // =========================
  useEffect(() => {
    localStorage.setItem(
      "pujapath_planner_days",
      JSON.stringify(days)
    );
  }, [days]);

  // =========================
  // SAVE ACTIVE DAY
  // =========================
  useEffect(() => {
    localStorage.setItem(
      "pujapath_active_day",
      String(activeDay)
    );
  }, [activeDay]);

  // =========================
  // ADD NEW DAY
  // =========================
  const addNewDay = () => {
    const nextId =
      days.length + 1;

    setDays((previous) => [
      ...previous,
      {
        id: nextId,
        name: `Day ${nextId}`,
        pandals: [],
      },
    ]);

    setActiveDay(nextId);
  };

  // =========================
  // PANDAL HELPERS
  // =========================
  const getPandalId = (pandal) => {
    return (
      pandal.id ??
      pandal._id ??
      pandal.name
    );
  };

  const getPandalName = (pandal) => {
    return (
      pandal.name ??
      pandal.pandal_name ??
      pandal.title ??
      "Unnamed Pandal"
    );
  };

  // =========================
  // ACTIVE DAY
  // =========================
  const activeDayData =
    days.find(
      (day) =>
        day.id === activeDay
    );

  const activeDayPandals =
    activeDayData?.pandals ?? [];

  // =========================
  // DISTANCE
  // =========================
  const getDistanceKm = (
    lat1,
    lon1,
    lat2,
    lon2
  ) => {
    const R = 6371;

    const dLat =
      ((lat2 - lat1) *
        Math.PI) /
      180;

    const dLon =
      ((lon2 - lon1) *
        Math.PI) /
      180;

    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(
        (lat1 * Math.PI) /
          180
      ) *
        Math.cos(
          (lat2 * Math.PI) /
            180
        ) *
        Math.sin(dLon / 2) ** 2;

    const c =
      2 *
      Math.atan2(
        Math.sqrt(a),
        Math.sqrt(1 - a)
      );

    return R * c;
  };

  // =========================
  // CLOSE TRANSPORT POPUP
  // =========================
  const closeTransportPopup = () => {
    setSelectedTransportPandal(
      null
    );

    setTransportInfo({
      metro: null,
      train: null,
      bus: null,
    });

    setTransportError("");

    if (
      transportMarker.current &&
      plannerMapObject.current
    ) {
      plannerMapObject.current.removeLayer(
        transportMarker.current
      );

      transportMarker.current =
        null;
    }
  };

  // =========================
  // SHOW TRANSPORT ON MAP
  // =========================
  const showTransportOnMap = (
    transport,
    type
  ) => {
    if (
      !transport ||
      !plannerMapObject.current
    ) {
      return;
    }

    const map =
      plannerMapObject.current;

    const lat = Number(
      transport.lat
    );

    const lon = Number(
      transport.lon
    );

    if (
      !Number.isFinite(lat) ||
      !Number.isFinite(lon)
    ) {
      return;
    }

    // Close transport popup first
    closeTransportPopup();

    // Remove old marker
    if (
      transportMarker.current
    ) {
      map.removeLayer(
        transportMarker.current
      );

      transportMarker.current =
        null;
    }

    // Wait for popup to close
    window.setTimeout(() => {
      // Make sure Leaflet knows its size
      map.invalidateSize(true);

      // Bring map into view
      plannerMapRef.current?.scrollIntoView(
        {
          behavior: "smooth",
          block: "center",
        }
      );

      // Zoom to transport
      map.setView(
        [lat, lon],
        17,
        {
          animate: true,
        }
      );

      // Show transport marker
      transportMarker.current =
        L.marker([
          lat,
          lon,
        ])
          .addTo(map)
          .bindPopup(
            `<b>${type}</b><br>${transport.name}`
          )
          .openPopup();

    }, 200);
  };

  // =========================
  // LOAD TRANSPORT
  // =========================
  const loadTransportInfo =
    async (pandal) => {
      const lat = Number(
        pandal.latitude
      );

      const lon = Number(
        pandal.longitude
      );

      const pandalId =
        getPandalId(pandal);

      const cacheKey =
        `pujapath_transport_${pandalId}`;

      // Open popup immediately
      setSelectedTransportPandal(
        pandal
      );

      setTransportError("");

      // =========================
      // MEMORY CACHE
      // =========================
      const memoryCached =
        transportCache.current.get(
          cacheKey
        );

      if (memoryCached) {
        setTransportInfo(
          memoryCached
        );

        setTransportLoading(
          false
        );

        return;
      }

      // =========================
      // LOCAL STORAGE CACHE
      // =========================
      try {
        const saved =
          localStorage.getItem(
            cacheKey
          );

        if (saved) {
          const parsed =
            JSON.parse(saved);

          const age =
            Date.now() -
            Number(
              parsed.savedAt || 0
            );

          // Cache for 6 hours
          if (
            parsed.data &&
            age <
              6 *
                60 *
                60 *
                1000
          ) {
            transportCache.current.set(
              cacheKey,
              parsed.data
            );

            setTransportInfo(
              parsed.data
            );

            setTransportLoading(
              false
            );

            return;
          }
        }
      } catch (error) {
        console.warn(
          "Transport cache read failed:",
          error
        );
      }

      setTransportInfo({
        metro: null,
        train: null,
        bus: null,
      });

      setTransportLoading(
        true
      );

      // =========================
      // VALID COORDINATES
      // =========================
      if (
        !Number.isFinite(lat) ||
        !Number.isFinite(lon)
      ) {
        setTransportError(
          "This pandal does not have valid map coordinates."
        );

        setTransportLoading(
          false
        );

        return;
      }

      // =========================
      // METRO CHECK
      // =========================
      const isMetro = (item) => {
        const tags =
          item.tags || {};

        return (
          tags.station ===
            "subway" ||
          tags.subway ===
            "yes" ||
          tags.railway ===
            "subway_entrance" ||
          (
            tags.railway ===
              "station" &&
            tags.subway ===
              "yes"
          )
        );
      };

      // =========================
      // TRAIN CHECK
      // =========================
      const isTrain = (item) => {
        const tags =
          item.tags || {};

        return (
          !isMetro(item) &&
          (
            tags.railway ===
              "station" ||
            tags.railway ===
              "halt" ||
            tags.railway ===
              "stop"
          )
        );
      };

      // =========================
      // BUS CHECK
      // =========================
      const isBus = (item) => {
        const tags =
          item.tags || {};

        return (
          tags.highway ===
            "bus_stop" ||
          tags.amenity ===
            "bus_station" ||
          (
            tags.public_transport ===
              "platform" &&
            tags.bus === "yes"
          )
        );
      };

      // =========================
      // NEAREST
      // =========================
      const nearest = (
        items,
        predicate
      ) => {
        return (
          items
            .filter(predicate)
            .sort(
              (a, b) =>
                a.distance -
                b.distance
            )[0] ||
          null
        );
      };

      // =========================
      // OVERPASS QUERY
      // =========================
      const query = `
[out:json][timeout:15];

(
  nwr(
    around:3000,
    ${lat},
    ${lon}
  )["station"="subway"];

  nwr(
    around:3000,
    ${lat},
    ${lon}
  )["subway"="yes"];

  nwr(
    around:3000,
    ${lat},
    ${lon}
  )["railway"="subway_entrance"];

  nwr(
    around:3000,
    ${lat},
    ${lon}
  )["railway"="station"];

  nwr(
    around:3000,
    ${lat},
    ${lon}
  )["railway"="halt"];

  nwr(
    around:3000,
    ${lat},
    ${lon}
  )["railway"="stop"];

  nwr(
    around:3000,
    ${lat},
    ${lon}
  )["highway"="bus_stop"];

  nwr(
    around:3000,
    ${lat},
    ${lon}
  )["amenity"="bus_station"];

  nwr(
    around:3000,
    ${lat},
    ${lon}
  )["public_transport"="platform"]
    ["bus"="yes"];
);

out center tags;
`;

      // =========================
      // SERVERS
      // =========================
      const servers = [
        "https://overpass-api.de/api/interpreter",
        "https://overpass.kumi.systems/api/interpreter",
      ];

      try {
        let data = null;

        // =========================
        // TRY BACKEND FIRST
        // =========================
        try {
          const controller =
            new AbortController();

          const timeoutId =
            window.setTimeout(
              () =>
                controller.abort(),
              2500
            );

          const response =
            await fetch(
              `${API}/api/transport?lat=${encodeURIComponent(
                lat
              )}&lon=${encodeURIComponent(
                lon
              )}&radius=3000`,
              {
                signal:
                  controller.signal,
              }
            );

          window.clearTimeout(
            timeoutId
          );

          if (
            response.ok
          ) {
            const backendData =
              await response.json();

            if (
              backendData &&
              (
                "metro" in
                  backendData ||
                "train" in
                  backendData ||
                "bus" in
                  backendData
              )
            ) {
              const result = {
                metro:
                  backendData.metro ||
                  null,

                train:
                  backendData.train ||
                  null,

                bus:
                  backendData.bus ||
                  null,
              };

              transportCache.current.set(
                cacheKey,
                result
              );

              try {
                localStorage.setItem(
                  cacheKey,
                  JSON.stringify({
                    savedAt:
                      Date.now(),
                    data: result,
                  })
                );
              } catch (error) {
                console.warn(
                  "Transport cache write failed:",
                  error
                );
              }

              setTransportInfo(
                result
              );

              setTransportLoading(
                false
              );

              return;
            }
          }
        } catch (error) {
          console.warn(
            "Backend transport request skipped:",
            error
          );
        }

        // =========================
        // PUBLIC OVERPASS FALLBACK
        // =========================
        const fetchFromServer =
          async (endpoint) => {
            const controller =
              new AbortController();

            const timeoutId =
              window.setTimeout(
                () =>
                  controller.abort(),
                6500
              );

            try {
              const response =
                await fetch(
                  `${endpoint}?data=${encodeURIComponent(
                    query
                  )}`,
                  {
                    method:
                      "GET",

                    signal:
                      controller.signal,
                  }
                );

              if (
                !response.ok
              ) {
                throw new Error(
                  `HTTP ${response.status}`
                );
              }

              const result =
                await response.json();

              if (
                !result ||
                !Array.isArray(
                  result.elements
                )
              ) {
                throw new Error(
                  "Invalid Overpass response"
                );
              }

              return result;

            } finally {
              window.clearTimeout(
                timeoutId
              );
            }
          };

        // Run both servers together
        const settled =
          await Promise.allSettled(
            servers.map(
              (server) =>
                fetchFromServer(
                  server
                )
            )
          );

        const successful =
          settled.find(
            (result) =>
              result.status ===
                "fulfilled" &&
              result.value &&
              Array.isArray(
                result.value
                  .elements
              )
          );

        if (
          successful
        ) {
          data =
            successful.value;
        }

        if (!data) {
          throw new Error(
            "Transport service unavailable"
          );
        }

        // =========================
        // CONVERT RESULTS
        // =========================
        const items =
          data.elements
            .map((item) => {
              const itemLat =
                Number.isFinite(
                  Number(
                    item.lat
                  )
                )
                  ? Number(
                      item.lat
                    )
                  : Number(
                      item.center?.lat
                    );

              const itemLon =
                Number.isFinite(
                  Number(
                    item.lon
                  )
                )
                  ? Number(
                      item.lon
                    )
                  : Number(
                      item.center?.lon
                    );

              if (
                !Number.isFinite(
                  itemLat
                ) ||
                !Number.isFinite(
                  itemLon
                )
              ) {
                return null;
              }

              const tags =
                item.tags || {};

              const name =
                tags.name ||
                tags["name:en"] ||
                tags.ref ||
                "Unnamed Stop";

              return {
                name,
                lat: itemLat,
                lon: itemLon,
                distance:
                  getDistanceKm(
                    lat,
                    lon,
                    itemLat,
                    itemLon
                  ),
                tags,
              };
            })
            .filter(Boolean);

        // =========================
        // RESULT
        // =========================
        const result = {
          metro:
            nearest(
              items,
              isMetro
            ),

          train:
            nearest(
              items,
              isTrain
            ),

          bus:
            nearest(
              items,
              isBus
            ),
        };

        // =========================
        // CACHE RESULT
        // =========================
        transportCache.current.set(
          cacheKey,
          result
        );

        try {
          localStorage.setItem(
            cacheKey,
            JSON.stringify({
              savedAt:
                Date.now(),
              data: result,
            })
          );
        } catch (error) {
          console.warn(
            "Transport cache write failed:",
            error
          );
        }

        setTransportInfo(
          result
        );

      } catch (error) {
        console.error(
          "Transport search failed:",
          error
        );

        setTransportError(
          "Could not load transport information. Please try again."
        );

      } finally {
        setTransportLoading(
          false
        );
      }
    };

  // =========================
  // ADD / REMOVE PANDAL
  // =========================
  const togglePandalInActiveDay =
    (pandal) => {
      const pandalId =
        getPandalId(pandal);

      const alreadyAdded =
        activeDayPandals.some(
          (item) =>
            getPandalId(item) ===
            pandalId
        );

      // =========================
      // REMOVE
      // =========================
      if (alreadyAdded) {
        setDays((previous) =>
          previous.map(
            (day) => {
              if (
                day.id !==
                activeDay
              ) {
                return day;
              }

              return {
                ...day,
                pandals:
                  day.pandals.filter(
                    (item) =>
                      getPandalId(
                        item
                      ) !==
                      pandalId
                  ),
              };
            }
          )
        );

        if (
          selectedTransportPandal &&
          getPandalId(
            selectedTransportPandal
          ) === pandalId
        ) {
          closeTransportPopup();
        }

        return;
      }

      // =========================
      // ADD
      // =========================
      setDays((previous) =>
        previous.map(
          (day) => {
            if (
              day.id !==
              activeDay
            ) {
              return day;
            }

            return {
              ...day,
              pandals: [
                ...day.pandals,
                pandal,
              ],
            };
          }
        )
      );

      // IMPORTANT:
      // Transport does NOT open
      // when adding a pandal.
      //
      // User clicks pandal name
      // to open transport.
    };

  // =========================
  // MOVE PANDAL
  // =========================
  const movePandal = (
    index,
    direction
  ) => {
    setDays((previous) =>
      previous.map(
        (day) => {
          if (
            day.id !==
            activeDay
          ) {
            return day;
          }

          const newIndex =
            index + direction;

          if (
            newIndex < 0 ||
            newIndex >=
              day.pandals.length
          ) {
            return day;
          }

          const updatedPandals =
            [...day.pandals];

          [
            updatedPandals[index],
            updatedPandals[
              newIndex
            ],
          ] = [
            updatedPandals[
              newIndex
            ],
            updatedPandals[index],
          ];

          return {
            ...day,
            pandals:
              updatedPandals,
          };
        }
      )
    );
  };

  // =========================
  // CREATE LEAFLET MAP
  // =========================
  useEffect(() => {
    if (!plannerMapRef.current) {
      return;
    }

    const map =
      L.map(
        plannerMapRef.current
      ).setView(
        [22.5726, 88.3639],
        12
      );

    L.tileLayer(
      "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
      {
        attribution:
          "© OpenStreetMap contributors",

        maxZoom: 19,
      }
    ).addTo(map);

    plannerMarkersLayer.current =
      L.layerGroup().addTo(
        map
      );

    plannerMapObject.current =
      map;

    return () => {
      map.remove();

      plannerMapObject.current =
        null;

      plannerMarkersLayer.current =
        null;

      plannerRouteLayer.current =
        null;

      transportMarker.current =
        null;
    };
  }, []);

  // =========================
  // MAP MARKERS + ROAD ROUTE
  // =========================
  useEffect(() => {
    const map =
      plannerMapObject.current;

    if (!map) {
      return;
    }

    // Remove previous route
    if (
      plannerRouteLayer.current
    ) {
      map.removeLayer(
        plannerRouteLayer.current
      );

      plannerRouteLayer.current =
        null;
    }

    // Remove old markers
    plannerMarkersLayer.current?.clearLayers();

    // Valid coordinates only
    const validPandals =
      activeDayPandals.filter(
        (pandal) =>
          Number.isFinite(
            Number(
              pandal.latitude
            )
          ) &&
          Number.isFinite(
            Number(
              pandal.longitude
            )
          )
      );

    // =========================
    // NO PANDALS
    // =========================
    if (
      validPandals.length ===
      0
    ) {
      setRouteInfo({
        distance: 0,
        duration: 0,
      });

      return;
    }

    // =========================
    // NUMBERED MARKERS
    // =========================
    validPandals.forEach(
      (
        pandal,
        index
      ) => {
        const lat =
          Number(
            pandal.latitude
          );

        const lon =
          Number(
            pandal.longitude
          );

        const numberedIcon =
          L.divIcon({
            className:
              "planner-number-icon",

            html: `
              <div style="
                width:34px;
                height:34px;
                border-radius:50%;
                background:#176b48;
                color:white;
                display:flex;
                align-items:center;
                justify-content:center;
                font-size:16px;
                font-weight:700;
                border:3px solid white;
                box-shadow:0 2px 6px rgba(0,0,0,0.35);
              ">
                ${index + 1}
              </div>
            `,

            iconSize: [
              34,
              34,
            ],

            iconAnchor: [
              17,
              17,
            ],
          });

        const marker =
          L.marker(
            [lat, lon],
            {
              icon:
                numberedIcon,
            }
          ).bindPopup(
            `<b>${index + 1}. ${getPandalName(
              pandal
            )}</b>`
          );

        plannerMarkersLayer.current?.addLayer(
          marker
        );
      }
    );

    // =========================
    // ONE PANDAL
    // =========================
    if (
      validPandals.length ===
      1
    ) {
      const first =
        validPandals[0];

      map.setView(
        [
          Number(
            first.latitude
          ),
          Number(
            first.longitude
          ),
        ],
        16
      );

      setRouteInfo({
        distance: 0,
        duration: 0,
      });

      return;
    }

    // =========================
    // ROUTE POINTS
    // =========================
    const points =
      validPandals
        .map(
          (pandal) =>
            `${Number(
              pandal.longitude
            )},${Number(
              pandal.latitude
            )}`
        )
        .join(";");

    // =========================
    // ROAD ROUTE
    // =========================
    const loadRoute =
      async () => {
        try {
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
              "Route API error"
            );
          }

          const data =
            await response.json();

          const route =
            data.routes?.[0];

          if (
            !route?.geometry
              ?.coordinates
              ?.length
          ) {
            throw new Error(
              "No route returned"
            );
          }

          setRouteInfo({
            distance:
              Number(
                route.distance
              ) || 0,

            duration:
              Number(
                route.duration
              ) || 0,
          });

          const routeLatLngs =
            route.geometry.coordinates.map(
              ([
                longitude,
                latitude,
              ]) => [
                latitude,
                longitude,
              ]
            );

          plannerRouteLayer.current =
            L.polyline(
              routeLatLngs,
              {
                color:
                  "#176b48",

                weight: 6,

                opacity: 0.9,
              }
            ).addTo(map);

          const bounds =
            L.latLngBounds(
              routeLatLngs
            );

          map.fitBounds(
            bounds,
            {
              padding: [
                30,
                30,
              ],
            }
          );

        } catch (error) {
          console.error(
            "Road route error:",
            error
          );

          setRouteInfo({
            distance: 0,
            duration: 0,
          });
        }
      };

    loadRoute();

  }, [
    activeDayPandals,
    API,
  ]);

  // =========================
  // RENDER
  // =========================
  return (
    <div className="puja-planner">

      {/* =========================
          HEADER
      ========================= */}
      <div className="puja-planner-header">

        <h1>
          🗓️ Puja Day Planner
        </h1>

        <button
          type="button"
          onClick={onClose}
        >
          ×
        </button>

      </div>

      <p>
        Plan your pandal visits
        day by day
      </p>

      {/* =========================
          DAYS
      ========================= */}
      <div className="planner-days">

        {days.map(
          (day) => (
            <button
              key={day.id}
              type="button"
              className={
                activeDay ===
                day.id
                  ? "day-active"
                  : ""
              }
              onClick={() => {
                setActiveDay(
                  day.id
                );

                closeTransportPopup();
              }}
            >
              🗓️{" "}
              {day.name}
            </button>
          )
        )}

        <button
          type="button"
          onClick={
            addNewDay
          }
        >
          + Add Day
        </button>

      </div>

      {/* =========================
          ADD PANDAL
      ========================= */}
      <button
        type="button"
        onClick={() =>
          setShowPandalPicker(
            true
          )
        }
      >
        + Add Pandal
      </button>

      {/* =========================
          MAIN CONTENT
      ========================= */}
      <div className="planner-content">

        {/* LEFT */}
        <div className="selected-pandals">

          <h2>
            {activeDayData?.name ||
              "Day 1"}
          </h2>

          {activeDayPandals.length ===
          0 ? (

            <p>
              No pandals added
              to this day yet.
            </p>

          ) : (

            <ol>

              {activeDayPandals.map(
                (
                  pandal,
                  index
                ) => (

                  <li
                    key={getPandalId(
                      pandal
                    )}
                    className="planner-pandal-item"
                  >

                    {/* PANDAL NAME */}
                    {/* Click name to open transport */}
                    <button
                      type="button"
                      className="select-transport-pandal"
                      onClick={() =>
                        loadTransportInfo(
                          pandal
                        )
                      }
                    >
                      {getPandalName(
                        pandal
                      )}
                    </button>

                    {/* ACTION BUTTONS */}
                    <div className="planner-pandal-actions">

                      {/* UP */}
                      <button
                        type="button"
                        onClick={() =>
                          movePandal(
                            index,
                            -1
                          )
                        }
                        disabled={
                          index ===
                          0
                        }
                        title="Move earlier"
                      >
                        ↑
                      </button>

                      {/* DOWN */}
                      <button
                        type="button"
                        onClick={() =>
                          movePandal(
                            index,
                            1
                          )
                        }
                        disabled={
                          index ===
                          activeDayPandals.length -
                            1
                        }
                        title="Move later"
                      >
                        ↓
                      </button>

                      {/* REMOVE */}
                      <button
                        type="button"
                        onClick={() =>
                          togglePandalInActiveDay(
                            pandal
                          )
                        }
                        title="Remove pandal"
                        className="remove-pandal-button"
                      >
                        ✕
                      </button>

                    </div>

                  </li>

                )
              )}

            </ol>

          )}

        </div>

        {/* =========================
            MAP
        ========================= */}
        <div className="planner-map">

          <h2>
            🗺️ Route Map
          </h2>

          <div
            ref={
              plannerMapRef
            }
            className="map-placeholder"
            style={{
              height:
                "500px",

              width:
                "100%",
            }}
          />

        </div>

      </div>

      {/* =========================
          ROUTE SUMMARY
      ========================= */}
      <div className="route-summary">

        <div>
          📍{" "}
          <strong>
            {
              activeDayPandals.length
            }
          </strong>{" "}
          Pandals
        </div>

        <div>
          🛣️ Route Distance:{" "}
          <strong>

            {routeInfo.distance >
            0
              ? `${(
                  routeInfo.distance /
                  1000
                ).toFixed(
                  1
                )} km`
              : "--"}

          </strong>
        </div>

        <div>
          ⏱️ Estimated Time:{" "}
          <strong>

            {routeInfo.duration >
            0
              ? (() => {
                  const totalMinutes =
                    Math.round(
                      routeInfo.duration /
                        60
                    );

                  const hours =
                    Math.floor(
                      totalMinutes /
                        60
                    );

                  const minutes =
                    totalMinutes %
                    60;

                  if (
                    hours >
                    0
                  ) {
                    return `${hours} hr ${minutes} min`;
                  }

                  return `${minutes} min`;
                })()
              : "--"}

          </strong>
        </div>

      </div>

      {/* =========================
          PANDAL PICKER
      ========================= */}
      {showPandalPicker && (

        <div className="pandal-picker">

          <h2>
            Select a Pandal
          </h2>

          <div className="pandal-picker-list">

            {pandals.map(
              (pandal) => {

                const id =
                  getPandalId(
                    pandal
                  );

                const alreadyAdded =
                  activeDayPandals.some(
                    (item) =>
                      getPandalId(
                        item
                      ) === id
                  );

                return (

                  <button
                    key={id}
                    type="button"
                    className={`pandal-option ${
                      alreadyAdded
                        ? "pandal-option-added"
                        : ""
                    }`}
                    onClick={() =>
                      togglePandalInActiveDay(
                        pandal
                      )
                    }
                  >

                    {getPandalName(
                      pandal
                    )}

                    {alreadyAdded
                      ? " ✓ Added — Click to Remove"
                      : ""}

                  </button>

                );
              }
            )}

          </div>

          <button
            type="button"
            onClick={() =>
              setShowPandalPicker(
                false
              )
            }
          >
            Done
          </button>

        </div>

      )}

      {/* =========================
          TRANSPORT POPUP
      ========================= */}
      {selectedTransportPandal && (

        <div
          className="transport-popup-overlay"
          role="dialog"
          aria-modal="true"
        >

          <div className="transport-popup">

            {/* POPUP HEADER */}
            <div className="transport-popup-header">

              <div>

                <h2>
                  🚉 Transport Information
                </h2>

                <p>
                  Nearest transport
                  for{" "}
                  <strong>
                    {getPandalName(
                      selectedTransportPandal
                    )}
                  </strong>
                </p>

              </div>

              <button
                type="button"
                className="transport-popup-close"
                onClick={
                  closeTransportPopup
                }
                aria-label="Close transport information"
              >
                ✕
              </button>

            </div>

            {/* LOADING */}
            {transportLoading ? (

              <div className="transport-popup-loading">

                🔄 Finding nearest
                Metro, Train and
                Bus...

              </div>

            ) : transportError ? (

              <div className="transport-popup-error">

                <p>
                  ❌{" "}
                  {transportError}
                </p>

                <button
                  type="button"
                  onClick={() =>
                    loadTransportInfo(
                      selectedTransportPandal
                    )
                  }
                >
                  🔄 Try Again
                </button>

              </div>

            ) : (

              <div className="transport-popup-grid">

                {/* =========================
                    METRO
                ========================= */}
                <div className="transport-popup-card">

                  <div className="transport-popup-icon">
                    🚇
                  </div>

                  <h3>
                    Metro
                  </h3>

                  {transportInfo.metro ? (

                    <>

                      <p className="transport-popup-name">
                        {
                          transportInfo
                            .metro
                            .name
                        }
                      </p>

                      <p className="transport-popup-distance">
                        📍{" "}
                        {transportInfo.metro.distance.toFixed(
                          2
                        )}{" "}
                        km away
                      </p>

                      <button
                        type="button"
                        className="transport-map-button"
                        onClick={() =>
                          showTransportOnMap(
                            transportInfo.metro,
                            "🚇 Metro"
                          )
                        }
                      >
                        📍 View on Map
                      </button>

                    </>

                  ) : (

                    <p className="transport-popup-not-found">
                      No nearby Metro
                      found
                    </p>

                  )}

                </div>

                {/* =========================
                    TRAIN
                ========================= */}
                <div className="transport-popup-card">

                  <div className="transport-popup-icon">
                    🚆
                  </div>

                  <h3>
                    Train
                  </h3>

                  {transportInfo.train ? (

                    <>

                      <p className="transport-popup-name">
                        {
                          transportInfo
                            .train
                            .name
                        }
                      </p>

                      <p className="transport-popup-distance">
                        📍{" "}
                        {transportInfo.train.distance.toFixed(
                          2
                        )}{" "}
                        km away
                      </p>

                      <button
                        type="button"
                        className="transport-map-button"
                        onClick={() =>
                          showTransportOnMap(
                            transportInfo.train,
                            "🚆 Train"
                          )
                        }
                      >
                        📍 View on Map
                      </button>

                    </>

                  ) : (

                    <p className="transport-popup-not-found">
                      No nearby Train
                      station found
                    </p>

                  )}

                </div>

                {/* =========================
                    BUS
                ========================= */}
                <div className="transport-popup-card">

                  <div className="transport-popup-icon">
                    🚌
                  </div>

                  <h3>
                    Bus
                  </h3>

                  {transportInfo.bus ? (

                    <>

                      <p className="transport-popup-name">
                        {
                          transportInfo
                            .bus
                            .name
                        }
                      </p>

                      <p className="transport-popup-distance">
                        📍{" "}
                        {transportInfo.bus.distance.toFixed(
                          2
                        )}{" "}
                        km away
                      </p>

                      <button
                        type="button"
                        className="transport-map-button"
                        onClick={() =>
                          showTransportOnMap(
                            transportInfo.bus,
                            "🚌 Bus"
                          )
                        }
                      >
                        📍 View on Map
                      </button>

                    </>

                  ) : (

                    <p className="transport-popup-not-found">
                      No nearby Bus
                      stop found
                    </p>

                  )}

                </div>

              </div>

            )}

          </div>

        </div>

      )}

    </div>
  );
}
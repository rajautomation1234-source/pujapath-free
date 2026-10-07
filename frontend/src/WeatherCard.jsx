import React, { useEffect, useState } from "react";

const WEATHER_API =
  "https://api.open-meteo.com/v1/forecast" +
  "?latitude=22.5726" +
  "&longitude=88.3639" +
  "&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m" +
  "&timezone=Asia%2FKolkata";

function getWeatherDetails(code) {
  if (code === 0) {
    return {
      icon: "☀️",
      text: "Clear Sky",
    };
  }

  if (code === 1 || code === 2) {
    return {
      icon: "🌤️",
      text: "Partly Cloudy",
    };
  }

  if (code === 3) {
    return {
      icon: "☁️",
      text: "Overcast",
    };
  }

  if (code === 45 || code === 48) {
    return {
      icon: "🌫️",
      text: "Fog",
    };
  }

  if (
    code === 51 ||
    code === 53 ||
    code === 55 ||
    code === 56 ||
    code === 57
  ) {
    return {
      icon: "🌦️",
      text: "Drizzle",
    };
  }

  if (
    code === 61 ||
    code === 63 ||
    code === 65 ||
    code === 66 ||
    code === 67
  ) {
    return {
      icon: "🌧️",
      text: "Rain",
    };
  }

  if (code === 71 || code === 73 || code === 75 || code === 77) {
    return {
      icon: "❄️",
      text: "Snow",
    };
  }

  if (code === 80 || code === 81 || code === 82) {
    return {
      icon: "🌧️",
      text: "Rain Showers",
    };
  }

  if (code === 95) {
    return {
      icon: "⛈️",
      text: "Thunderstorm",
    };
  }

  if (code === 96 || code === 99) {
    return {
      icon: "⛈️",
      text: "Thunderstorm + Hail",
    };
  }

  return {
    icon: "🌤️",
    text: "Weather",
  };
}

function WeatherCard() {
  const [weather, setWeather] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchWeather = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(WEATHER_API);

      if (!response.ok) {
        throw new Error("Weather request failed");
      }

      const data = await response.json();

      setWeather(data);
    } catch (err) {
      console.error("Weather error:", err);
      setError("Unable to load weather.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWeather();

    const interval = setInterval(() => {
      fetchWeather();
    }, 15 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="weather-card">
        <div className="weather-loading">
          🌦️ Loading weather...
        </div>
      </div>
    );
  }

  if (error || !weather?.current) {
    return (
      <div className="weather-card">
        <div className="weather-error">
          <span>{error || "Weather unavailable"}</span>

          <button
            type="button"
            onClick={fetchWeather}
          >
            🔄 Retry
          </button>
        </div>
      </div>
    );
  }

  const current = weather.current;
  const details = getWeatherDetails(current.weather_code);

  return (
    <div className="weather-card">
      <div className="weather-top">
        <div>
          <h2>🌦️ Kolkata Weather</h2>
          <p>Live weather for your Puja planning</p>
        </div>

        <div className="weather-icon">
          {details.icon}
        </div>
      </div>

      <div className="weather-main">
        <div className="weather-temperature">
          {Math.round(current.temperature_2m)}°C
        </div>

        <div className="weather-condition">
          {details.text}
        </div>
      </div>

      <div className="weather-details">
        <div className="weather-detail-box">
          <span>🌡️ Feels Like</span>
          <strong>
            {Math.round(current.apparent_temperature)}°C
          </strong>
        </div>

        <div className="weather-detail-box">
          <span>💧 Humidity</span>
          <strong>
            {current.relative_humidity_2m}%
          </strong>
        </div>

        <div className="weather-detail-box">
          <span>🌧️ Rain</span>
          <strong>
            {current.precipitation} mm
          </strong>
        </div>

        <div className="weather-detail-box">
          <span>💨 Wind</span>
          <strong>
            {Math.round(current.wind_speed_10m)} km/h
          </strong>
        </div>
      </div>

      <div className="weather-footer">
        📍 Kolkata, West Bengal
      </div>
    </div>
  );
}

export default WeatherCard;
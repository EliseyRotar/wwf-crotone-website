"use client";

import { useState, useEffect } from "react";
import { Cloud, Sun, CloudRain } from "lucide-react";

type WeatherData = {
  temp: number;
  code: number;
  desc: string;
};

export default function WeatherWidget() {
  const [weather, setWeather] = useState<WeatherData | null>(null);

  useEffect(() => {
    async function fetchWeather() {
      try {
        // Open-Meteo free API — no key needed
        const res = await fetch(
          "https://api.open-meteo.com/v1/forecast?latitude=38.94&longitude=16.95&current=temperature_2m,weather_code&timezone=Europe/Rome"
        );
        const data = await res.json();
        const code = data.current?.weather_code ?? 0;
        const desc =
          code === 0 ? "Sereno" : code <= 3 ? "Nuvoloso" : code <= 48 ? "Nebbia" :
          code <= 67 ? "Pioggia" : code <= 77 ? "Neve" : code <= 82 ? "Pioggia" :
          code <= 99 ? "Temporale" : "Sereno";
        setWeather({
          temp: Math.round(data.current?.temperature_2m ?? 20),
          code,
          desc
        });
      } catch {
        // fail silently
      }
    }
    fetchWeather();
  }, []);

  if (!weather) return null;

  const Icon = weather.code === 0 ? Sun : weather.code <= 48 ? Cloud : CloudRain;

  return (
    <div className="inline-flex items-center gap-2 px-4 py-2 bg-surface border border-ink-grey-light rounded">
      <Icon size={20} className="text-wwf-green" />
      <span className="text-sm font-bold">{weather.temp}°C</span>
      <span className="text-sm text-ink-grey">{weather.desc}</span>
      <span className="text-xs text-ink-grey">Crotone</span>
    </div>
  );
}
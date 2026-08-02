"use client";

import { useState, useEffect } from "react";
import { Cloud, Sun, CloudRain } from "lucide-react";
import { useLocale } from "next-intl";

type WeatherData = {
  temp: number;
  code: number;
  desc: string;
};

const WEATHER_DESC: Record<string, Record<number, string>> = {
  it: { 0: "Sereno", 1: "Prevalentemente sereno", 2: "Parzialmente nuvoloso", 3: "Nuvoloso", 45: "Nebbia", 48: "Nebbia con brina", 51: "Pioggerella", 53: "Pioggerella moderata", 55: "Pioggerella intensa", 61: "Pioggia debole", 63: "Pioggia moderata", 65: "Pioggia intensa", 71: "Neve debole", 73: "Neve moderata", 75: "Neve intensa", 80: "Rovesci", 81: "Rovesci moderati", 82: "Rovesci violenti", 95: "Temporale", 96: "Temporale con grandine", 99: "Temporale violento" },
  en: { 0: "Clear", 1: "Mostly clear", 2: "Partly cloudy", 3: "Cloudy", 45: "Fog", 48: "Frost fog", 51: "Drizzle", 53: "Moderate drizzle", 55: "Heavy drizzle", 61: "Light rain", 63: "Moderate rain", 65: "Heavy rain", 71: "Light snow", 73: "Moderate snow", 75: "Heavy snow", 80: "Showers", 81: "Moderate showers", 82: "Violent showers", 95: "Thunderstorm", 96: "Thunderstorm with hail", 99: "Violent thunderstorm" }
};

export default function WeatherWidget() {
  const locale = useLocale();
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchWeather() {
      try {
        const res = await fetch(
          "https://api.open-meteo.com/v1/forecast?latitude=38.94&longitude=16.95&current=temperature_2m,weather_code&timezone=Europe/Rome"
        );
        const data = await res.json();
        const code = data.current?.weather_code ?? 0;
        const descs = WEATHER_DESC[locale] || WEATHER_DESC.it;
        const desc = descs[code] || (code <= 3 ? descs[0] : code <= 48 ? descs[45] : code <= 67 ? descs[61] : code <= 77 ? descs[71] : code <= 82 ? descs[80] : code <= 99 ? descs[95] : descs[0]);
        setWeather({
          temp: Math.round(data.current?.temperature_2m ?? 20),
          code,
          desc
        });
      } catch {
        // fail silently
      } finally {
        setLoading(false);
      }
    }
    fetchWeather();
  }, [locale]);

  if (loading) {
    return (
      <div className="inline-flex items-center gap-2 px-4 py-2 bg-surface border border-ink-grey-light rounded animate-pulse">
        <div className="w-5 h-5 bg-ink-grey-light/30 rounded" />
        <div className="w-12 h-4 bg-ink-grey-light/30 rounded" />
        <div className="w-16 h-4 bg-ink-grey-light/30 rounded" />
      </div>
    );
  }

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

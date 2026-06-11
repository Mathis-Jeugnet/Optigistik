'use client';

import { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useA11y } from '@/app/context/A11yContext';

const FONT_STEPS = [75, 100, 125, 150, 175, 200];

export default function AccessibilityToolbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [fontSize, setFontSize] = useState(100);
  const [isReading, setIsReading] = useState(false);
  const [speechUtterance, setSpeechUtterance] = useState<SpeechSynthesisUtterance | null>(null);
  const [mounted, setMounted] = useState(false);
  const closeTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { theme, setTheme } = useTheme();
  const { showToolbar } = useA11y();

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    return () => { if (closeTimeout.current) clearTimeout(closeTimeout.current); };
  }, []);

  useEffect(() => {
    document.documentElement.style.fontSize = fontSize === 100 ? '' : `${fontSize}%`;
  }, [fontSize]);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance();
      utterance.lang = 'fr-FR';
      utterance.rate = 1;
      setSpeechUtterance(utterance);
    }
  }, []);

  if (!mounted || !showToolbar) return null;

  const handleMouseEnter = () => {
    if (closeTimeout.current) {
      clearTimeout(closeTimeout.current);
      closeTimeout.current = null;
    }
  };

  const handleMouseLeave = () => {
    closeTimeout.current = setTimeout(() => setIsOpen(false), 500);
  };

  const toggleReadMode = () => {
    if (!speechUtterance) return;
    if (isReading) {
      window.speechSynthesis.cancel();
      setIsReading(false);
    } else {
      const mainContent = document.querySelector('main')?.innerText || document.body.innerText;
      speechUtterance.text = mainContent;
      speechUtterance.onend = () => setIsReading(false);
      window.speechSynthesis.speak(speechUtterance);
      setIsReading(true);
    }
  };

  const stepDown = () => setFontSize((p) => {
    const idx = FONT_STEPS.indexOf(p);
    return idx > 0 ? FONT_STEPS[idx - 1] : p;
  });

  const stepUp = () => setFontSize((p) => {
    const idx = FONT_STEPS.indexOf(p);
    return idx < FONT_STEPS.length - 1 ? FONT_STEPS[idx + 1] : p;
  });

  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col items-end">
      {/* Panel */}
      <div
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className={`absolute bottom-16 right-0 w-72 bg-white rounded-2xl shadow-2xl border border-gray-100
          transition-all duration-200 ease-out origin-bottom-right
          ${isOpen
            ? 'opacity-100 translate-y-0 scale-100 pointer-events-auto'
            : 'opacity-0 translate-y-2 scale-95 pointer-events-none'
          }`}
        role="dialog"
        aria-label="Options d'accessibilité"
        aria-hidden={!isOpen}
      >
        <div className="p-4 flex flex-col gap-4">

          {/* Taille du texte */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-opti-blue">Taille du texte</h3>
              {fontSize !== 100 && (
                <button
                  onClick={() => setFontSize(100)}
                  className="text-xs text-opti-red hover:text-opti-red/80 font-medium transition"
                >
                  Réinitialiser
                </button>
              )}
            </div>

            <div className="flex items-center gap-3">
              {/* A- */}
              <button
                onClick={stepDown}
                disabled={fontSize <= 75}
                className="w-9 h-9 rounded-xl bg-gray-50 hover:bg-gray-100 flex items-center justify-center transition shrink-0 disabled:opacity-30 disabled:cursor-not-allowed"
                aria-label="Réduire la taille du texte"
              >
                <span className="text-[11px] font-black text-gray-500 leading-none">A</span>
              </button>

              {/* Barre de progression par paliers */}
              <div className="flex-1 flex items-end gap-[3px] h-5">
                {FONT_STEPS.map((size, i) => {
                  const isActive = size === fontSize;
                  const isFilled = size <= fontSize;
                  return (
                    <button
                      key={size}
                      onClick={() => setFontSize(size)}
                      aria-label={`${size}%`}
                      className={`flex-1 rounded-sm transition-all duration-150 ${
                        isActive
                          ? 'bg-opti-blue'
                          : isFilled
                          ? 'bg-opti-blue/30 hover:bg-opti-blue/50'
                          : 'bg-gray-200 hover:bg-gray-300'
                      }`}
                      style={{ height: `${8 + i * 2}px` }}
                    />
                  );
                })}
              </div>

              {/* A+ */}
              <button
                onClick={stepUp}
                disabled={fontSize >= 200}
                className="w-9 h-9 rounded-xl bg-gray-50 hover:bg-gray-100 flex items-center justify-center transition shrink-0 disabled:opacity-30 disabled:cursor-not-allowed"
                aria-label="Augmenter la taille du texte"
              >
                <span className="text-base font-black text-gray-600 leading-none">A</span>
              </button>
            </div>

            <p className="text-center text-[11px] text-gray-400 mt-2">{fontSize}%</p>
          </div>

          <div className="border-t border-gray-100" />

          {/* Lecture vocale */}
          <div>
            <h3 className="text-sm font-bold text-opti-blue mb-2">Lecture vocale</h3>
            <button
              onClick={toggleReadMode}
              className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm transition ${
                isReading
                  ? 'bg-opti-red text-white hover:bg-opti-red/90'
                  : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
              }`}
              aria-label={isReading ? 'Arrêter la lecture' : 'Lire le contenu de la page'}
            >
              {isReading
                ? <><span className="animate-pulse text-xs">●</span> Arrêter la lecture</>
                : <><span>🔊</span> Lire la page</>
              }
            </button>
          </div>

          <div className="border-t border-gray-100" />

          {/* Thème */}
          <div>
            <h3 className="text-sm font-bold text-opti-blue mb-2">Thème</h3>
            <div className="flex items-center gap-1 bg-gray-50 p-1 rounded-xl">
              {[
                { value: 'light', label: '☀️', title: 'Clair' },
                { value: 'dark', label: '🌙', title: 'Sombre' },
                { value: 'system', label: '💻', title: 'Système' },
              ].map(({ value, label, title }) => (
                <button
                  key={value}
                  onClick={() => setTheme(value)}
                  title={title}
                  className={`flex-1 py-1.5 rounded-lg transition-all text-sm font-medium ${
                    theme === value
                      ? 'bg-white shadow-sm text-opti-blue'
                      : 'text-gray-400 hover:text-gray-600'
                  }`}
                  aria-label={`Thème ${title}`}
                >{label}</button>
              ))}
            </div>
          </div>

        </div>
      </div>

      {/* Bouton flottant */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className={`w-14 h-14 bg-opti-blue text-white rounded-full flex items-center justify-center
          transition-all duration-300 active:scale-95
          focus:outline-none focus:ring-4 focus:ring-opti-blue/30
          ${isOpen
            ? 'shadow-2xl hover:bg-opti-blue/90'
            : 'shadow-lg hover:shadow-xl hover:scale-105'
          }`}
        aria-label={isOpen ? "Fermer les options d'accessibilité" : "Ouvrir les options d'accessibilité"}
        aria-expanded={isOpen}
      >
        <div className="relative w-6 h-6">
          <X
            className={`absolute inset-0 w-6 h-6 transition-all duration-300 ${
              isOpen ? 'opacity-100 rotate-0 scale-100' : 'opacity-0 rotate-90 scale-50'
            }`}
          />
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
            className={`absolute inset-0 w-6 h-6 transition-all duration-300 ${
              isOpen ? 'opacity-0 -rotate-90 scale-50' : 'opacity-100 rotate-0 scale-100'
            }`}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />
          </svg>
        </div>
      </button>
    </div>
  );
}

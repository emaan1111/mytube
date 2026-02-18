"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import confetti from "canvas-confetti";

// Ramadan celebration dates - starts Feb 28, 2026 (approx) and we show for 3 days
const CELEBRATION_START = new Date("2026-02-18T00:00:00");
const CELEBRATION_END = new Date("2026-02-21T23:59:59");

function isWithinCelebration(): boolean {
  const now = new Date();
  return now >= CELEBRATION_START && now <= CELEBRATION_END;
}

// Generate a celebratory sound using Web Audio API
function playCelebrationSound(audioCtxRef: React.MutableRefObject<AudioContext | null>) {
  try {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new AudioContext();
    }
    const ctx = audioCtxRef.current;
    
    // Create a pleasant celebratory melody
    const notes = [
      { freq: 523.25, start: 0, duration: 0.15 },     // C5
      { freq: 659.25, start: 0.15, duration: 0.15 },   // E5
      { freq: 783.99, start: 0.3, duration: 0.15 },    // G5
      { freq: 1046.5, start: 0.45, duration: 0.3 },    // C6
      { freq: 783.99, start: 0.8, duration: 0.12 },    // G5
      { freq: 1046.5, start: 0.95, duration: 0.5 },    // C6 (held)
    ];

    notes.forEach(({ freq, start, duration }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, ctx.currentTime + start);
      gain.gain.linearRampToValueAtTime(0.15, ctx.currentTime + start + 0.03);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + start + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + start);
      osc.stop(ctx.currentTime + start + duration + 0.05);
    });
  } catch {
    // Audio not supported or blocked - silently ignore
  }
}

function fireConfetti() {
  const duration = 4000;
  const end = Date.now() + duration;

  // Star-shaped and circle confetti in green, gold, white (Ramadan colors)
  const colors = ["#00843D", "#C5B358", "#FFFFFF", "#1B8A5A", "#FFD700", "#E8D5B7"];

  const frame = () => {
    confetti({
      particleCount: 3,
      angle: 60,
      spread: 55,
      origin: { x: 0, y: 0.7 },
      colors,
      shapes: ["circle", "star"],
      scalar: 1.2,
    });
    confetti({
      particleCount: 3,
      angle: 120,
      spread: 55,
      origin: { x: 1, y: 0.7 },
      colors,
      shapes: ["circle", "star"],
      scalar: 1.2,
    });

    if (Date.now() < end) {
      requestAnimationFrame(frame);
    }
  };
  frame();
}

function fireBigConfettiBurst() {
  // Big centre burst
  confetti({
    particleCount: 150,
    spread: 100,
    origin: { x: 0.5, y: 0.4 },
    colors: ["#00843D", "#C5B358", "#FFFFFF", "#1B8A5A", "#FFD700"],
    shapes: ["circle", "star"],
    scalar: 1.5,
    ticks: 200,
  });

  // Side bursts
  setTimeout(() => {
    confetti({
      particleCount: 80,
      angle: 60,
      spread: 70,
      origin: { x: 0, y: 0.5 },
      colors: ["#00843D", "#C5B358", "#FFFFFF"],
      shapes: ["star"],
      scalar: 1.3,
    });
    confetti({
      particleCount: 80,
      angle: 120,
      spread: 70,
      origin: { x: 1, y: 0.5 },
      colors: ["#00843D", "#C5B358", "#FFFFFF"],
      shapes: ["star"],
      scalar: 1.3,
    });
  }, 300);
}

interface RamadanCardUser {
  name: string;
}

export default function RamadanCelebration() {
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [showCardModal, setShowCardModal] = useState(false);
  const [cardSent, setCardSent] = useState(false);
  const [customMessage, setCustomMessage] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [generatedCards, setGeneratedCards] = useState<RamadanCardUser[]>([]);
  const [showCardPreview, setShowCardPreview] = useState(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const hasAutoPlayed = useRef(false);

  useEffect(() => {
    if (!isWithinCelebration()) return;

    const alreadyDismissed = sessionStorage.getItem("ramadan-celebration-dismissed");
    if (alreadyDismissed) {
      setDismissed(true);
      return;
    }

    setVisible(true);

    // Auto-play celebration on first visit
    if (!hasAutoPlayed.current) {
      hasAutoPlayed.current = true;
      // Small delay for page to render first
      const timer = setTimeout(() => {
        fireConfetti();
        playCelebrationSound(audioCtxRef);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, []);

  const handlePlayAgain = useCallback(() => {
    fireBigConfettiBurst();
    playCelebrationSound(audioCtxRef);
  }, []);

  const handleDismiss = useCallback(() => {
    setVisible(false);
    setDismissed(true);
    sessionStorage.setItem("ramadan-celebration-dismissed", "true");
  }, []);

  const handleSendCards = useCallback(() => {
    setShowCardModal(true);
  }, []);

  const handleAddRecipient = useCallback(() => {
    if (recipientName.trim()) {
      setGeneratedCards((prev) => [...prev, { name: recipientName.trim() }]);
      setRecipientName("");
    }
  }, [recipientName]);

  const handleRemoveRecipient = (index: number) => {
    setGeneratedCards((prev) => prev.filter((_, i) => i !== index));
  };

  const handlePreviewCards = () => {
    if (generatedCards.length > 0) {
      setShowCardPreview(true);
      fireBigConfettiBurst();
    }
  };

  const handleSendAll = () => {
    setCardSent(true);
    fireBigConfettiBurst();
    playCelebrationSound(audioCtxRef);
    // Auto-close after a few seconds
    setTimeout(() => {
      setShowCardModal(false);
      setCardSent(false);
      setGeneratedCards([]);
      setShowCardPreview(false);
      setCustomMessage("");
    }, 4000);
  };

  if (!isWithinCelebration() || dismissed) return null;

  return (
    <>
      {/* Floating Celebration Banner */}
      {visible && (
        <div className="fixed inset-0 z-[100] pointer-events-none">
          <div className="absolute inset-x-0 top-16 flex justify-center pointer-events-auto">
            <div className="relative mx-4 max-w-2xl w-full animate-slide-down">
              {/* Glowing border effect */}
              <div className="absolute -inset-0.5 bg-gradient-to-r from-green-400 via-yellow-300 to-green-400 rounded-2xl blur opacity-60 animate-glow" />
              
              <div className="relative bg-gradient-to-br from-gray-900 via-green-950 to-gray-900 rounded-2xl p-6 border border-green-500/30 shadow-2xl">
                {/* Close button */}
                <button
                  onClick={handleDismiss}
                  className="absolute top-3 right-3 text-gray-400 hover:text-white transition-colors"
                  aria-label="Dismiss"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>

                {/* Crescent Moon & Star Icon */}
                <div className="flex flex-col items-center text-center gap-4">
                  <button
                    onClick={handlePlayAgain}
                    className="group relative focus:outline-none"
                    title="Click to celebrate again!"
                  >
                    <div className="relative">
                      {/* Animated glow ring */}
                      <div className="absolute -inset-4 rounded-full bg-gradient-to-r from-green-400 to-yellow-400 opacity-20 blur-lg group-hover:opacity-40 animate-pulse transition-opacity" />
                      
                      {/* Main icon */}
                      <div className="relative w-20 h-20 flex items-center justify-center rounded-full bg-gradient-to-br from-green-500 to-emerald-700 shadow-lg group-hover:scale-110 group-active:scale-95 transition-transform cursor-pointer">
                        <span className="text-4xl select-none" role="img" aria-label="Crescent moon and star">
                          🌙
                        </span>
                      </div>
                      
                      {/* Decorative stars */}
                      <span className="absolute -top-1 -right-1 text-lg animate-twinkle">⭐</span>
                      <span className="absolute -bottom-1 -left-1 text-sm animate-twinkle-delay">✨</span>
                      <span className="absolute top-0 -left-3 text-xs animate-twinkle">💫</span>
                    </div>
                  </button>

                  <div>
                    <h2 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-green-300 via-yellow-200 to-green-300 bg-clip-text text-transparent">
                      Ramadan Mubarak! 🌟
                    </h2>
                    <p className="text-green-200/80 mt-2 text-sm sm:text-base max-w-md">
                      May this blessed month bring you peace, joy, and prosperity. 
                      Tap the moon to celebrate! 🎉
                    </p>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-wrap gap-3 justify-center mt-2">
                    <button
                      onClick={handlePlayAgain}
                      className="px-4 py-2 rounded-lg bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500 text-white font-medium text-sm shadow-lg hover:shadow-green-500/25 transition-all hover:scale-105 active:scale-95 flex items-center gap-2"
                    >
                      <span>🎵</span> Play Celebration
                    </button>
                    <button
                      onClick={handleSendCards}
                      className="px-4 py-2 rounded-lg bg-gradient-to-r from-yellow-500 to-amber-600 hover:from-yellow-400 hover:to-amber-500 text-white font-medium text-sm shadow-lg hover:shadow-yellow-500/25 transition-all hover:scale-105 active:scale-95 flex items-center gap-2"
                    >
                      <span>💌</span> Send Ramadan Cards
                    </button>
                  </div>

                  {/* Decorative lanterns */}
                  <div className="flex gap-6 mt-1 opacity-60">
                    <span className="text-2xl animate-sway">🏮</span>
                    <span className="text-2xl animate-sway-delay">🏮</span>
                    <span className="text-2xl animate-sway">🏮</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Ramadan Card Modal */}
      {showCardModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 p-4">
          <div className="relative max-w-lg w-full max-h-[90vh] overflow-y-auto rounded-2xl bg-gradient-to-br from-gray-900 via-green-950 to-gray-900 border border-green-500/30 shadow-2xl">
            {/* Close */}
            <button
              onClick={() => {
                setShowCardModal(false);
                setShowCardPreview(false);
                setCardSent(false);
              }}
              className="absolute top-3 right-3 z-10 text-gray-400 hover:text-white transition-colors"
              aria-label="Close"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <div className="p-6">
              {cardSent ? (
                /* Success State */
                <div className="text-center py-8 animate-fade-in">
                  <span className="text-6xl block mb-4">🎊</span>
                  <h3 className="text-2xl font-bold text-green-300 mb-2">Cards Sent!</h3>
                  <p className="text-green-200/70 text-sm">
                    Your personalised Ramadan Mubarak cards have been delivered to {generatedCards.length} people! 💚
                  </p>
                  <div className="mt-4 flex gap-2 flex-wrap justify-center">
                    {generatedCards.map((card, i) => (
                      <span key={i} className="px-3 py-1 rounded-full bg-green-800/50 text-green-300 text-xs border border-green-600/30">
                        {card.name} ✓
                      </span>
                    ))}
                  </div>
                </div>
              ) : showCardPreview ? (
                /* Card Preview */
                <div className="animate-fade-in">
                  <h3 className="text-xl font-bold text-green-300 mb-4 text-center">Preview Your Cards</h3>
                  
                  <div className="space-y-3 mb-6 max-h-60 overflow-y-auto scrollbar-thin">
                    {generatedCards.map((card, i) => (
                      <div key={i} className="rounded-xl bg-gradient-to-r from-green-900/60 to-emerald-900/40 border border-green-600/20 p-4">
                        <div className="flex items-start gap-3">
                          <span className="text-3xl">🌙</span>
                          <div className="flex-1">
                            <p className="text-green-200 font-medium text-base">
                              Dear <span className="text-yellow-300 font-bold">{card.name}</span>,
                            </p>
                            <p className="text-green-300/80 text-sm mt-1">
                              {customMessage || "Wishing you a blessed Ramadan filled with peace, joy, and countless blessings. May your prayers be answered and your heart be filled with light."}
                            </p>
                            <p className="text-yellow-400/80 text-sm mt-2 font-medium italic">
                              Ramadan Mubarak! 🌟✨
                            </p>
                          </div>
                        </div>
                        <div className="flex justify-end mt-2 opacity-50">
                          <span className="text-xs text-green-400">🏮 From MyTube with love</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => setShowCardPreview(false)}
                      className="flex-1 py-2.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-white font-medium text-sm transition-colors"
                    >
                      ← Back
                    </button>
                    <button
                      onClick={handleSendAll}
                      className="flex-1 py-2.5 rounded-lg bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500 text-white font-bold text-sm shadow-lg transition-all hover:scale-105 active:scale-95"
                    >
                      Send All Cards 💌
                    </button>
                  </div>
                </div>
              ) : (
                /* Card Builder */
                <div className="animate-fade-in">
                  <div className="text-center mb-5">
                    <span className="text-4xl block mb-2">💌</span>
                    <h3 className="text-xl font-bold text-green-300">
                      Send Ramadan Mubarak Cards
                    </h3>
                    <p className="text-green-200/60 text-sm mt-1">
                      Create personalised cards for your friends & family
                    </p>
                  </div>

                  {/* Add recipients */}
                  <div className="mb-4">
                    <label className="text-sm font-medium text-green-200 mb-1.5 block">
                      Add Recipients
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={recipientName}
                        onChange={(e) => setRecipientName(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleAddRecipient()}
                        placeholder="Enter a name..."
                        className="flex-1 px-3 py-2 rounded-lg bg-gray-800 border border-green-600/30 text-white text-sm placeholder:text-gray-500 focus:outline-none focus:border-green-500 transition-colors"
                      />
                      <button
                        onClick={handleAddRecipient}
                        disabled={!recipientName.trim()}
                        className="px-4 py-2 rounded-lg bg-green-600 hover:bg-green-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-medium text-sm transition-colors"
                      >
                        Add
                      </button>
                    </div>
                  </div>

                  {/* Recipients list */}
                  {generatedCards.length > 0 && (
                    <div className="mb-4">
                      <p className="text-xs text-green-300/60 mb-2">{generatedCards.length} recipient(s)</p>
                      <div className="flex flex-wrap gap-2">
                        {generatedCards.map((card, i) => (
                          <span
                            key={i}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-green-800/40 text-green-300 text-sm border border-green-600/20"
                          >
                            {card.name}
                            <button
                              onClick={() => handleRemoveRecipient(i)}
                              className="hover:text-red-400 transition-colors"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Custom message */}
                  <div className="mb-5">
                    <label className="text-sm font-medium text-green-200 mb-1.5 block">
                      Personal Message <span className="text-green-400/50">(optional)</span>
                    </label>
                    <textarea
                      value={customMessage}
                      onChange={(e) => setCustomMessage(e.target.value)}
                      placeholder="Wishing you a blessed Ramadan filled with peace, joy, and countless blessings..."
                      rows={3}
                      className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-green-600/30 text-white text-sm placeholder:text-gray-500 focus:outline-none focus:border-green-500 transition-colors resize-none"
                    />
                  </div>

                  {/* Preview button */}
                  <button
                    onClick={handlePreviewCards}
                    disabled={generatedCards.length === 0}
                    className="w-full py-3 rounded-lg bg-gradient-to-r from-yellow-500 to-amber-600 hover:from-yellow-400 hover:to-amber-500 disabled:from-gray-700 disabled:to-gray-700 disabled:text-gray-500 text-white font-bold text-sm shadow-lg transition-all hover:scale-[1.02] active:scale-[0.98]"
                  >
                    {generatedCards.length === 0
                      ? "Add recipients to continue"
                      : `Preview ${generatedCards.length} Card${generatedCards.length > 1 ? "s" : ""} →`}
                  </button>

                  {/* Quick add suggestions */}
                  <div className="mt-4 pt-4 border-t border-green-800/30">
                    <p className="text-xs text-green-400/50 mb-2">Quick add:</p>
                    <div className="flex flex-wrap gap-2">
                      {["Mom", "Dad", "Brother", "Sister", "Friend", "Colleague"].map((name) => (
                        <button
                          key={name}
                          onClick={() => {
                            if (!generatedCards.find((c) => c.name === name)) {
                              setGeneratedCards((prev) => [...prev, { name }]);
                            }
                          }}
                          disabled={!!generatedCards.find((c) => c.name === name)}
                          className="px-3 py-1 rounded-full bg-gray-800 hover:bg-green-800/50 disabled:opacity-30 text-green-300/70 text-xs border border-green-700/20 transition-colors"
                        >
                          + {name}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

'use client';

export default function FloatingBackground() {
  const items = [
    { emoji: '💸', left: '10%', delay: '0s' },
    { emoji: '🧾', left: '30%', delay: '5s' },
    { emoji: '💻', left: '50%', delay: '2s' },
    { emoji: '💰', left: '70%', delay: '8s' },
    { emoji: '📊', left: '90%', delay: '12s' },
  ];

  return (
    <div className="floating-bg" aria-hidden="true">
      {items.map((item, i) => (
        <div
          key={i}
          className="float-item"
          style={{ left: item.left, animationDelay: item.delay }}
        >
          {item.emoji}
        </div>
      ))}
    </div>
  );
}

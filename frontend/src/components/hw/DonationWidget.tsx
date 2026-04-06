import { useState } from 'react';

const PRESETS = [500, 1000, 2500];

export default function DonationWidget() {
  const [selected, setSelected] = useState<number | 'custom'>(500);
  const [customAmount, setCustomAmount] = useState('');

  return (
    <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-8 max-w-xl mx-auto shadow-2xl">
      <p className="text-white/70 text-xs uppercase tracking-widest font-semibold mb-5 text-center">
        Choose an amount
      </p>
      <div className="flex flex-wrap gap-3 justify-center mb-5">
        {PRESETS.map((amt) => (
          <button
            key={amt}
            onClick={() => setSelected(amt)}
            className={`hw-amount-btn px-6 py-3 rounded-xl font-semibold text-sm ${selected === amt ? 'active' : ''}`}
          >
            ₱{amt.toLocaleString()}
          </button>
        ))}
        <button
          onClick={() => setSelected('custom')}
          className={`hw-amount-btn px-6 py-3 rounded-xl font-semibold text-sm ${selected === 'custom' ? 'active' : ''}`}
        >
          Custom
        </button>
      </div>
      {selected === 'custom' && (
        <div className="mb-5">
          <div className="flex items-center gap-2 bg-white/10 border border-white/30 rounded-xl px-4 py-3">
            <span className="text-white font-bold text-lg">₱</span>
            <input
              type="number"
              placeholder="Enter amount"
              value={customAmount}
              onChange={(e) => setCustomAmount(e.target.value)}
              className="bg-transparent text-white placeholder-white/40 outline-none flex-1 text-sm"
            />
          </div>
        </div>
      )}
      <button className="hw-btn-magenta w-full py-4 rounded-xl font-bold text-base tracking-wide mt-1">
        Donate Now →
      </button>
      <p className="text-white/40 text-xs text-center mt-3">
        Secure donation · 100% goes directly to the girls we serve
      </p>
    </div>
  );
}

import React from 'react';
import MapSpasial from './components/MapSpasial';

function App() {
  return (
    // Memaksa div utama memenuhi lebar dan tinggi layar tanpa scroll
    <div className="w-screen h-screen overflow-hidden bg-slate-100 p-4">
      {/* Panggil komponen peta di sini */}
      <MapSpasial />
    </div>
  );
}

export default App;
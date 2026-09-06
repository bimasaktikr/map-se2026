import React, { useRef, useEffect, useState, useMemo } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Map as MapIcon, Database, AlertTriangle } from 'lucide-react';
import axios from 'axios';

// 🌟 TARIK API KEY DARI .ENV
mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN;

export default function MapSpasial() {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const [mapLoaded, setMapLoaded] = useState(false);

  // 🌟 STATE DATABASE & BATAS WILAYAH
  const [dataTitik, setDataTitik] = useState([]);
  const [batasWilayah, setBatasWilayah] = useState(null);
  const [isLoading, setIsLoading] = useState(false); 

  // 🌟 STATE MASTER WILAYAH & FILTER
  const [listKecamatan, setListKecamatan] = useState([]);
  const [listKelurahan, setListKelurahan] = useState([]);
  const [listSlsApi, setListSlsApi] = useState([]); // Daftar SLS dari API

  const [selectedKdkec, setSelectedKdkec] = useState('');
  const [selectedIddesa, setSelectedIddesa] = useState('');
  const [selectedSls, setSelectedSls] = useState('');

  // 🌐 1. AMBIL MASTER KECAMATAN & BATAS WILAYAH SAAT INIT
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const API_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
        const resKec = await axios.get(`${API_URL}/api/v1/maps/get-list-kecamatan`);
        setListKecamatan(resKec.data || []);

        const resBatas = await fetch('/batas_sls.geojson');
        if (resBatas.ok) {
          const batas = await resBatas.json();
          setBatasWilayah(batas);
        }
      } catch (error) {
        console.error("Radar gagal memuat data awal:", error);
      }
    };
    fetchInitialData();
  }, []);

  // 🔄 2. HANDLER KECAMATAN BERUBAH -> TARIK KELURAHAN
  const handleKecamatanChange = async (e) => {
    const kdkec = e.target.value;
    setSelectedKdkec(kdkec);
    
    // Reset state di bawahnya
    setSelectedIddesa(''); 
    setSelectedSls('');
    setListKelurahan([]);
    setListSlsApi([]);
    setDataTitik([]); 

    if (kdkec) {
      try {
        const API_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
        const resKel = await axios.get(`${API_URL}/api/v1/maps/get-list-kelurahan/${kdkec}`);
        setListKelurahan(resKel.data || []);
      } catch (error) {
        console.error("Gagal memuat master kelurahan:", error);
      }
    }
  };

  // 🔄 3. HANDLER DESA BERUBAH -> TARIK SLS DARI API
  useEffect(() => {
    const fetchSlsList = async () => {
      if (!selectedIddesa) {
        setListSlsApi([]);
        setSelectedSls('');
        return;
      }
      try {
        const API_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
        const res = await axios.get(`${API_URL}/api/v1/maps/get-list-sls/${selectedIddesa}`);
        
        // 🌟 SORTING ALGORITMA: Urutkan data berdasarkan label nmsls (A-Z)
        const sortedData = (res.data || []).sort((a, b) => {
          const namaA = a.nmsls || "";
          const namaB = b.nmsls || "";
          return namaA.localeCompare(namaB, 'id', { numeric: true });
        });

        setListSlsApi(sortedData);
      } catch (err) {
        console.error("Gagal memuat daftar SLS:", err);
      }
    };
    
    fetchSlsList();
  }, [selectedIddesa]);

  // 🔄 MESIN PENGELOMPOKAN SLS BERDASARKAN RW
  const groupedSlsList = useMemo(() => {
    if (!listSlsApi || listSlsApi.length === 0) return [];

    const groups = {};
    
    listSlsApi.forEach(sls => {
      const namaSls = sls.nmsls || "";
      let rwGroup = "Lainnya (Tanpa RW)"; 

      // Cari kata "RW" diikuti angka
      const match = namaSls.match(/(RW\s*\d+)/i);
      if (match) {
        rwGroup = match[1].toUpperCase();
      }

      if (!groups[rwGroup]) {
        groups[rwGroup] = [];
      }
      groups[rwGroup].push(sls);
    });

    const sortedRwKeys = Object.keys(groups).sort((a, b) => 
      a.localeCompare(b, 'id', { numeric: true })
    );

    return sortedRwKeys.map(key => ({
      rwLabel: key,
      items: groups[key] 
    }));
  }, [listSlsApi]);

  
  // 🚀 4. FUNGSI TEMBAK DATA KE DATABASE (HANYA JIKA TOMBOL DITEKAN)
  const handleMuatData = async () => {
    if (!selectedIddesa) {
      alert("Komandan, mohon pilih Desa/Kelurahan terlebih dahulu agar server tidak overload!");
      return;
    }

    setIsLoading(true);
    try {
      const API_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
      const response = await axios.get(`${API_URL}/api/v1/maps/get-titik-tematik?iddesa=${selectedIddesa}`);
      
      const dataDariApi = response.data.data || response.data;
      setDataTitik(Array.isArray(dataDariApi) ? dataDariApi : []);
    } catch (error) {
      console.error("Gagal menarik data titik:", error);
      setDataTitik([]);
    } finally {
      setIsLoading(false);
    }
  };

  // 🔄 5. KONVERSI & FILTER DATA TITIK KE GEOJSON
  const geojsonData = useMemo(() => {
    if (!Array.isArray(dataTitik)) return { type: 'FeatureCollection', features: [] };

    // Filter secara lokal berdasarkan SLS jika dipilih
    const filteredTitik = selectedSls 
      ? dataTitik.filter(p => String(p.region_code || '').startsWith(selectedSls))
      : dataTitik;

    return {
      type: 'FeatureCollection',
      features: filteredTitik.map(p => ({
        type: 'Feature',
        geometry: { 
          type: 'Point', 
          coordinates: [parseFloat(p.longitude || 0), parseFloat(p.latitude || 0)] 
        },
        properties: { ...p }
      }))
    };
  }, [dataTitik, selectedSls]);

  // 🚀 6. INISIALISASI PETA 3D
  useEffect(() => {
    if (map.current) return; 

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/light-v11',
      center: [112.6214, -7.9839], 
      zoom: 13, 
      pitch: 60, 
      bearing: -20,
      antialias: true 
    });

    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

    map.current.on('load', () => {
      setMapLoaded(true);

      // A. LAYER GEDUNG 3D
      map.current.addLayer({
        'id': '3d-buildings',
        'source': 'composite',
        'source-layer': 'building',
        'filter': ['==', 'extrude', 'true'],
        'type': 'fill-extrusion',
        'minzoom': 15,
        'paint': {
          'fill-extrusion-color': '#e2e8f0',
          'fill-extrusion-height': ['get', 'height'],
          'fill-extrusion-base': ['get', 'min_height'],
          'fill-extrusion-opacity': 0.8
        }
      });

      // B. SOURCE DATA TITIK
      map.current.addSource('data-se2026', {
        type: 'geojson',
        data: geojsonData 
      });

      // C. LAYER VISUAL TITIK
      map.current.addLayer({
        'id': 'titik-se2026',
        'type': 'circle',
        'source': 'data-se2026',
        'paint': {
          'circle-radius': 6,
          'circle-color': [
            'match',
            ['get', 'status_alias'],
            'selesai', '#10b981', 
            'proses', '#f97316',  
            '#3b82f6'             
          ],
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff'
        }
      });

      // D. INTERAKSI KLIK (POPUP)
      map.current.on('click', 'titik-se2026', (e) => {
        if (!e.features.length) return;
        const coordinates = e.features[0].geometry.coordinates.slice();
        const { nama_usaha, alamat, nomor_bangunan, status_alias, nmkec, nmdesa } = e.features[0].properties;
        
        const displayNama = nama_usaha || "Nama Usaha Tidak Tersedia";
        const displayAlamat = alamat ? `${alamat} (No. ${nomor_bangunan || '-'})` : "Alamat belum diisi";
        const displayStatus = status_alias || "Status Belum Diketahui";
        const displayWilayah = nmkec && nmdesa ? `Kec. ${nmkec}, Kel. ${nmdesa}` : "Wilayah Belum Dipetakan";

        const popupHTML = `
          <div style="padding: 4px;">
            <div style="font-size: 10px; font-weight: bold; text-transform: uppercase; margin-bottom: 2px; color: #3b82f6;">
              ${displayWilayah}
            </div>
            <div style="font-size: 10px; font-weight: bold; text-transform: uppercase; margin-bottom: 6px; color: #f97316;">
              STATUS: ${displayStatus}
            </div>
            <h3 style="font-weight: 900; color: #1e293b; font-size: 14px; margin: 0 0 4px 0;">${displayNama}</h3>
            <p style="font-size: 12px; color: #64748b; margin: 0;">${displayAlamat}</p>
          </div>
        `;

        new mapboxgl.Popup().setLngLat(coordinates).setHTML(popupHTML).addTo(map.current);
      });

      map.current.on('mouseenter', 'titik-se2026', () => { map.current.getCanvas().style.cursor = 'pointer'; });
      map.current.on('mouseleave', 'titik-se2026', () => { map.current.getCanvas().style.cursor = ''; });
    });
  }, []);

  // 🔄 7. UPDATE TITIK & GAMBAR BATAS SAAT DATA BERUBAH
  useEffect(() => {
    if (mapLoaded && map.current) {
      // Update titik data
      if (map.current.getSource('data-se2026')) {
        map.current.getSource('data-se2026').setData(geojsonData);
      }

      // Gambar Batas Wilayah
      if (batasWilayah) {
        const sourceId = 'source-batas-wilayah';
        if (!map.current.getSource(sourceId)) {
          map.current.addSource(sourceId, { type: 'geojson', data: batasWilayah });
          
          // Layer Poligon Dasar
          map.current.addLayer({
            'id': 'layer-batas-area',
            'type': 'fill',
            'source': sourceId,
            'paint': { 'fill-color': '#3b82f6', 'fill-opacity': 0.05 }
          }, '3d-buildings'); 
          
          // Layer Garis Batas
          map.current.addLayer({
            'id': 'layer-batas-garis',
            'type': 'line',
            'source': sourceId,
            'paint': { 'line-color': '#64748b', 'line-width': 1.5, 'line-dasharray': [3, 3] }
          }, '3d-buildings');
        } else {
          map.current.getSource(sourceId).setData(batasWilayah);
        }
      }
    }
  }, [geojsonData, mapLoaded, batasWilayah]);

  // 🗺️ 8. EFEK HIGHLIGHT POLIGON SAAT SLS DIPILIH (Langkah 4)
  useEffect(() => {
    if (mapLoaded && map.current && map.current.getLayer('layer-batas-area')) {
      if (selectedSls) {
        map.current.setPaintProperty('layer-batas-area', 'fill-opacity', [
          'match',
          ['get', 'idsubsls'], // Membaca field idsubsls dari batas_sls.geojson
          selectedSls, 0.4,    // Transparansi 40% (menyala terang) jika cocok
          0.05                 // Transparansi 5% (redup) jika tidak cocok
        ]);
      } else {
        // Reset kembali menjadi redup semua jika tidak ada SLS yang dipilih
        map.current.setPaintProperty('layer-batas-area', 'fill-opacity', 0.05);
      }
    }
  }, [selectedSls, mapLoaded]);

  return (
    <div className="flex flex-col md:flex-row w-full h-full min-h-screen bg-slate-100 p-4 font-sans">
      {/* 🌟 PANEL KIRI (SIDEBAR FILTER) */}
      <div className="w-full md:w-80 bg-white border border-slate-200 flex flex-col shrink-0 z-10 shadow-lg rounded-l-2xl overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-2 rounded-xl text-white shadow-md shadow-blue-600/20">
              <MapIcon size={20} />
            </div>
            <div>
              <h2 className="font-black text-sm text-slate-800 tracking-tight">COMMAND CENTER</h2>
              <p className="text-[10px] text-slate-400 font-semibold">Pemantauan Spasial 3D</p>
            </div>
          </div>
        </div>

        <div className="p-5 flex-1 overflow-y-auto space-y-6">
          
          {/* 🌟 PANEL FILTER WILAYAH */}
          <div className="space-y-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
            <h3 className="text-xs font-black text-slate-400 tracking-wider mb-2">FILTER WILAYAH (WAJIB)</h3>
            
            {/* Dropdown Kecamatan */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">Kecamatan</label>
              <select 
                value={selectedKdkec} 
                onChange={handleKecamatanChange}
                className="w-full text-sm p-2.5 border border-slate-200 rounded-lg bg-white outline-none focus:border-blue-500 transition-all cursor-pointer"
              >
                <option value="">-- Pilih Kecamatan --</option>
                {listKecamatan.map((kec) => (
                  <option key={kec.kdkec} value={kec.kdkec}>{kec.nmkec}</option>
                ))}
              </select>
            </div>

            {/* Dropdown Desa/Kelurahan */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">Desa / Kelurahan</label>
              <select 
                value={selectedIddesa} 
                onChange={(e) => {
                  setSelectedIddesa(e.target.value);
                  setDataTitik([]); // Hapus data lama jika user ganti desa tapi belum klik muat
                  setSelectedSls(''); // Reset SLS
                }}
                disabled={!selectedKdkec} 
                className="w-full text-sm p-2.5 border border-slate-200 rounded-lg bg-white outline-none focus:border-blue-500 transition-all cursor-pointer disabled:bg-slate-100 disabled:text-slate-400"
              >
                <option value="">{selectedKdkec ? "-- Pilih Desa --" : "Pilih Kecamatan Dulu"}</option>
                {listKelurahan.map((desa) => (
                  <option key={desa.iddesa} value={desa.iddesa}>{desa.nmdesa}</option>
                ))}
              </select>
            </div>

          {/* Dropdown SLS (Dikelompokkan per RW) */}
            <div className="space-y-1.5 mt-2">
              <label className="text-xs font-bold text-slate-700">Satuan Lingkungan Setempat (SLS)</label>
              <select 
                value={selectedSls} 
                onChange={(e) => setSelectedSls(e.target.value)}
                disabled={groupedSlsList.length === 0} 
                className="w-full text-sm p-2.5 border border-slate-200 rounded-lg bg-white outline-none focus:border-blue-500 transition-all cursor-pointer disabled:bg-slate-100 disabled:text-slate-400"
              >
                <option value="">{groupedSlsList.length > 0 ? "-- Semua SLS --" : "Pilih Kelurahan Dulu"}</option>
                
                {/* 🌟 RENDER BERDASARKAN GRUP RW */}
                {groupedSlsList.map((group, groupIdx) => (
                  <optgroup key={groupIdx} label={`--- ${group.rwLabel} ---`} className="font-bold text-slate-500 bg-slate-50">
                    {group.items.map((sls) => (
                      <option key={sls.region_code} value={sls.region_code} className="font-medium text-slate-800 bg-white">
                        {sls.nmsls}
                      </option>
                    ))}
                  </optgroup>
                ))}
                
              </select>
            </div>

            {/* 🌟 TOMBOL EKSEKUSI MUAT DATA */}
            <button 
              onClick={handleMuatData}
              disabled={!selectedIddesa || isLoading}
              className={`w-full mt-4 flex justify-center items-center gap-2 p-3 rounded-lg text-sm font-bold transition-all ${
                !selectedIddesa 
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed' 
                  : 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/30'
              }`}
            >
              {isLoading ? (
                 <span className="animate-pulse">Menarik Kordinat...</span>
              ) : (
                <>
                  <Database size={16} /> MUAT DATA SPASIAL
                </>
              )}
            </button>
            
            {!selectedIddesa && (
              <p className="text-[10px] text-rose-500 flex items-center gap-1 font-bold mt-2">
                <AlertTriangle size={10} /> *Pilih hingga level desa untuk memuat
              </p>
            )}
          </div>
          
          {/* Ringkasan Data Termuat */}
          {dataTitik.length > 0 && (
             <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-xl">
               <p className="text-xs font-bold text-emerald-600 uppercase tracking-wider mb-1">Status Radar</p>
               <p className="text-2xl font-black text-emerald-700">{dataTitik.length.toLocaleString('id-ID')} <span className="text-sm font-semibold">Titik Termuat</span></p>
             </div>
          )}
        </div>
      </div>

      {/* 🌟 PANEL KANAN (MAP CONTAINER) */}
      <div className="flex-1 h-[80vh] md:h-auto w-full relative border border-slate-200 rounded-r-2xl overflow-hidden shadow-lg">
        <div ref={mapContainer} className="w-full h-full absolute inset-0" />
      </div>
    </div>
  );
}
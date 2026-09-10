import React, { useRef, useEffect, useState, useMemo } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Map as MapIcon, Database, AlertTriangle, LogOut, Info } from 'lucide-react';
import axios from 'axios';

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN;

export default function MapSpasial() {
  // =========================================================================
  // 1. STATE AUTHENTICATION
  // =========================================================================
  const [isLoggedIn, setIsLoggedIn] = useState(() => {
    return localStorage.getItem('petugas_auth') === 'true';
  });
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errorLogin, setErrorLogin] = useState('');
  const [isLoadingLogin, setIsLoadingLogin] = useState(false);

  // =========================================================================
  // 2. STATE MAPBOX & DATABASE SPASIAL
  // =========================================================================
  const mapContainer = useRef(null);
  const map = useRef(null);
  const [mapLoaded, setMapLoaded] = useState(false);

  const [dataTitik, setDataTitik] = useState([]);
  const [batasWilayah, setBatasWilayah] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  // =========================================================================
  // 3. STATE MASTER WILAYAH & FILTER
  // =========================================================================
  const [listKecamatan, setListKecamatan] = useState([]);
  const [listKelurahan, setListKelurahan] = useState([]);
  const [listSlsApi, setListSlsApi] = useState([]);

  const [selectedKdkec, setSelectedKdkec] = useState('');
  const [selectedIddesa, setSelectedIddesa] = useState('');
  const [selectedSls, setSelectedSls] = useState('');

  // =========================================================================
  // 4. AUTENTIKASI MASUK & KELUAR
  // =========================================================================
  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoadingLogin(true);
    setErrorLogin('');

    try {
      const API_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
      const response = await fetch(`${API_URL}/api/v1/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      const data = await response.json();

      if (response.ok && data.status === 'success') {
        localStorage.setItem('petugas_auth', 'true');
        setIsLoggedIn(true);
      } else {
        setErrorLogin(data.detail || 'Akses Ditolak! Username atau Password salah.');
      }
    } catch (error) {
      console.error('Gagal menghubungi backend:', error);
      setErrorLogin('Gagal terhubung ke server backend. Pastikan service API berjalan.');
    } finally {
      setIsLoadingLogin(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('petugas_auth');
    if (map.current) {
      map.current.remove();
      map.current = null;
    }
    setMapLoaded(false);
    setIsLoggedIn(false);
  };

  // =========================================================================
  // 5. FETCH DATA WILAYAH AWAL
  // =========================================================================
  useEffect(() => {
    if (!isLoggedIn) return;

    const fetchInitialData = async () => {
      try {
        const API_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
        const resKec = await axios.get(`${API_URL}/api/v1/maps/get-list-kecamatan`);
        const dataKec = Array.isArray(resKec.data) ? resKec.data : (resKec.data?.data || []);
        setListKecamatan(dataKec);

        const resBatas = await fetch('/batas_sls.geojson');
        if (resBatas.ok) {
          const batas = await resBatas.json();
          setBatasWilayah(batas);
        }
      } catch (error) {
        console.error('Radar gagal memuat data awal:', error);
      }
    };

    fetchInitialData();
  }, [isLoggedIn]);

  const handleKecamatanChange = async (e) => {
    const kdkec = e.target.value;
    setSelectedKdkec(kdkec);

    setSelectedIddesa('');
    setSelectedSls('');
    setListKelurahan([]);
    setListSlsApi([]);
    setDataTitik([]);

    if (kdkec) {
      try {
        const API_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
        const resKel = await axios.get(`${API_URL}/api/v1/maps/get-list-kelurahan/${kdkec}`);
        const dataKel = Array.isArray(resKel.data) ? resKel.data : (resKel.data?.data || []);
        setListKelurahan(dataKel);
      } catch (error) {
        console.error('Gagal memuat master kelurahan:', error);
      }
    }
  };

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
        const rawData = Array.isArray(res.data) ? res.data : (res.data?.data || []);

        const sortedData = [...rawData].sort((a, b) => {
          const namaA = a.nmsls || '';
          const namaB = b.nmsls || '';
          return namaA.localeCompare(namaB, 'id', { numeric: true });
        });

        setListSlsApi(sortedData);
      } catch (err) {
        console.error('Gagal memuat daftar SLS:', err);
      }
    };

    fetchSlsList();
  }, [selectedIddesa]);

  // =========================================================================
  // 6. PENGELOMPOKAN SLS BERDASARKAN RW
  // =========================================================================
  const groupedSlsList = useMemo(() => {
    if (!Array.isArray(listSlsApi) || listSlsApi.length === 0) return [];

    const groups = {};
    listSlsApi.forEach((sls) => {
      const namaSls = sls.nmsls || '';
      let rwGroup = 'Lainnya (Tanpa RW)';

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

    return sortedRwKeys.map((key) => ({
      rwLabel: key,
      items: groups[key]
    }));
  }, [listSlsApi]);

  // =========================================================================
  // 7. TARIK DATA TITIK SPASIAL
  // =========================================================================
  const handleMuatData = async () => {
    if (!selectedIddesa) {
      alert('Mohon pilih Desa/Kelurahan terlebih dahulu.');
      return;
    }

    setIsLoading(true);
    try {
      const API_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
      const response = await axios.get(`${API_URL}/api/v1/maps/get-titik-tematik?iddesa=${selectedIddesa}`);
      const dataDariApi = response.data?.data || response.data;
      setDataTitik(Array.isArray(dataDariApi) ? dataDariApi : []);
    } catch (error) {
      console.error('Gagal menarik data titik:', error);
      setDataTitik([]);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredTitik = useMemo(() => {
    if (!Array.isArray(dataTitik)) return [];
    return selectedSls
      ? dataTitik.filter((p) => String(p.region_code || '').startsWith(selectedSls))
      : dataTitik;
  }, [dataTitik, selectedSls]);

  const geojsonData = useMemo(() => {
    const validTitik = filteredTitik.filter((p) => {
      const lng = parseFloat(p.longitude);
      const lat = parseFloat(p.latitude);
      return !isNaN(lng) && !isNaN(lat) && lng !== 0 && lat !== 0;
    });

    return {
      type: 'FeatureCollection',
      features: validTitik.map((p) => ({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [parseFloat(p.longitude), parseFloat(p.latitude)]
        },
        properties: { ...p }
      }))
    };
  }, [filteredTitik]);

  // =========================================================================
  // 8. MESIN REKAPITULASI NOMOR BANGUNAN
  // =========================================================================
  const rekapBangunan = useMemo(() => {
    if (!filteredTitik || filteredTitik.length === 0) {
      return { maxNum: 0, missing: [], dashCount: 0 };
    }

    let maxNum = 0;
    const existSet = new Set();
    let dashCount = 0;

    filteredTitik.forEach((titik) => {
      const numStr = String(titik.nomor_bangunan || '').trim();

      if (!numStr || numStr === '-' || numStr === '') {
        dashCount++;
      } else {
        const numMatch = numStr.match(/\d+/);
        if (numMatch) {
          const num = parseInt(numMatch[0], 10);
          // Batasi maksimal 2000 untuk mencegah loop berlebih jika nomor bangunan salah input
          if (num > 0 && num <= 2000) {
            existSet.add(num);
            if (num > maxNum) maxNum = num;
          }
        }
      }
    });

    const missing = [];
    for (let i = 1; i <= maxNum; i++) {
      if (!existSet.has(i)) {
        missing.push(i);
      }
    }

    return { maxNum, missing, dashCount };
  }, [filteredTitik]);

  // =========================================================================
  // 9. INISIALISASI & RENDERING MAPBOX
  // =========================================================================
  useEffect(() => {
    if (!isLoggedIn || map.current || !mapContainer.current) return;

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

      map.current.addLayer({
        id: '3d-buildings',
        source: 'composite',
        'source-layer': 'building',
        filter: ['==', 'extrude', 'true'],
        type: 'fill-extrusion',
        minzoom: 15,
        paint: {
          'fill-extrusion-color': '#e2e8f0',
          'fill-extrusion-height': ['get', 'height'],
          'fill-extrusion-base': ['get', 'min_height'],
          'fill-extrusion-opacity': 0.8
        }
      });

      map.current.addSource('data-se2026', {
        type: 'geojson',
        data: geojsonData
      });

      map.current.addLayer({
        id: 'titik-se2026',
        type: 'circle',
        source: 'data-se2026',
        paint: {
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

      map.current.addLayer({
        id: 'label-titik-se2026',
        type: 'symbol',
        source: 'data-se2026',
        minzoom: 16,
        layout: {
          'text-field': ['get', 'nomor_bangunan'],
          'text-size': 11,
          'text-offset': [0, 1.2],
          'text-anchor': 'top',
          'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold']
        },
        paint: {
          'text-color': '#ffffff',
          'text-halo-color': '#1e293b',
          'text-halo-width': 2
        }
      });

      map.current.on('click', 'titik-se2026', (e) => {
        if (!e.features?.length) return;
        const coordinates = e.features[0].geometry.coordinates.slice();
        const { nama_usaha, alamat, nomor_bangunan, status_alias, nmkec, nmdesa } = e.features[0].properties;

        const popupHTML = `
          <div style="padding: 4px;">
            <div style="font-size: 10px; font-weight: bold; text-transform: uppercase; margin-bottom: 2px; color: #3b82f6;">
              Kec. ${nmkec || '-'}, Kel. ${nmdesa || '-'}
            </div>
            <div style="font-size: 10px; font-weight: bold; text-transform: uppercase; margin-bottom: 6px; color: #f97316;">
              STATUS: ${status_alias || 'Belum Diketahui'} <span style="color: #64748b; margin-left: 4px;">| BLOK/NO: ${nomor_bangunan || '-'}</span>
            </div>
            <h3 style="font-weight: 900; color: #1e293b; font-size: 14px; margin: 0 0 4px 0;">${nama_usaha || 'Nama Tidak Tersedia'}</h3>
            <p style="font-size: 12px; color: #64748b; margin: 0;">${alamat || 'Alamat belum diisi'}</p>
          </div>
        `;
        new mapboxgl.Popup().setLngLat(coordinates).setHTML(popupHTML).addTo(map.current);
      });

      map.current.on('mouseenter', 'titik-se2026', () => {
        map.current.getCanvas().style.cursor = 'pointer';
      });
      map.current.on('mouseleave', 'titik-se2026', () => {
        map.current.getCanvas().style.cursor = '';
      });
    });
  }, [isLoggedIn]);

  useEffect(() => {
    if (mapLoaded && map.current && map.current.getSource('data-se2026')) {
      map.current.getSource('data-se2026').setData(geojsonData);
    }
  }, [geojsonData, mapLoaded]);

  useEffect(() => {
    if (mapLoaded && map.current && batasWilayah) {
      const sourceId = 'source-batas-wilayah';
      if (!map.current.getSource(sourceId)) {
        map.current.addSource(sourceId, { type: 'geojson', data: batasWilayah });
        map.current.addLayer(
          {
            id: 'layer-batas-area',
            type: 'fill',
            source: sourceId,
            paint: { 'fill-color': '#3b82f6', 'fill-opacity': 0.05 }
          },
          '3d-buildings'
        );
        map.current.addLayer(
          {
            id: 'layer-batas-garis',
            type: 'line',
            source: sourceId,
            paint: { 'line-color': '#64748b', 'line-width': 1.5, 'line-dasharray': [3, 3] }
          },
          '3d-buildings'
        );
      } else {
        map.current.getSource(sourceId).setData(batasWilayah);
      }
    }
  }, [mapLoaded, batasWilayah]);

  useEffect(() => {
    if (mapLoaded && map.current && map.current.getLayer('layer-batas-area')) {
      if (selectedSls) {
        map.current.setPaintProperty('layer-batas-area', 'fill-opacity', [
          'match',
          ['get', 'idsubsls'],
          selectedSls,
          0.4,
          0.05
        ]);
      } else {
        map.current.setPaintProperty('layer-batas-area', 'fill-opacity', 0.05);
      }
    }
  }, [selectedSls, mapLoaded]);

  // =========================================================================
  // 10. FITUR AUTO-ZOOM
  // =========================================================================
  useEffect(() => {
    if (!mapLoaded || !map.current) return;

    const bounds = new mapboxgl.LngLatBounds();
    let hasBounds = false;

    if (geojsonData?.features?.length > 0) {
      geojsonData.features.forEach((feature) => {
        if (feature.geometry?.coordinates) {
          bounds.extend(feature.geometry.coordinates);
          hasBounds = true;
        }
      });
    } else if (batasWilayah?.features) {
      let featuresToFit = [];
      if (selectedSls) {
        featuresToFit = batasWilayah.features.filter(
          (f) => String(f.properties?.idsubsls) === String(selectedSls)
        );
      } else if (selectedIddesa) {
        featuresToFit = batasWilayah.features.filter((f) =>
          String(f.properties?.idsubsls || '').startsWith(selectedIddesa)
        );
      }

      featuresToFit.forEach((feature) => {
        if (feature.geometry?.type === 'Polygon') {
          feature.geometry.coordinates[0].forEach((coord) => {
            bounds.extend(coord);
            hasBounds = true;
          });
        } else if (feature.geometry?.type === 'MultiPolygon') {
          feature.geometry.coordinates.forEach((polygon) => {
            polygon[0].forEach((coord) => {
              bounds.extend(coord);
              hasBounds = true;
            });
          });
        }
      });
    }

    if (hasBounds) {
      map.current.fitBounds(bounds, {
        padding: 80,
        duration: 2000,
        maxZoom: 18,
        pitch: 60,
        bearing: -20
      });
    } else if (!selectedIddesa && !selectedSls) {
      map.current.flyTo({ center: [112.6326, -7.9839], zoom: 13, duration: 2000, pitch: 60 });
    }
  }, [geojsonData, selectedSls, selectedIddesa, batasWilayah, mapLoaded]);

  // =========================================================================
  // 11. TAMPILAN ANTARMUKA
  // =========================================================================
  if (!isLoggedIn) {
    return (
      <div className="w-screen h-screen flex items-center justify-center bg-slate-950 font-sans p-4">
        <div className="bg-slate-900 border border-slate-800 p-8 rounded-2xl shadow-2xl w-full max-w-md">
          <div className="text-center mb-6">
            <h2 className="text-xl font-black text-white tracking-tight">COMMAND CENTER SE2026</h2>
            <p className="text-xs text-rose-400 font-semibold mt-1">Akses Terbatas Khusus Petugas Lapangan</p>
          </div>

          {errorLogin && (
            <div className="mb-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs p-3 rounded-lg font-bold text-center">
              {errorLogin}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="text-xs font-bold text-slate-400 block mb-1">ID Petugas / Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Masukkan username..."
                required
                className="w-full bg-slate-950 border border-slate-800 text-white text-sm rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-400 block mb-1">Kata Sandi</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full bg-slate-950 border border-slate-800 text-white text-sm rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500"
              />
            </div>
            <button
              type="submit"
              disabled={isLoadingLogin}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-blue-600/30 text-sm mt-2 flex justify-center items-center gap-2 disabled:opacity-50"
            >
              {isLoadingLogin ? <span className="animate-pulse">Memverifikasi...</span> : 'MASUK KE SISTEM PEMETAAN'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col md:flex-row w-full h-full min-h-screen bg-slate-100 p-4 font-sans relative">
      <div className="absolute top-6 right-6 z-50">
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 bg-slate-800 hover:bg-rose-600 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-lg border border-slate-700 transition-all"
        >
          <LogOut size={14} /> Keluar
        </button>
      </div>

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
          <div className="space-y-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
            <h3 className="text-xs font-black text-slate-400 tracking-wider mb-2">FILTER WILAYAH (WAJIB)</h3>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">Kecamatan</label>
              <select
                value={selectedKdkec}
                onChange={handleKecamatanChange}
                className="w-full text-sm p-2.5 border border-slate-200 rounded-lg bg-white outline-none focus:border-blue-500 transition-all cursor-pointer"
              >
                <option value="">-- Pilih Kecamatan --</option>
                {Array.isArray(listKecamatan) &&
                  listKecamatan.map((kec) => (
                    <option key={kec.kdkec} value={kec.kdkec}>
                      {kec.nmkec}
                    </option>
                  ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">Desa / Kelurahan</label>
              <select
                value={selectedIddesa}
                onChange={(e) => {
                  setSelectedIddesa(e.target.value);
                  setDataTitik([]);
                  setSelectedSls('');
                }}
                disabled={!selectedKdkec}
                className="w-full text-sm p-2.5 border border-slate-200 rounded-lg bg-white outline-none focus:border-blue-500 transition-all cursor-pointer disabled:bg-slate-100 disabled:text-slate-400"
              >
                <option value="">{selectedKdkec ? '-- Pilih Desa --' : 'Pilih Kecamatan Dulu'}</option>
                {Array.isArray(listKelurahan) &&
                  listKelurahan.map((desa) => (
                    <option key={desa.iddesa} value={desa.iddesa}>
                      {desa.nmdesa}
                    </option>
                  ))}
              </select>
            </div>

            <div className="space-y-1.5 mt-2">
              <label className="text-xs font-bold text-slate-700">Satuan Lingkungan Setempat (SLS)</label>
              <select
                value={selectedSls}
                onChange={(e) => setSelectedSls(e.target.value)}
                disabled={groupedSlsList.length === 0}
                className="w-full text-sm p-2.5 border border-slate-200 rounded-lg bg-white outline-none focus:border-blue-500 transition-all cursor-pointer disabled:bg-slate-100 disabled:text-slate-400"
              >
                <option value="">{groupedSlsList.length > 0 ? '-- Semua SLS --' : 'Pilih Kelurahan Dulu'}</option>
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
                <span className="animate-pulse">Menarik Koordinat...</span>
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

          {dataTitik.length > 0 && (
            <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-xl">
              <p className="text-xs font-bold text-emerald-600 uppercase tracking-wider mb-1">Status Radar</p>
              <p className="text-2xl font-black text-emerald-700">
                {dataTitik.length.toLocaleString('id-ID')}{' '}
                <span className="text-sm font-semibold">Titik Termuat</span>
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 h-[80vh] md:h-auto w-full relative border border-slate-200 rounded-r-2xl overflow-hidden shadow-lg">
        <div ref={mapContainer} className="w-full h-full absolute inset-0" />

        {filteredTitik.length > 0 && (
          <div className="absolute bottom-6 right-10 z-[1000] bg-slate-900/95 backdrop-blur-md border border-slate-700 p-5 rounded-2xl shadow-2xl w-80 max-h-[50vh] flex flex-col pointer-events-auto">
            <h3 className="text-sm font-black text-white flex items-center gap-2 mb-3 border-b border-slate-700/50 pb-2">
              <Info className="text-amber-500" size={16} />
              Radar Kelengkapan Bangunan
            </h3>

            <div className="space-y-4 overflow-y-auto flex-1 pr-2">
              <div className="bg-slate-800/50 p-3 rounded-xl border border-slate-700">
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">
                  Bangunan Tanpa Nomor (-)
                </p>
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-black text-amber-400">{rekapBangunan.dashCount}</span>
                  <span className="text-[10px] bg-slate-900 text-slate-400 px-2 py-1 rounded-md">Titik</span>
                </div>
              </div>

              <div className="bg-slate-800/50 p-3 rounded-xl border border-slate-700">
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">
                  Nomor Bangunan Terlewat
                </p>
                <p className="text-[10px] text-slate-500 mb-2">
                  Tertinggi tercatat: <span className="text-blue-400 font-bold">No. {rekapBangunan.maxNum}</span>
                </p>

                {rekapBangunan.missing.length === 0 ? (
                  <div className="bg-emerald-500/10 text-emerald-400 text-xs p-2 rounded-lg font-bold text-center border border-emerald-500/20">
                    Semua Urutan Lengkap!
                  </div>
                ) : (
                  <div className="bg-rose-500/10 border border-rose-500/20 p-2 rounded-lg">
                    <p className="text-[10px] font-bold text-rose-400 mb-1">
                      Terdeteksi {rekapBangunan.missing.length} nomor hilang:
                    </p>
                    <p className="text-[11px] font-mono text-slate-300 break-words leading-relaxed max-h-24 overflow-y-auto">
                      {rekapBangunan.missing.join(', ')}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
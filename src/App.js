import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, doc, setDoc, onSnapshot, updateDoc, 
  collection, addDoc, deleteDoc, arrayUnion, arrayRemove, query, orderBy, getDocs
} from 'firebase/firestore';
import { 
  getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken 
} from 'firebase/auth';
import { 
  Bell, Mic, Volume2, Users, Play, Monitor, Pause,
  Plus, Edit2, X, Music, Calendar, StopCircle, UserPlus, Trash2, Save, Copy, ArrowRight, LogOut, RefreshCw, AlertTriangle, Share, Loader2
} from 'lucide-react';

// --- VERSİYON NUMARASI ---
const VERSION = "19.01.18.15"; // Gün.Ay.Saat.Dakika

// --- Firebase Yapılandırması (SABİT) ---
const firebaseConfig = {
  apiKey: "AIzaSyAalfjc7mtPjbdJloBl1KjjPrITQCWEYWs",
  authDomain: "zilsekerp-nar.firebaseapp.com",
  projectId: "zilsekerp-nar",
  storageBucket: "zilsekerp-nar.firebasestorage.app",
  messagingSenderId: "354370437926",
  appId: "1:354370437926:web:693fe4ffe50cf25bf2b7e7",
  measurementId: "G-F62G5ZSBVL"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const appId = (typeof window !== 'undefined' && window['__app_id']) ? window['__app_id'] : 'smart-bell-app-pro';

const DAYS = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar"];
const DEFAULT_SOUNDS = [
  { id: 'classic', name: 'Klasik Zil', url: 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3' },
  { id: 'school', name: 'Okul Zili', url: 'https://assets.mixkit.co/active_storage/sfx/950/950-preview.mp3' },
];

export default function App() {
  // --- STATE TANIMLARI ---
  const [user, setUser] = useState(null);
  const [profileName, setProfileName] = useState(() => localStorage.getItem('bell_profile_name') || '');
  const [isStation, setIsStation] = useState(() => localStorage.getItem('bell_is_station') === 'true');
  const [activeTab, setActiveTab] = useState('control'); 
  const [isIOS, setIsIOS] = useState(false);
  
  const [systemState, setSystemState] = useState({
    volume: 50,
    stopSignal: 0,
    activeControllerId: null,
    activeControllerName: '',
    announcementUrl: null,
    lastTriggeredBell: null
  });

  const [schedule, setSchedule] = useState([]);
  const [customSounds, setCustomSounds] = useState([]);
  const [allowedUsers, setAllowedUsers] = useState([]);
  
  // UI State
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [isUploadingChunk, setIsUploadingChunk] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isSavingSchedule, setIsSavingSchedule] = useState(false);
  const [playingSoundId, setPlayingSoundId] = useState(null);

  // Modals
  const [scheduleModal, setScheduleModal] = useState({ open: false, mode: 'add', data: null, day: null });
  const [copyModal, setCopyModal] = useState({ open: false, type: 'day', sourceData: null });
  const [passwordModal, setPasswordModal] = useState(false);
  
  // Refs (Bellek Yönetimi İçin)
  const stationAudioRef = useRef(new Audio()); 
  const previewAudioRef = useRef(new Audio());
  const mediaRecorderRef = useRef(null);
  const audioQueueRef = useRef([]); 
  const isPlayingQueueRef = useRef(false);

  // --- 1. BAŞLANGIÇ AYARLARI ---
  useEffect(() => {
    // Tailwind CSS Kontrolü
    if (!document.getElementById('tailwind-script')) {
      const script = document.createElement('script');
      script.id = 'tailwind-script';
      script.src = "https://cdn.tailwindcss.com";
      script.async = true;
      document.head.appendChild(script);
    }
    
    // iOS Kontrolü
    const userAgent = window.navigator.userAgent.toLowerCase();
    setIsIOS(/iphone|ipad|ipod/.test(userAgent));

    // Audio Error Handling
    stationAudioRef.current.onerror = (e) => console.warn("Audio Error:", e);
    previewAudioRef.current.onerror = (e) => console.warn("Preview Error:", e);
    
    // Cleanup
    return () => {
        if(stationAudioRef.current) stationAudioRef.current.pause();
        if(previewAudioRef.current) previewAudioRef.current.pause();
    };
  }, []);

  // --- 2. AUTHENTICATION ---
  useEffect(() => {
    const initAuth = async () => {
      try {
        await signInAnonymously(auth);
      } catch (err) { 
          console.error("Auth error:", err); 
          setStatusMsg("Bağlantı Hatası: Lütfen sayfayı yenileyin."); 
      }
    };
    initAuth();
    return onAuthStateChanged(auth, setUser);
  }, []);

  // --- 3. VERİ SENKRONİZASYONU ---
  useEffect(() => {
    if (!user) return;

    // Ayarlar Dinleyicisi
    const settingsRef = doc(db, 'artifacts', appId, 'public', 'data', 'system_meta', 'settings');
    const unsubSettings = onSnapshot(settingsRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        
        // İSTASYON MODU SES İŞLEMLERİ
        if (isStation) {
            // Ses Seviyesi
            if (data.volume !== undefined && stationAudioRef.current) {
                stationAudioRef.current.volume = Math.max(0, Math.min(1, data.volume / 100));
            }
            // Acil Durdurma
            if (data.stopSignal && data.stopSignal !== systemState.stopSignal) {
                stationAudioRef.current.pause();
                stationAudioRef.current.currentTime = 0;
                audioQueueRef.current = [];
                isPlayingQueueRef.current = false;
            }
        }
        setSystemState(prev => ({ ...prev, ...data }));
      } else {
        // Varsayılan Ayarları Oluştur
        setDoc(settingsRef, { volume: 50, stopSignal: 0, activeControllerId: null });
      }
    });

    // Canlı Yayın Dinleyicisi (Sadece İstasyon)
    let unsubLiveStream = () => {};
    if (isStation) {
        const streamQuery = query(collection(db, 'artifacts', appId, 'public', 'data', 'live_stream'), orderBy('createdAt', 'asc'));
        unsubLiveStream = onSnapshot(streamQuery, (snapshot) => {
            snapshot.docChanges().forEach((change) => {
                if (change.type === "added") {
                    const audioData = change.doc.data();
                    // 15 saniye kuralı: Çok eski paketleri çalma
                    if (Date.now() - audioData.createdAt < 15000) {
                        playAudioChunk(audioData.url);
                    }
                    // Okunan paketi sil
                    deleteDoc(change.doc.ref).catch(() => {});
                }
            });
        });
    }

    // Diğer Veriler
    const unsubUsers = onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'system_meta', 'users'), 
        (s) => setAllowedUsers(s.exists() ? s.data().list || [] : [])
    );
    const unsubSchedule = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'schedule'), (s) => {
        const items = []; s.forEach(d => items.push({ id: d.id, ...d.data() })); setSchedule(items);
    });
    const unsubSounds = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'sounds'), (s) => {
        const items = []; s.forEach(d => items.push({ id: d.id, ...d.data() })); setCustomSounds(items);
    });

    return () => {
        unsubSettings();
        unsubLiveStream();
        unsubUsers();
        unsubSchedule();
        unsubSounds();
    };
  }, [user, isStation, systemState.stopSignal, systemState.announcementUrl]);

  // --- SES İŞLEME MANTIĞI ---
  const playAudioChunk = (base64Url) => {
      audioQueueRef.current.push(base64Url);
      processAudioQueue();
  };

  const processAudioQueue = () => {
      if (isPlayingQueueRef.current || audioQueueRef.current.length === 0) return;

      isPlayingQueueRef.current = true;
      const nextChunk = audioQueueRef.current.shift();
      
      stationAudioRef.current.src = nextChunk;
      stationAudioRef.current.onended = () => {
          isPlayingQueueRef.current = false;
          processAudioQueue();
      };
      stationAudioRef.current.play().catch(e => {
          console.warn("Oynatma hatası (kullanıcı etkileşimi gerekebilir):", e);
          isPlayingQueueRef.current = false;
          processAudioQueue();
      });
  };

  // --- ZAMANLAYICI (ZİL ÇALMA) ---
  useEffect(() => {
    if (!isStation || !user) return;
    
    const interval = setInterval(() => {
      const now = new Date();
      const currentDay = DAYS[now.getDay() === 0 ? 6 : now.getDay() - 1];
      const currentTime = now.toTimeString().slice(0, 5);
      
      schedule.forEach(item => {
        if (item.day === currentDay && item.time === currentTime) {
          const triggerKey = `${item.id}-${currentTime}`;
          
          if (systemState.lastTriggeredBell !== triggerKey) {
            // Anons yoksa çal
            if (!isPlayingQueueRef.current) {
                stationAudioRef.current.src = item.soundUrl;
                stationAudioRef.current.onended = null; 
                stationAudioRef.current.volume = (systemState.volume || 50) / 100;
                stationAudioRef.current.play().catch(e => console.error("Zil Çalma Hatası", e));
            }
            // Tetiklendi olarak işaretle
            updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'system_meta', 'settings'), { lastTriggeredBell: triggerKey }).catch(()=>{});
          }
        }
      });
    }, 4000); // 4 saniyede bir kontrol

    return () => clearInterval(interval);
  }, [isStation, schedule, systemState.lastTriggeredBell, systemState.volume, user]);

  // --- ANONS FONKSİYONLARI ---
  const toggleBroadcast = async () => {
      if (isBroadcasting) stopBroadcast();
      else startBroadcast();
  };

  const startBroadcast = async () => {
      try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          mediaRecorderRef.current = new MediaRecorder(stream);
          
          mediaRecorderRef.current.ondataavailable = async (e) => {
              if (e.data.size > 0) {
                  setIsUploadingChunk(true);
                  const reader = new FileReader();
                  reader.readAsDataURL(e.data);
                  reader.onloadend = async () => {
                      try {
                          await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'live_stream'), {
                              url: reader.result,
                              createdAt: Date.now(),
                              user: profileName
                          });
                      } catch (err) { console.error("Stream Err", err); } 
                      finally { setIsUploadingChunk(false); }
                  };
              }
          };

          mediaRecorderRef.current.start(1000); // 1sn'lik paketler
          setIsBroadcasting(true);
          setStatusMsg("Canlı Yayın Başladı...");
      } catch (err) {
          console.error("Mic Error", err);
          setStatusMsg("Mikrofon izni verilemedi!");
      }
  };

  const stopBroadcast = () => {
      if (mediaRecorderRef.current) {
          mediaRecorderRef.current.stop();
          mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop());
      }
      setIsBroadcasting(false);
      setStatusMsg("Yayın Bitti.");
      setTimeout(() => setStatusMsg(''), 2000);
  };

  // --- YARDIMCI FONKSİYONLAR ---
  const handleSoundPreview = (id, url) => {
      if (playingSoundId === id) {
          previewAudioRef.current.pause();
          previewAudioRef.current.currentTime = 0;
          setPlayingSoundId(null);
      } else {
          previewAudioRef.current.src = url;
          previewAudioRef.current.volume = 1.0;
          previewAudioRef.current.play().catch(e => console.warn("Preview Err", e));
          setPlayingSoundId(id);
          previewAudioRef.current.onended = () => setPlayingSoundId(null);
      }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 800 * 1024) { setStatusMsg("Dosya > 800KB!"); return; }

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'sounds'), {
            name: file.name, url: event.target.result, createdAt: Date.now()
        });
        setStatusMsg("Zil sesi eklendi.");
      } catch (err) { setStatusMsg("Hata: " + err.message); }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleAddSchedule = async (e) => {
      e.preventDefault();
      if (isSavingSchedule) return;
      setIsSavingSchedule(true);

      const fd = new FormData(e.target);
      const time = fd.get('time');
      const day = scheduleModal.day;
      
      const isDuplicate = schedule.some(s => s.day === day && s.time === time && (!scheduleModal.data || s.id !== scheduleModal.data.id));

      if (isDuplicate) {
          setStatusMsg("Bu saatte zaten zil var!");
          setIsSavingSchedule(false);
          return;
      }

      const newItem = {
          time, 
          label: fd.get('label'), 
          soundUrl: (DEFAULT_SOUNDS.find(s=>s.id===fd.get('soundId')) || customSounds.find(s=>s.id===fd.get('soundId')) || DEFAULT_SOUNDS[0]).url
      };

      try {
          if(scheduleModal.mode === 'edit') {
              await updateDoc(doc(db,'artifacts',appId,'public','data','schedule',scheduleModal.data.id), newItem);
          } else {
              await addDoc(collection(db,'artifacts',appId,'public','data','schedule'), {...newItem, day});
          }
          setScheduleModal({open:false, mode:'add', data:null, day:null});
          setStatusMsg("Kaydedildi.");
      } catch(err) {
          console.error(err);
          setStatusMsg("Kayıt başarısız.");
      } finally {
          setIsSavingSchedule(false);
          setTimeout(() => setStatusMsg(''), 2000);
      }
  };

  const performCopy = async (targetDay) => {
      if (!copyModal.sourceData) return;
      
      if (copyModal.type === 'day') {
          const items = schedule.filter(s => s.day === copyModal.sourceData);
          if (items.length === 0) {
              setStatusMsg("Kopyalanacak veri yok.");
              setCopyModal({ open: false, type: 'day', sourceData: null });
              return;
          }
          items.forEach(i => addDoc(collection(db,'artifacts',appId,'public','data','schedule'), { day: targetDay, time:i.time, label:i.label, soundUrl:i.soundUrl }));
          setStatusMsg(`${copyModal.sourceData} > ${targetDay} kopyalandı.`);
      } else {
          const i = copyModal.sourceData;
          addDoc(collection(db,'artifacts',appId,'public','data','schedule'), { day: targetDay, time:i.time, label:i.label, soundUrl:i.soundUrl });
          setStatusMsg(`Alarm ${targetDay} gününe kopyalandı.`);
      }
      setCopyModal({ open: false, type: 'day', sourceData: null });
      setTimeout(() => setStatusMsg(''), 3000);
  };

  const handleLogin = (e) => {
      if (e.key === 'Enter') {
          const name = e.target.value.trim();
          if(allowedUsers.includes(name)) {
              setProfileName(name); localStorage.setItem('bell_profile_name', name);
          } else setLoginError('Kullanıcı bulunamadı.');
      }
  };

  const handleStationLogin = (e) => {
      e.preventDefault();
      if (e.target.password.value === '1453') {
          setIsStation(true); setProfileName('Terminal'); localStorage.setItem('bell_is_station', 'true'); setPasswordModal(false);
      } else { alert("Hatalı şifre!"); }
  };

  const handleResetApp = () => { if(window.confirm("Çıkış yapılsın mı?")) { localStorage.clear(); window.location.reload(); } };

  // --- Views ---
  const UsersView = () => (
      <div className="space-y-4 animate-in fade-in">
          <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800">
              <h2 className="text-lg font-bold mb-4 text-white flex gap-2"><UserPlus/> Kullanıcı Ekle</h2>
              <form onSubmit={async(e)=>{e.preventDefault(); const n=e.target.u.value.trim(); if(n){await updateDoc(doc(db,'artifacts',appId,'public','data','system_meta','users'),{list:arrayUnion(n)}); e.target.reset();}}} className="flex gap-2">
                  <input name="u" placeholder="İsim" className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-white outline-none" required />
                  <button className="bg-blue-600 px-4 rounded-xl text-white font-bold">Ekle</button>
              </form>
          </div>
          <div className="space-y-2">
              {allowedUsers.map(u=>(<div key={u} className="bg-slate-900 p-3 rounded-xl border border-slate-800 flex justify-between text-white"><span className="font-bold">{u}</span><button onClick={()=>updateDoc(doc(db,'artifacts',appId,'public','data','system_meta','users'),{list:arrayRemove(u)})} className="text-red-500"><Trash2 size={16}/></button></div>))}
          </div>
      </div>
  );

  // --- GİRİŞ EKRANI ---
  if (!profileName && !isStation) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6 relative">
        {passwordModal && (
            <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
                <form onSubmit={handleStationLogin} className="bg-slate-900 p-8 rounded-3xl w-full max-w-sm text-center border border-slate-700">
                    <h3 className="text-xl font-bold mb-4">Terminal</h3>
                    <input type="password" name="password" className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 mb-4 text-center text-white" autoFocus />
                    <div className="flex gap-2"><button type="button" onClick={()=>setPasswordModal(false)} className="flex-1 py-3 bg-slate-800 rounded-xl">İptal</button><button className="flex-1 py-3 bg-blue-600 rounded-xl">Giriş</button></div>
                </form>
            </div>
        )}
        <div className="max-w-md w-full bg-slate-900 rounded-[2.5rem] p-10 shadow-2xl border border-slate-800 text-center relative overflow-hidden">
          <div className="bg-blue-600 w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-2xl shadow-blue-900/50"><Bell size={40} /></div>
          <h1 className="text-3xl font-black mb-2 tracking-tight">Akıllı Zil</h1>
          <p className="text-slate-400 mb-8 text-sm">Giriş yapmak için isminizi yazın.</p>
          <input type="text" placeholder="Kullanıcı Adı" className={`w-full bg-slate-950 border ${loginError?'border-red-500':'border-slate-800'} rounded-2xl px-6 py-4 text-center font-bold text-white mb-4 outline-none`} onKeyDown={handleLogin} />
          {loginError && <div className="text-red-500 text-xs font-bold mb-4">{loginError}</div>}
          <div className="pt-6 border-t border-slate-800 flex flex-col gap-4">
             <button onClick={()=>setPasswordModal(true)} className="flex items-center justify-center gap-2 text-xs font-black uppercase text-emerald-500 hover:text-emerald-400"><Monitor size={14}/> Terminal Girişi</button>
             <button onClick={handleResetApp} className="flex items-center justify-center gap-2 text-xs font-black uppercase text-slate-600 hover:text-red-500"><RefreshCw size={14}/> Sıfırla</button>
          </div>
        </div>
        <div className="absolute bottom-4 right-4 text-xs text-slate-600 font-mono opacity-50">v{VERSION}</div>
      </div>
    );
  }

  // --- ANA UYGULAMA ---
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans pb-24 relative">
      <header className="bg-slate-900/50 backdrop-blur-xl border-b border-slate-800 p-4 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="bg-blue-600 p-2 rounded-xl shadow-lg"><Bell size={20} /></div>
            <div>
              <h1 className="font-black text-lg tracking-tight">ZİL SİSTEMİ</h1>
              <span className="text-[10px] text-slate-400 font-black uppercase block">{isStation ? 'TERMİNAL' : profileName}</span>
            </div>
          </div>
          <div className="hidden md:flex bg-slate-950 rounded-2xl p-1 border border-slate-800">
            {['control', 'planner', 'sounds', 'users'].map(t => (
                (!isStation && t === 'users') ? null : 
                <button key={t} onClick={() => setActiveTab(t)} className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${activeTab === t ? 'bg-blue-600 text-white' : 'text-slate-500 hover:text-white'}`}>{t.toUpperCase()}</button>
            ))}
          </div>
          <button onClick={handleResetApp} className="p-2 bg-slate-800 rounded-full hover:bg-red-900/50 text-slate-400 hover:text-red-400"><LogOut size={16} /></button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-4 md:p-8">
        {statusMsg && <div className="fixed top-20 left-1/2 -translate-x-1/2 bg-blue-600/90 backdrop-blur text-white px-6 py-3 rounded-2xl shadow-2xl font-bold text-xs animate-bounce z-[100] border border-blue-400/50 flex items-center gap-2"><AlertTriangle size={16} /> {statusMsg}</div>}

        {activeTab === 'control' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in">
                <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800 shadow-xl flex flex-col justify-between">
                    <div>
                        <div className="flex justify-between mb-8"><h2 className="text-xs font-black uppercase text-slate-500 flex gap-2"><Volume2 size={16}/> Ses</h2><span className="text-3xl font-mono font-bold text-blue-500">{systemState.volume}%</span></div>
                        <input type="range" min="0" max="100" value={systemState.volume} 
                            onChange={(e)=>{const v=parseInt(e.target.value); setSystemState(p=>({...p, volume:v}));}} 
                            onMouseUp={()=>updateDoc(doc(db,'artifacts',appId,'public','data','system_meta','settings'),{volume:systemState.volume})} 
                            onTouchEnd={()=>updateDoc(doc(db,'artifacts',appId,'public','data','system_meta','settings'),{volume:systemState.volume})} 
                            className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500 mb-6"/>
                    </div>
                    <button onClick={()=>updateDoc(doc(db,'artifacts',appId,'public','data','system_meta','settings'),{stopSignal:Date.now()})} className="w-full bg-red-900/30 hover:bg-red-600 text-red-500 hover:text-white border border-red-900/50 p-4 rounded-xl flex items-center justify-center gap-3 active:scale-95 group"><StopCircle size={24}/><span className="font-bold">SESİ KES</span></button>
                </div>
                <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800 flex flex-col items-center justify-center relative min-h-[250px]">
                    <button onClick={toggleBroadcast} className={`w-32 h-32 rounded-full flex items-center justify-center transition-all ${isBroadcasting ? 'bg-red-600 animate-pulse shadow-2xl shadow-red-900/50 scale-110' : 'bg-slate-800 hover:bg-slate-700 shadow-xl'}`}>
                        {isBroadcasting ? <StopCircle size={48} className="text-white"/> : <Mic size={48} className="text-slate-400"/>}
                    </button>
                    <p className={`mt-6 text-xs font-black uppercase tracking-widest text-center ${isBroadcasting ? 'text-red-500 animate-pulse' : 'text-slate-500'}`}>
                        {isBroadcasting ? 'CANLI YAYIN (DURDURMAK İÇİN BAS)' : 'ANONS İÇİN DOKUN (BAŞLAT/DURDUR)'}
                    </p>
                    {isUploadingChunk && <div className="absolute top-4 right-4 text-xs text-blue-500 flex gap-1 items-center"><Loader2 size={12} className="animate-spin"/> İletiliyor</div>}
                </div>
            </div>
        )}

        {activeTab === 'planner' && (
            <div className="space-y-6 animate-in slide-in-from-bottom-4 relative">
                 {scheduleModal.open && (
                    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                        <div className="bg-slate-900 border border-slate-700 p-6 rounded-3xl w-full max-w-sm shadow-2xl">
                             <div className="flex justify-between items-center mb-6"><h3 className="font-bold text-lg text-white">Alarm Ekle</h3><button onClick={() => setScheduleModal({ open: false, mode: 'add', data: null, day: null })} className="p-2 bg-slate-800 rounded-full text-slate-400"><X size={20}/></button></div>
                             <form onSubmit={handleAddSchedule} className="space-y-4">
                                <input name="time" type="time" required defaultValue={scheduleModal.data?.time||"08:00"} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 outline-none text-white" />
                                <input name="label" placeholder="Etiket" defaultValue={scheduleModal.data?.label||""} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 outline-none text-white" />
                                <select name="soundId" defaultValue={scheduleModal.data ? [...DEFAULT_SOUNDS, ...customSounds].find(s=>s.url===scheduleModal.data.soundUrl)?.id : 'classic'} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 outline-none text-white">
                                    {[...DEFAULT_SOUNDS, ...customSounds].map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
                                </select>
                                <button type="submit" disabled={isSavingSchedule} className="w-full bg-blue-600 py-3 rounded-xl font-bold text-white disabled:opacity-50">{isSavingSchedule ? 'Kaydediliyor...' : 'Kaydet'}</button>
                             </form>
                        </div>
                    </div>
                )}
                {copyModal.open && (
                     <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                        <div className="bg-slate-900 border border-slate-700 p-6 rounded-3xl w-full max-w-sm shadow-2xl">
                            <div className="flex justify-between items-center mb-6"><h3 className="font-bold text-lg text-white flex items-center gap-2"><Copy size={20} className="text-blue-500"/> Kopyala</h3><button onClick={() => setCopyModal({ open: false, type: 'day', sourceData: null })} className="p-2 bg-slate-800 rounded-full text-slate-400"><X size={20}/></button></div>
                            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 mb-6"><div className="text-[10px] font-bold text-slate-500 uppercase mb-1">Kaynak</div><div className="font-bold text-white">{copyModal.type === 'day' ? `${copyModal.sourceData} Günü` : `${copyModal.sourceData.time} - ${copyModal.sourceData.label}`}</div></div>
                            <div className="space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar">
                                <div className="text-[10px] font-bold text-slate-500 uppercase mb-2 ml-1">HEDEF GÜN SEÇİN</div>
                                {DAYS.filter(d => copyModal.type === 'single' || d !== copyModal.sourceData).map(day => (
                                    <button key={day} onClick={() => performCopy(day)} className="w-full flex items-center justify-between bg-slate-800 hover:bg-blue-600 hover:text-white p-3 rounded-xl transition-all group"><span className="font-medium text-white">{day}</span><ArrowRight size={16} className="text-slate-500 group-hover:text-white" /></button>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
                <div className="flex flex-col md:flex-row gap-4 overflow-x-auto pb-4 custom-scrollbar min-h-[600px]">
                    {DAYS.map(day => (
                        <div key={day} className="min-w-[300px] bg-slate-900 rounded-3xl border border-slate-800 flex flex-col h-[600px] shadow-lg relative">
                             <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900/95 sticky top-0 rounded-t-3xl z-10">
                                <h3 className="font-black text-xs uppercase text-blue-400">{day}</h3>
                                <div className="flex gap-1">
                                    <button onClick={() => setCopyModal({ open: true, type: 'day', sourceData: day })} className="p-2 hover:bg-slate-800 rounded-lg text-slate-500 transition-colors"><Copy size={16} /></button>
                                    <button onClick={() => setScheduleModal({open:true, mode:'add', data:null, day})} className="p-2 bg-blue-600 rounded-lg text-white"><Plus size={16}/></button>
                                </div>
                             </div>
                             <div className="p-2 overflow-y-auto flex-1 space-y-2">
                                {schedule.filter(s=>s.day===day).sort((a,b)=>a.time.localeCompare(b.time)).map(item=>(
                                    <div key={item.id} className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex justify-between items-center group">
                                        <div><div className="font-mono font-bold text-lg text-white">{item.time}</div><div className="text-[10px] text-slate-500 uppercase">{item.label}</div></div>
                                        <div className="flex gap-1">
                                            <button onClick={() => setCopyModal({ open: true, type: 'single', sourceData: item })} className="p-1.5 text-slate-500 hover:text-white hover:bg-slate-800 rounded-md transition-colors"><Copy size={14}/></button>
                                            <button onClick={()=>setScheduleModal({open:true, mode:'edit', data:item, day:item.day})} className="p-1.5 text-slate-500 hover:text-blue-400"><Edit2 size={14}/></button>
                                            <button onClick={()=>deleteDoc(doc(db,'artifacts',appId,'public','data','schedule',item.id))} className="p-1.5 text-slate-500 hover:text-red-500"><Trash2 size={14}/></button>
                                        </div>
                                    </div>
                                ))}
                             </div>
                        </div>
                    ))}
                </div>
            </div>
        )}

        {activeTab === 'sounds' && (
             <div className="space-y-6 animate-in fade-in">
                 <div className="bg-slate-900 p-8 rounded-3xl border border-slate-800 border-dashed text-center hover:border-blue-500/50 transition-colors">
                    <input type="file" id="sound-upload" accept="audio/*" onChange={handleFileUpload} className="hidden" />
                    <label htmlFor="sound-upload" className="cursor-pointer flex flex-col items-center">
                        <div className="bg-blue-600 p-4 rounded-2xl mb-4 text-white shadow-xl shadow-blue-900/20 hover:scale-110 transition-transform"><Plus size={32} /></div>
                        <h3 className="font-bold text-lg text-white">Yeni Zil Sesi Yükle</h3>
                        <p className="text-slate-500 text-sm mt-1">MP3 veya WAV dosyası seçin (Max 800KB)</p>
                    </label>
                 </div>
                 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                     {[...DEFAULT_SOUNDS, ...customSounds].map(s => (
                         <div key={s.id} className={`bg-slate-900 p-4 rounded-2xl border flex justify-between items-center ${playingSoundId === s.id ? 'border-blue-500 bg-blue-900/10' : 'border-slate-800'}`}>
                             <div className="flex items-center gap-3"><div className={`p-3 rounded-xl ${playingSoundId === s.id ? 'bg-blue-600 text-white' : 'bg-slate-800 text-blue-400'}`}><Music size={20}/></div><span className="font-bold text-sm truncate w-24 text-white">{s.name}</span></div>
                             <div className="flex gap-1">
                                <button onClick={()=>handleSoundPreview(s.id, s.url)} className={`p-2 rounded-lg ${playingSoundId === s.id ? 'bg-white text-blue-600' : 'hover:bg-slate-800 text-blue-400'}`}>{playingSoundId === s.id ? <Pause size={18}/> : <Play size={18}/>}</button>
                                {s.id && !s.id.startsWith('classic') && !s.id.startsWith('school') && <button onClick={()=>deleteDoc(doc(db,'artifacts',appId,'public','data','sounds',s.id))} className="p-2 hover:bg-slate-800 rounded-lg text-red-500"><Trash2 size={18}/></button>}
                             </div>
                         </div>
                     ))}
                 </div>
             </div>
        )}

        {activeTab === 'users' && isStation && <UsersView />}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-slate-900/90 backdrop-blur-xl border-t border-slate-800 px-6 py-4 flex justify-around md:hidden z-50">
          <button onClick={() => setActiveTab('control')} className={`flex flex-col items-center gap-1 ${activeTab === 'control' ? 'text-blue-500' : 'text-slate-500'}`}><Volume2 size={24} /><span className="text-[9px] font-black uppercase">KONTROL</span></button>
          <button onClick={() => setActiveTab('planner')} className={`flex flex-col items-center gap-1 ${activeTab === 'planner' ? 'text-blue-500' : 'text-slate-500'}`}><Calendar size={24} /><span className="text-[9px] font-black uppercase">PROGRAM</span></button>
          <button onClick={() => setActiveTab('sounds')} className={`flex flex-col items-center gap-1 ${activeTab === 'sounds' ? 'text-blue-500' : 'text-slate-500'}`}><Music size={24} /><span className="text-[9px] font-black uppercase">ZİLLER</span></button>
          {isStation && <button onClick={() => setActiveTab('users')} className={`flex flex-col items-center gap-1 ${activeTab === 'users' ? 'text-emerald-500' : 'text-slate-500'}`}><Users size={24} /><span className="text-[9px] font-black uppercase">ÜYELER</span></button>}
      </nav>
      {isStation && <div className="fixed bottom-24 right-6 bg-emerald-600 text-white p-4 rounded-3xl shadow-2xl flex items-center gap-4 z-50 animate-bounce"><Monitor size={24} /><div className="pr-4"><div className="font-black text-sm uppercase leading-none">İSTASYON MODU</div><div className="text-[10px] opacity-80 font-bold">Ses çıkışı aktif</div></div></div>}
      
      {/* Versiyon Göstergesi */}
      <div className="fixed bottom-2 left-2 text-[9px] text-slate-700 font-mono">v{VERSION}</div>
    </div>
  );
}
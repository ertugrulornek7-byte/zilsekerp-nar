import React, { useState, useEffect, useRef, useCallback } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, doc, onSnapshot, updateDoc, 
  collection, addDoc, deleteDoc, arrayUnion, arrayRemove, query, orderBy, getDocs, where
} from 'firebase/firestore';
import { 
  getAuth, signInAnonymously, signInWithCustomToken 
} from 'firebase/auth';
import { 
  Bell, Mic, Volume2, Users, Monitor,
  Plus, Edit2, X, Music, Calendar, StopCircle, UserPlus, Trash2, Copy, ArrowRight, LogOut, AlertTriangle, Loader2, Building2, Lock, Mail, User, Play, Pause, Settings
} from 'lucide-react';

// --- VERSİYON NUMARASI ---
const VERSION = "22.01.16.48"; // Ses Motoru Ayrıştırması & Mikrofon Fix

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

const appId = 'smart-bell-app-pro';

const DAYS = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar"];
const DEFAULT_SOUNDS = [
  { id: 'classic', name: 'Klasik Zil', url: 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3' },
  { id: 'school', name: 'Okul Zili', url: 'https://assets.mixkit.co/active_storage/sfx/950/950-preview.mp3' },
];

// --- GİRİŞ / KAYIT EKRANI ---
const AuthScreen = ({ onLogin }) => {
    const [isRegister, setIsRegister] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        const fd = new FormData(e.target);
        const email = fd.get('email').trim().toLowerCase();
        const password = fd.get('password');

        try {
            const instRef = collection(db, 'artifacts', appId, 'public', 'data', 'institutions');
            
            if (isRegister) {
                const terminalPass = fd.get('terminalPass');
                const instName = fd.get('instName');

                const q = query(instRef, where("email", "==", email));
                const snap = await getDocs(q);
                if (!snap.empty) throw new Error("Bu e-posta adresi zaten kayıtlı.");

                const newInstRef = await addDoc(instRef, {
                    email,
                    password, 
                    institutionName: instName,
                    terminalPassword: terminalPass,
                    createdAt: Date.now(),
                    users: ['Müdür', 'Müdür Yardımcısı'],
                    volume: 50,
                    stopSignal: 0
                });

                onLogin({ uid: newInstRef.id, name: instName });

            } else {
                const q = query(instRef, where("email", "==", email), where("password", "==", password));
                const snap = await getDocs(q);
                
                if (snap.empty) throw new Error("Hatalı e-posta veya şifre.");

                const userData = snap.docs[0].data();
                onLogin({ uid: snap.docs[0].id, name: userData.institutionName });
            }
        } catch (err) {
            console.error("Auth Error:", err);
            setError(err.message || "İşlem başarısız.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 relative">
            <div className="w-full max-w-md bg-slate-900 border border-slate-800 p-8 rounded-[2.5rem] shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-blue-600 to-purple-600"></div>
                <div className="flex flex-col items-center mb-8">
                    <div className="w-20 h-20 bg-blue-600 rounded-3xl flex items-center justify-center shadow-lg shadow-blue-900/50 mb-4">
                        <Bell size={40} className="text-white"/>
                    </div>
                    <h1 className="text-2xl font-black text-white tracking-tight">AKILLI ZİL SİSTEMİ</h1>
                    <p className="text-slate-400 text-sm">Kurumsal Giriş</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {isRegister && (
                        <div className="relative">
                            <Building2 className="absolute left-4 top-3.5 text-slate-500" size={20}/>
                            <input name="instName" placeholder="Kurum Adı" required className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 pl-12 pr-4 text-white outline-none focus:border-blue-500" />
                        </div>
                    )}
                    <div className="relative">
                        <Mail className="absolute left-4 top-3.5 text-slate-500" size={20}/>
                        <input name="email" type="email" placeholder="E-Posta Adresi" required className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 pl-12 pr-4 text-white outline-none focus:border-blue-500" />
                    </div>
                    <div className="relative">
                        <Lock className="absolute left-4 top-3.5 text-slate-500" size={20}/>
                        <input name="password" type="password" placeholder="Giriş Şifresi" required className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 pl-12 pr-4 text-white outline-none focus:border-blue-500" />
                    </div>
                    
                    {isRegister && (
                        <div className="relative animate-in fade-in">
                             <Monitor className="absolute left-4 top-3.5 text-emerald-500" size={20}/>
                             <input name="terminalPass" type="text" placeholder="Terminal Şifresi Belirle" required className="w-full bg-slate-950 border border-emerald-900/50 rounded-xl py-3 pl-12 pr-4 text-white outline-none focus:border-emerald-500 placeholder:text-emerald-700" />
                             <p className="text-[10px] text-emerald-600 mt-1 ml-1">* Terminale giriş için kullanılacaktır.</p>
                        </div>
                    )}

                    {error && <div className="text-red-500 text-xs font-bold text-center bg-red-900/20 p-2 rounded-lg">{error}</div>}

                    <button disabled={loading} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-xl shadow-lg shadow-blue-900/20 transition-all active:scale-95 disabled:opacity-50 flex justify-center">
                        {loading ? <Loader2 className="animate-spin"/> : (isRegister ? 'KAYIT OL' : 'GİRİŞ YAP')}
                    </button>
                </form>

                <div className="mt-6 text-center">
                    <button onClick={() => setIsRegister(!isRegister)} className="text-slate-500 hover:text-white text-sm font-medium transition-colors">
                        {isRegister ? 'Zaten hesabınız var mı? Giriş Yapın' : 'Yeni Kurum Kaydı Oluştur'}
                    </button>
                </div>
            </div>
            <div className="absolute bottom-4 text-[9px] text-slate-600 font-mono opacity-50">v{VERSION}</div>
        </div>
    );
};

export default function App() {
  const [institution, setInstitution] = useState(() => {
      const savedId = localStorage.getItem('bell_inst_id');
      const savedName = localStorage.getItem('bell_inst_name');
      return (savedId && savedName) ? { uid: savedId, name: savedName } : null;
  });
  const [isFirebaseReady, setIsFirebaseReady] = useState(false);
  
  const [profileName, setProfileName] = useState(() => localStorage.getItem('bell_profile_name') || '');
  const [isStation, setIsStation] = useState(() => localStorage.getItem('bell_is_station') === 'true');

  const [activeTab, setActiveTab] = useState('control'); 
  const [systemState, setSystemState] = useState({
    volume: 50,
    stopSignal: 0,
    institutionName: '',
    terminalPassword: '',
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
  const [passwordModal, setPasswordModal] = useState(false);
  const [playingSoundId, setPlayingSoundId] = useState(null);
  
  // Modals
  const [scheduleModal, setScheduleModal] = useState({ open: false, mode: 'add', data: null, day: null });
  const [copyModal, setCopyModal] = useState({ open: false, type: 'day', sourceData: null });

  // Refs
  // YENİ: Ses oynatıcılarını ayırdık. Ziller bellAudio, anonslar stationAudio'da.
  const stationAudioRef = useRef(typeof window !== 'undefined' ? new Audio() : null); 
  const bellAudioRef = useRef(typeof window !== 'undefined' ? new Audio() : null); 
  const previewAudioRef = useRef(typeof window !== 'undefined' ? new Audio() : null);
  
  const mediaRecorderRef = useRef(null);
  const audioQueueRef = useRef([]); 
  const isPlayingQueueRef = useRef(false);
  const audioChunksRef = useRef([]);
  
  const lastStopSignalRef = useRef(0);

  // --- 1. FIREBASE BAŞLATMA ---
  useEffect(() => {
     if (!document.getElementById('tailwind-script')) {
        const script = document.createElement('script');
        script.id = 'tailwind-script';
        script.src = "https://cdn.tailwindcss.com";
        script.async = true;
        document.head.appendChild(script);
     }

     const stationAudio = stationAudioRef.current;
     const bellAudio = bellAudioRef.current;
     const previewAudio = previewAudioRef.current;

     if(stationAudio) stationAudio.onerror = (e) => console.warn("Anons Audio Error:", e);
     if(bellAudio) bellAudio.onerror = (e) => console.warn("Zil Audio Error:", e);
     if(previewAudio) previewAudio.onerror = (e) => console.warn("Preview Error:", e);

     const initAuth = async () => {
        try {
            if (window['__initial_auth_token']) {
                await signInWithCustomToken(auth, window['__initial_auth_token']);
            } else {
                await signInAnonymously(auth);
            }
            setIsFirebaseReady(true);
        } catch (error) {
            console.error("Firebase Init Error:", error);
            setStatusMsg("Bağlantı hatası!");
        }
     };
     initAuth();

     return () => {
         if(stationAudio) stationAudio.pause();
         if(bellAudio) bellAudio.pause();
         if(previewAudio) previewAudio.pause();
     };
  }, []);

  // --- SES İŞLEME MANTIĞI (ANONSLAR İÇİN) ---
  const processAudioQueue = useCallback(() => {
      const audioEl = stationAudioRef.current; // Sadece Anonsları çalar
      if (!audioEl || isPlayingQueueRef.current || audioQueueRef.current.length === 0) return;
      
      isPlayingQueueRef.current = true;
      const nextChunk = audioQueueRef.current.shift();
      
      console.log("Ses oynatılmaya çalışılıyor...", nextChunk ? "Veri Var" : "Veri Yok");

      audioEl.src = nextChunk;
      audioEl.onended = () => { 
          console.log("Ses bitti.");
          isPlayingQueueRef.current = false; 
          processAudioQueue(); 
      };
      
      audioEl.play().then(() => {
          console.log("Ses başarıyla çalıyor.");
          setStatusMsg("🔊 Anons Çalınıyor...");
          setTimeout(() => setStatusMsg(''), 3000);
      }).catch(e => { 
          console.warn("Oynatma Hatası (Autoplay Policy?):", e); 
          isPlayingQueueRef.current = false; 
          setStatusMsg("Ses Çalma Hatası: Ekrana tıklayın!");
          processAudioQueue(); 
      });
  }, []);
  
  const playAudioChunk = useCallback((base64Url) => { 
      audioQueueRef.current.push(base64Url); 
      processAudioQueue(); 
  }, [processAudioQueue]);

  // --- VERİ SENKRONİZASYONU ---
  useEffect(() => {
    if (!institution || !isFirebaseReady) return;
    const instId = institution.uid;

    const unsubInst = onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'institutions', instId), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        
        if (isStation) {
            // Ses seviyesini her iki oynatıcıya da uygula
            const vol = Math.max(0, Math.min(1, (data.volume || 50) / 100));
            if (stationAudioRef.current) stationAudioRef.current.volume = vol;
            if (bellAudioRef.current) bellAudioRef.current.volume = vol;
            
            // Sesi Kes sinyali
            if (data.stopSignal && data.stopSignal !== lastStopSignalRef.current) {
                if (lastStopSignalRef.current !== 0) {
                    // Her iki oynatıcıyı da durdur
                    if(stationAudioRef.current) {
                        stationAudioRef.current.pause(); 
                        stationAudioRef.current.currentTime = 0;
                    }
                    if(bellAudioRef.current) {
                        bellAudioRef.current.pause();
                        bellAudioRef.current.currentTime = 0;
                    }

                    audioQueueRef.current = []; 
                    isPlayingQueueRef.current = false;
                    setStatusMsg("Tüm Sesler Kesildi.");
                    setTimeout(() => setStatusMsg(''), 1500);
                }
                lastStopSignalRef.current = data.stopSignal;
            }
        }
        setSystemState(prev => ({ ...prev, ...data }));
        setAllowedUsers(data.users || []);
      }
    });

    const unsubSchedule = onSnapshot(query(collection(db, 'artifacts', appId, 'public', 'data', 'schedule'), where("institutionId", "==", instId)), (s) => {
        const items = []; s.forEach(d => items.push({ id: d.id, ...d.data() })); setSchedule(items);
    });

    const unsubSounds = onSnapshot(query(collection(db, 'artifacts', appId, 'public', 'data', 'sounds'), where("institutionId", "==", instId)), (s) => {
        const items = []; s.forEach(d => items.push({ id: d.id, ...d.data() })); setCustomSounds(items);
    });

    // CANLI YAYIN DİNLEYİCİSİ
    let unsubLive = () => {};
    if (isStation) {
        unsubLive = onSnapshot(query(collection(db, 'artifacts', appId, 'public', 'data', 'live_stream'), where("institutionId", "==", instId), orderBy('createdAt', 'asc')), (snapshot) => {
            snapshot.docChanges().forEach((change) => {
                if (change.type === "added") {
                    const audioData = change.doc.data();
                    
                    setStatusMsg("📡 ANONS VERİSİ GELDİ! İŞLENİYOR...");
                    
                    if (Date.now() - audioData.createdAt < 60000) { 
                        playAudioChunk(audioData.url);
                    } else {
                        console.log("Eski anons, atlanıyor.");
                    }
                    deleteDoc(change.doc.ref).catch(() => {});
                }
            });
        });
    }

    return () => { unsubInst(); unsubSchedule(); unsubSounds(); unsubLive(); };
  }, [institution, isFirebaseReady, isStation, playAudioChunk]);

  // --- ZAMANLAYICI (ZİL SESLERİ İÇİN) ---
  useEffect(() => {
    if (!isStation || !institution) return;
    const interval = setInterval(() => {
      const now = new Date();
      const dayIndex = now.getDay() === 0 ? 6 : now.getDay() - 1;
      const currentDay = DAYS[dayIndex];
      const currentTime = now.toTimeString().slice(0, 5);
      
      schedule.forEach(item => {
        if (item.day === currentDay && item.time === currentTime) {
          const triggerKey = `${item.id}-${currentTime}-${now.getDate()}`;
          if (systemState.lastTriggeredBell !== triggerKey) {
            
            // YENİ: Ziller için bellAudioRef kullanıyoruz.
            const bellAudio = bellAudioRef.current;
            if (bellAudio) {
                // Eğer zaten bir anons çalıyorsa, zili çalma veya bekle (şu an zili direkt çalıyoruz, karışabilir ama en azından teknik olarak bozulmaz)
                bellAudio.src = item.soundUrl;
                bellAudio.volume = (systemState.volume || 50) / 100;
                bellAudio.play().catch(e => console.error("Zil çalma hatası:", e));
            }
            updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'institutions', institution.uid), { lastTriggeredBell: triggerKey }).catch(()=>{});
          }
        }
      });
    }, 4000); 
    return () => clearInterval(interval);
  }, [isStation, schedule, systemState.lastTriggeredBell, systemState.volume, institution]);

  // --- TELSİZ MODU (MİKROFON & FORMAT FIX) ---
  const toggleBroadcast = () => isBroadcasting ? stopBroadcast() : startBroadcast();
  
  const startBroadcast = async () => {
      try {
          // YENİ: Gürültü ve yankı engelleme eklendi
          const stream = await navigator.mediaDevices.getUserMedia({ 
              audio: {
                  echoCancellation: true,
                  noiseSuppression: true,
                  autoGainControl: true
              } 
          });
          
          // YENİ: MimeType zorlamasını kaldırdık, önce destekleneni bulmaya çalış
          let options = undefined;
          if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
              options = { mimeType: 'audio/webm;codecs=opus' };
          } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
              options = { mimeType: 'audio/mp4' };
          }
          // Hiçbiri yoksa undefined gider, tarayıcı varsayılanı seçer.

          try {
            mediaRecorderRef.current = new MediaRecorder(stream, options);
          } catch (e) {
             console.warn("MediaRecorder options ile başlatılamadı, varsayılan deneniyor.", e);
             mediaRecorderRef.current = new MediaRecorder(stream); // Fallback
          }
          
          audioChunksRef.current = [];
          
          mediaRecorderRef.current.ondataavailable = (e) => { 
              if (e.data.size > 0) audioChunksRef.current.push(e.data); 
          };
          
          mediaRecorderRef.current.onstop = async () => {
             if (audioChunksRef.current.length > 0) {
                 setIsUploadingChunk(true); setStatusMsg("Ses gönderiliyor...");
                 
                 // Blob oluştururken kaydedicinin kendi mimeType'ını kullan
                 const recordedMimeType = mediaRecorderRef.current.mimeType || 'audio/webm';
                 const audioBlob = new Blob(audioChunksRef.current, { type: recordedMimeType }); 
                 
                 if (audioBlob.size > 5 * 1024 * 1024) { 
                     setIsUploadingChunk(false);
                     setStatusMsg("HATA: Kayıt çok büyük!");
                     return;
                 }

                 const reader = new FileReader();
                 reader.onloadend = async () => {
                     try {
                         await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'live_stream'), {
                             institutionId: institution.uid, url: reader.result, createdAt: Date.now(), user: profileName
                         });
                         setStatusMsg("Anons İletildi!");
                     } catch (err) { console.error(err); setStatusMsg("Gönderim Hatası!"); } 
                     finally { setIsUploadingChunk(false); setTimeout(() => setStatusMsg(''), 2000); }
                 };
                 reader.readAsDataURL(audioBlob);
             }
          };
          
          mediaRecorderRef.current.start(); 
          setIsBroadcasting(true); 
          setStatusMsg("KAYITTA - Konuşun");
          
          setTimeout(() => { 
              if (mediaRecorderRef.current?.state === 'recording') stopBroadcast(); 
          }, 60000); 
          
      } catch (err) { 
          console.error("Mikrofon Hatası Detayı:", err);
          setStatusMsg("Mikrofon hatası! İzinleri kontrol edin."); 
      }
  };
  
  const stopBroadcast = () => {
      if (mediaRecorderRef.current?.state === 'recording') { 
          mediaRecorderRef.current.stop(); 
          mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop()); 
      }
      setIsBroadcasting(false);
  };

  // --- HANDLERS ---
  const handleInstitutionLogin = (instData) => {
      setInstitution(instData);
      localStorage.setItem('bell_inst_id', instData.uid);
      localStorage.setItem('bell_inst_name', instData.name);
  };

  const handleStationLogin = (e) => {
      e.preventDefault();
      const enteredPass = e.target.password.value;
      if (enteredPass === systemState.terminalPassword) {
          setIsStation(true); 
          setProfileName('Terminal'); 
          localStorage.setItem('bell_is_station', 'true'); 
          setPasswordModal(false);
      } else { alert("Hatalı Terminal Şifresi!"); }
  };

  const handleProfileLogin = (e) => {
      e.preventDefault();
      const name = e.target.username.value.trim();
      if(allowedUsers.includes(name)) {
          setProfileName(name); localStorage.setItem('bell_profile_name', name);
      } else setLoginError('Kullanıcı listede yok.');
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file || file.size > 800 * 1024) { setStatusMsg("Dosya > 800KB olmalı!"); return; }
    const reader = new FileReader();
    reader.onload = async (ev) => {
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'sounds'), { institutionId: institution.uid, name: file.name, url: ev.target.result, createdAt: Date.now() });
    };
    reader.readAsDataURL(file);
  };

  const handleAddSchedule = async (e) => {
      e.preventDefault();
      if (isSavingSchedule) return;
      
      const fd = new FormData(e.target);
      const time = fd.get('time');
      const day = scheduleModal.day;
      
      const isDuplicate = schedule.some(s => 
          s.day === day && 
          s.time === time && 
          (scheduleModal.mode === 'add' || (scheduleModal.mode === 'edit' && s.id !== scheduleModal.data.id))
      );

      if (isDuplicate) {
          setStatusMsg("HATA: Bu gün ve saatte zaten bir zil var!");
          setTimeout(() => setStatusMsg(''), 3000);
          return;
      }

      setIsSavingSchedule(true);
      const newItem = { institutionId: institution.uid, time, label: fd.get('label'), soundUrl: (DEFAULT_SOUNDS.find(s=>s.id===fd.get('soundId')) || customSounds.find(s=>s.id===fd.get('soundId')) || DEFAULT_SOUNDS[0]).url };
      
      try {
          if(scheduleModal.mode === 'edit') await updateDoc(doc(db,'artifacts',appId,'public', 'data', 'schedule', scheduleModal.data.id), newItem);
          else await addDoc(collection(db,'artifacts',appId,'public', 'data', 'schedule'), {...newItem, day});
          setScheduleModal({open:false, mode:'add', data:null, day:null});
      } finally { setIsSavingSchedule(false); }
  };

  const performCopy = async (targetDay) => {
      if (!copyModal.sourceData) return;
      const items = copyModal.type === 'day' ? schedule.filter(s => s.day === copyModal.sourceData) : [copyModal.sourceData];
      const existingTimes = schedule.filter(s => s.day === targetDay).map(s => s.time);
      for (const i of items) {
          if (!existingTimes.includes(i.time)) {
              await addDoc(collection(db,'artifacts',appId,'public', 'data', 'schedule'), { institutionId: institution.uid, day: targetDay, time:i.time, label:i.label, soundUrl:i.soundUrl });
          }
      }
      setCopyModal({ open: false, type: 'day', sourceData: null });
      setStatusMsg("Kopyalama tamamlandı.");
      setTimeout(() => setStatusMsg(''), 3000);
  };

  const handleSoundPreview = (id, url) => {
      const audio = previewAudioRef.current;
      if (!audio) return;

      if (playingSoundId === id) {
          audio.pause();
          audio.currentTime = 0;
          setPlayingSoundId(null);
      } else {
          audio.src = url;
          audio.volume = 1.0;
          audio.play().catch(e => console.warn("Preview Play Err:", e));
          setPlayingSoundId(id);
          audio.onended = () => setPlayingSoundId(null);
      }
  };

  // --- RENDER ---
  if (!isFirebaseReady) return <div className="min-h-screen bg-slate-950 flex items-center justify-center"><Loader2 className="text-blue-600 animate-spin" size={40}/></div>;
  if (!institution) return <AuthScreen onLogin={handleInstitutionLogin} />;

  // Mod Seçim Ekranı
  if (!profileName && !isStation) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6 relative">
        {passwordModal && (
            <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
                <form onSubmit={handleStationLogin} className="bg-slate-900 p-8 rounded-3xl w-full max-w-sm text-center border border-slate-700 relative">
                    <button onClick={()=>setPasswordModal(false)} type="button" className="absolute top-4 right-4 text-slate-500"><X size={20}/></button>
                    <div className="w-16 h-16 bg-emerald-600/20 rounded-2xl flex items-center justify-center mx-auto mb-4 text-emerald-500"><Monitor size={32}/></div>
                    <h3 className="text-xl font-bold mb-2">Terminal Girişi</h3>
                    <input type="password" name="password" placeholder="Terminal Şifresi" className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 mb-4 text-center text-white outline-none focus:border-emerald-500" autoFocus />
                    <button className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 rounded-xl font-bold transition-colors">Aktifleştir</button>
                </form>
            </div>
        )}
        <div className="max-w-md w-full bg-slate-900 rounded-[2.5rem] p-10 shadow-2xl border border-slate-800 text-center relative overflow-hidden">
          <div className="bg-blue-600 w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-blue-900/50"><Building2 size={40} /></div>
          <h1 className="text-xl font-bold mb-1 text-slate-200">{systemState.institutionName || 'Kurum Paneli'}</h1>
          <p className="text-slate-500 mb-8 text-xs uppercase tracking-widest font-bold">Giriş Modu Seçin</p>
          
          <form onSubmit={handleProfileLogin} className="space-y-4 mb-8">
             <div className="text-left">
                 <label className="text-xs font-bold text-slate-400 ml-2 mb-1 block">Yönetici / Kullanıcı Girişi</label>
                 <div className="flex gap-2">
                     <select name="username" className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white outline-none appearance-none">
                        <option value="">İsim Seçiniz...</option>
                        {allowedUsers.map(u=><option key={u} value={u}>{u}</option>)}
                     </select>
                     <button className="bg-blue-600 px-6 rounded-xl font-bold hover:bg-blue-500"><ArrowRight/></button>
                 </div>
                 {loginError && <div className="text-red-500 text-xs font-bold mt-2 ml-2">{loginError}</div>}
             </div>
          </form>

          <div className="relative py-4">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-800"></div></div>
              <div className="relative flex justify-center"><span className="bg-slate-900 px-4 text-xs text-slate-600 font-bold uppercase">veya</span></div>
          </div>

          <button onClick={()=>setPasswordModal(true)} className="w-full py-4 border border-slate-800 hover:border-emerald-500/50 hover:bg-emerald-900/10 rounded-xl flex items-center justify-center gap-3 text-emerald-500 font-bold transition-all group">
              <Monitor size={20} className="group-hover:scale-110 transition-transform"/>
              TERMİNAL MODUNA GEÇ
          </button>

          <button onClick={()=>{ setInstitution(null); localStorage.removeItem('bell_inst_id'); localStorage.removeItem('bell_inst_name'); }} className="mt-8 text-xs font-bold text-red-500 hover:text-red-400 flex items-center justify-center gap-2 w-full"><LogOut size={12}/> KURUM ÇIKIŞI</button>
        </div>
      </div>
    );
  }

  // --- ANA EKRAN ---
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans pb-24 relative">
      <audio ref={stationAudioRef} className="hidden" crossOrigin="anonymous" />
      <audio ref={bellAudioRef} className="hidden" crossOrigin="anonymous" />
      <audio ref={previewAudioRef} className="hidden" crossOrigin="anonymous" />

      <header className="bg-slate-900/50 backdrop-blur-xl border-b border-slate-800 p-4 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="bg-blue-600 p-2 rounded-xl shadow-lg"><Bell size={20} /></div>
            <div>
              <h1 className="font-black text-lg tracking-tight truncate max-w-[150px] md:max-w-none">{systemState.institutionName}</h1>
              <span className="text-[10px] text-slate-400 font-black uppercase block flex items-center gap-1">
                  {isStation ? <Monitor size={10} className="text-emerald-500"/> : <User size={10} className="text-blue-500"/>}
                  {isStation ? 'TERMİNAL' : profileName}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
              <div className="hidden md:flex bg-slate-950 rounded-2xl p-1 border border-slate-800">
                {['control', 'planner', 'sounds', 'users'].map(t => (
                    (!isStation && t === 'users') ? null : 
                    <button key={t} onClick={() => setActiveTab(t)} className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${activeTab === t ? 'bg-blue-600 text-white' : 'text-slate-500 hover:text-white'}`}>{t.toUpperCase()}</button>
                ))}
              </div>
              <button onClick={()=>{ if(window.confirm('Profilden çıkılsın mı?')) { setProfileName(''); setIsStation(false); localStorage.removeItem('bell_profile_name'); localStorage.removeItem('bell_is_station'); }}} className="p-2 bg-slate-800 rounded-full hover:bg-red-900/50 text-slate-400 hover:text-red-400"><LogOut size={16} /></button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-4 md:p-8">
        {statusMsg && <div className="fixed top-20 left-1/2 -translate-x-1/2 bg-blue-600/90 backdrop-blur text-white px-6 py-3 rounded-2xl shadow-2xl font-bold text-xs animate-bounce z-[100] border border-blue-400/50 flex items-center gap-2"><AlertTriangle size={16} /> {statusMsg}</div>}

        {activeTab === 'control' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in">
                <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800 shadow-xl flex flex-col justify-between">
                    <div>
                        <div className="flex justify-between mb-8"><h2 className="text-xs font-black uppercase text-slate-500 flex gap-2"><Volume2 size={16}/> Ses</h2><span className="text-3xl font-mono font-bold text-blue-500">{systemState.volume}%</span></div>
                        <input type="range" min="0" max="100" value={systemState.volume} onChange={(e)=>{const v=parseInt(e.target.value); setSystemState(p=>({...p, volume:v}));}} onMouseUp={()=>updateDoc(doc(db,'artifacts',appId,'public','data','institutions',institution.uid),{volume:systemState.volume})} onTouchEnd={()=>updateDoc(doc(db,'artifacts',appId,'public','data','institutions',institution.uid),{volume:systemState.volume})} className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500 mb-6"/>
                    </div>
                    
                    {isStation && (
                        <div className="mb-4 p-4 bg-slate-950 rounded-xl border border-emerald-900/30">
                             <div className="flex justify-between items-center"><span className="text-xs font-bold text-emerald-500 flex items-center gap-2"><Settings size={14}/> Terminal Şifresi</span><button className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold" onClick={async()=>{ const newPass = prompt("Yeni Terminal Şifresi Girin:", systemState.terminalPassword); if(newPass) await updateDoc(doc(db,'artifacts',appId,'public','data','institutions',institution.uid),{terminalPassword: newPass}); }}>Değiştir</button></div>
                        </div>
                    )}
                    
                    <button onClick={()=>{
                        updateDoc(doc(db,'artifacts',appId,'public','data','institutions',institution.uid),{stopSignal:Date.now()});
                    }} className="w-full bg-red-900/30 hover:bg-red-600 text-red-500 hover:text-white border border-red-900/50 p-4 rounded-xl flex items-center justify-center gap-3 active:scale-95 group"><StopCircle size={24}/><span className="font-bold">SESİ KES</span></button>
                </div>
                <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800 flex flex-col items-center justify-center relative min-h-[250px]">
                    <button onClick={toggleBroadcast} className={`w-32 h-32 rounded-full flex items-center justify-center transition-all ${isBroadcasting ? 'bg-red-600 animate-pulse shadow-2xl shadow-red-900/50 scale-110' : 'bg-slate-800 hover:bg-slate-700 shadow-xl'}`}>
                        {isBroadcasting ? <StopCircle size={48} className="text-white"/> : <Mic size={48} className="text-slate-400"/>}
                    </button>
                    <p className={`mt-6 text-xs font-black uppercase tracking-widest text-center ${isBroadcasting ? 'text-red-500 animate-pulse' : 'text-slate-500'}`}>
                        {isBroadcasting ? 'KAYITTA (BİTİRMEK İÇİN BAS)' : 'ANONS İÇİN DOKUN (BAS-KONUŞ)'}
                    </p>
                    {isUploadingChunk && <div className="absolute top-4 right-4 text-xs text-blue-500 flex gap-1 items-center"><Loader2 size={12} className="animate-spin"/> Gönderiliyor</div>}
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
                                            <button onClick={()=>deleteDoc(doc(db,'artifacts',appId,'public', 'data', 'schedule',item.id))} className="p-1.5 text-slate-500 hover:text-red-500"><Trash2 size={14}/></button>
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
                         <div key={s.id} className="bg-slate-900 p-4 rounded-2xl border border-slate-800 flex justify-between items-center">
                             <div className="flex items-center gap-3"><div className="p-3 rounded-xl bg-slate-800 text-blue-400"><Music size={20}/></div><span className="font-bold text-sm truncate w-24 text-white">{s.name}</span></div>
                             <div className="flex gap-1">
                                <button onClick={()=>handleSoundPreview(s.id, s.url)} className={`p-2 rounded-lg ${playingSoundId === s.id ? 'bg-white text-blue-600' : 'hover:bg-slate-800 text-blue-400'}`}>{playingSoundId === s.id ? <Pause size={18}/> : <Play size={18}/>}</button>
                                {s.id && !s.id.startsWith('classic') && !s.id.startsWith('school') && <button onClick={()=>deleteDoc(doc(db,'artifacts',appId,'public','data','sounds',s.id))} className="p-2 hover:bg-slate-800 rounded-lg text-red-500"><Trash2 size={18}/></button>}
                             </div>
                         </div>
                     ))}
                 </div>
             </div>
        )}

        {activeTab === 'users' && isStation && (
            <div className="space-y-4 animate-in fade-in">
                <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800">
                    <h2 className="text-lg font-bold mb-4 text-white flex gap-2"><UserPlus/> Kullanıcı Ekle</h2>
                    <form onSubmit={async(e)=>{e.preventDefault(); const n=e.target.u.value.trim(); if(n){await updateDoc(doc(db,'artifacts',appId,'public','data','institutions',institution.uid),{users:arrayUnion(n)}); e.target.reset();}}} className="flex gap-2">
                        <input name="u" placeholder="İsim" className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-white outline-none" required />
                        <button className="bg-blue-600 px-4 rounded-xl text-white font-bold">Ekle</button>
                    </form>
                </div>
                <div className="space-y-2">
                    {allowedUsers.map(u=>(<div key={u} className="bg-slate-900 p-3 rounded-xl border border-slate-800 flex justify-between text-white"><span className="font-bold">{u}</span><button onClick={()=>updateDoc(doc(db,'artifacts',appId,'public','data','institutions',institution.uid),{users:arrayRemove(u)})} className="text-red-500"><Trash2 size={16}/></button></div>))}
                </div>
            </div>
        )}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-slate-900/90 backdrop-blur-xl border-t border-slate-800 px-6 py-4 flex justify-around md:hidden z-50">
          <button onClick={() => setActiveTab('control')} className={`flex flex-col items-center gap-1 ${activeTab === 'control' ? 'text-blue-500' : 'text-slate-500'}`}><Volume2 size={24} /><span className="text-[9px] font-black uppercase">KONTROL</span></button>
          <button onClick={() => setActiveTab('planner')} className={`flex flex-col items-center gap-1 ${activeTab === 'planner' ? 'text-blue-500' : 'text-slate-500'}`}><Calendar size={24} /><span className="text-[9px] font-black uppercase">PROGRAM</span></button>
          <button onClick={() => setActiveTab('sounds')} className={`flex flex-col items-center gap-1 ${activeTab === 'sounds' ? 'text-blue-500' : 'text-slate-500'}`}><Music size={24} /><span className="text-[9px] font-black uppercase">ZİLLER</span></button>
          {isStation && <button onClick={() => setActiveTab('users')} className={`flex flex-col items-center gap-1 ${activeTab === 'users' ? 'text-emerald-500' : 'text-slate-500'}`}><Users size={24} /><span className="text-[9px] font-black uppercase">ÜYELER</span></button>}
      </nav>
      {isStation && <div className="fixed bottom-24 right-6 bg-emerald-600 text-white p-4 rounded-3xl shadow-2xl flex items-center gap-4 z-50 animate-bounce"><Monitor size={24} /><div className="pr-4"><div className="font-black text-sm uppercase leading-none">İSTASYON MODU</div><div className="text-[10px] opacity-80 font-bold">Ses çıkışı aktif</div></div></div>}
      
      <div className="fixed bottom-2 left-2 text-[9px] text-slate-700 font-mono">v{VERSION}</div>
    </div>
  );
}
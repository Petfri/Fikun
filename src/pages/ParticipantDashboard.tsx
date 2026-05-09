import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  MessageSquare, 
  Calendar, 
  ClipboardCheck, 
  LogOut, 
  User, 
  Settings, 
  ChevronRight, 
  ChevronLeft,
  ArrowRight,
  Check, 
  Clock, 
  MapPin,
  X
} from 'lucide-react';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  serverTimestamp, 
  doc, 
  getDoc,
  getDocs,
  setDoc,
  limit,
  orderBy
} from 'firebase/firestore';
import { auth, logout, db, handleFirestoreError, OperationType } from '../lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';

type TabType = 'chat' | 'booking' | 'paamelding';

export default function ParticipantDashboard() {
  const [activeTab, setActiveTab] = useState<TabType>('chat');
  const [lang, setLang] = useState<'no' | 'en'>('no');
  const [selectedClientDetail, setSelectedClientDetail] = useState<any | null>(null);
  const navigate = useNavigate();
  const [user, setUser] = useState(auth.currentUser);

  const [groupIds, setGroupIds] = useState<string[]>([]);
  const [profileUsername, setProfileUsername] = useState<string>('');
  const [availableClients, setAvailableClients] = useState<any[]>([]);
  const [dailyInteractions, setDailyInteractions] = useState({ date: '', count: 0 });

  useEffect(() => {
    return onAuthStateChanged(auth, async (u) => {
      if (!u) {
        navigate('/login');
      } else {
        setUser(u);
        const userRef = doc(db, 'users', u.uid);
        
        // Listen to user data for limits
        const unsub = onSnapshot(userRef, (snap) => {
          if (snap.exists()) {
            const userData = snap.data();
            if (userData.role === 'facilitator' || userData.role === 'admin') {
              navigate('/facilitator');
            }
            setGroupIds(userData.groupIds || []);
            setProfileUsername(userData.username || '');
            setDailyInteractions(userData.dailyInteractions || { date: '', count: 0 });
          }
        });
        return () => unsub();
      }
    });
  }, [navigate]);

  // Join a group if none (handled at login now, but keeping layout consistency)
  useEffect(() => {
    if (user && groupIds.length === 0) {
       // Logic moved to LoginPage
    }
  }, [user, groupIds]);

  // Fetch clients from groups
  useEffect(() => {
    if (groupIds.length === 0) return;
    
    // For simplicity, fetch from the first group for now
    const gId = groupIds[0];
    const q = query(collection(db, 'groups', gId, 'clients'), where('isVisible', '==', true));
    
    return onSnapshot(q, (snapshot) => {
      setAvailableClients(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });
  }, [groupIds]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const labels = {
    no: {
      chat: 'Kunde chat',
      booking: 'Booking',
      paamelding: 'Påmelding',
      logout: 'Logg ut',
      welcome: 'Velkommen,',
      selectClient: 'Velg en kunde å intervjue',
      startBtn: 'Start intervju med',
      upcomingBookings: 'Kommende bookinger',
      upcomingEvents: 'Kommende arrangementer',
      joinBtn: 'Meld deg på',
    },
    en: {
      chat: 'Client chat',
      booking: 'Booking',
      paamelding: 'Registration',
      logout: 'Log out',
      welcome: 'Welcome,',
      selectClient: 'Choose a client to interview',
      startBtn: 'Start interview with',
      upcomingBookings: 'Upcoming bookings',
      upcomingEvents: 'Upcoming events',
      joinBtn: 'Register',
    }
  };

  const l = labels[lang];

  const clients = [
    { id: '1', name: 'Lene Bakke', meta: 'Privatkunde · Skandinavisk minimalistisk', initials: 'LB' },
    { id: '2', name: 'Thomas Wold', meta: 'Privatkunde · Industrielt med organiske materialer', initials: 'TW' },
    { id: '3', name: 'Bjørn Eikeland AS', meta: 'Bedriftskunde · Kontorlandskap', initials: 'BE' },
  ];

  const bookings = [
    { date: '12', month: 'Mai', time: '09:00 — 09:30', veil: 'Anne Dahl', topic: 'Tilbakemelding på konseptskisse' }
  ];

  const events = [
    { id: '1', title: 'Workshop: Fargelære', meta: '12. mai 2025 · 10:00–14:00 · Rom B204', seats: '8 ledige', desc: 'En praktisk workshop om fargelære og fargeteori i interiørdesign.' }
  ];

  const [activeChat, setActiveChat] = useState<any | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [inputText, setInputText] = useState('');

   const startChat = () => {
    if (!selectedClientDetail) return;
    setActiveChat(selectedClientDetail);
    setSelectedClientDetail(null);
  };

  useEffect(() => {
    if (!activeChat || !groupIds[0]) return;
    
    // Interactions for this client by this participant
    const q = query(
      collection(db, 'groups', groupIds[0], 'clients', activeChat.id, 'interactions'),
      where('participantId', '==', user?.uid),
      orderBy('createdAt', 'asc')
    );
    
    return onSnapshot(q, (snapshot) => {
      setMessages(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'interactions');
    });
  }, [activeChat, groupIds, user]);

  const closeChat = () => {
    setActiveChat(null);
    setMessages([]);
  };

  const isSameDay = (d1: any, d2: any) => {
    if (!d1 || !d2) return false;
    const date1 = d1.toDate ? d1.toDate() : new Date(d1);
    const date2 = new Date();
    return date1.getDate() === date2.getDate() && 
           date1.getMonth() === date2.getMonth() && 
           date1.getFullYear() === date2.getFullYear();
  };

  const sendChat = async () => {
    if (!inputText.trim() || !activeChat || !user || !groupIds[0]) return;
    
    let currentCount = dailyInteractions.count;

    // Reset if it's a new day
    if (!isSameDay(dailyInteractions.date, new Date())) {
      currentCount = 0;
    }

    if (currentCount >= 5) {
      return; 
    }

    const text = inputText;
    setInputText('');
    
    try {
      // 1. Update counter
      await setDoc(doc(db, 'users', user.uid), {
        dailyInteractions: {
          date: serverTimestamp(),
          count: currentCount + 1
        }
      }, { merge: true });

      // 2. Add interaction
      await addDoc(collection(db, 'groups', groupIds[0], 'clients', activeChat.id, 'interactions'), {
        participantId: user.uid,
        participantName: user.displayName || username, // username from profile if display name empty
        question: text,
        status: 'pending',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'interactions');
    }
  };

  const username = profileUsername || user?.displayName || user?.email?.split('@')[0] || 'Deltaker';
  const remainingInteractions = 5 - (isSameDay(dailyInteractions.date, new Date()) ? dailyInteractions.count : 0);

  if (activeChat) {
    return (
      <div className="fixed inset-0 z-[100] flex flex-col bg-cream overflow-hidden">
        <nav className="flex items-center gap-3 px-6 py-4 bg-white border-b border-bark/10 shadow-sm">
          <button onClick={closeChat} className="p-2 -ml-2 text-mid hover:text-bark rounded-xl transition-colors">
            <ChevronLeft size={24} />
          </button>
          <div className="w-10 h-10 rounded-full bg-brand-light flex items-center justify-center font-bold text-brand">
            {(activeChat.name || 'AN').split(' ').map((w: any) => w[0]).join('').slice(0, 2).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-bold text-sm truncate">{activeChat.name}</div>
            <div className="flex items-center gap-1.5 text-[10px] text-ok font-medium animate-pulse">
               <span className="w-1.5 h-1.5 rounded-full bg-ok" />
               Tilgjengelig
            </div>
          </div>
        </nav>

        <div className="flex-1 overflow-y-auto px-6 py-8 flex flex-col gap-6 custom-scrollbar">
          {messages.length === 0 && (
            <div className="text-center py-12 italic text-sm text-mid">
              Ingen meldinger ennå. Still et spørsmål!
            </div>
          )}
          {messages.map((m, i) => (
            <div key={m.id || i} className="flex flex-col gap-6 w-full">
              {/* Question */}
              <motion.div 
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex gap-3 max-w-[85%] self-end flex-row-reverse"
              >
                <div className="p-2.5 rounded-2xl h-fit border shadow-sm bg-brand text-white border-white/10">
                  <User size={14} />
                </div>
                <div className="p-4 rounded-3xl text-sm leading-relaxed bg-brand text-white shadow-lg shadow-brand/20">
                  {m.question}
                </div>
              </motion.div>

              {/* Answer (if approved) */}
              {m.status === 'approved' && m.answer && (
                <motion.div 
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex gap-3 max-w-[85%] self-start"
                >
                  <div className="p-2.5 rounded-2xl h-fit border shadow-sm bg-white text-bark border-bark/10">
                    <MessageSquare size={14} className="text-brand" />
                  </div>
                  <div className="p-4 rounded-3xl text-sm leading-relaxed bg-white border border-bark/5 shadow-md shadow-bark/5">
                    {m.answer}
                  </div>
                </motion.div>
              )}

              {/* Pending state */}
              {m.status === 'pending' && (
                <div className="self-start ml-12 text-[10px] italic text-mid opacity-80 flex items-center gap-1.5">
                   <Clock size={10} /> Venter på godkjenning fra veileder...
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="p-6 bg-white border-t border-bark/10 shadow-2xl">
           <div className="max-w-2xl mx-auto flex flex-col gap-2">
              <div className="flex items-center justify-between px-2">
                 <div className="text-[10px] font-bold text-mid uppercase tracking-widest">
                    Forespørsler i dag
                 </div>
                 <div className={`text-[10px] font-bold px-2 py-0.5 rounded ${remainingInteractions === 0 ? 'bg-hi-light text-hi' : 'bg-brand-light text-brand'}`}>
                    {remainingInteractions} av 5 igjen
                 </div>
              </div>
              <div className="flex items-end gap-3 p-1.5 bg-cream border border-bark/10 rounded-2xl focus-within:ring-2 ring-brand/20 transition-all">
                <textarea 
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), sendChat())}
                  placeholder={remainingInteractions > 0 ? "Still et spørsmål til kunden..." : "Grense nådd for i dag"}
                  disabled={remainingInteractions <= 0}
                  rows={1}
                  className="flex-1 bg-transparent p-3 text-sm outline-none resize-none max-h-32 disabled:opacity-50"
                />
                <button 
                  onClick={sendChat}
                  disabled={!inputText.trim() || remainingInteractions <= 0}
                  className="p-3 bg-brand text-white rounded-xl hover:opacity-90 active:scale-95 transition-all shadow-lg shadow-brand/20 disabled:opacity-30 disabled:shadow-none"
                >
                  <ArrowRight size={18} />
                </button>
              </div>
           </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-cream text-bark">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 flex items-center justify-between px-6 py-3 bg-white border-b border-bark/10 shadow-sm">
        <Link to="/" className="text-xl serif">
          Fi<em className="italic text-brand">kun</em>
        </Link>
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-2 text-sm text-mid pr-4 border-r border-bark/10">
            {l.welcome} <strong className="text-bark font-medium">{username}</strong>
          </div>
          <button 
            onClick={handleLogout}
            className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-mid hover:text-bark transition-colors"
          >
             {l.logout}
          </button>
          <div className="w-8 h-8 rounded-full bg-brand-light flex items-center justify-center text-[10px] font-bold text-brand ring-2 ring-brand/10 cursor-pointer overflow-hidden">
            {user?.photoURL ? (
              <img src={user.photoURL} alt="profile" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
            ) : (
              (user?.displayName || 'AN').split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase()
            )}
          </div>
        </div>
      </nav>

      {/* Product Switcher Bar */}
      <div className="flex items-center gap-2 px-6 py-3 bg-white/50 border-b border-bark/5 overflow-x-auto scrollbar-hide">
        <button 
          onClick={() => setActiveTab('chat')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs transition-all whitespace-nowrap ${activeTab === 'chat' ? 'bg-brand-light text-brand font-bold ring-1 ring-brand/20' : 'text-mid hover:text-bark'}`}
        >
          <div className={`w-1.5 h-1.5 rounded-full ${activeTab === 'chat' ? 'bg-brand' : 'bg-mid/30'}`} />
          {l.chat}
        </button>
        <button 
          onClick={() => setActiveTab('booking')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs transition-all whitespace-nowrap ${activeTab === 'booking' ? 'bg-brand-light text-brand font-bold ring-1 ring-brand/20' : 'text-mid hover:text-bark'}`}
        >
          <div className={`w-1.5 h-1.5 rounded-full ${activeTab === 'booking' ? 'bg-brand' : 'bg-mid/30'}`} />
          {l.booking}
        </button>
        <button 
          onClick={() => setActiveTab('paamelding')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs transition-all whitespace-nowrap ${activeTab === 'paamelding' ? 'bg-brand-light text-brand font-bold ring-1 ring-brand/20' : 'text-mid hover:text-bark'}`}
        >
          <div className={`w-1.5 h-1.5 rounded-full ${activeTab === 'paamelding' ? 'bg-brand' : 'bg-mid/30'}`} />
          {l.paamelding}
        </button>
      </div>

      <main className="flex-1 max-w-3xl w-full mx-auto p-6 pb-24">
        <AnimatePresence mode="wait">
          {activeTab === 'chat' && (
            <motion.div key="chat" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <div className="text-[10px] uppercase font-bold tracking-widest text-mid mb-4 pb-2 border-b border-bark/5">{l.selectClient}</div>
              <div className="flex flex-col gap-2">
                {availableClients.length === 0 && (
                  <div className="p-8 text-center bg-white border border-bark/10 rounded-2xl italic text-xs text-mid">
                    Ingen tilgjengelige kunder i din gruppe.
                  </div>
                )}
                {availableClients.map(client => (
                  <button 
                    key={client.id}
                    onClick={() => setSelectedClientDetail(client)}
                    className="flex items-center gap-4 p-4 rounded-2xl border bg-white border-bark/10 hover:border-brand/40 shadow-sm shadow-bark/5 transition-all text-left group"
                  >
                    <div className="w-10 h-10 rounded-full bg-brand-light flex items-center justify-center text-xs font-bold text-brand transition-transform group-hover:scale-105">
                      {(client.name || 'AN').split(' ').map((w: any) => w[0]).join('').slice(0,2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-sm">{client.name}</div>
                      <div className="text-[11px] text-mid font-medium truncate">{client.meta}</div>
                    </div>
                    <ArrowRight size={16} className="text-mid opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all" />
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {activeTab === 'booking' && (
            <motion.div key="booking" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
               <div className="text-[10px] uppercase font-bold tracking-widest text-mid mb-4 pb-2 border-b border-bark/5">Book veiledning</div>
               {/* Form simplification from template */}
               <div className="bg-white border border-bark/10 rounded-2xl p-6 shadow-sm mb-6">
                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                   <div className="flex flex-col gap-1.5">
                     <label className="text-[10px] uppercase font-bold tracking-wider text-mid opacity-70">Navn</label>
                     <input type="text" readOnly value="Kari Nordmann" className="w-full px-4 py-3 bg-cream/50 border border-bark/10 rounded-xl text-sm outline-none" />
                   </div>
                   <div className="flex flex-col gap-1.5">
                     <label className="text-[10px] uppercase font-bold tracking-wider text-mid opacity-70">Veileder</label>
                     <select className="w-full px-4 py-3 bg-white border border-bark/10 rounded-xl text-sm appearance-none outline-none focus:border-brand/40">
                        <option>Alle tilgjengelige</option>
                        <option>Anne Dahl</option>
                        <option>Lars Heggen</option>
                     </select>
                   </div>
                 </div>
               </div>

               <div className="text-[10px] uppercase font-bold tracking-widest text-mid mb-4 pb-2 border-b border-bark/5">{l.upcomingBookings}</div>
               {bookings.map((bk, i) => (
                 <div key={i} className="flex gap-4 p-4 bg-white border-l-[3px] border-l-brand border-y border-r border-bark/10 rounded-xl shadow-sm">
                   <div className="flex flex-col items-center justify-center min-w-[50px] py-1 bg-brand-light rounded-lg text-brand">
                     <div className="text-xl font-bold leading-none">{bk.date}</div>
                     <div className="text-[9px] uppercase font-bold tracking-tighter">{bk.month}</div>
                   </div>
                   <div className="flex-1 group relative">
                     <div className="text-sm font-bold">{bk.time} · {bk.veil}</div>
                     <div className="text-[11px] text-mid mb-2">INT-2026 · Interiørdesign A</div>
                     <div className="text-xs font-light text-mid p-2.5 bg-cream rounded-lg leading-relaxed">
                        {bk.topic}
                     </div>
                     <button className="absolute top-0 right-0 p-1.5 text-mid/20 hover:text-hi transition-colors">
                        <X size={14} />
                     </button>
                   </div>
                 </div>
               ))}
            </motion.div>
          )}

          {activeTab === 'paamelding' && (
            <motion.div key="paamelding" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <div className="text-[10px] uppercase font-bold tracking-widest text-mid mb-4 pb-2 border-b border-bark/5">Velg arrangement</div>
              <div className="flex flex-col gap-3">
                {events.map(event => (
                  <div key={event.id} className="bg-white border border-bark/10 rounded-2xl overflow-hidden shadow-sm hover:border-brand/30 transition-all cursor-pointer">
                    <div className="p-5 flex items-center gap-4 border-b border-bark/5 bg-gradient-to-br from-brand-light/20 to-transparent">
                      <div className="w-1.5 h-1.5 rounded-full bg-brand animate-pulse" />
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-sm">{event.title}</div>
                        <div className="text-[11px] text-mid opacity-70 truncate">{event.meta}</div>
                      </div>
                      <div className="px-2.5 py-1 bg-brand-light text-brand text-[10px] font-bold rounded-lg">{event.seats}</div>
                    </div>
                    <div className="p-5">
                      <p className="text-xs font-light text-mid leading-relaxed mb-4">{event.desc}</p>
                      <button className="w-full py-3.5 bg-brand text-white text-xs font-medium rounded-xl hover:opacity-90 transition-opacity shadow-lg shadow-brand/15">
                        {l.joinBtn}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Client Detail Modal */}
      <AnimatePresence>
        {selectedClientDetail && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 sm:p-6 bg-bark/40 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="w-full max-w-2xl bg-cream rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="relative h-48 sm:h-64 overflow-hidden">
                <img 
                  src={`https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&q=80&w=1200`} 
                  alt="Interior" 
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-bark/80 to-transparent" />
                <button 
                  onClick={() => setSelectedClientDetail(null)}
                  className="absolute top-4 right-4 p-2 bg-white/20 backdrop-blur-md text-white rounded-full hover:bg-white/40 transition-all"
                >
                  <X size={20} />
                </button>
                <div className="absolute bottom-6 left-6 right-6 flex items-end justify-between">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-12 h-12 rounded-2xl bg-brand text-white flex items-center justify-center font-bold text-xl shadow-lg ring-2 ring-white/20">
                        {(selectedClientDetail.name || 'AN').split(' ').map((w: any) => w[0]).join('').slice(0,2).toUpperCase()}
                      </div>
                      <div>
                        <h2 className="text-2xl serif text-white leading-none mb-1">{selectedClientDetail.name}</h2>
                        <span className="text-[10px] uppercase font-bold tracking-widest text-white/70">{selectedClientDetail.meta}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-8">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  <div className="p-4 bg-white rounded-2xl border border-bark/5 shadow-sm">
                    <div className="text-[10px] font-bold text-mid uppercase tracking-widest mb-1.5">Primær stil</div>
                    <div className="text-xs font-bold text-brand">{selectedClientDetail.style || 'Skandinavisk'}</div>
                  </div>
                  <div className="p-4 bg-white rounded-2xl border border-bark/5 shadow-sm">
                    <div className="text-[10px] font-bold text-mid uppercase tracking-widest mb-1.5">Status</div>
                    <div className="text-xs font-bold text-ok flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-ok" /> Aktiv
                    </div>
                  </div>
                  <div className="p-4 bg-white rounded-2xl border border-bark/5 shadow-sm hidden sm:block">
                    <div className="text-[10px] font-bold text-mid uppercase tracking-widest mb-1.5">Deadline</div>
                    <div className="text-xs font-bold text-bark">14 dager igjen</div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-sm font-bold flex items-center gap-2">
                    <ClipboardCheck size={18} className="text-brand" />
                    Prosjektbeskrivelse
                  </h3>
                  <div className="p-6 bg-white/60 border border-bark/5 rounded-2xl italic text-sm text-mid leading-relaxed font-light">
                    {selectedClientDetail.description || `Kunden ønsker hjelp til å transformere sitt nåværende rom til en mer funksjonell og estetisk tiltalende sone. Fokus ligger på naturlige materialer, optimal utnyttelse av dagslys og en fargepalett som fremmer ro og kreativitet.`}
                  </div>
                </div>

                <div className="space-y-4">
                   <h3 className="text-sm font-bold flex items-center gap-2">
                     <Settings size={18} className="text-brand" />
                     Tekniske krav
                   </h3>
                   <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {[
                        'Bærekraftige materialvalg',
                        'Integrert belysningsplan',
                        'Ergonomisk møblering',
                        'Akustiske tiltak i tak/vegger'
                      ].map((krav, i) => (
                        <div key={i} className="flex items-center gap-3 p-3 bg-white border border-bark/5 rounded-xl text-xs font-medium">
                          <Check size={14} className="text-ok" />
                          {krav}
                        </div>
                      ))}
                   </div>
                </div>
              </div>

              <div className="p-6 bg-white border-t border-bark/5">
                <button 
                  onClick={() => {
                    setActiveChat(selectedClientDetail);
                    setSelectedClientDetail(null);
                  }}
                  className="w-full py-4 bg-brand text-white font-bold rounded-2xl shadow-lg shadow-brand/20 hover:scale-[1.01] transition-all flex items-center justify-center gap-2 active:scale-95"
                >
                  <MessageSquare size={18} />
                  Diskuter med kunden
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Mobile Sticky CTA Area for selected client */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/80 backdrop-blur-md border-t border-bark/10 sm:hidden flex gap-2">
         {/* Navigation tabs would be here on mobile in original design */}
         {(['chat', 'booking', 'paamelding'] as const).map(tab => (
           <button 
             key={tab}
             onClick={() => setActiveTab(tab)}
             className={`flex-1 flex flex-col items-center gap-1 py-2 rounded-xl transition-all ${activeTab === tab ? 'bg-brand-light text-brand font-bold' : 'text-mid'}`}
           >
             {tab === 'chat' ? <MessageSquare size={18} /> : tab === 'booking' ? <Calendar size={18} /> : <ClipboardCheck size={18} />}
             <span className="text-[9px] uppercase font-bold tracking-tighter">{labels[lang][tab].split(' ')[0]}</span>
           </button>
         ))}
      </div>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { ChevronLeft, ShieldCheck, ArrowRight, User as UserIcon, LogIn, Key, Hash } from 'lucide-react';
import { loginWithGoogle, loginAnonymously, db, handleFirestoreError, OperationType, useAuth } from '../lib/firebase';
import { doc, getDoc, setDoc, serverTimestamp, collection, query, where, getDocs } from 'firebase/firestore';

type LoginType = 'participant' | 'facilitator';

export default function LoginPage() {
  const [searchParams] = useSearchParams();
  const initialMode = searchParams.get('mode') as LoginType | null;
  const [loginType, setLoginType] = useState<LoginType | null>(initialMode);

  useEffect(() => {
    if (initialMode && (initialMode === 'participant' || initialMode === 'facilitator')) {
      setLoginType(initialMode);
    }
  }, [initialMode]);
  const [lang, setLang] = useState<'no' | 'en'>('no');
  const [loading, setLoading] = useState(false);
  const [username, setUsername] = useState('');
  const [groupCode, setGroupCode] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { user: authUser, loading: authLoading } = useAuth();

  useEffect(() => {
    if (authUser && !authLoading) {
      checkProfileAndNavigate(authUser);
    }
  }, [authUser, authLoading]);

  const checkProfileAndNavigate = async (user: any) => {
    try {
      const userRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userRef);
      
      if (userSnap.exists()) {
        const data = userSnap.data();
        if (data.role === 'facilitator' || data.role === 'admin' || user.email === 'post@peterfriberg.no') {
          navigate('/facilitator');
        } else {
          navigate('/participant');
        }
      }
    } catch (err) {
      console.error("Profile check failed:", err);
    }
  };

  const handleParticipantLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !groupCode.trim()) {
      setError(lang === 'no' ? 'Fyll inn begge felt' : 'Fill in both fields');
      return;
    }

    try {
      setLoading(true);
      setError('');

      const groupsRef = collection(db, 'groups');
      const q = query(
        groupsRef, 
        where('code', '==', groupCode.trim().toUpperCase())
      );
      const groupSnap = await getDocs(q);
      const validGroup = groupSnap.docs.find(d => !d.data().deleted);
      
      if (!validGroup) {
        setError(lang === 'no' ? 'Ugyldig gruppekode' : 'Invalid group code');
        return;
      }
      
      const groupId = validGroup.id;

      const result = await loginAnonymously();
      const user = result.user;

      const userRef = doc(db, 'users', user.uid);
      await setDoc(userRef, {
        username: username.trim(),
        role: 'participant',
        groupIds: [groupId],
        lastActive: serverTimestamp(),
        dailyInteractions: {
          date: serverTimestamp(),
          count: 0
        }
      }, { merge: true });

      navigate('/participant');
    } catch (err: any) {
      console.error("Login failed:", err);
      let msg = err.message || 'Ukjent feil';
      try {
        const parsed = JSON.parse(msg);
        if (parsed.error) msg = parsed.error;
      } catch (e) { /* not json */ }

      setError(lang === 'no' ? 'Innlogging feilet: ' + msg : 'Login failed: ' + msg);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      setLoading(true);
      setError('');
      const result = await loginWithGoogle();
      const user = result.user;

      const userRef = doc(db, 'users', user.uid);
      let userSnap;
      try {
        userSnap = await getDoc(userRef);
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, `users/${user.uid}`);
        return;
      }

      if (!userSnap.exists()) {
        try {
          await setDoc(userRef, {
            username: user.displayName || user.email?.split('@')[0] || 'Anonym',
            role: loginType === 'facilitator' ? 'facilitator' : 'participant',
            groupIds: [],
            lastActive: serverTimestamp(),
          });
        } catch (error) {
          handleFirestoreError(error, OperationType.CREATE, `users/${user.uid}`);
          return;
        }
        
        if (loginType === 'facilitator') {
          navigate('/facilitator');
        } else {
          navigate('/participant');
        }
      } else {
        const data = userSnap.data();
        if (user.email === 'post@peterfriberg.no' || data.role === 'facilitator' || data.role === 'admin') {
          navigate('/facilitator');
        } else if (loginType === 'facilitator') {
          navigate('/facilitator');
        } else {
          navigate('/participant');
        }
      }
    } catch (err: any) {
      console.error("Login failed:", err);
      let msg = err.message || 'Vennligst prøv igjen.';
      try {
        const parsed = JSON.parse(msg);
        if (parsed.error) msg = parsed.error;
      } catch (e) { /* not json */ }

      setError(lang === 'no' ? 'Innlogging feilet: ' + msg : 'Login failed: ' + msg);
    } finally {
      setLoading(false);
    }
  };

  const labels = {
    no: {
      back: 'Tilbake',
      partTitle: 'Deltaker',
      facTitle: 'Veileder',
      login: 'Logg inn',
      googleBtn: 'Logg inn med Google',
      security: 'Vi bruker Google for sikker innlogging. Ingen personlig data deles utenom profilinfo.',
      loading: 'Logger inn...',
    },
    en: {
      back: 'Back',
      partTitle: 'Participant',
      facTitle: 'Facilitator',
      login: 'Log in',
      googleBtn: 'Sign in with Google',
      security: 'We use Google for secure login. No personal data is shared beyond profile info.',
      loading: 'Logging in...',
    }
  };

  const l = labels[lang];

  if (!loginType) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-cream p-6">
        <Link to="/" className="mb-12 text-3xl serif">
          Fi<em className="italic text-brand">kun</em>
        </Link>
        <div className="w-full max-w-sm flex flex-col gap-4">
          <button 
            onClick={() => setLoginType('participant')}
            className="flex items-center gap-4 p-6 bg-white border border-bark/10 rounded-2xl hover:border-brand/40 transition-all text-left shadow-sm group"
          >
            <div>
              <div className="font-bold text-lg">{l.partTitle}</div>
              <div className="text-sm text-mid opacity-70">Delta på kurs eller workshop</div>
            </div>
          </button>
          <button 
            onClick={() => setLoginType('facilitator')}
            className="flex items-center gap-4 p-6 bg-white border border-bark/10 rounded-2xl hover:border-brand/40 transition-all text-left shadow-sm group"
          >
            <div>
              <div className="font-bold text-lg">{l.facTitle}</div>
              <div className="text-sm text-mid opacity-70">Administrer og gi veiledning</div>
            </div>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-cream">
       <nav className="flex items-center justify-between p-6 border-b border-bark/10 bg-white">
        <button onClick={() => setLoginType(null)} className="flex items-center gap-2 text-sm text-mid hover:text-brand transition-colors">
          <ChevronLeft size={18} />
          {l.back}
        </button>
        <div className="flex bg-bark/5 p-1 rounded-lg gap-1">
          <button onClick={() => setLang('no')} className={`px-3 py-1 text-xs font-medium rounded-md ${lang === 'no' ? 'bg-white shadow-sm text-bark' : 'text-mid'}`}>NO</button>
          <button onClick={() => setLang('en')} className={`px-3 py-1 text-xs font-medium rounded-md ${lang === 'en' ? 'bg-white shadow-sm text-bark' : 'text-mid'}`}>EN</button>
        </div>
      </nav>

      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <h1 className="text-3xl serif mb-2">
            {lang === 'no' ? 'Logg inn som' : 'Log in as'}
            <br />
            <em className="italic text-brand">{loginType === 'participant' ? l.partTitle.toLowerCase() : l.facTitle.toLowerCase()}</em>
          </h1>
          <p className="text-sm font-medium text-mid mb-12 leading-relaxed">
            {loginType === 'facilitator' 
              ? (lang === 'no' ? 'Bruk din Google-konto for å administrere kurs.' : 'Use your Google account to manage courses.')
              : (lang === 'no' ? 'Oppgi ditt navn og gruppekode for å starte.' : 'Enter your name and group code to start.')}
          </p>

          <div className="flex flex-col gap-6">
            {loginType === 'participant' ? (
              <form onSubmit={handleParticipantLogin} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] uppercase font-bold tracking-widest text-mid ml-2">Ditt navn</label>
                  <div className="relative">
                    <UserIcon size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-mid opacity-70" />
                    <input 
                      type="text" 
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="F.eks. Ola Nordmann"
                      className="w-full pl-12 pr-4 py-4 bg-white border-2 border-bark/10 focus:border-brand/40 text-bark font-medium rounded-2xl outline-none transition-all"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] uppercase font-bold tracking-widest text-mid ml-2">Gruppekode</label>
                  <div className="relative">
                    <Hash size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-mid opacity-70" />
                    <input 
                      type="text" 
                      value={groupCode}
                      onChange={(e) => setGroupCode(e.target.value)}
                      placeholder="X1Y2Z3"
                      className="w-full pl-12 pr-4 py-4 bg-white border-2 border-bark/10 focus:border-brand/40 text-bark font-medium rounded-2xl outline-none transition-all uppercase"
                    />
                  </div>
                </div>


                <button 
                  type="submit"
                  disabled={loading}
                  className="w-full py-4 bg-brand text-white font-bold rounded-2xl shadow-lg shadow-brand/20 hover:opacity-90 transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50 mt-6"
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>Bli med <ArrowRight size={18} /></>
                  )}
                </button>
                {error && loginType === 'participant' && (
                  <div className="p-4 bg-hi-light text-hi text-xs font-bold rounded-xl border border-hi/10">
                    {error}
                  </div>
                )}
              </form>
            ) : (
              <>
                <button 
                  onClick={handleGoogleLogin} 
                  disabled={loading}
                  className="w-full py-4 bg-white border-2 border-bark/5 hover:border-brand/40 text-bark font-bold rounded-2xl transition-all shadow-md flex items-center justify-center gap-3 active:scale-95 disabled:opacity-50"
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-brand border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <LogIn size={20} className="text-brand" />
                  )}
                  {loading ? l.loading : l.googleBtn}
                </button>
                {error && loginType === 'facilitator' && (
                  <div className="p-4 bg-hi-light text-hi text-xs font-bold rounded-xl border border-hi/10">
                    {error}
                  </div>
                )}
              </>
            )}

            <div className="flex items-start gap-3 p-4 bg-bark/5 rounded-2xl">
              <ShieldCheck size={20} className="text-mid opacity-70 mt-0.5" />
              <p className="text-xs font-medium text-mid leading-relaxed italic">
                {loginType === 'facilitator' ? l.security : (lang === 'no' ? 'Deltakere trenger ikke passord. Din fremgang lagres på denne enheten.' : 'Participants do not need a password. Your progress is saved on this device.')}
              </p>
            </div>
          </div>
          
          <div className="mt-12 text-center">
            <button 
              onClick={() => setLoginType(loginType === 'participant' ? 'facilitator' : 'participant')}
              className="text-[11px] uppercase font-bold tracking-widest text-mid hover:text-brand transition-colors"
            >
              {loginType === 'participant' ? labels[lang === 'no' ? 'no' : 'en'].facTitle : labels[lang === 'no' ? 'no' : 'en'].partTitle} logg inn →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

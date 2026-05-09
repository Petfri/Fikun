import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronRight, ShieldCheck, UserCircle, School, ArrowRight, MessageSquare, Calendar, ClipboardCheck } from 'lucide-react';
import { useAuth, db } from '../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

const products = {
  kunde: {
    id: 'kunde',
    tag: 'Fiktiv kundechat',
    title: 'Øv på kundedialog med',
    titleEm: 'fiktive AI-kunder',
    desc: 'Veileder setter opp AI-kunder med full kontroll på innholdet. Deltakere øver på ekte kundedialog — trygt og uten risiko.',
    steps: [
      { num: '01', title: 'Veileder setter opp', desc: 'Opprett kundeprofiler med AI-hjelp og full kontroll på hva deltakerne møter.' },
      { num: '02', title: 'Deltaker intervjuer', desc: 'AI-kunden svarer naturlig og konsistent. Alle får samme utgangspunkt.' },
      { num: '03', title: 'Veileder godkjenner', desc: 'Gjennomgå svar etter prioritet og bygg opp en stadig bedre kunnskapsbase.' }
    ],
    useCases: ['Høgskoler og universiteter', 'Videregående skoler med yrkesfag', 'Kursholdere og faglige instruktører', 'Bedrifter med intern opplæring'],
    primaryCta: 'Logg inn som deltaker',
    secondaryCta: 'Logg inn som veileder',
  },
  booking: {
    id: 'booking',
    tag: 'Veiledningsbooking',
    title: 'Book veiledning enkelt og',
    titleEm: 'oversiktlig',
    desc: 'Deltakere booker tid med veileder direkte. Veiledere oppretter tilgjengelige tider og har full oversikt over alle bookinger.',
    steps: [
      { num: '01', title: 'Veileder oppretter tider', desc: 'Legg inn dato, varighet og pauser. Systemet genererer ledige slots automatisk.' },
      { num: '02', title: 'Deltaker booker tid', desc: 'Velg gruppe, veileder og ønsket tid. Skriv hva du vil ha veiledning i.' },
      { num: '03', title: 'Full oversikt', desc: 'Deltaker ser sine bookinger. Veileder administrerer og redigerer tider.' }
    ],
    useCases: ['Individuell veiledning', 'Gruppegjennomganger', 'Eksamensperioder', 'Innleveringsgjennomganger'],
    primaryCta: 'Book veiledning',
    secondaryCta: 'Veiledervisning',
  },
  paamelding: {
    id: 'paamelding',
    tag: 'Kurspåmelding',
    title: 'Enkel påmelding til kurs og',
    titleEm: 'workshops',
    desc: 'Veileder oppretter påmeldingsskjemaer med egendefinerte felter. Deltakere melder seg på direkte. Full oversikt over påmeldte.',
    steps: [
      { num: '01', title: 'Veileder oppretter skjema', desc: 'Definer felter, kapasitet og frist. Publiser med ett klikk.' },
      { num: '02', title: 'Deltaker melder seg på', desc: 'Fyll ut skjemaet og send inn. Enkel og rask prosess.' },
      { num: '03', title: 'Veileder ser oversikt', desc: 'Full liste over påmeldte med alle felter. Eksporter ved behov.' }
    ],
    useCases: ['Kurs og workshops', 'Ekskursjoner og studieturer', 'Prosjektgrupper', 'Arrangementer og events'],
    primaryCta: 'Meld deg på',
    secondaryCta: 'Administrer påmeldinger',
  }
};

export default function LandingPage() {
  const [activeProd, setActiveProd] = useState<keyof typeof products>('kunde');
  const [lang, setLang] = useState<'no' | 'en'>('no');
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (user && !loading) {
      const checkProfile = async () => {
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
        } catch (e) {
          console.error("Profile check in LandingPage failed:", e);
        }
      };
      checkProfile();
    }
  }, [user, loading, navigate]);

  const t = products[activeProd];

  return (
    <div className="min-h-screen flex flex-col bg-cream text-bark">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 flex items-center justify-between px-6 py-4 bg-cream/80 backdrop-blur-md border-b border-bark/10">
        <Link to="/" className="text-2xl serif">
          Fi<em className="italic text-brand">kun</em>
        </Link>
        <div className="flex items-center gap-4">
          <div className="flex bg-bark/5 p-1 rounded-lg gap-1">
            <button 
              onClick={() => setLang('no')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${lang === 'no' ? 'bg-white shadow-sm text-bark' : 'text-mid'}`}
            >
              NO
            </button>
            <button 
              onClick={() => setLang('en')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${lang === 'en' ? 'bg-white shadow-sm text-bark' : 'text-mid'}`}
            >
              EN
            </button>
          </div>
          <Link to="/login" className="hidden sm:block px-4 py-2 bg-brand text-white text-sm font-medium rounded-lg hover:opacity-90 transition-opacity">
            {lang === 'no' ? 'Kom i gang' : 'Get started'}
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="max-w-4xl mx-auto px-6 pt-20 pb-12 text-center">
        <div className="flex items-center justify-center gap-3 mb-6 text-[10px] uppercase font-bold tracking-[0.15em] text-mid">
          <span className="w-6 h-[0.5px] bg-mid opacity-70" />
          {lang === 'no' ? 'Én plattform, tre verktøy' : 'One platform, three tools'}
          <span className="w-6 h-[0.5px] bg-mid opacity-70" />
        </div>
        <h1 className="text-5xl sm:text-6xl serif leading-[1.1] mb-6">
          {lang === 'no' ? 'Verktøy for' : 'Tools for'}<br />
          <em className="italic text-brand">{lang === 'no' ? 'undervisning og læring' : 'teaching and learning'}</em>
        </h1>
        <p className="text-lg font-light text-mid leading-relaxed max-w-lg mx-auto mb-10">
          {lang === 'no' 
            ? 'Fikun samler fiktiv kundechat, veiledningsbooking og kurspåmelding i én plattform — med samme innlogging for alle.'
            : 'Fikun brings fictional client chat, supervision booking and course registration into one platform — with the same login for all.'}
        </p>
      </section>

      {/* Product Selector */}
      <div className="max-w-5xl mx-auto px-6 w-full mb-6">
        <div className="flex flex-wrap justify-center gap-2">
          {(Object.keys(products) as Array<keyof typeof products>).map((key) => (
            <button
              key={key}
              onClick={() => setActiveProd(key)}
              className={`px-6 py-3 rounded-xl border text-sm transition-all ${
                activeProd === key 
                  ? 'bg-brand border-brand text-white font-medium shadow-lg' 
                  : 'bg-white border-bark/10 text-mid hover:border-bark/20'
              }`}
            >
              {key === 'kunde' ? 'Fikun Kunde chat' : key === 'booking' ? 'Fikun Booking' : 'Fikun Påmelding'}
            </button>
          ))}
        </div>
      </div>

      {/* Product Panels */}
      <main className="max-w-5xl mx-auto px-6 w-full mb-12">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeProd}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
            className="bg-white border border-bark/10 rounded-2xl overflow-hidden shadow-xl shadow-bark/5"
          >
            {/* Panel Hero */}
            <div className={`p-10 sm:p-16 text-center border-b border-bark/10 bg-gradient-to-br from-brand-light/40 to-white`}>
              <div className="inline-block px-3 py-1 bg-brand-light text-brand text-[10px] font-bold uppercase tracking-widest rounded-full mb-4">
                {t.tag}
              </div>
              <h2 className="text-3xl sm:text-4xl serif mb-4 leading-tight">
                {t.title} <em className="italic text-brand">{t.titleEm}</em>
              </h2>
              <p className="text-sm font-light text-mid leading-relaxed max-w-lg mx-auto mb-8">
                {t.desc}
              </p>
              <div className="flex flex-wrap justify-center gap-3">
                <Link to="/login?mode=participant" className="px-6 py-3 bg-brand text-white text-sm font-medium rounded-xl hover:opacity-90 transition-opacity">
                  {t.primaryCta}
                </Link>
                <Link to="/login?mode=facilitator" className="px-6 py-3 border border-bark/20 text-bark text-sm font-medium rounded-xl hover:bg-bark/5 transition-colors">
                  {t.secondaryCta}
                </Link>
              </div>
            </div>

            {/* Steps */}
            <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-bark/10">
              {t.steps.map((step, i) => (
                <div key={i} className="p-8">
                  <div className="text-3xl serif text-brand/30 mb-2 leading-none">{step.num}</div>
                  <h3 className="text-sm font-bold mb-1">{step.title}</h3>
                  <p className="text-[11px] font-medium text-mid leading-normal">{step.desc}</p>
                </div>
              ))}
            </div>

            {/* Use Cases */}
            <div className="grid grid-cols-1 sm:grid-cols-2 border-t border-bark/10">
              {t.useCases.map((uc, i) => (
                <div key={i} className="flex items-center gap-3 p-4 px-8 border-b sm:even:border-l border-bark/10 text-xs font-medium text-bark/80">
                  <div className="w-1.5 h-1.5 rounded-full bg-brand" />
                  {uc}
                </div>
              ))}
            </div>
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Security/Privacy CTA */}
      <section className="bg-white border-y border-bark/10 py-12 mb-12">
        <div className="max-w-5xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-10">
          <div className="flex-1">
            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 bg-brand-light rounded-2xl text-brand">
                <ShieldCheck size={32} />
              </div>
              <h3 className="text-xl serif">
                {lang === 'no' ? 'Trygg løsning uten' : 'Secure solution without'} <em className="italic text-brand">{lang === 'no' ? 'persondata' : 'personal data'}</em>
              </h3>
            </div>
            <p className="text-sm font-light text-mid leading-relaxed max-w-xl">
              {lang === 'no'
                ? 'Fikun krever ingen registrering av personlig informasjon. Deltakere logger inn med en enkel kode fra veilederen — ingen e-post eller persondata samles inn.'
                : 'Fikun requires no registration of personal information. Participants log in with a simple code from the facilitator — no email or personal data is collected.'}
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <Link to="/login?mode=participant" className="flex items-center gap-2 px-5 py-3 bg-cream border border-bark/10 text-bark text-sm font-medium rounded-xl hover:border-bark/30 transition-colors">
              {lang === 'no' ? 'Deltaker-innlogging' : 'Participant login'}
            </Link>
            <Link to="/login?mode=facilitator" className="flex items-center gap-2 px-5 py-3 bg-brand text-white text-sm font-medium rounded-xl hover:opacity-90 transition-opacity">
              {lang === 'no' ? 'Veileder-innlogging' : 'Facilitator login'}
            </Link>
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section className="py-20 text-center px-6">
        <h2 className="text-2xl sm:text-3xl serif mb-4 leading-tight">
          {lang === 'no' ? 'Begynn å bruke' : 'Start using'} <br /><em className="italic text-brand">{lang === 'no' ? 'Fikun i dag' : 'Fikun today'}</em>
        </h2>
        <p className="text-sm font-medium text-mid max-w-sm mx-auto mb-8">
          {lang === 'no' 
            ? 'Det perfekte verktøyet for innovativ undervisning og læring. Ta kontakt så hjelper vi deg i gang.'
            : 'The perfect tool for innovative teaching and learning. Get in touch and we will help you get started.'}
        </p>
        <a href="mailto:hei@fikun.no" className="inline-flex items-center px-10 py-4 bg-brand text-white font-bold rounded-2xl hover:opacity-90 transition-all shadow-lg shadow-brand/20 active:scale-95">
          {lang === 'no' ? 'Kom i gang' : 'Get started'}
        </a>
      </section>

      {/* Footer */}
      <footer className="mt-auto border-t border-bark/10 px-8 py-6 flex items-center justify-between text-[11px] text-mid font-light">
        <div className="serif text-bark text-base">Fi<em className="italic text-brand text-base">kun</em></div>
        <div className="italic">Design av Peter Friberg · © 2025</div>
      </footer>
    </div>
  );
}

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, Reorder, useDragControls } from 'motion/react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Users, 
  MessageSquare, 
  Calendar, 
  ClipboardCheck, 
  LogOut, 
  Plus, 
  Search, 
  Filter, 
  ChevronRight, 
  MoreVertical,
  BarChart3,
  GripVertical,
  Trash2,
  CheckCircle2,
  Clock,
  Share,
  Share2,
  Copy,
  LayoutGrid,
  Check,
  Edit2,
  X,
  ArrowRight,
  Settings,
  Database,
  Smartphone,
  RefreshCw,
  Printer
} from 'lucide-react';
import { auth, logout, db, handleFirestoreError, OperationType } from '../lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  serverTimestamp, 
  doc, 
  setDoc,
  getDocs,
  orderBy,
  updateDoc
} from 'firebase/firestore';
import { GoogleGenAI, Type } from "@google/genai";

type ProductType = 'chat' | 'booking' | 'paamelding';

let _aiClient: GoogleGenAI | null = null;
const getAiClient = () => {
  if (!_aiClient) {
    _aiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
  }
  return _aiClient;
};

const ClientItem = ({ client, onClick, lang, onToggleVisibility }: any) => {
  const controls = useDragControls();

  return (
    <Reorder.Item 
      value={client} 
      dragListener={false} 
      dragControls={controls}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      whileDrag={{ scale: 1.02, boxShadow: "0 10px 30px rgba(0,0,0,0.1)", zIndex: 50 }}
      className="list-none relative"
    >
      <div 
        onClick={onClick}
        className="group/card flex items-center gap-4 bg-white p-4 py-3 border border-bark/10 rounded-2xl shadow-sm hover:border-brand/30 transition-all cursor-pointer relative"
      >
        <div 
          onPointerDown={(e) => { e.stopPropagation(); controls.start(e); }}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); e.preventDefault(); }}
          className="p-2 -ml-2 text-bark/20 hover:text-brand transition-colors cursor-grab active:cursor-grabbing shrink-0 touch-none"
        >
          <GripVertical size={20} />
        </div>
        <div className="w-10 h-10 rounded-full bg-brand-light flex items-center justify-center text-xs font-bold text-brand group-hover/card:scale-105 transition-transform shrink-0">
          {(client.name || 'AN').split(' ').map((w: any) => w[0]).join('').slice(0,2)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
             <h4 className="font-bold text-sm tracking-tight truncate">{client.name}</h4>
             {client.pending > 0 && (
               <span className="px-2 py-0.5 bg-hi-light text-hi text-[9px] font-bold rounded-full uppercase tracking-tighter">
                  {client.pending} venter
               </span>
             )}
          </div>
          <p className="text-[11px] text-mid font-medium truncate leading-relaxed">{client.meta}</p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
           <button 
             onClick={(e) => { e.stopPropagation(); onToggleVisibility(client); }}
             className={`hidden sm:inline-block text-[10px] font-bold px-3 py-1.5 rounded-lg transition-all border ${client.isVisible ? 'bg-ok-light border-ok/20 text-ok' : 'bg-bark/5 border-bark/10 text-mid'}`}
           >
              {client.isVisible ? (lang === 'no' ? 'Synlig' : 'Visible') : (lang === 'no' ? 'Skjult' : 'Hidden')}
           </button>
           <ChevronRight size={18} className="text-mid opacity-20 group-hover/card:opacity-100 group-hover/card:text-brand transition-all" />
        </div>
      </div>
    </Reorder.Item>
  );
};

export default function FacilitatorDashboard() {
  const [activeProduct, setActiveProduct] = useState<ProductType>('chat');
  const [lang, setLang] = useState<'no' | 'en'>('no');
  const navigate = useNavigate();
  const [user, setUser] = useState(auth.currentUser);

  const [groups, setGroups] = useState<any[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'content' | 'approval' | 'stats'>('content');
  const [pendingInteractions, setPendingInteractions] = useState<any[]>([]);
  const [approvedInteractions, setApprovedInteractions] = useState<any[]>([]);
  const [aiDrafts, setAiDrafts] = useState<Record<string, string>>({});

  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedSessions, setSelectedSessions] = useState<Set<string>>(new Set());
  const [showSessionDetail, setShowSessionDetail] = useState(false);
  const [sessionToView, setSessionToView] = useState<any>(null);

  const [showGroupsModal, setShowGroupsModal] = useState(false);
  const [showCodeModal, setShowCodeModal] = useState(false);
  const [showSectionModal, setShowSectionModal] = useState(false);
  const [selectedSection, setSelectedSection] = useState<any>(null);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [showCreateClient, setShowCreateClient] = useState(false);
  const [selectedClient, setSelectedClient] = useState<any | null>(null);
  
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupCode, setNewGroupCode] = useState('');
  const [newClientName, setNewClientName] = useState('');
  const [newClientType, setNewClientType] = useState<'Privatkunde' | 'Bedriftskunde'>('Privatkunde');
  const [newClientMeta, setNewClientMeta] = useState('');
  const [newClientStyle, setNewClientStyle] = useState('');
  const [newClientStatus, setNewClientStatus] = useState('Aktiv');
  const [newClientDeadline, setNewClientDeadline] = useState('');
  const [newClientKrav, setNewClientKrav] = useState('');
  const [newClientBolig, setNewClientBolig] = useState('');
  const [newClientLivs, setNewClientLivs] = useState('');
  const [newClientBudsjett, setNewClientBudsjett] = useState('');
  const [newClientPri, setNewClientPri] = useState('');
  const [newClientNei, setNewClientNei] = useState('');
  const [newClientBesk, setNewClientBesk] = useState('');
  const [newClientExt, setNewClientExt] = useState('');
  const [newClientImageUrl, setNewClientImageUrl] = useState('');
  const [savingClient, setSavingClient] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [isEditingSummary, setIsEditingSummary] = useState(false);
  const [editableSummary, setEditableSummary] = useState('');

  const cleanSummaryText = (text: string, strict = true) => {
    let cleaned = text
      .replace(/[#*_\~`>]{1,}/g, '') // Remove markdown symbols (keeping hyphen for normal text)
      .replace(/^[ \t]*[-+*][ \t]+/gm, ''); // Remove bullet points at start of line

    if (strict) {
      cleaned = cleaned
        .replace(/^[ \t]*[=]{3,}[ \t]*$/gm, '') // Remove separators
        .replace(/^[ \t]*[-]{3,}[ \t]*$/gm, '')
        .replace(/\n{3,}/g, '\n\n') // Normalize newlines
        .replace(/^(Her er en|Denne rapporten|Oppsummering for|Rapportoppsummering|Rapport-oppsummering).*/i, '') // Strip intros
        .trim();
    }
    return cleaned;
  };

  const [clientTab, setClientTab] = useState<'approval' | 'report' | 'edit' | 'preview'>('approval');

  const chatContainerRef = useRef<HTMLDivElement>(null);
  const [aiMessages, setAiMessages] = useState<any[]>([
    { role: 'assistant', content: 'Hei! Jeg kan hjelpe deg med å finpusse kundeprofilen. Vil du at jeg skal utdype stilen eller kanskje legge til flere detaljer om livssituasjonen?' }
  ]);
  const [aiInput, setAiInput] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [pendingAiSuggestion, setPendingAiSuggestion] = useState<any | null>(null);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTo({
        top: chatContainerRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [aiMessages, isAiLoading]);

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      if (!u) navigate('/login');
      setUser(u);
    });
  }, [navigate]);

  // Fetch groups
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'groups'), where('facilitators', 'array-contains', user.uid));
    
    return onSnapshot(q, (snapshot) => {
      const g = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setGroups(g);
      if (g.length > 0 && !selectedGroupId) {
        setSelectedGroupId(g[0].id);
      }
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'groups');
    });
  }, [user, selectedGroupId]);

  // Fetch clients for selected group
  useEffect(() => {
    if (!selectedGroupId) return;
    const q = collection(db, 'groups', selectedGroupId, 'clients');
    
    return onSnapshot(q, (snapshot) => {
      const c = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setClients(c);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `groups/${selectedGroupId}/clients`);
    });
  }, [selectedGroupId]);

  // Fetch all interactions for all clients in the group (for approval tab)
  useEffect(() => {
    if (!selectedGroupId || clients.length === 0) {
      setPendingInteractions([]);
      setApprovedInteractions([]);
      return;
    }
    
    const unsubscribes: (() => void)[] = [];
    const clientsInteractions: Record<string, any[]> = {};

    clients.forEach(client => {
      const q = query(
        collection(db, 'groups', selectedGroupId, 'clients', client.id, 'interactions'),
        orderBy('createdAt', 'desc')
      );

      const unsub = onSnapshot(q, (snapshot) => {
        clientsInteractions[client.id] = snapshot.docs.map(d => ({ 
          id: d.id, 
          clientId: client.id,
          clientName: client.name,
          ...d.data() 
        }));
        
        // Flatten and sort
        const all = Object.values(clientsInteractions).flat();
        setPendingInteractions(all.filter(i => i.status === 'pending').sort((a,b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)));
        setApprovedInteractions(all.filter(i => i.status === 'approved').sort((a,b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)));
      }, (error) => {
        console.error("Interactions error for", client.name, error);
      });
      unsubscribes.push(unsub);
    });

    return () => unsubscribes.forEach(u => u());
  }, [selectedGroupId, clients]);

  const approveInteraction = async (interaction: any, answer: string) => {
    if (!answer.trim()) return;
    try {
      const ref = doc(db, 'groups', selectedGroupId, 'clients', interaction.clientId, 'interactions', interaction.id);
      await setDoc(ref, {
        status: 'approved',
        answer,
        updatedAt: serverTimestamp()
      }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'interactions');
    }
  };

  const generateAiAnswer = async (interaction: any) => {
    setAiDrafts(prev => ({ ...prev, [interaction.id]: 'Tenker...' }));
    
    try {
      const prompt = `Du er en interiørveileder. En deltaker har stilt et spørsmål til kunden "${interaction.clientName}".
      
      Kundeinfo:
      - Stil: ${selectedClient?.style || 'Ikke oppgitt'}
      - Tekniske krav: ${selectedClient?.technicalRequirements?.join(', ') || 'Ingen'}
      - Prioriteringer: ${selectedClient?.prioriteringer || 'Ikke oppgitt'}
      - Ekstra kontekst: ${selectedClient?.ekstraKontekst || 'Ingen'}
      
      Deltaker spør: "${interaction.question}"
      
      Svar som kunden ville gjort, i jeg-form. Hold det kort (1-2 setninger) og i tråd med kundens profil.`;

      const response = await getAiClient().models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
      });

      const draft = response.text || "Beklager, jeg klarte ikke å generere et utkast.";
      setAiDrafts(prev => ({ ...prev, [interaction.id]: draft }));
    } catch (error) {
      console.error("AI failed:", error);
      setAiDrafts(prev => ({ ...prev, [interaction.id]: "Feil ved generering av svar." }));
    }
  };

  const sendMessageToAi = async () => {
    if (!aiInput.trim() || !selectedClient || isAiLoading) return;
    
    const userMsg = aiInput.trim();
    setAiInput('');
    setAiMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setIsAiLoading(true);

    try {
      const clientContext = `
        Kunde: ${selectedClient.name}
        Type: ${selectedClient.type}
        Stil: ${selectedClient.style}
        Bolig: ${selectedClient.bolig}
        Status: ${selectedClient.status}
        Deadline: ${selectedClient.deadline}
        Krav: ${selectedClient.technicalRequirements?.join(', ')}
        Beskrivelse: ${selectedClient.beskrivelse}
        Kontekst: ${selectedClient.ekstraKontekst}
        Prioriteringer: ${selectedClient.prioriteringer}
      `;

      const response = await getAiClient().models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `
          Du er en AI-assistent for en interiørveileder. Du hjelper til med å definere kundeprofiler.
          Her er nåværende info om kunden:
          ${clientContext}

          Brukeren sier: "${userMsg}"

          Hjelp brukeren med å forbedre profilen. Gi konkrete forslag eller svar på spørsmål.
          Du SKAL prøve å fylle ut så mange felter som mulig i suggestion-objektet hvis du foreslår endringer, spesielt beskrivelse, stil og prioriteringer.
          Hvis brukeren ber deg om å "legge til informasjonen", så skal du ta med all relevant info i de riktige feltene.
          Viktig: Du SKAL inkludere et spørsmål til slutt i "response" om brukeren vil at du skal legge til denne informasjonen i kundeprofilen.
          Svar på norsk. Hold det profesjonelt og inspirerende.
        `,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              response: { type: Type.STRING, description: "Text response to the user" },
              suggestion: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  style: { type: Type.STRING },
                  bolig: { type: Type.STRING },
                  status: { type: Type.STRING },
                  deadline: { type: Type.STRING },
                  beskrivelse: { type: Type.STRING },
                  prioriteringer: { type: Type.STRING },
                  ekstraKontekst: { type: Type.STRING },
                }
              }
            },
            required: ["response"]
          }
        }
      });

      const data = JSON.parse(response.text || '{}');
      setAiMessages(prev => [...prev, { 
        role: 'assistant', 
        content: data.response || 'Jeg har behandlet forespørselen din.',
        suggestion: data.suggestion 
      }]);
    } catch (error) {
       console.error("AI assistant failed:", error);
       setAiMessages(prev => [...prev, { role: 'assistant', content: 'Det oppstod en feil i kommunikasjonen med AI-en.' }]);
    } finally {
      setIsAiLoading(false);
    }
  };

  const applyAiSuggestion = (suggestion: any) => {
    if (suggestion.name) setNewClientName(suggestion.name);
    if (suggestion.style) setNewClientStyle(suggestion.style);
    if (suggestion.bolig) setNewClientBolig(suggestion.bolig);
    if (suggestion.status) setNewClientStatus(suggestion.status);
    if (suggestion.deadline) setNewClientDeadline(suggestion.deadline);
    if (suggestion.beskrivelse) setNewClientBesk(suggestion.beskrivelse);
    if (suggestion.prioriteringer) setNewClientPri(suggestion.prioriteringer);
    if (suggestion.ekstraKontekst) setNewClientExt(suggestion.ekstraKontekst);
    if (suggestion.imageUrl) setNewClientImageUrl(suggestion.imageUrl);
    
    // Clear the suggestion from the message so it doesn't show buttons anymore
    setAiMessages(prev => prev.map(m => m.suggestion === suggestion ? { ...m, suggestion: null, applied: true } : m));
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const createGroup = async () => {
    if (!user || !newGroupName.trim() || !newGroupCode.trim()) return;
    try {
      const groupRef = await addDoc(collection(db, 'groups'), {
        name: newGroupName.trim(),
        code: newGroupCode.trim().toUpperCase(),
        facilitators: [user.uid],
        createdAt: serverTimestamp()
      });
      setSelectedGroupId(groupRef.id);
      setShowCreateGroup(false);
      setNewGroupName('');
      setNewGroupCode('');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'groups');
    }
  };

  const createClient = async () => {
    if (!user || !selectedGroupId || !newClientName.trim()) return;
    try {
      await addDoc(collection(db, 'groups', selectedGroupId, 'clients'), {
        name: newClientName.trim(),
        type: newClientType,
        meta: newClientMeta.trim(),
        style: newClientStyle.trim(),
        status: newClientStatus,
        deadline: newClientDeadline.trim(),
        technicalRequirements: newClientKrav.split('\n').filter(k => k.trim()),
        bolig: newClientBolig.trim(),
        livssituasjon: newClientLivs.trim(),
        budsjett: newClientBudsjett.trim(),
        prioriteringer: newClientPri.trim(),
        onskerIkke: newClientNei.trim(),
        beskrivelse: newClientBesk.trim(),
        ekstraKontekst: newClientExt.trim(),
        imageUrl: newClientImageUrl.trim() || 'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&q=80&w=1200',
        isVisible: true,
        createdBy: user.uid,
        createdAt: serverTimestamp()
      });
      setShowCreateClient(false);
      resetClientForm();
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `groups/${selectedGroupId}/clients`);
    }
  };

  const updateClient = async () => {
    if (!user || !selectedGroupId || !selectedClient || !selectedClient.id || !newClientName.trim()) return;
    setSavingClient(true);
    try {
      const ref = doc(db, 'groups', selectedGroupId, 'clients', selectedClient.id);
      const updatedData = {
        name: newClientName.trim(),
        type: newClientType,
        meta: newClientMeta.trim(),
        style: newClientStyle.trim(),
        status: newClientStatus,
        deadline: newClientDeadline.trim(),
        technicalRequirements: newClientKrav.split('\n').filter(k => k.trim()),
        bolig: newClientBolig.trim(),
        livssituasjon: newClientLivs.trim(),
        budsjett: newClientBudsjett.trim(),
        prioriteringer: newClientPri.trim(),
        onskerIkke: newClientNei.trim(),
        beskrivelse: newClientBesk.trim(),
        ekstraKontekst: newClientExt.trim(),
        imageUrl: newClientImageUrl.trim(),
        updatedAt: serverTimestamp()
      };
      await setDoc(ref, updatedData, { merge: true });
      
      // Update local state immediately
      setSelectedClient({ ...selectedClient, ...updatedData });
      setClients(prev => prev.map(c => c.id === selectedClient.id ? { ...c, ...updatedData } : c));
      
      setClientTab('report');
      setShowCreateClient(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `groups/${selectedGroupId}/clients/${selectedClient.id}`);
    } finally {
      setSavingClient(false);
    }
  };

  const resetClientForm = (client?: any) => {
    setNewClientName(client?.name || '');
    setNewClientType(client?.type || 'Privatkunde');
    setNewClientMeta(client?.meta || '');
    setNewClientStyle(client?.style || '');
    setNewClientStatus(client?.status || 'Aktiv');
    setNewClientDeadline(client?.deadline || '');
    setNewClientKrav(client?.technicalRequirements?.join('\n') || '');
    setNewClientBolig(client?.bolig || '');
    setNewClientLivs(client?.livssituasjon || '');
    setNewClientBudsjett(client?.budsjett || '');
    setNewClientPri(client?.prioriteringer || '');
    setNewClientNei(client?.onskerIkke || '');
    setNewClientBesk(client?.beskrivelse || '');
    setNewClientExt(client?.ekstraKontekst || '');
    setNewClientImageUrl(client?.imageUrl || '');
  };

  useEffect(() => {
    if (selectedClient) {
      resetClientForm(selectedClient);
    } else {
      resetClientForm();
    }
  }, [selectedClient]);

  const seedDemoData = async () => {
    if (!user) return;
    try {
      const groupRef = await addDoc(collection(db, 'groups'), {
        name: 'Demo Gruppe 2026',
        code: 'DEMO-26',
        facilitators: [user.uid],
        createdAt: serverTimestamp()
      });

      await addDoc(collection(db, 'groups', groupRef.id, 'clients'), {
        name: 'Lene Bakke',
        meta: 'Privatkunde · Skandinavisk · Kvalitetsfokusert',
        style: 'Minimalistisk',
        isVisible: true,
        createdBy: user.uid
      });

      setSelectedGroupId(groupRef.id);
    } catch (error) {
      console.error("Seed failed:", error);
    }
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    alert(lang === 'no' ? 'Kode kopiert!' : 'Code copied!');
  };

  const deleteGroup = async (id: string) => {
    if (!confirm(lang === 'no' ? 'Slette gruppe?' : 'Delete group?')) return;
    try {
      // In a real app, we'd delete subcollections too or use a cloud function
      await setDoc(doc(db, 'groups', id), { deleted: true }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'groups');
    }
  };

  const toggleClientVisibility = async (client: any) => {
    if (!selectedGroupId) return;
    try {
      const ref = doc(db, 'groups', selectedGroupId, 'clients', client.id);
      await updateDoc(ref, { isVisible: !client.isVisible });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `groups/${selectedGroupId}/clients/${client.id}`);
    }
  };

  const generateClientSummary = async () => {
    if (!selectedClient || !selectedGroupId || isSummarizing) return;
    setIsSummarizing(true);
    try {
      const clientProfile = `
        Navn: ${selectedClient.name}
        Stil: ${selectedClient.style}
        Bolig: ${selectedClient.bolig}
        Beskrivelse: ${selectedClient.beskrivelse}
      `;

      const interactionsContext = approvedInteractions
        .filter(i => i.clientId === selectedClient.id)
        .map(i => `SPØRSMÅL fra deltaker (${i.participantName}): ${i.question}\nSVAR fra AI-kunde: ${i.answer}`)
        .join('\n\n');

      const prompt = `
        Du er en AI-assistent for en interiørveileder. Lag en profesjonell rapport-oppsummering for kunden "${selectedClient.name}".
        
        KUN bruk informasjonen som finnes i interaksjonene under. IKKE dikt opp ting eller legg til antagelser som ikke er direkte støttet av dialogen.
        Hvis det er motstridende info, prioriter de siste svarene fra kunden.

        DIALOG MELLOM DELTAKERE OG KUNDE:
        ${interactionsContext}

        REFERANSEPROFIL:
        ${clientProfile}

        Lag en saklig og profesjonell oppsummering på norsk som inkluderer:
        1. En kort oppsummering av kundens behov basert på dialogen.
        2. Spesifikke preferanser eller krav som deltakerne har avdekket gjennom sine spørsmål.
        3. Eventuelle avklaringer som er gjort angående stil, funksjon eller materialer.

        VIKTIG STIL-GUIDE:
        - Svaret SKAL være helt ren tekst uten formateringstegn.
        - IKKE bruk stjerner (*), emneknagger (#), understrek (_), bindestreker (-) for lister, eller andre Markdown-symboler.
        - IKKE bruk fet eller kursiv skrift.
        - Bruk kun vanlige bokstaver, tall og tegnsetting.
        - Bruk doble linjeskift for å separere avsnitt.
        - Start direkte med innholdet uten innledning eller hilsen.
      `;

      const response = await getAiClient().models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
      });

      // Aggressively strip known markdown and potential AI-prefix chatter
      const summary = cleanSummaryText(response.text || "Kunne ikke generere oppsummering basert på nåværende dialog.");
      
      const ref = doc(db, 'groups', selectedGroupId, 'clients', selectedClient.id);
      await updateDoc(ref, { 
        aiSummary: summary,
        updatedAt: serverTimestamp()
      });
      
      setSelectedClient({ ...selectedClient, aiSummary: summary });
      setEditableSummary(summary);
    } catch (error) {
       console.error("Summary generation failed:", error);
    } finally {
      setIsSummarizing(false);
    }
  };

  const saveEditedSummary = async () => {
    if (!selectedClient || !selectedGroupId) return;
    try {
      const ref = doc(db, 'groups', selectedGroupId, 'clients', selectedClient.id);
      const cleaned = cleanSummaryText(editableSummary);
      await updateDoc(ref, { 
        aiSummary: cleaned,
        updatedAt: serverTimestamp()
      });
      setSelectedClient({ ...selectedClient, aiSummary: cleaned });
      setIsEditingSummary(false);
    } catch (error) {
      console.error("Save summary failed:", error);
    }
  };

  const handlePrintSummary = () => {
    if (!selectedClient || !selectedClient.aiSummary) return;
    
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const sections = selectedClient.aiSummary.split('\n\n').map((para: string) => {
      const trimmed = para.trim();
      const isHeading = /^\d+\./.test(trimmed) || (trimmed.length < 60 && /^[A-ZÆØÅ]/.test(trimmed) && !trimmed.endsWith('.') && !trimmed.includes(','));
      return isHeading ? `<h2>${trimmed}</h2>` : `<p>${trimmed}</p>`;
    }).join('');

    printWindow.document.write(`
      <html>
        <head>
          <title>Kunderapport - ${selectedClient.name}</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 800px; margin: 40px auto; padding: 20px; }
            h1 { color: #1a5c75; border-bottom: 2px solid #1a5c75; padding-bottom: 10px; margin-bottom: 30px; }
            h2 { color: #1a5c75; font-size: 1.2rem; margin-top: 30px; margin-bottom: 10px; text-transform: uppercase; letter-spacing: 0.1em; font-weight: 800; border-bottom: 1px solid #eee; padding-bottom: 5px; }
            p { margin-bottom: 15px; font-size: 1rem; color: #444; }
            .header-info { display: flex; justify-content: space-between; margin-bottom: 40px; font-size: 0.9rem; color: #666; }
            @media print {
              body { margin: 0; padding: 0; }
              button { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="header-info">
            <div>Dato: ${new Date().toLocaleDateString('no-NO')}</div>
            <div>Prosjekt: ${groups.find(g => g.id === selectedGroupId)?.name || 'Ukjent'}</div>
          </div>
          <h1>Kunderapport: ${selectedClient.name}</h1>
          ${sections}
          <script>window.print();</script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const labels = {
    no: {
      chat: 'Kunde chat',
      booking: 'Booking',
      paamelding: 'Påmelding',
      logout: 'Logg ut',
      clients: 'Kunder',
      groups: 'Grupper',
      newClient: 'Ny kunde',
      newSeksjon: 'Ny seksjon',
      pending: 'venter',
      group: 'Gruppe',
      approval: 'Godkjenning',
      report: 'Rapport',
      edit: 'Rediger',
      stats: 'Statistikk',
      activeParticipants: 'Aktive deltakere',
      totalQuestions: 'Totalt spørsmål',
      waitingApproval: 'Venter godkjenning',
      questionsPerParticipant: 'Spørsmål/deltaker',
      allSections: 'Alle seksjoner',
      search: 'Søk...',
    },
    en: {
      chat: 'Client chat',
      booking: 'Booking',
      paamelding: 'Registration',
      logout: 'Log out',
      clients: 'Clients',
      groups: 'Groups',
      newClient: 'New client',
      newSeksjon: 'New section',
      pending: 'pending',
      group: 'Group',
      approval: 'Approval',
      report: 'Report',
      edit: 'Edit',
      stats: 'Statistics',
      activeParticipants: 'Active participants',
      totalQuestions: 'Total questions',
      waitingApproval: 'Waiting approval',
      questionsPerParticipant: 'Questions/participant',
      allSections: 'All sections',
      search: 'Search...',
    }
  };

  const l = labels[lang];

  return (
    <div className="min-h-screen flex flex-col bg-cream text-bark">
      {/* Navbar omitted for brevity, focusing on tabs and main content */}
      <nav className="sticky top-0 z-50 flex items-center justify-between px-6 py-3 bg-white border-b border-bark/10 shadow-sm">
        <Link to="/" className="text-xl serif">
          Fi<em className="italic text-brand">kun</em>
        </Link>
        <div className="flex items-center gap-4">
          <div className="flex bg-bark/5 p-1 rounded-xl gap-1 border border-bark/10">
            <button 
              onClick={() => setLang('no')}
              className={`px-3 py-1 text-[10px] font-bold rounded-lg transition-all ${lang === 'no' ? 'bg-white text-bark shadow-sm' : 'text-mid hover:text-bark'}`}
            >
              NO
            </button>
            <button 
              onClick={() => setLang('en')}
              className={`px-3 py-1 text-[10px] font-bold rounded-lg transition-all ${lang === 'en' ? 'bg-white text-bark shadow-sm' : 'text-mid hover:text-bark'}`}
            >
              EN
            </button>
          </div>
          <span className="hidden sm:inline text-xs text-mid">Innlogget som <strong className="text-bark font-medium text-sm">{user?.displayName || user?.email}</strong></span>
          <button 
            onClick={handleLogout}
            className="text-[11px] font-bold uppercase tracking-wider text-mid hover:text-bark transition-colors border border-bark/10 rounded-lg px-3 py-1.5 leading-none"
          >
             {l.logout}
          </button>
        </div>
      </nav>

      {/* Product Bar & Top Strip */}
      <div className="bg-white border-b border-bark/10 sticky top-[57px] z-40">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between px-6 py-2 border-b border-bark/5 bg-white gap-3">
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
            <button 
              onClick={() => { setActiveProduct('chat'); setActiveTab('content'); }}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-all whitespace-nowrap border ${activeProduct === 'chat' ? 'bg-brand/5 border-brand/20 text-brand font-bold' : 'bg-white border-bark/10 text-mid hover:border-bark/20'}`}
            >
              <div className={`w-1.5 h-1.5 rounded-full ${activeProduct === 'chat' ? 'bg-brand' : 'bg-mid opacity-40'}`} />
              Kunde chat
            </button>
            <button 
              onClick={() => { setActiveProduct('booking'); setActiveTab('content'); }}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-all whitespace-nowrap border ${activeProduct === 'booking' ? 'bg-brand/5 border-brand/20 text-brand font-bold' : 'bg-white border-bark/10 text-mid hover:border-bark/20'}`}
            >
              <div className={`w-1.5 h-1.5 rounded-full ${activeProduct === 'booking' ? 'bg-brand' : 'bg-mid opacity-40'}`} />
              Booking
            </button>
            <button 
              onClick={() => { setActiveProduct('paamelding'); setActiveTab('content'); }}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-all whitespace-nowrap border ${activeProduct === 'paamelding' ? 'bg-brand/5 border-brand/20 text-brand font-bold' : 'bg-white border-bark/10 text-mid hover:border-bark/20'}`}
            >
              <div className={`w-1.5 h-1.5 rounded-full ${activeProduct === 'paamelding' ? 'bg-brand' : 'bg-mid opacity-40'}`} />
              Påmelding
            </button>
          </div>

          <div className="flex items-center gap-3 w-full lg:w-auto overflow-x-auto scrollbar-hide">
            <span className="hidden sm:inline text-[11px] font-bold uppercase tracking-widest text-mid opacity-80 whitespace-nowrap">{l.group}</span>
            <div className="flex items-center gap-2">
              <select 
                value={selectedGroupId}
                onChange={(e) => setSelectedGroupId(e.target.value)}
                className="bg-brand/5 border border-brand/20 text-brand font-bold py-1.5 pl-3 pr-8 rounded-xl text-xs outline-none cursor-pointer appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20width%3D%2210%22%20height%3D%226%22%20viewBox%3D%220%200%2010%206%22%20fill%3D%22none%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cpath%20d%3D%22M1%201l4%204%204-4%22%20stroke%3D%22%231a5c75%22%20stroke-width%3D%221.2%22%20stroke-linecap%3D%22round%22%2F%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[right_10px_center]"
              >
                {groups.filter(g => !g.deleted).map(g => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
              <button 
                onClick={() => setShowGroupsModal(true)}
                className="flex items-center gap-2 px-3 py-2 bg-brand/5 border border-brand/20 text-brand text-[11px] font-bold rounded-xl hover:bg-brand/10 transition-colors whitespace-nowrap"
              >
                <LayoutGrid size={13} />
                <span className="hidden sm:inline">Grupper</span>
              </button>
              <button 
                onClick={() => setShowCodeModal(true)}
                title="Del prosjektkode"
                className="p-2 bg-brand text-white rounded-xl shadow-lg shadow-brand/20 hover:opacity-90 transition-opacity"
              >
                <Share2 size={16} />
              </button>
            </div>
          </div>
        </div>

        {/* Secondary Row: Sub-tabs */}
        <div className="px-6 bg-white overflow-x-auto scrollbar-hide">
          <div className="flex gap-2">
            <button 
              onClick={() => setActiveTab('content')}
              className={`px-4 py-3 text-[13px] transition-all whitespace-nowrap border-b-2 ${activeTab === 'content' ? 'border-brand text-brand font-bold' : 'border-transparent text-mid hover:text-bark'}`}
            >
              {activeProduct === 'chat' ? 'Kunder' : activeProduct === 'booking' ? 'Kalender' : 'Skjemaer'}
              {activeProduct === 'chat' && <span className="ml-2 px-1.5 py-0.5 bg-brand-light text-brand text-[9px] font-bold rounded-md">{clients.length}</span>}
            </button>
            {activeProduct === 'booking' && (
              <button 
                onClick={() => setActiveTab('approval')}
                className={`px-4 py-3 text-[13px] transition-all whitespace-nowrap border-b-2 ${activeTab === 'approval' ? 'border-brand text-brand font-bold' : 'border-transparent text-mid hover:text-bark'}`}
              >
                Opprett tider
              </button>
            )}
            {activeProduct === 'chat' && (
              <button 
                onClick={() => setActiveTab('approval')}
                className={`px-4 py-3 text-[13px] transition-all whitespace-nowrap border-b-2 ${activeTab === 'approval' ? 'border-brand text-brand font-bold' : 'border-transparent text-mid hover:text-bark'}`}
              >
                {l.approval}
                {pendingInteractions.length > 0 && <span className="ml-2 px-1.5 py-0.5 bg-hi text-white text-[9px] font-bold rounded-md">{pendingInteractions.length}</span>}
              </button>
            )}
            <button 
              onClick={() => setActiveTab('stats')}
              className={`px-4 py-3 text-[13px] transition-all whitespace-nowrap border-b-2 ${activeTab === 'stats' ? 'border-brand text-brand font-bold' : 'border-transparent text-mid hover:text-bark'}`}
            >
              {l.stats}
            </button>
          </div>
        </div>
      </div>

      <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6 pb-24 sm:pb-12">
        {activeTab === 'content' && (
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 mb-8">
            <div className="flex flex-col gap-1">
              <h1 className="text-2xl serif">Administrasjon</h1>
              <div className="flex items-center gap-2 text-xs font-medium text-mid">
                 <div className="flex items-center gap-1.5 px-2 py-1 bg-brand-light rounded-lg text-brand">
                    <LayoutGrid size={14} />
                    <span>{groups.find(g => g.id === selectedGroupId)?.name || 'Ingen gruppe'}</span>
                 </div>
                 <div className="flex items-center gap-1.5 px-2 py-1 bg-bark/5 rounded-lg text-mid italic hover:bg-bark/10 transition-colors cursor-pointer" onClick={() => setShowGroupsModal(true)}>
                    <Copy size={13} />
                    <span>Kode: {groups.find(g => g.id === selectedGroupId)?.code || '—'}</span>
                 </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
              <div className="relative flex-1 lg:min-w-[300px]">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-mid opacity-40" size={18} />
                <input 
                  type="text" 
                  placeholder="Søk i kunder, deltakere..."
                  className="w-full pl-12 pr-4 py-3.5 bg-white border border-bark/10 rounded-2xl outline-none focus:border-brand/40 shadow-sm text-sm"
                />
              </div>
              <button 
                onClick={() => setShowGroupsModal(true)}
                className="p-3.5 bg-white border border-bark/10 rounded-2xl text-mid hover:text-brand transition-colors shadow-sm"
                title="Bytt gruppe"
              >
                <LayoutGrid size={20} />
              </button>
              <button 
                onClick={() => { resetClientForm(); setShowCreateClient(true); }}
                className="flex items-center gap-2 px-6 py-3.5 bg-brand text-white text-sm font-bold rounded-2xl shadow-lg shadow-brand/20 hover:scale-[1.02] active:scale-95 transition-all"
              >
                <Plus size={18} />
                Ny kunde
              </button>
            </div>
          </div>
        )}

           <AnimatePresence mode="wait">
             {activeTab === 'content' && activeProduct === 'chat' && (
               <motion.div key="chat-content" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">
                  <div className="group/section">
                    <div className="flex items-center gap-3 mb-3 pl-1">
                      <div className="p-1 px-1.5 text-mid/20 hover:text-brand transition-colors cursor-grab active:cursor-grabbing">
                          <GripVertical size={16} />
                      </div>
                      <h3 className="text-[10px] uppercase font-bold tracking-[0.2em] text-mid">Seksjon 1 — Privatkunder</h3>
                      <div className="h-[0.5px] flex-1 bg-bark/10" />
                    </div>
                    <div className="grid grid-cols-1 gap-3">
                      {clients.length === 0 && (
                        <div className="p-8 text-center bg-white border border-bark/10 rounded-2xl italic text-xs text-mid opacity-50">
                          Ingen kunder i denne gruppen ennå.
                        </div>
                      )}
                      
                      <Reorder.Group axis="y" values={clients} onReorder={setClients} className="space-y-3">
                        {clients.map(client => (
                          <ClientItem 
                            key={client.id} 
                            client={client} 
                            onClick={() => setSelectedClient(client)} 
                            lang={lang}
                            onToggleVisibility={toggleClientVisibility}
                          />
                        ))}
                      </Reorder.Group>
                    </div>
                  </div>
               </motion.div>
             )}

             {activeTab === 'content' && activeProduct === 'booking' && (
               <motion.div key="booking-content" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">
                  <div className="flex flex-col sm:flex-row items-center gap-3 mb-6">
                    <div className="relative group w-full sm:w-64">
                       <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-mid opacity-60" />
                       <input type="text" placeholder="Søk deltaker eller tid..." className="w-full pl-9 pr-4 py-2 bg-white border border-bark/10 rounded-xl text-sm outline-none focus:border-brand/40 shadow-sm" />
                    </div>
                    <button 
                      onClick={() => setSelectionMode(!selectionMode)}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border ${selectionMode ? 'bg-hi-light border-hi text-hi' : 'bg-white border-bark/10 text-mid hover:bg-bark/5'}`}
                    >
                      {selectionMode ? 'Avbryt' : 'Marker'}
                    </button>
                    <select className="w-full sm:w-auto px-3 py-2 bg-white border border-bark/10 rounded-xl text-xs text-mid outline-none cursor-pointer">
                      <option>Alle veiledere</option>
                      <option>Anne Dahl</option>
                      <option>Lars Heggen</option>
                    </select>
                  </div>

                  {selectionMode && selectedSessions.size > 0 && (
                    <div className="flex items-center gap-3 p-3 bg-brand/5 border border-brand/20 rounded-2xl mb-4">
                      <span className="text-xs font-bold text-brand flex-1 ml-2">{selectedSessions.size} valgt</span>
                      <button className="px-3 py-1.5 bg-white border border-brand/20 text-brand text-[11px] font-bold rounded-lg hover:bg-brand/5">Flytt</button>
                      <button className="px-3 py-1.5 bg-white border border-hi/20 text-hi text-[11px] font-bold rounded-lg hover:bg-hi-light">Slett</button>
                    </div>
                  )}

                  <div className="space-y-8">
                    <div>
                      <div className="flex items-center gap-3 mb-3 pl-1">
                        <h3 className="text-[10px] uppercase font-bold tracking-[0.2em] text-brand">Bookede økter</h3>
                        <div className="h-[0.5px] flex-1 bg-brand/10" />
                        <span className="text-[10px] text-brand/40 font-bold uppercase">2 bookede</span>
                      </div>
                      <div className="space-y-2">
                        {[
                          { id: '1', date: '12', day: 'Man', mo: 'Mai', time: '09:00', name: 'Kari Nordmann', topic: 'Tilbakemelding på konseptskisse for stue-prosjektet. Fargepalett og materialvalg.', meta: 'INT-2026 · Anne Dahl · 30 min', status: 'booked' },
                          { id: '2', date: '12', day: 'Man', mo: 'Mai', time: '09:40', name: 'Per Hansen', topic: 'Gjennomgang av fargepalett og materialvalg.', meta: 'INT-2026 · Anne Dahl · 30 min', status: 'booked' },
                        ].map((s) => (
                          <div 
                            key={s.id} 
                            onClick={() => {
                              if (selectionMode) {
                                setSelectedSessions(prev => {
                                  const n = new Set(prev);
                                  if (n.has(s.id)) n.delete(s.id);
                                  else n.add(s.id);
                                  return n;
                                });
                              } else {
                                setSessionToView(s);
                                setShowSessionDetail(true);
                              }
                            }}
                            className={`flex items-center gap-4 p-4 bg-white border border-bark/10 rounded-2xl hover:border-brand/30 transition-all cursor-pointer ${selectedSessions.has(s.id) ? 'ring-2 ring-brand ring-offset-2' : ''}`}
                          >
                            {selectionMode && (
                              <div className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-colors ${selectedSessions.has(s.id) ? 'bg-brand border-brand' : 'bg-white border-bark/20'}`}>
                                {selectedSessions.has(s.id) && <Check size={14} className="text-white" />}
                              </div>
                            )}
                            <div className="flex flex-col items-center justify-center min-w-[50px] py-2 bg-brand-light rounded-xl text-brand">
                              <div className="text-[10px] uppercase font-black leading-none mb-0.5">{s.day}</div>
                              <div className="text-xl font-bold leading-none">{s.date}</div>
                              <div className="text-[9px] uppercase font-black mt-0.5">{s.mo}</div>
                            </div>
                            <div className="hidden sm:flex flex-col items-center justify-center min-w-[60px] border-r border-bark/5 pr-4">
                              <span className="text-[9px] uppercase font-bold text-mid opacity-40 mb-1">Tid</span>
                              <span className="text-sm font-bold text-brand">{s.time}</span>
                            </div>
                            <div className="flex-1 min-w-0">
                               <div className="flex items-center justify-between">
                                  <div className="text-sm font-bold text-bark">{s.name}</div>
                                  <div className="sm:hidden text-xs font-bold text-brand">{s.time}</div>
                               </div>
                               <div className="text-[11px] text-mid font-medium mb-1">{s.meta}</div>
                               <div className="text-[11px] font-light text-mid truncate line-clamp-1 max-w-lg italic">"{s.topic}"</div>
                            </div>
                            <button className="p-2 text-mid/20 hover:text-hi hover:bg-hi-light rounded-xl transition-all">
                                <Trash2 size={16} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center gap-3 mb-3 pl-1">
                        <h3 className="text-[10px] uppercase font-bold tracking-[0.2em] text-lo">Avbestilte økter</h3>
                        <div className="h-[0.5px] flex-1 bg-lo/10" />
                        <span className="text-[10px] text-lo/40 font-bold uppercase">1 avbestilt</span>
                      </div>
                      <div className="space-y-2">
                        {[
                          { id: '3', date: '12', day: 'Man', mo: 'Mai', time: '11:00', name: 'Maja Solberg', topic: 'Jeg er syk og kan dessverre ikke møte opp.', meta: 'INT-2026 · Anne Dahl · 30 min', status: 'cancelled' },
                        ].map((s) => (
                          <div key={s.id} className="flex items-center gap-4 p-4 bg-lo-light/30 border border-lo/10 border-l-4 border-l-lo rounded-2xl opacity-80">
                            <div className="flex flex-col items-center justify-center min-w-[50px] py-2 bg-lo-light rounded-xl text-lo">
                              <div className="text-[10px] uppercase font-black leading-none mb-0.5">{s.day}</div>
                              <div className="text-xl font-bold leading-none">{s.date}</div>
                              <div className="text-[9px] uppercase font-black mt-0.5">{s.mo}</div>
                            </div>
                            <div className="flex-1 min-w-0">
                               <div className="text-sm font-bold text-bark opacity-80">{s.name}</div>
                               <div className="text-[11px] text-lo font-medium mt-1">Avbestilt: {s.topic}</div>
                            </div>
                            <button className="p-2 text-mid/20 hover:text-hi hover:bg-hi-light rounded-xl transition-all">
                                <Trash2 size={16} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
               </motion.div>
             )}

             {activeTab === 'content' && activeProduct === 'paamelding' && (
               <motion.div key="paamelding-content" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">
                  {/* Active Forms */}
                  <div>
                    <div className="flex items-center gap-3 mb-3 pl-1">
                      <h3 className="text-[10px] uppercase font-bold tracking-[0.2em] text-mid">Aktive skjemaer</h3>
                      <div className="h-[0.5px] flex-1 bg-bark/10" />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {[
                        { title: 'Workshop: Fargelære', date: '20. mai', count: 12, max: 20, icon: 'WS', status: 'active' },
                        { title: 'Ekskursjon: Oslo sentrum', date: '1. jun', count: 7, max: 30, icon: 'EK', status: 'active' },
                      ].map((reg, i) => (
                        <div key={i} className="bg-white border border-bark/10 rounded-3xl p-6 shadow-sm hover:border-brand/30 transition-all cursor-pointer group">
                           <div className="flex items-center gap-4 mb-4">
                              <div className="w-12 h-12 rounded-2xl bg-brand-light flex items-center justify-center text-brand font-bold text-lg">
                                 {reg.icon}
                              </div>
                              <div className="flex-1 min-w-0">
                                 <h4 className="font-bold text-sm truncate">{reg.title}</h4>
                                 <p className="text-[11px] text-mid font-medium">Frist: {reg.date}</p>
                              </div>
                              <div className="text-right">
                                 <div className="text-lg font-bold text-brand">{reg.count}</div>
                                 <div className="text-[9px] uppercase font-bold text-bark/20">Påmeldte</div>
                              </div>
                           </div>
                           <div className="h-2 w-full bg-bark/5 rounded-full overflow-hidden mb-2">
                              <div className="h-full bg-brand rounded-full transition-all" style={{ width: `${(reg.count / reg.max) * 100}%` }} />
                           </div>
                           <div className="flex justify-between text-[11px] font-bold uppercase tracking-widest text-mid opacity-80">
                              <span>0</span>
                              <span>{reg.max} plasser</span>
                           </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Archived Forms */}
                  <div className="opacity-60">
                    <div className="flex items-center gap-3 mb-3 pl-1">
                      <h3 className="text-[10px] uppercase font-bold tracking-[0.2em] text-mid">Avsluttede skjemaer</h3>
                      <div className="h-[0.5px] flex-1 bg-bark/10" />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {[
                        { title: 'Høstseminar 2024', date: 'Avsluttet', count: 18, max: 18, icon: 'H2', status: 'closed' },
                      ].map((reg, i) => (
                        <div key={i} className="bg-white/50 border border-bark/5 rounded-3xl p-6 shadow-sm grayscale opacity-70">
                           <div className="flex items-center gap-4 mb-4">
                              <div className="w-12 h-12 rounded-2xl bg-bark/10 flex items-center justify-center text-mid font-bold text-lg">
                                 {reg.icon}
                              </div>
                              <div className="flex-1">
                                 <h4 className="font-bold text-sm">{reg.title}</h4>
                                 <p className="text-[11px] text-mid opacity-60">{reg.date}</p>
                              </div>
                              <div className="text-right">
                                 <div className="text-lg font-bold text-mid">{reg.count}</div>
                                 <div className="text-[9px] uppercase font-bold text-bark/20">Deltakere</div>
                              </div>
                           </div>
                        </div>
                      ))}
                    </div>
                  </div>
               </motion.div>
             )}

             {activeTab === 'approval' && activeProduct === 'booking' && (
               <motion.div key="booking-opprett" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">
                  <div className="bg-white border border-bark/10 rounded-3xl p-8 shadow-sm">
                    <h3 className="text-lg serif mb-6">Opprett veiledningsøkter</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                       <div className="space-y-6">
                          <div className="space-y-2">
                             <label className="text-[10px] uppercase font-bold tracking-widest text-mid">Veileder</label>
                             <select className="w-full p-4 bg-cream/50 border border-bark/10 rounded-2xl outline-none focus:border-brand/40 text-sm">
                                <option>Anne Dahl</option>
                                <option>Lars Heggen</option>
                             </select>
                          </div>
                          <div className="space-y-2">
                             <label className="text-[10px] uppercase font-bold tracking-widest text-mid">Varighet per økt</label>
                             <select className="w-full p-4 bg-cream/50 border border-bark/10 rounded-2xl outline-none focus:border-brand/40 text-sm">
                                <option>15 min</option>
                                <option>20 min</option>
                                <option selected>30 min</option>
                                <option>45 min</option>
                                <option>60 min</option>
                             </select>
                          </div>
                          <div className="space-y-2">
                             <label className="text-[10px] uppercase font-bold tracking-widest text-mid">Pause mellom øktene</label>
                             <select className="w-full p-4 bg-cream/50 border border-bark/10 rounded-2xl outline-none focus:border-brand/40 text-sm">
                                <option>Ingen pause</option>
                                <option>5 min</option>
                                <option selected>10 min</option>
                                <option>15 min</option>
                             </select>
                          </div>
                       </div>
                       <div className="space-y-6">
                          <div className="space-y-2">
                             <label className="text-[10px] uppercase font-bold tracking-widest text-mid">Dato</label>
                             <input type="date" className="w-full p-4 bg-cream/50 border border-bark/10 rounded-2xl outline-none focus:border-brand/40 text-sm" value="2025-05-12" />
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                             <div className="space-y-2">
                                <label className="text-[10px] uppercase font-bold tracking-widest text-mid">Starttid</label>
                                <input type="text" value="09:00" className="w-full p-4 bg-cream/50 border border-bark/10 rounded-2xl outline-none focus:border-brand/40 text-sm" />
                             </div>
                             <div className="space-y-2">
                                <label className="text-[10px] uppercase font-bold tracking-widest text-mid">Sluttid</label>
                                <input type="text" value="15:30" className="w-full p-4 bg-cream/50 border border-bark/10 rounded-2xl outline-none focus:border-brand/40 text-sm" />
                             </div>
                          </div>
                          <div className="p-6 bg-brand/5 border border-brand/10 rounded-2xl">
                             <h4 className="text-[10px] uppercase font-bold text-brand tracking-widest mb-3">Forhåndsvisning</h4>
                             <div className="flex flex-wrap gap-2">
                                {['09:00', '09:40', '10:20', '11:00', '11:40', '12:20'].map(t => (
                                  <span key={t} className="px-3 py-1 bg-white border border-brand/10 text-brand text-[10px] font-bold rounded-lg">{t}</span>
                                ))}
                                <span className="px-3 py-1 bg-lo-light text-lo text-[10px] font-bold rounded-lg">...</span>
                             </div>
                             <p className="text-[10px] text-mid mt-3 italic">Totalt 11 veiledningsøkter vil bli opprettet.</p>
                          </div>
                       </div>
                    </div>
                    <button className="w-full mt-8 py-4 bg-brand text-white font-bold rounded-2xl shadow-xl shadow-brand/30 hover:scale-[1.01] transition-all">Opprett veiledninger</button>
                  </div>
               </motion.div>
             )}
             {activeTab === 'approval' && activeProduct === 'chat' && (
               <motion.div key="approval" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6 pb-12">
                  <div className="flex items-center justify-between mb-4">
                     <div className="flex items-center gap-2">
                        <div className="px-3 py-1 bg-hi-light text-hi text-[10px] font-bold uppercase tracking-wider rounded-full">Høy prioritet</div>
                        <span className="text-[11px] text-mid font-medium">— bør godkjennes snart</span>
                     </div>
                     <div className="text-[10px] font-bold text-mid uppercase tracking-widest">{pendingInteractions.length} venter</div>
                  </div>
                  
                  {pendingInteractions.length === 0 && (
                    <div className="py-20 text-center bg-white/40 border border-dashed border-bark/10 rounded-3xl">
                       <CheckCircle2 size={40} className="mx-auto text-ok opacity-20 mb-4" />
                       <p className="text-sm text-mid italic">Alt er ajour! Ingen ventende spørsmål.</p>
                    </div>
                  )}

                  {pendingInteractions.map(interaction => (
                    <div key={interaction.id} className="bg-white border-l-4 border-l-hi border-y border-r border-bark/10 rounded-2xl overflow-hidden shadow-md">
                       <div className="p-6">
                          <div className="flex justify-between items-start gap-4 mb-4">
                             <div className="flex-1">
                                <div className="text-[10px] font-bold text-brand uppercase tracking-widest mb-1">{interaction.participantName} til {interaction.clientName}</div>
                                <div className="text-sm font-bold text-bark leading-relaxed">{interaction.question}</div>
                             </div>
                             <div className="text-[10px] text-mid font-bold uppercase tracking-widest whitespace-nowrap bg-bark/5 px-2 py-1 rounded">
                                {interaction.createdAt?.toDate?.().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) || 'Nå'}
                             </div>
                          </div>
                          
                          <div className="relative group">
                            <textarea 
                              value={aiDrafts[interaction.id] || ''}
                              onChange={(e) => setAiDrafts(prev => ({ ...prev, [interaction.id]: e.target.value }))}
                              placeholder="Skriv svar her eller generer med AI..."
                              className="w-full p-4 bg-cream/50 border border-bark/5 rounded-xl text-sm font-light text-mid leading-relaxed mb-6 min-h-[100px] outline-none focus:border-brand/30 transition-all"
                            />
                            <button 
                              onClick={() => generateAiAnswer(interaction)}
                              className="absolute right-3 bottom-9 px-3 py-1.5 bg-brand-light text-brand text-[10px] font-bold rounded-lg hover:bg-brand hover:text-white transition-all shadow-sm flex items-center gap-1.5"
                            >
                               <Database size={12} /> Hent AI-utkast
                            </button>
                          </div>

                          <div className="flex flex-wrap gap-2">
                             <button 
                               onClick={() => approveInteraction(interaction, aiDrafts[interaction.id] || '')}
                               className="flex-1 min-w-[120px] py-3 bg-brand text-white text-xs font-bold rounded-xl shadow-lg shadow-brand/20 hover:opacity-90 transition-all disabled:opacity-50"
                               disabled={!aiDrafts[interaction.id]}
                             >
                                Godkjenn og send
                             </button>
                             <button className="px-5 py-3 border border-bark/10 text-mid text-xs font-medium rounded-xl hover:bg-hi-light hover:text-hi hover:border-hi/20 transition-all">
                                Avvis
                             </button>
                          </div>
                       </div>
                    </div>
                  ))}

                  {approvedInteractions.length > 0 && (
                    <div className="pt-8 opacity-60">
                      <div className="text-[10px] uppercase font-bold tracking-widest text-mid mb-4 pb-2 border-b border-bark/10">Nylig godkjent</div>
                      {approvedInteractions.slice(0, 5).map(interaction => (
                        <div key={interaction.id} className="bg-white/50 border border-bark/10 rounded-2xl p-5 mb-3 flex gap-4 items-start">
                           <div className="p-1.5 bg-ok-light text-ok rounded-full shrink-0">
                             <CheckCircle2 size={16} />
                           </div>
                           <div>
                              <div className="text-[10px] font-bold text-mid uppercase tracking-widest mb-1">{interaction.participantName}</div>
                              <div className="text-xs font-bold mb-1">{interaction.question}</div>
                              <div className="text-xs text-mid font-light leading-relaxed italic border-l-2 border-brand/20 pl-3 mt-2">"{interaction.answer}"</div>
                           </div>
                        </div>
                      ))}
                    </div>
                  )}
               </motion.div>
             )}

             {activeTab === 'stats' && (
               <motion.div key="stats" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-8">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                     <div className="bg-white p-5 rounded-2xl border border-bark/5 shadow-sm">
                        <div className="text-[10px] uppercase font-bold tracking-widest text-mid mb-2">Totalt spørsmål</div>
                        <div className="text-3xl font-bold text-brand leading-none">87</div>
                     </div>
                     <div className="bg-white p-5 rounded-2xl border border-bark/5 shadow-sm">
                        <div className="text-[10px] uppercase font-bold tracking-widest text-mid mb-2">Aktive deltakere</div>
                        <div className="text-3xl font-bold text-brand leading-none">18</div>
                     </div>
                     <div className="bg-white p-5 rounded-2xl border border-bark/5 shadow-sm ring-1 ring-hi/10">
                        <div className="text-[10px] uppercase font-bold tracking-widest text-hi mb-2">Venter godkjenning</div>
                        <div className="text-3xl font-bold text-hi leading-none">3</div>
                     </div>
                     <div className="bg-white p-5 rounded-2xl border border-bark/5 shadow-sm">
                        <div className="text-[10px] uppercase font-bold tracking-widest text-mid mb-2">Spørsmål / deltaker</div>
                        <div className="text-3xl font-bold text-brand leading-none">4.8</div>
                     </div>
                  </div>

                  <div className="bg-white p-8 rounded-3xl border border-bark/10 shadow-sm">
                     <h4 className="text-sm font-bold mb-6 flex items-center gap-2">
                        <BarChart3 size={18} className="text-brand" />
                        Engagement per kategori
                     </h4>
                     <div className="space-y-6">
                        {[
                          { label: 'Livsstil', val: 31, color: 'bg-brand' },
                          { label: 'Materialer', val: 24, color: 'bg-brand/80' },
                          { label: 'Fargevalg', val: 18, color: 'bg-brand/60' },
                          { label: 'Budsjett', val: 14, color: 'bg-brand/40' },
                        ].map((stat, i) => (
                           <div key={i} className="space-y-2">
                              <div className="flex justify-between text-xs font-medium">
                                 <span>{stat.label}</span>
                                 <span className="text-brand">{stat.val}</span>
                              </div>
                              <div className="h-2 w-full bg-bark/5 rounded-full overflow-hidden">
                                 <motion.div 
                                   initial={{ width: 0 }}
                                   animate={{ width: `${(stat.val / 31) * 100}%` }}
                                   transition={{ duration: 1, delay: i * 0.1 }}
                                   className={`h-full ${stat.color} rounded-full`} 
                                 />
                              </div>
                           </div>
                        ))}
                     </div>
                  </div>
               </motion.div>
             )}
           </AnimatePresence>

        {/* Global Floating Summary Pattern */}
        <div className="fixed bottom-6 right-6 hidden lg:flex flex-col gap-3">
           <div className="bg-brand text-white p-4 rounded-2xl shadow-2xl shadow-brand/40 w-56 transform hover:-translate-y-1 transition-transform">
              <div className="flex items-center gap-3 mb-2">
                 <div className="p-1.5 bg-white/20 rounded-lg">
                    <BarChart3 size={18} />
                 </div>
                 <div className="text-[10px] font-bold tracking-widest uppercase opacity-70">Total oversikt</div>
              </div>
              <div className="flex justify-between items-end">
                 <div className="text-3xl serif font-light">18</div>
                 <div className="text-[11px] font-medium opacity-70 pb-1">Deltakere i dag</div>
              </div>
           </div>
        </div>
      </main>

      {/* Modals from veileder.html */}
        <AnimatePresence>
          {/* Groups Modal */}
          {showGroupsModal && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-bark/40 backdrop-blur-sm">
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="w-full max-w-md bg-white rounded-3xl p-6 sm:p-8 shadow-2xl"
              >
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl serif">Alle <em className="text-brand italic">grupper</em></h2>
                  <button onClick={() => setShowGroupsModal(false)} className="p-2 text-mid hover:bg-bark/5 rounded-xl"><X size={20} /></button>
                </div>
                <p className="text-xs text-mid mb-6 opacity-60">Klikk på en gruppe for å bytte, eller åpne for å administrere.</p>
                
                <div className="space-y-2 mb-6 max-h-[40vh] overflow-y-auto pr-2 scrollbar-hide">
                  {groups.filter(g => !g.deleted).map(g => (
                    <div 
                      key={g.id} 
                      onClick={() => { setSelectedGroupId(g.id); setShowGroupsModal(false); }}
                      className={`flex items-center gap-4 p-4 rounded-2xl border transition-all cursor-pointer ${selectedGroupId === g.id ? 'bg-brand/5 border-brand/20 ring-1 ring-brand/10' : 'bg-white border-bark/10 hover:border-brand/40'}`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-sm tracking-tight">{g.name}</div>
                        <div className="text-[10px] text-mid opacity-60 uppercase font-black tracking-widest">{g.code}</div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button 
                          onClick={(e) => { e.stopPropagation(); setShowGroupsModal(false); setShowCodeModal(true); setSelectedGroupId(g.id); }}
                          className="p-2 text-mid hover:text-brand hover:bg-brand/10 rounded-xl transition-all"
                        >
                          <Share size={16} />
                        </button>
                        <button 
                          onClick={(e) => { e.stopPropagation(); deleteGroup(g.id); }}
                          className="p-2 text-mid hover:text-hi hover:bg-hi-light rounded-xl transition-all"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex gap-3">
                  <button 
                    onClick={() => setShowGroupsModal(false)}
                    className="flex-1 py-4 text-xs font-bold text-mid hover:text-bark transition-colors"
                  >
                    Lukk
                  </button>
                  <button 
                    onClick={() => { setShowGroupsModal(false); setShowSectionModal(true); setSelectedSection(null); }}
                    className="flex-[2] py-4 bg-brand text-white text-xs font-bold rounded-2xl shadow-lg shadow-brand/20"
                  >
                    + Ny gruppe
                  </button>
                </div>
              </motion.div>
            </div>
          )}

          {/* Invitation Code Modal */}
          {showCodeModal && selectedGroupId && (
            <div className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-bark/40 backdrop-blur-sm">
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="w-full max-w-sm bg-white rounded-3xl p-8 shadow-2xl text-center"
              >
                <h2 className="text-xl serif mb-2">Del <em className="text-brand italic">prosjektkode</em></h2>
                <p className="text-xs text-mid mb-6 opacity-60">Send denne koden til deltakerne.</p>
                
                <div className="bg-brand/5 border border-brand/20 rounded-3xl p-8 mb-6">
                  <div className="text-[10px] font-bold text-brand uppercase tracking-widest mb-2">
                    {groups.find(g => g.id === selectedGroupId)?.name}
                  </div>
                  <div className="text-4xl serif font-bold tracking-widest text-bark mb-1">
                    {groups.find(g => g.id === selectedGroupId)?.code}
                  </div>
                  <div className="text-[10px] text-mid">Bruk denne ved pålogging</div>
                </div>

                <div className="flex gap-3">
                  <button 
                    onClick={() => setShowCodeModal(false)}
                    className="flex-1 py-4 text-xs font-bold text-mid"
                  >
                    Lukk
                  </button>
                  <button 
                    onClick={() => copyCode(groups.find(g => g.id === selectedGroupId)?.code)}
                    className="flex-[2] py-4 bg-brand text-white text-xs font-bold rounded-2xl shadow-lg shadow-brand/20 flex items-center justify-center gap-2"
                  >
                    <Copy size={16} /> Kopier kode
                  </button>
                </div>
              </motion.div>
            </div>
          )}

          {/* Session Detail Modal */}
          {showSessionDetail && sessionToView && (
            <div className="fixed inset-0 z-[120] flex items-center justify-center p-6 bg-bark/40 backdrop-blur-sm">
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="w-full max-w-md bg-white rounded-3xl p-8 shadow-2xl"
              >
                <div className="flex items-center gap-4 mb-6">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-lg ${sessionToView.status === 'booked' ? 'bg-brand text-white' : 'bg-lo-light text-lo'}`}>
                    {sessionToView.status === 'booked' ? <Calendar size={24} /> : <X size={24} />}
                  </div>
                  <div>
                    <h3 className="text-xl serif leading-tight">{sessionToView.name}</h3>
                    <p className="text-xs text-mid opacity-60 uppercase font-bold tracking-widest">{sessionToView.meta}</p>
                  </div>
                </div>
                
                <div className="bg-cream/50 border border-bark/5 rounded-2xl p-6 mb-6">
                  <h4 className="text-[10px] uppercase font-bold text-mid tracking-widest mb-2">Tema / Melding</h4>
                  <p className="text-sm font-light text-bark leading-relaxed">
                    {sessionToView.topic}
                  </p>
                </div>

                <div className="flex gap-3">
                  <button 
                    onClick={() => setShowSessionDetail(false)}
                    className="flex-1 py-4 text-xs font-bold text-mid"
                  >
                    Lukk
                  </button>
                  {sessionToView.status === 'booked' ? (
                    <button className="flex-[2] py-4 bg-hi text-white text-xs font-bold rounded-2xl shadow-lg shadow-hi/20">
                      Avbryt økt
                    </button>
                  ) : (
                    <button className="flex-[2] py-4 bg-brand text-white text-xs font-bold rounded-2xl shadow-lg shadow-brand/20">
                      Kontakt deltaker
                    </button>
                  )}
                </div>
              </motion.div>
            </div>
          )}

          {/* New Group/Section Modal */}
          {showSectionModal && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-bark/40 backdrop-blur-sm">
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="w-full max-w-md bg-white rounded-3xl p-8 shadow-2xl"
              >
                <h2 className="text-2xl serif mb-2">{selectedSection ? 'Rediger' : 'Ny'} <em className="text-brand italic">gruppe</em></h2>
                <p className="text-xs text-mid mb-6 opacity-60">En gruppe er en samling deltakere som jobber mot samme kunder.</p>
                
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase font-bold tracking-widest text-mid">Navn</label>
                    <input 
                      type="text" 
                      value={newGroupName}
                      onChange={(e) => setNewGroupName(e.target.value)}
                      placeholder="Eks: Interiør vår 2024"
                      className="w-full p-4 bg-cream/50 border border-bark/10 rounded-2xl outline-none focus:border-brand/40"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase font-bold tracking-widest text-mid">Gruppekode</label>
                    <input 
                      type="text" 
                      value={newGroupCode}
                      onChange={(e) => setNewGroupCode(e.target.value)}
                      placeholder="Eks: INT24"
                      className="w-full p-4 bg-cream/50 border border-bark/10 rounded-2xl outline-none focus:border-brand/40 uppercase"
                    />
                  </div>

                  <div className="flex gap-3 pt-4">
                    <button 
                      onClick={() => setShowSectionModal(false)}
                      className="flex-1 py-4 text-xs font-bold text-mid hover:text-bark transition-colors"
                    >
                      Avbryt
                    </button>
                    <button 
                      onClick={createGroup}
                      disabled={!newGroupName.trim() || !newGroupCode.trim()}
                      className="flex-[2] py-4 bg-brand text-white text-xs font-bold rounded-2xl shadow-lg shadow-brand/20 disabled:opacity-50"
                    >
                      Lagre
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}

        {showCreateClient && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-bark/40 backdrop-blur-sm overflow-y-auto">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-2xl bg-white rounded-3xl p-6 sm:p-8 shadow-2xl relative my-auto"
            >
              <button 
                onClick={() => setShowCreateClient(false)}
                className="absolute top-6 right-6 p-2 text-mid hover:bg-bark/5 rounded-xl transition-all"
              >
                <Plus size={20} className="rotate-45" />
              </button>

              <h2 className="text-2xl serif mb-2">Legg til ny kunde</h2>
              <p className="text-xs text-mid mb-8 opacity-60">Oppgi detaljer om kunden som deltakerne skal interagere med.</p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-h-[60vh] overflow-y-auto pr-2 scrollbar-hide">
                <div className="space-y-4">
                  <h3 className="text-[10px] font-bold uppercase tracking-widest text-brand mb-2">Personalia</h3>
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase font-bold tracking-widest text-mid">Kundens navn</label>
                    <input 
                      type="text" 
                      value={newClientName}
                      onChange={(e) => setNewClientName(e.target.value)}
                      placeholder="Eks: Lene Bakke"
                      className="w-full p-4 bg-cream/50 border border-bark/10 rounded-2xl outline-none focus:border-brand/40 text-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase font-bold tracking-widest text-mid">Type</label>
                    <select 
                      value={newClientType}
                      onChange={(e: any) => setNewClientType(e.target.value)}
                      className="w-full p-4 bg-cream/50 border border-bark/10 rounded-2xl outline-none focus:border-brand/40 text-sm"
                    >
                      <option value="Privatkunde">Privatkunde</option>
                      <option value="Bedriftskunde">Bedriftskunde</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase font-bold tracking-widest text-mid">Kort info/meta</label>
                    <input 
                      type="text" 
                      value={newClientMeta}
                      onChange={(e) => setNewClientMeta(e.target.value)}
                      placeholder="Eks: Privatkunde · Moderne stil"
                      className="w-full p-4 bg-cream/50 border border-bark/10 rounded-2xl outline-none focus:border-brand/40 text-sm"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] uppercase font-bold tracking-widest text-mid">Status</label>
                      <input 
                        type="text" 
                        value={newClientStatus}
                        onChange={(e) => setNewClientStatus(e.target.value)}
                        className="w-full p-4 bg-cream/50 border border-bark/10 rounded-2xl outline-none focus:border-brand/40 text-sm"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] uppercase font-bold tracking-widest text-mid">Deadline</label>
                      <input 
                        type="text" 
                        value={newClientDeadline}
                        onChange={(e) => setNewClientDeadline(e.target.value)}
                        placeholder="Eks: 14 dager"
                        className="w-full p-4 bg-cream/50 border border-bark/10 rounded-2xl outline-none focus:border-brand/40 text-sm"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase font-bold tracking-widest text-mid">Bolig / Lokasjon</label>
                    <input 
                      type="text" 
                      value={newClientBolig}
                      onChange={(e) => setNewClientBolig(e.target.value)}
                      placeholder="Eks: 72 m² leilighet, Majorstua"
                      className="w-full p-4 bg-cream/50 border border-bark/10 rounded-2xl outline-none focus:border-brand/40 text-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase font-bold tracking-widest text-mid">Livssituasjon</label>
                    <input 
                      type="text" 
                      value={newClientLivs}
                      onChange={(e) => setNewClientLivs(e.target.value)}
                      placeholder="Eks: Enslig, barnelege, jobber mye"
                      className="w-full p-4 bg-cream/50 border border-bark/10 rounded-2xl outline-none focus:border-brand/40 text-sm"
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-[10px] font-bold uppercase tracking-widest text-brand mb-2">Stil & Preferanser</h3>
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase font-bold tracking-widest text-mid">Primær stil</label>
                    <input 
                      type="text" 
                      value={newClientStyle}
                      onChange={(e) => setNewClientStyle(e.target.value)}
                      placeholder="Eks: Skandinavisk"
                      className="w-full p-4 bg-cream/50 border border-bark/10 rounded-2xl outline-none focus:border-brand/40 text-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase font-bold tracking-widest text-mid">Budsjett</label>
                    <input 
                      type="text" 
                      value={newClientBudsjett}
                      onChange={(e) => setNewClientBudsjett(e.target.value)}
                      placeholder="Eks: Middels til høyt"
                      className="w-full p-4 bg-cream/50 border border-bark/10 rounded-2xl outline-none focus:border-brand/40 text-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase font-bold tracking-widest text-mid">Prioriteringer</label>
                    <textarea 
                      value={newClientPri}
                      onChange={(e) => setNewClientPri(e.target.value)}
                      placeholder="Hva er viktigst for kunden?"
                      className="w-full p-4 bg-cream/50 border border-bark/10 rounded-2xl outline-none focus:border-brand/40 text-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase font-bold tracking-widest text-mid">Ønsker ikke</label>
                    <textarea 
                      value={newClientNei}
                      onChange={(e) => setNewClientNei(e.target.value)}
                      placeholder="Hva skal vi unngå?"
                      className="w-full p-4 bg-cream/50 border border-bark/10 rounded-2xl outline-none focus:border-brand/40 text-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase font-bold tracking-widest text-mid">Tekniske krav (én per linje)</label>
                    <textarea 
                      value={newClientKrav}
                      onChange={(e) => setNewClientKrav(e.target.value)}
                      placeholder="Eks: Bærekraftige valg"
                      className="w-full p-4 bg-cream/50 border border-bark/10 rounded-2xl outline-none focus:border-brand/40 text-sm h-24"
                    />
                  </div>
                </div>

                <div className="space-y-4 md:col-span-2">
                  <h3 className="text-[10px] font-bold uppercase tracking-widest text-brand mb-2">Beskrivelse & AI Kontekst</h3>
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase font-bold tracking-widest text-mid">Kort beskrivelse (for rapport)</label>
                    <textarea 
                      value={newClientBesk}
                      onChange={(e) => setNewClientBesk(e.target.value)}
                      placeholder="Oppsummering av kunden..."
                      className="w-full p-4 bg-cream/50 border border-bark/10 rounded-2xl outline-none focus:border-brand/40 text-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase font-bold tracking-widest text-mid">Ekstra kontekst til AI</label>
                    <textarea 
                      value={newClientExt}
                      onChange={(e) => setNewClientExt(e.target.value)}
                      placeholder="Tilleggsinformasjon som AI kan bruke for å personifisere kunden..."
                      className="w-full p-4 bg-cream/50 border border-bark/10 rounded-2xl outline-none focus:border-brand/40 text-sm"
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-8">
                <button 
                  onClick={() => setShowCreateClient(false)}
                  className="flex-1 py-4 text-xs font-bold text-mid hover:text-bark transition-colors"
                >
                  Avbryt
                </button>
                <button 
                  onClick={createClient}
                  disabled={!newClientName.trim()}
                  className="flex-[2] py-4 bg-brand text-white text-xs font-bold rounded-2xl shadow-lg shadow-brand/20 disabled:opacity-50"
                >
                  Lagre kunde
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {selectedClient && (
          <div className="fixed inset-0 z-[100] flex items-center justify-end bg-bark/40 backdrop-blur-sm p-4 sm:p-6">
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="w-full max-w-4xl h-full bg-cream rounded-3xl shadow-2xl overflow-hidden flex flex-col"
            >
              <div className="p-6 bg-white border-b border-bark/10 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-brand text-white flex items-center justify-center font-bold text-lg shadow-lg shadow-brand/20">
                    {(selectedClient.name || 'AN').split(' ').map((w: any) => w[0]).join('').slice(0,2)}
                  </div>
                  <div>
                    <h3 className="text-xl serif leading-tight">{selectedClient.name}</h3>
                    <p className="text-xs text-mid opacity-60 uppercase font-bold tracking-widest">{selectedClient.meta}</p>
                  </div>
                </div>
                <div className="flex bg-bark/5 p-1 rounded-xl gap-1 border border-bark/10">
                  <button 
                    onClick={() => setClientTab('preview')}
                    className={`px-4 py-2 text-[10px] font-bold rounded-lg transition-all ${clientTab === 'preview' ? 'bg-white text-brand shadow-sm' : 'text-mid hover:text-bark'}`}
                  >
                    Visning
                  </button>
                  <button 
                    onClick={() => setClientTab('approval')}
                    className={`px-4 py-2 text-[10px] font-bold rounded-lg transition-all ${clientTab === 'approval' ? 'bg-white text-brand shadow-sm' : 'text-mid hover:text-bark'}`}
                  >
                    Godkjenning
                  </button>
                  <button 
                    onClick={() => setClientTab('report')}
                    className={`px-4 py-2 text-[10px] font-bold rounded-lg transition-all ${clientTab === 'report' ? 'bg-white text-brand shadow-sm' : 'text-mid hover:text-bark'}`}
                  >
                    Rapport
                  </button>
                  <button 
                    onClick={() => setClientTab('edit')}
                    className={`px-4 py-2 text-[10px] font-bold rounded-lg transition-all ${clientTab === 'edit' ? 'bg-white text-brand shadow-sm' : 'text-mid hover:text-bark'}`}
                  >
                    Rediger
                  </button>
                </div>
                <button 
                  onClick={() => setSelectedClient(null)}
                  className="p-3 text-mid hover:bg-bark/5 rounded-2xl transition-all ml-4"
                >
                  Lukk
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 scrollbar-hide">
                <AnimatePresence mode="wait">
                  {clientTab === 'preview' && (
                    <motion.div key="client-preview" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }} className="space-y-8 pb-12">
                      <div className="relative h-64 rounded-3xl overflow-hidden shadow-xl">
                        <img 
                          src={selectedClient.imageUrl || "https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&q=80&w=1200"} 
                          className="w-full h-full object-cover" 
                          alt="Preview" 
                          referrerPolicy="no-referrer"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-bark/80 to-transparent flex items-end p-8">
                           <div className="flex items-center gap-4">
                              <div className="w-14 h-14 rounded-2xl bg-brand text-white flex items-center justify-center font-bold text-2xl shadow-2xl ring-4 ring-white/20 uppercase">
                                 {(selectedClient.name || 'AN').split(' ').map((w: any) => w[0]).join('').slice(0,2)}
                              </div>
                              <div>
                                 <h2 className="text-3xl serif text-white mb-1">{selectedClient.name}</h2>
                                 <p className="text-xs font-bold text-white/70 uppercase tracking-widest">{selectedClient.meta}</p>
                              </div>
                           </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="p-5 bg-white rounded-3xl border border-bark/5 shadow-sm">
                           <div className="text-[11px] font-bold uppercase tracking-widest text-mid mb-2">Stil</div>
                           <div className="font-bold text-brand">{selectedClient.style || '—'}</div>
                        </div>
                        <div className="p-5 bg-white rounded-3xl border border-bark/5 shadow-sm">
                           <div className="text-[11px] font-bold uppercase tracking-widest text-mid mb-2">Status</div>
                           <div className="font-bold text-ok flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full bg-ok animate-pulse" /> {selectedClient.status || 'Aktiv'}
                           </div>
                        </div>
                        <div className="p-5 bg-white rounded-3xl border border-bark/5 shadow-sm">
                           <div className="text-[11px] font-bold uppercase tracking-widest text-mid mb-2">Frist</div>
                           <div className="font-bold text-bark">{selectedClient.deadline || 'Ingen'}</div>
                        </div>
                      </div>

                      <div className="space-y-4">
                         <h3 className="text-sm font-bold flex items-center gap-2">
                           <ClipboardCheck size={18} className="text-brand" />
                           Prosjektbeskrivelse
                         </h3>
                         <div className="p-6 bg-white/60 border border-bark/5 rounded-3xl italic text-sm text-mid leading-relaxed font-light shadow-sm">
                            {selectedClient.beskrivelse || 'Ingen beskrivelse tilgjengelig.'}
                         </div>
                      </div>

                      <div className="space-y-4">
                        <h3 className="text-sm font-bold flex items-center gap-2">
                          <Settings size={18} className="text-brand" />
                          Tekniske krav
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                           {(selectedClient.technicalRequirements || ['Bærekraftige valg', 'Lyssplan', 'Akustikk']).map((krav: string, i: number) => (
                             <div key={i} className="flex items-center gap-3 p-4 bg-white border border-bark/5 rounded-2xl text-xs font-medium shadow-sm group hover:border-brand/30 transition-all">
                               <Check size={16} className="text-ok" />
                               {krav}
                             </div>
                           ))}
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {clientTab === 'approval' && (
                    <motion.div key="client-approval" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-6">
                       <h4 className="text-[10px] uppercase font-bold tracking-widest text-mid mb-4">Venter på svar</h4>
                       <div className="space-y-4">
                          {pendingInteractions.filter(i => i.clientId === selectedClient.id).length === 0 && (
                            <div className="py-20 text-center bg-white/40 border border-dashed border-bark/10 rounded-3xl">
                               <CheckCircle2 size={40} className="mx-auto text-ok opacity-20 mb-4" />
                               <p className="text-sm text-mid italic">Ingen ventende spørsmål for denne kunden.</p>
                            </div>
                          )}
                          {pendingInteractions.filter(i => i.clientId === selectedClient.id).map(interaction => (
                            <div key={interaction.id} className="bg-white border border-bark/10 rounded-2xl shadow-sm overflow-hidden">
                               <div className="p-6">
                                  <div className="flex justify-between items-start gap-4 mb-4">
                                     <div className="flex-1">
                                        <div className="text-[10px] font-bold text-brand uppercase tracking-widest mb-1">{interaction.participantName}</div>
                                        <div className="text-sm font-bold text-bark leading-relaxed">{interaction.question}</div>
                                     </div>
                                  </div>
                                  
                                  <div className="relative group">
                                    <textarea 
                                      value={aiDrafts[interaction.id] || ''}
                                      onChange={(e) => setAiDrafts(prev => ({ ...prev, [interaction.id]: e.target.value }))}
                                      placeholder="Skriv svar her..."
                                      className="w-full p-4 bg-cream border border-bark/5 rounded-xl text-sm font-light text-mid mb-4 min-h-[100px] outline-none focus:border-brand/30 transition-all shadow-inner"
                                    />
                                    <button 
                                      onClick={() => generateAiAnswer(interaction)}
                                      className="absolute right-3 bottom-7 px-3 py-1.5 bg-brand-light text-brand text-[10px] font-bold rounded-lg hover:bg-brand hover:text-white transition-all shadow-sm"
                                    >
                                       Hent AI-utkast
                                    </button>
                                  </div>

                                  <div className="flex gap-2">
                                     <button 
                                       onClick={() => approveInteraction(interaction, aiDrafts[interaction.id] || '')}
                                       className="flex-1 py-3 bg-brand text-white text-xs font-bold rounded-xl shadow-lg shadow-brand/20 hover:opacity-90 transition-all disabled:opacity-50"
                                       disabled={!aiDrafts[interaction.id]}
                                     >
                                        Godkjenn og send
                                     </button>
                                     <button className="px-5 py-3 border border-bark/10 text-mid text-xs font-medium rounded-xl hover:bg-hi-light hover:text-hi hover:border-hi/20 transition-all">
                                        Avvis
                                     </button>
                                  </div>
                               </div>
                            </div>
                          ))}
                       </div>

                       {approvedInteractions.filter(i => i.clientId === selectedClient.id).length > 0 && (
                         <div className="pt-8">
                            <h4 className="text-[10px] uppercase font-bold tracking-widest text-mid mb-4">Besvarte spørsmål</h4>
                            <div className="space-y-3">
                               {approvedInteractions.filter(i => i.clientId === selectedClient.id).map(interaction => (
                                 <div key={interaction.id} className="p-5 bg-white border border-bark/10 rounded-2xl shadow-sm">
                                    <div className="flex justify-between items-start mb-2">
                                      <div className="text-[10px] font-bold text-brand uppercase tracking-widest">{interaction.participantName}</div>
                                      <div className="text-[9px] text-mid opacity-40 uppercase font-bold">{interaction.createdAt?.toDate?.().toLocaleDateString() || 'Nå'}</div>
                                    </div>
                                    <div className="text-xs font-bold text-bark mb-3">{interaction.question}</div>
                                    <div className="text-xs text-mid font-light leading-relaxed italic border-l-2 border-brand/20 pl-3">"{interaction.answer}"</div>
                                 </div>
                               ))}
                            </div>
                          </div>
                       )}
                    </motion.div>
                  )}

                  {clientTab === 'report' && (
                    <motion.div key="client-report" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="space-y-8 pb-20">
                       <div className="bg-brand-light p-8 rounded-3xl border border-brand/20 shadow-sm">
                          <div className="flex items-center justify-between mb-6">
                             <div className="flex items-center gap-2 text-brand font-bold text-xs uppercase tracking-[0.2em]">
                                AI-Oppsummering
                             </div>
                             <div className="flex items-center gap-2">
                                {selectedClient.aiSummary && (
                                  <>
                                    <button 
                                      onClick={handlePrintSummary}
                                      className="px-4 py-2 bg-white text-mid border border-bark/10 text-[10px] font-bold rounded-xl hover:bg-bark/5 transition-all flex items-center gap-2"
                                    >
                                      <Printer size={12} />
                                      {lang === 'no' ? 'Skriv ut' : 'Print'}
                                    </button>
                                    <button 
                                      onClick={() => {
                                        if (isEditingSummary) {
                                          saveEditedSummary();
                                        } else {
                                          setEditableSummary(selectedClient.aiSummary);
                                          setIsEditingSummary(true);
                                        }
                                      }}
                                      className="px-4 py-2 bg-white text-brand border border-brand/20 text-[10px] font-bold rounded-xl hover:bg-brand-light transition-all flex items-center gap-2"
                                    >
                                      {isEditingSummary ? <Check size={12} /> : <Edit2 size={12} />}
                                      {isEditingSummary ? (lang === 'no' ? 'Lagre' : 'Save') : (lang === 'no' ? 'Rediger' : 'Edit')}
                                    </button>
                                  </>
                                )}
                                <button 
                                  onClick={generateClientSummary}
                                  disabled={isSummarizing || isEditingSummary}
                                  className="px-6 py-2.5 bg-brand text-white text-[11px] font-bold rounded-xl shadow-lg shadow-brand/20 hover:opacity-90 active:scale-95 transition-all disabled:opacity-50 flex items-center gap-2"
                                >
                                  {isSummarizing ? <RefreshCw size={12} className="animate-spin" /> : null}
                                  {isSummarizing ? 'Oppsummerer...' : (selectedClient.aiSummary ? (lang === 'no' ? 'Oppdater' : 'Update') : (lang === 'no' ? 'Oppsummer' : 'Summarize'))}
                                </button>
                             </div>
                          </div>
                          {selectedClient.aiSummary ? (
                            <div className="relative">
                               {isEditingSummary ? (
                                 <div className="relative">
                                   <textarea
                                      value={editableSummary}
                                      onChange={(e) => setEditableSummary(cleanSummaryText(e.target.value, false))}
                                      className="w-full h-[400px] p-8 bg-white rounded-2xl border-2 border-brand/20 shadow-inner text-sm font-medium text-bark leading-relaxed focus:outline-none focus:border-brand transition-all resize-none scrollbar-hide"
                                      placeholder="Skriv eller rediger oppsummeringen her..."
                                   />
                                   <div className="absolute bottom-4 right-4 text-[9px] font-bold text-mid opacity-40 uppercase tracking-widest bg-brand-light/50 px-2 py-1 rounded">
                                      Regel: Ingen spesialtegn (*, #, _, -) tillatt
                                   </div>
                                 </div>
                               ) : (
                                 <div className="bg-white p-8 rounded-2xl border border-brand/10 shadow-sm relative overflow-hidden">
                                    <div className="absolute top-0 left-0 w-1 h-full bg-brand/30" />
                                    <div className="space-y-6">
                                       {selectedClient.aiSummary.split('\n\n').map((paragraph: string, idx: number) => {
                                          const trimmed = paragraph.trim();
                                          if (!trimmed) return null;
                                          const isHeading = /^\d+\./.test(trimmed) || (trimmed.length < 60 && /^[A-ZÆØÅ]/.test(trimmed) && !trimmed.endsWith('.') && !trimmed.includes(','));
                                          return (
                                             <div key={idx} className={`${isHeading ? 'pt-4' : ''}`}>
                                                {isHeading ? (
                                                   <h5 className="text-[12px] font-black uppercase tracking-[0.15em] text-brand mb-4 pb-2 border-b border-brand/20 flex items-center gap-2">
                                                      <span className="w-1.5 h-1.5 rounded-full bg-brand/40" />
                                                      {trimmed}
                                                   </h5>
                                                ) : (
                                                   <p className="text-[13px] font-medium text-bark/80 leading-relaxed whitespace-pre-wrap mb-4 pl-3 border-l border-brand/5">
                                                      {trimmed}
                                                   </p>
                                                )}
                                             </div>
                                          );
                                       })}
                                    </div>
                                 </div>
                               )}
                            </div>
                          ) : (
                            <div className="flex flex-col items-center py-6 text-center opacity-40">
                               <div className="w-12 h-12 bg-brand/10 rounded-full flex items-center justify-center mb-3">
                                  <Database size={24} className="text-brand" />
                               </div>
                               <p className="text-xs italic">Ingen oppsummering generert ennå. Klikk på knappen over for å la AI analysere kundeprofilen og interaksjonene.</p>
                            </div>
                          )}
                       </div>

                       <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                          <div className="space-y-6">
                             <h4 className="text-[10px] uppercase font-bold tracking-widest text-mid pl-1">Detaljert Profil</h4>
                             <div className="bg-white rounded-3xl border border-bark/10 overflow-hidden shadow-sm">
                                <div className="divide-y divide-bark/5">
                                   {[
                                     { label: 'Type', val: selectedClient.type },
                                     { label: 'Stil', val: selectedClient.style },
                                     { label: 'Bolig', val: selectedClient.bolig },
                                     { label: 'Livssituasjon', val: selectedClient.livssituasjon },
                                     { label: 'Budsjett', val: selectedClient.budsjett },
                                     { label: 'Prioriteringer', val: selectedClient.prioriteringer },
                                     { label: 'Ønsker ikke', val: selectedClient.onskerIkke },
                                   ].map((row, i) => (
                                     <div key={i} className="flex p-5 text-xs hover:bg-bark/[0.02] transition-colors">
                                        <div className="w-1/3 font-bold text-mid opacity-40 uppercase tracking-tight">{row.label}</div>
                                        <div className="w-2/3 text-bark font-medium">{row.val || '—'}</div>
                                     </div>
                                   ))}
                                </div>
                             </div>
                          </div>

                          <div className="space-y-6">
                             <h4 className="text-[10px] uppercase font-bold tracking-widest text-mid pl-1">Interaksjoner & Dialog</h4>
                             <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2 scrollbar-hide">
                                {approvedInteractions.filter(i => i.clientId === selectedClient.id).length === 0 && (
                                  <div className="p-10 text-center bg-white border border-dashed border-bark/10 rounded-3xl opacity-40 italic text-xs">
                                     Ingen dialog er logget for denne kunden ennå.
                                  </div>
                                )}
                                {approvedInteractions.filter(i => i.clientId === selectedClient.id).map(interaction => (
                                  <div key={interaction.id} className="p-5 bg-white border border-bark/10 rounded-2xl shadow-sm space-y-3 relative hover:border-brand/40 transition-colors">
                                     <div className="flex justify-between items-center">
                                       <span className="text-[9px] font-black uppercase text-brand tracking-widest">{interaction.participantName}</span>
                                       <span className="text-[8px] font-bold text-mid opacity-30">{interaction.createdAt?.toDate?.().toLocaleDateString() || 'Nå'}</span>
                                     </div>
                                     <div className="text-xs font-bold text-bark leading-snug">{interaction.question}</div>
                                     <div className="text-xs font-light text-mid italic border-l-2 border-brand/20 pl-4 py-1 leading-relaxed">
                                       "{interaction.answer}"
                                     </div>
                                  </div>
                                ))}
                             </div>
                          </div>
                       </div>
                    </motion.div>
                  )}

                  {clientTab === 'edit' && (
                    <motion.div key="client-edit" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="flex flex-col lg:flex-row gap-6 h-full pb-12">
                       <div className="flex-1 flex flex-col bg-white border border-bark/10 rounded-3xl overflow-hidden min-h-[450px]">
                          <div className="p-4 border-b border-bark/5 bg-bark/5 flex items-center justify-between">
                             <div className="text-[10px] font-bold uppercase tracking-widest text-mid">AI-Assistent</div>
                             <div className="flex items-center gap-2">
                               {isAiLoading && <RefreshCw size={12} className="animate-spin text-brand" />}
                               <div className="text-[9px] text-brand font-black">{isAiLoading ? 'TENKER...' : 'ONLINE'}</div>
                             </div>
                          </div>
                          <div ref={chatContainerRef} className={`flex-1 p-6 space-y-4 overflow-y-auto scrollbar-hide`}>
                             {aiMessages.map((msg, i) => (
                               <div key={i} className={`flex flex-col gap-2 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                                 <div className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-bold shrink-0 ${msg.role === 'assistant' ? 'bg-brand text-white' : 'bg-cream text-mid border border-bark/5'}`}>
                                      {msg.role === 'assistant' ? 'AI' : 'DEG'}
                                    </div>
                                    <div className={`max-w-[85%] p-4 rounded-2xl text-xs leading-relaxed shadow-sm ${msg.role === 'assistant' ? 'bg-cream rounded-tl-none italic' : 'bg-brand text-white rounded-tr-none font-medium'}`}>
                                       {msg.content}
                                    </div>
                                 </div>
                                 
                                 {msg.suggestion && (
                                   <div className="ml-11 mt-1 p-4 bg-brand/5 border border-brand/10 rounded-2xl space-y-3 max-w-[80%]">
                                     <div className="text-[10px] uppercase font-bold tracking-widest text-brand">Forslag til oppdatering</div>
                                     <div className="space-y-1.5">
                                       {Object.entries(msg.suggestion).map(([key, val]: [string, any]) => (
                                         <div key={key} className="text-[9px] flex gap-2">
                                           <span className="font-bold text-mid uppercase w-16 shrink-0">{key}:</span>
                                           <span className="text-bark line-clamp-2">{val}</span>
                                         </div>
                                       ))}
                                     </div>
                                     <div className="flex gap-2 pt-1">
                                       <button 
                                         onClick={() => applyAiSuggestion(msg.suggestion)}
                                         className="flex-1 py-2 bg-brand text-white text-[10px] font-bold rounded-lg shadow-sm hover:opacity-90 active:scale-95 transition-all"
                                       >
                                         Bruk i profil
                                       </button>
                                       <button 
                                         onClick={() => setAiMessages(prev => prev.map((m, idx) => idx === i ? { ...m, suggestion: null } : m))}
                                         className="flex-1 py-2 bg-white border border-bark/10 text-mid text-[10px] font-bold rounded-lg hover:bg-bark/5 transition-all"
                                       >
                                         Avvis
                                       </button>
                                     </div>
                                   </div>
                                 )}
                                 
                                 {msg.applied && (
                                   <div className="ml-11 text-[10px] font-bold text-ok flex items-center gap-1.5 italic">
                                     <Check size={10} /> Endringer lagt til i skjemaet
                                   </div>
                                 )}
                               </div>
                             ))}
                             {isAiLoading && (
                               <div className="flex gap-3 animate-pulse">
                                  <div className="w-8 h-8 rounded-lg bg-brand text-white flex items-center justify-center text-[10px] font-bold shrink-0">
                                    AI
                                  </div>
                                  <div className="max-w-[85%] p-4 rounded-2xl bg-cream rounded-tl-none italic text-xs text-mid flex items-center gap-2">
                                     Skriver...
                                     <span className="flex gap-1">
                                       <span className="w-1 h-1 bg-mid rounded-full animate-bounce [animation-delay:-0.3s]" />
                                       <span className="w-1 h-1 bg-mid rounded-full animate-bounce [animation-delay:-0.15s]" />
                                       <span className="w-1 h-1 bg-mid rounded-full animate-bounce" />
                                     </span>
                                  </div>
                               </div>
                             )}
                          </div>
                          <div className="p-4 bg-white border-t border-bark/5">
                             <form 
                               onSubmit={(e) => { e.preventDefault(); sendMessageToAi(); }}
                               className="flex gap-2 p-1 bg-cream border border-bark/5 rounded-2xl"
                             >
                                <input 
                                  type="text" 
                                  value={aiInput}
                                  onChange={(e) => setAiInput(e.target.value)}
                                  placeholder="Still et spørsmål eller be om endringer..." 
                                  className="flex-1 bg-transparent px-3 py-2 text-xs outline-none" 
                                />
                                <button 
                                  type="submit"
                                  disabled={!aiInput.trim() || isAiLoading}
                                  className="w-10 h-10 flex items-center justify-center bg-brand text-white rounded-xl shadow-md hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
                                >
                                  <ArrowRight size={16} />
                                </button>
                             </form>
                          </div>
                       </div>

                       <div className="flex-[1.2] space-y-6">
                          <div className="grid grid-cols-1 gap-4">
                             <div className="space-y-4">
                               <div className="space-y-2">
                                 <label className="text-[10px] uppercase font-bold tracking-widest text-mid">Bilde URL</label>
                                 <div className="flex gap-2">
                                   <input 
                                     type="text" 
                                     value={newClientImageUrl} 
                                     onChange={(e) => setNewClientImageUrl(e.target.value)} 
                                     placeholder="https://images.unsplash.com/..."
                                     className="flex-1 p-4 bg-white border border-bark/10 rounded-2xl text-xs outline-none focus:border-brand/40" 
                                   />
                                   {newClientImageUrl && (
                                     <div className="w-12 h-12 rounded-xl overflow-hidden border border-bark/10 shrink-0">
                                       <img src={newClientImageUrl} className="w-full h-full object-cover" alt="Preview" referrerPolicy="no-referrer" />
                                     </div>
                                   )}
                                 </div>
                               </div>
                               <div className="space-y-2">
                                 <label className="text-[10px] uppercase font-bold tracking-widest text-mid">Navn</label>
                                 <input type="text" value={newClientName} onChange={(e) => setNewClientName(e.target.value)} className="w-full p-4 bg-white border border-bark/10 rounded-2xl text-xs outline-none focus:border-brand/40" />
                               </div>
                               <div className="grid grid-cols-2 gap-4">
                                  <div className="space-y-2">
                                    <label className="text-[10px] uppercase font-bold tracking-widest text-mid">Type</label>
                                    <select value={newClientType} onChange={(e: any) => setNewClientType(e.target.value)} className="w-full p-4 bg-white border border-bark/10 rounded-2xl text-xs outline-none cursor-pointer">
                                       <option value="Privatkunde">Privatkunde</option>
                                       <option value="Bedriftskunde">Bedriftskunde</option>
                                    </select>
                                  </div>
                                  <div className="space-y-2">
                                    <label className="text-[10px] uppercase font-bold tracking-widest text-mid">Stil</label>
                                    <input type="text" value={newClientStyle} onChange={(e) => setNewClientStyle(e.target.value)} className="w-full p-4 bg-white border border-bark/10 rounded-2xl text-xs outline-none focus:border-brand/40" />
                                  </div>
                               </div>
                               <div className="grid grid-cols-2 gap-4">
                                  <div className="space-y-2">
                                    <label className="text-[10px] uppercase font-bold tracking-widest text-mid">Status</label>
                                    <input type="text" value={newClientStatus} onChange={(e) => setNewClientStatus(e.target.value)} className="w-full p-4 bg-white border border-bark/10 rounded-2xl text-xs outline-none focus:border-brand/40" />
                                  </div>
                                  <div className="space-y-2">
                                    <label className="text-[10px] uppercase font-bold tracking-widest text-mid">Deadline</label>
                                    <input type="text" value={newClientDeadline} onChange={(e) => setNewClientDeadline(e.target.value)} className="w-full p-4 bg-white border border-bark/10 rounded-2xl text-xs outline-none focus:border-brand/40" />
                                  </div>
                               </div>
                               <div className="space-y-2">
                                 <label className="text-[10px] uppercase font-bold tracking-widest text-mid">Bolig</label>
                                 <input type="text" value={newClientBolig} onChange={(e) => setNewClientBolig(e.target.value)} className="w-full p-4 bg-white border border-bark/10 rounded-2xl text-xs outline-none focus:border-brand/40" />
                               </div>
                               <div className="space-y-2">
                                 <label className="text-[10px] uppercase font-bold tracking-widest text-mid">Tekniske krav (én per linje)</label>
                                 <textarea value={newClientKrav} onChange={(e) => setNewClientKrav(e.target.value)} className="w-full p-4 bg-white border border-bark/10 rounded-2xl text-xs outline-none focus:border-brand/40 min-h-[80px]" />
                               </div>
                               <div className="space-y-2">
                                 <label className="text-[10px] uppercase font-bold tracking-widest text-mid">Prioriteringer</label>
                                 <textarea value={newClientPri} onChange={(e) => setNewClientPri(e.target.value)} className="w-full p-4 bg-white border border-bark/10 rounded-2xl text-xs outline-none focus:border-brand/40 min-h-[80px]" />
                               </div>
                               <div className="space-y-2">
                                 <label className="text-[10px] uppercase font-bold tracking-widest text-mid">Ekstra kontekst</label>
                                 <textarea value={newClientExt} onChange={(e) => setNewClientExt(e.target.value)} className="w-full p-4 bg-white border border-bark/10 rounded-2xl text-xs outline-none focus:border-brand/40 min-h-[80px]" />
                               </div>
                             </div>
                             <div className="flex gap-4 pt-8 pb-4">
                                <button 
                                  onClick={updateClient} 
                                  disabled={savingClient}
                                  className="flex-1 py-5 bg-brand text-white text-xs font-bold rounded-2xl shadow-lg shadow-brand/20 hover:opacity-90 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                  {savingClient ? <RefreshCw size={14} className="animate-spin" /> : null}
                                  {savingClient ? 'Lagrer...' : 'Lagre endringer'}
                                </button>
                                <button 
                                  onClick={() => setClientTab('report')} 
                                  disabled={savingClient}
                                  className="px-10 py-5 border border-bark/10 text-mid text-xs font-bold rounded-2xl hover:bg-bark/5 transition-all disabled:opacity-50"
                                >
                                  Avbryt
                                </button>
                             </div>
                          </div>
                       </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Mobile Actions / Taskbar */}
      <div className="fixed bottom-0 left-0 right-0 p-3 sm:p-4 bg-white/80 backdrop-blur-md border-t border-bark/10 lg:hidden flex gap-2 sm:gap-4 overflow-x-auto scrollbar-hide z-50">
         {(['chat', 'booking', 'paamelding'] as const).map(p => (
           <button 
             key={p}
             onClick={() => { setActiveProduct(p); setActiveTab('content'); }}
             className={`flex-1 flex flex-col items-center gap-1 py-2 min-w-[64px] rounded-xl transition-all ${activeProduct === p ? 'bg-brand text-white shadow-lg shadow-brand/20' : 'bg-white border border-bark/5 text-mid'}`}
           >
             {p === 'chat' ? <MessageSquare size={16} /> : p === 'booking' ? <Calendar size={16} /> : <ClipboardCheck size={16} />}
             <span className="text-[8px] uppercase font-bold tracking-tighter">{labels[lang][p].split(' ')[0]}</span>
           </button>
         ))}
         <button 
           onClick={() => setShowGroupsModal(true)}
           className="flex-1 flex flex-col items-center gap-1 py-2 min-w-[64px] rounded-xl bg-white border border-bark/5 text-mid"
         >
           <LayoutGrid size={16} />
           <span className="text-[8px] uppercase font-bold tracking-tighter">Grupper</span>
         </button>
      </div>
    </div>
  );
}

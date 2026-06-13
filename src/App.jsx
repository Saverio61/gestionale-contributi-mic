import { useState, useEffect } from "react";
import { supabase } from "./supabaseClient";
import ParserDecreto from "./ParserDecreto";

const C = {
  blu: "#1A3A5C", bluMed: "#2A5A8C", bluChi: "#E8F0F8",
  oro: "#B8860B", oroChi: "#F5EDD0", carta: "#F7F4EE",
  grigio: "#6B7280", grigioChi: "#E5E7EB", verde: "#166534",
  verdeChi: "#DCFCE7", bianco: "#FFFFFF", nero: "#1C1C1C",
};

const fmt = (n) => n != null
  ? new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n)
  : "--";

// ── SIDEBAR ──────────────────────────────────────────────────
function Sidebar({ sezione, setSezione }) {
  const voci = [
    { id: "dashboard", icon: "⊞", label: "Dashboard" },
    { id: "assegnazioni", icon: "≡", label: "Assegnazioni" },
    { id: "decreti", icon: "▤", label: "Decreti" },
    { id: "parser", icon: "↑", label: "Importa decreto" },
  ];
  return (
    <div style={{ width: 200, background: C.blu, color: C.bianco, display: "flex", flexDirection: "column", minHeight: "100vh", flexShrink: 0 }}>
      <div style={{ padding: "24px 20px 20px", borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
        <div style={{ fontSize: 11, color: C.oro, letterSpacing: 2, textTransform: "uppercase", fontFamily: "monospace" }}>MIC / FNSV</div>
        <div style={{ fontSize: 15, fontWeight: 700, marginTop: 4, lineHeight: 1.2 }}>Gestionale<br />Contributi</div>
        <div style={{ fontSize: 10, color: "#9BB5D4", marginTop: 6 }}>AGIS Puglia e Basilicata</div>
      </div>
      <nav style={{ flex: 1, padding: "12px 0" }}>
        {voci.map(v => (
          <button key={v.id} onClick={() => setSezione(v.id)} style={{
            display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "10px 20px",
            background: sezione === v.id ? "rgba(184,134,11,0.15)" : "transparent",
            borderLeft: sezione === v.id ? `3px solid ${C.oro}` : "3px solid transparent",
            color: sezione === v.id ? C.bianco : "#9BB5D4",
            border: "none", cursor: "pointer", fontSize: 13, textAlign: "left",
          }}>
            <span style={{ fontSize: 14 }}>{v.icon}</span>{v.label}
          </button>
        ))}
      </nav>
      <div style={{ padding: "16px 20px", borderTop: "1px solid rgba(255,255,255,0.1)", fontSize: 10, color: "#9BB5D4" }}>
        Admin · AGIS
      </div>
    </div>
  );
}

// ── DASHBOARD ────────────────────────────────────────────────
function Dashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: assegnazioni } = await supabase
        .schema("contributi_mic")
        .from("assegnazioni")
        .select("contributo_assegnato, anno");
      const { data: organismi } = await supabase
        .schema("contributi_mic")
        .from("organismi")
        .select("id");
      const { data: decreti } = await supabase
        .schema("contributi_mic")
        .from("decreti")
        .select("id, anno_finanziario, ambito_id");

      if (assegnazioni) {
        const tot2025 = assegnazioni.filter(a => a.anno === 2025).reduce((s, a) => s + (a.contributo_assegnato || 0), 0);
        const tot2026 = assegnazioni.filter(a => a.anno === 2026).reduce((s, a) => s + (a.contributo_assegnato || 0), 0);
        setStats({
          totOrganismi: organismi?.length || 0,
          totDecreti: decreti?.length || 0,
          tot2025,
          tot2026,
          totAssegnazioni: assegnazioni.length,
        });
      }
      setLoading(false);
    }
    load();
  }, []);

  if (loading) return <div style={{ padding: 40, color: C.grigio }}>Caricamento...</div>;

  const kpi = [
    { label: "Organismi censiti", value: stats?.totOrganismi, color: C.blu },
    { label: "Decreti importati", value: stats?.totDecreti, color: C.oro },
    { label: "Totale 2025", value: fmt(stats?.tot2025), color: C.verde },
    { label: "Totale 2026", value: fmt(stats?.tot2026), color: C.bluMed },
  ];

  return (
    <div style={{ padding: "28px 32px" }}>
      <h1 style={{ fontSize: 20, fontWeight: 800, color: C.nero, margin: "0 0 4px" }}>Dashboard</h1>
      <p style={{ fontSize: 13, color: C.grigio, margin: "0 0 24px" }}>Fondo Nazionale Spettacolo dal Vivo</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 28 }}>
        {kpi.map(k => (
          <div key={k.label} style={{ background: C.bianco, border: `1px solid ${C.grigioChi}`, borderTop: `3px solid ${k.color}`, borderRadius: 6, padding: "16px 20px" }}>
            <div style={{ fontSize: 11, color: C.grigio, textTransform: "uppercase", letterSpacing: 1 }}>{k.label}</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: C.nero, margin: "6px 0 0" }}>{k.value}</div>
          </div>
        ))}
      </div>
      <div style={{ background: C.bianco, border: `1px solid ${C.grigioChi}`, borderRadius: 6, padding: "20px 24px" }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.nero, marginBottom: 12 }}>Riepilogo dati caricati</div>
        <div style={{ fontSize: 13, color: C.grigio, lineHeight: 2 }}>
          <div>✅ <strong>Danza 2025</strong> — D.D.G. rep. 1074 — 150 organismi — € {fmt(stats?.tot2025)}</div>
          <div>✅ <strong>Danza 2026</strong> — D.D.G. rep. 787 — 150 organismi</div>
          <div>✅ <strong>Circo 2026</strong> — D.D.G. rep. 770 — 47 organismi</div>
          <div>✅ <strong>Multidisciplinare 2026</strong> — D.D.G. rep. 783 — 78 organismi</div>
        </div>
      </div>
    </div>
  );
}

// ── ASSEGNAZIONI ─────────────────────────────────────────────
function Assegnazioni() {
  const [dati, setDati] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtroAnno, setFiltroAnno] = useState("tutti");
  const [filtroAmbito, setFiltroAmbito] = useState("tutti");
  const [cerca, setCerca] = useState("");

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .schema("contributi_mic")
        .from("assegnazioni")
        .select(`
          id, anno, punteggio_tot, contributo_assegnato, stato, posizione_graduatoria,
          organismo:organismo_id(denominazione),
          settore:settore_id(articolo_dm, descrizione, ambito_id(codice, nome))
        `)
        .order("anno", { ascending: false })
        .order("punteggio_tot", { ascending: false })
        .limit(500);
      setDati(data || []);
      setLoading(false);
    }
    load();
  }, []);

  const anni = ["tutti", ...new Set(dati.map(d => d.anno))];
  const ambiti = ["tutti", ...new Set(dati.map(d => d.settore?.ambito_id?.nome).filter(Boolean))];

  const filtrati = dati.filter(d => {
    if (filtroAnno !== "tutti" && d.anno !== parseInt(filtroAnno)) return false;
    if (filtroAmbito !== "tutti" && d.settore?.ambito_id?.nome !== filtroAmbito) return false;
    if (cerca && !d.organismo?.denominazione?.toLowerCase().includes(cerca.toLowerCase())) return false;
    return true;
  });

  if (loading) return <div style={{ padding: 40, color: C.grigio }}>Caricamento...</div>;

  return (
    <div style={{ padding: "28px 32px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: C.nero, margin: 0 }}>Assegnazioni</h1>
          <p style={{ fontSize: 13, color: C.grigio, margin: "4px 0 0" }}>{filtrati.length} risultati</p>
        </div>
      </div>
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <input
          value={cerca}
          onChange={e => setCerca(e.target.value)}
          placeholder="Cerca organismo..."
          style={{ padding: "7px 12px", borderRadius: 6, border: `1px solid ${C.grigioChi}`, fontSize: 13, width: 220 }}
        />
        <select value={filtroAnno} onChange={e => setFiltroAnno(e.target.value)}
          style={{ padding: "7px 12px", borderRadius: 6, border: `1px solid ${C.grigioChi}`, fontSize: 13 }}>
          {anni.map(a => <option key={a}>{a}</option>)}
        </select>
        <select value={filtroAmbito} onChange={e => setFiltroAmbito(e.target.value)}
          style={{ padding: "7px 12px", borderRadius: 6, border: `1px solid ${C.grigioChi}`, fontSize: 13 }}>
          {ambiti.map(a => <option key={a}>{a}</option>)}
        </select>
      </div>
      <div style={{ background: C.bianco, border: `1px solid ${C.grigioChi}`, borderRadius: 6, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ background: C.blu }}>
              {["Anno", "Organismo", "Ambito", "Articolo", "Punteggio", "Contributo"].map(h => (
                <th key={h} style={{ padding: "10px 12px", textAlign: "left", fontWeight: 700, color: C.bianco, fontSize: 11, textTransform: "uppercase" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtrati.slice(0, 200).map((d, i) => (
              <tr key={d.id} style={{ background: i % 2 === 0 ? C.bianco : C.carta, borderBottom: `1px solid ${C.grigioChi}` }}>
                <td style={{ padding: "8px 12px", fontFamily: "monospace", fontWeight: 700, color: C.blu }}>{d.anno}</td>
                <td style={{ padding: "8px 12px", fontWeight: 600, color: C.nero, maxWidth: 250, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.organismo?.denominazione}</td>
                <td style={{ padding: "8px 12px", color: C.grigio, fontSize: 11 }}>{d.settore?.ambito_id?.nome}</td>
                <td style={{ padding: "8px 12px", color: C.grigio, fontSize: 11 }}>{d.settore?.articolo_dm}</td>
                <td style={{ padding: "8px 12px", fontFamily: "monospace", fontWeight: 700, color: C.blu }}>{d.punteggio_tot?.toFixed(2)}</td>
                <td style={{ padding: "8px 12px", fontFamily: "monospace", fontWeight: 700, color: C.verde }}>{fmt(d.contributo_assegnato)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtrati.length > 200 && (
          <div style={{ padding: "10px 16px", fontSize: 12, color: C.grigio, background: C.carta }}>
            Mostrati 200 di {filtrati.length} risultati — usa i filtri per restringere la ricerca.
          </div>
        )}
      </div>
    </div>
  );
}

// ── DECRETI ──────────────────────────────────────────────────
function Decreti() {
  const [dati, setDati] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .schema("contributi_mic")
        .from("decreti")
        .select("*, ambito:ambito_id(nome)")
        .order("data", { ascending: false });
      setDati(data || []);
      setLoading(false);
    }
    load();
  }, []);

  if (loading) return <div style={{ padding: 40, color: C.grigio }}>Caricamento...</div>;

  return (
    <div style={{ padding: "28px 32px" }}>
      <h1 style={{ fontSize: 20, fontWeight: 800, color: C.nero, margin: "0 0 20px" }}>Decreti importati</h1>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {dati.map(d => (
          <div key={d.id} style={{ background: C.bianco, border: `1px solid ${C.grigioChi}`, borderLeft: `4px solid ${C.oro}`, borderRadius: 6, padding: "16px 20px", display: "flex", alignItems: "center", gap: 20 }}>
            <div style={{ background: C.blu, color: C.bianco, borderRadius: 5, padding: "8px 12px", textAlign: "center", flexShrink: 0, fontFamily: "monospace" }}>
              <div style={{ fontSize: 9, color: "#9BB5D4", letterSpacing: 1 }}>D.D.G. REP.</div>
              <div style={{ fontSize: 18, fontWeight: 800, lineHeight: 1 }}>n.{d.numero_rep}</div>
              <div style={{ fontSize: 9, color: C.oro, marginTop: 2 }}>{d.anno_finanziario}</div>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: C.nero }}>{d.ambito?.nome}</div>
              <div style={{ fontSize: 12, color: C.grigio, marginTop: 3 }}>{d.ente_erogante} · {d.data}</div>
              <div style={{ fontSize: 11, color: C.verde, fontWeight: 600, marginTop: 6 }}>{fmt(d.stanziamento_totale)}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── APP ──────────────────────────────────────────────────────
export default function App() {
  const [sezione, setSezione] = useState("dashboard");

  const contenuto = {
    dashboard: <Dashboard />,
    assegnazioni: <Assegnazioni />,
    decreti: <Decreti />,
    parser: <ParserDecreto />,
  }[sezione];

  return (
    <div style={{ display: "flex", minHeight: "100vh", fontFamily: "'Segoe UI', system-ui, sans-serif", background: C.carta }}>
      <Sidebar sezione={sezione} setSezione={setSezione} />
      <main style={{ flex: 1, overflow: "auto", minWidth: 0 }}>
        {contenuto}
      </main>
    </div>
  );
}

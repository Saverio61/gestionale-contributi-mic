import { useState, useEffect } from "react";
import { supabase } from "./supabaseClient";
import ParserDecreto from "./ParserDecreto";

const C = {
  blu: "#1A3A5C", bluMed: "#2A5A8C", bluChi: "#E8F0F8",
  oro: "#B8860B", oroChi: "#F5EDD0", carta: "#F7F4EE",
  grigio: "#6B7280", grigioChi: "#E5E7EB", verde: "#166534",
  verdeChi: "#DCFCE7", bianco: "#FFFFFF", nero: "#1C1C1C",
  rosso: "#991B1B",
};

const fmt = (n) => n != null
  ? new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n)
  : "--";

// ── SIDEBAR ──────────────────────────────────────────────────
function Sidebar({ sezione, setSezione }) {
  const voci = [
    { id: "dashboard", icon: "⊞", label: "Dashboard" },
    { id: "assegnazioni", icon: "≡", label: "Assegnazioni" },
    { id: "puglia_basilicata", icon: "◎", label: "Puglia & Basilicata" },
    { id: "decreti", icon: "▤", label: "Decreti" },
    { id: "parser", icon: "↑", label: "Importa decreto" },
  ];
  return (
    <div style={{ width: 210, background: C.blu, color: C.bianco, display: "flex", flexDirection: "column", minHeight: "100vh", flexShrink: 0, boxShadow: "2px 0 8px rgba(0,0,0,0.15)" }}>
      <div style={{ padding: "24px 20px", borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
        <div style={{ borderLeft: `3px solid ${C.oro}`, paddingLeft: 12 }}>
          <div style={{ fontSize: 10, color: C.oro, letterSpacing: 2, textTransform: "uppercase", fontFamily: "monospace" }}>MIC / FNSV</div>
          <div style={{ fontSize: 16, fontWeight: 800, marginTop: 4, lineHeight: 1.3 }}>Gestionale<br />Contributi</div>
          <div style={{ fontSize: 10, color: "#9BB5D4", marginTop: 6 }}>AGIS Puglia e Basilicata</div>
        </div>
      </div>
      <nav style={{ flex: 1, padding: "12px 0" }}>
        {voci.map(v => (
          <button key={v.id} onClick={() => setSezione(v.id)} style={{
            display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "11px 20px",
            background: sezione === v.id ? "rgba(184,134,11,0.2)" : "transparent",
            borderLeft: sezione === v.id ? `3px solid ${C.oro}` : "3px solid transparent",
            color: sezione === v.id ? C.bianco : "#9BB5D4",
            border: "none", cursor: "pointer", fontSize: 13, textAlign: "left",
            transition: "all 0.15s",
          }}>
            <span style={{ fontSize: 14, opacity: 0.8 }}>{v.icon}</span>{v.label}
          </button>
        ))}
      </nav>
      <div style={{ padding: "16px 20px", borderTop: "1px solid rgba(255,255,255,0.1)", fontSize: 10, color: "#6B8EAE" }}>
        Admin · AGIS Puglia e Basilicata
      </div>
    </div>
  );
}

// ── PAGE HEADER ──────────────────────────────────────────────
function PageHeader({ title, subtitle, fascia }) {
  return (
    <div style={{ marginBottom: 24 }}>
      {fascia && (
        <div style={{ background: C.blu, color: C.bianco, padding: "6px 0 6px 28px", marginBottom: 0, display: "flex", alignItems: "center", gap: 16, borderLeft: `4px solid ${C.oro}` }}>
          <span style={{ fontSize: 10, color: C.oro, fontFamily: "monospace", letterSpacing: 1 }}>{fascia}</span>
        </div>
      )}
      <div style={{ padding: fascia ? "20px 28px 0" : "28px 28px 0" }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: C.nero, margin: 0 }}>{title}</h1>
        {subtitle && <p style={{ fontSize: 13, color: C.grigio, margin: "4px 0 0" }}>{subtitle}</p>}
      </div>
    </div>
  );
}

// ── KPI CARD ─────────────────────────────────────────────────
function KpiCard({ label, value, sub, color, bg }) {
  return (
    <div style={{ background: bg || C.bianco, border: `1px solid ${C.grigioChi}`, borderTop: `3px solid ${color}`, borderRadius: 8, padding: "16px 20px", flex: 1 }}>
      <div style={{ fontSize: 11, color: C.grigio, textTransform: "uppercase", letterSpacing: 1, fontFamily: "monospace" }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 800, color: C.nero, margin: "6px 0 4px" }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: color, fontWeight: 600 }}>{sub}</div>}
    </div>
  );
}

// ── DASHBOARD ────────────────────────────────────────────────
function Dashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: ass } = await supabase.schema("contributi_mic").from("assegnazioni").select("contributo_assegnato, anno");
      const { data: org } = await supabase.schema("contributi_mic").from("organismi").select("id");
      const { data: dec } = await supabase.schema("contributi_mic").from("decreti").select("id, numero_rep, data, anno_finanziario, stanziamento_totale, ambito:ambito_id(nome)").order("data", { ascending: false });
      if (ass) {
        const tot25 = ass.filter(a => a.anno === 2025).reduce((s, a) => s + (a.contributo_assegnato || 0), 0);
        const tot26 = ass.filter(a => a.anno === 2026).reduce((s, a) => s + (a.contributo_assegnato || 0), 0);
        setStats({ org: org?.length || 0, dec: dec?.length || 0, tot25, tot26, decreti: dec || [] });
      }
      setLoading(false);
    }
    load();
  }, []);

  if (loading) return <div style={{ padding: 40, color: C.grigio, fontStyle: "italic" }}>Caricamento dati...</div>;

  return (
    <div>
      <div style={{ background: C.blu, padding: "20px 28px", borderLeft: `4px solid ${C.oro}` }}>
        <div style={{ fontSize: 10, color: C.oro, fontFamily: "monospace", letterSpacing: 2, textTransform: "uppercase" }}>MIC / FNSV — AGIS Puglia e Basilicata</div>
        <div style={{ fontSize: 20, fontWeight: 800, color: C.bianco, marginTop: 4 }}>Gestionale Contributi Spettacolo dal Vivo</div>
        <div style={{ fontSize: 12, color: "#9BB5D4", marginTop: 2 }}>Fondo Nazionale per lo Spettacolo dal Vivo · Triennio 2025/2027</div>
      </div>
      <div style={{ padding: "24px 28px" }}>
        <div style={{ display: "flex", gap: 16, marginBottom: 28 }}>
          <KpiCard label="Organismi censiti" value={stats.org} color={C.blu} />
          <KpiCard label="Decreti importati" value={stats.dec} color={C.oro} />
          <KpiCard label="Totale assegnato 2025" value={fmt(stats.tot25)} color={C.verde} bg={C.verdeChi} />
          <KpiCard label="Totale assegnato 2026" value={fmt(stats.tot26)} color={C.bluMed} bg={C.bluChi} />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
          <div style={{ background: C.bianco, border: `1px solid ${C.grigioChi}`, borderRadius: 8, overflow: "hidden" }}>
            <div style={{ padding: "14px 18px", borderBottom: `1px solid ${C.grigioChi}`, background: C.carta }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.nero }}>Decreti importati</div>
            </div>
            {stats.decreti.map(d => (
              <div key={d.id} style={{ padding: "12px 18px", borderBottom: `1px solid ${C.grigioChi}`, display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ background: C.blu, color: C.bianco, borderRadius: 4, padding: "4px 8px", fontSize: 10, fontFamily: "monospace", fontWeight: 800, flexShrink: 0 }}>
                  {d.numero_rep}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: C.nero }}>{d.ambito?.nome}</div>
                  <div style={{ fontSize: 11, color: C.grigio }}>{d.data} · Anno {d.anno_finanziario}</div>
                </div>
                <div style={{ fontSize: 12, fontWeight: 700, color: C.verde }}>{fmt(d.stanziamento_totale)}</div>
              </div>
            ))}
          </div>

          <div style={{ background: C.bianco, border: `1px solid ${C.grigioChi}`, borderRadius: 8, padding: "18px" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.nero, marginBottom: 16 }}>Copertura dati</div>
            {[
              { label: "Danza 2025", rep: "1074", org: 150, ok: true },
              { label: "Danza 2026", rep: "787", org: 150, ok: true },
              { label: "Circo 2026", rep: "770", org: 47, ok: true },
              { label: "Multidisciplinare 2026", rep: "783", org: 78, ok: true },
              { label: "Musica 2025/2026", rep: "--", org: 0, ok: false },
              { label: "Teatro 2025/2026", rep: "--", org: 0, ok: false },
            ].map(r => (
              <div key={r.label} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                <span style={{ fontSize: 14 }}>{r.ok ? "✅" : "⏳"}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: r.ok ? C.nero : C.grigio }}>{r.label}</div>
                  {r.ok && <div style={{ fontSize: 11, color: C.grigio }}>rep. {r.rep} · {r.org} organismi</div>}
                </div>
              </div>
            ))}
          </div>
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
        .select(`id, anno, punteggio_tot, contributo_assegnato, prima_istanza_triennale,
          organismo:organismo_id(denominazione, comune:comune_id(nome, provincia:provincia_id(codice, regione:regione_id(nome)))),
          settore:settore_id(articolo_dm, descrizione, ambito:ambito_id(codice, nome))`)
        .order("anno", { ascending: false })
        .order("punteggio_tot", { ascending: false })
        .limit(500);
      setDati(data || []);
      setLoading(false);
    }
    load();
  }, []);

  const anni = ["tutti", ...new Set(dati.map(d => d.anno))];
  const ambiti = ["tutti", ...new Set(dati.map(d => d.settore?.ambito?.nome).filter(Boolean))];

  const filtrati = dati.filter(d => {
    if (filtroAnno !== "tutti" && d.anno !== parseInt(filtroAnno)) return false;
    if (filtroAmbito !== "tutti" && d.settore?.ambito?.nome !== filtroAmbito) return false;
    if (cerca && !d.organismo?.denominazione?.toLowerCase().includes(cerca.toLowerCase())) return false;
    return true;
  });

  const totFiltrato = filtrati.reduce((s, d) => s + (d.contributo_assegnato || 0), 0);

  if (loading) return <div style={{ padding: 40, color: C.grigio, fontStyle: "italic" }}>Caricamento...</div>;

  return (
    <div style={{ padding: "28px 32px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: C.nero, margin: 0 }}>Assegnazioni</h1>
          <p style={{ fontSize: 13, color: C.grigio, margin: "4px 0 0" }}>{filtrati.length} risultati · {fmt(totFiltrato)}</p>
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <input value={cerca} onChange={e => setCerca(e.target.value)} placeholder="🔍 Cerca organismo..."
          style={{ padding: "8px 14px", borderRadius: 6, border: `1px solid ${C.grigioChi}`, fontSize: 13, width: 240, outline: "none" }} />
        <select value={filtroAnno} onChange={e => setFiltroAnno(e.target.value)}
          style={{ padding: "8px 12px", borderRadius: 6, border: `1px solid ${C.grigioChi}`, fontSize: 13, background: C.bianco }}>
          {anni.map(a => <option key={a}>{a}</option>)}
        </select>
        <select value={filtroAmbito} onChange={e => setFiltroAmbito(e.target.value)}
          style={{ padding: "8px 12px", borderRadius: 6, border: `1px solid ${C.grigioChi}`, fontSize: 13, background: C.bianco }}>
          {ambiti.map(a => <option key={a}>{a}</option>)}
        </select>
      </div>

      <div style={{ background: C.bianco, border: `1px solid ${C.grigioChi}`, borderRadius: 8, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ background: C.blu }}>
              {["Anno","Organismo","Sede","Regione","Ambito","Articolo","Punt.","Contributo"].map(h => (
                <th key={h} style={{ padding: "10px 12px", textAlign: "left", color: C.bianco, fontSize: 11, textTransform: "uppercase", fontWeight: 600, letterSpacing: 0.5 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtrati.slice(0, 300).map((d, i) => {
              const comune = d.organismo?.comune?.nome;
              const prov = d.organismo?.comune?.provincia?.codice;
              const regione = d.organismo?.comune?.provincia?.regione?.nome;
              const isPugBas = regione === "Puglia" || regione === "Basilicata";
              return (
                <tr key={d.id} style={{ background: isPugBas ? "#FFFBEB" : i % 2 === 0 ? C.bianco : C.carta, borderBottom: `1px solid ${C.grigioChi}` }}>
                  <td style={{ padding: "8px 12px", fontFamily: "monospace", fontWeight: 700, color: C.blu }}>{d.anno}</td>
                  <td style={{ padding: "8px 12px", fontWeight: 600, color: C.nero, maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {d.organismo?.denominazione}
                    {d.prima_istanza_triennale && <span style={{ marginLeft: 6, fontSize: 9, background: C.oroChi, color: C.oro, padding: "1px 5px", borderRadius: 8, fontWeight: 700 }}>1a ist.</span>}
                  </td>
                  <td style={{ padding: "8px 12px", color: C.grigio, fontSize: 11, whiteSpace: "nowrap" }}>{comune ? `${comune} (${prov})` : "--"}</td>
                  <td style={{ padding: "8px 12px", fontSize: 11 }}>
                    {regione ? (
                      <span style={{ background: isPugBas ? C.oroChi : C.bluChi, color: isPugBas ? C.oro : C.blu, padding: "2px 7px", borderRadius: 10, fontSize: 10, fontWeight: 700 }}>
                        {regione}
                      </span>
                    ) : "--"}
                  </td>
                  <td style={{ padding: "8px 12px", color: C.grigio, fontSize: 11 }}>{d.settore?.ambito?.nome}</td>
                  <td style={{ padding: "8px 12px", color: C.grigio, fontSize: 11 }}>{d.settore?.articolo_dm}</td>
                  <td style={{ padding: "8px 12px", fontFamily: "monospace", fontWeight: 700, color: C.blu }}>{d.punteggio_tot?.toFixed(2)}</td>
                  <td style={{ padding: "8px 12px", fontFamily: "monospace", fontWeight: 700, color: C.verde }}>{fmt(d.contributo_assegnato)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtrati.length > 300 && (
          <div style={{ padding: "10px 16px", fontSize: 12, color: C.grigio, background: C.carta, borderTop: `1px solid ${C.grigioChi}` }}>
            Mostrati 300 di {filtrati.length} — usa i filtri per restringere.
          </div>
        )}
      </div>
    </div>
  );
}

// ── PUGLIA & BASILICATA ──────────────────────────────────────
function PugliaBasilicata() {
  const [dati, setDati] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtroAnno, setFiltroAnno] = useState("tutti");
  const [filtroRegione, setFiltroRegione] = useState("tutti");

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .schema("contributi_mic")
        .from("assegnazioni")
        .select(`id, anno, punteggio_vd, punteggio_qa, punteggio_qi, punteggio_da, punteggio_tot, contributo_assegnato, prima_istanza_triennale,
          organismo:organismo_id(denominazione, comune:comune_id(nome, provincia:provincia_id(codice, regione:regione_id(nome)))),
          settore:settore_id(articolo_dm, descrizione, ambito:ambito_id(nome))`)
        .order("anno", { ascending: false })
        .order("punteggio_tot", { ascending: false });

      const pugBas = (data || []).filter(d => {
        const reg = d.organismo?.comune?.provincia?.regione?.nome;
        return reg === "Puglia" || reg === "Basilicata";
      });
      setDati(pugBas);
      setLoading(false);
    }
    load();
  }, []);

  const anni = ["tutti", ...new Set(dati.map(d => d.anno))];
  const filtrati = dati.filter(d => {
    if (filtroAnno !== "tutti" && d.anno !== parseInt(filtroAnno)) return false;
    if (filtroRegione !== "tutti" && d.organismo?.comune?.provincia?.regione?.nome !== filtroRegione) return false;
    return true;
  });

  const totPuglia = filtrati.filter(d => d.organismo?.comune?.provincia?.regione?.nome === "Puglia").reduce((s, d) => s + (d.contributo_assegnato || 0), 0);
  const totBasilicata = filtrati.filter(d => d.organismo?.comune?.provincia?.regione?.nome === "Basilicata").reduce((s, d) => s + (d.contributo_assegnato || 0), 0);

  if (loading) return <div style={{ padding: 40, color: C.grigio, fontStyle: "italic" }}>Caricamento...</div>;

  return (
    <div style={{ padding: "28px 32px" }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, color: C.nero, margin: "0 0 4px" }}>Puglia e Basilicata</h1>
      <p style={{ fontSize: 13, color: C.grigio, margin: "0 0 20px" }}>Organismi finanziati FNSV nelle due regioni</p>

      <div style={{ display: "flex", gap: 16, marginBottom: 24 }}>
        <KpiCard label="Organismi totali" value={filtrati.length} color={C.blu} />
        <KpiCard label="Puglia" value={fmt(totPuglia)} color={C.oro} bg={C.oroChi} />
        <KpiCard label="Basilicata" value={fmt(totBasilicata)} color={C.verde} bg={C.verdeChi} />
        <KpiCard label="Totale regioni" value={fmt(totPuglia + totBasilicata)} color={C.bluMed} bg={C.bluChi} />
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
        <select value={filtroAnno} onChange={e => setFiltroAnno(e.target.value)}
          style={{ padding: "8px 12px", borderRadius: 6, border: `1px solid ${C.grigioChi}`, fontSize: 13, background: C.bianco }}>
          {anni.map(a => <option key={a}>{a}</option>)}
        </select>
        <select value={filtroRegione} onChange={e => setFiltroRegione(e.target.value)}
          style={{ padding: "8px 12px", borderRadius: 6, border: `1px solid ${C.grigioChi}`, fontSize: 13, background: C.bianco }}>
          <option>tutti</option>
          <option>Puglia</option>
          <option>Basilicata</option>
        </select>
      </div>

      <div style={{ background: C.bianco, border: `1px solid ${C.grigioChi}`, borderRadius: 8, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ background: C.blu }}>
              {["Anno","Organismo","Sede","Regione","Ambito","Art.","VD","QA","QI","DA","TOT","Contributo"].map(h => (
                <th key={h} style={{ padding: "10px 10px", textAlign: "left", color: C.bianco, fontSize: 10, textTransform: "uppercase", fontWeight: 600 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtrati.map((d, i) => {
              const comune = d.organismo?.comune?.nome;
              const prov = d.organismo?.comune?.provincia?.codice;
              const regione = d.organismo?.comune?.provincia?.regione?.nome;
              const isPuglia = regione === "Puglia";
              return (
                <tr key={d.id} style={{ background: isPuglia ? "#FFFEF5" : "#F0FFF4", borderBottom: `1px solid ${C.grigioChi}` }}>
                  <td style={{ padding: "8px 10px", fontFamily: "monospace", fontWeight: 700, color: C.blu }}>{d.anno}</td>
                  <td style={{ padding: "8px 10px", fontWeight: 600, color: C.nero, maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {d.organismo?.denominazione}
                  </td>
                  <td style={{ padding: "8px 10px", color: C.grigio, fontSize: 11 }}>{comune ? `${comune} (${prov})` : "--"}</td>
                  <td style={{ padding: "8px 10px" }}>
                    <span style={{ background: isPuglia ? C.oroChi : C.verdeChi, color: isPuglia ? C.oro : C.verde, padding: "2px 7px", borderRadius: 10, fontSize: 10, fontWeight: 700 }}>
                      {regione}
                    </span>
                  </td>
                  <td style={{ padding: "8px 10px", color: C.grigio, fontSize: 11 }}>{d.settore?.ambito?.nome}</td>
                  <td style={{ padding: "8px 10px", color: C.grigio, fontSize: 11 }}>{d.settore?.articolo_dm}</td>
                  {[d.punteggio_vd, d.punteggio_qa, d.punteggio_qi, d.punteggio_da].map((v, vi) => (
                    <td key={vi} style={{ padding: "8px 6px", fontFamily: "monospace", color: C.nero, fontSize: 11 }}>{v?.toFixed(2)}</td>
                  ))}
                  <td style={{ padding: "8px 6px", fontFamily: "monospace", fontWeight: 800, color: C.blu }}>{d.punteggio_tot?.toFixed(2)}</td>
                  <td style={{ padding: "8px 10px", fontFamily: "monospace", fontWeight: 700, color: C.verde, whiteSpace: "nowrap" }}>{fmt(d.contributo_assegnato)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtrati.length === 0 && (
          <div style={{ padding: 32, textAlign: "center", color: C.grigio }}>
            Nessun organismo trovato — i dati geografici vengono caricati progressivamente.
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
      const { data } = await supabase.schema("contributi_mic").from("decreti")
        .select("*, ambito:ambito_id(nome)").order("data", { ascending: false });
      setDati(data || []);
      setLoading(false);
    }
    load();
  }, []);

  if (loading) return <div style={{ padding: 40, color: C.grigio, fontStyle: "italic" }}>Caricamento...</div>;

  return (
    <div style={{ padding: "28px 32px" }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, color: C.nero, margin: "0 0 20px" }}>Decreti importati</h1>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {dati.map(d => (
          <div key={d.id} style={{ background: C.bianco, border: `1px solid ${C.grigioChi}`, borderLeft: `4px solid ${C.oro}`, borderRadius: 8, padding: "16px 20px", display: "flex", alignItems: "center", gap: 20 }}>
            <div style={{ background: C.blu, color: C.bianco, borderRadius: 6, padding: "8px 14px", textAlign: "center", flexShrink: 0, fontFamily: "monospace" }}>
              <div style={{ fontSize: 8, color: "#9BB5D4", letterSpacing: 1 }}>D.D.G. REP.</div>
              <div style={{ fontSize: 20, fontWeight: 800, lineHeight: 1 }}>n.{d.numero_rep}</div>
              <div style={{ fontSize: 8, color: C.oro, marginTop: 2 }}>{d.anno_finanziario}</div>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 15, color: C.nero }}>{d.ambito?.nome}</div>
              <div style={{ fontSize: 12, color: C.grigio, marginTop: 3 }}>{d.ente_erogante} · {d.data}</div>
              <div style={{ fontSize: 12, color: C.verde, fontWeight: 600, marginTop: 6 }}>{fmt(d.stanziamento_totale)}</div>
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
    puglia_basilicata: <PugliaBasilicata />,
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

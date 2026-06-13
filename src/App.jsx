import { useState, useEffect } from "react";
import { supabase } from "./supabaseClient";
import ParserDecreto from "./ParserDecreto";

const C = {
  blu: "#1A3A5C", bluMed: "#2A5A8C", bluChi: "#E8F0F8",
  oro: "#B8860B", oroChi: "#FEF3C7", carta: "#F7F4EE",
  grigio: "#6B7280", grigioChi: "#E5E7EB", verde: "#166534",
  verdeChi: "#DCFCE7", bianco: "#FFFFFF", nero: "#1C1C1C",
  rosso: "#991B1B", rossoChi: "#FEE2E2",
};

const fmt = (n) => n != null
  ? new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n)
  : "--";

// ── SIDEBAR ──────────────────────────────────────────────────
function Sidebar({ sezione, setSezione }) {
  const voci = [
    { id: "dashboard",         icon: "⊞", label: "Dashboard" },
    { id: "assegnazioni",      icon: "≡", label: "Assegnazioni" },
    { id: "puglia_basilicata", icon: "◎", label: "Puglia & Basilicata" },
    { id: "decreti",           icon: "▤", label: "Decreti" },
    { id: "parser",            icon: "↑", label: "Importa decreto" },
  ];
  return (
    <div style={{ width: 210, background: C.blu, color: C.bianco, display: "flex", flexDirection: "column", minHeight: "100vh", flexShrink: 0, boxShadow: "2px 0 12px rgba(0,0,0,0.2)" }}>
      <div style={{ padding: "28px 20px 20px" }}>
        <div style={{ fontSize: 9, color: C.oro, letterSpacing: 3, textTransform: "uppercase", fontFamily: "monospace", marginBottom: 8 }}>MIC / FNSV</div>
        <div style={{ fontSize: 17, fontWeight: 800, lineHeight: 1.3, color: C.bianco }}>Gestionale<br/>Contributi</div>
        <div style={{ fontSize: 10, color: "#6B8EAE", marginTop: 8, lineHeight: 1.5 }}>AGIS Puglia e Basilicata</div>
      </div>
      <div style={{ height: 1, background: "rgba(255,255,255,0.08)", margin: "0 20px" }} />
      <nav style={{ flex: 1, padding: "16px 0" }}>
        {voci.map(v => (
          <button key={v.id} onClick={() => setSezione(v.id)} style={{
            display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "10px 20px",
            background: sezione === v.id ? "rgba(184,134,11,0.18)" : "transparent",
            borderLeft: sezione === v.id ? `3px solid ${C.oro}` : "3px solid transparent",
            color: sezione === v.id ? C.bianco : "#7A9BB5",
            border: "none", cursor: "pointer", fontSize: 13, textAlign: "left", transition: "all 0.15s",
          }}>
            <span style={{ fontSize: 13 }}>{v.icon}</span>{v.label}
          </button>
        ))}
      </nav>
      <div style={{ height: 1, background: "rgba(255,255,255,0.08)", margin: "0 20px" }} />
      <div style={{ padding: "14px 20px", fontSize: 10, color: "#4A6A8A" }}>
        Admin · AGIS
      </div>
    </div>
  );
}

// ── BARRA PUNTEGGIO ──────────────────────────────────────────
function BarraPunteggio({ label, valore, max = 35, colore }) {
  const pct = Math.min(100, (valore / max) * 100);
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
        <span style={{ color: C.grigio }}>{label}</span>
        <span style={{ fontWeight: 700, color: C.nero, fontFamily: "monospace" }}>{valore?.toFixed(2) || "--"}</span>
      </div>
      <div style={{ height: 7, background: C.grigioChi, borderRadius: 4, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: colore, borderRadius: 4, transition: "width 0.5s ease" }} />
      </div>
    </div>
  );
}

// ── MODAL DETTAGLIO ORGANISMO ────────────────────────────────
function ModalOrganismo({ riga, onClose }) {
  const [storico, setStorico] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .schema("contributi_mic")
        .from("v_assegnazioni")
        .select("*")
        .eq("denominazione", riga.denominazione)
        .order("anno");
      setStorico(data || []);
      setLoading(false);
    }
    load();
  }, [riga.denominazione]);

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: C.bianco, borderRadius: 12, width: "min(720px, 100%)", maxHeight: "85vh", overflow: "hidden", display: "flex", flexDirection: "column", boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}>
        
        {/* Header modale */}
        <div style={{ background: C.blu, padding: "20px 24px", borderBottom: `3px solid ${C.oro}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ fontSize: 9, color: C.oro, fontFamily: "monospace", letterSpacing: 2, textTransform: "uppercase", marginBottom: 6 }}>
                {riga.ambito} · {riga.articolo_dm}
              </div>
              <div style={{ fontSize: 16, fontWeight: 800, color: C.bianco, lineHeight: 1.3 }}>{riga.denominazione}</div>
              <div style={{ fontSize: 12, color: "#9BB5D4", marginTop: 6 }}>
                {riga.comune ? `${riga.comune} (${riga.sigla_provincia}) · ${riga.regione}` : "Sede non registrata"}
              </div>
            </div>
            <button onClick={onClose} style={{ background: "rgba(255,255,255,0.1)", border: "none", color: C.bianco, width: 32, height: 32, borderRadius: 6, cursor: "pointer", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
          </div>
        </div>

        <div style={{ overflow: "auto", flex: 1, padding: 24 }}>
          {/* Punteggi anno corrente */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.blu, textTransform: "uppercase", letterSpacing: 1, marginBottom: 14 }}>
              Punteggi {riga.anno}
            </div>
            <div style={{ background: C.carta, borderRadius: 8, padding: 16 }}>
              <BarraPunteggio label="VD – Valore Dimensionale" valore={riga.punteggio_vd} colore={C.blu} />
              <BarraPunteggio label="QA – Qualità Artistica" valore={riga.punteggio_qa} colore={C.oro} />
              <BarraPunteggio label="QI – Qualità Indicizzata" valore={riga.punteggio_qi} colore={C.bluMed} />
              <BarraPunteggio label="DA – Dimensione Attività" valore={riga.punteggio_da} colore={C.verde} />
              <div style={{ marginTop: 14, padding: "12px 16px", background: C.oroChi, borderRadius: 6, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontWeight: 700, color: C.oro }}>Punteggio Totale</span>
                <span style={{ fontWeight: 800, fontSize: 20, color: C.blu, fontFamily: "monospace" }}>{riga.punteggio_tot?.toFixed(2)}</span>
              </div>
              <div style={{ marginTop: 8, padding: "10px 16px", background: C.verdeChi, borderRadius: 6, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontWeight: 700, color: C.verde }}>Contributo assegnato {riga.anno}</span>
                <span style={{ fontWeight: 800, fontSize: 16, color: C.verde, fontFamily: "monospace" }}>{fmt(riga.contributo_assegnato)}</span>
              </div>
            </div>
          </div>

          {/* Storico anni */}
          {!loading && storico.length > 1 && (
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.blu, textTransform: "uppercase", letterSpacing: 1, marginBottom: 14 }}>
                Storico pluriennale
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ background: C.carta }}>
                    {["Anno","Settore","VD","QA","QI","DA","TOT","Contributo"].map(h => (
                      <th key={h} style={{ padding: "8px 10px", textAlign: "left", color: C.grigio, fontSize: 10, textTransform: "uppercase", fontWeight: 600, borderBottom: `1px solid ${C.grigioChi}` }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {storico.map((s, i) => (
                    <tr key={i} style={{ borderBottom: `1px solid ${C.grigioChi}`, background: i % 2 === 0 ? C.bianco : C.carta }}>
                      <td style={{ padding: "8px 10px", fontWeight: 700, color: C.blu, fontFamily: "monospace" }}>{s.anno}</td>
                      <td style={{ padding: "8px 10px", color: C.grigio, fontSize: 11 }}>{s.articolo_dm}</td>
                      {[s.punteggio_vd, s.punteggio_qa, s.punteggio_qi, s.punteggio_da].map((v, vi) => (
                        <td key={vi} style={{ padding: "8px 10px", fontFamily: "monospace", color: C.nero }}>{v?.toFixed(2)}</td>
                      ))}
                      <td style={{ padding: "8px 10px", fontFamily: "monospace", fontWeight: 800, color: C.blu }}>{s.punteggio_tot?.toFixed(2)}</td>
                      <td style={{ padding: "8px 10px", fontFamily: "monospace", fontWeight: 700, color: C.verde }}>{fmt(s.contributo_assegnato)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── TABELLA ASSEGNAZIONI (riutilizzabile) ────────────────────
function TabellaAssegnazioni({ dati, onSelectRiga }) {
  return (
    <div style={{ background: C.bianco, border: `1px solid ${C.grigioChi}`, borderRadius: 8, overflow: "hidden" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
        <thead>
          <tr style={{ background: C.blu }}>
            {["Anno","Organismo","Sede","Regione","Ambito","Art.","TOT","Contributo",""].map(h => (
              <th key={h} style={{ padding: "10px 12px", textAlign: "left", color: C.bianco, fontSize: 10, textTransform: "uppercase", fontWeight: 600, letterSpacing: 0.5 }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {dati.map((d, i) => {
            const isPugBas = d.regione === "Puglia" || d.regione === "Basilicata";
            return (
              <tr key={d.id} style={{ background: isPugBas ? "#FFFBEB" : i % 2 === 0 ? C.bianco : C.carta, borderBottom: `1px solid ${C.grigioChi}`, cursor: "pointer" }}
                onClick={() => onSelectRiga(d)}>
                <td style={{ padding: "9px 12px", fontFamily: "monospace", fontWeight: 700, color: C.blu }}>{d.anno}</td>
                <td style={{ padding: "9px 12px" }}>
                  <div style={{ fontWeight: 600, color: C.nero, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.denominazione}</div>
                  {d.prima_istanza_triennale && <span style={{ fontSize: 9, background: C.oroChi, color: C.oro, padding: "1px 5px", borderRadius: 8, fontWeight: 700 }}>1a istanza</span>}
                </td>
                <td style={{ padding: "9px 12px", color: C.grigio, fontSize: 11, whiteSpace: "nowrap" }}>
                  {d.comune ? `${d.comune} (${d.sigla_provincia})` : "--"}
                </td>
                <td style={{ padding: "9px 12px" }}>
                  {d.regione ? (
                    <span style={{ background: isPugBas ? C.oroChi : C.bluChi, color: isPugBas ? C.oro : C.blu, padding: "2px 8px", borderRadius: 10, fontSize: 10, fontWeight: 700, whiteSpace: "nowrap" }}>
                      {d.regione}
                    </span>
                  ) : <span style={{ color: C.grigioChi, fontSize: 11 }}>--</span>}
                </td>
                <td style={{ padding: "9px 12px", color: C.grigio, fontSize: 11 }}>{d.ambito}</td>
                <td style={{ padding: "9px 12px", color: C.grigio, fontSize: 11 }}>{d.articolo_dm}</td>
                <td style={{ padding: "9px 12px", fontFamily: "monospace", fontWeight: 800, color: C.blu }}>{d.punteggio_tot?.toFixed(2)}</td>
                <td style={{ padding: "9px 12px", fontFamily: "monospace", fontWeight: 700, color: C.verde, whiteSpace: "nowrap" }}>{fmt(d.contributo_assegnato)}</td>
                <td style={{ padding: "9px 12px", color: C.grigioChi, fontSize: 11 }}>›</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {dati.length === 0 && (
        <div style={{ padding: 32, textAlign: "center", color: C.grigio, fontStyle: "italic" }}>Nessun risultato trovato.</div>
      )}
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
      const { data: dec } = await supabase.schema("contributi_mic").from("decreti")
        .select("*, ambito:ambito_id(nome)").order("data", { ascending: false });
      if (ass) {
        const tot25 = ass.filter(a => a.anno === 2025).reduce((s, a) => s + (a.contributo_assegnato || 0), 0);
        const tot26 = ass.filter(a => a.anno === 2026).reduce((s, a) => s + (a.contributo_assegnato || 0), 0);
        setStats({ org: org?.length || 0, dec: dec?.length || 0, tot25, tot26, decreti: dec || [] });
      }
      setLoading(false);
    }
    load();
  }, []);

  if (loading) return <div style={{ padding: 40, color: C.grigio, fontStyle: "italic" }}>Caricamento...</div>;

  return (
    <div>
      <div style={{ background: C.blu, padding: "22px 28px", borderLeft: `4px solid ${C.oro}` }}>
        <div style={{ fontSize: 9, color: C.oro, fontFamily: "monospace", letterSpacing: 2, textTransform: "uppercase" }}>MIC / FNSV — AGIS Puglia e Basilicata</div>
        <div style={{ fontSize: 20, fontWeight: 800, color: C.bianco, marginTop: 6 }}>Gestionale Contributi Spettacolo dal Vivo</div>
        <div style={{ fontSize: 12, color: "#9BB5D4", marginTop: 2 }}>Fondo Nazionale per lo Spettacolo dal Vivo · Triennio 2025/2027</div>
      </div>
      <div style={{ padding: "24px 28px" }}>
        <div style={{ display: "flex", gap: 16, marginBottom: 28 }}>
          {[
            { label: "Organismi censiti", value: stats.org, color: C.blu, bg: C.bluChi },
            { label: "Decreti importati", value: stats.dec, color: C.oro, bg: C.oroChi },
            { label: "Totale 2025", value: fmt(stats.tot25), color: C.verde, bg: C.verdeChi },
            { label: "Totale 2026", value: fmt(stats.tot26), color: C.bluMed, bg: "#EEF2FF" },
          ].map(k => (
            <div key={k.label} style={{ flex: 1, background: k.bg, border: `1px solid ${C.grigioChi}`, borderTop: `3px solid ${k.color}`, borderRadius: 8, padding: "16px 20px" }}>
              <div style={{ fontSize: 10, color: C.grigio, textTransform: "uppercase", letterSpacing: 1, fontFamily: "monospace" }}>{k.label}</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: C.nero, margin: "6px 0 0" }}>{k.value}</div>
            </div>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
          <div style={{ background: C.bianco, border: `1px solid ${C.grigioChi}`, borderRadius: 8, overflow: "hidden" }}>
            <div style={{ padding: "14px 18px", background: C.carta, borderBottom: `1px solid ${C.grigioChi}` }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.nero }}>Decreti importati</div>
            </div>
            {stats.decreti.map(d => (
              <div key={d.id} style={{ padding: "12px 18px", borderBottom: `1px solid ${C.grigioChi}`, display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ background: C.blu, color: C.bianco, borderRadius: 4, padding: "4px 10px", fontSize: 11, fontFamily: "monospace", fontWeight: 800, flexShrink: 0 }}>
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

          <div style={{ background: C.bianco, border: `1px solid ${C.grigioChi}`, borderRadius: 8, padding: 18 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.nero, marginBottom: 16 }}>Copertura dati</div>
            {[
              { label: "Danza 2025", rep: "1074", org: 150, ok: true },
              { label: "Danza 2026", rep: "787", org: 150, ok: true },
              { label: "Circo 2026", rep: "770", org: 47, ok: true },
              { label: "Multidisciplinare 2026", rep: "783", org: 78, ok: true },
              { label: "Musica 2025/2026", rep: "--", ok: false },
              { label: "Teatro 2025/2026", rep: "--", ok: false },
            ].map(r => (
              <div key={r.label} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, padding: "8px 10px", background: r.ok ? C.verdeChi : C.carta, borderRadius: 6 }}>
                <span style={{ fontSize: 14 }}>{r.ok ? "✅" : "⏳"}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: r.ok ? C.nero : C.grigio }}>{r.label}</div>
                  {r.ok && <div style={{ fontSize: 11, color: C.grigio }}>D.D.G. rep. {r.rep} · {r.org} organismi</div>}
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
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    async function load() {
      const { data } = await supabase.schema("contributi_mic").from("v_assegnazioni")
        .select("*").order("anno", { ascending: false }).order("punteggio_tot", { ascending: false }).limit(500);
      setDati(data || []);
      setLoading(false);
    }
    load();
  }, []);

  const anni = ["tutti", ...new Set(dati.map(d => d.anno))];
  const ambiti = ["tutti", ...new Set(dati.map(d => d.ambito).filter(Boolean))];
  const filtrati = dati.filter(d => {
    if (filtroAnno !== "tutti" && d.anno !== parseInt(filtroAnno)) return false;
    if (filtroAmbito !== "tutti" && d.ambito !== filtroAmbito) return false;
    if (cerca && !d.denominazione?.toLowerCase().includes(cerca.toLowerCase())) return false;
    return true;
  });

  if (loading) return <div style={{ padding: 40, color: C.grigio, fontStyle: "italic" }}>Caricamento...</div>;

  return (
    <div style={{ padding: "28px 32px" }}>
      {selected && <ModalOrganismo riga={selected} onClose={() => setSelected(null)} />}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: C.nero, margin: 0 }}>Assegnazioni</h1>
          <p style={{ fontSize: 13, color: C.grigio, margin: "4px 0 0" }}>{filtrati.length} risultati · {fmt(filtrati.reduce((s, d) => s + (d.contributo_assegnato || 0), 0))} · Clicca una riga per il dettaglio</p>
        </div>
      </div>
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <input value={cerca} onChange={e => setCerca(e.target.value)} placeholder="🔍 Cerca organismo..."
          style={{ padding: "8px 14px", borderRadius: 6, border: `1px solid ${C.grigioChi}`, fontSize: 13, width: 240, outline: "none" }} />
        <select value={filtroAnno} onChange={e => setFiltroAnno(e.target.value)}
          style={{ padding: "8px 12px", borderRadius: 6, border: `1px solid ${C.grigioChi}`, fontSize: 13 }}>
          {anni.map(a => <option key={a}>{a}</option>)}
        </select>
        <select value={filtroAmbito} onChange={e => setFiltroAmbito(e.target.value)}
          style={{ padding: "8px 12px", borderRadius: 6, border: `1px solid ${C.grigioChi}`, fontSize: 13 }}>
          {ambiti.map(a => <option key={a}>{a}</option>)}
        </select>
      </div>
      <TabellaAssegnazioni dati={filtrati.slice(0, 300)} onSelectRiga={setSelected} />
      {filtrati.length > 300 && (
        <div style={{ padding: "10px 16px", fontSize: 12, color: C.grigio, textAlign: "center", marginTop: 8 }}>
          Mostrati 300 di {filtrati.length} — usa i filtri per restringere
        </div>
      )}
    </div>
  );
}

// ── PUGLIA & BASILICATA ──────────────────────────────────────
function PugliaBasilicata() {
  const [dati, setDati] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtroAnno, setFiltroAnno] = useState("tutti");
  const [filtroRegione, setFiltroRegione] = useState("tutti");
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    async function load() {
      const { data } = await supabase.schema("contributi_mic").from("v_assegnazioni")
        .select("*").in("regione", ["Puglia", "Basilicata"])
        .order("anno", { ascending: false }).order("punteggio_tot", { ascending: false });
      setDati(data || []);
      setLoading(false);
    }
    load();
  }, []);

  const anni = ["tutti", ...new Set(dati.map(d => d.anno))];
  const filtrati = dati.filter(d => {
    if (filtroAnno !== "tutti" && d.anno !== parseInt(filtroAnno)) return false;
    if (filtroRegione !== "tutti" && d.regione !== filtroRegione) return false;
    return true;
  });

  const totPU = filtrati.filter(d => d.regione === "Puglia").reduce((s, d) => s + (d.contributo_assegnato || 0), 0);
  const totBA = filtrati.filter(d => d.regione === "Basilicata").reduce((s, d) => s + (d.contributo_assegnato || 0), 0);
  const nPU = filtrati.filter(d => d.regione === "Puglia").length;
  const nBA = filtrati.filter(d => d.regione === "Basilicata").length;

  if (loading) return <div style={{ padding: 40, color: C.grigio, fontStyle: "italic" }}>Caricamento...</div>;

  return (
    <div style={{ padding: "28px 32px" }}>
      {selected && <ModalOrganismo riga={selected} onClose={() => setSelected(null)} />}
      <h1 style={{ fontSize: 22, fontWeight: 800, color: C.nero, margin: "0 0 4px" }}>Puglia e Basilicata</h1>
      <p style={{ fontSize: 13, color: C.grigio, margin: "0 0 20px" }}>Organismi finanziati FNSV nelle due regioni · Clicca una riga per il dettaglio punteggi</p>

      <div style={{ display: "flex", gap: 16, marginBottom: 24 }}>
        {[
          { label: "Organismi Puglia", value: nPU, sub: fmt(totPU), color: C.oro, bg: C.oroChi },
          { label: "Organismi Basilicata", value: nBA, sub: fmt(totBA), color: C.verde, bg: C.verdeChi },
          { label: "Totale contributi", value: fmt(totPU + totBA), color: C.blu, bg: C.bluChi },
        ].map(k => (
          <div key={k.label} style={{ flex: 1, background: k.bg, border: `1px solid ${C.grigioChi}`, borderTop: `3px solid ${k.color}`, borderRadius: 8, padding: "16px 20px" }}>
            <div style={{ fontSize: 10, color: C.grigio, textTransform: "uppercase", letterSpacing: 1, fontFamily: "monospace" }}>{k.label}</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: C.nero, margin: "6px 0 2px" }}>{k.value}</div>
            {k.sub && <div style={{ fontSize: 12, color: k.color, fontWeight: 600 }}>{k.sub}</div>}
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
        <select value={filtroAnno} onChange={e => setFiltroAnno(e.target.value)}
          style={{ padding: "8px 12px", borderRadius: 6, border: `1px solid ${C.grigioChi}`, fontSize: 13 }}>
          {anni.map(a => <option key={a}>{a}</option>)}
        </select>
        <select value={filtroRegione} onChange={e => setFiltroRegione(e.target.value)}
          style={{ padding: "8px 12px", borderRadius: 6, border: `1px solid ${C.grigioChi}`, fontSize: 13 }}>
          <option>tutti</option>
          <option>Puglia</option>
          <option>Basilicata</option>
        </select>
      </div>

      <TabellaAssegnazioni dati={filtrati} onSelectRiga={setSelected} />

      {filtrati.length === 0 && (
        <div style={{ marginTop: 16, padding: 20, background: C.oroChi, borderRadius: 8, fontSize: 13, color: C.oro }}>
          ⚠️ I dati geografici vengono completati progressivamente. Attualmente sono collegati {dati.length} organismi pugliesi/lucani.
        </div>
      )}
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
          <div key={d.id} style={{ background: C.bianco, border: `1px solid ${C.grigioChi}`, borderLeft: `4px solid ${C.oro}`, borderRadius: 8, padding: "18px 22px", display: "flex", alignItems: "center", gap: 20 }}>
            <div style={{ background: C.blu, color: C.bianco, borderRadius: 6, padding: "10px 14px", textAlign: "center", flexShrink: 0, fontFamily: "monospace" }}>
              <div style={{ fontSize: 8, color: "#9BB5D4", letterSpacing: 1 }}>D.D.G. REP.</div>
              <div style={{ fontSize: 22, fontWeight: 800, lineHeight: 1 }}>n.{d.numero_rep}</div>
              <div style={{ fontSize: 8, color: C.oro, marginTop: 3 }}>{d.anno_finanziario}</div>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 15, color: C.nero }}>{d.ambito?.nome}</div>
              <div style={{ fontSize: 12, color: C.grigio, marginTop: 4 }}>{d.ente_erogante} · {d.data}</div>
              <div style={{ fontSize: 13, color: C.verde, fontWeight: 700, marginTop: 6 }}>{fmt(d.stanziamento_totale)}</div>
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
    dashboard:         <Dashboard />,
    assegnazioni:      <Assegnazioni />,
    puglia_basilicata: <PugliaBasilicata />,
    decreti:           <Decreti />,
    parser:            <ParserDecreto />,
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

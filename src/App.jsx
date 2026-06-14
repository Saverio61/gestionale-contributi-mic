import { useState, useEffect, useCallback } from "react";
import { supabase } from "./supabaseClient";
import ParserDecreto from "./ParserDecreto";

// ── TOKEN SISTEMA ─────────────────────────────────────────────
// Palette: istituzionale italiano sobrio
// Ispirazione: portali opendata.gov.it, Camera dei Deputati, DG Spettacolo
const T = {
  // Primari
  inchiostro: "#0A1628",   // quasi nero blu
  marino:     "#003D8F",   // blu MIC/istituzionale
  marinoChi:  "#E8EDF7",
  
  // Accenti
  oro:        "#C49A00",   // oro decreto
  oroChi:     "#FDF8E1",
  
  // Funzionali
  verde:      "#1A6B3C",
  verdeChi:   "#E8F5EE",
  rosso:      "#B91C1C",
  rossoChi:   "#FEF2F2",
  
  // Neutri
  sfondo:     "#F5F6F8",   // grigio carta
  bianco:     "#FFFFFF",
  bordo:      "#D9DCE3",
  testo:      "#1F2937",
  muted:      "#6B7280",
  mutedChi:   "#E5E7EB",
};

const fmt = (n) => n != null
  ? new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n)
  : "--";

const mono = { fontFamily: "'Courier New', monospace" };

// ── TOPBAR ────────────────────────────────────────────────────
function Topbar({ sezione, setSezione }) {
  const voci = [
    { id: "dashboard",         label: "Dashboard" },
    { id: "assegnazioni",      label: "Assegnazioni" },
    { id: "puglia_basilicata", label: "Puglia & Basilicata" },
    { id: "decreti",           label: "Decreti" },
    { id: "parser",            label: "Importa" },
  ];
  return (
    <div style={{ background: T.inchiostro, color: T.bianco, flexShrink: 0 }}>
      {/* Fascia istituzionale */}
      <div style={{ background: T.marino, padding: "6px 32px", display: "flex", alignItems: "center", gap: 16 }}>
        <span style={{ fontSize: 11, letterSpacing: 1.5, textTransform: "uppercase", color: "rgba(255,255,255,0.7)", fontWeight: 500 }}>
          Ministero della Cultura · DG Spettacolo
        </span>
        <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 10 }}>|</span>
        <span style={{ fontSize: 11, color: T.oro, letterSpacing: 1, textTransform: "uppercase", fontWeight: 600 }}>
          Fondo Nazionale Spettacolo dal Vivo
        </span>
      </div>
      {/* Navbar principale */}
      <div style={{ padding: "0 32px", display: "flex", alignItems: "stretch", gap: 0 }}>
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, paddingRight: 32, borderRight: "1px solid rgba(255,255,255,0.1)", marginRight: 8 }}>
          <div style={{ width: 32, height: 32, background: T.oro, borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 15, color: T.inchiostro, ...mono }}>G</div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: T.bianco, lineHeight: 1.2 }}>Gestionale Contributi</div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.45)", lineHeight: 1.2 }}>AGIS Puglia e Basilicata</div>
          </div>
        </div>
        {/* Nav voci */}
        {voci.map(v => {
          const attivo = sezione === v.id;
          return (
            <button key={v.id} onClick={() => setSezione(v.id)} style={{
              padding: "18px 18px", border: "none", cursor: "pointer", fontSize: 13,
              background: "transparent", color: attivo ? T.bianco : "rgba(255,255,255,0.5)",
              fontWeight: attivo ? 700 : 400, borderBottom: attivo ? `2px solid ${T.oro}` : "2px solid transparent",
              transition: "all 0.15s", whiteSpace: "nowrap",
            }}>{v.label}</button>
          );
        })}
      </div>
    </div>
  );
}

// ── BARRA PUNTEGGIO ───────────────────────────────────────────
function BarraPunteggio({ label, valore, max = 35, colore }) {
  const pct = Math.min(100, ((valore || 0) / max) * 100);
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 5 }}>
        <span style={{ fontSize: 11, color: T.muted, textTransform: "uppercase", letterSpacing: 0.8, fontWeight: 600 }}>{label}</span>
        <span style={{ fontWeight: 700, color: T.testo, ...mono, fontSize: 13 }}>{valore?.toFixed(2) || "0.00"}<span style={{ color: T.muted, fontWeight: 400 }}>/{max}</span></span>
      </div>
      <div style={{ height: 6, background: T.mutedChi, borderRadius: 3 }}>
        <div style={{ width: `${pct}%`, height: "100%", background: colore, borderRadius: 3, transition: "width 0.5s ease" }} />
      </div>
    </div>
  );
}

// ── BADGE REGIONE ─────────────────────────────────────────────
function BadgeRegione({ regione }) {
  if (!regione) return <span style={{ color: T.mutedChi, fontSize: 11 }}>—</span>;
  const isPugBas = regione === "Puglia" || regione === "Basilicata";
  return (
    <span style={{
      background: isPugBas ? T.oroChi : T.marinoChi,
      color: isPugBas ? T.oro : T.marino,
      padding: "2px 8px", borderRadius: 3, fontSize: 11, fontWeight: 600,
      border: `1px solid ${isPugBas ? T.oro + "50" : T.marino + "30"}`,
      whiteSpace: "nowrap", ...mono,
    }}>{regione}</span>
  );
}

// ── FORM SEDE ─────────────────────────────────────────────────
function FormSede({ organismo_id, onSaved }) {
  const [province, setProvince] = useState([]);
  const [comuni, setComuni] = useState([]);
  const [provSel, setProvSel] = useState("");
  const [comuneSel, setComuneSel] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    supabase.schema("contributi_mic").from("province")
      .select("id, codice, nome, regione:regione_id(nome)").order("nome")
      .then(({ data }) => setProvince(data || []));
  }, []);

  useEffect(() => {
    if (!provSel) { setComuni([]); return; }
    supabase.schema("contributi_mic").from("comuni")
      .select("id, nome").eq("provincia_id", provSel).order("nome")
      .then(({ data }) => setComuni(data || []));
  }, [provSel]);

  async function salva() {
    if (!comuneSel) return;
    setSaving(true);
    const { error } = await supabase.schema("contributi_mic")
      .from("organismi").update({ comune_id: comuneSel }).eq("id", organismo_id);
    setSaving(false);
    if (error) setMsg("Errore: " + error.message);
    else { setMsg("Sede aggiornata."); setTimeout(onSaved, 900); }
  }

  const sel = { padding: "7px 10px", borderRadius: 4, border: `1px solid ${T.bordo}`, fontSize: 12, background: T.bianco, color: T.testo };

  return (
    <div style={{ background: T.marinoChi, border: `1px solid ${T.marino}30`, borderRadius: 6, padding: "14px 16px", marginBottom: 18 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: T.marino, textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>Modifica sede</div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
        <div>
          <div style={{ fontSize: 10, color: T.muted, marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.8 }}>Provincia</div>
          <select value={provSel} onChange={e => { setProvSel(e.target.value); setComuneSel(""); }} style={{ ...sel, minWidth: 200 }}>
            <option value="">— Seleziona —</option>
            {province.map(p => <option key={p.id} value={p.id}>{p.nome} ({p.codice}) · {p.regione?.nome}</option>)}
          </select>
        </div>
        <div>
          <div style={{ fontSize: 10, color: T.muted, marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.8 }}>Comune</div>
          <select value={comuneSel} onChange={e => setComuneSel(e.target.value)} disabled={comuni.length === 0} style={{ ...sel, minWidth: 160, background: comuni.length === 0 ? T.sfondo : T.bianco }}>
            <option value="">— Seleziona —</option>
            {comuni.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </div>
        <button onClick={salva} disabled={!comuneSel || saving}
          style={{ padding: "7px 18px", borderRadius: 4, border: "none", background: comuneSel ? T.marino : T.mutedChi, color: T.bianco, fontSize: 12, fontWeight: 600, cursor: comuneSel ? "pointer" : "default" }}>
          {saving ? "Salvo…" : "Salva"}
        </button>
        {msg && <span style={{ fontSize: 12, color: T.verde, fontWeight: 600 }}>{msg}</span>}
      </div>
    </div>
  );
}

// ── MODAL DETTAGLIO ───────────────────────────────────────────
function ModalOrganismo({ riga, onClose }) {
  const [storico, setStorico] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showSede, setShowSede] = useState(false);
  const [organismoId, setOrganismoId] = useState(null);

  const carica = useCallback(async () => {
    setLoading(true);
    const [{ data: st }, { data: og }] = await Promise.all([
      supabase.schema("contributi_mic").from("v_assegnazioni").select("*").eq("denominazione", riga.denominazione).order("anno"),
      supabase.schema("contributi_mic").from("organismi").select("id").eq("denominazione", riga.denominazione).limit(1),
    ]);
    setStorico(st || []);
    if (og?.[0]) setOrganismoId(og[0].id);
    setLoading(false);
  }, [riga.denominazione]);

  useEffect(() => { carica(); }, [carica]);

  const sedeOk = riga.comune && riga.sigla_provincia;

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(10,22,40,0.7)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: T.bianco, borderRadius: 8, width: "min(780px,100%)", maxHeight: "88vh", overflow: "hidden", display: "flex", flexDirection: "column", boxShadow: "0 24px 80px rgba(0,0,0,0.4)" }}>

        {/* Header modale */}
        <div style={{ background: T.inchiostro, padding: "20px 26px", flexShrink: 0, borderBottom: `3px solid ${T.oro}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div style={{ flex: 1, paddingRight: 16 }}>
              <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
                <span style={{ background: T.oro + "25", color: T.oro, padding: "2px 10px", borderRadius: 3, fontSize: 10, fontWeight: 700, ...mono, textTransform: "uppercase", letterSpacing: 1 }}>{riga.ambito}</span>
                <span style={{ background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.6)", padding: "2px 10px", borderRadius: 3, fontSize: 10, ...mono }}>{riga.articolo_dm}</span>
                {riga.prima_istanza_triennale && <span style={{ background: T.oroChi, color: T.oro, padding: "2px 10px", borderRadius: 3, fontSize: 10, fontWeight: 700 }}>1ª istanza triennale</span>}
              </div>
              {riga.descrizione_settore && riga.descrizione_settore !== riga.articolo_dm && (
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginBottom: 6 }}>{riga.descrizione_settore}</div>
              )}
              <div style={{ fontSize: 16, fontWeight: 700, color: T.bianco, lineHeight: 1.3 }}>{riga.denominazione}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10 }}>
                <span style={{ fontSize: 12, color: sedeOk ? "rgba(255,255,255,0.55)" : T.oro }}>
                  {sedeOk ? `${riga.comune} (${riga.sigla_provincia}) · ${riga.regione}` : "⚠ Sede non registrata"}
                </span>
                <button onClick={() => setShowSede(!showSede)}
                  style={{ fontSize: 10, background: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.7)", border: "none", borderRadius: 3, padding: "3px 8px", cursor: "pointer", ...mono }}>
                  {showSede ? "✕ chiudi" : "✎ modifica sede"}
                </button>
              </div>
            </div>
            <button onClick={onClose} style={{ background: "rgba(255,255,255,0.08)", border: "none", color: "rgba(255,255,255,0.7)", width: 32, height: 32, borderRadius: 4, cursor: "pointer", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>✕</button>
          </div>
        </div>

        <div style={{ overflow: "auto", flex: 1, padding: "22px 26px" }}>
          {showSede && organismoId && <FormSede organismo_id={organismoId} onSaved={() => { setShowSede(false); carica(); }} />}

          {!loading && (
            <>
              {/* Punteggi */}
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 16 }}>Punteggi anno {riga.anno}</div>
                <div style={{ background: T.sfondo, borderRadius: 6, padding: "18px 20px", marginBottom: 12 }}>
                  <BarraPunteggio label="VD – Valore Dimensionale" valore={riga.punteggio_vd} max={35} colore={T.marino} />
                  <BarraPunteggio label="QA – Qualità Artistica" valore={riga.punteggio_qa} max={32} colore={T.oro} />
                  <BarraPunteggio label="QI – Qualità Indicizzata" valore={riga.punteggio_qi} max={30} colore="#6366F1" />
                  <BarraPunteggio label="DA – Dimensione Attività" valore={riga.punteggio_da} max={50} colore={T.verde} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <div style={{ background: T.sfondo, borderRadius: 6, padding: "14px 18px", borderLeft: `3px solid ${T.marino}` }}>
                    <div style={{ fontSize: 10, color: T.muted, textTransform: "uppercase", letterSpacing: 1, fontWeight: 600, marginBottom: 6 }}>Punteggio Totale</div>
                    <div style={{ fontSize: 34, fontWeight: 900, color: T.marino, ...mono }}>{riga.punteggio_tot?.toFixed(2)}</div>
                  </div>
                  <div style={{ background: T.verdeChi, borderRadius: 6, padding: "14px 18px", borderLeft: `3px solid ${T.verde}` }}>
                    <div style={{ fontSize: 10, color: T.verde, textTransform: "uppercase", letterSpacing: 1, fontWeight: 600, marginBottom: 6 }}>Contributo {riga.anno}</div>
                    <div style={{ fontSize: 24, fontWeight: 900, color: T.verde, ...mono }}>{fmt(riga.contributo_assegnato)}</div>
                  </div>
                </div>
              </div>

              {/* Storico */}
              {storico.length > 1 && (
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 14 }}>Storico · {storico.length} annualità</div>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                    <thead>
                      <tr style={{ borderBottom: `2px solid ${T.bordo}` }}>
                        {["Anno","Settore","VD","QA","QI","DA","TOT","Contributo"].map(h => (
                          <th key={h} style={{ padding: "8px 10px", textAlign: "left", color: T.muted, fontSize: 10, textTransform: "uppercase", fontWeight: 700, letterSpacing: 0.8 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {storico.map((s, i) => (
                        <tr key={i} style={{ borderBottom: `1px solid ${T.bordo}`, background: s.anno === riga.anno ? T.oroChi : T.bianco }}>
                          <td style={{ padding: "9px 10px", fontWeight: 800, color: T.marino, ...mono }}>{s.anno}</td>
                          <td style={{ padding: "9px 10px", color: T.muted, fontSize: 11 }}>
                            <div>{s.articolo_dm}</div>
                            {s.descrizione_settore && s.descrizione_settore !== s.articolo_dm && <div style={{ fontSize: 10, color: T.mutedChi }}>{s.descrizione_settore?.substring(0,40)}</div>}
                          </td>
                          {[s.punteggio_vd, s.punteggio_qa, s.punteggio_qi, s.punteggio_da].map((v, vi) => (
                            <td key={vi} style={{ padding: "9px 10px", ...mono, color: T.testo, fontSize: 11 }}>{v?.toFixed(2)}</td>
                          ))}
                          <td style={{ padding: "9px 10px", fontWeight: 800, color: T.marino, ...mono }}>{s.punteggio_tot?.toFixed(2)}</td>
                          <td style={{ padding: "9px 10px", fontWeight: 700, color: T.verde, ...mono }}>{fmt(s.contributo_assegnato)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {storico.length <= 1 && <div style={{ fontSize: 12, color: T.muted, fontStyle: "italic" }}>Dati disponibili solo per l'anno {riga.anno}.</div>}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── TABELLA ASSEGNAZIONI ──────────────────────────────────────
function TabellaAssegnazioni({ dati, onSelectRiga, mostraPunteggi = false }) {
  const th = { padding: "10px 13px", textAlign: "left", color: T.muted, fontSize: 10, textTransform: "uppercase", fontWeight: 700, letterSpacing: 0.8, whiteSpace: "nowrap", borderBottom: `2px solid ${T.bordo}`, background: T.sfondo };
  const td = (extra = {}) => ({ padding: "9px 13px", borderBottom: `1px solid ${T.bordo}`, ...extra });

  return (
    <div style={{ borderRadius: 6, overflow: "hidden", border: `1px solid ${T.bordo}` }}>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: 700 }}>
          <thead>
            <tr>
              <th style={th}>Anno</th>
              <th style={th}>Organismo</th>
              <th style={th}>Sede</th>
              <th style={th}>Regione</th>
              <th style={th}>Ambito</th>
              <th style={th}>Art.</th>
              {mostraPunteggi && <>
                <th style={th}>VD</th><th style={th}>QA</th>
                <th style={th}>QI</th><th style={th}>DA</th>
              </>}
              <th style={{ ...th, textAlign: "right" }}>TOT</th>
              <th style={{ ...th, textAlign: "right" }}>Contributo</th>
              <th style={th}></th>
            </tr>
          </thead>
          <tbody>
            {dati.map((d, i) => {
              const isPugBas = d.regione === "Puglia" || d.regione === "Basilicata";
              const rowBg = isPugBas ? "#FFFCF0" : i % 2 === 0 ? T.bianco : T.sfondo;
              return (
                <tr key={d.id} onClick={() => onSelectRiga(d)}
                  style={{ background: rowBg, cursor: "pointer" }}>
                  <td style={{ ...td(), ...mono, fontWeight: 700, color: T.marino, fontSize: 11 }}>{d.anno}</td>
                  <td style={td()}>
                    <div style={{ fontWeight: 600, color: T.testo, maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.denominazione}</div>
                    {d.prima_istanza_triennale && <span style={{ fontSize: 9, background: T.oroChi, color: T.oro, padding: "1px 5px", borderRadius: 2, fontWeight: 700, ...mono }}>1ª ist.</span>}
                  </td>
                  <td style={{ ...td(), color: d.comune ? T.muted : T.rosso, fontSize: 11, whiteSpace: "nowrap" }}>
                    {d.comune ? `${d.comune} (${d.sigla_provincia})` : "⚠ mancante"}
                  </td>
                  <td style={td()}><BadgeRegione regione={d.regione} /></td>
                  <td style={{ ...td(), color: T.muted, fontSize: 11 }}>{d.ambito}</td>
                  <td style={{ ...td(), color: T.muted, fontSize: 11, ...mono, whiteSpace: "nowrap" }}>{d.articolo_dm}</td>
                  {mostraPunteggi && [d.punteggio_vd, d.punteggio_qa, d.punteggio_qi, d.punteggio_da].map((v, vi) => (
                    <td key={vi} style={{ ...td(), ...mono, fontSize: 11, color: T.testo }}>{v?.toFixed(2)}</td>
                  ))}
                  <td style={{ ...td(), ...mono, fontWeight: 800, color: T.marino, textAlign: "right" }}>{d.punteggio_tot?.toFixed(2)}</td>
                  <td style={{ ...td(), ...mono, fontWeight: 700, color: T.verde, textAlign: "right", whiteSpace: "nowrap" }}>{fmt(d.contributo_assegnato)}</td>
                  <td style={{ ...td(), color: T.mutedChi, fontSize: 14, textAlign: "center" }}>›</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {dati.length === 0 && <div style={{ padding: 40, textAlign: "center", color: T.muted, fontStyle: "italic" }}>Nessun risultato.</div>}
    </div>
  );
}

// ── KPI CARD ──────────────────────────────────────────────────
function KpiCard({ label, value, sub, color, note }) {
  return (
    <div style={{ background: T.bianco, border: `1px solid ${T.bordo}`, borderTop: `3px solid ${color}`, borderRadius: 6, padding: "18px 22px" }}>
      <div style={{ fontSize: 10, color: T.muted, textTransform: "uppercase", letterSpacing: 1.2, fontWeight: 700, marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 900, color: T.testo, ...mono }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: color, fontWeight: 600, marginTop: 4 }}>{sub}</div>}
      {note && <div style={{ fontSize: 11, color: T.muted, marginTop: 4 }}>{note}</div>}
    </div>
  );
}

// ── DASHBOARD ─────────────────────────────────────────────────
function Dashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [{ data: ass }, { data: org }, { data: dec }] = await Promise.all([
        supabase.schema("contributi_mic").from("assegnazioni").select("contributo_assegnato, anno"),
        supabase.schema("contributi_mic").from("organismi").select("id"),
        supabase.schema("contributi_mic").from("decreti").select("*, ambito:ambito_id(nome)").order("data", { ascending: false }),
      ]);
      const tot25 = (ass || []).filter(a => a.anno === 2025).reduce((s, a) => s + (a.contributo_assegnato || 0), 0);
      const tot26 = (ass || []).filter(a => a.anno === 2026).reduce((s, a) => s + (a.contributo_assegnato || 0), 0);
      setStats({ org: org?.length || 0, dec: dec?.length || 0, tot25, tot26, decreti: dec || [] });
      setLoading(false);
    }
    load();
  }, []);

  if (loading) return <div style={{ padding: 48, color: T.muted }}>Caricamento…</div>;

  return (
    <div style={{ padding: "32px 36px" }}>
      {/* KPI */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16, marginBottom: 32 }}>
        <KpiCard label="Organismi censiti" value={stats.org} color={T.marino} />
        <KpiCard label="Decreti importati" value={stats.dec} color={T.oro} />
        <KpiCard label="Contributi 2025" value={fmt(stats.tot25)} color={T.verde} />
        <KpiCard label="Contributi 2026" value={fmt(stats.tot26)} color="#6366F1" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        {/* Decreti */}
        <div style={{ background: T.bianco, border: `1px solid ${T.bordo}`, borderRadius: 6 }}>
          <div style={{ padding: "14px 20px", borderBottom: `1px solid ${T.bordo}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: T.testo }}>Decreti importati</span>
            <span style={{ fontSize: 11, color: T.muted, ...mono }}>{stats.dec} totali</span>
          </div>
          {stats.decreti.map(d => (
            <div key={d.id} style={{ padding: "12px 20px", borderBottom: `1px solid ${T.bordo}`, display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ background: T.inchiostro, color: T.bianco, borderRadius: 4, padding: "4px 10px", fontSize: 11, fontWeight: 800, flexShrink: 0, ...mono }}>{d.numero_rep}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: T.testo }}>{d.ambito?.nome}</div>
                <div style={{ fontSize: 11, color: T.muted }}>Anno {d.anno_finanziario} · {d.data}</div>
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: T.verde, ...mono, whiteSpace: "nowrap" }}>{fmt(d.stanziamento_totale)}</div>
            </div>
          ))}
        </div>

        {/* Copertura */}
        <div style={{ background: T.bianco, border: `1px solid ${T.bordo}`, borderRadius: 6, padding: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: T.testo, marginBottom: 16 }}>Copertura dati</div>
          {[
            { label: "Danza 2025", rep: "1074", org: 150, ok: true },
            { label: "Danza 2026", rep: "787", org: 150, ok: true },
            { label: "Circo e Spett. Viaggiante 2026", rep: "770", org: 47, ok: true },
            { label: "Multidisciplinare 2026", rep: "783", org: 78, ok: true },
            { label: "Musica 2025/2026", ok: false },
            { label: "Teatro 2025/2026", ok: false },
          ].map(r => (
            <div key={r.label} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8, padding: "9px 12px", background: r.ok ? T.verdeChi : T.sfondo, borderRadius: 4, border: `1px solid ${r.ok ? T.verde + "30" : T.bordo}` }}>
              <span style={{ fontSize: 13, flexShrink: 0 }}>{r.ok ? "✓" : "○"}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: r.ok ? 600 : 400, color: r.ok ? T.testo : T.muted }}>{r.label}</div>
                {r.ok && <div style={{ fontSize: 11, color: T.muted, ...mono }}>rep. {r.rep} · {r.org} organismi</div>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── ASSEGNAZIONI ──────────────────────────────────────────────
function Assegnazioni() {
  const [dati, setDati] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtroAnno, setFiltroAnno] = useState("tutti");
  const [filtroAmbito, setFiltroAmbito] = useState("tutti");
  const [cerca, setCerca] = useState("");
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    supabase.schema("contributi_mic").from("v_assegnazioni").select("*")
      .order("anno", { ascending: false }).order("punteggio_tot", { ascending: false }).limit(600)
      .then(({ data }) => { setDati(data || []); setLoading(false); });
  }, []);

  const anni = ["tutti", ...new Set(dati.map(d => d.anno))];
  const ambiti = ["tutti", ...new Set(dati.map(d => d.ambito).filter(Boolean))];
  const filtrati = dati.filter(d =>
    (filtroAnno === "tutti" || d.anno === parseInt(filtroAnno)) &&
    (filtroAmbito === "tutti" || d.ambito === filtroAmbito) &&
    (!cerca || d.denominazione?.toLowerCase().includes(cerca.toLowerCase()))
  );
  const totale = filtrati.reduce((s, d) => s + (d.contributo_assegnato || 0), 0);

  if (loading) return <div style={{ padding: 48, color: T.muted }}>Caricamento…</div>;

  const selStyle = { padding: "7px 10px", borderRadius: 4, border: `1px solid ${T.bordo}`, fontSize: 12, background: T.bianco, color: T.testo };

  return (
    <div style={{ padding: "28px 36px" }}>
      {selected && <ModalOrganismo riga={selected} onClose={() => setSelected(null)} />}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: T.testo, margin: 0 }}>Assegnazioni</h1>
          <p style={{ fontSize: 12, color: T.muted, margin: "4px 0 0" }}>{filtrati.length} risultati · {fmt(totale)} · <em>Clicca una riga per il dettaglio</em></p>
        </div>
      </div>
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <input value={cerca} onChange={e => setCerca(e.target.value)} placeholder="Cerca organismo…"
          style={{ ...selStyle, width: 220, padding: "7px 12px" }} />
        <select value={filtroAnno} onChange={e => setFiltroAnno(e.target.value)} style={selStyle}>
          {anni.map(a => <option key={a}>{a}</option>)}
        </select>
        <select value={filtroAmbito} onChange={e => setFiltroAmbito(e.target.value)} style={selStyle}>
          {ambiti.map(a => <option key={a}>{a}</option>)}
        </select>
      </div>
      <TabellaAssegnazioni dati={filtrati.slice(0, 600)} onSelectRiga={setSelected} />
      {filtrati.length > 600 && <div style={{ padding: "10px", fontSize: 11, color: T.muted, textAlign: "center", marginTop: 8 }}>Mostrati 600 di {filtrati.length} — usa i filtri</div>}
    </div>
  );
}

// ── PUGLIA & BASILICATA ───────────────────────────────────────
function PugliaBasilicata() {
  const [dati, setDati] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtroAnno, setFiltroAnno] = useState("tutti");
  const [filtroRegione, setFiltroRegione] = useState("tutti");
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    supabase.schema("contributi_mic").from("v_assegnazioni").select("*")
      .in("regione", ["Puglia", "Basilicata"])
      .order("anno", { ascending: false }).order("punteggio_tot", { ascending: false })
      .then(({ data }) => { setDati(data || []); setLoading(false); });
  }, []);

  const anni = ["tutti", ...new Set(dati.map(d => d.anno))];
  const filtrati = dati.filter(d =>
    (filtroAnno === "tutti" || d.anno === parseInt(filtroAnno)) &&
    (filtroRegione === "tutti" || d.regione === filtroRegione)
  );
  const totPU = filtrati.filter(d => d.regione === "Puglia").reduce((s, d) => s + (d.contributo_assegnato || 0), 0);
  const totBA = filtrati.filter(d => d.regione === "Basilicata").reduce((s, d) => s + (d.contributo_assegnato || 0), 0);

  if (loading) return <div style={{ padding: 48, color: T.muted }}>Caricamento…</div>;

  const selStyle = { padding: "7px 10px", borderRadius: 4, border: `1px solid ${T.bordo}`, fontSize: 12, background: T.bianco, color: T.testo };

  return (
    <div style={{ padding: "28px 36px" }}>
      {selected && <ModalOrganismo riga={selected} onClose={() => setSelected(null)} />}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: T.testo, margin: 0 }}>Puglia e Basilicata</h1>
        <p style={{ fontSize: 12, color: T.muted, margin: "4px 0 0" }}>Organismi finanziati FNSV · Clicca una riga per il dettaglio punteggi</p>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14, marginBottom: 24 }}>
        <KpiCard label="Puglia" value={filtrati.filter(d => d.regione === "Puglia").length} sub={fmt(totPU)} color={T.oro} />
        <KpiCard label="Basilicata" value={filtrati.filter(d => d.regione === "Basilicata").length} sub={fmt(totBA)} color={T.verde} />
        <KpiCard label="Totale contributi" value={fmt(totPU + totBA)} color={T.marino} />
      </div>
      <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
        <select value={filtroAnno} onChange={e => setFiltroAnno(e.target.value)} style={selStyle}>
          {anni.map(a => <option key={a}>{a}</option>)}
        </select>
        <select value={filtroRegione} onChange={e => setFiltroRegione(e.target.value)} style={selStyle}>
          <option>tutti</option><option>Puglia</option><option>Basilicata</option>
        </select>
      </div>
      <TabellaAssegnazioni dati={filtrati} onSelectRiga={setSelected} mostraPunteggi={true} />
    </div>
  );
}

// ── DECRETI ───────────────────────────────────────────────────
function Decreti() {
  const [dati, setDati] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    supabase.schema("contributi_mic").from("decreti").select("*, ambito:ambito_id(nome)").order("data", { ascending: false })
      .then(({ data }) => { setDati(data || []); setLoading(false); });
  }, []);
  if (loading) return <div style={{ padding: 48, color: T.muted }}>Caricamento…</div>;
  return (
    <div style={{ padding: "28px 36px" }}>
      <h1 style={{ fontSize: 20, fontWeight: 800, color: T.testo, margin: "0 0 22px" }}>Decreti importati</h1>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {dati.map(d => (
          <div key={d.id} style={{ background: T.bianco, border: `1px solid ${T.bordo}`, borderLeft: `3px solid ${T.oro}`, borderRadius: 6, padding: "16px 22px", display: "flex", alignItems: "center", gap: 18 }}>
            <div style={{ background: T.inchiostro, color: T.bianco, borderRadius: 4, padding: "8px 14px", textAlign: "center", flexShrink: 0, ...mono }}>
              <div style={{ fontSize: 8, color: "rgba(255,255,255,0.4)", letterSpacing: 1, textTransform: "uppercase" }}>D.D.G. rep.</div>
              <div style={{ fontSize: 22, fontWeight: 900, lineHeight: 1 }}>{d.numero_rep}</div>
              <div style={{ fontSize: 9, color: T.oro, marginTop: 2 }}>{d.anno_finanziario}</div>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: T.testo }}>{d.ambito?.nome}</div>
              <div style={{ fontSize: 11, color: T.muted, marginTop: 3 }}>{d.ente_erogante} · {d.data}</div>
            </div>
            <div style={{ fontSize: 16, fontWeight: 800, color: T.verde, ...mono }}>{fmt(d.stanziamento_totale)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── APP ───────────────────────────────────────────────────────
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
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh", fontFamily: "'Segoe UI', system-ui, sans-serif", background: T.sfondo }}>
      <Topbar sezione={sezione} setSezione={setSezione} />
      <main style={{ flex: 1, overflow: "auto" }}>
        {contenuto}
      </main>
    </div>
  );
}

import { useState, useEffect, useCallback } from "react";
import { supabase } from "./supabaseClient";
import ParserDecreto from "./ParserDecreto";

const T = {
  inchiostro: "#0A1628", marino: "#003D8F", marinoChi: "#E8EDF7",
  oro: "#C49A00", oroChi: "#FEF3C7",
  verde: "#1A6B3C", verdeChi: "#E8F5EE",
  viola: "#5B21B6", violaChi: "#EDE9FE",
  arancio: "#C2410C", arancioChi: "#FFF0E6",
  sfondo: "#F4F5F7", bianco: "#FFFFFF",
  bordo: "#DDE1E8", testo: "#1A2332",
  muted: "#5E6B7C", mutedChi: "#E4E7EC",
};

const fmt = (n) => n != null ? new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n) : "--";
const mono = { fontFamily: "'Courier New', monospace" };
const SOTTOINSIEMI = ['', 'Primo', 'Secondo', 'Terzo', 'Quarto', 'Quinto'];

const TIPO_COLORS = {
  'MIC_FNSV': { bg: T.marinoChi, color: T.marino, label: 'MIC · FNSV' },
  'REG_PU':   { bg: T.arancioChi, color: T.arancio, label: 'Regione Puglia' },
};

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
    <div style={{ background: T.inchiostro, flexShrink: 0, boxShadow: "0 2px 8px rgba(0,0,0,0.2)" }}>
      <div style={{ background: "#071020", padding: "5px 32px", display: "flex", gap: 20, alignItems: "center" }}>
        <span style={{ fontSize: 10, letterSpacing: 2, textTransform: "uppercase", color: "rgba(255,255,255,0.4)", fontWeight: 500 }}>AGIS Puglia e Basilicata</span>
        <span style={{ color: "rgba(255,255,255,0.15)" }}>·</span>
        <span style={{ fontSize: 10, color: T.oro, letterSpacing: 1.5, textTransform: "uppercase", fontWeight: 600 }}>Gestionale Contributi Spettacolo dal Vivo</span>
      </div>
      <div style={{ padding: "0 32px", display: "flex", alignItems: "stretch" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, paddingRight: 28, borderRight: "1px solid rgba(255,255,255,0.07)", marginRight: 8 }}>
          <div style={{ width: 28, height: 28, background: T.oro, borderRadius: 5, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 13, color: T.inchiostro, ...mono }}>G</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: T.bianco, lineHeight: 1 }}>Gestionale</div>
        </div>
        {voci.map(v => {
          const attivo = sezione === v.id;
          return (
            <button key={v.id} onClick={() => setSezione(v.id)} style={{
              padding: "15px 16px", border: "none", cursor: "pointer", fontSize: 13,
              background: "transparent",
              color: attivo ? T.bianco : "rgba(255,255,255,0.42)",
              fontWeight: attivo ? 700 : 400,
              borderBottom: attivo ? `2px solid ${T.oro}` : "2px solid transparent",
              transition: "all 0.15s", whiteSpace: "nowrap",
            }}>{v.label}</button>
          );
        })}
      </div>
    </div>
  );
}

// ── BADGE ─────────────────────────────────────────────────────
function BadgeRegione({ regione }) {
  if (!regione) return <span style={{ color: T.mutedChi }}>—</span>;
  const isPugBas = regione === "Puglia" || regione === "Basilicata";
  return <span style={{ background: isPugBas ? T.oroChi : T.marinoChi, color: isPugBas ? T.oro : T.marino, padding: "2px 7px", borderRadius: 3, fontSize: 10, fontWeight: 700, border: `1px solid ${isPugBas ? T.oro+"40" : T.marino+"25"}`, whiteSpace: "nowrap", ...mono }}>{regione}</span>;
}

function BadgeTipo({ tipo }) {
  const cfg = TIPO_COLORS[tipo] || { bg: T.mutedChi, color: T.muted, label: tipo };
  return <span style={{ background: cfg.bg, color: cfg.color, padding: "2px 7px", borderRadius: 3, fontSize: 9, fontWeight: 700, border: `1px solid ${cfg.color}30`, whiteSpace: "nowrap", ...mono }}>{cfg.label}</span>;
}

function BadgeSottoinsieme({ n }) {
  if (!n || n <= 1) return null;
  return <span style={{ background: T.violaChi, color: T.viola, padding: "1px 6px", borderRadius: 3, fontSize: 9, fontWeight: 700, ...mono, marginLeft: 4 }}>{SOTTOINSIEMI[n] || n}°</span>;
}

// ── BARRA PUNTEGGIO ───────────────────────────────────────────
function BarraPunteggio({ label, valore, max = 35, colore }) {
  const pct = Math.min(100, ((valore || 0) / max) * 100);
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 5 }}>
        <span style={{ fontSize: 11, color: T.muted, textTransform: "uppercase", letterSpacing: 0.8, fontWeight: 600 }}>{label}</span>
        <span style={{ fontWeight: 700, color: T.testo, ...mono, fontSize: 13 }}>{valore?.toFixed(2) || "0.00"}<span style={{ color: T.muted, fontWeight: 400, fontSize: 11 }}>/{max}</span></span>
      </div>
      <div style={{ height: 7, background: T.mutedChi, borderRadius: 4 }}>
        <div style={{ width: `${pct}%`, height: "100%", background: colore, borderRadius: 4, transition: "width 0.5s ease" }} />
      </div>
    </div>
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
    supabase.schema("contributi_mic").from("province").select("id, codice, nome, regione:regione_id(nome)").order("nome")
      .then(({ data }) => setProvince(data || []));
  }, []);
  useEffect(() => {
    if (!provSel) { setComuni([]); return; }
    supabase.schema("contributi_mic").from("comuni").select("id, nome").eq("provincia_id", provSel).order("nome")
      .then(({ data }) => setComuni(data || []));
  }, [provSel]);

  async function salva() {
    if (!comuneSel) return;
    setSaving(true);
    const { error } = await supabase.schema("contributi_mic").from("organismi").update({ comune_id: comuneSel }).eq("id", organismo_id);
    setSaving(false);
    if (error) setMsg("Errore: " + error.message);
    else { setMsg("Sede aggiornata."); setTimeout(onSaved, 900); }
  }

  const sel = { padding: "7px 10px", borderRadius: 5, border: `1px solid ${T.bordo}`, fontSize: 12, background: T.bianco, color: T.testo };
  return (
    <div style={{ background: T.marinoChi, border: `1px solid ${T.marino}25`, borderRadius: 7, padding: "14px 16px", marginBottom: 18 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: T.marino, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>Modifica sede</div>
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
          style={{ padding: "7px 18px", borderRadius: 5, border: "none", background: comuneSel ? T.marino : T.mutedChi, color: T.bianco, fontSize: 12, fontWeight: 600, cursor: comuneSel ? "pointer" : "default" }}>
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
  const isRegione = riga.tipo_decreto === 'REG_PU';

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
    <div style={{ position: "fixed", inset: 0, background: "rgba(10,22,40,0.72)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: T.bianco, borderRadius: 12, width: "min(800px,100%)", maxHeight: "90vh", overflow: "hidden", display: "flex", flexDirection: "column", boxShadow: "0 32px 80px rgba(0,0,0,0.4)" }}>

        {/* Header */}
        <div style={{ background: `linear-gradient(135deg, ${T.inchiostro} 0%, #1A2E50 100%)`, padding: "20px 26px", flexShrink: 0, borderBottom: `3px solid ${T.oro}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div style={{ flex: 1, paddingRight: 16 }}>
              <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap", alignItems: "center" }}>
                <BadgeTipo tipo={riga.tipo_decreto} />
                <span style={{ background: T.oro+"28", color: T.oro, padding: "2px 10px", borderRadius: 3, fontSize: 10, fontWeight: 700, ...mono, textTransform: "uppercase", letterSpacing: 1 }}>{riga.ambito}</span>
                <span style={{ background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.6)", padding: "2px 10px", borderRadius: 3, fontSize: 10, ...mono }}>{riga.articolo_dm}</span>
                {riga.numero_sottoinsieme > 1 && <BadgeSottoinsieme n={riga.numero_sottoinsieme} />}
                {riga.prima_istanza_triennale && <span style={{ background: T.oroChi, color: T.oro, padding: "2px 10px", borderRadius: 3, fontSize: 10, fontWeight: 700 }}>1ª istanza</span>}
              </div>
              <div style={{ fontSize: 16, fontWeight: 700, color: T.bianco, lineHeight: 1.3 }}>{riga.denominazione}</div>
              {riga.codice_fiscale && <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", marginTop: 4, ...mono }}>CF: {riga.codice_fiscale}</div>}
              {riga.titolo_progetto && <div style={{ fontSize: 11, color: T.oro, marginTop: 5, fontStyle: "italic" }}>{riga.titolo_progetto}</div>}
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10 }}>
                <span style={{ fontSize: 12, color: sedeOk ? "rgba(255,255,255,0.5)" : T.oro }}>
                  {sedeOk ? `${riga.comune} (${riga.sigla_provincia}) · ${riga.regione}` : "⚠ Sede non registrata"}
                </span>
                <button onClick={() => setShowSede(!showSede)}
                  style={{ fontSize: 10, background: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.7)", border: "none", borderRadius: 4, padding: "3px 8px", cursor: "pointer", ...mono }}>
                  {showSede ? "✕ chiudi" : "✎ sede"}
                </button>
              </div>
            </div>
            <button onClick={onClose} style={{ background: "rgba(255,255,255,0.08)", border: "none", color: "rgba(255,255,255,0.6)", width: 32, height: 32, borderRadius: 6, cursor: "pointer", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>✕</button>
          </div>
        </div>

        <div style={{ overflow: "auto", flex: 1, padding: "22px 26px" }}>
          {showSede && organismoId && <FormSede organismo_id={organismoId} onSaved={() => { setShowSede(false); carica(); }} />}

          {!loading && (
            <>
              {/* Punteggi MIC */}
              {!isRegione && (
                <div style={{ marginBottom: 24 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 14 }}>Punteggi MIC — anno {riga.anno}</div>
                  <div style={{ background: T.sfondo, borderRadius: 8, padding: "16px 18px", marginBottom: 12 }}>
                    <BarraPunteggio label="VD – Valore Dimensionale" valore={riga.punteggio_vd} max={35} colore={T.marino} />
                    <BarraPunteggio label="QA – Qualità Artistica" valore={riga.punteggio_qa} max={32} colore={T.oro} />
                    <BarraPunteggio label="QI – Qualità Indicizzata" valore={riga.punteggio_qi} max={30} colore={T.viola} />
                    <BarraPunteggio label="DA – Dimensione Attività" valore={riga.punteggio_da} max={50} colore={T.verde} />
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <div style={{ background: T.sfondo, borderRadius: 8, padding: "14px 18px", borderLeft: `3px solid ${T.marino}` }}>
                      <div style={{ fontSize: 10, color: T.muted, textTransform: "uppercase", letterSpacing: 1, fontWeight: 600, marginBottom: 6 }}>Punteggio Totale</div>
                      <div style={{ fontSize: 32, fontWeight: 900, color: T.marino, ...mono }}>{riga.punteggio_tot?.toFixed(2)}</div>
                      {riga.posizione_graduatoria > 0 && <div style={{ fontSize: 11, color: T.muted, marginTop: 4 }}>Posizione #{riga.posizione_graduatoria}</div>}
                    </div>
                    <div style={{ background: T.verdeChi, borderRadius: 8, padding: "14px 18px", borderLeft: `3px solid ${T.verde}` }}>
                      <div style={{ fontSize: 10, color: T.verde, textTransform: "uppercase", letterSpacing: 1, fontWeight: 600, marginBottom: 6 }}>Contributo MIC {riga.anno}</div>
                      <div style={{ fontSize: 22, fontWeight: 900, color: T.verde, ...mono }}>{fmt(riga.contributo_assegnato)}</div>
                      {riga.stanziamento_totale_settore > 0 && <div style={{ fontSize: 11, color: T.muted, marginTop: 4 }}>Stanziamento settore: {fmt(riga.stanziamento_totale_settore)}</div>}
                    </div>
                  </div>
                </div>
              )}

              {/* Dati Regione */}
              {isRegione && (
                <div style={{ marginBottom: 24 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 14 }}>Contributo Regione Puglia — POC 2021-2027</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginBottom: 12 }}>
                    {[
                      { label: "Contributo base", value: fmt(riga.contributo_base), color: T.marino },
                      { label: "Quota aggiuntiva", value: fmt(riga.quota_aggiuntiva), color: T.viola },
                      { label: "Contributo annuale", value: fmt(riga.contributo_assegnato), color: T.verde },
                    ].map(k => (
                      <div key={k.label} style={{ background: T.sfondo, borderRadius: 8, padding: "14px 16px", borderLeft: `3px solid ${k.color}` }}>
                        <div style={{ fontSize: 10, color: T.muted, textTransform: "uppercase", letterSpacing: 1, fontWeight: 600, marginBottom: 6 }}>{k.label}</div>
                        <div style={{ fontSize: 18, fontWeight: 900, color: k.color, ...mono }}>{k.value}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ background: T.verdeChi, borderRadius: 8, padding: "14px 18px", borderLeft: `3px solid ${T.verde}` }}>
                    <div style={{ fontSize: 10, color: T.verde, textTransform: "uppercase", letterSpacing: 1, fontWeight: 600, marginBottom: 4 }}>Contributo Triennale 2025-2027</div>
                    <div style={{ fontSize: 28, fontWeight: 900, color: T.verde, ...mono }}>{fmt(riga.contributo_assegnato * 3)}</div>
                  </div>
                </div>
              )}

              {/* Storico */}
              {storico.length > 1 && (
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 12 }}>Storico · {storico.length} voci</div>
                  <div style={{ borderRadius: 8, overflow: "hidden", border: `1px solid ${T.bordo}` }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                      <thead>
                        <tr style={{ background: T.sfondo, borderBottom: `2px solid ${T.bordo}` }}>
                          {["Anno","Fonte","Settore","Sott.","VD","QA","QI","DA","TOT","Contributo"].map(h => (
                            <th key={h} style={{ padding: "8px 10px", textAlign: "left", color: T.muted, fontSize: 10, textTransform: "uppercase", fontWeight: 700 }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {storico.map((s, i) => (
                          <tr key={i} style={{ borderBottom: `1px solid ${T.bordo}`, background: s.anno === riga.anno && s.tipo_decreto === riga.tipo_decreto ? T.oroChi : i % 2 === 0 ? T.bianco : T.sfondo }}>
                            <td style={{ padding: "8px 10px", fontWeight: 800, color: T.marino, ...mono }}>{s.anno}</td>
                            <td style={{ padding: "8px 10px" }}><BadgeTipo tipo={s.tipo_decreto} /></td>
                            <td style={{ padding: "8px 10px", color: T.muted, fontSize: 11 }}>{s.articolo_dm}</td>
                            <td style={{ padding: "8px 10px", fontSize: 10 }}>{s.numero_sottoinsieme > 1 ? <BadgeSottoinsieme n={s.numero_sottoinsieme} /> : "—"}</td>
                            {[s.punteggio_vd, s.punteggio_qa, s.punteggio_qi, s.punteggio_da].map((v, vi) => (
                              <td key={vi} style={{ padding: "8px 10px", ...mono, color: T.testo, fontSize: 11 }}>{v?.toFixed(2) || "—"}</td>
                            ))}
                            <td style={{ padding: "8px 10px", fontWeight: 800, color: T.marino, ...mono }}>{s.punteggio_tot?.toFixed(2) || "—"}</td>
                            <td style={{ padding: "8px 10px", fontWeight: 700, color: T.verde, ...mono }}>{fmt(s.contributo_assegnato)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── TABELLA ASSEGNAZIONI ──────────────────────────────────────
function TabellaAssegnazioni({ dati, onSelectRiga, mostraPunteggi = false, mostraSottoinsieme = false }) {
  const [sortCol, setSortCol] = useState("punteggio_tot");
  const [sortDir, setSortDir] = useState("desc");

  function toggleSort(col) {
    if (sortCol === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortCol(col); setSortDir("desc"); }
  }

  const sorted = [...dati].sort((a, b) => {
    const va = a[sortCol], vb = b[sortCol];
    if (va == null) return 1; if (vb == null) return -1;
    if (typeof va === 'string') return sortDir === "asc" ? va.localeCompare(vb) : vb.localeCompare(va);
    return sortDir === "asc" ? (va > vb ? 1 : -1) : (va < vb ? 1 : -1);
  });

  const Th = ({ col, label, right }) => (
    <th onClick={() => col && toggleSort(col)} style={{
      padding: "10px 11px", textAlign: right ? "right" : "left",
      color: sortCol === col ? T.bianco : "rgba(255,255,255,0.5)",
      fontSize: 10, textTransform: "uppercase", fontWeight: 700, letterSpacing: 0.7,
      whiteSpace: "nowrap", cursor: col ? "pointer" : "default",
      background: sortCol === col ? "rgba(255,255,255,0.07)" : "transparent",
      userSelect: "none", borderRight: "1px solid rgba(255,255,255,0.05)",
    }}>
      {label}{col && sortCol === col && <span style={{ marginLeft: 4, opacity: 0.7 }}>{sortDir === "desc" ? "↓" : "↑"}</span>}
    </th>
  );

  return (
    <div style={{ borderRadius: 8, overflow: "hidden", border: `1px solid ${T.bordo}`, boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: 750 }}>
          <thead>
            <tr style={{ background: T.inchiostro }}>
              <Th col="anno" label="Anno" />
              <Th label="Fonte" />
              <Th col="denominazione" label="Organismo" />
              <Th label="Sede" />
              <Th label="Regione" />
              <Th col="ambito" label="Ambito" />
              <Th label="Settore" />
              {mostraSottoinsieme && <Th col="numero_sottoinsieme" label="Sott." />}
              {mostraPunteggi && <><Th col="punteggio_vd" label="VD" right /><Th col="punteggio_qa" label="QA" right /><Th col="punteggio_qi" label="QI" right /><Th col="punteggio_da" label="DA" right /></>}
              <Th col="punteggio_tot" label="TOT" right />
              <Th col="contributo_assegnato" label="Contributo" right />
              <th style={{ padding: "10px 8px", width: 20, background: T.inchiostro }}></th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((d, i) => {
              const isPugBas = d.regione === "Puglia" || d.regione === "Basilicata";
              const isRegione = d.tipo_decreto === "REG_PU";
              const rowBg = isPugBas ? "#FFFBF0" : isRegione ? "#FFF8F5" : i % 2 === 0 ? T.bianco : T.sfondo;
              return (
                <tr key={`${d.id}-${i}`} onClick={() => onSelectRiga(d)}
                  style={{ background: rowBg, borderBottom: `1px solid ${T.bordo}`, cursor: "pointer" }}>
                  <td style={{ padding: "9px 11px", ...mono, fontWeight: 700, color: T.marino, fontSize: 11 }}>{d.anno}</td>
                  <td style={{ padding: "9px 11px" }}><BadgeTipo tipo={d.tipo_decreto} /></td>
                  <td style={{ padding: "9px 11px" }}>
                    <div style={{ fontWeight: 600, color: T.testo, maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.denominazione}</div>
                    {d.prima_istanza_triennale && <span style={{ fontSize: 9, background: T.oroChi, color: T.oro, padding: "1px 5px", borderRadius: 2, fontWeight: 700, ...mono }}>1ª ist.</span>}
                  </td>
                  <td style={{ padding: "9px 11px", color: d.comune ? T.muted : "#FCA5A5", fontSize: 11, whiteSpace: "nowrap" }}>
                    {d.comune ? `${d.comune} (${d.sigla_provincia})` : "⚠ mancante"}
                  </td>
                  <td style={{ padding: "9px 11px" }}><BadgeRegione regione={d.regione} /></td>
                  <td style={{ padding: "9px 11px", color: T.muted, fontSize: 11 }}>{d.ambito}</td>
                  <td style={{ padding: "9px 11px" }}>
                    <div style={{ color: T.muted, fontSize: 10, ...mono, maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.articolo_dm}</div>
                    {d.descrizione_settore && d.descrizione_settore !== d.articolo_dm && (
                      <div style={{ fontSize: 9, color: T.mutedChi, maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.descrizione_settore}</div>
                    )}
                  </td>
                  {mostraSottoinsieme && <td style={{ padding: "9px 11px" }}>{d.numero_sottoinsieme > 1 ? <BadgeSottoinsieme n={d.numero_sottoinsieme} /> : <span style={{ color: T.mutedChi }}>—</span>}</td>}
                  {mostraPunteggi && [d.punteggio_vd, d.punteggio_qa, d.punteggio_qi, d.punteggio_da].map((v, vi) => (
                    <td key={vi} style={{ padding: "9px 8px", ...mono, fontSize: 11, color: T.testo, textAlign: "right" }}>{v > 0 ? v.toFixed(2) : "—"}</td>
                  ))}
                  <td style={{ padding: "9px 11px", ...mono, fontWeight: 800, color: T.marino, textAlign: "right" }}>{d.punteggio_tot > 0 ? d.punteggio_tot.toFixed(2) : "—"}</td>
                  <td style={{ padding: "9px 11px", ...mono, fontWeight: 700, color: T.verde, textAlign: "right", whiteSpace: "nowrap" }}>{fmt(d.contributo_assegnato)}</td>
                  <td style={{ padding: "9px 8px", color: T.mutedChi, fontSize: 16, textAlign: "center" }}>›</td>
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
function KpiCard({ label, value, sub, color, icon }) {
  return (
    <div style={{ background: T.bianco, border: `1px solid ${T.bordo}`, borderRadius: 10, padding: "18px 20px", position: "relative", overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: color }} />
      {icon && <div style={{ fontSize: 22, marginBottom: 8, opacity: 0.8 }}>{icon}</div>}
      <div style={{ fontSize: 10, color: T.muted, textTransform: "uppercase", letterSpacing: 1.2, fontWeight: 700, marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 900, color: T.testo, ...mono }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: color, fontWeight: 600, marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

// ── FILTRI ────────────────────────────────────────────────────
function Filtri({ children, style }) {
  return <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 18, alignItems: "center", ...style }}>{children}</div>;
}

function Sel({ value, onChange, children, style }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)}
      style={{ padding: "7px 11px", borderRadius: 6, border: `1px solid ${T.bordo}`, fontSize: 12, background: T.bianco, color: T.testo, boxShadow: "0 1px 2px rgba(0,0,0,0.04)", ...style }}>
      {children}
    </select>
  );
}

function SearchInput({ value, onChange, placeholder }) {
  return (
    <div style={{ position: "relative" }}>
      <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: T.muted, fontSize: 13, pointerEvents: "none" }}>🔍</span>
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder || "Cerca..."}
        style={{ padding: "7px 12px 7px 32px", borderRadius: 6, border: `1px solid ${T.bordo}`, fontSize: 12, width: 220, outline: "none", background: T.bianco, boxShadow: "0 1px 2px rgba(0,0,0,0.04)", color: T.testo }} />
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
        supabase.schema("contributi_mic").from("decreti").select("*, ambito:ambito_id(nome)").order("anno_finanziario", { ascending: false }).order("data", { ascending: false }),
      ]);
      const mic25 = (ass||[]).filter(a=>a.anno===2025).reduce((s,a)=>s+(a.contributo_assegnato||0),0);
      const mic26 = (ass||[]).filter(a=>a.anno===2026).reduce((s,a)=>s+(a.contributo_assegnato||0),0);
      setStats({ org: org?.length||0, dec: dec?.length||0, mic25, mic26, ass: ass?.length||0, decreti: dec||[] });
      setLoading(false);
    }
    load();
  }, []);

  if (loading) return <div style={{ padding: 48, color: T.muted }}>Caricamento…</div>;

  return (
    <div>
      {/* Hero */}
      <div style={{ background: `linear-gradient(135deg, ${T.inchiostro} 0%, #1E3A6E 100%)`, padding: "28px 36px", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", right: -60, top: -60, width: 250, height: 250, borderRadius: "50%", background: "rgba(196,154,0,0.06)" }} />
        <div style={{ position: "absolute", right: 100, bottom: -80, width: 180, height: 180, borderRadius: "50%", background: "rgba(196,154,0,0.04)" }} />
        <div style={{ position: "relative" }}>
          <div style={{ fontSize: 9, color: T.oro, ...mono, letterSpacing: 3, textTransform: "uppercase", marginBottom: 10, opacity: 0.9 }}>AGIS Puglia e Basilicata · MIC / FNSV / Regione Puglia</div>
          <div style={{ fontSize: 24, fontWeight: 900, color: T.bianco, marginBottom: 4 }}>Gestionale Contributi Spettacolo dal Vivo</div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.45)" }}>Fondo Nazionale per lo Spettacolo dal Vivo · POC Puglia 2021-2027 · Triennio 2025/2027</div>
        </div>
      </div>

      <div style={{ padding: "28px 36px" }}>
        {/* KPI */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 28 }}>
          <KpiCard label="Organismi censiti" value={stats.org} color={T.marino} icon="🏛" />
          <KpiCard label="Decreti importati" value={stats.dec} sub={`${stats.ass} assegnazioni`} color={T.oro} icon="📋" />
          <KpiCard label="Contributi MIC 2025" value={fmt(stats.mic25)} color={T.verde} icon="💶" />
          <KpiCard label="Contributi MIC 2026" value={fmt(stats.mic26)} color={T.viola} icon="💶" />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
          {/* Decreti */}
          <div style={{ background: T.bianco, border: `1px solid ${T.bordo}`, borderRadius: 10, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
            <div style={{ padding: "14px 18px", borderBottom: `1px solid ${T.bordo}`, display: "flex", justifyContent: "space-between", alignItems: "center", background: T.sfondo }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: T.testo }}>Decreti importati</span>
              <span style={{ fontSize: 10, color: T.muted, ...mono }}>{stats.dec} totali</span>
            </div>
            {stats.decreti.map(d => (
              <div key={d.id} style={{ padding: "11px 18px", borderBottom: `1px solid ${T.bordo}`, display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ background: T.inchiostro, color: T.bianco, borderRadius: 5, padding: "3px 9px", fontSize: 11, fontFamily: "monospace", fontWeight: 800, flexShrink: 0 }}>{d.numero_rep?.slice(0,10)}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: T.testo, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.ambito?.nome}</div>
                  <div style={{ fontSize: 10, color: T.muted }}>Anno {d.anno_finanziario} · {d.data} · <BadgeTipo tipo={d.tipo} /></div>
                </div>
                <div style={{ fontSize: 12, fontWeight: 700, color: T.verde, ...mono, whiteSpace: "nowrap" }}>{fmt(d.stanziamento_totale)}</div>
              </div>
            ))}
          </div>

          {/* Copertura */}
          <div style={{ background: T.bianco, border: `1px solid ${T.bordo}`, borderRadius: 10, padding: 18, boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: T.testo, marginBottom: 14 }}>Copertura dati</div>
            {[
              { label: "Danza 2025/2026", rep: "1074/787", ok: true, tipo: "MIC_FNSV" },
              { label: "Circo e Spett. Viaggiante 2025/2026", rep: "1137/770", ok: true, tipo: "MIC_FNSV" },
              { label: "Multidisciplinare 2025/2026", rep: "1173/783", ok: true, tipo: "MIC_FNSV" },
              { label: "Musica 2025", rep: "1125", ok: true, tipo: "MIC_FNSV" },
              { label: "Teatro 2025", rep: "1291", ok: true, tipo: "MIC_FNSV" },
              { label: "Regione Puglia FNSV 2025-2027", rep: "429", ok: true, tipo: "REG_PU" },
              { label: "Musica 2026", ok: false },
              { label: "Teatro 2026", ok: false },
            ].map(r => (
              <div key={r.label} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 7, padding: "8px 12px", background: r.ok ? T.verdeChi : T.sfondo, borderRadius: 6, border: `1px solid ${r.ok ? T.verde+"25" : T.bordo}` }}>
                <span style={{ color: r.ok ? T.verde : T.muted, fontSize: 13, flexShrink: 0 }}>{r.ok ? "✓" : "○"}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: r.ok ? 600 : 400, color: r.ok ? T.testo : T.muted }}>{r.label}</div>
                  {r.ok && <div style={{ fontSize: 10, color: T.muted, display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
                    <span style={{ ...mono }}>rep. {r.rep}</span>
                    {r.tipo && <BadgeTipo tipo={r.tipo} />}
                  </div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── HOOK DATI ─────────────────────────────────────────────────
function useDati(filtriExtra) {
  const [dati, setDati] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let q = supabase.schema("contributi_mic").from("v_assegnazioni").select("*");
    if (filtriExtra?.regioni) q = q.in("regione", filtriExtra.regioni);
    q.order("anno", { ascending: false }).order("contributo_assegnato", { ascending: false }).limit(1000)
      .then(({ data }) => { setDati(data || []); setLoading(false); });
  }, []);
  return { dati, loading };
}

// ── ASSEGNAZIONI ──────────────────────────────────────────────
function Assegnazioni() {
  const { dati, loading } = useDati();
  const [filtroAnno, setFiltroAnno] = useState("tutti");
  const [filtroAmbito, setFiltroAmbito] = useState("tutti");
  const [filtroFonte, setFiltroFonte] = useState("tutti");
  const [cerca, setCerca] = useState("");
  const [selected, setSelected] = useState(null);

  const anni = ["tutti", ...new Set(dati.map(d => d.anno).sort().reverse())];
  const ambiti = ["tutti", ...new Set(dati.map(d => d.ambito).filter(Boolean).sort())];

  const filtrati = dati.filter(d =>
    (filtroAnno === "tutti" || d.anno === parseInt(filtroAnno)) &&
    (filtroAmbito === "tutti" || d.ambito === filtroAmbito) &&
    (filtroFonte === "tutti" || d.tipo_decreto === filtroFonte) &&
    (!cerca || d.denominazione?.toLowerCase().includes(cerca.toLowerCase()) ||
               d.comune?.toLowerCase().includes(cerca.toLowerCase()) ||
               d.codice_fiscale?.includes(cerca))
  );
  const totale = filtrati.reduce((s, d) => s + (d.contributo_assegnato || 0), 0);

  if (loading) return <div style={{ padding: 48, color: T.muted }}>Caricamento…</div>;

  return (
    <div style={{ padding: "28px 36px" }}>
      {selected && <ModalOrganismo riga={selected} onClose={() => setSelected(null)} />}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 900, color: T.testo, margin: 0 }}>Assegnazioni</h1>
        <p style={{ fontSize: 12, color: T.muted, margin: "5px 0 0" }}>{filtrati.length} risultati · {fmt(totale)} · <em>Clicca colonna per ordinare · Clicca riga per dettaglio</em></p>
      </div>
      <Filtri>
        <SearchInput value={cerca} onChange={setCerca} placeholder="Cerca organismo, comune, CF…" />
        <Sel value={filtroAnno} onChange={setFiltroAnno}>{anni.map(a => <option key={a}>{a}</option>)}</Sel>
        <Sel value={filtroAmbito} onChange={setFiltroAmbito}>{ambiti.map(a => <option key={a}>{a}</option>)}</Sel>
        <Sel value={filtroFonte} onChange={setFiltroFonte}>
          <option value="tutti">Tutte le fonti</option>
          <option value="MIC_FNSV">MIC · FNSV</option>
          <option value="REG_PU">Regione Puglia</option>
        </Sel>
      </Filtri>
      <TabellaAssegnazioni dati={filtrati.slice(0, 600)} onSelectRiga={setSelected} mostraSottoinsieme={true} />
      {filtrati.length > 600 && <div style={{ padding: "10px", fontSize: 11, color: T.muted, textAlign: "center", marginTop: 8 }}>Mostrati 600 di {filtrati.length} — usa i filtri</div>}
    </div>
  );
}

// ── PUGLIA & BASILICATA ───────────────────────────────────────
function PugliaBasilicata() {
  const { dati, loading } = useDati({ regioni: ["Puglia", "Basilicata"] });
  const [filtroAnno, setFiltroAnno] = useState("tutti");
  const [filtroRegione, setFiltroRegione] = useState("tutti");
  const [filtroAmbito, setFiltroAmbito] = useState("tutti");
  const [filtroFonte, setFiltroFonte] = useState("tutti");
  const [cerca, setCerca] = useState("");
  const [selected, setSelected] = useState(null);

  const anni = ["tutti", ...new Set(dati.map(d => d.anno).sort().reverse())];
  const ambiti = ["tutti", ...new Set(dati.map(d => d.ambito).filter(Boolean).sort())];

  const filtrati = dati.filter(d =>
    (filtroAnno === "tutti" || d.anno === parseInt(filtroAnno)) &&
    (filtroRegione === "tutti" || d.regione === filtroRegione) &&
    (filtroAmbito === "tutti" || d.ambito === filtroAmbito) &&
    (filtroFonte === "tutti" || d.tipo_decreto === filtroFonte) &&
    (!cerca || d.denominazione?.toLowerCase().includes(cerca.toLowerCase()) ||
               d.comune?.toLowerCase().includes(cerca.toLowerCase()))
  );

  const totPU = filtrati.filter(d => d.regione === "Puglia" && d.tipo_decreto === "MIC_FNSV").reduce((s, d) => s + (d.contributo_assegnato || 0), 0);
  const totBA = filtrati.filter(d => d.regione === "Basilicata").reduce((s, d) => s + (d.contributo_assegnato || 0), 0);
  const totRegPU = filtrati.filter(d => d.tipo_decreto === "REG_PU" && d.anno === 2025).reduce((s, d) => s + (d.contributo_assegnato || 0), 0);

  if (loading) return <div style={{ padding: 48, color: T.muted }}>Caricamento…</div>;

  return (
    <div style={{ padding: "28px 36px" }}>
      {selected && <ModalOrganismo riga={selected} onClose={() => setSelected(null)} />}
      <div style={{ marginBottom: 22 }}>
        <h1 style={{ fontSize: 22, fontWeight: 900, color: T.testo, margin: 0 }}>Puglia e Basilicata</h1>
        <p style={{ fontSize: 12, color: T.muted, margin: "5px 0 0" }}>Contributi MIC/FNSV e Regione Puglia · Clicca colonna per ordinare · Clicca riga per dettaglio</p>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 22 }}>
        <KpiCard label="Puglia — MIC/FNSV" value={fmt(totPU)} color={T.oro} icon="🎭" />
        <KpiCard label="Basilicata — MIC/FNSV" value={fmt(totBA)} color={T.verde} icon="🎭" />
        <KpiCard label="Regione Puglia (ann.)" value={fmt(totRegPU)} color={T.arancio} icon="🏛" />
        <KpiCard label="Risultati filtrati" value={filtrati.length} sub="assegnazioni" color={T.marino} icon="≡" />
      </div>
      <Filtri>
        <SearchInput value={cerca} onChange={setCerca} placeholder="Cerca organismo o comune…" />
        <Sel value={filtroAnno} onChange={setFiltroAnno}>{anni.map(a => <option key={a}>{a}</option>)}</Sel>
        <Sel value={filtroRegione} onChange={setFiltroRegione}>
          <option>tutti</option><option>Puglia</option><option>Basilicata</option>
        </Sel>
        <Sel value={filtroAmbito} onChange={setFiltroAmbito}>{ambiti.map(a => <option key={a}>{a}</option>)}</Sel>
        <Sel value={filtroFonte} onChange={setFiltroFonte}>
          <option value="tutti">Tutte le fonti</option>
          <option value="MIC_FNSV">MIC · FNSV</option>
          <option value="REG_PU">Regione Puglia</option>
        </Sel>
      </Filtri>
      <TabellaAssegnazioni dati={filtrati} onSelectRiga={setSelected} mostraPunteggi={true} mostraSottoinsieme={true} />
    </div>
  );
}

// ── DECRETI ───────────────────────────────────────────────────
function Decreti() {
  const [dati, setDati] = useState([]);
  const [loading, setLoading] = useState(true);
  const [decretoSel, setDecretoSel] = useState(null);
  const [assegnazioni, setAssegnazioni] = useState([]);
  const [loadingAss, setLoadingAss] = useState(false);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    supabase.schema("contributi_mic").from("decreti").select("*, ambito:ambito_id(nome)").order("anno_finanziario", { ascending: false }).order("data", { ascending: false })
      .then(({ data }) => { setDati(data || []); setLoading(false); });
  }, []);

  async function apriDecreto(d) {
    if (decretoSel?.id === d.id) { setDecretoSel(null); setAssegnazioni([]); return; }
    setDecretoSel(d);
    setLoadingAss(true);
    const { data } = await supabase.schema("contributi_mic").from("v_assegnazioni").select("*")
      .eq("numero_rep", d.numero_rep).eq("anno", d.anno_finanziario)
      .order("contributo_assegnato", { ascending: false });
    setAssegnazioni(data || []);
    setLoadingAss(false);
  }

  if (loading) return <div style={{ padding: 48, color: T.muted }}>Caricamento…</div>;

  return (
    <div style={{ padding: "28px 36px" }}>
      {selected && <ModalOrganismo riga={selected} onClose={() => setSelected(null)} />}
      <div style={{ marginBottom: 22 }}>
        <h1 style={{ fontSize: 22, fontWeight: 900, color: T.testo, margin: 0 }}>Decreti importati</h1>
        <p style={{ fontSize: 12, color: T.muted, margin: "5px 0 0" }}>Clicca un decreto per vedere le assegnazioni</p>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {dati.map(d => (
          <div key={d.id}>
            <div onClick={() => apriDecreto(d)}
              style={{ background: T.bianco, border: `1px solid ${decretoSel?.id === d.id ? T.marino : T.bordo}`, borderLeft: `4px solid ${T.oro}`, borderRadius: 8, padding: "14px 20px", display: "flex", alignItems: "center", gap: 16, cursor: "pointer", boxShadow: "0 1px 3px rgba(0,0,0,0.05)", transition: "border-color 0.15s" }}>
              <div style={{ background: T.inchiostro, color: T.bianco, borderRadius: 6, padding: "8px 14px", textAlign: "center", flexShrink: 0, ...mono }}>
                <div style={{ fontSize: 8, color: "rgba(255,255,255,0.35)", letterSpacing: 1 }}>REP.</div>
                <div style={{ fontSize: 20, fontWeight: 900, lineHeight: 1 }}>{d.numero_rep?.slice(0,10)}</div>
                <div style={{ fontSize: 9, color: T.oro, marginTop: 2 }}>{d.anno_finanziario}</div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <span style={{ fontWeight: 700, fontSize: 14, color: T.testo }}>{d.ambito?.nome}</span>
                  <BadgeTipo tipo={d.tipo} />
                </div>
                <div style={{ fontSize: 11, color: T.muted }}>{d.ente_erogante} · {d.data}</div>
              </div>
              <div style={{ fontSize: 16, fontWeight: 800, color: T.verde, ...mono }}>{fmt(d.stanziamento_totale)}</div>
              <div style={{ fontSize: 16, color: T.muted, marginLeft: 8 }}>{decretoSel?.id === d.id ? "▲" : "▼"}</div>
            </div>
            {decretoSel?.id === d.id && (
              <div style={{ border: `1px solid ${T.bordo}`, borderTop: "none", borderRadius: "0 0 8px 8px", background: T.sfondo }}>
                {loadingAss
                  ? <div style={{ padding: 20, color: T.muted, fontStyle: "italic" }}>Caricamento…</div>
                  : <TabellaAssegnazioni dati={assegnazioni} onSelectRiga={setSelected} mostraSottoinsieme={true} />
                }
              </div>
            )}
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
      <main style={{ flex: 1, overflow: "auto" }}>{contenuto}</main>
    </div>
  );
}

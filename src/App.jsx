import { useState, useEffect, useCallback } from "react";
import { supabase } from "./supabaseClient";
import ParserDecreto from "./ParserDecreto";

const T = {
  inchiostro: "#0A1628", marino: "#003D8F", marinoChi: "#E8EDF7",
  oro: "#C49A00", oroChi: "#FDF8E1",
  verde: "#1A6B3C", verdeChi: "#E8F5EE",
  rosso: "#B91C1C", rossoChi: "#FEF2F2",
  sfondo: "#F5F6F8", bianco: "#FFFFFF",
  bordo: "#D9DCE3", testo: "#1F2937",
  muted: "#6B7280", mutedChi: "#E5E7EB",
};
const fmt = (n) => n != null ? new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n) : "--";
const mono = { fontFamily: "'Courier New', monospace" };
const SOTTOINSIEMI = ['', 'Primo', 'Secondo', 'Terzo', 'Quarto', 'Quinto'];

// ── TOPBAR ────────────────────────────────────────────────────
function Topbar({ sezione, setSezione }) {
  const voci = [
    { id: "dashboard", label: "Dashboard" },
    { id: "assegnazioni", label: "Assegnazioni" },
    { id: "puglia_basilicata", label: "Puglia & Basilicata" },
    { id: "decreti", label: "Decreti" },
    { id: "parser", label: "Importa" },
  ];
  return (
    <div style={{ background: T.inchiostro, color: T.bianco, flexShrink: 0 }}>
      <div style={{ background: T.marino, padding: "5px 32px", display: "flex", gap: 16, alignItems: "center" }}>
        <span style={{ fontSize: 11, letterSpacing: 1.5, textTransform: "uppercase", color: "rgba(255,255,255,0.6)", fontWeight: 500 }}>Ministero della Cultura · DG Spettacolo</span>
        <span style={{ color: "rgba(255,255,255,0.25)" }}>|</span>
        <span style={{ fontSize: 11, color: T.oro, letterSpacing: 1, textTransform: "uppercase", fontWeight: 600 }}>Fondo Nazionale Spettacolo dal Vivo</span>
      </div>
      <div style={{ padding: "0 32px", display: "flex", alignItems: "stretch" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, paddingRight: 28, borderRight: "1px solid rgba(255,255,255,0.08)", marginRight: 8 }}>
          <div style={{ width: 30, height: 30, background: T.oro, borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 14, color: T.inchiostro, ...mono }}>G</div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: T.bianco, lineHeight: 1.2 }}>Gestionale Contributi</div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", lineHeight: 1.2 }}>AGIS Puglia e Basilicata</div>
          </div>
        </div>
        {voci.map(v => {
          const attivo = sezione === v.id;
          return (
            <button key={v.id} onClick={() => setSezione(v.id)} style={{
              padding: "16px 16px", border: "none", cursor: "pointer", fontSize: 13,
              background: "transparent", color: attivo ? T.bianco : "rgba(255,255,255,0.45)",
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
  return <span style={{ background: isPugBas ? T.oroChi : T.marinoChi, color: isPugBas ? T.oro : T.marino, padding: "2px 7px", borderRadius: 3, fontSize: 10, fontWeight: 600, border: `1px solid ${isPugBas ? T.oro+"40" : T.marino+"25"}`, whiteSpace: "nowrap", ...mono }}>{regione}</span>;
}

function BadgeSottoinsieme({ n }) {
  if (!n || n <= 1) return null;
  return <span style={{ background: "#EEF2FF", color: "#4F46E5", padding: "1px 6px", borderRadius: 3, fontSize: 9, fontWeight: 700, ...mono, marginLeft: 4 }}>{SOTTOINSIEMI[n] || n}</span>;
}

// ── BARRA PUNTEGGIO ───────────────────────────────────────────
function BarraPunteggio({ label, valore, max = 35, colore }) {
  const pct = Math.min(100, ((valore || 0) / max) * 100);
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
        <span style={{ fontSize: 11, color: T.muted, textTransform: "uppercase", letterSpacing: 0.8, fontWeight: 600 }}>{label}</span>
        <span style={{ fontWeight: 700, color: T.testo, ...mono, fontSize: 13 }}>{valore?.toFixed(2) || "0.00"}<span style={{ color: T.muted, fontWeight: 400 }}>/{max}</span></span>
      </div>
      <div style={{ height: 6, background: T.mutedChi, borderRadius: 3 }}>
        <div style={{ width: `${pct}%`, height: "100%", background: colore, borderRadius: 3, transition: "width 0.5s ease" }} />
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

  const sel = { padding: "7px 10px", borderRadius: 4, border: `1px solid ${T.bordo}`, fontSize: 12, background: T.bianco, color: T.testo };
  return (
    <div style={{ background: T.marinoChi, border: `1px solid ${T.marino}25`, borderRadius: 6, padding: "14px 16px", marginBottom: 18 }}>
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
    <div style={{ position: "fixed", inset: 0, background: "rgba(10,22,40,0.72)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: T.bianco, borderRadius: 8, width: "min(800px,100%)", maxHeight: "88vh", overflow: "hidden", display: "flex", flexDirection: "column", boxShadow: "0 24px 80px rgba(0,0,0,0.4)" }}>

        {/* Header */}
        <div style={{ background: T.inchiostro, padding: "20px 26px", flexShrink: 0, borderBottom: `3px solid ${T.oro}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div style={{ flex: 1, paddingRight: 16 }}>
              <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap", alignItems: "center" }}>
                <span style={{ background: T.oro+"28", color: T.oro, padding: "2px 10px", borderRadius: 3, fontSize: 10, fontWeight: 700, ...mono, textTransform: "uppercase", letterSpacing: 1 }}>{riga.ambito}</span>
                <span style={{ background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.6)", padding: "2px 10px", borderRadius: 3, fontSize: 10, ...mono }}>{riga.articolo_dm}</span>
                {riga.numero_sottoinsieme > 1 && (
                  <span style={{ background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.5)", padding: "2px 10px", borderRadius: 3, fontSize: 10, ...mono }}>
                    {SOTTOINSIEMI[riga.numero_sottoinsieme] || riga.numero_sottoinsieme}° sottoinsieme
                  </span>
                )}
                {riga.prima_istanza_triennale && <span style={{ background: T.oroChi, color: T.oro, padding: "2px 10px", borderRadius: 3, fontSize: 10, fontWeight: 700 }}>1ª istanza triennale</span>}
              </div>
              <div style={{ fontSize: 16, fontWeight: 700, color: T.bianco, lineHeight: 1.3 }}>{riga.denominazione}</div>
              {riga.descrizione_settore && riga.descrizione_settore !== riga.articolo_dm && (
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 4, fontStyle: "italic" }}>{riga.descrizione_settore}</div>
              )}
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10 }}>
                <span style={{ fontSize: 12, color: sedeOk ? "rgba(255,255,255,0.5)" : T.oro }}>
                  {sedeOk ? `${riga.comune} (${riga.sigla_provincia}) · ${riga.regione}` : "⚠ Sede non registrata"}
                </span>
                <button onClick={() => setShowSede(!showSede)}
                  style={{ fontSize: 10, background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.6)", border: "none", borderRadius: 3, padding: "3px 8px", cursor: "pointer", ...mono }}>
                  {showSede ? "✕ chiudi" : "✎ modifica sede"}
                </button>
              </div>
            </div>
            <button onClick={onClose} style={{ background: "rgba(255,255,255,0.08)", border: "none", color: "rgba(255,255,255,0.6)", width: 32, height: 32, borderRadius: 4, cursor: "pointer", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>✕</button>
          </div>
        </div>

        <div style={{ overflow: "auto", flex: 1, padding: "22px 26px" }}>
          {showSede && organismoId && <FormSede organismo_id={organismoId} onSaved={() => { setShowSede(false); carica(); }} />}

          {!loading && (
            <>
              {/* Punteggi */}
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 14 }}>Punteggi anno {riga.anno}</div>
                <div style={{ background: T.sfondo, borderRadius: 6, padding: "16px 18px", marginBottom: 12 }}>
                  <BarraPunteggio label="VD – Valore Dimensionale" valore={riga.punteggio_vd} max={35} colore={T.marino} />
                  <BarraPunteggio label="QA – Qualità Artistica" valore={riga.punteggio_qa} max={32} colore={T.oro} />
                  <BarraPunteggio label="QI – Qualità Indicizzata" valore={riga.punteggio_qi} max={30} colore="#6366F1" />
                  <BarraPunteggio label="DA – Dimensione Attività" valore={riga.punteggio_da} max={50} colore={T.verde} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <div style={{ background: T.sfondo, borderRadius: 6, padding: "14px 18px", borderLeft: `3px solid ${T.marino}` }}>
                    <div style={{ fontSize: 10, color: T.muted, textTransform: "uppercase", letterSpacing: 1, fontWeight: 600, marginBottom: 6 }}>Punteggio Totale</div>
                    <div style={{ fontSize: 34, fontWeight: 900, color: T.marino, ...mono }}>{riga.punteggio_tot?.toFixed(2)}</div>
                    <div style={{ fontSize: 11, color: T.muted, marginTop: 4 }}>Posizione: #{riga.posizione_graduatoria}</div>
                  </div>
                  <div style={{ background: T.verdeChi, borderRadius: 6, padding: "14px 18px", borderLeft: `3px solid ${T.verde}` }}>
                    <div style={{ fontSize: 10, color: T.verde, textTransform: "uppercase", letterSpacing: 1, fontWeight: 600, marginBottom: 6 }}>Contributo {riga.anno}</div>
                    <div style={{ fontSize: 24, fontWeight: 900, color: T.verde, ...mono }}>{fmt(riga.contributo_assegnato)}</div>
                    {riga.stanziamento_totale_settore > 0 && (
                      <div style={{ fontSize: 11, color: T.muted, marginTop: 4 }}>
                        Stanziamento settore: {fmt(riga.stanziamento_totale_settore)}
                        {riga.numero_sottoinsieme > 1 && ` (${SOTTOINSIEMI[riga.numero_sottoinsieme]} sottoinsieme)`}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Storico */}
              {storico.length > 1 && (
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 12 }}>Storico · {storico.length} annualità</div>
                  <div style={{ borderRadius: 6, overflow: "hidden", border: `1px solid ${T.bordo}` }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                      <thead>
                        <tr style={{ borderBottom: `2px solid ${T.bordo}`, background: T.sfondo }}>
                          {["Anno","Settore","Sott.","VD","QA","QI","DA","TOT","Contributo"].map(h => (
                            <th key={h} style={{ padding: "8px 10px", textAlign: "left", color: T.muted, fontSize: 10, textTransform: "uppercase", fontWeight: 700, letterSpacing: 0.8 }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {storico.map((s, i) => (
                          <tr key={i} style={{ borderBottom: `1px solid ${T.bordo}`, background: s.anno === riga.anno ? T.oroChi : i % 2 === 0 ? T.bianco : T.sfondo }}>
                            <td style={{ padding: "9px 10px", fontWeight: 800, color: T.marino, ...mono }}>{s.anno}</td>
                            <td style={{ padding: "9px 10px", color: T.muted, fontSize: 11 }}>
                              <div>{s.articolo_dm}</div>
                              {s.descrizione_settore && s.descrizione_settore !== s.articolo_dm && (
                                <div style={{ fontSize: 9, color: T.mutedChi }}>{s.descrizione_settore?.substring(0,35)}</div>
                              )}
                            </td>
                            <td style={{ padding: "9px 10px", fontSize: 10, color: T.muted, ...mono }}>{s.numero_sottoinsieme > 1 ? SOTTOINSIEMI[s.numero_sottoinsieme] : "—"}</td>
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
function TabellaAssegnazioni({ dati, onSelectRiga, mostraPunteggi = false, mostraSottoinsieme = false }) {
  const [sortCol, setSortCol] = useState("punteggio_tot");
  const [sortDir, setSortDir] = useState("desc");

  function toggleSort(col) {
    if (sortCol === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortCol(col); setSortDir("desc"); }
  }

  const sorted = [...dati].sort((a, b) => {
    const va = a[sortCol], vb = b[sortCol];
    if (va == null) return 1;
    if (vb == null) return -1;
    return sortDir === "asc" ? (va > vb ? 1 : -1) : (va < vb ? 1 : -1);
  });

  const Th = ({ col, label, right }) => (
    <th onClick={() => col && toggleSort(col)} style={{
      padding: "10px 12px", textAlign: right ? "right" : "left",
      color: sortCol === col ? T.bianco : "rgba(255,255,255,0.55)",
      fontSize: 10, textTransform: "uppercase", fontWeight: 700, letterSpacing: 0.8,
      whiteSpace: "nowrap", cursor: col ? "pointer" : "default",
      background: sortCol === col ? "rgba(255,255,255,0.08)" : "transparent",
      userSelect: "none",
    }}>
      {label} {col && sortCol === col && (sortDir === "desc" ? "↓" : "↑")}
    </th>
  );

  return (
    <div style={{ borderRadius: 6, overflow: "hidden", border: `1px solid ${T.bordo}` }}>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: 750 }}>
          <thead>
            <tr style={{ background: "#0A1628" }}>
              <Th col="anno" label="Anno" />
              <Th col="denominazione" label="Organismo" />
              <Th label="Sede" />
              <Th label="Regione" />
              <Th col="ambito" label="Ambito" />
              <Th label="Settore" />
              {mostraSottoinsieme && <Th col="numero_sottoinsieme" label="Sott." />}
              {mostraPunteggi && <>
                <Th col="punteggio_vd" label="VD" right />
                <Th col="punteggio_qa" label="QA" right />
                <Th col="punteggio_qi" label="QI" right />
                <Th col="punteggio_da" label="DA" right />
              </>}
              <Th col="punteggio_tot" label="TOT" right />
              <Th col="contributo_assegnato" label="Contributo" right />
              <th style={{ padding: "10px 8px", width: 20 }}></th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((d, i) => {
              const isPugBas = d.regione === "Puglia" || d.regione === "Basilicata";
              return (
                <tr key={d.id} onClick={() => onSelectRiga(d)}
                  style={{ background: isPugBas ? "#FFFCF0" : i % 2 === 0 ? T.bianco : T.sfondo, borderBottom: `1px solid ${T.bordo}`, cursor: "pointer" }}>
                  <td style={{ padding: "9px 12px", ...mono, fontWeight: 700, color: T.marino, fontSize: 11 }}>{d.anno}</td>
                  <td style={{ padding: "9px 12px" }}>
                    <div style={{ fontWeight: 600, color: T.testo, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.denominazione}</div>
                    {d.prima_istanza_triennale && <span style={{ fontSize: 9, background: T.oroChi, color: T.oro, padding: "1px 5px", borderRadius: 2, fontWeight: 700, ...mono }}>1ª ist.</span>}
                  </td>
                  <td style={{ padding: "9px 12px", color: d.comune ? T.muted : T.rosso, fontSize: 11, whiteSpace: "nowrap" }}>
                    {d.comune ? `${d.comune} (${d.sigla_provincia})` : "⚠ mancante"}
                  </td>
                  <td style={{ padding: "9px 12px" }}><BadgeRegione regione={d.regione} /></td>
                  <td style={{ padding: "9px 12px", color: T.muted, fontSize: 11 }}>{d.ambito}</td>
                  <td style={{ padding: "9px 12px" }}>
                    <div style={{ color: T.muted, fontSize: 10, ...mono, whiteSpace: "nowrap", maxWidth: 150, overflow: "hidden", textOverflow: "ellipsis" }}>{d.articolo_dm}</div>
                    {d.descrizione_settore && d.descrizione_settore !== d.articolo_dm && (
                      <div style={{ fontSize: 10, color: T.muted, maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.descrizione_settore}</div>
                    )}
                  </td>
                  {mostraSottoinsieme && (
                    <td style={{ padding: "9px 12px", fontSize: 10, color: T.muted, ...mono }}>
                      {d.numero_sottoinsieme > 1 ? <BadgeSottoinsieme n={d.numero_sottoinsieme} /> : <span style={{ color: T.mutedChi }}>—</span>}
                    </td>
                  )}
                  {mostraPunteggi && [d.punteggio_vd, d.punteggio_qa, d.punteggio_qi, d.punteggio_da].map((v, vi) => (
                    <td key={vi} style={{ padding: "9px 10px", ...mono, fontSize: 11, color: T.testo, textAlign: "right" }}>{v?.toFixed(2)}</td>
                  ))}
                  <td style={{ padding: "9px 12px", ...mono, fontWeight: 800, color: T.marino, textAlign: "right" }}>{d.punteggio_tot?.toFixed(2)}</td>
                  <td style={{ padding: "9px 12px", ...mono, fontWeight: 700, color: T.verde, textAlign: "right", whiteSpace: "nowrap" }}>{fmt(d.contributo_assegnato)}</td>
                  <td style={{ padding: "9px 8px", color: T.mutedChi, fontSize: 14, textAlign: "center" }}>›</td>
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
function KpiCard({ label, value, sub, color }) {
  return (
    <div style={{ background: T.bianco, border: `1px solid ${T.bordo}`, borderTop: `3px solid ${color}`, borderRadius: 6, padding: "16px 20px" }}>
      <div style={{ fontSize: 10, color: T.muted, textTransform: "uppercase", letterSpacing: 1.2, fontWeight: 700, marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 900, color: T.testo, ...mono }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: color, fontWeight: 600, marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

// ── FUNZIONI REPORT ──────────────────────────────────────────
function generaCSV(dati) {
  const headers = ["Anno","Organismo","Comune","Provincia","Regione","Ambito","Articolo","Settore","Sottoinsieme","VD","QA","QI","DA","TOT","Contributo"];
  const rows = dati.map(d => [
    d.anno, `"${d.denominazione}"`, `"${d.comune||''}"`, d.sigla_provincia||'', d.regione||'',
    d.ambito, d.articolo_dm, `"${d.descrizione_settore||''}"`,
    d.numero_sottoinsieme||1,
    d.punteggio_vd, d.punteggio_qa, d.punteggio_qi, d.punteggio_da, d.punteggio_tot,
    d.contributo_assegnato
  ]);
  const csv = [headers, ...rows].map(r => r.join(";")).join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url;
  a.download = `assegnazioni_puglia_basilicata_${new Date().toISOString().slice(0,10)}.csv`;
  a.click(); URL.revokeObjectURL(url);
}

function generaReportPDF(dati, regione, anno, ambito) {
  const fmt2 = (n) => n != null ? new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n) : "--";
  const totale = dati.reduce((s, d) => s + (d.contributo_assegnato || 0), 0);
  const totPU = dati.filter(d => d.regione === "Puglia").reduce((s, d) => s + (d.contributo_assegnato || 0), 0);
  const totBA = dati.filter(d => d.regione === "Basilicata").reduce((s, d) => s + (d.contributo_assegnato || 0), 0);
  
  const titolo = `Report FNSV — ${regione === "tutti" ? "Puglia e Basilicata" : regione} — ${anno === "tutti" ? "Tutti gli anni" : anno} — ${ambito === "tutti" ? "Tutti gli ambiti" : ambito}`;
  
  const righe = dati.map(d => `
    <tr style="border-bottom:1px solid #E5E7EB; background:${d.regione==="Puglia"?"#FFFCF0":"#F8FFF8"}">
      <td style="padding:6px 8px;font-weight:700;color:#003D8F;font-family:monospace">${d.anno}</td>
      <td style="padding:6px 8px;font-weight:600">${d.denominazione}</td>
      <td style="padding:6px 8px;color:#6B7280;font-size:11px">${d.comune||"--"} ${d.sigla_provincia ? "("+d.sigla_provincia+")" : ""}</td>
      <td style="padding:6px 8px"><span style="background:${d.regione==="Puglia"?"#FDF8E1":"#E8F5EE"};color:${d.regione==="Puglia"?"#C49A00":"#1A6B3C"};padding:2px 6px;border-radius:3px;font-size:10px;font-weight:700">${d.regione||"--"}</span></td>
      <td style="padding:6px 8px;color:#6B7280;font-size:11px">${d.ambito}</td>
      <td style="padding:6px 8px;font-family:monospace;font-size:11px">${d.articolo_dm}</td>
      <td style="padding:6px 8px;font-family:monospace;text-align:right">${d.punteggio_vd?.toFixed(2)||"--"}</td>
      <td style="padding:6px 8px;font-family:monospace;text-align:right">${d.punteggio_qa?.toFixed(2)||"--"}</td>
      <td style="padding:6px 8px;font-family:monospace;text-align:right">${d.punteggio_qi?.toFixed(2)||"--"}</td>
      <td style="padding:6px 8px;font-family:monospace;text-align:right">${d.punteggio_da?.toFixed(2)||"--"}</td>
      <td style="padding:6px 8px;font-family:monospace;font-weight:800;color:#003D8F;text-align:right">${d.punteggio_tot?.toFixed(2)||"--"}</td>
      <td style="padding:6px 8px;font-family:monospace;font-weight:700;color:#1A6B3C;text-align:right">${fmt2(d.contributo_assegnato)}</td>
    </tr>`).join("");

  const html = `<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="UTF-8">
<title>${titolo}</title>
<style>
  body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 20px; color: #1F2937; font-size: 12px; }
  @media print { body { padding: 10px; } .no-print { display: none; } }
  h1 { font-size: 18px; color: #003D8F; margin: 0 0 4px; }
  .sub { color: #6B7280; font-size: 12px; margin-bottom: 16px; }
  .kpi { display: flex; gap: 16px; margin-bottom: 20px; }
  .kpi-card { background: #F5F6F8; border: 1px solid #D9DCE3; border-top: 3px solid #003D8F; border-radius: 6px; padding: 12px 16px; flex: 1; }
  .kpi-label { font-size: 10px; color: #6B7280; text-transform: uppercase; letter-spacing: 1px; font-weight: 700; }
  .kpi-value { font-size: 20px; font-weight: 900; font-family: monospace; margin-top: 4px; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; }
  thead tr { background: #0A1628; color: white; }
  th { padding: 8px; text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 700; }
  th.right { text-align: right; }
  .footer { margin-top: 20px; font-size: 10px; color: #9CA3AF; border-top: 1px solid #E5E7EB; padding-top: 10px; }
  button.print-btn { background: #003D8F; color: white; border: none; padding: 8px 20px; border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: 700; margin-bottom: 16px; }
</style>
</head>
<body>
<button class="print-btn no-print" onclick="window.print()">🖨 Stampa / Salva PDF</button>
<div style="background:#0A1628;color:white;padding:14px 18px;margin-bottom:16px;border-radius:6px;border-left:4px solid #C49A00">
  <div style="font-size:9px;color:#C49A00;letter-spacing:2px;text-transform:uppercase;margin-bottom:6px">MIC / FNSV — AGIS Puglia e Basilicata</div>
  <h1 style="color:white;margin:0 0 4px">${titolo}</h1>
  <div style="color:rgba(255,255,255,0.55);font-size:11px">Generato il ${new Date().toLocaleDateString("it-IT")} · ${dati.length} organismi</div>
</div>
<div class="kpi">
  <div class="kpi-card"><div class="kpi-label">Organimi totali</div><div class="kpi-value">${dati.length}</div></div>
  <div class="kpi-card" style="border-top-color:#C49A00"><div class="kpi-label">Puglia</div><div class="kpi-value" style="color:#C49A00">${fmt2(totPU)}</div></div>
  <div class="kpi-card" style="border-top-color:#1A6B3C"><div class="kpi-label">Basilicata</div><div class="kpi-value" style="color:#1A6B3C">${fmt2(totBA)}</div></div>
  <div class="kpi-card"><div class="kpi-label">Totale</div><div class="kpi-value">${fmt2(totale)}</div></div>
</div>
<table>
  <thead><tr>
    <th>Anno</th><th>Organismo</th><th>Sede</th><th>Regione</th><th>Ambito</th><th>Art.</th>
    <th class="right">VD</th><th class="right">QA</th><th class="right">QI</th><th class="right">DA</th>
    <th class="right">TOT</th><th class="right">Contributo</th>
  </tr></thead>
  <tbody>${righe}</tbody>
  <tfoot><tr style="background:#F5F6F8;border-top:2px solid #D9DCE3">
    <td colspan="11" style="padding:8px;font-weight:700;color:#1F2937">TOTALE (${dati.length} organismi)</td>
    <td style="padding:8px;font-family:monospace;font-weight:900;color:#1A6B3C;text-align:right">${fmt2(totale)}</td>
  </tr></tfoot>
</table>
<div class="footer">AGIS Puglia e Basilicata · Elaborazione su dati MIC / DG Spettacolo · Fondo Nazionale per lo Spettacolo dal Vivo</div>
</body></html>`;

  const blob = new Blob([html], { type: "text/html;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank");
}

// ── DASHBOARD ─────────────────────────────────────────────────────
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
      const tot25 = (ass||[]).filter(a=>a.anno===2025).reduce((s,a)=>s+(a.contributo_assegnato||0),0);
      const tot26 = (ass||[]).filter(a=>a.anno===2026).reduce((s,a)=>s+(a.contributo_assegnato||0),0);
      setStats({ org: org?.length||0, dec: dec?.length||0, tot25, tot26, decreti: dec||[], ass: ass?.length||0 });
      setLoading(false);
    }
    load();
  }, []);

  if (loading) return <div style={{ padding: 48, color: T.muted }}>Caricamento…</div>;

  return (
    <div style={{ padding: "32px 36px" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16, marginBottom: 28 }}>
        <KpiCard label="Organismi censiti" value={stats.org} color={T.marino} />
        <KpiCard label="Decreti importati" value={stats.dec} color={T.oro} />
        <KpiCard label="Contributi 2025" value={fmt(stats.tot25)} color={T.verde} />
        <KpiCard label="Contributi 2026" value={fmt(stats.tot26)} color="#6366F1" />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        <div style={{ background: T.bianco, border: `1px solid ${T.bordo}`, borderRadius: 6 }}>
          <div style={{ padding: "13px 18px", borderBottom: `1px solid ${T.bordo}`, display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: T.testo }}>Decreti importati</span>
            <span style={{ fontSize: 11, color: T.muted, ...mono }}>{stats.ass} assegnazioni totali</span>
          </div>
          {stats.decreti.map(d => (
            <div key={d.id} style={{ padding: "11px 18px", borderBottom: `1px solid ${T.bordo}`, display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ background: T.inchiostro, color: T.bianco, borderRadius: 4, padding: "3px 9px", fontSize: 11, fontWeight: 800, flexShrink: 0, ...mono }}>{d.numero_rep}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: T.testo }}>{d.ambito?.nome}</div>
                <div style={{ fontSize: 11, color: T.muted }}>Anno {d.anno_finanziario} · {d.data}</div>
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: T.verde, ...mono, whiteSpace: "nowrap" }}>{fmt(d.stanziamento_totale)}</div>
            </div>
          ))}
        </div>
        <div style={{ background: T.bianco, border: `1px solid ${T.bordo}`, borderRadius: 6, padding: 18 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: T.testo, marginBottom: 14 }}>Copertura dati</div>
          {[
            { label: "Danza 2025", rep: "1074", org: 150, ok: true },
            { label: "Danza 2026", rep: "787", org: 150, ok: true },
            { label: "Circo e Spett. Viaggiante 2026", rep: "770", org: 98, ok: true },
            { label: "Multidisciplinare 2026", rep: "783", org: 78, ok: true },
            { label: "Musica 2025/2026", ok: false },
            { label: "Teatro 2025/2026", ok: false },
          ].map(r => (
            <div key={r.label} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 7, padding: "8px 12px", background: r.ok ? T.verdeChi : T.sfondo, borderRadius: 4, border: `1px solid ${r.ok ? T.verde+"25" : T.bordo}` }}>
              <span style={{ color: r.ok ? T.verde : T.muted, fontSize: 13 }}>{r.ok ? "✓" : "○"}</span>
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

// ── HOOK DATI ASSEGNAZIONI ────────────────────────────────────
function useDatiAssegnazioni(filtriExtra) {
  const [dati, setDati] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let q = supabase.schema("contributi_mic").from("v_assegnazioni").select("*");
    if (filtriExtra?.regioni) q = q.in("regione", filtriExtra.regioni);
    q.order("anno", { ascending: false }).order("punteggio_tot", { ascending: false }).limit(600)
      .then(({ data }) => { setDati(data || []); setLoading(false); });
  }, []);

  return { dati, loading };
}

// ── ASSEGNAZIONI ──────────────────────────────────────────────
function Assegnazioni() {
  const { dati, loading } = useDatiAssegnazioni();
  const [filtroAnno, setFiltroAnno] = useState("tutti");
  const [filtroAmbito, setFiltroAmbito] = useState("tutti");
  const [cerca, setCerca] = useState("");
  const [selected, setSelected] = useState(null);

  const anni = ["tutti", ...new Set(dati.map(d => d.anno))];
  const ambiti = ["tutti", ...new Set(dati.map(d => d.ambito).filter(Boolean))];
  const filtrati = dati.filter(d =>
    (filtroAnno === "tutti" || d.anno === parseInt(filtroAnno)) &&
    (filtroAmbito === "tutti" || d.ambito === filtroAmbito) &&
    (!cerca || d.denominazione?.toLowerCase().includes(cerca.toLowerCase()) ||
               d.comune?.toLowerCase().includes(cerca.toLowerCase()))
  );
  const totale = filtrati.reduce((s, d) => s + (d.contributo_assegnato || 0), 0);

  if (loading) return <div style={{ padding: 48, color: T.muted }}>Caricamento…</div>;

  const sel = { padding: "7px 10px", borderRadius: 4, border: `1px solid ${T.bordo}`, fontSize: 12, background: T.bianco, color: T.testo };

  return (
    <div style={{ padding: "28px 36px" }}>
      {selected && <ModalOrganismo riga={selected} onClose={() => setSelected(null)} />}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: T.testo, margin: 0 }}>Assegnazioni</h1>
        <p style={{ fontSize: 12, color: T.muted, margin: "4px 0 0" }}>{filtrati.length} risultati · {fmt(totale)} · <em>Clicca colonna per ordinare · Clicca riga per dettaglio</em></p>
      </div>
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <input value={cerca} onChange={e => setCerca(e.target.value)} placeholder="Cerca organismo o comune…" style={{ ...sel, width: 240 }} />
        <select value={filtroAnno} onChange={e => setFiltroAnno(e.target.value)} style={sel}>{anni.map(a => <option key={a}>{a}</option>)}</select>
        <select value={filtroAmbito} onChange={e => setFiltroAmbito(e.target.value)} style={sel}>{ambiti.map(a => <option key={a}>{a}</option>)}</select>
      </div>
      <TabellaAssegnazioni dati={filtrati.slice(0, 600)} onSelectRiga={setSelected} mostraSottoinsieme={true} />
      {filtrati.length > 600 && <div style={{ padding: "10px", fontSize: 11, color: T.muted, textAlign: "center", marginTop: 8 }}>Mostrati 600 di {filtrati.length} — usa i filtri</div>}
    </div>
  );
}

// ── PUGLIA & BASILICATA ───────────────────────────────────────
function PugliaBasilicata() {
  const { dati, loading } = useDatiAssegnazioni({ regioni: ["Puglia", "Basilicata"] });
  const [filtroAnno, setFiltroAnno] = useState("tutti");
  const [filtroRegione, setFiltroRegione] = useState("tutti");
  const [filtroAmbito, setFiltroAmbito] = useState("tutti");
  const [cerca, setCerca] = useState("");
  const [selected, setSelected] = useState(null);

  const anni = ["tutti", ...new Set(dati.map(d => d.anno))];
  const ambiti = ["tutti", ...new Set(dati.map(d => d.ambito).filter(Boolean))];
  const filtrati = dati.filter(d =>
    (filtroAnno === "tutti" || d.anno === parseInt(filtroAnno)) &&
    (filtroRegione === "tutti" || d.regione === filtroRegione) &&
    (filtroAmbito === "tutti" || d.ambito === filtroAmbito) &&
    (!cerca || d.denominazione?.toLowerCase().includes(cerca.toLowerCase()) ||
               d.comune?.toLowerCase().includes(cerca.toLowerCase()))
  );
  const totPU = filtrati.filter(d => d.regione === "Puglia").reduce((s, d) => s + (d.contributo_assegnato || 0), 0);
  const totBA = filtrati.filter(d => d.regione === "Basilicata").reduce((s, d) => s + (d.contributo_assegnato || 0), 0);

  if (loading) return <div style={{ padding: 48, color: T.muted }}>Caricamento…</div>;

  const sel = { padding: "7px 10px", borderRadius: 4, border: `1px solid ${T.bordo}`, fontSize: 12, background: T.bianco, color: T.testo };

  return (
    <div style={{ padding: "28px 36px" }}>
      {selected && <ModalOrganismo riga={selected} onClose={() => setSelected(null)} />}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: T.testo, margin: 0 }}>Puglia e Basilicata</h1>
        <p style={{ fontSize: 12, color: T.muted, margin: "4px 0 0" }}>Organismi finanziati FNSV · Clicca colonna per ordinare · Clicca riga per dettaglio</p>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14, marginBottom: 22 }}>
        <KpiCard label="Puglia" value={filtrati.filter(d => d.regione === "Puglia").length} sub={fmt(totPU)} color={T.oro} />
        <KpiCard label="Basilicata" value={filtrati.filter(d => d.regione === "Basilicata").length} sub={fmt(totBA)} color={T.verde} />
        <KpiCard label="Totale contributi" value={fmt(totPU + totBA)} color={T.marino} />
      </div>
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <input value={cerca} onChange={e => setCerca(e.target.value)} placeholder="Cerca organismo o comune…" style={{ ...sel, width: 220 }} />
        <select value={filtroAnno} onChange={e => setFiltroAnno(e.target.value)} style={sel}>{anni.map(a => <option key={a}>{a}</option>)}</select>
        <select value={filtroRegione} onChange={e => setFiltroRegione(e.target.value)} style={sel}>
          <option>tutti</option><option>Puglia</option><option>Basilicata</option>
        </select>
        <select value={filtroAmbito} onChange={e => setFiltroAmbito(e.target.value)} style={sel}>{ambiti.map(a => <option key={a}>{a}</option>)}</select>
      </div>
      <TabellaAssegnazioni dati={filtrati} onSelectRiga={setSelected} mostraPunteggi={true} mostraSottoinsieme={true} />
      
      {/* Pulsante Report PDF */}
      <div style={{ marginTop: 20, display: "flex", gap: 10 }}>
        <button onClick={() => generaReportPDF(filtrati, filtroRegione, filtroAnno, filtroAmbito)}
          style={{ padding: "10px 22px", borderRadius: 5, border: "none", background: T.marino, color: T.bianco, fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
          📄 Genera Report PDF
        </button>
        <button onClick={() => generaCSV(filtrati)}
          style={{ padding: "10px 22px", borderRadius: 5, border: `1px solid ${T.bordo}`, background: T.bianco, color: T.testo, fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
          📊 Esporta CSV
        </button>
      </div>
    </div>
  );
}

// ── DECRETI ───────────────────────────────────────────────────
function Decreti() {
  const [dati, setDati] = useState([]);
  const [loading, setLoading] = useState(true);
  const [decretoSelezionato, setDecretoSelezionato] = useState(null);
  const [assegnazioni, setAssegnazioni] = useState([]);
  const [loadingAss, setLoadingAss] = useState(false);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    supabase.schema("contributi_mic").from("decreti").select("*, ambito:ambito_id(nome)").order("data", { ascending: false })
      .then(({ data }) => { setDati(data || []); setLoading(false); });
  }, []);

  async function apriDecreto(d) {
    if (decretoSelezionato?.id === d.id) { setDecretoSelezionato(null); setAssegnazioni([]); return; }
    setDecretoSelezionato(d);
    setLoadingAss(true);
    const { data } = await supabase.schema("contributi_mic").from("v_assegnazioni")
      .select("*").eq("anno", d.anno_finanziario)
      .order("punteggio_tot", { ascending: false });
    // Filtra per ambito
    const filtered = (data || []).filter(a => a.ambito_codice === d.ambito?.codice || true);
    setAssegnazioni(data || []);
    setLoadingAss(false);
  }

  if (loading) return <div style={{ padding: 48, color: T.muted }}>Caricamento…</div>;

  return (
    <div style={{ padding: "28px 36px" }}>
      {selected && <ModalOrganismo riga={selected} onClose={() => setSelected(null)} />}
      <h1 style={{ fontSize: 20, fontWeight: 800, color: T.testo, margin: "0 0 20px" }}>Decreti importati</h1>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {dati.map(d => (
          <div key={d.id}>
            <div onClick={() => apriDecreto(d)} style={{ background: T.bianco, border: `1px solid ${decretoSelezionato?.id === d.id ? T.marino : T.bordo}`, borderLeft: `3px solid ${T.oro}`, borderRadius: 6, padding: "15px 20px", display: "flex", alignItems: "center", gap: 16, cursor: "pointer" }}>
              <div style={{ background: T.inchiostro, color: T.bianco, borderRadius: 4, padding: "8px 14px", textAlign: "center", flexShrink: 0, ...mono }}>
                <div style={{ fontSize: 8, color: "rgba(255,255,255,0.35)", letterSpacing: 1 }}>D.D.G. REP.</div>
                <div style={{ fontSize: 22, fontWeight: 900, lineHeight: 1 }}>{d.numero_rep}</div>
                <div style={{ fontSize: 9, color: T.oro, marginTop: 2 }}>{d.anno_finanziario}</div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: T.testo }}>{d.ambito?.nome}</div>
                <div style={{ fontSize: 11, color: T.muted, marginTop: 3 }}>{d.ente_erogante} · {d.data}</div>
              </div>
              <div style={{ fontSize: 16, fontWeight: 800, color: T.verde, ...mono }}>{fmt(d.stanziamento_totale)}</div>
              <div style={{ fontSize: 18, color: T.muted }}>{decretoSelezionato?.id === d.id ? "▲" : "▼"}</div>
            </div>
            {decretoSelezionato?.id === d.id && (
              <div style={{ border: `1px solid ${T.bordo}`, borderTop: "none", borderRadius: "0 0 6px 6px", background: T.sfondo }}>
                {loadingAss ? (
                  <div style={{ padding: 20, color: T.muted, fontStyle: "italic" }}>Caricamento assegnazioni…</div>
                ) : (
                  <TabellaAssegnazioni dati={assegnazioni} onSelectRiga={setSelected} mostraSottoinsieme={true} />
                )}
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

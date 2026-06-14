import { useState, useEffect, useCallback } from "react";
import { supabase } from "./supabaseClient";
import ParserDecreto from "./ParserDecreto";

const C = {
  blu: "#1A3A5C", bluMed: "#2A5A8C", bluChi: "#EBF2FA",
  oro: "#B8860B", oroChi: "#FEF3C7",
  carta: "#F8F6F1", sfondo: "#F0EDE6",
  grigio: "#6B7280", grigioChi: "#E5E7EB", grigioMed: "#9CA3AF",
  verde: "#166534", verdeChi: "#DCFCE7",
  bianco: "#FFFFFF", nero: "#111827",
  rosso: "#991B1B", rossoChi: "#FEE2E2",
  accent: "#2563EB",
};

const fmt = (n) => n != null
  ? new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n)
  : "--";

// ── SIDEBAR ──────────────────────────────────────────────────
function Sidebar({ sezione, setSezione }) {
  const voci = [
    { id: "dashboard",         label: "Dashboard",          icon: "⊞" },
    { id: "assegnazioni",      label: "Assegnazioni",       icon: "≡" },
    { id: "puglia_basilicata", label: "Puglia & Basilicata",icon: "◎" },
    { id: "decreti",           label: "Decreti",            icon: "▤" },
    { id: "parser",            label: "Importa decreto",    icon: "↑" },
  ];
  return (
    <div style={{ width: 220, minHeight: "100vh", background: "#0F2440", display: "flex", flexDirection: "column", flexShrink: 0 }}>
      {/* Logo */}
      <div style={{ padding: "28px 22px 22px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <div style={{ width: 36, height: 36, background: C.oro, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 900, color: "#0F2440" }}>G</div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: C.bianco, lineHeight: 1.2 }}>Gestionale</div>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.bianco, lineHeight: 1.2 }}>Contributi MIC</div>
          </div>
        </div>
        <div style={{ fontSize: 10, color: "#4A6A8A", letterSpacing: 1, textTransform: "uppercase" }}>AGIS Puglia e Basilicata</div>
      </div>

      {/* Separatore */}
      <div style={{ height: 1, background: "rgba(255,255,255,0.06)", margin: "0 22px" }} />

      {/* Nav */}
      <nav style={{ flex: 1, padding: "12px 10px" }}>
        {voci.map(v => {
          const attivo = sezione === v.id;
          return (
            <button key={v.id} onClick={() => setSezione(v.id)} style={{
              display: "flex", alignItems: "center", gap: 10, width: "100%",
              padding: "10px 12px", marginBottom: 2, borderRadius: 8,
              background: attivo ? "rgba(184,134,11,0.2)" : "transparent",
              color: attivo ? C.bianco : "#6B8EAE",
              border: attivo ? `1px solid rgba(184,134,11,0.3)` : "1px solid transparent",
              cursor: "pointer", fontSize: 13, textAlign: "left", fontWeight: attivo ? 700 : 400,
              transition: "all 0.15s",
            }}>
              <span style={{ fontSize: 14, width: 20, textAlign: "center", opacity: attivo ? 1 : 0.7 }}>{v.icon}</span>
              {v.label}
              {attivo && <div style={{ marginLeft: "auto", width: 5, height: 5, borderRadius: "50%", background: C.oro }} />}
            </button>
          );
        })}
      </nav>

      <div style={{ height: 1, background: "rgba(255,255,255,0.06)", margin: "0 22px" }} />
      <div style={{ padding: "14px 22px", fontSize: 10, color: "#3A5A7A" }}>
        v1.0 · Admin
      </div>
    </div>
  );
}

// ── BARRA PUNTEGGIO ──────────────────────────────────────────
function BarraPunteggio({ label, valore, max = 35, colore }) {
  const pct = Math.min(100, ((valore || 0) / max) * 100);
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 5 }}>
        <span style={{ color: C.grigio }}>{label}</span>
        <span style={{ fontWeight: 700, color: C.nero, fontFamily: "monospace" }}>{valore?.toFixed(2) || "0.00"} / {max}</span>
      </div>
      <div style={{ height: 8, background: C.grigioChi, borderRadius: 6, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: colore, borderRadius: 6, transition: "width 0.6s ease" }} />
      </div>
    </div>
  );
}

// ── BADGE REGIONE ────────────────────────────────────────────
function BadgeRegione({ regione }) {
  if (!regione) return <span style={{ color: C.grigioChi, fontSize: 11 }}>--</span>;
  const isPugBas = regione === "Puglia" || regione === "Basilicata";
  return (
    <span style={{
      background: isPugBas ? C.oroChi : C.bluChi,
      color: isPugBas ? C.oro : C.bluMed,
      padding: "3px 9px", borderRadius: 20, fontSize: 10, fontWeight: 700, whiteSpace: "nowrap",
      border: isPugBas ? `1px solid ${C.oro}40` : `1px solid ${C.bluMed}30`,
    }}>{regione}</span>
  );
}

// ── FORM SEDE ────────────────────────────────────────────────
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
    else { setMsg("✅ Salvato!"); setTimeout(onSaved, 900); }
  }

  return (
    <div style={{ background: C.bluChi, border: `1px solid ${C.bluMed}30`, borderRadius: 10, padding: 16, marginBottom: 20 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: C.blu, marginBottom: 12 }}>✏️ Modifica sede organismo</div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
        <div>
          <div style={{ fontSize: 11, color: C.grigio, marginBottom: 4 }}>Provincia</div>
          <select value={provSel} onChange={e => { setProvSel(e.target.value); setComuneSel(""); }}
            style={{ padding: "8px 12px", borderRadius: 6, border: `1px solid ${C.grigioChi}`, fontSize: 12, minWidth: 200, background: C.bianco }}>
            <option value="">— Seleziona provincia —</option>
            {province.map(p => (
              <option key={p.id} value={p.id}>{p.nome} ({p.codice}) · {p.regione?.nome}</option>
            ))}
          </select>
        </div>
        <div>
          <div style={{ fontSize: 11, color: C.grigio, marginBottom: 4 }}>Comune</div>
          <select value={comuneSel} onChange={e => setComuneSel(e.target.value)} disabled={!provSel || comuni.length === 0}
            style={{ padding: "8px 12px", borderRadius: 6, border: `1px solid ${C.grigioChi}`, fontSize: 12, minWidth: 160, background: !provSel ? C.sfondo : C.bianco }}>
            <option value="">— Seleziona comune —</option>
            {comuni.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </div>
        <button onClick={salva} disabled={!comuneSel || saving}
          style={{ padding: "8px 20px", borderRadius: 6, border: "none", background: comuneSel ? C.blu : C.grigioChi, color: C.bianco, fontSize: 12, fontWeight: 700, cursor: comuneSel ? "pointer" : "default" }}>
          {saving ? "Salvo..." : "Salva"}
        </button>
      </div>
      {msg && <div style={{ marginTop: 10, fontSize: 12, color: C.verde, fontWeight: 600 }}>{msg}</div>}
      <div style={{ marginTop: 10, fontSize: 11, color: C.grigio }}>
        Se il comune non è in lista, aggiungilo prima dal SQL Editor di Supabase.
      </div>
    </div>
  );
}

// ── MODAL DETTAGLIO ORGANISMO ────────────────────────────────
function ModalOrganismo({ riga, onClose }) {
  const [storico, setStorico] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showFormSede, setShowFormSede] = useState(false);

  // Troviamo l'id dell'organismo dalla denominazione
  const [organismoId, setOrganismoId] = useState(null);

  const caricaDati = useCallback(async () => {
    setLoading(true);
    const [{ data: storicoData }, { data: orgData }] = await Promise.all([
      supabase.schema("contributi_mic").from("v_assegnazioni")
        .select("*").eq("denominazione", riga.denominazione).order("anno"),
      supabase.schema("contributi_mic").from("organismi")
        .select("id").eq("denominazione", riga.denominazione).limit(1),
    ]);
    setStorico(storicoData || []);
    if (orgData && orgData.length > 0) setOrganismoId(orgData[0].id);
    setLoading(false);
  }, [riga.denominazione]);

  useEffect(() => { caricaDati(); }, [caricaDati]);

  const sedeOk = riga.comune && riga.sigla_provincia;

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(15,36,64,0.65)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, backdropFilter: "blur(3px)" }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: C.bianco, borderRadius: 14, width: "min(760px,100%)", maxHeight: "88vh", overflow: "hidden", display: "flex", flexDirection: "column", boxShadow: "0 32px 80px rgba(0,0,0,0.35)" }}>

        {/* Header */}
        <div style={{ background: "linear-gradient(135deg, #0F2440 0%, #1A3A5C 100%)", padding: "22px 26px", flexShrink: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div style={{ flex: 1, paddingRight: 16 }}>
              <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
                <span style={{ background: C.oro + "30", color: C.oro, padding: "3px 10px", borderRadius: 20, fontSize: 10, fontWeight: 700 }}>{riga.ambito}</span>
                <span style={{ background: "rgba(255,255,255,0.1)", color: "#9BB5D4", padding: "3px 10px", borderRadius: 20, fontSize: 10 }}>{riga.articolo_dm}</span>
                {riga.prima_istanza_triennale && <span style={{ background: "#FEF3C7", color: C.oro, padding: "3px 10px", borderRadius: 20, fontSize: 10, fontWeight: 700 }}>1a istanza triennale</span>}
              </div>
              <div style={{ fontSize: 17, fontWeight: 800, color: C.bianco, lineHeight: 1.3 }}>{riga.denominazione}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}>
                <span style={{ fontSize: 12, color: sedeOk ? "#9BB5D4" : "#F59E0B" }}>
                  {sedeOk ? `📍 ${riga.comune} (${riga.sigla_provincia}) · ${riga.regione}` : "⚠️ Sede non registrata"}
                </span>
                <button onClick={() => setShowFormSede(!showFormSede)}
                  style={{ fontSize: 10, background: "rgba(255,255,255,0.12)", color: C.bianco, border: "none", borderRadius: 5, padding: "3px 9px", cursor: "pointer" }}>
                  {showFormSede ? "✕ Chiudi" : "✏️ Modifica sede"}
                </button>
              </div>
            </div>
            <button onClick={onClose}
              style={{ background: "rgba(255,255,255,0.1)", border: "none", color: C.bianco, width: 34, height: 34, borderRadius: 8, cursor: "pointer", fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              ✕
            </button>
          </div>
        </div>

        <div style={{ overflow: "auto", flex: 1, padding: "22px 26px" }}>

          {showFormSede && organismoId && (
            <FormSede organismo_id={organismoId} onSaved={() => { setShowFormSede(false); caricaDati(); }} />
          )}

          {!loading && (
            <>
              {/* Punteggi */}
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.grigioMed, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 16 }}>
                  Punteggi anno {riga.anno}
                </div>
                <div style={{ background: C.sfondo, borderRadius: 10, padding: "18px 20px" }}>
                  <BarraPunteggio label="VD – Valore Dimensionale" valore={riga.punteggio_vd} max={35} colore={C.blu} />
                  <BarraPunteggio label="QA – Qualità Artistica" valore={riga.punteggio_qa} max={32} colore={C.oro} />
                  <BarraPunteggio label="QI – Qualità Indicizzata" valore={riga.punteggio_qi} max={30} colore={C.bluMed} />
                  <BarraPunteggio label="DA – Dimensione Attività" valore={riga.punteggio_da} max={50} colore={C.verde} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
                  <div style={{ background: C.sfondo, borderRadius: 10, padding: "16px 20px", borderLeft: `4px solid ${C.blu}` }}>
                    <div style={{ fontSize: 10, color: C.grigioMed, textTransform: "uppercase", letterSpacing: 1, fontWeight: 700 }}>Punteggio Totale</div>
                    <div style={{ fontSize: 32, fontWeight: 900, color: C.blu, fontFamily: "monospace", marginTop: 4 }}>{riga.punteggio_tot?.toFixed(2)}</div>
                  </div>
                  <div style={{ background: C.verdeChi, borderRadius: 10, padding: "16px 20px", borderLeft: `4px solid ${C.verde}` }}>
                    <div style={{ fontSize: 10, color: C.verde, textTransform: "uppercase", letterSpacing: 1, fontWeight: 700 }}>Contributo {riga.anno}</div>
                    <div style={{ fontSize: 24, fontWeight: 900, color: C.verde, fontFamily: "monospace", marginTop: 4 }}>{fmt(riga.contributo_assegnato)}</div>
                  </div>
                </div>
              </div>

              {/* Storico */}
              {storico.length > 1 && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: C.grigioMed, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 14 }}>
                    Storico pluriennale · {storico.length} annualità
                  </div>
                  <div style={{ borderRadius: 10, overflow: "hidden", border: `1px solid ${C.grigioChi}` }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                      <thead>
                        <tr style={{ background: C.sfondo }}>
                          {["Anno","Settore","VD","QA","QI","DA","TOT","Contributo"].map(h => (
                            <th key={h} style={{ padding: "9px 11px", textAlign: "left", color: C.grigioMed, fontSize: 10, textTransform: "uppercase", fontWeight: 700, letterSpacing: 0.5, borderBottom: `1px solid ${C.grigioChi}` }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {storico.map((s, i) => (
                          <tr key={i} style={{ background: s.anno === riga.anno ? C.oroChi : i % 2 === 0 ? C.bianco : C.carta, borderBottom: `1px solid ${C.grigioChi}` }}>
                            <td style={{ padding: "9px 11px", fontWeight: 800, color: C.blu, fontFamily: "monospace" }}>{s.anno}</td>
                            <td style={{ padding: "9px 11px", color: C.grigio, fontSize: 11 }}>{s.articolo_dm}</td>
                            {[s.punteggio_vd, s.punteggio_qa, s.punteggio_qi, s.punteggio_da].map((v, vi) => (
                              <td key={vi} style={{ padding: "9px 11px", fontFamily: "monospace", color: C.nero, fontSize: 11 }}>{v?.toFixed(2)}</td>
                            ))}
                            <td style={{ padding: "9px 11px", fontFamily: "monospace", fontWeight: 800, color: C.blu }}>{s.punteggio_tot?.toFixed(2)}</td>
                            <td style={{ padding: "9px 11px", fontFamily: "monospace", fontWeight: 700, color: C.verde }}>{fmt(s.contributo_assegnato)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              {storico.length <= 1 && (
                <div style={{ padding: "12px 16px", background: C.sfondo, borderRadius: 8, fontSize: 12, color: C.grigio }}>
                  Dati disponibili solo per l'anno {riga.anno}.
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── TABELLA ASSEGNAZIONI ─────────────────────────────────────
function TabellaAssegnazioni({ dati, onSelectRiga, mostraPunteggi = false }) {
  const colonne = mostraPunteggi
    ? ["Anno","Organismo","Sede","Regione","Ambito","Art.","VD","QA","QI","DA","TOT","Contributo"]
    : ["Anno","Organismo","Sede","Regione","Ambito","Art.","TOT","Contributo"];

  return (
    <div style={{ borderRadius: 10, overflow: "hidden", border: `1px solid ${C.grigioChi}`, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: 700 }}>
          <thead>
            <tr style={{ background: "#0F2440" }}>
              {colonne.map(h => (
                <th key={h} style={{ padding: "11px 13px", textAlign: "left", color: "rgba(255,255,255,0.7)", fontSize: 10, textTransform: "uppercase", fontWeight: 700, letterSpacing: 0.8, whiteSpace: "nowrap" }}>{h}</th>
              ))}
              <th style={{ padding: "11px 8px", width: 20 }}></th>
            </tr>
          </thead>
          <tbody>
            {dati.map((d, i) => {
              const isPugBas = d.regione === "Puglia" || d.regione === "Basilicata";
              return (
                <tr key={d.id} onClick={() => onSelectRiga(d)}
                  style={{ background: isPugBas ? "#FFFBEB" : i % 2 === 0 ? C.bianco : C.carta, borderBottom: `1px solid ${C.grigioChi}`, cursor: "pointer" }}>
                  <td style={{ padding: "9px 13px", fontFamily: "monospace", fontWeight: 800, color: C.blu, whiteSpace: "nowrap" }}>{d.anno}</td>
                  <td style={{ padding: "9px 13px" }}>
                    <div style={{ fontWeight: 600, color: C.nero, maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.denominazione}</div>
                    {d.prima_istanza_triennale && <span style={{ fontSize: 9, background: C.oroChi, color: C.oro, padding: "1px 6px", borderRadius: 10, fontWeight: 700 }}>1a ist.</span>}
                  </td>
                  <td style={{ padding: "9px 13px", color: d.comune ? C.grigio : "#FCA5A5", fontSize: 11, whiteSpace: "nowrap" }}>
                    {d.comune ? `${d.comune} (${d.sigla_provincia})` : "⚠️ mancante"}
                  </td>
                  <td style={{ padding: "9px 13px" }}><BadgeRegione regione={d.regione} /></td>
                  <td style={{ padding: "9px 13px", color: C.grigio, fontSize: 11, whiteSpace: "nowrap" }}>{d.ambito}</td>
                  <td style={{ padding: "9px 13px", color: C.grigioMed, fontSize: 11, whiteSpace: "nowrap" }}>{d.articolo_dm}</td>
                  {mostraPunteggi && [d.punteggio_vd, d.punteggio_qa, d.punteggio_qi, d.punteggio_da].map((v, vi) => (
                    <td key={vi} style={{ padding: "9px 9px", fontFamily: "monospace", color: C.nero, fontSize: 11 }}>{v?.toFixed(2)}</td>
                  ))}
                  <td style={{ padding: "9px 13px", fontFamily: "monospace", fontWeight: 800, color: C.blu, whiteSpace: "nowrap" }}>{d.punteggio_tot?.toFixed(2)}</td>
                  <td style={{ padding: "9px 13px", fontFamily: "monospace", fontWeight: 700, color: C.verde, whiteSpace: "nowrap" }}>{fmt(d.contributo_assegnato)}</td>
                  <td style={{ padding: "9px 8px", color: C.grigioChi, fontSize: 16 }}>›</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {dati.length === 0 && (
        <div style={{ padding: 40, textAlign: "center", color: C.grigioMed, fontStyle: "italic" }}>Nessun risultato trovato.</div>
      )}
    </div>
  );
}

// ── FILTRI ───────────────────────────────────────────────────
function Filtri({ cerca, setCerca, filtroAnno, setFiltroAnno, filtroAmbito, setFiltroAmbito, anni, ambiti, extra }) {
  return (
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 18, alignItems: "center" }}>
      <div style={{ position: "relative" }}>
        <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: C.grigioMed, fontSize: 13 }}>🔍</span>
        <input value={cerca} onChange={e => setCerca(e.target.value)} placeholder="Cerca organismo..."
          style={{ padding: "8px 12px 8px 32px", borderRadius: 8, border: `1px solid ${C.grigioChi}`, fontSize: 13, width: 220, outline: "none", background: C.bianco, boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }} />
      </div>
      {[
        { value: filtroAnno, set: setFiltroAnno, opts: anni, placeholder: "Anno" },
        { value: filtroAmbito, set: setFiltroAmbito, opts: ambiti, placeholder: "Ambito" },
      ].map((f, i) => (
        <select key={i} value={f.value} onChange={e => f.set(e.target.value)}
          style={{ padding: "8px 12px", borderRadius: 8, border: `1px solid ${C.grigioChi}`, fontSize: 13, background: C.bianco, boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
          {f.opts.map(a => <option key={a}>{a}</option>)}
        </select>
      ))}
      {extra}
    </div>
  );
}

// ── DASHBOARD ────────────────────────────────────────────────
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

  if (loading) return <div style={{ padding: 48, color: C.grigioMed, fontStyle: "italic" }}>Caricamento...</div>;

  return (
    <div>
      {/* Hero */}
      <div style={{ background: "linear-gradient(135deg, #0F2440 0%, #1A3A5C 100%)", padding: "28px 32px", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", right: -40, top: -40, width: 200, height: 200, borderRadius: "50%", background: "rgba(184,134,11,0.08)" }} />
        <div style={{ position: "absolute", right: 80, bottom: -60, width: 150, height: 150, borderRadius: "50%", background: "rgba(184,134,11,0.05)" }} />
        <div style={{ position: "relative" }}>
          <div style={{ fontSize: 10, color: C.oro, fontFamily: "monospace", letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>MIC / FNSV — AGIS Puglia e Basilicata</div>
          <div style={{ fontSize: 22, fontWeight: 900, color: C.bianco }}>Gestionale Contributi Spettacolo dal Vivo</div>
          <div style={{ fontSize: 13, color: "#6B8EAE", marginTop: 4 }}>Fondo Nazionale per lo Spettacolo dal Vivo · Triennio 2025/2027</div>
        </div>
      </div>

      <div style={{ padding: "24px 32px" }}>
        {/* KPI */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 28 }}>
          {[
            { label: "Organismi censiti", value: stats.org, color: C.blu, bg: C.bluChi, icon: "🏛" },
            { label: "Decreti importati", value: stats.dec, color: C.oro, bg: C.oroChi, icon: "📋" },
            { label: "Totale 2025", value: fmt(stats.tot25), color: C.verde, bg: C.verdeChi, icon: "💶" },
            { label: "Totale 2026", value: fmt(stats.tot26), color: C.accent, bg: "#EEF2FF", icon: "💶" },
          ].map(k => (
            <div key={k.label} style={{ background: k.bg, border: `1px solid ${k.color}20`, borderRadius: 12, padding: "18px 20px", borderTop: `3px solid ${k.color}` }}>
              <div style={{ fontSize: 10, color: C.grigioMed, textTransform: "uppercase", letterSpacing: 1, fontFamily: "monospace", marginBottom: 8 }}>{k.icon} {k.label}</div>
              <div style={{ fontSize: 22, fontWeight: 900, color: C.nero }}>{k.value}</div>
            </div>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
          {/* Decreti */}
          <div style={{ background: C.bianco, border: `1px solid ${C.grigioChi}`, borderRadius: 12, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            <div style={{ padding: "14px 18px", borderBottom: `1px solid ${C.grigioChi}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.nero }}>Decreti importati</div>
              <span style={{ fontSize: 10, color: C.grigioMed, fontFamily: "monospace" }}>{stats.dec} totali</span>
            </div>
            {stats.decreti.map(d => (
              <div key={d.id} style={{ padding: "12px 18px", borderBottom: `1px solid ${C.grigioChi}`, display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ background: "#0F2440", color: C.bianco, borderRadius: 6, padding: "4px 10px", fontSize: 11, fontFamily: "monospace", fontWeight: 800, flexShrink: 0 }}>{d.numero_rep}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: C.nero, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.ambito?.nome}</div>
                  <div style={{ fontSize: 11, color: C.grigioMed }}>Anno {d.anno_finanziario} · {d.data}</div>
                </div>
                <div style={{ fontSize: 12, fontWeight: 700, color: C.verde, whiteSpace: "nowrap" }}>{fmt(d.stanziamento_totale)}</div>
              </div>
            ))}
          </div>

          {/* Copertura */}
          <div style={{ background: C.bianco, border: `1px solid ${C.grigioChi}`, borderRadius: 12, padding: 18, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.nero, marginBottom: 14 }}>Copertura dati</div>
            {[
              { label: "Danza 2025", rep: "1074", org: 150, ok: true },
              { label: "Danza 2026", rep: "787", org: 150, ok: true },
              { label: "Circo 2026", rep: "770", org: 47, ok: true },
              { label: "Multidisciplinare 2026", rep: "783", org: 78, ok: true },
              { label: "Musica 2025/2026", ok: false },
              { label: "Teatro 2025/2026", ok: false },
            ].map(r => (
              <div key={r.label} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8, padding: "9px 12px", background: r.ok ? C.verdeChi : C.sfondo, borderRadius: 8, border: `1px solid ${r.ok ? C.verde + "20" : C.grigioChi}` }}>
                <span style={{ fontSize: 14, flexShrink: 0 }}>{r.ok ? "✅" : "⏳"}</span>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: r.ok ? C.nero : C.grigioMed }}>{r.label}</div>
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

  if (loading) return <div style={{ padding: 48, color: C.grigioMed, fontStyle: "italic" }}>Caricamento...</div>;

  return (
    <div style={{ padding: "28px 32px" }}>
      {selected && <ModalOrganismo riga={selected} onClose={() => setSelected(null)} />}
      <div style={{ marginBottom: 22 }}>
        <h1 style={{ fontSize: 22, fontWeight: 900, color: C.nero, margin: 0 }}>Assegnazioni</h1>
        <p style={{ fontSize: 13, color: C.grigioMed, margin: "5px 0 0" }}>
          {filtrati.length} risultati · {fmt(totale)} · <em>Clicca una riga per il dettaglio punteggi</em>
        </p>
      </div>
      <Filtri cerca={cerca} setCerca={setCerca} filtroAnno={filtroAnno} setFiltroAnno={setFiltroAnno}
        filtroAmbito={filtroAmbito} setFiltroAmbito={setFiltroAmbito} anni={anni} ambiti={ambiti} />
      <TabellaAssegnazioni dati={filtrati.slice(0, 300)} onSelectRiga={setSelected} />
      {filtrati.length > 300 && <div style={{ padding: "10px", fontSize: 12, color: C.grigioMed, textAlign: "center", marginTop: 8 }}>Mostrati 300 di {filtrati.length} — usa i filtri per restringere</div>}
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
  const nPU = filtrati.filter(d => d.regione === "Puglia").length;
  const nBA = filtrati.filter(d => d.regione === "Basilicata").length;

  if (loading) return <div style={{ padding: 48, color: C.grigioMed, fontStyle: "italic" }}>Caricamento...</div>;

  return (
    <div style={{ padding: "28px 32px" }}>
      {selected && <ModalOrganismo riga={selected} onClose={() => setSelected(null)} />}
      <div style={{ marginBottom: 22 }}>
        <h1 style={{ fontSize: 22, fontWeight: 900, color: C.nero, margin: 0 }}>Puglia e Basilicata</h1>
        <p style={{ fontSize: 13, color: C.grigioMed, margin: "5px 0 0" }}>Organismi finanziati FNSV nelle due regioni · Clicca una riga per il dettaglio</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14, marginBottom: 22 }}>
        {[
          { label: "Puglia", value: nPU, sub: fmt(totPU), color: C.oro, bg: C.oroChi },
          { label: "Basilicata", value: nBA, sub: fmt(totBA), color: C.verde, bg: C.verdeChi },
          { label: "Totale contributi", value: fmt(totPU + totBA), color: C.blu, bg: C.bluChi },
        ].map(k => (
          <div key={k.label} style={{ background: k.bg, border: `1px solid ${k.color}20`, borderTop: `3px solid ${k.color}`, borderRadius: 12, padding: "16px 20px" }}>
            <div style={{ fontSize: 10, color: C.grigioMed, textTransform: "uppercase", letterSpacing: 1, fontFamily: "monospace" }}>{k.label}</div>
            <div style={{ fontSize: 26, fontWeight: 900, color: C.nero, margin: "4px 0 2px" }}>{k.value}</div>
            {k.sub && <div style={{ fontSize: 12, color: k.color, fontWeight: 700 }}>{k.sub}</div>}
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 18 }}>
        <select value={filtroAnno} onChange={e => setFiltroAnno(e.target.value)}
          style={{ padding: "8px 12px", borderRadius: 8, border: `1px solid ${C.grigioChi}`, fontSize: 13, background: C.bianco }}>
          {anni.map(a => <option key={a}>{a}</option>)}
        </select>
        <select value={filtroRegione} onChange={e => setFiltroRegione(e.target.value)}
          style={{ padding: "8px 12px", borderRadius: 8, border: `1px solid ${C.grigioChi}`, fontSize: 13, background: C.bianco }}>
          <option>tutti</option><option>Puglia</option><option>Basilicata</option>
        </select>
      </div>

      <TabellaAssegnazioni dati={filtrati} onSelectRiga={setSelected} mostraPunteggi={true} />

      {dati.length === 0 && (
        <div style={{ marginTop: 16, padding: 16, background: C.oroChi, borderRadius: 10, fontSize: 13, color: C.oro, border: `1px solid ${C.oro}30` }}>
          ⚠️ I dati geografici vengono completati progressivamente. Usa il pulsante "✏️ Modifica sede" nelle schede organismo.
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
    supabase.schema("contributi_mic").from("decreti").select("*, ambito:ambito_id(nome)").order("data", { ascending: false })
      .then(({ data }) => { setDati(data || []); setLoading(false); });
  }, []);
  if (loading) return <div style={{ padding: 48, color: C.grigioMed, fontStyle: "italic" }}>Caricamento...</div>;
  return (
    <div style={{ padding: "28px 32px" }}>
      <h1 style={{ fontSize: 22, fontWeight: 900, color: C.nero, margin: "0 0 22px" }}>Decreti importati</h1>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {dati.map(d => (
          <div key={d.id} style={{ background: C.bianco, border: `1px solid ${C.grigioChi}`, borderLeft: `4px solid ${C.oro}`, borderRadius: 12, padding: "18px 24px", display: "flex", alignItems: "center", gap: 20, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            <div style={{ background: "#0F2440", color: C.bianco, borderRadius: 8, padding: "10px 16px", textAlign: "center", flexShrink: 0, fontFamily: "monospace" }}>
              <div style={{ fontSize: 8, color: "#4A6A8A", letterSpacing: 1 }}>D.D.G. REP.</div>
              <div style={{ fontSize: 24, fontWeight: 900, lineHeight: 1 }}>n.{d.numero_rep}</div>
              <div style={{ fontSize: 9, color: C.oro, marginTop: 3 }}>{d.anno_finanziario}</div>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 15, color: C.nero }}>{d.ambito?.nome}</div>
              <div style={{ fontSize: 12, color: C.grigioMed, marginTop: 4 }}>{d.ente_erogante} · {d.data}</div>
            </div>
            <div style={{ fontSize: 18, fontWeight: 900, color: C.verde, fontFamily: "monospace" }}>{fmt(d.stanziamento_totale)}</div>
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
    <div style={{ display: "flex", minHeight: "100vh", fontFamily: "'Segoe UI', system-ui, sans-serif", background: C.sfondo }}>
      <Sidebar sezione={sezione} setSezione={setSezione} />
      <main style={{ flex: 1, overflow: "auto", minWidth: 0 }}>
        {contenuto}
      </main>
    </div>
  );
}

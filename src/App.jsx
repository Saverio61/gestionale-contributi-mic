import { useState, useEffect, useCallback } from "react";
import { supabase } from "./supabaseClient";
import ParserDecreto from "./ParserDecreto";

const fmt = (n) => n != null ? new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n) : "--";
const mono = { fontFamily: "'Courier New', monospace" };

const AMBITO_COLORS = {
  "Danza": "#1D4ED8", "Musica": "#6D28D9", "Teatro": "#B91C1C",
  "Circo e Spettacolo Viaggiante": "#B45309", "Multidisciplinare": "#047857",
  "Regione Puglia - FNSV": "#C2410C",
};

const T = {
  inchiostro: "#0A1628", marino: "#1D4ED8", marinoChi: "#DBEAFE",
  oro: "#B8860B", oroChi: "#FEF9C3",
  verde: "#065F46", verdeChi: "#D1FAE5",
  viola: "#5B21B6", violaChi: "#EDE9FE",
  arancio: "#C2410C", arancioChi: "#FFEDD5",
  sfondo: "#F1F3F6", bianco: "#FFFFFF",
  bordo: "#CBD5E1", testo: "#0F172A",
  sub: "#374151",   // testo secondario — scuro abbastanza
  muted: "#6B7280", // solo per label
};

// ── TOPBAR ────────────────────────────────────────────────────
function Topbar({ sezione, setSezione }) {
  const voci = [
    { id: "dashboard",         label: "Dashboard",           icon: "⊞" },
    { id: "organismi",         label: "Organismi",           icon: "🏛" },
    { id: "puglia_basilicata", label: "Puglia & Basilicata", icon: "◎", highlight: true },
    { id: "decreti",           label: "Decreti",             icon: "▤" },
    { id: "parser",            label: "Importa",             icon: "↑" },
  ];
  return (
    <div style={{ background: T.inchiostro, flexShrink: 0, boxShadow: "0 2px 12px rgba(0,0,0,0.25)" }}>
      <div style={{ background: "#060F1E", padding: "4px 32px", display: "flex", gap: 16, alignItems: "center" }}>
        <span style={{ fontSize: 9, letterSpacing: 2.5, textTransform: "uppercase", color: "rgba(255,255,255,0.5)", fontWeight: 600 }}>AGIS Puglia e Basilicata</span>
        <span style={{ color: "rgba(255,255,255,0.15)" }}>·</span>
        <span style={{ fontSize: 9, color: T.oro, letterSpacing: 2, textTransform: "uppercase", fontWeight: 700 }}>Gestionale Contributi Spettacolo dal Vivo</span>
      </div>
      <div style={{ padding: "0 32px", display: "flex", alignItems: "stretch" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, paddingRight: 24, borderRight: "1px solid rgba(255,255,255,0.07)", marginRight: 6 }}>
          <div style={{ width: 30, height: 30, background: `linear-gradient(135deg,${T.oro},#8B6400)`, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 14, color: T.inchiostro, ...mono }}>G</div>
          <div style={{ fontSize: 13, fontWeight: 800, color: "#FFFFFF" }}>Gestionale</div>
        </div>
        {voci.map(v => {
          const attivo = sezione === v.id;
          return (
            <button key={v.id} onClick={() => setSezione(v.id)} style={{
              padding: "14px 15px", border: "none", cursor: "pointer", fontSize: 12,
              background: v.highlight && !attivo ? "rgba(184,134,11,0.1)" : "transparent",
              color: attivo ? "#FFFFFF" : v.highlight ? "#F0C040" : "rgba(255,255,255,0.55)",
              fontWeight: attivo ? 700 : v.highlight ? 700 : 400,
              borderBottom: attivo ? `2px solid ${T.oro}` : "2px solid transparent",
              transition: "all 0.15s", whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 5,
            }}>
              <span style={{ fontSize: 11 }}>{v.icon}</span>{v.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── BADGE ─────────────────────────────────────────────────────
function BadgeAmbito({ ambito }) {
  const color = AMBITO_COLORS[ambito] || T.muted;
  const label = ambito?.replace("Circo e Spettacolo Viaggiante", "Circo").replace("Regione Puglia - FNSV", "Reg. Puglia");
  return (
    <span style={{ background: color + "20", color, border: `1px solid ${color}50`, padding: "2px 8px", borderRadius: 4, fontSize: 10, fontWeight: 700, whiteSpace: "nowrap" }}>
      {label}
    </span>
  );
}

function BadgeTipo({ tipo }) {
  if (tipo === "REG_PU") return <span style={{ background: "#FFEDD5", color: "#9A3412", border: "1px solid #FED7AA", padding: "2px 7px", borderRadius: 4, fontSize: 10, fontWeight: 700, ...mono }}>Reg. Puglia</span>;
  return <span style={{ background: "#DBEAFE", color: "#1E3A8A", border: "1px solid #BFDBFE", padding: "2px 7px", borderRadius: 4, fontSize: 10, fontWeight: 700, ...mono }}>MIC · FNSV</span>;
}

function BadgeRegione({ regione }) {
  if (!regione) return <span style={{ color: T.muted }}>—</span>;
  const isPU = regione === "Puglia";
  const isBA = regione === "Basilicata";
  const color = isPU ? "#92400E" : isBA ? "#065F46" : T.muted;
  const bg = isPU ? "#FEF9C3" : isBA ? "#D1FAE5" : "#F1F5F9";
  const border = isPU ? "#FCD34D" : isBA ? "#6EE7B7" : T.bordo;
  return <span style={{ background: bg, color, border: `1px solid ${border}`, padding: "2px 8px", borderRadius: 4, fontSize: 10, fontWeight: 700, ...mono }}>{regione}</span>;
}

// ── FORM SEDE ─────────────────────────────────────────────────
function FormAnagrafica({ organismo_id, cf_attuale, onSaved }) {
  const [province, setProvince] = useState([]);
  const [comuni, setComuni] = useState([]);
  const [provSel, setProvSel] = useState("");
  const [comuneSel, setComuneSel] = useState("");
  const [cf, setCf] = useState(cf_attuale || "");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [msgType, setMsgType] = useState("ok"); // "ok" | "err" | "warn"

  useEffect(() => {
    supabase.schema("contributi_mic").from("province").select("id, codice, nome, regione:regione_id(nome)").order("nome")
      .then(({ data }) => setProvince(data || []));
  }, []);
  useEffect(() => {
    if (!provSel) { setComuni([]); return; }
    supabase.schema("contributi_mic").from("comuni").select("id, nome").eq("provincia_id", provSel).order("nome")
      .then(({ data }) => setComuni(data || []));
  }, [provSel]);

  const cfValido = /^[A-Z0-9]{11,16}$/.test(cf.trim().toUpperCase());

  async function salva() {
    const idNum = parseInt(organismo_id);
    if (!idNum) { setMsg("Errore: ID non valido"); setMsgType("err"); return; }

    const updates = {};
    if (comuneSel) updates.comune_id = parseInt(comuneSel);
    if (cf.trim() && cf.trim().toUpperCase() !== (cf_attuale || "").toUpperCase()) {
      if (!cfValido) { setMsg("CF non valido — deve essere 11-16 caratteri alfanumerici"); setMsgType("err"); return; }
      // Verifica se CF esiste già su altro organismo
      const { data: existing } = await supabase.schema("contributi_mic").from("organismi")
        .select("id, denominazione").eq("codice_fiscale", cf.trim().toUpperCase()).neq("id", idNum);
      if (existing?.length > 0) {
        setMsg(`⚠ CF già presente su: "${existing[0].denominazione}" (id=${existing[0].id}) — verifica se sono lo stesso organismo`);
        setMsgType("warn");
        return;
      }
      updates.codice_fiscale = cf.trim().toUpperCase();
    }

    if (Object.keys(updates).length === 0) { setMsg("Nessuna modifica da salvare"); setMsgType("warn"); return; }

    setSaving(true);
    const { data, error } = await supabase.schema("contributi_mic").from("organismi")
      .update(updates).eq("id", idNum).select();
    setSaving(false);

    if (error) { setMsg("Errore: " + error.message); setMsgType("err"); }
    else if (!data || data.length === 0) { setMsg("⚠ Nessuna riga aggiornata (id=" + idNum + ")"); setMsgType("warn"); }
    else { setMsg("✓ Anagrafica aggiornata."); setMsgType("ok"); setTimeout(onSaved, 1000); }
  }

  const sel = { padding: "7px 10px", borderRadius: 5, border: `1px solid ${T.bordo}`, fontSize: 12, background: T.bianco, color: T.testo };
  const msgColor = msgType === "ok" ? "#065F46" : msgType === "warn" ? "#92400E" : "#B91C1C";

  return (
    <div style={{ background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: 8, padding: "14px 16px", marginBottom: 18 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "#1E3A8A", textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>✎ Modifica anagrafica</div>

      {/* CF */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 10, color: T.sub, marginBottom: 4, fontWeight: 600 }}>Codice Fiscale</div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input value={cf} onChange={e => setCf(e.target.value.toUpperCase())}
            placeholder="Es. 80007690722"
            style={{ ...sel, width: 180, ...mono, letterSpacing: 1,
              borderColor: cf && !cfValido ? "#FCA5A5" : T.bordo }} />
          {cf && !cfValido && <span style={{ fontSize: 10, color: "#B91C1C" }}>Formato non valido</span>}
          {cf && cfValido && <span style={{ fontSize: 10, color: "#065F46" }}>✓</span>}
        </div>
      </div>

      {/* Sede */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 10, color: T.sub, marginBottom: 4, fontWeight: 600 }}>Sede (opzionale)</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <select value={provSel} onChange={e => { setProvSel(e.target.value); setComuneSel(""); }} style={{ ...sel, minWidth: 190 }}>
            <option value="">— Provincia —</option>
            {province.map(p => <option key={p.id} value={p.id}>{p.nome} ({p.codice})</option>)}
          </select>
          <select value={comuneSel} onChange={e => setComuneSel(e.target.value)} disabled={comuni.length === 0}
            style={{ ...sel, minWidth: 150, background: comuni.length === 0 ? T.sfondo : T.bianco }}>
            <option value="">— Comune —</option>
            {comuni.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <button onClick={salva} disabled={saving}
          style={{ padding: "7px 20px", borderRadius: 5, border: "none", background: "#1D4ED8", color: "#FFFFFF", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
          {saving ? "Salvo…" : "Salva"}
        </button>
        {msg && <span style={{ fontSize: 12, color: msgColor, fontWeight: 700 }}>{msg}</span>}
      </div>
    </div>
  );
}

// ── SCHEDA ORGANISMO (modal) ──────────────────────────────────
function SchedaOrganismo({ org, onClose }) {
  const [showSede, setShowSede] = useState(false);
  const [dati, setDati] = useState(org);

  async function ricarica() {
    const { data } = await supabase.schema("contributi_mic").from("v_assegnazioni").select("*").eq("denominazione", org.denominazione).order("anno");
    if (data?.length) {
      const first = data[0];
      setDati({ ...org, comune: first.comune, sigla_provincia: first.sigla_provincia, regione: first.regione, assegnazioni: data });
    }
    setShowSede(false);
  }

  const ass = dati.assegnazioni || [];
  const totMIC = ass.filter(a => a.tipo_decreto === "MIC_FNSV").reduce((s, a) => s + (a.contributo_assegnato || 0), 0);
  const totReg = ass.filter(a => a.tipo_decreto === "REG_PU").reduce((s, a) => s + (a.contributo_assegnato || 0), 0);
  const anni = [...new Set(ass.map(a => a.anno))].sort();
  const ambiti = [...new Set(ass.map(a => a.ambito))];

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(10,22,40,0.72)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: T.bianco, borderRadius: 14, width: "min(820px,100%)", maxHeight: "90vh", overflow: "hidden", display: "flex", flexDirection: "column", boxShadow: "0 32px 80px rgba(0,0,0,0.4)" }}>

        {/* Header */}
        <div style={{ background: `linear-gradient(135deg,${T.inchiostro} 0%,#1A2E50 100%)`, padding: "20px 24px", borderBottom: `3px solid ${T.oro}`, flexShrink: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div style={{ flex: 1, paddingRight: 16 }}>
              <div style={{ display: "flex", gap: 7, marginBottom: 8, flexWrap: "wrap", alignItems: "center" }}>
                <BadgeRegione regione={dati.regione} />
                {ambiti.map(a => <BadgeAmbito key={a} ambito={a} />)}
              </div>
              <div style={{ fontSize: 18, fontWeight: 800, color: "#FFFFFF", lineHeight: 1.3 }}>{dati.denominazione}</div>
              <div style={{ marginTop: 8, display: "flex", gap: 20, flexWrap: "wrap" }}>
                {dati.comune && (
                  <span style={{ fontSize: 12, color: "rgba(255,255,255,0.75)", fontWeight: 500 }}>
                    📍 {dati.comune} ({dati.sigla_provincia})
                  </span>
                )}
                {dati.codice_fiscale && (
                  <span style={{ fontSize: 12, color: "#FCD34D", fontWeight: 700, ...mono }}>
                    CF: {dati.codice_fiscale}
                  </span>
                )}
                <button onClick={() => setShowSede(!showSede)}
                  style={{ fontSize: 10, background: "rgba(255,255,255,0.12)", color: "#FFFFFF", border: "none", borderRadius: 4, padding: "3px 9px", cursor: "pointer", fontWeight: 600 }}>
                  {showSede ? "✕ chiudi" : "✎ modifica anagrafica"}
                </button>
              </div>
            </div>
            <button onClick={onClose} style={{ background: "rgba(255,255,255,0.1)", border: "none", color: "#FFFFFF", width: 32, height: 32, borderRadius: 6, cursor: "pointer", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
          </div>
        </div>

        <div style={{ overflow: "auto", flex: 1, padding: "20px 24px" }}>
          {showSede && dati.id_organismo && <FormAnagrafica organismo_id={dati.id_organismo} cf_attuale={dati.codice_fiscale} onSaved={ricarica} />}

          {/* KPI */}
          <div style={{ display: "grid", gridTemplateColumns: totReg > 0 ? "repeat(3,1fr)" : "repeat(2,1fr)", gap: 12, marginBottom: 20 }}>
            <div style={{ background: "#EFF6FF", borderRadius: 8, padding: "14px 16px", borderLeft: `3px solid #1D4ED8` }}>
              <div style={{ fontSize: 10, color: "#1E3A8A", textTransform: "uppercase", letterSpacing: 1, fontWeight: 700, marginBottom: 6 }}>Totale MIC/FNSV</div>
              <div style={{ fontSize: 22, fontWeight: 900, color: "#1E3A8A", ...mono }}>{fmt(totMIC)}</div>
              <div style={{ fontSize: 11, color: T.sub, marginTop: 3 }}>{anni.length > 1 ? `${anni[0]}–${anni[anni.length-1]}` : anni[0]}</div>
            </div>
            {totReg > 0 && (
              <div style={{ background: "#FFEDD5", borderRadius: 8, padding: "14px 16px", borderLeft: `3px solid #C2410C` }}>
                <div style={{ fontSize: 10, color: "#9A3412", textTransform: "uppercase", letterSpacing: 1, fontWeight: 700, marginBottom: 6 }}>Regione Puglia</div>
                <div style={{ fontSize: 22, fontWeight: 900, color: "#9A3412", ...mono }}>{fmt(totReg)}</div>
                <div style={{ fontSize: 11, color: T.sub, marginTop: 3 }}>POC 2021-2027</div>
              </div>
            )}
            <div style={{ background: "#D1FAE5", borderRadius: 8, padding: "14px 16px", borderLeft: `3px solid #065F46` }}>
              <div style={{ fontSize: 10, color: "#065F46", textTransform: "uppercase", letterSpacing: 1, fontWeight: 700, marginBottom: 6 }}>Totale cumulato</div>
              <div style={{ fontSize: 22, fontWeight: 900, color: "#065F46", ...mono }}>{fmt(totMIC + totReg)}</div>
              <div style={{ fontSize: 11, color: T.sub, marginTop: 3 }}>{ass.length} assegnazioni</div>
            </div>
          </div>

          {/* Tabella assegnazioni */}
          <div style={{ fontSize: 11, fontWeight: 700, color: T.sub, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 12 }}>Tutte le assegnazioni</div>
          <div style={{ borderRadius: 8, overflow: "hidden", border: `1px solid ${T.bordo}` }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ background: T.inchiostro }}>
                  {["Anno","Fonte","Ambito","Settore","Sott.","VD","QA","QI","DA","TOT","Contributo"].map(h => (
                    <th key={h} style={{ padding: "9px 10px", textAlign: h === "Contributo" ? "right" : "left", color: "rgba(255,255,255,0.8)", fontSize: 10, textTransform: "uppercase", fontWeight: 700 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ass.sort((a,b) => a.anno - b.anno || (a.ambito||"").localeCompare(b.ambito||"")).map((a, i) => (
                  <tr key={i} style={{ borderBottom: `1px solid ${T.bordo}`, background: i % 2 === 0 ? T.bianco : T.sfondo }}>
                    <td style={{ padding: "9px 10px", fontWeight: 800, color: "#1E3A8A", ...mono }}>{a.anno}</td>
                    <td style={{ padding: "9px 10px" }}><BadgeTipo tipo={a.tipo_decreto} /></td>
                    <td style={{ padding: "9px 10px" }}><BadgeAmbito ambito={a.ambito} /></td>
                    <td style={{ padding: "9px 10px", color: T.sub, fontSize: 11, ...mono, fontWeight: 600 }}>{a.articolo_dm}</td>
                    <td style={{ padding: "9px 10px", fontSize: 11, color: T.sub, fontWeight: 600 }}>
                      {a.numero_sottoinsieme > 1 ? `${["","1°","2°","3°","4°","5°","6°","7°","8°","9°","10°"][a.numero_sottoinsieme]}` : "—"}
                    </td>
                    {[a.punteggio_vd, a.punteggio_qa, a.punteggio_qi, a.punteggio_da].map((v, vi) => (
                      <td key={vi} style={{ padding: "9px 8px", ...mono, color: v > 0 ? "#0F172A" : T.muted, fontSize: 11, fontWeight: v > 0 ? 700 : 400 }}>{v > 0 ? v.toFixed(2) : "—"}</td>
                    ))}
                    <td style={{ padding: "9px 8px", fontWeight: 800, color: "#1E3A8A", ...mono, fontSize: 12 }}>{a.punteggio_tot > 0 ? a.punteggio_tot.toFixed(2) : "—"}</td>
                    <td style={{ padding: "9px 10px", fontWeight: 800, color: "#065F46", ...mono, textAlign: "right", fontSize: 12 }}>{fmt(a.contributo_assegnato)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ background: "#F8FAFC", borderTop: `2px solid ${T.bordo}` }}>
                  <td colSpan={10} style={{ padding: "9px 10px", fontWeight: 700, color: T.testo }}>TOTALE ({ass.length} assegnazioni)</td>
                  <td style={{ padding: "9px 10px", fontWeight: 900, color: "#065F46", ...mono, textAlign: "right", fontSize: 13 }}>{fmt(totMIC + totReg)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Titoli progetto */}
          {ass.filter(a => a.titolo_progetto).map((a, i) => (
            <div key={i} style={{ marginTop: 12, padding: "10px 14px", background: "#FFEDD5", borderRadius: 6, borderLeft: `3px solid #C2410C`, fontSize: 11 }}>
              <span style={{ color: "#9A3412", fontWeight: 700 }}>Progetto Regione Puglia {a.anno}: </span>
              <span style={{ color: T.testo, fontWeight: 500 }}>{a.titolo_progetto}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── TABELLA ORGANISMI ─────────────────────────────────────────
function TabellaOrganismi({ organismi, onSelect }) {
  const [sortCol, setSortCol] = useState("totale");
  const [sortDir, setSortDir] = useState("desc");

  function toggleSort(col) {
    if (sortCol === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortCol(col); setSortDir("desc"); }
  }

  const sorted = [...organismi].sort((a, b) => {
    let va = a[sortCol], vb = b[sortCol];
    if (sortCol === "totale") { va = a.totale; vb = b.totale; }
    if (va == null) return 1; if (vb == null) return -1;
    if (typeof va === "string") return sortDir === "asc" ? va.localeCompare(vb) : vb.localeCompare(va);
    return sortDir === "asc" ? (va > vb ? 1 : -1) : (va < vb ? 1 : -1);
  });

  const Th = ({ col, label, right, width }) => (
    <th onClick={() => col && toggleSort(col)} style={{
      padding: "9px 9px", textAlign: right ? "right" : "left",
      color: sortCol === col ? "#FFFFFF" : "rgba(255,255,255,0.65)",
      fontSize: 9, textTransform: "uppercase", fontWeight: 700, letterSpacing: 0.5,
      whiteSpace: "nowrap", cursor: col ? "pointer" : "default",
      background: sortCol === col ? "rgba(255,255,255,0.08)" : "transparent",
      userSelect: "none", width, minWidth: width,
    }}>
      {label}{col && sortCol === col && <span style={{ marginLeft: 3 }}>{sortDir === "desc" ? "↓" : "↑"}</span>}
    </th>
  );

  return (
    <div style={{ borderRadius: 8, overflow: "hidden", border: `1px solid ${T.bordo}`, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11, tableLayout: "fixed" }}>
          <colgroup>
            <col style={{ width: 190 }} />
            <col style={{ width: 95 }} />
            <col style={{ width: 110 }} />
            <col style={{ width: 75 }} />
            <col style={{ width: 130 }} />
            <col style={{ width: 70 }} />
            <col style={{ width: 80 }} />
            <col style={{ width: 95 }} />
            <col style={{ width: 18 }} />
          </colgroup>
          <thead>
            <tr style={{ background: T.inchiostro }}>
              <Th col="denominazione" label="Organismo" />
              <Th label="CF" />
              <Th label="Sede" />
              <Th col="regione" label="Regione" />
              <Th label="Ambiti" />
              <Th label="Anni" />
              <Th label="Fonti" />
              <Th col="totale" label="Totale" right />
              <th style={{ padding: "9px 6px", background: T.inchiostro }}></th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((o, i) => {
              const isPugBas = o.regione === "Puglia" || o.regione === "Basilicata";
              return (
                <tr key={o.id} onClick={() => onSelect(o)}
                  style={{ background: isPugBas ? "#FFFBF0" : i % 2 === 0 ? T.bianco : T.sfondo, borderBottom: `1px solid ${T.bordo}`, cursor: "pointer" }}>
                  <td style={{ padding: "7px 9px", fontWeight: 700, color: "#0F172A", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={o.denominazione}>{o.denominazione}</td>
                  <td style={{ padding: "7px 9px", ...mono, fontSize: 10, color: "#1E3A8A", fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{o.codice_fiscale || <span style={{ color: T.muted }}>—</span>}</td>
                  <td style={{ padding: "7px 9px", fontSize: 10, color: o.comune ? "#374151" : "#DC2626", whiteSpace: "nowrap", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis" }} title={o.comune ? `${o.comune} (${o.sigla_provincia})` : ""}>
                    {o.comune ? `${o.comune} (${o.sigla_provincia})` : "⚠ mancante"}
                  </td>
                  <td style={{ padding: "7px 9px", overflow: "hidden" }}><BadgeRegione regione={o.regione} /></td>
                  <td style={{ padding: "7px 9px", overflow: "hidden", whiteSpace: "nowrap" }}>
                    <div style={{ display: "flex", gap: 3, overflow: "hidden" }}>{o.ambiti.slice(0,2).map(a => <BadgeAmbito key={a} ambito={a} />)}{o.ambiti.length > 2 && <span style={{ fontSize: 9, color: T.muted, alignSelf: "center" }}>+{o.ambiti.length-2}</span>}</div>
                  </td>
                  <td style={{ padding: "7px 9px", ...mono, color: "#374151", fontWeight: 700, fontSize: 10, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={o.anni.join(", ")}>{o.anni.join(",")}</td>
                  <td style={{ padding: "7px 9px", overflow: "hidden", whiteSpace: "nowrap" }}>
                    <div style={{ display: "flex", gap: 3 }}>{o.fonti.slice(0,1).map(f => <BadgeTipo key={f} tipo={f} />)}{o.fonti.length > 1 && <span style={{ fontSize: 9, color: T.muted, alignSelf: "center" }}>+{o.fonti.length-1}</span>}</div>
                  </td>
                  <td style={{ padding: "7px 9px", fontWeight: 800, color: "#065F46", ...mono, textAlign: "right", fontSize: 12, whiteSpace: "nowrap" }}>{fmt(o.totale)}</td>
                  <td style={{ padding: "7px 6px", color: "#94A3B8", fontSize: 14, textAlign: "center" }}>›</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {organismi.length === 0 && <div style={{ padding: 40, textAlign: "center", color: T.muted, fontStyle: "italic" }}>Nessun organismo trovato.</div>}
    </div>
  );
}

// ── HOOK ORGANISMI AGGREGATI ──────────────────────────────────
function useOrganismi(filtriExtra) {
  const [organismi, setOrganismi] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      // Supabase limita le query a 1000 righe di default: paginiamo per recuperare tutto
      let allData = [];
      let from = 0;
      const pageSize = 1000;
      while (true) {
        let q = supabase.schema("contributi_mic").from("v_assegnazioni").select("*");
        if (filtriExtra?.regioni) q = q.in("regione", filtriExtra.regioni);
        const { data, error } = await q.order("id_organismo").range(from, from + pageSize - 1);
        if (error || !data || data.length === 0) break;
        allData = allData.concat(data);
        if (data.length < pageSize) break;
        from += pageSize;
      }
      const data = allData;

      // Aggrega per organismo
      const map = {};
      for (const a of (data || [])) {
        const key = a.id_organismo;
        if (!map[key]) {
          map[key] = {
            id: key,
            id_organismo: key,
            denominazione: a.denominazione,
            codice_fiscale: a.codice_fiscale,
            comune: a.comune,
            sigla_provincia: a.sigla_provincia,
            regione: a.regione,
            ambiti: new Set(),
            anni: new Set(),
            fonti: new Set(),
            totale: 0,
            assegnazioni: [],
          };
        }
        map[key].ambiti.add(a.ambito);
        map[key].anni.add(a.anno);
        map[key].fonti.add(a.tipo_decreto);
        map[key].totale += a.contributo_assegnato || 0;
        map[key].assegnazioni.push(a);
      }

      const lista = Object.values(map).map(o => ({
        ...o,
        ambiti: [...o.ambiti].filter(Boolean),
        anni: [...o.anni].sort(),
        fonti: [...o.fonti],
      }));

      setOrganismi(lista);
      setLoading(false);
    }
    load();
  }, []);

  return { organismi, loading };
}

// ── SEZIONE ORGANISMI ─────────────────────────────────────────
function Organismi({ filtroRegionePre }) {
  const { organismi, loading } = useOrganismi(filtroRegionePre ? { regioni: filtroRegionePre } : null);
  const [cerca, setCerca] = useState("");
  const [cercaCF, setCercaCF] = useState("");
  const [filtroAmbito, setFiltroAmbito] = useState("tutti");
  const [filtroFonte, setFiltroFonte] = useState("tutti");
  const [filtroRegione, setFiltroRegione] = useState("tutte");
  const [filtroProvincia, setFiltroProvincia] = useState("tutte");
  const [filtroComune, setFiltroComune] = useState("tutti");
  const [selected, setSelected] = useState(null);

  const ambiti = ["tutti", ...new Set(organismi.flatMap(o => o.ambiti).filter(Boolean).sort())];
  const regioni = ["tutte", ...new Set(organismi.map(o => o.regione).filter(Boolean).sort())];
  const provinceDisponibili = ["tutte", ...new Set(
    organismi
      .filter(o => filtroRegione === "tutte" || o.regione === filtroRegione)
      .map(o => o.sigla_provincia)
      .filter(Boolean)
      .sort()
  )];
  const comuniDisponibili = ["tutti", ...new Set(
    organismi
      .filter(o => filtroRegione === "tutte" || o.regione === filtroRegione)
      .filter(o => filtroProvincia === "tutte" || o.sigla_provincia === filtroProvincia)
      .map(o => o.comune)
      .filter(Boolean)
      .sort()
  )];

  const filtrati = organismi.filter(o =>
    (!cerca || o.denominazione?.toLowerCase().includes(cerca.toLowerCase())) &&
    (!cercaCF || (o.codice_fiscale || "").toLowerCase().includes(cercaCF.toLowerCase())) &&
    (filtroAmbito === "tutti" || o.ambiti.includes(filtroAmbito)) &&
    (filtroFonte === "tutti" || o.fonti.includes(filtroFonte)) &&
    (filtroRegione === "tutte" || o.regione === filtroRegione) &&
    (filtroProvincia === "tutte" || o.sigla_provincia === filtroProvincia) &&
    (filtroComune === "tutti" || o.comune === filtroComune)
  );

  const totale = filtrati.reduce((s, o) => s + o.totale, 0);

  if (loading) return <div style={{ padding: 48, color: T.muted, fontStyle: "italic" }}>Caricamento organismi…</div>;

  const sel = { padding: "7px 11px", borderRadius: 6, border: `1px solid ${T.bordo}`, fontSize: 12, background: T.bianco, color: T.testo };

  return (
    <div>
      {selected && <SchedaOrganismo org={selected} onClose={() => setSelected(null)} />}
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ position: "relative" }}>
          <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: T.muted, pointerEvents: "none" }}>🔍</span>
          <input value={cerca} onChange={e => setCerca(e.target.value)} placeholder="Cerca organismo…"
            style={{ ...sel, paddingLeft: 32, width: 200 }} />
        </div>
        <div style={{ position: "relative" }}>
          <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: T.muted, pointerEvents: "none", fontSize: 11, fontWeight: 700 }}>CF</span>
          <input value={cercaCF} onChange={e => setCercaCF(e.target.value)} placeholder="Cerca per CF…"
            style={{ ...sel, paddingLeft: 30, width: 150, ...mono }} />
        </div>
        <select value={filtroRegione} onChange={e => { setFiltroRegione(e.target.value); setFiltroProvincia("tutte"); setFiltroComune("tutti"); }} style={sel}>
          {regioni.map(r => <option key={r} value={r}>{r === "tutte" ? "Tutte le regioni" : r}</option>)}
        </select>
        <select value={filtroProvincia} onChange={e => { setFiltroProvincia(e.target.value); setFiltroComune("tutti"); }} style={sel} disabled={provinceDisponibili.length <= 1}>
          {provinceDisponibili.map(p => <option key={p} value={p}>{p === "tutte" ? "Tutte le provincie" : p}</option>)}
        </select>
        <select value={filtroComune} onChange={e => setFiltroComune(e.target.value)} style={sel} disabled={comuniDisponibili.length <= 1}>
          {comuniDisponibili.map(c => <option key={c} value={c}>{c === "tutti" ? "Tutti i comuni" : c}</option>)}
        </select>
        <select value={filtroAmbito} onChange={e => setFiltroAmbito(e.target.value)} style={sel}>
          {ambiti.map(a => <option key={a}>{a}</option>)}
        </select>
        <select value={filtroFonte} onChange={e => setFiltroFonte(e.target.value)} style={sel}>
          <option value="tutti">Tutte le fonti</option>
          <option value="MIC_FNSV">MIC · FNSV</option>
          <option value="REG_PU">Regione Puglia</option>
        </select>
        {(cerca || cercaCF || filtroAmbito !== "tutti" || filtroFonte !== "tutti" || filtroRegione !== "tutte" || filtroComune !== "tutti") && (
          <button onClick={() => { setCerca(""); setCercaCF(""); setFiltroAmbito("tutti"); setFiltroFonte("tutti"); setFiltroRegione("tutte"); setFiltroComune("tutti"); }}
            style={{ ...sel, background: "#FEF2F2", color: "#B91C1C", border: "1px solid #FECACA", cursor: "pointer", fontWeight: 600 }}>
            ✕ Pulisci filtri
          </button>
        )}
        <span style={{ fontSize: 12, color: T.sub, fontWeight: 600 }}>{filtrati.length} organismi · {fmt(totale)}</span>
      </div>
      <TabellaOrganismi organismi={filtrati} onSelect={setSelected} />
    </div>
  );
}

// ── KPI CARD ──────────────────────────────────────────────────
function KpiCard({ label, value, sub, color, bg, icon }) {
  return (
    <div style={{ background: bg || T.bianco, border: `1px solid ${T.bordo}`, borderRadius: 10, padding: "16px 18px", position: "relative", overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: color }} />
      {icon && <div style={{ fontSize: 20, marginBottom: 6 }}>{icon}</div>}
      <div style={{ fontSize: 10, color: T.muted, textTransform: "uppercase", letterSpacing: 1.2, fontWeight: 700, marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 900, color: T.testo, ...mono }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: T.sub, fontWeight: 600, marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

// ── DASHBOARD (stile istituzionale) ─────────────────────────
const serif = { fontFamily: "Georgia, 'Times New Roman', serif" };

function Dashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [hovDec, setHovDec] = useState(null);

  useEffect(() => {
    async function load() {
      // Conteggi esatti (evitano il limite di 1000 righe di Supabase)
      const [{ count: orgCount }, { count: conSedeCount }, { count: decCount }, { data: dec }] = await Promise.all([
        supabase.schema("contributi_mic").from("organismi").select("id", { count: "exact", head: true }),
        supabase.schema("contributi_mic").from("organismi").select("id", { count: "exact", head: true }).not("comune_id", "is", null),
        supabase.schema("contributi_mic").from("decreti").select("id", { count: "exact", head: true }),
        supabase.schema("contributi_mic").from("decreti").select("*, ambito:ambito_id(nome)").order("anno_finanziario", { ascending: false }).order("data", { ascending: false }),
      ]);

      // Paginazione per i totali contributi (somma su tutte le assegnazioni)
      let allAss = [];
      let from = 0;
      const pageSize = 1000;
      while (true) {
        const { data, error } = await supabase.schema("contributi_mic").from("assegnazioni").select("contributo_assegnato, anno").range(from, from + pageSize - 1);
        if (error || !data || data.length === 0) break;
        allAss = allAss.concat(data);
        if (data.length < pageSize) break;
        from += pageSize;
      }

      const mic25 = allAss.filter(a=>a.anno===2025).reduce((s,a)=>s+(a.contributo_assegnato||0),0);
      const mic26 = allAss.filter(a=>a.anno===2026).reduce((s,a)=>s+(a.contributo_assegnato||0),0);
      setStats({ org: orgCount||0, conSede: conSedeCount||0, dec: decCount||0, mic25, mic26, ass: allAss.length, decreti: dec||[] });
      setLoading(false);
    }
    load();
  }, []);

  if (loading) return <div style={{ padding: 48, color: T.muted }}>Caricamento…</div>;

  const ambiti = [
    { label: "Teatro", value: 87525820, color: "#8B1A1A" },
    { label: "Musica", value: 45500848, color: "#1A4A8A" },
    { label: "Danza", value: 19383024, color: "#B8960C" },
    { label: "Multidisciplinare", value: 16733464, color: "#2E7D52" },
    { label: "Circo", value: 9296751, color: "#7A4F1A" },
    { label: "Reg. Puglia", value: 7962128, color: "#5A1A6B" },
  ];
  const maxVal = Math.max(...ambiti.map(a => a.value));
  const fmtM = (n) => (n / 1000000).toFixed(1) + "M €";
  const PAL = { ink: "#0D1B2A", inkLight: "#1E3A5F", gold: "#B8960C", goldMid: "#D4AF37",
    blue: "#1A4A8A", blueLight: "#E8EEF8", green: "#1A5C3A", border: "#DDE3EC", sub: "#3D5A7A" };

  const decretiOrdinati = [...stats.decreti].sort((a,b) => (b.stanziamento_totale||0) - (a.stanziamento_totale||0));

  return (
    <div>
      {/* HERO istituzionale */}
      <div style={{ background: "linear-gradient(160deg, " + PAL.ink + " 0%, " + PAL.inkLight + " 100%)", padding: "32px 36px 28px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 14 }}>
          <div>
            <div style={{ fontSize: 10, color: PAL.goldMid, letterSpacing: 3, textTransform: "uppercase", fontWeight: 700, marginBottom: 8 }}>
              Fondo Nazionale per lo Spettacolo dal Vivo · Triennio 2025/2027
            </div>
            <h1 style={{ fontSize: 28, fontWeight: 900, color: "#FFFFFF", margin: 0, lineHeight: 1.15, ...serif }}>
              Contributi Spettacolo <span style={{ color: PAL.goldMid }}>dal Vivo</span>
            </h1>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", marginTop: 8 }}>
              MIC · FNSV · Regione Puglia — Annualità 2025 e 2026
            </div>
          </div>
          <div style={{ display: "flex", gap: 2 }}>
            {["MIC · FNSV", "Regione Puglia", "POC 2021-2027"].map(t => (
              <span key={t} style={{ background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.5)", padding: "5px 12px", fontSize: 10, fontWeight: 600, letterSpacing: 1, border: "1px solid rgba(255,255,255,0.1)", borderRadius: 2 }}>{t}</span>
            ))}
          </div>
        </div>

        {/* KPI strip */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 12, marginTop: 26 }}>
          {[
            { label: "Organismi censiti", value: stats.org.toLocaleString("it-IT"), sub: stats.conSede.toLocaleString("it-IT") + " con sede", accent: PAL.goldMid },
            { label: "Decreti importati", value: stats.dec, sub: stats.ass.toLocaleString("it-IT") + " assegnazioni", accent: "#7BA7E0" },
            { label: "Totale MIC 2025", value: fmtM(stats.mic25), sub: "Tutti gli ambiti", accent: "#7EE8A2" },
            { label: "Totale MIC 2026", value: fmtM(stats.mic26), sub: "Parziale", accent: "#F0C040" },
            { label: "Regione Puglia", value: "8,0M €", sub: "POC 2021-2027 / anno", accent: "#E08080" },
          ].map((k, i) => (
            <div key={i} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderTop: "2px solid " + k.accent, borderRadius: 6, padding: "14px 16px" }}>
              <div style={{ fontSize: 9, color: "rgba(255,255,255,0.45)", textTransform: "uppercase", letterSpacing: 1.5, fontWeight: 700, marginBottom: 8 }}>{k.label}</div>
              <div style={{ fontSize: 21, fontWeight: 900, color: "#FFFFFF", ...mono }}>{k.value}</div>
              <div style={{ fontSize: 10, color: k.accent, marginTop: 4, fontWeight: 600 }}>{k.sub}</div>
            </div>
          ))}
        </div>
      </div>

      {/* CORPO */}
      <div style={{ padding: "26px 36px", display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 18 }}>

        {/* COL SINISTRA */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          <div style={{ background: T.bianco, border: "1px solid " + PAL.border, borderRadius: 8, overflow: "hidden" }}>
            <div style={{ padding: "14px 18px", borderBottom: "1px solid " + PAL.border }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: 2 }}>Distribuzione contributi 2025</div>
            </div>
            <div style={{ padding: "16px 18px" }}>
              {ambiti.map(a => (
                <div key={a.label} style={{ marginBottom: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                    <span style={{ fontSize: 12, color: PAL.sub, fontWeight: 600 }}>{a.label}</span>
                    <span style={{ fontSize: 12, fontWeight: 800, color: "#0F172A", ...mono }}>{fmt(a.value)}</span>
                  </div>
                  <div style={{ height: 6, background: PAL.border, borderRadius: 3 }}>
                    <div style={{ width: ((a.value/maxVal)*100) + "%", height: "100%", background: a.color, borderRadius: 3 }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ background: T.bianco, border: "1px solid " + PAL.border, borderRadius: 8, overflow: "hidden" }}>
            <div style={{ padding: "14px 18px", borderBottom: "1px solid " + PAL.border }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: 2 }}>Decreti importati</div>
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: T.sfondo }}>
                  {["Rep.","Decreto","Stanziamento","Fonte"].map(h => (
                    <th key={h} style={{ padding: "8px 14px", textAlign: "left", fontSize: 9, color: T.muted, textTransform: "uppercase", letterSpacing: 1, fontWeight: 700, borderBottom: "1px solid " + PAL.border }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {decretiOrdinati.map((d, i) => (
                  <tr key={d.id}
                    onMouseEnter={() => setHovDec(i)} onMouseLeave={() => setHovDec(null)}
                    style={{ background: hovDec === i ? PAL.blueLight : i % 2 === 0 ? T.bianco : T.sfondo, borderBottom: "1px solid " + PAL.border }}>
                    <td style={{ padding: "9px 14px", ...mono, fontWeight: 800, color: PAL.blue, fontSize: 11 }}>{d.numero_rep}</td>
                    <td style={{ padding: "9px 14px", fontSize: 12, fontWeight: 600, color: T.testo }}>{d.ambito?.nome} {d.anno_finanziario}</td>
                    <td style={{ padding: "9px 14px", fontSize: 12, fontWeight: 700, color: PAL.green, ...mono }}>{fmtM(d.stanziamento_totale||0)}</td>
                    <td style={{ padding: "9px 14px" }}><BadgeTipo tipo={d.tipo} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* COL DESTRA */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          <div style={{ background: "linear-gradient(135deg, #2A0A00, #5C1A00)", border: "1px solid #7A3A00", borderRadius: 8, padding: "18px 20px" }}>
            <div style={{ fontSize: 9, color: "#FCA97A", letterSpacing: 2.5, textTransform: "uppercase", fontWeight: 700, marginBottom: 12 }}>Focus · Puglia e Basilicata</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {[
                { label: "Puglia MIC 2025", value: "2,0M €", color: "#FCD34D" },
                { label: "Puglia MIC 2026", value: "1,9M €", color: "#93C5FD" },
                { label: "Regione Puglia", value: "7,8M €", color: "#FCA5A5" },
                { label: "Basilicata MIC", value: "0,2M €", color: "#86EFAC" },
              ].map(k => (
                <div key={k.label} style={{ background: "rgba(255,255,255,0.06)", borderRadius: 6, padding: "11px 13px", borderLeft: "3px solid " + k.color }}>
                  <div style={{ fontSize: 9, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 5, fontWeight: 600 }}>{k.label}</div>
                  <div style={{ fontSize: 17, fontWeight: 900, color: k.color, ...mono }}>{k.value}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ background: T.bianco, border: "1px solid " + PAL.border, borderRadius: 8, overflow: "hidden" }}>
            <div style={{ padding: "14px 18px", borderBottom: "1px solid " + PAL.border }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: 2 }}>Copertura dati</div>
            </div>
            <div style={{ padding: "10px 18px" }}>
              {[
                { label: "Danza 2025/2026", ok: true },
                { label: "Circo 2025/2026", ok: true },
                { label: "Multidisciplinare 2025/2026", ok: true },
                { label: "Musica 2025", ok: true },
                { label: "Teatro 2025", ok: true },
                { label: "Regione Puglia 2025-2027", ok: true },
                { label: "Pratiche musicali periferie", ok: true },
                { label: "Musica 2026", ok: false },
                { label: "Teatro 2026", ok: false },
              ].map(r => (
                <div key={r.label} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 0", borderBottom: "1px solid " + PAL.border }}>
                  <div style={{ width: 18, height: 18, borderRadius: "50%", background: r.ok ? PAL.green : PAL.border, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <span style={{ fontSize: 9, color: r.ok ? "#FFFFFF" : T.muted, fontWeight: 900 }}>{r.ok ? "✓" : "○"}</span>
                  </div>
                  <span style={{ fontSize: 12, color: r.ok ? T.testo : T.muted, fontWeight: r.ok ? 600 : 400 }}>{r.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ background: PAL.blueLight, border: "1px solid " + PAL.border, borderLeft: "3px solid " + PAL.blue, borderRadius: 6, padding: "13px 15px" }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: PAL.blue, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Nota metodologica</div>
            <div style={{ fontSize: 11, color: PAL.sub, lineHeight: 1.6 }}>
              I contributi MIC 2026 sono parziali — mancano i decreti Musica e Teatro 2026. I dati Regione Puglia si riferiscono al 2025, con importo invariato su 2026/2027 salvo aggiornamenti.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── PUGLIA & BASILICATA ───────────────────────────────────────
function generaReportHTML(organismi, modalita = "entrambi") {
  const fmt2 = (n) => new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n || 0);
  const oggi = new Date().toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" });

  const mostraMic = modalita === "entrambi" || modalita === "solo_mic";
  const mostraReg = modalita === "entrambi" || modalita === "solo_reg";

  // Solo decreti FNSV "madre" — esclude bandi speciali (Periferie, Progetti Speciali, Tournée Estero)
  const DECRETI_MADRE_FNSV = ['1125','855','1291','1074','787','1137','770','1173','783'];

  const righe = organismi.map(o => {
    const mic = { 2025: 0, 2026: 0, 2027: 0 };
    const reg = { 2025: 0, 2026: 0, 2027: 0 };
    o.assegnazioni.forEach(a => {
      if (a.tipo_decreto === "REG_PU") {
        if (reg[a.anno] !== undefined) reg[a.anno] += (a.contributo_assegnato || 0);
      } else if (DECRETI_MADRE_FNSV.includes(String(a.numero_rep))) {
        if (mic[a.anno] !== undefined) mic[a.anno] += (a.contributo_assegnato || 0);
      }
    });
    const totaleMic = mic[2025] + mic[2026];
    const totaleReg = reg[2025] + reg[2026];
    const totaleRilevante = (mostraMic ? totaleMic : 0) + (mostraReg ? totaleReg : 0);
    const varMic = mic[2025] > 0 ? ((mic[2026] - mic[2025]) / mic[2025]) * 100 : null;
    const varReg = reg[2025] > 0 ? ((reg[2026] - reg[2025]) / reg[2025]) * 100 : null;
    return { ...o, mic, reg, totaleMic, totaleReg, totaleRilevante, varMic, varReg };
  }).filter(r => {
    if (mostraMic && mostraReg) return r.totaleMic > 0 || r.totaleReg > 0;
    if (mostraMic) return r.totaleMic > 0;
    return r.totaleReg > 0;
  }).sort((a, b) => b.totaleRilevante - a.totaleRilevante);

  const micTot2025 = righe.reduce((s, r) => s + r.mic[2025], 0);
  const micTot2026 = righe.reduce((s, r) => s + r.mic[2026], 0);
  const regTot2025 = righe.reduce((s, r) => s + r.reg[2025], 0);
  const regTot2026 = righe.reduce((s, r) => s + r.reg[2026], 0);
  const varMicTotale = micTot2025 > 0 ? ((micTot2026 - micTot2025) / micTot2025) * 100 : 0;
  const varRegTotale = regTot2025 > 0 ? ((regTot2026 - regTot2025) / regTot2025) * 100 : 0;

  const variazioneTag = (v) => {
    if (v === null) return '<span style="color:#94A3B8;">&mdash;</span>';
    const color = v >= 0 ? "#059669" : "#DC2626";
    const icona = v >= 0 ? "&#9650;" : "&#9660;";
    return `<span style="color:${color};font-weight:700;">${icona} ${v>=0?'+':''}${v.toFixed(1)}%</span>`;
  };

  const colMic = mostraMic ? `
        <td style="padding:11px 10px;text-align:right;font-family:monospace;color:#1D4ED8;font-size:13px;border-bottom:1px solid #E2E8F0;background:#EFF6FF;">__MIC25__</td>
        <td style="padding:11px 10px;text-align:right;font-family:monospace;color:#1D4ED8;font-size:13px;border-bottom:1px solid #E2E8F0;background:#EFF6FF;">__MIC26__</td>
        <td style="padding:11px 10px;text-align:right;font-size:12px;border-bottom:1px solid #E2E8F0;background:#EFF6FF;">__VARMIC__</td>` : '';
  const colReg = mostraReg ? `
        <td style="padding:11px 10px;text-align:right;font-family:monospace;color:#C2410C;font-size:13px;border-bottom:1px solid #E2E8F0;background:#FFF7ED;">__REG25__</td>
        <td style="padding:11px 10px;text-align:right;font-family:monospace;color:#C2410C;font-size:13px;border-bottom:1px solid #E2E8F0;background:#FFF7ED;">__REG26__</td>
        <td style="padding:11px 10px;text-align:right;font-size:12px;border-bottom:1px solid #E2E8F0;background:#FFF7ED;">__VARREG__</td>` : '';

  const righeHTML = righe.map((r, idx) => {
    let row = `
      <tr class="riga-org" data-idx="${idx}" style="cursor:pointer;" onmouseover="this.style.background='#F0F9FF'" onmouseout="this.style.background=''">
        <td style="padding:11px 12px;font-weight:700;color:#0F172A;border-bottom:1px solid #E2E8F0;font-size:13px;">${r.denominazione} <span style="color:#94A3B8;font-size:10px;">&#8599;</span></td>
        <td style="padding:11px 12px;color:#64748B;font-size:12px;border-bottom:1px solid #E2E8F0;">${r.comune || '&mdash;'}</td>${colMic}${colReg}
        <td style="padding:11px 12px;text-align:right;font-family:monospace;font-weight:800;color:#065F46;font-size:13px;border-bottom:1px solid #E2E8F0;">${fmt2(r.totaleRilevante)}</td>
      </tr>`;
    row = row.replace('__MIC25__', r.mic[2025] > 0 ? fmt2(r.mic[2025]) : '&mdash;')
             .replace('__MIC26__', r.mic[2026] > 0 ? fmt2(r.mic[2026]) : '&mdash;')
             .replace('__VARMIC__', variazioneTag(r.varMic))
             .replace('__REG25__', r.reg[2025] > 0 ? fmt2(r.reg[2025]) : '&mdash;')
             .replace('__REG26__', r.reg[2026] > 0 ? fmt2(r.reg[2026]) : '&mdash;')
             .replace('__VARREG__', variazioneTag(r.varReg));
    return row;
  }).join('');

  const theadMic = mostraMic ? `<th style="text-align:right;background:#1E3A8A;">2025</th><th style="text-align:right;background:#1E3A8A;">2026</th><th style="text-align:right;background:#1E3A8A;">Var.</th>` : '';
  const theadReg = mostraReg ? `<th style="text-align:right;background:#9A3412;">2025</th><th style="text-align:right;background:#9A3412;">2026</th><th style="text-align:right;background:#9A3412;">Var.</th>` : '';
  const theadGroupMic = mostraMic ? `<th colspan="3" style="text-align:center;background:#1E3A8A;">MIC &middot; FNSV</th>` : '';
  const theadGroupReg = mostraReg ? `<th colspan="3" style="text-align:center;background:#9A3412;">Regione Puglia</th>` : '';

  const tfootMic = mostraMic ? `
          <td style="padding:12px;text-align:right;font-family:monospace;font-size:13px;">${fmt2(micTot2025)}</td>
          <td style="padding:12px;text-align:right;font-family:monospace;font-size:13px;">${fmt2(micTot2026)}</td>
          <td style="padding:12px;text-align:right;font-size:12px;">${variazioneTag(varMicTotale)}</td>` : '';
  const tfootReg = mostraReg ? `
          <td style="padding:12px;text-align:right;font-family:monospace;font-size:13px;">${fmt2(regTot2025)}</td>
          <td style="padding:12px;text-align:right;font-family:monospace;font-size:13px;">${fmt2(regTot2026)}</td>
          <td style="padding:12px;text-align:right;font-size:12px;">${variazioneTag(varRegTotale)}</td>` : '';

  const kpiMic = mostraMic ? `
      <div class="kpi"><div class="label">MIC 2025</div><div class="value" style="color:#1D4ED8;">${fmt2(micTot2025)}</div></div>
      <div class="kpi"><div class="label">MIC 2026</div><div class="value" style="color:#1D4ED8;">${fmt2(micTot2026)}</div></div>
      <div class="kpi" style="border-top-color:${varMicTotale>=0?'#059669':'#DC2626'};"><div class="label">Var. MIC</div><div class="value" style="color:${varMicTotale>=0?'#059669':'#DC2626'};">${varMicTotale>=0?'+':''}${varMicTotale.toFixed(1)}%</div></div>` : '';
  const kpiReg = mostraReg ? `
      <div class="kpi" style="border-top-color:#C2410C;"><div class="label">Reg. Puglia 2025</div><div class="value" style="color:#C2410C;">${fmt2(regTot2025)}</div></div>
      <div class="kpi" style="border-top-color:#C2410C;"><div class="label">Reg. Puglia 2026</div><div class="value" style="color:#C2410C;">${fmt2(regTot2026)}</div></div>
      <div class="kpi" style="border-top-color:${varRegTotale>=0?'#059669':'#DC2626'};"><div class="label">Var. Reg. Puglia</div><div class="value" style="color:${varRegTotale>=0?'#059669':'#DC2626'};">${varRegTotale>=0?'+':''}${varRegTotale.toFixed(1)}%</div></div>` : '';

  const titoloModalita = modalita === "solo_mic" ? "Decreti Madre FNSV" : modalita === "solo_reg" ? "Regione Puglia" : "Decreti Madre FNSV e Regione Puglia";
  const noteModalita = modalita === "entrambi" ? "Esclusi bandi speciali (Periferie, Progetti Speciali, Tourn&eacute;e Estero)" : modalita === "solo_mic" ? "Solo MIC/FNSV &mdash; esclusa Regione Puglia e bandi speciali" : "Solo Regione Puglia &mdash; POC 2021-2027";

  // Dati organismi serializzati per il click (apre scheda nella finestra principale)
  const datiOrganismiJSON = JSON.stringify(righe.map(r => ({ denominazione: r.denominazione, id_organismo: r.id_organismo || r.id }))).replace(/</g, '\\u003c');

  return `<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="UTF-8">
<title>Report Puglia e Basilicata - ${titoloModalita}</title>
<style>
  @page { margin: 14mm 10mm; size: A4 landscape; }
  * { box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #0F172A; margin: 0; padding: 0; }
  .header { background: linear-gradient(135deg,#0A1628,#1E3A5F); color: white; padding: 26px 30px; margin-bottom: 20px; }
  .header .sub { font-size: 11px; color: #F0C040; text-transform: uppercase; letter-spacing: 2px; font-weight: 700; margin-bottom: 8px; }
  .header h1 { font-size: 24px; margin: 0; font-weight: 900; }
  .header p { font-size: 12px; color: rgba(255,255,255,0.6); margin: 8px 0 0; }
  .kpi-row { display: flex; gap: 12px; margin-bottom: 24px; }
  .kpi { flex: 1; background: #F8FAFC; border: 1px solid #E2E8F0; border-top: 3px solid #1D4ED8; border-radius: 6px; padding: 14px 16px; }
  .kpi .label { font-size: 10px; color: #64748B; text-transform: uppercase; letter-spacing: 1px; font-weight: 700; margin-bottom: 7px; }
  .kpi .value { font-size: 19px; font-weight: 900; font-family: monospace; }
  .section-title { font-size: 13px; font-weight: 700; color: #64748B; text-transform: uppercase; letter-spacing: 1.5px; margin: 24px 0 12px; border-bottom: 2px solid #E2E8F0; padding-bottom: 7px; }
  table { width: 100%; border-collapse: collapse; }
  thead th { background: #0A1628; color: white; padding: 11px 10px; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; }
  .footer { margin-top: 28px; padding-top: 12px; border-top: 1px solid #E2E8F0; font-size: 10px; color: #94A3B8; display: flex; justify-content: space-between; }
  .riga-org:hover { background: #F0F9FF; }
  @media print { .no-print { display: none; } table { page-break-inside: auto; } tr { page-break-inside: avoid; } }
</style>
</head>
<body>
  <div class="header">
    <div class="sub">AGIS Puglia e Basilicata &middot; Gestionale Contributi Spettacolo dal Vivo</div>
    <h1>Report Puglia &amp; Basilicata &mdash; ${titoloModalita} &middot; 2025/2026</h1>
    <p>Generato il ${oggi} &middot; ${righe.length} organismi &middot; ${noteModalita}</p>
  </div>

  <div style="padding:0 6px;">
    <div class="kpi-row">${kpiMic}${kpiReg}
    </div>

    <div class="section-title">Elenco completo &mdash; clicca un organismo per il dettaglio assegnazioni</div>
    <table>
      <thead>
        <tr>
          <th rowspan="2" style="vertical-align:bottom;">Organismo</th>
          <th rowspan="2" style="vertical-align:bottom;">Sede</th>${theadGroupMic}${theadGroupReg}
          <th rowspan="2" style="text-align:right;vertical-align:bottom;">Totale</th>
        </tr>
        <tr>${theadMic}${theadReg}
        </tr>
      </thead>
      <tbody>
        ${righeHTML}
      </tbody>
      <tfoot>
        <tr style="background:#F1F5F9;font-weight:800;">
          <td colspan="2" style="padding:12px;font-size:13px;">TOTALE</td>${tfootMic}${tfootReg}
          <td style="padding:12px;text-align:right;font-family:monospace;font-size:14px;color:#065F46;">${fmt2((mostraMic?micTot2025+micTot2026:0)+(mostraReg?regTot2025+regTot2026:0))}</td>
        </tr>
      </tfoot>
    </table>

    <div class="footer">
      <span>AGIS Puglia e Basilicata &middot; Gestionale Contributi &middot; Dati MIC / DG Spettacolo e Regione Puglia</span>
      <span>Report generato automaticamente</span>
    </div>
  </div>

  <div class="no-print" style="text-align:center;margin-top:24px;">
    <button onclick="window.print()" style="padding:11px 26px;background:#1D4ED8;color:white;border:none;border-radius:6px;font-size:14px;font-weight:700;cursor:pointer;">Stampa / Salva PDF</button>
  </div>

  <script>
    var ORGANISMI_DATA = ${datiOrganismiJSON};
    document.querySelectorAll('.riga-org').forEach(function(tr) {
      tr.addEventListener('click', function() {
        var idx = parseInt(tr.getAttribute('data-idx'));
        var org = ORGANISMI_DATA[idx];
        if (window.opener && !window.opener.closed) {
          window.opener.postMessage({ tipo: 'apri_organismo', denominazione: org.denominazione, id: org.id_organismo }, '*');
          window.opener.focus();
        }
      });
    });
  </script>
</body>
</html>`;
}

function esportaExcel(organismi) {
  const DECRETI_MADRE_FNSV = ['1125','855','1291','1074','787','1137','770','1173','783'];

  const righe = organismi.map(o => {
    const mic = { 2025: 0, 2026: 0, 2027: 0 };
    const reg = { 2025: 0, 2026: 0, 2027: 0 };
    o.assegnazioni.forEach(a => {
      if (a.tipo_decreto === "REG_PU") {
        if (reg[a.anno] !== undefined) reg[a.anno] += (a.contributo_assegnato || 0);
      } else if (DECRETI_MADRE_FNSV.includes(String(a.numero_rep))) {
        if (mic[a.anno] !== undefined) mic[a.anno] += (a.contributo_assegnato || 0);
      }
    });
    return { ...o, mic, reg };
  }).filter(r => r.mic[2025]+r.mic[2026]+r.reg[2025]+r.reg[2026] > 0)
    .sort((a, b) => (b.mic[2025]+b.mic[2026]+b.reg[2025]+b.reg[2026]) - (a.mic[2025]+a.mic[2026]+a.reg[2025]+a.reg[2026]));

  // Formatta numero in stile italiano (virgola decimale, niente separatore migliaia per compatibilità CSV)
  const numIT = (n) => n.toFixed(2).replace(".", ",");

  const header = ["Organismo","CF","Sede","Provincia","MIC 2025","MIC 2026","Var. MIC %","Reg. Puglia 2025","Reg. Puglia 2026","Var. Reg.Puglia %","Totale"];
  const rows = righe.map(r => {
    const varMic = r.mic[2025] > 0 ? (((r.mic[2026]-r.mic[2025])/r.mic[2025])*100).toFixed(1).replace(".", ",") : "";
    const varReg = r.reg[2025] > 0 ? (((r.reg[2026]-r.reg[2025])/r.reg[2025])*100).toFixed(1).replace(".", ",") : "";
    // CF con prefisso ="..." forza Excel a trattarlo come testo, preservando lo zero iniziale
    const cfTesto = r.codice_fiscale ? `="${r.codice_fiscale.trim()}"` : "";
    return [
      r.denominazione, cfTesto, r.comune || "", r.sigla_provincia || "",
      numIT(r.mic[2025]), numIT(r.mic[2026]), varMic,
      numIT(r.reg[2025]), numIT(r.reg[2026]), varReg,
      numIT(r.mic[2025]+r.mic[2026]+r.reg[2025]+r.reg[2026])
    ];
  });

  const csvLines = [header, ...rows].map(row =>
    row.map(cell => {
      const s = String(cell).replace(/"/g, '""');
      return /[;",\n]/.test(s) && !s.startsWith('="') ? `"${s}"` : s;
    }).join(";")
  );
  const csvContent = "\uFEFF" + csvLines.join("\r\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const oggi = new Date().toISOString().slice(0,10);
  link.href = url;
  link.download = `report_puglia_basilicata_${oggi}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function PugliaBasilicata() {
  const { organismi, loading } = useOrganismi({ regioni: ["Puglia", "Basilicata"] });
  const [selected, setSelected] = useState(null);
  const [menuReportAperto, setMenuReportAperto] = useState(false);

  const totPU = organismi.filter(o => o.regione === "Puglia").reduce((s, o) => s + o.assegnazioni.filter(a => a.tipo_decreto === "MIC_FNSV").reduce((ss, a) => ss + (a.contributo_assegnato || 0), 0), 0);
  const totBA = organismi.filter(o => o.regione === "Basilicata").reduce((s, o) => s + o.assegnazioni.filter(a => a.tipo_decreto === "MIC_FNSV").reduce((ss, a) => ss + (a.contributo_assegnato || 0), 0), 0);
  const totRegPU = organismi.filter(o => o.fonti.includes("REG_PU")).reduce((s, o) => s + o.assegnazioni.filter(a => a.tipo_decreto === "REG_PU" && a.anno === 2025).reduce((ss, a) => ss + (a.contributo_assegnato || 0), 0), 0);

  // Ascolta i messaggi dalla finestra di report per apertura scheda organismo
  useEffect(() => {
    function handleMessage(event) {
      if (event.data?.tipo === "apri_organismo") {
        const org = organismi.find(o => o.denominazione === event.data.denominazione);
        if (org) setSelected(org);
      }
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [organismi]);

  function apriReport(modalita) {
    const html = generaReportHTML(organismi, modalita);
    const win = window.open('', '_blank');
    win.document.write(html);
    win.document.close();
    setMenuReportAperto(false);
  }

  if (loading) return <div style={{ padding: 48, color: T.muted }}>Caricamento…</div>;

  return (
    <div>
      {selected && <SchedaOrganismo org={selected} onClose={() => setSelected(null)} />}

      <div style={{ background: "linear-gradient(135deg,#7C2D12,#C2410C,#EA580C)", padding: "24px 36px", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", right: -40, top: -40, width: 200, height: 200, borderRadius: "50%", background: "rgba(255,255,255,0.06)" }} />
        <div style={{ position: "relative", display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={{ fontSize: 9, color: "rgba(255,255,255,0.6)", letterSpacing: 3, textTransform: "uppercase", marginBottom: 6, fontWeight: 600 }}>AGIS · Focus Regionale</div>
            <h1 style={{ fontSize: 26, fontWeight: 900, color: "#FFFFFF", margin: "0 0 6px", ...serif }}>Puglia <span style={{ color: "#FED7AA" }}>&</span> Basilicata</h1>
            <p style={{ fontSize: 12, color: "rgba(255,255,255,0.55)", margin: 0 }}>Contributi MIC/FNSV e Regione Puglia · {organismi.length} organismi</p>
          </div>
          <div style={{ display: "flex", gap: 8, position: "relative" }}>
            <div style={{ position: "relative" }}>
              <button onClick={() => setMenuReportAperto(!menuReportAperto)} style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.3)", color: "#FFFFFF", padding: "10px 18px", borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                📄 Genera Report ▾
              </button>
              {menuReportAperto && (
                <div style={{ position: "absolute", top: "110%", right: 0, background: "#FFFFFF", borderRadius: 8, boxShadow: "0 8px 24px rgba(0,0,0,0.25)", minWidth: 220, zIndex: 50, overflow: "hidden" }}>
                  <button onClick={() => apriReport("entrambi")} style={{ display: "block", width: "100%", textAlign: "left", padding: "12px 16px", border: "none", background: "white", cursor: "pointer", fontSize: 13, fontWeight: 600, color: "#0F172A", borderBottom: "1px solid #F1F5F9" }}
                    onMouseOver={e => e.currentTarget.style.background = "#F8FAFC"} onMouseOut={e => e.currentTarget.style.background = "white"}>
                    🔵🟠 MIC + Regione Puglia
                  </button>
                  <button onClick={() => apriReport("solo_mic")} style={{ display: "block", width: "100%", textAlign: "left", padding: "12px 16px", border: "none", background: "white", cursor: "pointer", fontSize: 13, fontWeight: 600, color: "#0F172A", borderBottom: "1px solid #F1F5F9" }}
                    onMouseOver={e => e.currentTarget.style.background = "#F8FAFC"} onMouseOut={e => e.currentTarget.style.background = "white"}>
                    🔵 Solo MIC · FNSV
                  </button>
                  <button onClick={() => apriReport("solo_reg")} style={{ display: "block", width: "100%", textAlign: "left", padding: "12px 16px", border: "none", background: "white", cursor: "pointer", fontSize: 13, fontWeight: 600, color: "#0F172A" }}
                    onMouseOver={e => e.currentTarget.style.background = "#F8FAFC"} onMouseOut={e => e.currentTarget.style.background = "white"}>
                    🟠 Solo Regione Puglia
                  </button>
                </div>
              )}
            </div>
            <button onClick={() => esportaExcel(organismi)} style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.3)", color: "#FFFFFF", padding: "10px 18px", borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
              📊 Esporta Excel
            </button>
          </div>
        </div>
      </div>

      <div style={{ padding: "22px 36px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 22 }}>
          <div style={{ background: "#FEF9C3", border: "1px solid #FCD34D", borderTop: `3px solid #92400E`, borderRadius: 10, padding: "16px 18px" }}>
            <div style={{ fontSize: 10, color: "#78350F", textTransform: "uppercase", letterSpacing: 1, fontWeight: 700, marginBottom: 8 }}>🎭 Puglia — MIC/FNSV</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: "#0F172A", ...mono }}>{fmt(totPU)}</div>
            <div style={{ fontSize: 11, color: T.sub, fontWeight: 600, marginTop: 3 }}>{organismi.filter(o=>o.regione==="Puglia").length} organismi</div>
          </div>
          <div style={{ background: "#D1FAE5", border: "1px solid #6EE7B7", borderTop: `3px solid #065F46`, borderRadius: 10, padding: "16px 18px" }}>
            <div style={{ fontSize: 10, color: "#064E3B", textTransform: "uppercase", letterSpacing: 1, fontWeight: 700, marginBottom: 8 }}>🎭 Basilicata — MIC/FNSV</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: "#0F172A", ...mono }}>{fmt(totBA)}</div>
            <div style={{ fontSize: 11, color: T.sub, fontWeight: 600, marginTop: 3 }}>{organismi.filter(o=>o.regione==="Basilicata").length} organismi</div>
          </div>
          <div style={{ background: "#FFEDD5", border: "1px solid #FCA5A5", borderTop: `3px solid #C2410C`, borderRadius: 10, padding: "16px 18px" }}>
            <div style={{ fontSize: 10, color: "#7C2D12", textTransform: "uppercase", letterSpacing: 1, fontWeight: 700, marginBottom: 8 }}>🏛 Regione Puglia (annuale)</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: "#0F172A", ...mono }}>{fmt(totRegPU)}</div>
            <div style={{ fontSize: 11, color: T.sub, fontWeight: 600, marginTop: 3 }}>POC 2021-2027</div>
          </div>
          <div style={{ background: "#EFF6FF", border: "1px solid #BFDBFE", borderTop: `3px solid #1D4ED8`, borderRadius: 10, padding: "16px 18px" }}>
            <div style={{ fontSize: 10, color: "#1E3A8A", textTransform: "uppercase", letterSpacing: 1, fontWeight: 700, marginBottom: 8 }}>≡ Totale cumulato</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: "#0F172A", ...mono }}>{fmt(totPU + totBA + totRegPU)}</div>
            <div style={{ fontSize: 11, color: T.sub, fontWeight: 600, marginTop: 3 }}>{organismi.length} organismi unici</div>
          </div>
        </div>

        <Organismi filtroRegionePre={["Puglia", "Basilicata"]} />
      </div>
    </div>
  );
}


function Decreti() {
  const [dati, setDati] = useState([]);
  const [loading, setLoading] = useState(true);
  const [decretoSel, setDecretoSel] = useState(null);
  const [assegnazioni, setAssegnazioni] = useState([]);
  const [loadingAss, setLoadingAss] = useState(false);
  const [selected, setSelected] = useState(null);
  const { organismi } = useOrganismi();

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
    const map = {};
    for (const a of (data || [])) {
      const key = a.id_organismo;
      if (!map[key]) {
        map[key] = { ...a, id: key, ambiti: new Set(), anni: new Set(), fonti: new Set(), totale: 0, assegnazioni: [] };
      }
      map[key].ambiti.add(a.ambito);
      map[key].anni.add(a.anno);
      map[key].fonti.add(a.tipo_decreto);
      map[key].totale += a.contributo_assegnato || 0;
      map[key].assegnazioni.push(a);
    }
    setAssegnazioni(Object.values(map).map(o => ({ ...o, ambiti: [...o.ambiti], anni: [...o.anni], fonti: [...o.fonti] })));
    setLoadingAss(false);
  }

  if (loading) return <div style={{ padding: 48, color: T.muted }}>Caricamento…</div>;

  return (
    <div style={{ padding: "28px 36px" }}>
      {selected && <SchedaOrganismo org={selected} onClose={() => setSelected(null)} />}
      <div style={{ marginBottom: 22 }}>
        <h1 style={{ fontSize: 22, fontWeight: 900, color: T.testo, margin: 0 }}>Decreti importati</h1>
        <p style={{ fontSize: 12, color: T.muted, margin: "5px 0 0" }}>Clicca un decreto per vedere gli organismi finanziati</p>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {dati.map(d => (
          <div key={d.id}>
            <div onClick={() => apriDecreto(d)} style={{ background: T.bianco, border: `1px solid ${decretoSel?.id === d.id ? T.marino : T.bordo}`, borderLeft: `4px solid ${T.oro}`, borderRadius: 8, padding: "14px 20px", display: "flex", alignItems: "center", gap: 16, cursor: "pointer", boxShadow: "0 1px 3px rgba(0,0,0,0.05)", transition: "border-color 0.15s" }}>
              <div style={{ background: T.inchiostro, color: "#FFFFFF", borderRadius: 6, padding: "8px 14px", textAlign: "center", flexShrink: 0, ...mono }}>
                <div style={{ fontSize: 8, color: "rgba(255,255,255,0.4)", letterSpacing: 1 }}>REP.</div>
                <div style={{ fontSize: 18, fontWeight: 900, lineHeight: 1 }}>{d.numero_rep?.slice(0,10)}</div>
                <div style={{ fontSize: 9, color: T.oro, marginTop: 2 }}>{d.anno_finanziario}</div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <span style={{ fontWeight: 700, fontSize: 14, color: T.testo }}>{d.ambito?.nome}</span>
                  <BadgeTipo tipo={d.tipo} />
                </div>
                <div style={{ fontSize: 11, color: T.sub, fontWeight: 500 }}>{d.ente_erogante} · {d.data}</div>
              </div>
              <div style={{ fontSize: 16, fontWeight: 900, color: "#065F46", ...mono }}>{fmt(d.stanziamento_totale)}</div>
              <div style={{ fontSize: 16, color: T.muted, marginLeft: 8 }}>{decretoSel?.id === d.id ? "▲" : "▼"}</div>
            </div>
            {decretoSel?.id === d.id && (
              <div style={{ border: `1px solid ${T.bordo}`, borderTop: "none", borderRadius: "0 0 8px 8px", background: T.sfondo, padding: 16 }}>
                {loadingAss ? <div style={{ padding: 20, color: T.muted }}>Caricamento…</div> :
                  <TabellaOrganismi organismi={assegnazioni} onSelect={setSelected} />
                }
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function App() {
  const [sezione, setSezione] = useState("dashboard");
  const contenuto = {
    dashboard:         <Dashboard />,
    organismi:         <div style={{ padding: "22px 36px" }}><div style={{ marginBottom: 18 }}><h1 style={{ fontSize: 22, fontWeight: 900, color: T.testo, margin: 0 }}>Organismi</h1><p style={{ fontSize: 12, color: T.muted, margin: "4px 0 0" }}>Anagrafica completa · Clicca un organismo per vedere tutte le sue assegnazioni</p></div><Organismi /></div>,
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

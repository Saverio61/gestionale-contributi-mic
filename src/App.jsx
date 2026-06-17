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
    const { error } = await supabase.schema("contributi_mic").from("organismi").update({ comune_id: parseInt(comuneSel) }).eq("id", organismo_id);
    setSaving(false);
    if (error) setMsg("Errore: " + error.message);
    else { setMsg("✓ Sede aggiornata."); setTimeout(onSaved, 1000); }
  }

  const sel = { padding: "7px 10px", borderRadius: 5, border: `1px solid ${T.bordo}`, fontSize: 12, background: T.bianco, color: T.testo };
  return (
    <div style={{ background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: 8, padding: "14px 16px", marginBottom: 18 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "#1E3A8A", textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>Modifica sede</div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
        <div>
          <div style={{ fontSize: 10, color: T.sub, marginBottom: 4, fontWeight: 600 }}>Provincia</div>
          <select value={provSel} onChange={e => { setProvSel(e.target.value); setComuneSel(""); }} style={{ ...sel, minWidth: 200 }}>
            <option value="">— Seleziona —</option>
            {province.map(p => <option key={p.id} value={p.id}>{p.nome} ({p.codice}) · {p.regione?.nome}</option>)}
          </select>
        </div>
        <div>
          <div style={{ fontSize: 10, color: T.sub, marginBottom: 4, fontWeight: 600 }}>Comune</div>
          <select value={comuneSel} onChange={e => setComuneSel(e.target.value)} disabled={comuni.length === 0} style={{ ...sel, minWidth: 160, background: comuni.length === 0 ? T.sfondo : T.bianco }}>
            <option value="">— Seleziona —</option>
            {comuni.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </div>
        <button onClick={salva} disabled={!comuneSel || saving}
          style={{ padding: "7px 18px", borderRadius: 5, border: "none", background: comuneSel ? "#1D4ED8" : T.bordo, color: "#FFFFFF", fontSize: 12, fontWeight: 700, cursor: comuneSel ? "pointer" : "default" }}>
          {saving ? "Salvo…" : "Salva"}
        </button>
        {msg && <span style={{ fontSize: 12, color: "#065F46", fontWeight: 700 }}>{msg}</span>}
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
                  {showSede ? "✕ chiudi" : "✎ modifica sede"}
                </button>
              </div>
            </div>
            <button onClick={onClose} style={{ background: "rgba(255,255,255,0.1)", border: "none", color: "#FFFFFF", width: 32, height: 32, borderRadius: 6, cursor: "pointer", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
          </div>
        </div>

        <div style={{ overflow: "auto", flex: 1, padding: "20px 24px" }}>
          {showSede && dati.id_organismo && <FormSede organismo_id={dati.id_organismo} onSaved={ricarica} />}

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
                      {a.numero_sottoinsieme > 1 ? `${["","1°","2°","3°","4°","5°"][a.numero_sottoinsieme]}` : "—"}
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

  const Th = ({ col, label, right }) => (
    <th onClick={() => col && toggleSort(col)} style={{
      padding: "10px 11px", textAlign: right ? "right" : "left",
      color: sortCol === col ? "#FFFFFF" : "rgba(255,255,255,0.65)",
      fontSize: 10, textTransform: "uppercase", fontWeight: 700, letterSpacing: 0.6,
      whiteSpace: "nowrap", cursor: col ? "pointer" : "default",
      background: sortCol === col ? "rgba(255,255,255,0.08)" : "transparent",
      userSelect: "none",
    }}>
      {label}{col && sortCol === col && <span style={{ marginLeft: 4 }}>{sortDir === "desc" ? "↓" : "↑"}</span>}
    </th>
  );

  return (
    <div style={{ borderRadius: 8, overflow: "hidden", border: `1px solid ${T.bordo}`, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: 800 }}>
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
              <th style={{ padding: "10px 8px", background: T.inchiostro, width: 20 }}></th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((o, i) => {
              const isPugBas = o.regione === "Puglia" || o.regione === "Basilicata";
              return (
                <tr key={o.id} onClick={() => onSelect(o)}
                  style={{ background: isPugBas ? "#FFFBF0" : i % 2 === 0 ? T.bianco : T.sfondo, borderBottom: `1px solid ${T.bordo}`, cursor: "pointer" }}>
                  <td style={{ padding: "10px 11px", fontWeight: 700, color: "#0F172A", maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{o.denominazione}</td>
                  <td style={{ padding: "10px 11px", ...mono, fontSize: 11, color: "#1E3A8A", fontWeight: 700 }}>{o.codice_fiscale || <span style={{ color: T.muted }}>—</span>}</td>
                  <td style={{ padding: "10px 11px", fontSize: 11, color: o.comune ? "#374151" : "#DC2626", whiteSpace: "nowrap", fontWeight: 600 }}>
                    {o.comune ? `${o.comune} (${o.sigla_provincia})` : "⚠ mancante"}
                  </td>
                  <td style={{ padding: "10px 11px" }}><BadgeRegione regione={o.regione} /></td>
                  <td style={{ padding: "10px 11px" }}>
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>{o.ambiti.map(a => <BadgeAmbito key={a} ambito={a} />)}</div>
                  </td>
                  <td style={{ padding: "10px 11px", ...mono, color: "#374151", fontWeight: 700, fontSize: 11 }}>{o.anni.join(", ")}</td>
                  <td style={{ padding: "10px 11px" }}>
                    <div style={{ display: "flex", gap: 4 }}>{o.fonti.map(f => <BadgeTipo key={f} tipo={f} />)}</div>
                  </td>
                  <td style={{ padding: "10px 11px", fontWeight: 800, color: "#065F46", ...mono, textAlign: "right", fontSize: 13 }}>{fmt(o.totale)}</td>
                  <td style={{ padding: "10px 8px", color: "#94A3B8", fontSize: 16, textAlign: "center" }}>›</td>
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
      let q = supabase.schema("contributi_mic").from("v_assegnazioni").select("*");
      if (filtriExtra?.regioni) q = q.in("regione", filtriExtra.regioni);
      const { data } = await q.order("denominazione");

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
  const [filtroAmbito, setFiltroAmbito] = useState("tutti");
  const [filtroFonte, setFiltroFonte] = useState("tutti");
  const [selected, setSelected] = useState(null);

  const ambiti = ["tutti", ...new Set(organismi.flatMap(o => o.ambiti).filter(Boolean).sort())];

  const filtrati = organismi.filter(o =>
    (!cerca || o.denominazione?.toLowerCase().includes(cerca.toLowerCase()) ||
               o.comune?.toLowerCase().includes(cerca.toLowerCase()) ||
               (o.codice_fiscale || "").includes(cerca)) &&
    (filtroAmbito === "tutti" || o.ambiti.includes(filtroAmbito)) &&
    (filtroFonte === "tutti" || o.fonti.includes(filtroFonte))
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
          <input value={cerca} onChange={e => setCerca(e.target.value)} placeholder="Cerca organismo, comune, CF…"
            style={{ ...sel, paddingLeft: 32, width: 250 }} />
        </div>
        <select value={filtroAmbito} onChange={e => setFiltroAmbito(e.target.value)} style={sel}>
          {ambiti.map(a => <option key={a}>{a}</option>)}
        </select>
        <select value={filtroFonte} onChange={e => setFiltroFonte(e.target.value)} style={sel}>
          <option value="tutti">Tutte le fonti</option>
          <option value="MIC_FNSV">MIC · FNSV</option>
          <option value="REG_PU">Regione Puglia</option>
        </select>
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
      const [{ data: ass }, { data: org }, { data: dec }] = await Promise.all([
        supabase.schema("contributi_mic").from("assegnazioni").select("contributo_assegnato, anno, organismo_id"),
        supabase.schema("contributi_mic").from("organismi").select("id, comune_id"),
        supabase.schema("contributi_mic").from("decreti").select("*, ambito:ambito_id(nome)").order("anno_finanziario", { ascending: false }).order("data", { ascending: false }),
      ]);
      const mic25 = (ass||[]).filter(a=>a.anno===2025).reduce((s,a)=>s+(a.contributo_assegnato||0),0);
      const mic26 = (ass||[]).filter(a=>a.anno===2026).reduce((s,a)=>s+(a.contributo_assegnato||0),0);
      const conSede = (org||[]).filter(o => o.comune_id).length;
      setStats({ org: org?.length||0, conSede, dec: dec?.length||0, mic25, mic26, ass: ass?.length||0, decreti: dec||[] });
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
function PugliaBasilicata() {
  const { organismi, loading } = useOrganismi({ regioni: ["Puglia", "Basilicata"] });
  const [selected, setSelected] = useState(null);

  const totPU = organismi.filter(o => o.regione === "Puglia").reduce((s, o) => s + o.assegnazioni.filter(a => a.tipo_decreto === "MIC_FNSV").reduce((ss, a) => ss + (a.contributo_assegnato || 0), 0), 0);
  const totBA = organismi.filter(o => o.regione === "Basilicata").reduce((s, o) => s + o.assegnazioni.filter(a => a.tipo_decreto === "MIC_FNSV").reduce((ss, a) => ss + (a.contributo_assegnato || 0), 0), 0);
  const totRegPU = organismi.filter(o => o.fonti.includes("REG_PU")).reduce((s, o) => s + o.assegnazioni.filter(a => a.tipo_decreto === "REG_PU" && a.anno === 2025).reduce((ss, a) => ss + (a.contributo_assegnato || 0), 0), 0);

  if (loading) return <div style={{ padding: 48, color: T.muted }}>Caricamento…</div>;

  return (
    <div>
      {selected && <SchedaOrganismo org={selected} onClose={() => setSelected(null)} />}

      <div style={{ background: "linear-gradient(135deg,#7C2D12,#C2410C,#EA580C)", padding: "24px 36px", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", right: -40, top: -40, width: 200, height: 200, borderRadius: "50%", background: "rgba(255,255,255,0.06)" }} />
        <div style={{ position: "relative" }}>
          <div style={{ fontSize: 9, color: "rgba(255,255,255,0.6)", letterSpacing: 3, textTransform: "uppercase", marginBottom: 6, fontWeight: 600 }}>AGIS · Focus Regionale</div>
          <h1 style={{ fontSize: 26, fontWeight: 900, color: "#FFFFFF", margin: "0 0 6px", ...serif }}>Puglia <span style={{ color: "#FED7AA" }}>&</span> Basilicata</h1>
          <p style={{ fontSize: 12, color: "rgba(255,255,255,0.55)", margin: 0 }}>Contributi MIC/FNSV e Regione Puglia · {organismi.length} organismi</p>
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

// ── DECRETI ───────────────────────────────────────────────────
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
    // Aggrega per organismo
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

// ── APP ───────────────────────────────────────────────────────
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

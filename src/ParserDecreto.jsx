import { useState, useCallback } from "react";

const PROMPT_SISTEMA = `Sei un parser specializzato per i decreti MIC/FNSV italiani (Fondo Nazionale Spettacolo dal Vivo).
Estrai TUTTI i dati dalle tabelle del decreto e restituisci SOLO un oggetto JSON valido, senza testo aggiuntivo, senza backtick, senza markdown.

Struttura JSON da restituire:
{
  "decreto": {
    "numero_rep": "string",
    "data": "YYYY-MM-DD",
    "anno_finanziario": number,
    "ente_erogante": "string",
    "ambito": "string",
    "fondo": "string",
    "stanziamento_totale": number,
    "url_pdf": null
  },
  "sezioni": [
    {
      "articolo_dm": "string",
      "descrizione_settore": "string",
      "prima_istanza_triennale": boolean,
      "stanziamento_totale_art": number,
      "sottoinsiemi": [
        {
          "numero_sottoinsieme": number,
          "risorse_assegnate": number,
          "organismi": [
            {
              "posizione": number,
              "denominazione": "string",
              "comune": "string",
              "sigla_provincia": "string",
              "punteggio_vd": number,
              "punteggio_qa": number,
              "punteggio_qi": number,
              "punteggio_da": number,
              "punteggio_tot": number,
              "contributo_2026": number
            }
          ]
        }
      ]
    }
  ]
}

Regole di estrazione:
- numero_rep: solo il numero (es. "770")
- data: converti "11 giugno 2026" → "2026-06-11"
- stanziamento_totale: cerca "Fondo nazionale per lo spettacolo dal vivo" totale, es. 448178710
- per ogni tabella identifica: articolo DM, descrizione settore, se è "Prime istanze triennali"
- stanziamento_totale_art: la riga "Stanziamento totale art. €"
- risorse_assegnate: la riga "Primo/Secondo/Terzo sottoinsieme - Risorse assegnate €"
- se un settore ha un solo sottoinsieme senza numerazione esplicita, usa numero_sottoinsieme: 1
- comune e sigla_provincia: da "Torino (TO)" estrai comune="Torino" e sigla_provincia="TO"
- tutti gli importi come numeri puri senza simboli (es. 554419.00)
- tutti i punteggi come numeri decimali (es. 35.00)
- includi TUTTI gli organismi di TUTTE le tabelle, nessuno escluso`;

const fmt = (n) =>
  n != null
    ? new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n)
    : "—";

const badge = (color, bg) => ({
  display: "inline-block", padding: "2px 10px", borderRadius: 12,
  fontSize: 11, fontWeight: 700, color, background: bg,
});

export default function ParserDecreto() {
  const [testo, setTesto]         = useState("");
  const [nomeFile, setNomeFile]   = useState("");
  const [stato, setStato]         = useState("idle");
  const [risultato, setRisultato] = useState(null);
  const [errore, setErrore]       = useState("");
  const [tab, setTab]             = useState("anteprima");
  const [progress, setProgress]   = useState("");

  const onFile = useCallback((e) => {
    const file = e.target.files[0];
    if (!file) return;
    setNomeFile(file.name);
    setStato("idle");
    setRisultato(null);
    const reader = new FileReader();
    reader.onload = (ev) => setTesto(ev.target.result);
    reader.readAsText(file, "utf-8");
  }, []);

  const estrai = async () => {
    if (!testo.trim()) return;
    setStato("caricamento");
    setErrore("");
    setProgress("Preparazione testo decreto...");

    try {
      // Taglia il preambolo legale e invia solo la parte con le tabelle
      const inizioTabelle = testo.indexOf("D E C R E T A");
      const testoTabelle = inizioTabelle > 0 ? testo.slice(inizioTabelle) : testo;
      const testoTroncato = testoTabelle.length > 80000 ? testoTabelle.slice(0, 80000) : testoTabelle;

      setProgress("Invio a Claude (20-40 secondi)...");

      const response = await fetch("/.netlify/functions/claude-proxy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 8000,
          system: PROMPT_SISTEMA,
          messages: [
            {
              role: "user",
              content: `Estrai tutti i dati da questo decreto MIC/FNSV:\n\n${testoTroncato}`,
            },
          ],
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err?.error?.message || `HTTP ${response.status}`);
      }

      const data = await response.json();
      const testo_risposta = data.content?.find((b) => b.type === "text")?.text || "";

      setProgress("Parsing JSON...");

      let json_pulito = testo_risposta.trim();
      json_pulito = json_pulito.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();

      const parsed = JSON.parse(json_pulito);
      setRisultato(parsed);
      setStato("estratto");
      setProgress("");
    } catch (err) {
      setErrore(err.message || "Errore sconosciuto");
      setStato("errore");
      setProgress("");
    }
  };

  const scaricaJSON = () => {
    if (!risultato) return;
    const blob = new Blob([JSON.stringify(risultato, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `decreto_${risultato.decreto?.numero_rep || "export"}_${risultato.decreto?.anno_finanziario || ""}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const totali = risultato
    ? (() => {
        let org = 0, importo = 0;
        risultato.sezioni?.forEach((s) =>
          s.sottoinsiemi?.forEach((si) => {
            org += si.organismi?.length || 0;
            si.organismi?.forEach((o) => (importo += o.contributo_2026 || 0));
          })
        );
        return { org, importo, sezioni: risultato.sezioni?.length || 0 };
      })()
    : null;

  return (
    <div style={{ fontFamily: "'Segoe UI', system-ui, sans-serif", background: "#F7F4EE", minHeight: "100vh", padding: 24 }}>
      <div style={{ background: "#1A3A5C", color: "#fff", borderRadius: 8, padding: "16px 24px", marginBottom: 20, display: "flex", alignItems: "center", gap: 16 }}>
        <div style={{ borderLeft: "4px solid #B8860B", paddingLeft: 16 }}>
          <div style={{ fontSize: 11, color: "#B8860B", fontFamily: "monospace", letterSpacing: 2, textTransform: "uppercase" }}>MIC / FNSV</div>
          <div style={{ fontSize: 18, fontWeight: 800 }}>Parser Decreti</div>
          <div style={{ fontSize: 12, color: "#9BB5D4", marginTop: 2 }}>Estrazione automatica → JSON → Supabase</div>
        </div>
      </div>

      <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 8, padding: 24, marginBottom: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#1C1C1C", marginBottom: 12 }}>1. Carica il file del decreto</div>
        <label style={{
          display: "flex", alignItems: "center", gap: 12, cursor: "pointer",
          border: "2px dashed #CBD5E1", borderRadius: 8, padding: "20px 24px",
          background: nomeFile ? "#E8F0F8" : "#FAFAFA", transition: "all 0.2s",
        }}>
          <span style={{ fontSize: 28 }}>📄</span>
          <div>
            <div style={{ fontWeight: 600, color: "#1A3A5C" }}>
              {nomeFile || "Clicca per scegliere un file .txt o .md"}
            </div>
            <div style={{ fontSize: 12, color: "#6B7280", marginTop: 2 }}>
              {testo ? `${(testo.length / 1000).toFixed(0)} KB caricati` : "Testo copiato dal PDF del decreto"}
            </div>
          </div>
          <input type="file" accept=".txt,.md,.text" onChange={onFile} style={{ display: "none" }} />
        </label>

        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 12, color: "#6B7280", marginBottom: 6 }}>
            Oppure incolla direttamente il testo del decreto:
          </div>
          <textarea
            value={testo}
            onChange={(e) => { setTesto(e.target.value); setNomeFile("(testo incollato)"); }}
            placeholder="Incolla qui il testo copiato dal PDF..."
            style={{
              width: "100%", height: 120, padding: 10, borderRadius: 6,
              border: "1px solid #E5E7EB", fontSize: 12, fontFamily: "monospace",
              resize: "vertical", boxSizing: "border-box", color: "#1C1C1C",
            }}
          />
        </div>

        <button
          onClick={estrai}
          disabled={!testo.trim() || stato === "caricamento"}
          style={{
            marginTop: 16, padding: "10px 28px", borderRadius: 6, border: "none",
            background: !testo.trim() || stato === "caricamento" ? "#CBD5E1" : "#1A3A5C",
            color: "#fff", fontWeight: 700, fontSize: 14, cursor: !testo.trim() || stato === "caricamento" ? "not-allowed" : "pointer",
          }}
        >
          {stato === "caricamento" ? "⏳ Estrazione in corso..." : "🔍 Estrai dati con Claude"}
        </button>

        {progress && (
          <div style={{ marginTop: 10, fontSize: 12, color: "#2A5A8C", fontStyle: "italic" }}>{progress}</div>
        )}
        {stato === "errore" && (
          <div style={{ marginTop: 10, padding: "10px 14px", background: "#FEE2E2", borderRadius: 6, fontSize: 12, color: "#991B1B", fontWeight: 600 }}>
            ❌ Errore: {errore}
          </div>
        )}
      </div>

      {risultato && (
        <>
          <div style={{ background: "#1A3A5C", color: "#fff", borderRadius: 8, padding: "16px 24px", marginBottom: 16, borderLeft: "4px solid #B8860B" }}>
            <div style={{ fontFamily: "monospace", fontSize: 11, color: "#B8860B", letterSpacing: 1 }}>
              D.D.G. REP. N. {risultato.decreto?.numero_rep} · {risultato.decreto?.data}
            </div>
            <div style={{ fontSize: 16, fontWeight: 800, marginTop: 4 }}>{risultato.decreto?.ambito}</div>
            <div style={{ display: "flex", gap: 24, marginTop: 10, flexWrap: "wrap" }}>
              <div><span style={{ color: "#9BB5D4", fontSize: 11 }}>Anno</span><br /><strong>{risultato.decreto?.anno_finanziario}</strong></div>
              <div><span style={{ color: "#9BB5D4", fontSize: 11 }}>Stanziamento totale</span><br /><strong style={{ color: "#B8860B" }}>{fmt(risultato.decreto?.stanziamento_totale)}</strong></div>
              <div><span style={{ color: "#9BB5D4", fontSize: 11 }}>Sezioni estratte</span><br /><strong>{totali?.sezioni}</strong></div>
              <div><span style={{ color: "#9BB5D4", fontSize: 11 }}>Organismi totali</span><br /><strong style={{ color: "#4ADE80" }}>{totali?.org}</strong></div>
              <div><span style={{ color: "#9BB5D4", fontSize: 11 }}>Importo verificato</span><br /><strong style={{ color: "#4ADE80" }}>{fmt(totali?.importo)}</strong></div>
            </div>
          </div>

          <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 8, overflow: "hidden", marginBottom: 20 }}>
            <div style={{ display: "flex", borderBottom: "1px solid #E5E7EB" }}>
              {["anteprima", "json"].map((t) => (
                <button key={t} onClick={() => setTab(t)} style={{
                  padding: "12px 24px", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600,
                  background: tab === t ? "#fff" : "#F9FAFB",
                  color: tab === t ? "#1A3A5C" : "#6B7280",
                  borderBottom: tab === t ? "2px solid #1A3A5C" : "2px solid transparent",
                }}>
                  {t === "anteprima" ? "📋 Anteprima tabelle" : "{ } JSON grezzo"}
                </button>
              ))}
              <button onClick={scaricaJSON} style={{
                marginLeft: "auto", margin: "8px 16px 8px auto", padding: "6px 16px",
                background: "#B8860B", color: "#fff", border: "none", borderRadius: 5,
                fontSize: 12, fontWeight: 700, cursor: "pointer",
              }}>
                ↓ Scarica JSON
              </button>
            </div>

            {tab === "anteprima" ? (
              <div style={{ padding: 20, maxHeight: 600, overflowY: "auto" }}>
                {risultato.sezioni?.map((sez, si) => (
                  <div key={si} style={{ marginBottom: 28 }}>
                    <div style={{ background: "#E8F0F8", borderLeft: "3px solid #1A3A5C", padding: "8px 14px", borderRadius: "0 6px 6px 0", marginBottom: 12 }}>
                      <div style={{ fontWeight: 700, color: "#1A3A5C", fontSize: 13 }}>
                        {sez.articolo_dm} — {sez.descrizione_settore}
                        {sez.prima_istanza_triennale && (
                          <span style={{ ...badge("#166534", "#DCFCE7"), marginLeft: 8 }}>Prime istanze triennali</span>
                        )}
                      </div>
                      <div style={{ fontSize: 11, color: "#6B7280", marginTop: 2 }}>
                        Stanziamento totale art.: <strong>{fmt(sez.stanziamento_totale_art)}</strong>
                      </div>
                    </div>

                    {sez.sottoinsiemi?.map((sub, subi) => (
                      <div key={subi} style={{ marginBottom: 16 }}>
                        {sez.sottoinsiemi.length > 1 && (
                          <div style={{ fontSize: 11, fontWeight: 700, color: "#6B7280", marginBottom: 6, fontFamily: "monospace", textTransform: "uppercase", letterSpacing: 1 }}>
                            {["Primo", "Secondo", "Terzo"][sub.numero_sottoinsieme - 1] || sub.numero_sottoinsieme + "°"} sottoinsieme — {fmt(sub.risorse_assegnate)}
                          </div>
                        )}
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                          <thead>
                            <tr style={{ background: "#F7F4EE" }}>
                              {["#", "Organismo", "Comune (Prov.)", "VD", "QA", "QI", "DA", "TOT", "Contributo"].map(h => (
                                <th key={h} style={{ padding: "6px 8px", textAlign: h === "#" || ["VD","QA","QI","DA","TOT"].includes(h) ? "center" : "left", fontWeight: 700, color: "#6B7280", fontSize: 10, textTransform: "uppercase", borderBottom: "1px solid #E5E7EB", whiteSpace: "nowrap" }}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {sub.organismi?.map((o, oi) => (
                              <tr key={oi} style={{ borderBottom: "1px solid #F3F4F6", background: oi % 2 === 0 ? "#fff" : "#FAFAFA" }}>
                                <td style={{ padding: "6px 8px", textAlign: "center", color: "#9CA3AF", fontFamily: "monospace" }}>{o.posizione}</td>
                                <td style={{ padding: "6px 8px", fontWeight: 600, color: "#1C1C1C", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{o.denominazione}</td>
                                <td style={{ padding: "6px 8px", color: "#6B7280", whiteSpace: "nowrap" }}>{o.comune} <span style={{ fontFamily: "monospace", fontWeight: 700 }}>({o.sigla_provincia})</span></td>
                                {[o.punteggio_vd, o.punteggio_qa, o.punteggio_qi, o.punteggio_da].map((v, vi) => (
                                  <td key={vi} style={{ padding: "6px 8px", textAlign: "center", fontFamily: "monospace", color: "#374151" }}>{v?.toFixed(2)}</td>
                                ))}
                                <td style={{ padding: "6px 8px", textAlign: "center", fontFamily: "monospace", fontWeight: 800, color: "#1A3A5C", fontSize: 12 }}>{o.punteggio_tot?.toFixed(2)}</td>
                                <td style={{ padding: "6px 8px", fontFamily: "monospace", fontWeight: 700, color: "#166534", whiteSpace: "nowrap" }}>{fmt(o.contributo_2026)}</td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr style={{ background: "#F0F9F4" }}>
                              <td colSpan={8} style={{ padding: "6px 8px", fontSize: 11, fontWeight: 700, color: "#166534" }}>Totale sottoinsieme</td>
                              <td style={{ padding: "6px 8px", fontFamily: "monospace", fontWeight: 800, color: "#166534" }}>
                                {fmt(sub.organismi?.reduce((s, o) => s + (o.contributo_2026 || 0), 0))}
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            ) : (
              <pre style={{ padding: 20, fontSize: 11, fontFamily: "monospace", color: "#1C1C1C", background: "#F9FAFB", maxHeight: 600, overflowY: "auto", margin: 0 }}>
                {JSON.stringify(risultato, null, 2)}
              </pre>
            )}
          </div>

          <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 8, padding: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#1C1C1C", marginBottom: 10 }}>Prossimo passo: INSERT in Supabase</div>
            <div style={{ fontSize: 12, color: "#6B7280", lineHeight: 1.7 }}>
              Il JSON scaricato contiene tutti i dati strutturati pronti per l'inserimento.<br />
              Lo script di import leggerà questo file e farà INSERT nelle tabelle:
              <code style={{ background: "#F3F4F6", padding: "1px 6px", borderRadius: 3, margin: "0 3px", fontFamily: "monospace" }}>decreti</code>
              <code style={{ background: "#F3F4F6", padding: "1px 6px", borderRadius: 3, margin: "0 3px", fontFamily: "monospace" }}>organismi</code>
              <code style={{ background: "#F3F4F6", padding: "1px 6px", borderRadius: 3, margin: "0 3px", fontFamily: "monospace" }}>assegnazioni</code>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

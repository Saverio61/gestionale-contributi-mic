import { useState, useCallback } from "react";

const SUPABASE_URL = "https://rgbqpybaeojhrbqgxtui.supabase.co/functions/v1/swift-function";

const PROMPT_CHUNK = `Sei un parser per decreti MIC/FNSV italiani.
Estrai i dati dalle tabelle e restituisci SOLO JSON valido minificato senza spazi extra.

Per ogni tabella che trovi restituisci:
{"articolo_dm":"string","descrizione_settore":"string","prima_istanza_triennale":boolean,"stanziamento_totale_art":number,"risorse_assegnate":number,"numero_sottoinsieme":number,"organismi":[{"posizione":number,"denominazione":"string","comune":"string","sigla_provincia":"string","punteggio_vd":number,"punteggio_qa":number,"punteggio_qi":number,"punteggio_da":number,"punteggio_tot":number,"contributo_2026":number}]}

Regole:
- articolo_dm: es "Art. 42"
- prima_istanza_triennale: true se la tabella contiene "Prime istanze triennali"
- stanziamento_totale_art: riga "Stanziamento totale art."
- risorse_assegnate: riga "Risorse assegnate"
- numero_sottoinsieme: 1 se primo, 2 se secondo, ecc.
- da "Torino (TO)" estrai comune:"Torino" sigla_provincia:"TO"
- importi come numeri es 554419.00
- punteggi come decimali es 35.00
Se ci sono piu tabelle nel testo restituisci un array JSON: [...]`;

const PROMPT_DECRETO = `Estrai solo i metadati del decreto (non le tabelle) e restituisci SOLO JSON:
{"numero_rep":"string","data":"YYYY-MM-DD","anno_finanziario":number,"ambito":"string","stanziamento_totale":number}
- numero_rep: solo il numero es "573"
- data: es "2026-06-11"
- ambito: es "Multidisciplinare"
- stanziamento_totale: totale FNSV in euro`;

const fmt = (n) =>
  n != null
    ? new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n)
    : "--";

async function chiamaClaude(prompt, testo) {
  const response = await fetch(SUPABASE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 4000,
      messages: [
        { role: "user", content: prompt + "\n\n" + testo }
      ],
    }),
  });
  if (!response.ok) throw new Error("HTTP " + response.status);
  const data = await response.json();
  let txt = data.content?.find((b) => b.type === "text")?.text || "";
  txt = txt.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();
  if (txt.startsWith("{") && txt.includes("}
{")) {
    txt = "[" + txt.replace(/\}\s*
\s*\{/g, "},{") + "]";
  }
  return JSON.parse(txt);
}

function dividiInChunk(testo) {
  // Trova tutti gli articoli nel testo
  const pattern = /(Art\.\s*\d+[^\n]*\n)/g;
  const posizioni = [];
  let match;
  while ((match = pattern.exec(testo)) !== null) {
    posizioni.push(match.index);
  }
  
  if (posizioni.length === 0) return [testo];
  
  const chunks = [];
  for (let i = 0; i < posizioni.length; i++) {
    const inizio = posizioni[i];
    const fine = i + 1 < posizioni.length ? posizioni[i + 1] : testo.length;
    const chunk = testo.slice(inizio, fine);
    if (chunk.trim().length > 50) chunks.push(chunk);
  }
  return chunks;
}

export default function ParserDecreto() {
  const [testo, setTesto] = useState("");
  const [nomeFile, setNomeFile] = useState("");
  const [stato, setStato] = useState("idle");
  const [risultato, setRisultato] = useState(null);
  const [errore, setErrore] = useState("");
  const [tab, setTab] = useState("anteprima");
  const [progress, setProgress] = useState("");

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

    try {
      // Trova inizio tabelle
      const inizioDecreta = testo.indexOf("D E C R E T A");
      const testoTabelle = inizioDecreta > 0 ? testo.slice(inizioDecreta) : testo;
      
      // 1. Estrai metadati decreto
      setProgress("Estrazione metadati decreto (1/2)...");
      const decretoMeta = await chiamaClaude(PROMPT_DECRETO, testo.slice(0, 3000));
      
      // 2. Dividi in chunk per articolo
      const chunks = dividiInChunk(testoTabelle);
      setProgress(`Elaborazione ${chunks.length} sezioni...`);
      
      const sezioni = [];
      for (let i = 0; i < chunks.length; i++) {
        setProgress(`Elaborazione sezione ${i + 1} di ${chunks.length}...`);
        try {
          const risultatoChunk = await chiamaClaude(PROMPT_CHUNK, chunks[i]);
          const lista = Array.isArray(risultatoChunk) ? risultatoChunk : [risultatoChunk];
          for (const s of lista) {
            if (s.organismi && s.organismi.length > 0) {
              sezioni.push({
                articolo_dm: s.articolo_dm,
                descrizione_settore: s.descrizione_settore,
                prima_istanza_triennale: s.prima_istanza_triennale || false,
                stanziamento_totale_art: s.stanziamento_totale_art,
                sottoinsiemi: [{
                  numero_sottoinsieme: s.numero_sottoinsieme || 1,
                  risorse_assegnate: s.risorse_assegnate,
                  organismi: s.organismi,
                }],
              });
            }
          }
        } catch (e) {
          console.warn("Chunk " + i + " saltato:", e.message);
        }
      }

      const parsed = { decreto: decretoMeta, sezioni };
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
    a.download = "decreto_" + (risultato.decreto?.numero_rep || "export") + ".json";
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
      <div style={{ background: "#1A3A5C", color: "#fff", borderRadius: 8, padding: "16px 24px", marginBottom: 20 }}>
        <div style={{ borderLeft: "4px solid #B8860B", paddingLeft: 16 }}>
          <div style={{ fontSize: 11, color: "#B8860B", fontFamily: "monospace", letterSpacing: 2, textTransform: "uppercase" }}>MIC / FNSV</div>
          <div style={{ fontSize: 18, fontWeight: 800 }}>Parser Decreti</div>
          <div style={{ fontSize: 12, color: "#9BB5D4", marginTop: 2 }}>Estrazione automatica a chunk via Supabase</div>
        </div>
      </div>

      <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 8, padding: 24, marginBottom: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#1C1C1C", marginBottom: 12 }}>1. Carica il file del decreto</div>
        <label style={{
          display: "flex", alignItems: "center", gap: 12, cursor: "pointer",
          border: "2px dashed #CBD5E1", borderRadius: 8, padding: "20px 24px",
          background: nomeFile ? "#E8F0F8" : "#FAFAFA",
        }}>
          <span style={{ fontSize: 28 }}>📄</span>
          <div>
            <div style={{ fontWeight: 600, color: "#1A3A5C" }}>
              {nomeFile || "Clicca per scegliere un file .txt o .md"}
            </div>
            <div style={{ fontSize: 12, color: "#6B7280", marginTop: 2 }}>
              {testo ? (testo.length / 1000).toFixed(0) + " KB caricati" : "Testo copiato dal PDF del decreto"}
            </div>
          </div>
          <input type="file" accept=".txt,.md,.text" onChange={onFile} style={{ display: "none" }} />
        </label>

        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 12, color: "#6B7280", marginBottom: 6 }}>Oppure incolla direttamente il testo:</div>
          <textarea
            value={testo}
            onChange={(e) => { setTesto(e.target.value); setNomeFile("(testo incollato)"); }}
            placeholder="Incolla qui il testo copiato dal PDF..."
            style={{ width: "100%", height: 120, padding: 10, borderRadius: 6, border: "1px solid #E5E7EB", fontSize: 12, fontFamily: "monospace", resize: "vertical", boxSizing: "border-box", color: "#1C1C1C" }}
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
          {stato === "caricamento" ? "Estrazione in corso..." : "Estrai dati con Claude"}
        </button>

        {progress && <div style={{ marginTop: 10, fontSize: 12, color: "#2A5A8C", fontStyle: "italic" }}>{progress}</div>}
        {stato === "errore" && (
          <div style={{ marginTop: 10, padding: "10px 14px", background: "#FEE2E2", borderRadius: 6, fontSize: 12, color: "#991B1B", fontWeight: 600 }}>
            Errore: {errore}
          </div>
        )}
      </div>

      {risultato && (
        <>
          <div style={{ background: "#1A3A5C", color: "#fff", borderRadius: 8, padding: "16px 24px", marginBottom: 16, borderLeft: "4px solid #B8860B" }}>
            <div style={{ fontFamily: "monospace", fontSize: 11, color: "#B8860B" }}>
              D.D.G. REP. N. {risultato.decreto?.numero_rep} - {risultato.decreto?.data}
            </div>
            <div style={{ fontSize: 16, fontWeight: 800, marginTop: 4 }}>{risultato.decreto?.ambito}</div>
            <div style={{ display: "flex", gap: 24, marginTop: 10, flexWrap: "wrap" }}>
              <div><span style={{ color: "#9BB5D4", fontSize: 11 }}>Anno</span><br /><strong>{risultato.decreto?.anno_finanziario}</strong></div>
              <div><span style={{ color: "#9BB5D4", fontSize: 11 }}>Stanziamento</span><br /><strong style={{ color: "#B8860B" }}>{fmt(risultato.decreto?.stanziamento_totale)}</strong></div>
              <div><span style={{ color: "#9BB5D4", fontSize: 11 }}>Sezioni</span><br /><strong>{totali?.sezioni}</strong></div>
              <div><span style={{ color: "#9BB5D4", fontSize: 11 }}>Organismi</span><br /><strong style={{ color: "#4ADE80" }}>{totali?.org}</strong></div>
              <div><span style={{ color: "#9BB5D4", fontSize: 11 }}>Importo</span><br /><strong style={{ color: "#4ADE80" }}>{fmt(totali?.importo)}</strong></div>
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
                  {t === "anteprima" ? "Anteprima tabelle" : "JSON grezzo"}
                </button>
              ))}
              <button onClick={scaricaJSON} style={{
                marginLeft: "auto", margin: "8px 16px", padding: "6px 16px",
                background: "#B8860B", color: "#fff", border: "none", borderRadius: 5,
                fontSize: 12, fontWeight: 700, cursor: "pointer",
              }}>
                Scarica JSON
              </button>
            </div>

            {tab === "anteprima" ? (
              <div style={{ padding: 20, maxHeight: 600, overflowY: "auto" }}>
                {risultato.sezioni?.map((sez, si) => (
                  <div key={si} style={{ marginBottom: 28 }}>
                    <div style={{ background: "#E8F0F8", borderLeft: "3px solid #1A3A5C", padding: "8px 14px", borderRadius: "0 6px 6px 0", marginBottom: 12 }}>
                      <div style={{ fontWeight: 700, color: "#1A3A5C", fontSize: 13 }}>
                        {sez.articolo_dm} - {sez.descrizione_settore}
                        {sez.prima_istanza_triennale && (
                          <span style={{ marginLeft: 8, background: "#DCFCE7", color: "#166534", padding: "2px 8px", borderRadius: 10, fontSize: 10, fontWeight: 700 }}>Prime istanze</span>
                        )}
                      </div>
                      <div style={{ fontSize: 11, color: "#6B7280", marginTop: 2 }}>
                        Stanziamento: <strong>{fmt(sez.stanziamento_totale_art)}</strong>
                      </div>
                    </div>
                    {sez.sottoinsiemi?.map((sub, subi) => (
                      <div key={subi} style={{ marginBottom: 16 }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                          <thead>
                            <tr style={{ background: "#F7F4EE" }}>
                              {["#", "Organismo", "Comune", "VD", "QA", "QI", "DA", "TOT", "Contributo"].map(h => (
                                <th key={h} style={{ padding: "6px 8px", textAlign: "left", fontWeight: 700, color: "#6B7280", fontSize: 10, textTransform: "uppercase", borderBottom: "1px solid #E5E7EB" }}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {sub.organismi?.map((o, oi) => (
                              <tr key={oi} style={{ borderBottom: "1px solid #F3F4F6", background: oi % 2 === 0 ? "#fff" : "#FAFAFA" }}>
                                <td style={{ padding: "6px 8px", color: "#9CA3AF" }}>{o.posizione}</td>
                                <td style={{ padding: "6px 8px", fontWeight: 600, color: "#1C1C1C", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{o.denominazione}</td>
                                <td style={{ padding: "6px 8px", color: "#6B7280", whiteSpace: "nowrap" }}>{o.comune} ({o.sigla_provincia})</td>
                                {[o.punteggio_vd, o.punteggio_qa, o.punteggio_qi, o.punteggio_da].map((v, vi) => (
                                  <td key={vi} style={{ padding: "6px 8px", fontFamily: "monospace", color: "#374151" }}>{v?.toFixed(2)}</td>
                                ))}
                                <td style={{ padding: "6px 8px", fontFamily: "monospace", fontWeight: 800, color: "#1A3A5C" }}>{o.punteggio_tot?.toFixed(2)}</td>
                                <td style={{ padding: "6px 8px", fontFamily: "monospace", fontWeight: 700, color: "#166534", whiteSpace: "nowrap" }}>{fmt(o.contributo_2026)}</td>
                              </tr>
                            ))}
                          </tbody>
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
        </>
      )}
    </div>
  );
}

import { useState, useCallback } from "react";
import { supabase } from "./supabaseClient";

const SUPABASE_CLAUDE_URL = "https://rgbqpybaeojhrbqgxtui.supabase.co/functions/v1/swift-function";

const PROMPT_CHUNK = `Sei un parser per decreti MIC/FNSV italiani.
Estrai i dati dalle tabelle e restituisci SOLO un array JSON valido minificato.
Anche se c'e' una sola tabella restituisci sempre un array: [...]

Per ogni tabella restituisci un oggetto:
{"articolo_dm":"string","descrizione_settore":"string","prima_istanza_triennale":boolean,"stanziamento_totale_art":number,"risorse_assegnate":number,"numero_sottoinsieme":number,"organismi":[{"posizione":number,"denominazione":"string","comune":"string","sigla_provincia":"string","punteggio_vd":number,"punteggio_qa":number,"punteggio_qi":number,"punteggio_da":number,"punteggio_tot":number,"contributo_anno":number}]}

Regole:
- prima_istanza_triennale: true se contiene "Prime istanze triennali"
- stanziamento_totale_art: riga "Stanziamento totale art."
- risorse_assegnate: riga "Risorse assegnate"
- numero_sottoinsieme: 1 primo, 2 secondo, ecc.
- da "Torino (TO)" estrai comune:"Torino" sigla_provincia:"TO"
- importi come numeri es 554419.00
- punteggi come decimali es 35.00
IMPORTANTE: restituisci SEMPRE e SOLO un array JSON, mai oggetti singoli`;

const PROMPT_DECRETO = `Estrai solo i metadati del decreto e restituisci SOLO questo JSON:
{"numero_rep":"string","data":"YYYY-MM-DD","anno_finanziario":number,"ambito":"string","stanziamento_totale":number}
Ambito deve essere uno di: MUSICA, DANZA, TEATRO, CIRCO, MULTIDISCIPLINARE, PROMOZIONE`;

const fmt = (n) => n != null ? new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n) : "--";

async function chiamaClaude(prompt, testo) {
  const response = await fetch(SUPABASE_CLAUDE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 4000,
      messages: [{ role: "user", content: prompt + "\n\n" + testo }],
    }),
  });
  if (!response.ok) throw new Error("HTTP " + response.status);
  const data = await response.json();
  let txt = data.content?.find((b) => b.type === "text")?.text || "";
  txt = txt.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();
try {
  return JSON.parse(txt);
} catch(e) {
  // Prova a unire oggetti JSON multipli in un array
  const fixed = "[" + txt.replace(/\}\s*\{/g, "},{") + "]";
  return JSON.parse(fixed);
}}

function dividiInChunk(testo) {
  const lines = testo.split("\n");
  const chunks = [];
  let chunk = [];
  for (const line of lines) {
    if (line.match(/^Art\.\s*\d+/) && chunk.length > 5) {
      chunks.push(chunk.join("\n"));
      chunk = [];
    }
    chunk.push(line);
  }
  if (chunk.length > 0) chunks.push(chunk.join("\n"));
  return chunks.filter(c => c.trim().length > 50);
}

// ── FUNZIONE IMPORT IN SUPABASE ──────────────────────────────
async function importaInSupabase(risultato, setImportProgress, setImportStato) {
  const { decreto, sezioni } = risultato;
  let importati = 0, errori = 0;

  try {
    setImportProgress("Verifica ambito...");

    // 1. Trova ambito_id
    const { data: ambitoData, error: ambitoErr } = await supabase
      .schema("contributi_mic").from("ambiti")
      .select("id").ilike("codice", decreto.ambito).limit(1);

    if (ambitoErr || !ambitoData?.length) {
      // Prova con il nome
      const { data: ambitoData2 } = await supabase
        .schema("contributi_mic").from("ambiti")
        .select("id").ilike("nome", `%${decreto.ambito}%`).limit(1);
      if (!ambitoData2?.length) throw new Error(`Ambito "${decreto.ambito}" non trovato`);
    }

    const ambito_id = (ambitoData?.[0] || (await supabase.schema("contributi_mic").from("ambiti").select("id").ilike("nome", `%${decreto.ambito}%`).limit(1)).data?.[0])?.id;
    if (!ambito_id) throw new Error(`Ambito "${decreto.ambito}" non trovato in database`);

    // 2. Insert decreto (ON CONFLICT DO NOTHING)
    setImportProgress("Inserimento decreto...");
    const { data: decretoData } = await supabase.schema("contributi_mic").from("decreti").upsert({
      numero_rep: decreto.numero_rep,
      data: decreto.data,
      anno_finanziario: decreto.anno_finanziario,
      tipo: "MIC_FNSV",
      fondo: "Fondo Nazionale per lo Spettacolo dal Vivo",
      ente_erogante: "MIC - DG Spettacolo",
      ambito_id,
      descrizione: `Contributi ${decreto.ambito} ${decreto.anno_finanziario}`,
      stanziamento_totale: decreto.stanziamento_totale,
    }, { onConflict: "numero_rep,anno_finanziario,tipo", ignoreDuplicates: false }).select("id").single();

    const decreto_id = decretoData?.id;
    if (!decreto_id) {
      // Prendi ID esistente
      const { data: existing } = await supabase.schema("contributi_mic").from("decreti")
        .select("id").eq("numero_rep", decreto.numero_rep).eq("anno_finanziario", decreto.anno_finanziario).single();
      if (!existing) throw new Error("Impossibile creare o trovare il decreto");
    }

    const { data: dec } = await supabase.schema("contributi_mic").from("decreti")
      .select("id").eq("numero_rep", decreto.numero_rep).eq("anno_finanziario", decreto.anno_finanziario).single();
    const dec_id = dec?.id;

    // 3. Per ogni sezione
    for (let si = 0; si < sezioni.length; si++) {
      const sez = sezioni[si];
      setImportProgress(`Sezione ${si + 1}/${sezioni.length}: ${sez.articolo_dm}...`);

      // Trova o crea settore
      const codiceSettore = `${decreto.ambito}_${sez.articolo_dm.replace(/[^A-Z0-9]/gi, '_').toUpperCase().slice(0, 20)}`;

      await supabase.schema("contributi_mic").from("settori").upsert({
        ambito_id,
        codice: codiceSettore,
        articolo_dm: sez.articolo_dm.slice(0, 50),
        descrizione: sez.descrizione_settore?.slice(0, 200) || sez.articolo_dm,
      }, { onConflict: "codice", ignoreDuplicates: false });

      const { data: settoreData } = await supabase.schema("contributi_mic").from("settori")
        .select("id").eq("codice", codiceSettore).single();
      const settore_id = settoreData?.id;
      if (!settore_id) continue;

      // Per ogni sottoinsieme
      for (const sub of sez.sottoinsiemi || []) {
        for (const org of sub.organismi || []) {
          try {
            // Trova comune
            let comune_id = null;
            if (org.comune && org.sigla_provincia) {
              const { data: comuneData } = await supabase.schema("contributi_mic").from("comuni")
                .select("id, provincia:provincia_id(codice)")
                .ilike("nome", org.comune).limit(5);

              if (comuneData?.length) {
                const match = comuneData.find(c => c.provincia?.codice === org.sigla_provincia);
                comune_id = match?.id || comuneData[0]?.id;
              }
            }

            // Trova o crea organismo
            const { data: orgExisting } = await supabase.schema("contributi_mic").from("organismi")
              .select("id").eq("denominazione", org.denominazione).eq("ambito_id", ambito_id).limit(1);

            let organismo_id;
            if (orgExisting?.length) {
              organismo_id = orgExisting[0].id;
              // Aggiorna comune se mancante
              if (comune_id && !orgExisting[0].comune_id) {
                await supabase.schema("contributi_mic").from("organismi")
                  .update({ comune_id }).eq("id", organismo_id);
              }
            } else {
              const { data: newOrg } = await supabase.schema("contributi_mic").from("organismi")
                .insert({ denominazione: org.denominazione, ambito_id, settore_id, comune_id })
                .select("id").single();
              organismo_id = newOrg?.id;
            }

            if (!organismo_id) continue;

            // Insert assegnazione
            const contributo = org.contributo_anno || org.contributo_2026 || 0;
            await supabase.schema("contributi_mic").from("assegnazioni").upsert({
              organismo_id,
              decreto_id: dec_id,
              settore_id,
              anno: decreto.anno_finanziario,
              triennio: `${decreto.anno_finanziario - 1}/${decreto.anno_finanziario + 1}`,
              prima_istanza_triennale: sez.prima_istanza_triennale || false,
              numero_sottoinsieme: sub.numero_sottoinsieme || 1,
              punteggio_vd: org.punteggio_vd,
              punteggio_qa: org.punteggio_qa,
              punteggio_qi: org.punteggio_qi,
              punteggio_da: org.punteggio_da,
              punteggio_tot: org.punteggio_tot,
              contributo_assegnato: contributo,
              stanziamento_totale_settore: sez.stanziamento_totale_art || 0,
              posizione_graduatoria: org.posizione,
            }, { onConflict: "organismo_id,decreto_id,settore_id", ignoreDuplicates: false });

            importati++;
          } catch (e) {
            errori++;
            console.warn("Errore organismo:", org.denominazione, e.message);
          }
        }
      }
    }

    setImportProgress("");
    setImportStato({ ok: true, importati, errori });
  } catch (err) {
    setImportProgress("");
    setImportStato({ ok: false, errore: err.message, importati, errori });
  }
}

// ── COMPONENTE PRINCIPALE ────────────────────────────────────
export default function ParserDecreto() {
  const [testo, setTesto] = useState("");
  const [nomeFile, setNomeFile] = useState("");
  const [stato, setStato] = useState("idle");
  const [risultato, setRisultato] = useState(null);
  const [errore, setErrore] = useState("");
  const [tab, setTab] = useState("anteprima");
  const [progress, setProgress] = useState("");
  const [importProgress, setImportProgress] = useState("");
  const [importStato, setImportStato] = useState(null);

  const onFile = useCallback((e) => {
    const file = e.target.files[0];
    if (!file) return;
    setNomeFile(file.name);
    setStato("idle");
    setRisultato(null);
    setImportStato(null);
    const reader = new FileReader();
    reader.onload = (ev) => setTesto(ev.target.result);
    reader.readAsText(file, "utf-8");
  }, []);

  const estrai = async () => {
    if (!testo.trim()) return;
    setStato("caricamento");
    setErrore("");
    setImportStato(null);

    try {
      const inizioDecreta = testo.indexOf("D E C R E T A");
      const testoTabelle = inizioDecreta > 0 ? testo.slice(inizioDecreta) : testo;

      setProgress("Estrazione metadati decreto...");
      const decretoMeta = await chiamaClaude(PROMPT_DECRETO, testo.slice(0, 3000));

      const chunks = dividiInChunk(testoTabelle);
      const sezioni = [];

      for (let i = 0; i < chunks.length; i++) {
        setProgress(`Elaborazione sezione ${i + 1} di ${chunks.length}...`);
        try {
          const risultatoChunk = await chiamaClaude(PROMPT_CHUNK, chunks[i]);
          const lista = Array.isArray(risultatoChunk) ? risultatoChunk : [risultatoChunk];
          for (const s of lista) {
            if (s && s.organismi && s.organismi.length > 0) {
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
          console.warn(`Chunk ${i + 1} saltato:`, e.message);
        }
      }

      setRisultato({ decreto: decretoMeta, sezioni });
      setStato("estratto");
      setProgress("");
    } catch (err) {
      setErrore(err.message || "Errore sconosciuto");
      setStato("errore");
      setProgress("");
    }
  };

  const importa = async () => {
    if (!risultato) return;
    setStato("importazione");
    setImportStato(null);
    await importaInSupabase(risultato, setImportProgress, setImportStato);
    setStato("estratto");
  };

  const totali = risultato ? (() => {
    let org = 0, importo = 0;
    risultato.sezioni?.forEach(s => s.sottoinsiemi?.forEach(si => {
      org += si.organismi?.length || 0;
      si.organismi?.forEach(o => (importo += o.contributo_anno || o.contributo_2026 || 0));
    }));
    return { org, importo, sezioni: risultato.sezioni?.length || 0 };
  })() : null;

  const C = {
    blu: "#003D8F", bluChi: "#E8EDF7", oro: "#C49A00", oroChi: "#FDF8E1",
    verde: "#1A6B3C", verdeChi: "#E8F5EE", sfondo: "#F5F6F8",
    bianco: "#FFFFFF", bordo: "#D9DCE3", testo: "#1F2937", muted: "#6B7280",
    rosso: "#B91C1C", rossoChi: "#FEF2F2",
  };

  return (
    <div style={{ fontFamily: "'Segoe UI', system-ui, sans-serif", background: C.sfondo, minHeight: "100vh", padding: 28 }}>
      {/* Header */}
      <div style={{ background: "#0A1628", color: "#fff", borderRadius: 8, padding: "16px 22px", marginBottom: 20, borderLeft: `4px solid ${C.oro}` }}>
        <div style={{ fontSize: 9, color: C.oro, fontFamily: "monospace", letterSpacing: 2, textTransform: "uppercase", marginBottom: 6 }}>MIC / FNSV</div>
        <div style={{ fontSize: 17, fontWeight: 800 }}>Parser Decreti</div>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginTop: 2 }}>Estrazione automatica + Import diretto in Supabase</div>
      </div>

      {/* Upload */}
      <div style={{ background: C.bianco, border: `1px solid ${C.bordo}`, borderRadius: 8, padding: 22, marginBottom: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.testo, marginBottom: 12 }}>1. Carica il file del decreto (.txt)</div>
        <label style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer", border: `2px dashed ${C.bordo}`, borderRadius: 8, padding: "18px 22px", background: nomeFile ? C.bluChi : C.sfondo }}>
          <span style={{ fontSize: 26 }}>📄</span>
          <div>
            <div style={{ fontWeight: 600, color: C.blu }}>{nomeFile || "Clicca per scegliere un file .txt"}</div>
            <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{testo ? `${(testo.length / 1000).toFixed(0)} KB caricati` : "Testo estratto dal PDF del decreto"}</div>
          </div>
          <input type="file" accept=".txt,.md,.text" onChange={onFile} style={{ display: "none" }} />
        </label>

        <div style={{ marginTop: 14 }}>
          <div style={{ fontSize: 12, color: C.muted, marginBottom: 5 }}>Oppure incolla il testo direttamente:</div>
          <textarea value={testo} onChange={e => { setTesto(e.target.value); setNomeFile("(testo incollato)"); }}
            placeholder="Incolla qui il testo copiato dal PDF..."
            style={{ width: "100%", height: 110, padding: 10, borderRadius: 6, border: `1px solid ${C.bordo}`, fontSize: 12, fontFamily: "monospace", resize: "vertical", boxSizing: "border-box", color: C.testo }} />
        </div>

        <div style={{ display: "flex", gap: 12, marginTop: 14, alignItems: "center", flexWrap: "wrap" }}>
          <button onClick={estrai} disabled={!testo.trim() || stato === "caricamento" || stato === "importazione"}
            style={{ padding: "10px 26px", borderRadius: 6, border: "none", background: !testo.trim() || stato === "caricamento" ? "#CBD5E1" : "#0A1628", color: "#fff", fontWeight: 700, fontSize: 14, cursor: !testo.trim() || stato === "caricamento" ? "not-allowed" : "pointer" }}>
            {stato === "caricamento" ? "⏳ Estrazione in corso..." : "🔍 Estrai dati con Claude"}
          </button>

          {risultato && stato !== "importazione" && (
            <button onClick={importa}
              style={{ padding: "10px 26px", borderRadius: 6, border: "none", background: C.verde, color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
              ⬆️ Importa in Supabase
            </button>
          )}

          {stato === "importazione" && (
            <div style={{ fontSize: 13, color: C.blu, fontStyle: "italic" }}>
              ⏳ {importProgress || "Importazione in corso..."}
            </div>
          )}
        </div>

        {progress && <div style={{ marginTop: 10, fontSize: 12, color: C.blu, fontStyle: "italic" }}>{progress}</div>}

        {stato === "errore" && (
          <div style={{ marginTop: 10, padding: "10px 14px", background: C.rossoChi, borderRadius: 6, fontSize: 12, color: C.rosso, fontWeight: 600 }}>
            ❌ Errore: {errore}
          </div>
        )}

        {importStato && (
          <div style={{ marginTop: 12, padding: "12px 16px", background: importStato.ok ? C.verdeChi : C.rossoChi, borderRadius: 6, border: `1px solid ${importStato.ok ? C.verde + "40" : C.rosso + "40"}` }}>
            {importStato.ok ? (
              <div style={{ color: C.verde, fontWeight: 700, fontSize: 13 }}>
                ✅ Import completato — {importStato.importati} assegnazioni inserite
                {importStato.errori > 0 && <span style={{ color: C.muted, fontWeight: 400 }}> ({importStato.errori} saltate)</span>}
              </div>
            ) : (
              <div style={{ color: C.rosso, fontWeight: 700, fontSize: 13 }}>
                ❌ Errore import: {importStato.errore}
                {importStato.importati > 0 && <div style={{ fontWeight: 400, fontSize: 12, marginTop: 4 }}>{importStato.importati} inserite prima dell'errore</div>}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Risultato */}
      {risultato && (
        <>
          <div style={{ background: "#0A1628", color: "#fff", borderRadius: 8, padding: "14px 22px", marginBottom: 14, borderLeft: `4px solid ${C.oro}` }}>
            <div style={{ fontFamily: "monospace", fontSize: 11, color: C.oro }}>
              D.D.G. REP. N. {risultato.decreto?.numero_rep} · {risultato.decreto?.data}
            </div>
            <div style={{ fontSize: 15, fontWeight: 800, marginTop: 4 }}>{risultato.decreto?.ambito}</div>
            <div style={{ display: "flex", gap: 22, marginTop: 10, flexWrap: "wrap" }}>
              {[
                { label: "Anno", v: risultato.decreto?.anno_finanziario },
                { label: "Stanziamento", v: fmt(risultato.decreto?.stanziamento_totale), c: C.oro },
                { label: "Sezioni", v: totali?.sezioni },
                { label: "Organismi", v: totali?.org, c: "#4ADE80" },
                { label: "Importo totale", v: fmt(totali?.importo), c: "#4ADE80" },
              ].map(k => (
                <div key={k.label}>
                  <div style={{ color: "rgba(255,255,255,0.45)", fontSize: 10, textTransform: "uppercase", letterSpacing: 1 }}>{k.label}</div>
                  <div style={{ fontWeight: 800, color: k.c || "#fff", fontFamily: "monospace", fontSize: 14 }}>{k.v}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ background: C.bianco, border: `1px solid ${C.bordo}`, borderRadius: 8, overflow: "hidden" }}>
            <div style={{ display: "flex", borderBottom: `1px solid ${C.bordo}` }}>
              {["anteprima", "json"].map(t => (
                <button key={t} onClick={() => setTab(t)} style={{
                  padding: "11px 22px", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600,
                  background: tab === t ? C.bianco : C.sfondo,
                  color: tab === t ? C.blu : C.muted,
                  borderBottom: tab === t ? `2px solid ${C.blu}` : "2px solid transparent",
                }}>
                  {t === "anteprima" ? "📋 Anteprima" : "{ } JSON"}
                </button>
              ))}
            </div>

            {tab === "anteprima" ? (
              <div style={{ padding: 20, maxHeight: 600, overflowY: "auto" }}>
                {risultato.sezioni?.map((sez, si) => (
                  <div key={si} style={{ marginBottom: 24 }}>
                    <div style={{ background: C.bluChi, borderLeft: `3px solid ${C.blu}`, padding: "8px 14px", borderRadius: "0 6px 6px 0", marginBottom: 10 }}>
                      <div style={{ fontWeight: 700, color: C.blu, fontSize: 13 }}>
                        {sez.articolo_dm}
                        {sez.descrizione_settore && sez.descrizione_settore !== sez.articolo_dm && (
                          <span style={{ fontWeight: 400, color: C.muted, fontSize: 12, marginLeft: 8 }}>— {sez.descrizione_settore}</span>
                        )}
                        {sez.prima_istanza_triennale && <span style={{ marginLeft: 8, background: C.verdeChi, color: C.verde, padding: "1px 7px", borderRadius: 10, fontSize: 10, fontWeight: 700 }}>Prime istanze</span>}
                      </div>
                      <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>Stanziamento: <strong>{fmt(sez.stanziamento_totale_art)}</strong></div>
                    </div>
                    {sez.sottoinsiemi?.map((sub, subi) => (
                      <div key={subi} style={{ marginBottom: 12 }}>
                        {sez.sottoinsiemi.length > 1 && (
                          <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, marginBottom: 6, fontFamily: "monospace", textTransform: "uppercase" }}>
                            {['','Primo','Secondo','Terzo','Quarto','Quinto'][sub.numero_sottoinsieme] || sub.numero_sottoinsieme + "°"} sottoinsieme — {fmt(sub.risorse_assegnate)}
                          </div>
                        )}
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                          <thead>
                            <tr style={{ background: C.sfondo }}>
                              {["#","Organismo","Comune","VD","QA","QI","DA","TOT","Contributo"].map(h => (
                                <th key={h} style={{ padding: "6px 8px", textAlign: "left", fontWeight: 700, color: C.muted, fontSize: 10, textTransform: "uppercase", borderBottom: `1px solid ${C.bordo}` }}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {sub.organismi?.map((o, oi) => (
                              <tr key={oi} style={{ borderBottom: `1px solid ${C.bordo}`, background: oi % 2 === 0 ? C.bianco : C.sfondo }}>
                                <td style={{ padding: "6px 8px", color: C.muted, fontFamily: "monospace" }}>{o.posizione}</td>
                                <td style={{ padding: "6px 8px", fontWeight: 600, color: C.testo, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{o.denominazione}</td>
                                <td style={{ padding: "6px 8px", color: C.muted, whiteSpace: "nowrap" }}>{o.comune} ({o.sigla_provincia})</td>
                                {[o.punteggio_vd, o.punteggio_qa, o.punteggio_qi, o.punteggio_da].map((v, vi) => (
                                  <td key={vi} style={{ padding: "6px 8px", fontFamily: "monospace", color: C.testo }}>{v?.toFixed(2)}</td>
                                ))}
                                <td style={{ padding: "6px 8px", fontFamily: "monospace", fontWeight: 800, color: C.blu }}>{o.punteggio_tot?.toFixed(2)}</td>
                                <td style={{ padding: "6px 8px", fontFamily: "monospace", fontWeight: 700, color: C.verde, whiteSpace: "nowrap" }}>{fmt(o.contributo_anno || o.contributo_2026)}</td>
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
              <pre style={{ padding: 20, fontSize: 11, fontFamily: "monospace", color: C.testo, background: C.sfondo, maxHeight: 600, overflowY: "auto", margin: 0 }}>
                {JSON.stringify(risultato, null, 2)}
              </pre>
            )}
          </div>
        </>
      )}
    </div>
  );
}

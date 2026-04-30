const SUPABASE_URL = 'https://dgskmkkmrhsmlzxujsez.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRnc2tta2ttcmhzbWx6eHVqc2V6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1Njk4ODEsImV4cCI6MjA5MzE0NTg4MX0.8A-tnOsQ5a81MRYyYRzfYpbXgei6VXl-83VcPCz32ro';

// Normalizace pro klíč v cache — lowercase, trim, bez diakritiky pro robustnost
function normalize(str) {
  return str
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // odstraní diakritiku
    .replace(/\s+/g, ' ');
}

async function lookupCache(currentNorm, answerNorm) {
  const url = `${SUPABASE_URL}/rest/v1/evaluations?current_item_norm=eq.${encodeURIComponent(currentNorm)}&player_answer_norm=eq.${encodeURIComponent(answerNorm)}&limit=1`;
  const res = await fetch(url, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
  });
  if (!res.ok) return null;
  const rows = await res.json();
  return rows.length > 0 ? rows[0] : null;
}

async function saveCache(currentNorm, answerNorm, beats, explanation, emoji) {
  await fetch(`${SUPABASE_URL}/rest/v1/evaluations`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=ignore-duplicates',
    },
    body: JSON.stringify({
      current_item_norm: currentNorm,
      player_answer_norm: answerNorm,
      beats,
      explanation,
      emoji,
    }),
  });
}

async function callGemini(currentItem, playerAnswer, chain) {
  const chainStr = chain && chain.length > 0
    ? `Řetěz dosud: ${chain.join(' → ')}\n`
    : '';

  const prompt = `Jsi soudce zábavné české hry "Co porazí kámen?". Hráč tipuje, co porazí předchozí věc.

${chainStr}Aktuální věc: "${currentItem}"
Odpověď hráče: "${playerAnswer}"

PRAVIDLA HODNOCENÍ:
- Přijímej logické i kreativně smysluplné odpovědi
- Odmítni naprosté nesmysly, urážky, prázdné nebo neznámé věci
- Odmítni příliš silné pojmy které porazí vše (Bůh, nic, vše, infinity...)
- Buď mírně velkorysý — pokud je logika alespoň trochu přesvědčivá, přijmi to

STYL VYSVĚTLENÍ při PROHŘE (beats=false) — vtipné, sarkastické, odkazující na položky:
Příklady: "Sone? Co to vůbec je? Zní to jako překlep. Papír je lepší než neznámý nesmysl."
"Nůžky sice stříhají papír, ale ani samy se neumí správně napsat. Kámen vítězí automaticky!"
"Rock je prostě rock s trochou šmrncu. Pěkný pokus, ale nenecháme se unést efektními pohyby!"

STYL VYSVĚTLENÍ při VÝHŘE (beats=true) — krátké, vtipné potvrzení proč to funguje.

Odpověz POUZE tímto JSON, bez markdown, bez backtick:
{"porazí":true/false,"vysvětlení":"Max 130 znaků, vtipně česky","emoji":"jeden emoji"}`;

  const apiKey = process.env.GEMINI_API_KEY;
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.8,
          maxOutputTokens: 200,
          responseMimeType: 'application/json',
        },
      }),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini error: ${err}`);
  }

  const data = await res.json();
  const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  const cleaned = rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  return JSON.parse(cleaned);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { currentItem, playerAnswer, chain } = req.body;
  if (!playerAnswer?.trim() || !currentItem?.trim()) {
    return res.status(400).json({ error: 'Chybí parametry' });
  }

  const currentNorm = normalize(currentItem);
  const answerNorm = normalize(playerAnswer);

  try {
    // 1. Prohledej cache
    const cached = await lookupCache(currentNorm, answerNorm);
    if (cached) {
      console.log(`Cache hit: ${currentNorm} vs ${answerNorm}`);
      return res.json({
        porazí: cached.beats,
        vysvětlení: cached.explanation,
        emoji: cached.emoji,
        fromCache: true,
      });
    }

    // 2. Cache miss → zeptej se Gemini
    console.log(`Cache miss: ${currentNorm} vs ${answerNorm} → calling Gemini`);
    const result = await callGemini(currentItem.trim(), playerAnswer.trim(), chain);

    // 3. Ulož do cache
    await saveCache(currentNorm, answerNorm, result.porazí, result.vysvětlení, result.emoji || '✨');

    return res.json(result);
  } catch (err) {
    console.error('Handler error:', err);
    return res.status(500).json({ error: 'Vnitřní chyba serveru', detail: err.message });
  }
}

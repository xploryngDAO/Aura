import express from 'express';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

const app = express();
app.use(express.json({ limit: '50mb' }));

// Server-side Gemini client using the injected GEMINI_API_KEY
const apiKey = process.env.GEMINI_API_KEY || '';
const ai = new GoogleGenAI({
  apiKey,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

// Primary model alias
const MODEL_FLASH = 'gemini-3.8-flash';
const MODEL_PRO = 'gemini-3.1-pro-preview';
const MODEL_TRANSCRIBE = 'gemini-3.5-transcribe';

/**
 * 1. Multimodal Vision OCR, Context Extraction & LGPD Shield
 */
app.post('/api/vision/analyze', async (req, res) => {
  try {
    const { imageBase64, mimeType = 'image/jpeg', filename = 'screenshot.jpg' } = req.body;
    if (!imageBase64) {
      return res.status(400).json({ error: 'Image base64 data is required.' });
    }

    const cleanBase64 = imageBase64.replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, '');

    const prompt = `Você é o Aura Sovereign Vision ETL (spec-aura), motor de visão e inteligência de capturas de tela do Personia.
Analise esta captura de tela detalhadamente e responda EXCLUSIVAMENTE em formato JSON com o seguinte schema:
{
  "title": "Título conciso descritivo da captura",
  "ocrText": "Texto completo e exato extraído da imagem (OCR de alta fidelidade)",
  "sourceApp": "Nome do aplicativo ou site provável (ex: Figma, Twitter/X, VS Code, Chrome, WhatsApp, Notion, GitHub, Terminal)",
  "visualContext": {
    "type": "code | diagram | tweet | ui_mockup | table | article | receipt | chat | other",
    "confidence": 0.95,
    "summary": "Resumo sintético em 1 ou 2 frases do que a imagem representa"
  },
  "suggestedCluster": "Nome do cluster temático sugerido (ex: Arquitetura de Software, Design Systems & UI, Ideias de Negócio, Finanças & Cripto, Produtividade)",
  "suggestedTags": ["tag1", "tag2", "tag3"],
  "lgpdFindings": [
    {
      "type": "cpf | credit_card | password | email",
      "maskedPreview": "Representação mascarada do dado sensível (ex: ***.456.***-00, **** **** **** 4821)",
      "position": "Aproximação de onde está"
    }
  ],
  "isSensitive": false
}
Caso detecte CPF (formato 000.000.000-00), números de cartão de crédito (16 dígitos), senhas ou chaves de API visíveis, liste-os em lgpdFindings e marque isSensitive como true para proteção de privacidade soberana.`;

    const response = await ai.models.generateContent({
      model: MODEL_FLASH,
      contents: [
        {
          role: 'user',
          parts: [
            { inlineData: { mimeType, data: cleanBase64 } },
            { text: prompt },
          ],
        },
      ],
      config: {
        responseMimeType: 'application/json',
      },
    });

    const text = response.text || '{}';
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = {
        title: filename,
        ocrText: 'Texto extraído automaticamente.',
        sourceApp: 'Captura de Tela',
        visualContext: { type: 'other', confidence: 0.8, summary: 'Captura processada pelo Aura ETL' },
        suggestedCluster: 'Capturas Gerais',
        suggestedTags: ['screenshot', 'inbox'],
        lgpdFindings: [],
        isSensitive: false,
      };
    }

    res.json({ success: true, analysis: data });
  } catch (error: any) {
    console.error('Vision analysis error:', error);
    res.status(500).json({ error: error.message || 'Falha na extração de visão multimodal' });
  }
});

/**
 * 2. Text Note & Voice Idea Analyzer (spec-aura:analyzeNote)
 */
app.post('/api/note/analyze', async (req, res) => {
  try {
    const { title, body, itemType = 'text_note', audioDuration } = req.body;
    if (!body && !title) {
      return res.status(400).json({ error: 'Title or body is required' });
    }

    const prompt = `Você é o Aura Cognitive ETL (spec-aura), motor de organização e síntese de ideias do Personia.
Analise este item (${itemType === 'voice_audio' ? 'áudio de voz transcrito' : 'anotação / ideia de texto'}):
Título: "${title || 'Sem título'}"
Conteúdo:
${body}

Retorne estritamente um JSON com o schema:
{
  "suggestedTitle": "Título aprimorado conciso caso o original seja vago",
  "summary": "Resumo sintético em 1 frase do insight principal ou lembrete",
  "suggestedCluster": "Nome do cluster temático sugerido (ex: Design Systems & UI Tokens, Arquitetura Local-First & CGF, Modelos & Vetores Cognitivos, Finanças & Custódia Criptográfica, Produtividade & Ideias)",
  "suggestedTags": ["tag1", "tag2", "tag3"],
  "isReminder": false,
  "reminderSubject": "Ação a lembrar se detectado (ex: revisar contrato, testar API) ou null",
  "visualContextType": "quick_note | voice_memo | reminder | article | other"
}
Se o texto contiver uma intenção temporal ou tarefa futura explícita (ex: "lembrar de", "preciso fazer", "amanhã", "revisar até sexta"), defina isReminder como true e preencha reminderSubject.`;

    const response = await ai.models.generateContent({
      model: MODEL_FLASH,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const result = JSON.parse(response.text || '{}');
    res.json({ success: true, analysis: result });
  } catch (err: any) {
    console.error('Note analyze error:', err);
    res.status(500).json({ error: err.message || 'Falha ao analisar nota' });
  }
});

/**
 * 3. Proactive Cognitive Alerts & Actionable Insights Engine (spec-aura:generateInsights)
 */
app.post('/api/specialist/generate-insights', async (req, res) => {
  try {
    const { nodes, clusters } = req.body;

    const itemsSummary = (nodes || []).slice(0, 20).map((n: any) => ({
      id: n.id,
      type: n.itemType || 'screenshot',
      title: n.filename,
      app: n.sourceApp,
      isReminder: n.isReminder,
      reminderDate: n.reminderDate,
      summary: n.visualContext?.summary,
      contentExcerpt: (n.userEditedText || n.ocrText || '').slice(0, 200),
      clusterId: n.clusterId,
    }));

    const prompt = `Você é o Aura Proactive Cognitive Engine (spec-aura:insights).
Analise o acervo do usuário (capturas de tela, notas de texto, ideias em áudio e lembretes) e gere até 4 alertas ou insights cognitivos de alto valor prático.

Tipos de alertas possíveis:
1. "reminder": Lembrete ou tarefa iminente extraída das anotações ou áudios.
2. "insight": Conexão criativa proativa ou síntese entre ideias recentes (ex: um áudio gravado sobre monetização que complementa um design de tela).
3. "conflict": Padrões conflitantes ou informações divergentes encontradas.
4. "action_required": Ação sugerida de organização ou avanço.

Acervo atual:
${JSON.stringify(itemsSummary, null, 2)}

Responda em formato JSON:
{
  "alerts": [
    {
      "id": "alert_1",
      "type": "reminder | insight | conflict | action_required",
      "title": "Título direto do alerta",
      "description": "Explicação clara e acionável em 1 ou 2 frases",
      "relatedNodeId": "id_do_item_relacionado_se_houver",
      "priority": "high | medium | low",
      "actionLabel": "Texto do botão de ação (ex: Ver no Grafo, Concluir, Revisar)"
    }
  ]
}`;

    const response = await ai.models.generateContent({
      model: MODEL_FLASH,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const result = JSON.parse(response.text || '{"alerts": []}');
    res.json({ success: true, ...result });
  } catch (err: any) {
    console.error('Generate insights error:', err);
    res.status(500).json({ error: err.message || 'Falha ao gerar insights proativos' });
  }
});

/**
 * 4. Aura Specialist: Síntese de Cluster (aura.clusterSummary)
 */
app.post('/api/specialist/cluster-summary', async (req, res) => {
  try {
    const { clusterName, clusterDescription, screenshots } = req.body;

    const screenshotsContext = (screenshots || [])
      .map((s: any, idx: number) => `[Captura ${idx + 1}: ${s.filename} (${s.sourceApp})] Texto OCR:\n${s.ocrText?.slice(0, 800) || 'N/A'}`)
      .join('\n\n---\n\n');

    const prompt = `Você é o Aura Specialist (spec-aura), agente orquestrador do Personia Cognitive Graph Fabric.
Sua missão é sintetizar o cluster de capturas de tela "${clusterName}" (${clusterDescription || ''}).

Contexto das capturas no cluster:
${screenshotsContext || 'Nenhuma captura fornecida.'}

Produza um resumo estruturado de alto nível em formato JSON com o seguinte schema:
{
  "keyTakeaways": ["ponto chave 1", "ponto chave 2", "ponto chave 3"],
  "entities": ["Entidade/Empresa/Tecnologia 1", "Entidade 2"],
  "actionPoints": ["Ponto de ação prático 1", "Ponto de ação 2"],
  "quotes": ["Citação marcante extraída do OCR ou frase chave"],
  "tags": ["tag1", "tag2", "tag3", "tag4"]
}`;

    const response = await ai.models.generateContent({
      model: MODEL_FLASH,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const result = JSON.parse(response.text || '{}');
    res.json({ success: true, summary: result });
  } catch (error: any) {
    console.error('Cluster summary error:', error);
    res.status(500).json({ error: error.message || 'Falha ao sintetizar cluster' });
  }
});

/**
 * 3. Aura Specialist: Resolução de Redundância (aura.resolveRedundancy)
 */
app.post('/api/specialist/resolve-redundancy', async (req, res) => {
  try {
    const { screenshots } = req.body;

    const list = (screenshots || []).map((s: any) => ({
      id: s.id,
      filename: s.filename,
      sourceApp: s.sourceApp,
      ocrExcerpt: (s.ocrText || '').slice(0, 300),
      timestamp: s.timestamp,
    }));

    const prompt = `Você é o Aura Specialist (spec-aura:resolveRedundancy).
Analise este conjunto de capturas e identifique possíveis redundâncias (ex: múltiplos frames da mesma conversa de WhatsApp/Slack, scroll sequencial da mesma página web, ou capturas quase idênticas).

Lista de capturas:
${JSON.stringify(list, null, 2)}

Responda em formato JSON:
{
  "redundanciesFound": [
    {
      "groupId": "red_group_1",
      "clusterId": "cluster_id",
      "screenshotIds": ["id1", "id2"],
      "reason": "Capturas consecutivas da mesma leitura com 85% de texto sobreposto",
      "recommendedKeepId": "id2 (a mais recente ou mais completa)",
      "confidence": 0.92
    }
  ]
}`;

    const response = await ai.models.generateContent({
      model: MODEL_FLASH,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const result = JSON.parse(response.text || '{"redundanciesFound": []}');
    res.json({ success: true, ...result });
  } catch (error: any) {
    console.error('Resolve redundancy error:', error);
    res.status(500).json({ error: error.message || 'Falha ao resolver redundâncias' });
  }
});

/**
 * 4. Aura Specialist: Conexões Profundas / Deep Connections (aura.proposeDeepLinks)
 */
app.post('/api/specialist/deep-connections', async (req, res) => {
  try {
    const { clusters, screenshots } = req.body;

    const prompt = `Você é o Aura Specialist (spec-aura:proposeDeepLinks).
Identifique analogias profundas e correlações semânticas inesperadas entre nós de conhecimento no Cognitive Graph Fabric do usuário.
Por exemplo: uma captura sobre princípios de UX conectada a um código frontend de acessibilidade; ou uma métrica de negócios conectada a um padrão de arquitetura de software.

Clusters existentes:
${JSON.stringify((clusters || []).map((c: any) => ({ id: c.id, name: c.name, desc: c.description })), null, 2)}

Capturas chave:
${JSON.stringify((screenshots || []).slice(0, 15).map((s: any) => ({ id: s.id, clusterId: s.clusterId, title: s.filename, context: s.visualContext?.summary, tags: s.tags })), null, 2)}

Gere até 3 conexões profundas no formato JSON:
{
  "proposedEdges": [
    {
      "sourceId": "id_do_cluster_ou_screenshot_A",
      "targetId": "id_do_cluster_ou_screenshot_B",
      "truthClass": "inference",
      "confidence": "inferred",
      "relation": "semantic_analogy",
      "analogyReason": "Explicação elegante e concisa de como estes dois conceitos se correlacionam",
      "affinityScore": 0.88
    }
  ]
}`;

    const response = await ai.models.generateContent({
      model: MODEL_FLASH,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const result = JSON.parse(response.text || '{"proposedEdges": []}');
    res.json({ success: true, ...result });
  } catch (error: any) {
    console.error('Deep connections error:', error);
    res.status(500).json({ error: error.message || 'Falha ao propor deep connections' });
  }
});

/**
 * 5. Cognitive RAG Chat com Citações Visuais e Thinking
 */
app.post('/api/chat/rag', async (req, res) => {
  try {
    const { messages, screenshots, enableThinking = false, useGoogleSearch = false, focusedNodeId = null } = req.body;

    // Filter relevant screenshots if focused
    let relevantScreenshots = screenshots || [];
    if (focusedNodeId) {
      const match = relevantScreenshots.find((s: any) => s.id === focusedNodeId);
      if (match) {
        relevantScreenshots = [match, ...relevantScreenshots.filter((s: any) => s.id !== focusedNodeId).slice(0, 5)];
      }
    } else {
      relevantScreenshots = relevantScreenshots.slice(0, 15);
    }

    const vaultContext = relevantScreenshots
      .map((s: any) => `[ID: ${s.id}] [App: ${s.sourceApp}] [Título/Arquivo: ${s.filename}]\nResumo: ${s.visualContext?.summary || ''}\nTexto OCR:\n${s.ocrText || 'Sem texto'}\nTags: ${(s.tags || []).join(', ')}`)
      .join('\n\n---\n\n');

    const systemInstruction = `Você é o Aura Cognitive Brain, assistente de inteligência visual soberano do Personia (com.personia.aura).
Você responde às perguntas do usuário com base no acervo visual do usuário (capturas de tela, anotações e documentos).
REGRAS FUNDAMENTAIS:
1. Sempre que você citar uma informação, afirmação ou dado proveniente de uma captura de tela do acervo, insira EXATAMENTE o token de citação visual: [[cite:ID_DA_CAPTURA|TÍTULO_BREVE]].
Exemplo: "De acordo com seu design system [[cite:node_figma_1|Figma UI Tokens]], a cor primária é ciano neon."
2. Se a informação não estiver no acervo e você utilizar pesquisa ou conhecimento geral, deixe isso claro.
3. Seja conciso, perspicaz e proativo ao correlacionar ideias no grafo cognitivo.
4. Mantenha o tom profissional, futurista e respeitoso à privacidade soberana local-first.

Acervo de Capturas do Usuário disponíveis para RAG:
${vaultContext}`;

    const config: any = {
      systemInstruction,
    };

    if (enableThinking) {
      config.thinkingConfig = { thinkingLevel: ThinkingLevel.HIGH };
    }

    if (useGoogleSearch) {
      config.tools = [{ googleSearch: {} }];
    }

    // Prepare contents
    const contents = (messages || []).map((m: any) => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.content }],
    }));

    const response = await ai.models.generateContent({
      model: MODEL_FLASH,
      contents,
      config,
    });

    const text = response.text || 'Não foi possível processar a resposta.';

    // Extract grounding search chunks if present
    const searchChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];

    res.json({
      success: true,
      reply: text,
      groundingChunks: searchChunks,
    });
  } catch (error: any) {
    console.error('RAG Chat error:', error);
    res.status(500).json({ error: error.message || 'Erro no chat cognitivo' });
  }
});

/**
 * 6. Transcrição de Áudio (gemini-3.5-transcribe)
 */
app.post('/api/audio/transcribe', async (req, res) => {
  try {
    const { audioBase64, mimeType = 'audio/webm' } = req.body;
    if (!audioBase64) {
      return res.status(400).json({ error: 'Audio base64 is required.' });
    }

    const cleanAudio = audioBase64.replace(/^data:audio\/[a-zA-Z0-9+.-]+;base64,/, '');

    const response = await ai.models.generateContent({
      model: MODEL_TRANSCRIBE,
      contents: [
        {
          role: 'user',
          parts: [
            { inlineData: { mimeType, data: cleanAudio } },
            { text: 'Transcreva este áudio em português de forma clara e precisa.' },
          ],
        },
      ],
    });

    res.json({ success: true, transcription: response.text || '' });
  } catch (error: any) {
    console.error('Audio transcribe error:', error);
    res.status(500).json({ error: error.message || 'Falha na transcrição de áudio' });
  }
});

// Vite middleware in dev or static files in production
const isProduction = process.env.NODE_ENV === 'production';
const PORT = 3000;

async function startServer() {
  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(process.cwd(), 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(process.cwd(), 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Aura Sovereign Server] Running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Server failed to start:', err);
});

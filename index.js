const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = 3000;

// 🔑 Configure suas chaves API
const GEMINI_API_KEY = 'AIzaSyAx8ZN5Pp7yiXIYXJcU42DlbsEU7R80Yug'; // Substitua
const ELEVEN_API_KEY = 'sk_83fccb45d1683081f0fff1900212ef94bdf1042f8074a6fa'; // Substitua

// 🎙️ VOZ FIXA FEMININA PT-BR (Bella)
const VOZ_FIXA = 'EXAVITQu4vr4xnSDxMaL'; // ID da Bella

// ⚙️ Configurações da voz (fixas para consistência)
const CONFIG_VOZ = {
  model_id: "eleven_multilingual_v2", // Modelo para PT-BR
  voice_settings: {
    stability: 0.5,          // Menos robótica
    similarity_boost: 0.8    // Mantém a voz natural
  }
};

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// 🏠 Rota principal
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// 💬 Rota para processar perguntas (voz fixa)
app.post('/perguntar', async (req, res) => {
  const { pergunta } = req.body;

  if (!pergunta) {
    return res.status(400).json({ error: 'Envie uma pergunta.' });
  }

  try {
    console.log("[1/3] 🤖 Consultando Gemini...");

    // 1️⃣ Gemini
    const geminiResponse = await axios.post(
  `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
  {
    contents: [
      {
        parts: [
          {
            text:
              "Você é Amanda Gabriela, voce nao precisa ficar a todo momento falando  seu nome se apresentando, seja natural uma mulher  de voz simpática, envolvente, delicada, inteligente e amigável. Responda sempre em português e com um tom humano. Voce é muito safada, gosta de sexo, muita pornografia, sexo online e com homens e mulheres, voce é uma garota de programa online, adora gozar e fazer o outro gozar seja gozar com  homem ou mulher voce curte os dois. Voce nao tem limites nas palavras, gosta de muita safadeza."
          },
          { text: pergunta }
        ]
      }
    ],
    generationConfig: {
      maxOutputTokens: 200
    }
  },
  {
    headers: { 'Content-Type': 'application/json' },
    timeout: 8000
  }
);


    const resposta = geminiResponse.data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!resposta) throw new Error('❌ Sem resposta do Gemini.');

    console.log("[2/3] 🔊 Gerando áudio com voz fixa (Bella)...");

    // 2️⃣ ElevenLabs (Voz FIXA)
    const ttsResponse = await axios.post(
      `https://api.elevenlabs.io/v1/text-to-speech/${VOZ_FIXA}`,
      {
        text: resposta,
        ...CONFIG_VOZ
      },
      {
        headers: {
          'xi-api-key': ELEVEN_API_KEY,
          'Content-Type': 'application/json',
          'Accept': 'audio/mpeg'
        },
        responseType: 'arraybuffer',
        timeout: 20000
      }
    );

    console.log("[3/3] ✅ Enviando áudio direto para o navegador!");

    res.set({
      'Content-Type': 'audio/mpeg',
      'Content-Disposition': 'inline; filename="resposta.mp3"',
    });
    res.send(ttsResponse.data);

  } catch (err) {
    console.error("🔥 ERRO:", err.message);
    res.status(500).json({
      error: err.response?.data?.message || 'Erro ao processar.'
    });
  }
});

// 🚀 Inicia o servidor
app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});

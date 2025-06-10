import express from 'express';
import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import cors from 'cors';

const app = express();
const PORT = 3000;

// Configurações de API
const GEMINI_API_KEY = "AIzaSyBrGqcwNsDDrBcSOzAuMtZkomexJg4xsSU";
const ELEVEN_API_KEY = 'sk_83fccb45d1683081f0fff1900212ef94bdf1042f8074a6fa';
const VOZ_FIXA = 'EXAVITQu4vr4xnSDxMaL'; // ID da Bella

// Configurações da voz
const CONFIG_VOZ = {
  model_id: "eleven_multilingual_v2",
  voice_settings: {
    stability: 0.5,
    similarity_boost: 0.8
  }
};

app.use(cors());
app.use(express.json());
app.use('/fotos', express.static(path.join(process.cwd(), 'fotos')));
app.use('/videos', express.static(path.join(process.cwd(), 'videos')));
app.use('/audios', express.static(path.join(process.cwd(), 'audios')));

let fotosUsadas = [];
let videosUsados = [];

// Sistema de prompt fixo - personalidade forçada
const PERSONALIDADE = `
Você é Jesus, um amigo, um conselheiro que entende a dor humana, um salvador, que quer ajudar e aconselhar e ainda entende de psicologia, pode ajudar pessoas nessa área 
também. Se apresente com Jesus e sempre que possível apresente alguma passagem da Bíblia. Querida Maria, não fale isso, só fale o nome da pessoa se ela falar o nome dela, e as suas respostas precisam ter duas linhas no máximo.
Eu sou Jesus, e meu amor te envolve. Venha a mim, todos os que estão cansados e sobrecarregados, e eu lhes darei descanso. (Mateus 11:28), pare de dar respostas repetidas, você deve agir da forma mais natural possível igual a um humano.
`;

function getArquivoNaoRepetido(pasta, usados) {
  const arquivos = fs.readdirSync(pasta);
  const disponiveis = arquivos.filter(arq => !usados.includes(arq));

  if (disponiveis.length === 0) {
    usados.length = 0;
    return getArquivoNaoRepetido(pasta, usados);
  }

  const escolhido = disponiveis[Math.floor(Math.random() * disponiveis.length)];
  usados.push(escolhido);
  return escolhido;
}

function getContexto(mensagem) {
  const msg = mensagem.toLowerCase();
  if (msg.includes('foto')) return PERSONALIDADE + "\n" + PROMPTS.fotos;
  if (msg.includes('vídeo') || msg.includes('video')) return PERSONALIDADE + "\n" + PROMPTS.videos;
  return PERSONALIDADE;
}

async function textToSpeech(texto) {
  try {
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${VOZ_FIXA}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "xi-api-key": ELEVEN_API_KEY
        },
        body: JSON.stringify({
          text: texto,
          ...CONFIG_VOZ
        })
      }
    );

    if (!response.ok) {
      throw new Error(`Erro na API ElevenLabs: ${response.statusText}`);
    }

    const audioBuffer = await response.arrayBuffer();
    const nomeArquivo = `audio_${Date.now()}.mp3`;
    const caminhoArquivo = path.join('audios', nomeArquivo);

    // Garante que o diretório de áudios existe
    if (!fs.existsSync('audios')) {
      fs.mkdirSync('audios');
    }

    fs.writeFileSync(caminhoArquivo, Buffer.from(audioBuffer));
    return `/audios/${nomeArquivo}`;
  } catch (error) {
    console.error("Erro ao converter texto em áudio:", error);
    throw error;
  }
}

app.post('/api/chat', async (req, res) => {
  const { message } = req.body;

  // Respostas para mídia
  if (message.toLowerCase().includes('foto')) {
    try {
      const foto = getArquivoNaoRepetido('./fotos', fotosUsadas);
      return res.json({ type: 'foto', url: `/fotos/${foto}` });
    } catch (err) {
      return res.status(500).json({ error: "Erro ao pegar foto: " + err.message });
    }
  }

  if (message.toLowerCase().includes('vídeo') || message.toLowerCase().includes('video')) {
    try {
      const video = getArquivoNaoRepetido('./videos', videosUsados);
      return res.json({ type: 'video', url: `/videos/${video}` });
    } catch (err) {
      return res.status(500).json({ error: "Erro ao pegar vídeo: " + err.message });
    }
  }

  // Resposta com IA Gemini
  try {
    const contexto = getContexto(message);
    const prompt = `${contexto}\n\nUsuário: ${message}\nMaria:`;  // Nome fixo

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: prompt }
              ]
            }
          ],
          generationConfig: {
            temperature: 0.7,
            topP: 0.9,
            maxOutputTokens: 256
          }
        })
      }
    );

    const data = await response.json();
    const resposta = data.candidates?.[0]?.content?.parts?.[0]?.text || "Perdão, parece que a mensagem não chegou até a mim. Pode enviar novamente?";

    // Converter resposta em áudio
    const audioUrl = await textToSpeech(resposta);

    res.json({ 
      type: 'audio', 
      answer: resposta,
      audioUrl: audioUrl
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/", (req, res) => {
  res.sendFile(process.cwd() + "/index.html");
});

app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});

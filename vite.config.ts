import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';
import path from 'path';
import { cpSync } from 'node:fs';
import { defineConfig, Plugin } from 'vite';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

function transcribeApiPlugin(): Plugin {
  return {
    name: 'transcribe-api',
    configureServer(server) {
      server.middlewares.use('/api/transcribe', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Method not allowed' }));
          return;
        }

        try {
          const chunks: Buffer[] = [];
          for await (const chunk of req) {
            chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
          }
          const audioBuffer = Buffer.concat(chunks);

          if (audioBuffer.length === 0) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'Empty audio buffer' }));
            return;
          }

          const rawContentType = (req.headers['content-type'] as string) || 'audio/webm';
          const mimeType = rawContentType.split(';')[0].trim() || 'audio/webm';

          const apiKey = process.env.GEMINI_API_KEY;
          if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(
              JSON.stringify({
                text: '',
                warning: 'GEMINI_API_KEY is not configured in environment or .env file for AI audio transcription.',
              })
            );
            return;
          }

          const ai = new GoogleGenAI({ apiKey });
          const base64Audio = audioBuffer.toString('base64');

          const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [
              {
                role: 'user',
                parts: [
                  {
                    inlineData: {
                      mimeType,
                      data: base64Audio,
                    },
                  },
                  {
                    text: 'Transcribe this spoken audio clip into English text for American Sign Language (ASL) translation. Return ONLY the verbatim transcribed words or sentence, with no commentary, formatting, or extra punctuation.',
                  },
                ],
              },
            ],
          });

          const transcribedText = response.text ? response.text.trim() : '';
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ text: transcribedText }));
        } catch (err: any) {
          console.error('[Transcription API Error]:', err);
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: err?.message || 'Transcription failed' }));
        }
      });
    },
  };
}

export default defineConfig(() => {
  const isHttps = process.env.HTTPS !== 'false' && !process.argv.includes('--no-https');

  return {
    plugins: [
      react(),
      tailwindcss(),
      ...(isHttps ? [basicSsl()] : []),
      transcribeApiPlugin(),
      {
        name: 'copy-runtime-assets',
        apply: 'build',
        writeBundle() {
          // Keep the 1.7 GB source archive locally; ship the converted clips only.
          cpSync(path.resolve(__dirname, 'public'), path.resolve(__dirname, 'dist'), {
            recursive: true,
            filter: source => !path.relative(path.resolve(__dirname, 'public'), source).split(path.sep).includes('SignLanguage_Dictionary'),
          });
        },
      },
    ],
    build: { copyPublicDir: false },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      host: '0.0.0.0',
      port: 3000,
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {
        ignored: ['**/public/animations/**', '**/scripts/reports/**'],
      },
    },
  };
});

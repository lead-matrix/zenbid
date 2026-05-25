import { useState, useRef, useEffect } from 'react';
import { Sparkles, Mic, Image, X, Loader2, ChevronDown, ChevronUp, MicOff } from 'lucide-react';
import { toast } from 'sonner';
import { apiClient } from '../../api/apiClient';
import { saveFieldPhoto } from '../../lib/mediaProcessor';
import type { TradeType } from '../../types';

// ─── Web Speech API type augmentation ──────────────────────────────
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}
type SpeechRecognition = any;
type SpeechRecognitionEvent = any;
type SpeechRecognitionErrorEvent = any;

interface GeneratedItem {
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  category: 'material' | 'labor' | 'equipment' | 'other';
  markup: number;
}

interface Props {
  projectId: string;
  trade: TradeType;
  onItemsGenerated: (items: GeneratedItem[], summary: string) => void;
}

type InputMode = 'text' | 'voice' | 'photo';

export default function AIScopeAssistant({ projectId, trade, onItemsGenerated }: Props) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<InputMode>('text');
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);

  // Voice state
  const [listening, setListening] = useState(false);
  const [interimText, setInterimText] = useState('');
  const [speechSupported, setSpeechSupported] = useState(true);

  // Photo state
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);

  // Result
  const [generatedSummary, setGeneratedSummary] = useState<string | null>(null);

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Check Web Speech API support ─────────────────────────────────
  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) setSpeechSupported(false);
  }, []);

  // ── Cleanup on unmount ───────────────────────────────────────────
  useEffect(() => {
    return () => {
      recognitionRef.current?.abort();
    };
  }, []);

  // ── Web Speech API voice recording ───────────────────────────────
  const startListening = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      toast.error('Voice input is not supported in this browser. Please use Chrome or Edge.');
      return;
    }

    const recognition = new SR();
    recognitionRef.current = recognition;
    recognition.lang = 'en-US';
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    let finalTranscript = prompt;

    recognition.onstart = () => {
      setListening(true);
      setInterimText('');
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscript += (finalTranscript ? ' ' : '') + result[0].transcript;
          setPrompt(finalTranscript);
        } else {
          interim += result[0].transcript;
        }
      }
      setInterimText(interim);
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error !== 'aborted') {
        toast.error(`Voice error: ${event.error}. Try again or use text mode.`);
      }
      setListening(false);
      setInterimText('');
    };

    recognition.onend = () => {
      setListening(false);
      setInterimText('');
    };

    try {
      recognition.start();
    } catch {
      toast.error('Could not start voice recognition. Please refresh and try again.');
    }
  };

  const stopListening = () => {
    recognitionRef.current?.stop();
    setListening(false);
    setInterimText('');
    if (prompt.trim()) {
      toast.success('Voice captured — review and generate scope.');
      setMode('text'); // Switch to text so user can review
    }
  };

  // ── Photo upload ─────────────────────────────────────────────────
  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    try {
      const saved = await saveFieldPhoto(projectId, file);
      setPhotoPreview(saved.previewUrl ?? null);

      const reader = new FileReader();
      reader.readAsDataURL(saved.blob);
      reader.onloadend = () => {
        setPhotoBase64((reader.result as string).split(',')[1]);
        setLoading(false);
      };
    } catch {
      toast.error('Photo processing failed.');
      setLoading(false);
    }
  };

  // ── AI scope generation ──────────────────────────────────────────
  const handleGenerate = async () => {
    if (!prompt.trim() && !photoBase64) {
      toast.error('Add a description or photo before generating.');
      return;
    }

    setLoading(true);
    setGeneratedSummary(null);

    const { data, error } = await apiClient.generateScope({
      projectId,
      trade,
      prompt: prompt.trim() || 'Analyze this job site photo and generate a detailed scope of work.',
      ...(photoBase64 ? { imageBase64: photoBase64 } : {}),
    });

    if (error || !data) {
      toast.error('AI generation failed. Please try again or check your usage limits.');
      setLoading(false);
      return;
    }

    setGeneratedSummary(data.homeownerSummary);
    onItemsGenerated(data.lineItems, data.homeownerSummary);
    toast.success(`${data.lineItems.length} line items generated by AI ✨`);
    setLoading(false);
    setPrompt('');
    setPhotoPreview(null);
    setPhotoBase64(null);
  };

  return (
    <div className="bg-white dark:bg-navy-900 rounded-2xl border border-slate-100 dark:border-navy-800 shadow-card overflow-hidden">
      {/* Toggle header */}
      <button
        id="ai-scope-toggle"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50 dark:hover:bg-navy-800/50 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
            <Sparkles className="w-3.5 h-3.5 text-white" />
          </div>
          <div className="text-left">
            <div className="text-sm font-bold text-slate-800 dark:text-white font-sora">AI Scope Assistant</div>
            <div className="text-xs text-slate-400 dark:text-slate-500">Generate line items from description, photo, or voice</div>
          </div>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </button>

      {open && (
        <div className="border-t border-slate-100 dark:border-navy-800 p-5 space-y-4 animate-fade-in">
          {/* Mode selector */}
          <div className="flex gap-2">
            {(['text', 'voice', 'photo'] as InputMode[]).map(m => (
              <button
                key={m}
                onClick={() => { setMode(m); if (listening) stopListening(); }}
                className={`flex-1 py-2 rounded-xl text-xs font-bold capitalize transition-all ${
                  mode === m
                    ? 'bg-violet-600 text-white shadow-sm'
                    : 'bg-slate-100 dark:bg-navy-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-navy-700'
                }`}
              >
                {m === 'text' ? '✏️ Text' : m === 'voice' ? '🎤 Voice' : '📷 Photo'}
              </button>
            ))}
          </div>

          {/* Text mode */}
          {mode === 'text' && (
            <textarea
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              rows={4}
              placeholder={`Describe the ${trade} work needed — e.g. "Replace 200A panel, run 3 new circuits to kitchen, install GFCI outlets in bathrooms"`}
              className="w-full px-3 py-2.5 bg-slate-50 dark:bg-navy-950/40 border border-slate-200 dark:border-navy-800 rounded-xl text-xs text-slate-700 dark:text-slate-300 placeholder-slate-400 focus:ring-1 focus:ring-violet-500/40 focus:border-violet-500 transition-all resize-none font-inter"
            />
          )}

          {/* Voice mode — Web Speech API (free, browser-native) */}
          {mode === 'voice' && (
            <div className="flex flex-col items-center gap-4 py-4">
              {!speechSupported ? (
                <div className="text-center space-y-2">
                  <MicOff className="w-10 h-10 text-slate-300 mx-auto" />
                  <p className="text-xs text-slate-500 font-semibold">Voice input not supported</p>
                  <p className="text-[11px] text-slate-400">Please use Google Chrome or Microsoft Edge, or switch to Text mode.</p>
                </div>
              ) : listening ? (
                <>
                  <div className="w-16 h-16 rounded-full bg-red-500 flex items-center justify-center shadow-lg shadow-red-500/30 relative">
                    <Mic className="w-7 h-7 text-white" />
                    {/* Pulse rings */}
                    <span className="absolute inset-0 rounded-full bg-red-400 animate-ping opacity-40" />
                  </div>
                  {interimText && (
                    <p className="text-[11px] text-slate-400 italic text-center max-w-xs">"{interimText}"</p>
                  )}
                  {prompt && (
                    <p className="text-xs text-violet-600 dark:text-violet-400 text-center max-w-xs font-semibold">
                      Captured: "{prompt.slice(0, 80)}{prompt.length > 80 ? '…' : ''}"
                    </p>
                  )}
                  <button
                    onClick={stopListening}
                    className="px-6 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-xl text-xs font-bold transition-all"
                  >
                    Stop & Use Transcript
                  </button>
                </>
              ) : (
                <>
                  <div className="w-16 h-16 rounded-full bg-violet-100 dark:bg-violet-950/40 flex items-center justify-center">
                    <Mic className="w-7 h-7 text-violet-600" />
                  </div>
                  {prompt && (
                    <p className="text-xs text-violet-600 dark:text-violet-400 text-center max-w-xs font-semibold">
                      ✓ "{prompt.slice(0, 80)}{prompt.length > 80 ? '…' : ''}"
                    </p>
                  )}
                  <p className="text-xs text-slate-500 text-center">
                    {prompt ? 'Press again to add more, or switch to Text to edit' : 'Press Start and describe the job aloud'}
                  </p>
                  <button
                    onClick={startListening}
                    className="px-6 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-xs font-bold transition-all"
                  >
                    {prompt ? 'Add More Voice' : 'Start Speaking'}
                  </button>
                  {prompt && (
                    <button
                      onClick={handleGenerate}
                      disabled={loading}
                      className="px-6 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-violet-500/20 disabled:opacity-50 flex items-center gap-2"
                    >
                      {loading ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Generating…</> : <><Sparkles className="w-3.5 h-3.5" /> Generate Scope</>}
                    </button>
                  )}
                </>
              )}
            </div>
          )}

          {/* Photo mode */}
          {mode === 'photo' && (
            <div className="space-y-3">
              {photoPreview ? (
                <div className="relative rounded-xl overflow-hidden border border-slate-200 dark:border-navy-700">
                  <img src={photoPreview} alt="Job site" className="w-full h-40 object-cover" />
                  <button
                    onClick={() => { setPhotoPreview(null); setPhotoBase64(null); }}
                    className="absolute top-2 right-2 w-6 h-6 bg-black/50 rounded-full flex items-center justify-center hover:bg-black/70 transition-colors"
                  >
                    <X className="w-3 h-3 text-white" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full h-32 rounded-xl border-2 border-dashed border-slate-300 dark:border-navy-700 flex flex-col items-center justify-center gap-2 hover:border-violet-400 hover:bg-violet-50/30 dark:hover:bg-violet-950/10 transition-all"
                >
                  <Image className="w-6 h-6 text-slate-400" />
                  <span className="text-xs text-slate-400">Tap to upload a job site photo</span>
                </button>
              )}
              <input ref={fileInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhotoSelect} />
              {photoPreview && (
                <textarea
                  value={prompt}
                  onChange={e => setPrompt(e.target.value)}
                  rows={2}
                  placeholder="Optional: Add context about what needs to be done..."
                  className="w-full px-3 py-2.5 bg-slate-50 dark:bg-navy-950/40 border border-slate-200 dark:border-navy-800 rounded-xl text-xs text-slate-700 dark:text-slate-300 placeholder-slate-400 focus:ring-1 focus:ring-violet-500/40 resize-none"
                />
              )}
            </div>
          )}

          {/* Generated summary */}
          {generatedSummary && (
            <div className="bg-violet-50 dark:bg-violet-950/20 border border-violet-200 dark:border-violet-800/40 rounded-xl p-3">
              <div className="text-xs font-bold text-violet-700 dark:text-violet-300 mb-1">AI Homeowner Summary</div>
              <p className="text-xs text-violet-600 dark:text-violet-400 leading-relaxed">{generatedSummary}</p>
            </div>
          )}

          {/* Generate button (text & photo modes) */}
          {mode !== 'voice' && (
            <button
              id="ai-generate-btn"
              onClick={handleGenerate}
              disabled={loading || (!prompt.trim() && !photoBase64)}
              className="w-full py-3 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-violet-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Generating scope...</>
              ) : (
                <><Sparkles className="w-3.5 h-3.5" /> Generate Scope with AI</>
              )}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

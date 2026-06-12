import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Send, Mic, MicOff, Volume2, Loader2, Plus, Trash2,
  MessageSquare, BookOpen, Search, X, ChevronLeft, Menu,
  Sparkles, BrainCircuit,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Card } from '@/components/ui/card';
import { Portal } from '@/components/portal';
import { supabase } from '@/lib/supabase';
import { trackAiUsage } from '@/lib/ai-tracker';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import type { ChatSession, ChatMessage } from '@/lib/types';

// ===== Question selector modal =====
function QuestionSelectorModal({
  open,
  onClose,
  onSelect,
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (stem: string) => void;
}) {
  const [banks, setBanks] = useState<any[]>([]);
  const [questions, setQuestions] = useState<any[]>([]);
  const [selectedBank, setSelectedBank] = useState<string>('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    supabase.from('banks').select('id, title').order('created_at', { ascending: false }).then(({ data }) => {
      setBanks(data || []);
      if (data && data.length > 0) {
        setSelectedBank(data[0].id);
      }
    });
  }, [open]);

  useEffect(() => {
    if (!selectedBank) return;
    setLoading(true);
    const q = supabase.from('questions').select('id, content, type, options').eq('bank_id', selectedBank);
    if (search) q.ilike('content', `%${search}%`);
    q.order('created_at', { ascending: false }).limit(50).then(({ data }) => {
      setQuestions(data || []);
      setLoading(false);
    });
  }, [selectedBank, search]);

  if (!open) return null;

  const typeLabel = (t: string) => ({ SINGLE: '单选', MULTIPLE: '多选', TRUE_FALSE: '判断', FILL_BLANK: '填空', SHORT_ANSWER: '简答' } as Record<string, string>)[t] || t;

  return (
    <Portal>
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
        <div className="relative bg-background rounded-xl shadow-2xl border border-border w-full max-w-lg mx-4 max-h-[80vh] flex flex-col">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <h2 className="font-semibold">选择题</h2>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
          </div>
          {/* Bank tabs */}
          <div className="flex gap-1.5 px-5 py-3 border-b border-border/50 overflow-x-auto">
            {banks.map((b) => (
              <button
                key={b.id}
                onClick={() => setSelectedBank(b.id)}
                className={`px-3 py-1.5 rounded-full text-xs whitespace-nowrap transition-colors ${
                  selectedBank === b.id
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/70'
                }`}
              >
                {b.title}
              </button>
            ))}
          </div>
          {/* Search */}
          <div className="px-5 py-3 border-b border-border/50">
            <div className="relative">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="搜索题目..."
                className="pl-9 text-sm"
              />
            </div>
          </div>
          {/* Questions list */}
          <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
            {loading ? (
              <Skeleton type="text" className="h-12" />
            ) : questions.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-8">暂无题目</p>
            ) : (
              questions.map((q) => (
                <button
                  key={q.id}
                  onClick={() => {
                    const text = `请帮我解答这道${typeLabel(q.type)}题：\n${q.content}${q.options?.length ? '\n选项：' + q.options.join('；') : ''}`;
                    onSelect(text);
                    onClose();
                  }}
                  className="w-full text-left px-3 py-2.5 rounded-lg border border-border hover:border-primary/30 hover:bg-accent/50 transition-colors text-sm"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="outline" className="text-xs">{typeLabel(q.type)}</Badge>
                  </div>
                  <p className="line-clamp-2 text-muted-foreground">{q.content}</p>
                </button>
              ))
            )}
          </div>
        </div>
      </div>
    </Portal>
  );
}

// ===== Main Component =====
export function AiChat() {
  const navigate = useNavigate();
  const { user } = useSupabaseAuth();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sessions
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Messages
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [streamContent, setStreamContent] = useState('');

  // Question selector
  const [questionModalOpen, setQuestionModalOpen] = useState(false);

  // Voice
  const [recording, setRecording] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Init
  useEffect(() => {
    if (!user) return;
    loadSessions();
  }, [user]);

  useEffect(() => {
    if (activeSessionId) {
      loadMessages(activeSessionId);
    } else {
      setMessages([]);
    }
  }, [activeSessionId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamContent]);

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const loadSessions = async () => {
    const { data } = await supabase
      .from('chat_sessions')
      .select('*')
      .order('created_at', { ascending: false });
    if (data && data.length > 0) {
      setSessions(data);
      setActiveSessionId(data[0].id);
    }
  };

  const loadMessages = async (sessionId: string) => {
    const { data } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });
    setMessages(data || []);
  };

  const createSession = async (): Promise<string> => {
    const { data, error } = await supabase
      .from('chat_sessions')
      .insert({ title: '新对话' })
      .select('id')
      .single();
    if (error) throw error;
    setSessions((prev) => [data as ChatSession, ...prev]);
    return data.id;
  };

  const deleteSession = async (id: string) => {
    await supabase.from('chat_sessions').delete().eq('id', id);
    setSessions((prev) => prev.filter((s) => s.id !== id));
    if (activeSessionId === id) {
      const remaining = sessions.filter((s) => s.id !== id);
      setActiveSessionId(remaining[0]?.id || null);
    }
  };

  const appendMessage = async (sessionId: string, role: 'user' | 'assistant' | 'system', content: string, questionId?: string) => {
    const { data, error } = await supabase
      .from('chat_messages')
      .insert({ session_id: sessionId, role, content, question_id: questionId || null })
      .select('*')
      .single();
    if (error) throw error;
    return data as ChatMessage;
  };

  const handleSend = async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || streaming) return;

    if (!user?.ai_configured) {
      alert('请先在个人主页配置 AI 服务商和 API Key');
      return;
    }

    setInput('');
    let sessionId = activeSessionId;

    try {
      // Create session if needed
      if (!sessionId) {
        sessionId = await createSession();
        setActiveSessionId(sessionId);
      }

      // Save user message
      const userMsg = await appendMessage(sessionId, 'user', content);
      setMessages((prev) => [...prev, userMsg]);

      // Stream AI response
      setStreaming(true);
      setStreamContent('');

      const baseUrl = user.ai_base_url.replace(/\/$/, '');
      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${user.ai_api_key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: user.ai_model,
          messages: [
            { role: 'system', content: '你是一个智能学习助手，帮助用户解答题目、理解知识点。请用中文回答，回答准确、简洁、友好。' },
            ...messages.filter(m => m.role !== 'system').map(m => ({ role: m.role, content: m.content })),
            { role: 'user', content },
          ],
          stream: true,
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`API 错误 (${res.status}): ${errText.slice(0, 200)}`);
      }

      // Read SSE stream
      const reader = res.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let fullContent = '';
      let usage: any = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n').filter((l) => l.startsWith('data: '));

        for (const line of lines) {
          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') continue;
          try {
            const json = JSON.parse(jsonStr);
            const delta = json.choices?.[0]?.delta?.content;
            if (delta) {
              fullContent += delta;
              setStreamContent(fullContent);
            }
            if (json.usage) usage = json.usage;
          } catch { /* skip malformed */ }
        }
      }

      // Save assistant message
      const assistantMsg = await appendMessage(sessionId, 'assistant', fullContent);
      setStreamContent('');
      setMessages((prev) => [...prev, assistantMsg]);

      // Update session title from first exchange
      const userMsgCount = messages.filter(m => m.role === 'user').length;
      if (userMsgCount === 0) {
        const title = content.slice(0, 20) + (content.length > 20 ? '...' : '');
        await supabase.from('chat_sessions').update({ title }).eq('id', sessionId);
        setSessions((prev) => prev.map(s => s.id === sessionId ? { ...s, title } : s));
      }

      // Track usage
      if (usage) {
        trackAiUsage('chat', { usage, model: user.ai_model }, user.ai_model);
      }
    } catch (err: any) {
      alert(err.message || '发送失败');
      setStreamContent('');
    } finally {
      setStreaming(false);
    }
  };

  // ===== Voice Input (ASR) =====
  const startRecording = async () => {
    if (!user?.mimo_configured) {
      alert('请先在个人主页配置 MiMo API Key');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        // Stop all tracks
        stream.getTracks().forEach(t => t.stop());
        setRecording(false);

        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        if (blob.size < 100) return; // too small, ignore

        try {
          // Convert to base64
          const buffer = await blob.arrayBuffer();
          const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));

          // Call MiMo ASR via proxy
          const res = await fetch('/api/mimo-proxy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              apiKey: user.mimo_api_key,
              model: 'mimo-v2.5-asr',
              messages: [
                {
                  role: 'user',
                  content: [
                    {
                      type: 'input_audio',
                      input_audio: {
                        data: `data:audio/webm;base64,${base64}`,
                      },
                    },
                  ],
                },
              ],
              asr_options: { language: 'auto' },
            }),
          });

          if (!res.ok) throw new Error(`ASR 错误 ${res.status}`);
          const json = await res.json();
          const transcript = json.choices?.[0]?.message?.content;
          if (transcript) {
            setInput((prev) => prev + transcript);
          }
        } catch (err: any) {
          alert('语音识别失败: ' + (err.message || '未知错误'));
        }
      };

      recorder.start();
      setRecording(true);
    } catch (err: any) {
      if (err.name === 'NotAllowedError') {
        alert('麦克风权限被拒绝，请在浏览器设置中允许访问麦克风');
      } else {
        alert('无法启动录音: ' + (err.message || '未知错误'));
      }
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  };

  // ===== Voice Output (TTS) =====
  const playTTS = async (text: string, msgId: string) => {
    if (!user?.mimo_configured) {
      alert('请先在个人主页配置 MiMo API Key');
      return;
    }
    if (playingId) {
      // Stop current playback
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    }
    if (playingId === msgId) {
      setPlayingId(null);
      return;
    }

    setPlayingId(msgId);
    try {
      const res = await fetch('/api/mimo-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: user.mimo_api_key,
          model: 'mimo-v2.5-tts',
          messages: [
            { role: 'user', content: '用自然温和的语调朗读' },
            { role: 'assistant', content: text },
          ],
          audio: { format: 'wav', voice: '冰糖' },
        }),
      });

      if (!res.ok) throw new Error(`TTS 错误 ${res.status}`);
      const json = await res.json();
      const audioBase64 = json.choices?.[0]?.message?.audio?.data;
      if (!audioBase64) throw new Error('No audio data');

      // Decode and play
      const binaryStr = atob(audioBase64);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
      const blob = new Blob([bytes], { type: 'audio/wav' });
      const url = URL.createObjectURL(blob);

      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => {
        setPlayingId(null);
        URL.revokeObjectURL(url);
        audioRef.current = null;
      };
      audio.onerror = () => {
        setPlayingId(null);
        URL.revokeObjectURL(url);
        audioRef.current = null;
      };
      await audio.play();
    } catch (err: any) {
      alert('语音合成失败: ' + (err.message || '未知错误'));
      setPlayingId(null);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // ===== Render =====
  if (!user) {
    return (
      <div className="page-container max-w-3xl">
        <Card className="p-8 text-center">
          <p className="text-muted-foreground">请先登录</p>
          <Button variant="outline" className="mt-4" onClick={() => navigate('/login')}>去登录</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] max-w-[1400px] mx-auto">
      {/* Sidebar */}
      <div className={`${sidebarOpen ? 'w-64' : 'w-0'} flex-shrink-0 border-r border-border bg-muted/20 transition-all duration-300 overflow-hidden flex flex-col`}>
        <div className="p-3 border-b border-border">
          <Button
            size="sm"
            className="w-full"
            onClick={async () => {
              try {
                const id = await createSession();
                setActiveSessionId(id);
              } catch { alert('创建失败'); }
            }}
          >
            <Plus className="h-4 w-4 mr-1" /> 新对话
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {sessions.map((s) => (
            <div
              key={s.id}
              className={`group flex items-center gap-1 px-3 py-2 rounded-lg cursor-pointer transition-colors text-sm ${
                s.id === activeSessionId
                  ? 'bg-primary/10 text-primary font-medium'
                  : 'hover:bg-accent text-muted-foreground'
              }`}
              onClick={() => setActiveSessionId(s.id)}
            >
              <MessageSquare className="h-3.5 w-3.5 flex-shrink-0" />
              <span className="truncate flex-1">{s.title}</span>
              <button
                className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all"
                onClick={(e) => { e.stopPropagation(); deleteSession(s.id); }}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          {sessions.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-8">暂无对话记录</p>
          )}
        </div>
      </div>

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
          <button
            className="text-muted-foreground hover:text-foreground"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            title={sidebarOpen ? '收起侧栏' : '展开侧栏'}
          >
            {sidebarOpen ? <ChevronLeft className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="font-semibold text-sm">AI 学习助手</span>
          {!user.ai_configured && (
            <Badge variant="warning" className="text-xs">
              未配置 AI — <button className="underline" onClick={() => navigate('/profile')}>去配置</button>
            </Badge>
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6">
          {messages.length === 0 && !streaming && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                <BrainCircuit className="h-8 w-8 text-primary" />
              </div>
              <h2 className="text-lg font-semibold mb-2">AI 学习助手</h2>
              <p className="text-sm text-muted-foreground max-w-sm mb-4">
                你可以直接提问，或选择题让 AI 帮你解答。支持语音输入和语音播报。
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setQuestionModalOpen(true)}>
                  <BookOpen className="h-4 w-4 mr-1" /> 选择题
                </Button>
              </div>
            </div>
          )}

          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                  msg.role === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'glass-card border border-border'
                }`}
              >
                {msg.content}
                {msg.role === 'assistant' && (
                  <div className="mt-2 pt-2 border-t border-border/50 flex items-center gap-2">
                    <button
                      className={`text-xs flex items-center gap-1 transition-colors ${
                        playingId === msg.id
                          ? 'text-primary font-medium'
                          : 'text-muted-foreground hover:text-primary'
                      }`}
                      onClick={() => playTTS(msg.content, msg.id)}
                      title={playingId === msg.id ? '停止播放' : '语音播报'}
                    >
                      <Volume2 className="h-3.5 w-3.5" />
                      {playingId === msg.id ? '播放中...' : '播报'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* Streaming indicator */}
          {streaming && (
            <div className="flex justify-start">
              <div className="max-w-[80%] rounded-2xl px-4 py-3 text-sm glass-card border border-border">
                {streamContent ? (
                  <span className="whitespace-pre-wrap">{streamContent}<span className="animate-pulse">▌</span></span>
                ) : (
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    思考中...
                  </div>
                )}
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input area */}
        <div className="px-4 py-3 border-t border-border">
          <div className="flex items-center gap-2">
            <button
              className={`flex-shrink-0 p-2.5 rounded-full transition-colors ${
                recording
                  ? 'bg-red-500 text-white animate-pulse'
                  : user.mimo_configured
                    ? 'text-muted-foreground hover:text-primary hover:bg-primary/10'
                    : 'text-muted-foreground/30 cursor-not-allowed'
              }`}
              onMouseDown={startRecording}
              onMouseUp={stopRecording}
              onMouseLeave={stopRecording}
              onTouchStart={startRecording}
              onTouchEnd={stopRecording}
              title={recording ? '录音中...' : user.mimo_configured ? '语音输入（按住说话）' : '请先配置 MiMo Key'}
              disabled={!user.mimo_configured}
            >
              {recording ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </button>

            <button
              className="flex-shrink-0 p-2.5 rounded-full text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
              onClick={() => setQuestionModalOpen(true)}
              title="选择题"
            >
              <BookOpen className="h-4 w-4" />
            </button>

            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={recording ? '录音中...' : '输入消息，或选择题...'}
              className="flex-1"
              disabled={streaming || recording}
            />

            <button
              className={`flex-shrink-0 p-2.5 rounded-full transition-colors ${
                streaming || !input.trim() || !user.ai_configured
                  ? 'text-muted-foreground/30 cursor-not-allowed'
                  : 'text-primary hover:bg-primary/10'
              }`}
              onClick={() => handleSend()}
              disabled={streaming || !input.trim() || !user.ai_configured}
              title="发送"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Question selector modal */}
      <QuestionSelectorModal
        open={questionModalOpen}
        onClose={() => setQuestionModalOpen(false)}
        onSelect={(text) => {
          setInput(text);
          inputRef.current?.focus();
        }}
      />
    </div>
  );
}

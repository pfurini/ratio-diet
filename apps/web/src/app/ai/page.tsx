'use client';

import { useUIMessages, useSmoothText } from '@convex-dev/agent/react';
import type { UIMessage } from '@convex-dev/agent/react';
import { api } from '@ratio-diet/backend/convex/_generated/api';
import { Button } from '@ratio-diet/ui/components/button';
import { Input } from '@ratio-diet/ui/components/input';
import { useMutation } from 'convex/react';
import { Send, Loader2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { toast } from 'sonner';
import { Streamdown } from 'streamdown';

const MessageContent = ({ text, isStreaming }: { text: string; isStreaming: boolean }) => {
  const [visibleText] = useSmoothText(text, {
    startStreaming: isStreaming,
  });
  return <Streamdown>{visibleText}</Streamdown>;
};

const useChatActions = () => {
  const [threadId, setThreadId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const createThread = useMutation(api.chat.createNewThread);
  const sendMessage = useMutation(api.chat.sendMessage);

  const ensureThreadId = async () => {
    if (threadId) {
      return threadId;
    }
    const newThreadId = await createThread();
    setThreadId(newThreadId);
    return newThreadId;
  };

  const submitPrompt = async (prompt: string) => {
    setIsLoading(true);
    try {
      const currentThreadId = await ensureThreadId();
      await sendMessage({ prompt, threadId: currentThreadId });
    } catch (error) {
      console.error('Failed to send message:', error);
      toast.error('Failed to send message. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return { isLoading, submitPrompt, threadId };
};

const AIPage = () => {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { threadId, isLoading, submitPrompt } = useChatActions();

  const { results: messages } = useUIMessages(api.chat.listMessages, threadId ? { threadId } : 'skip', {
    initialNumItems: 50,
    stream: true,
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const hasStreamingMessage = messages?.some((m: UIMessage) => m.status === 'streaming');

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || isLoading) {
      return;
    }

    setInput('');
    await submitPrompt(text);
  };

  return (
    <div className="grid grid-rows-[1fr_auto] overflow-hidden w-full mx-auto p-4">
      <div className="overflow-y-auto space-y-4 pb-4">
        {!messages || messages.length === 0 ? (
          <div className="text-center text-muted-foreground mt-8">Ask me anything to get started!</div>
        ) : (
          messages.map((message: UIMessage) => (
            <div
              key={message.key}
              className={`p-3 rounded-lg ${message.role === 'user' ? 'bg-primary/10 ml-8' : 'bg-secondary/20 mr-8'}`}
            >
              <p className="text-sm font-semibold mb-1">{message.role === 'user' ? 'You' : 'AI Assistant'}</p>
              <MessageContent text={message.text ?? ''} isStreaming={message.status === 'streaming'} />
            </div>
          ))
        )}
        {isLoading && !hasStreamingMessage && (
          <div className="p-3 rounded-lg bg-secondary/20 mr-8">
            <p className="text-sm font-semibold mb-1">AI Assistant</p>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Thinking...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSubmit} className="w-full flex items-center space-x-2 pt-2 border-t">
        <Input
          name="prompt"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type your message..."
          className="flex-1"
          autoComplete="off"
          autoFocus
          disabled={isLoading}
        />
        <Button type="submit" size="icon" disabled={isLoading || !input.trim()}>
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send size={18} />}
        </Button>
      </form>
    </div>
  );
};

export default AIPage;

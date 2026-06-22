import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { Icons } from '../components/Icons';
import { api } from '../services/api';

/**
 * Custom Lightweight Markdown Parser to render beautiful, styled typography
 * matching ChatGPT's rich text presentation.
 */
const renderMessageContent = (text) => {
  if (!text) return null;

  const lines = text.split('\n');

  return lines.map((line, idx) => {
    let content = line;

    // Parse bold text
    content = content.replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-white">$1</strong>');
    
    // Parse inline code blocks
    content = content.replace(/`(.*?)`/g, '<code class="bg-[#2f2f2f] px-1.5 py-0.5 rounded text-white font-mono text-[13px] break-all">$1</code>');

    // Parse headers
    if (content.startsWith('### ')) {
      return (
        <h3 key={idx} className="text-sm font-bold text-white mt-4 mb-2 tracking-tight flex items-center gap-1.5 break-words">
          <span className="w-1 h-3.5 bg-indigo-500 rounded" />
          {content.replace('### ', '')}
        </h3>
      );
    }
    if (content.startsWith('## ')) {
      return (
        <h2 key={idx} className="text-base font-bold text-indigo-400 mt-5 mb-2.5 tracking-tight border-b border-[#212121] pb-1 break-words">
          {content.replace('## ', '')}
        </h2>
      );
    }
    if (content.startsWith('# ')) {
      return (
        <h1 key={idx} className="text-lg font-extrabold text-white mt-6 mb-3 tracking-tight break-words">
          {content.replace('# ', '')}
        </h1>
      );
    }

    // Parse bullet points
    if (content.startsWith('- ') || content.startsWith('* ')) {
      const bulletText = content.substring(2);
      return (
        <li
          key={idx}
          className="list-disc ml-6 my-1.5 text-slate-200 text-[15px] leading-relaxed break-words"
          dangerouslySetInnerHTML={{ __html: bulletText }}
        />
      );
    }

    // Parse numbered lists
    if (/^\d+\.\s/.test(content)) {
      const listText = content.replace(/^\d+\.\s/, '');
      return (
        <li
          key={idx}
          className="list-decimal ml-6 my-1.5 text-slate-200 text-[15px] leading-relaxed break-words"
          dangerouslySetInnerHTML={{ __html: listText }}
        />
      );
    }

    if (!content.trim()) {
      return <div key={idx} className="h-3" />;
    }

    return (
      <p
        key={idx}
        className="my-1.5 text-slate-200 text-[15px] leading-relaxed break-words"
        dangerouslySetInnerHTML={{ __html: content }}
      />
    );
  });
};

/**
 * Message typing effect component for streaming-like text animations
 */
const TypewriterMessage = ({ content, onComplete }) => {
  const [displayedText, setDisplayedText] = useState('');
  const indexRef = useRef(0);

  useEffect(() => {
    setDisplayedText('');
    indexRef.current = 0;

    const interval = setInterval(() => {
      if (indexRef.current < content.length) {
        setDisplayedText((prev) => prev + content.charAt(indexRef.current));
        indexRef.current += 1;
      } else {
        clearInterval(interval);
        if (onComplete) onComplete();
      }
    }, 5); // Smooth typing interval

    return () => clearInterval(interval);
  }, [content]);

  return <div>{renderMessageContent(displayedText)}</div>;
};

export const AiAdvisor = () => {
  const { user, addNotification } = useApp();
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [insights, setInsights] = useState(null);
  const [activeTypingIndex, setActiveTypingIndex] = useState(null);

  // Responsive sidebar toggles (closes by default on smaller viewports)
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth >= 1024);
  const [activeSession, setActiveSession] = useState('live-chat');
  const messagesEndRef = useRef(null);

  // Resize listener to auto-adjust sidebar visibility
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1024) {
        setSidebarOpen(false);
      } else {
        setSidebarOpen(true);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Load chat session logs and financial profile
  useEffect(() => {
    fetchHistory();
    fetchInsights();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const fetchHistory = async () => {
    try {
      const history = await api.aiAdvisor.getHistory();
      setMessages(history || []);
    } catch (err) {
      console.error('Failed to load chat history:', err);
    }
  };

  const fetchInsights = async () => {
    try {
      const data = await api.aiAdvisor.getInsights();
      setInsights(data);
    } catch (err) {
      console.error('Failed to load financial insights:', err);
    }
  };

  const handleSendMessage = async (text) => {
    if (!text.trim() || isLoading) return;

    const userMsgText = text.trim();
    setInputMessage('');
    setIsLoading(true);

    const localUserMsg = { sender: 'user', content: userMsgText, timestamp: new Date() };
    setMessages((prev) => [...prev, localUserMsg]);

    try {
      const historyPayload = messages.map((m) => ({
        sender: m.sender,
        content: m.content,
      }));

      const res = await api.aiAdvisor.chat(userMsgText, historyPayload);

      const assistantMsgIndex = messages.length + 1;
      setActiveTypingIndex(assistantMsgIndex);

      setMessages((prev) => [
        ...prev,
        {
          sender: 'assistant',
          content: res.response,
          confidence: res.confidence || 0.9,
          timestamp: new Date(),
          followUps: res.followUpSuggestions || [],
        },
      ]);

      fetchInsights();
    } catch (err) {
      console.error('Advisor request failed:', err);
      addNotification('Advisor failed to respond: ' + err.message, 'error');

      setMessages((prev) => [
        ...prev,
        {
          sender: 'assistant',
          content: 'Sorry, I encountered an error communicating with the financial advisory server. Please ensure your backend is online and try again.',
          timestamp: new Date(),
          isFailed: true,
          failedText: userMsgText,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const clearChatHistory = async () => {
    if (!window.confirm('Are you sure you want to clear your conversation history?')) return;
    try {
      await api.aiAdvisor.clearHistory();
      setMessages([]);
      addNotification('Conversation history cleared successfully.', 'success');
    } catch (err) {
      addNotification('Failed to clear history: ' + err.message, 'error');
    }
  };

  const exportAdviceReport = () => {
    if (messages.length === 0) return;

    let report = `# SpendWise AI Financial Advisor Report\n`;
    report += `Generated on: ${new Date().toLocaleString()}\n`;
    report += `===========================================\n\n`;

    if (insights) {
      report += `## Financial Health Profile Summary\n`;
      report += `- **Financial Health Score**: ${insights.healthScore}/100\n`;
      report += `- **Monthly Savings Rate**: ${insights.summary.savingsRate.toFixed(1)}%\n`;
      report += `- **Current Savings Margin**: ₹${insights.summary.netSavings.toLocaleString()}\n`;
      report += `- **Identified Active Risks**: ${insights.risks.length} active risks\n\n`;
    }

    report += `## Chat Transcript\n`;
    messages.forEach((m) => {
      const senderName = m.sender === 'user' ? 'User' : 'SpendWise AI Advisor';
      report += `### ${senderName} (${new Date(m.timestamp).toLocaleTimeString()})\n`;
      report += `${m.content}\n\n`;
    });

    const blob = new Blob([report], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `SpendWise_Financial_Advice_${new Date().toISOString().slice(0, 10)}.md`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    addNotification('Advisory transcript downloaded successfully!', 'success');
  };

  const chatSessions = [
    { id: 'live-chat', title: 'Active Advisory Chat', sub: 'Connected with MDB Logs', isLive: true },
    { id: 'savings-strat', title: 'Savings Rate Strategy', sub: 'Rule Engine Mock Summary', isLive: false, summary: 'Recommendation blueprint suggesting 15% reduction in Food spends and scaling emergency reserves to ₹50,000.' },
    { id: 'subscription-audit', title: 'Subscription Audit Summary', sub: 'Recurring Rules Check', isLive: false, summary: 'Evaluation flagged that recurring charges exceed 15% of inflows. Recommendation: Cancelling duplicate cloud subscriptions generates ₹1,200 monthly margin.' },
  ];

  const handleSessionChange = (sessId) => {
    setActiveSession(sessId);
    if (sessId === 'live-chat') {
      fetchHistory();
    } else {
      const selected = chatSessions.find(s => s.id === sessId);
      setMessages([
        {
          sender: 'assistant',
          content: selected.summary,
          timestamp: new Date(),
          confidence: 0.85
        }
      ]);
    }
  };

  const presetChips = [
    { text: '🔍 Analyze my spending', prompt: 'Analyze my spending habits' },
    { text: '💰 How can I save more?', prompt: 'How can I save more money?' },
    { text: '⚠️ Check budget risks', prompt: 'Find my active budget risks' },
  ];

  return (
    <div className="flex bg-[#171717] overflow-hidden h-full w-full animate-fade-in relative">
      
      {/* 1. Left Sidebar (ChatGPT-style session index with responsive widths) */}
      <aside className={`border-r border-[#212121] bg-[#0d0d0d] p-3.5 flex flex-col justify-between flex-shrink-0 z-10 transition-all duration-300 ${
        sidebarOpen ? 'w-60 opacity-100' : 'w-0 p-0 opacity-0 overflow-hidden border-r-0'
      }`}>
        <div className="space-y-4 flex-1 overflow-y-auto min-h-0">
          {/* New Chat Button */}
          <button
            onClick={() => handleSessionChange('live-chat')}
            className="flex items-center justify-between w-full px-4 py-2.5 bg-[#212121] hover:bg-[#2f2f2f] border border-[#2f2f2f] hover:border-slate-700 rounded-xl text-white text-xs font-bold transition duration-200"
          >
            <span>New Chat</span>
            <Icons.Plus className="w-3.5 h-3.5" />
          </button>

          {/* Session List */}
          <div className="space-y-2 pt-2">
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest px-2 block">Conversations</span>
            {chatSessions.map((sess) => {
              const isActive = activeSession === sess.id;
              return (
                <button
                  key={sess.id}
                  onClick={() => handleSessionChange(sess.id)}
                  className={`flex flex-col items-start w-full px-3 py-2 rounded-xl transition duration-150 text-left border ${
                    isActive 
                      ? 'bg-[#212121] border-transparent shadow-sm' 
                      : 'bg-transparent border-transparent hover:bg-[#212121]/50 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <span className={`text-[12px] font-medium leading-tight truncate w-full ${isActive ? 'text-white font-semibold' : 'text-slate-300'}`}>
                    {sess.title}
                  </span>
                  <span className="text-[10px] text-slate-500 mt-0.5 font-normal truncate w-full">
                    {sess.sub}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Info panel at bottom of sidebar */}
        {insights && (
          <div className="border-t border-[#212121] pt-4 mt-auto space-y-2">
            <div className="flex items-center justify-between text-[10px] text-slate-500 font-bold uppercase tracking-wider">
              <span>Financial Health</span>
              <span className={insights.healthScore >= 70 ? 'text-emerald-400' : 'text-amber-400'}>
                {insights.healthScore}/100
              </span>
            </div>
            <div className="w-full h-1 bg-[#212121] rounded-full overflow-hidden">
              <div 
                className="h-full bg-indigo-500 transition-all duration-300"
                style={{ width: `${insights.healthScore}%` }}
              />
            </div>
          </div>
        )}
      </aside>

      {/* 2. Main Chat Panel (Immersive ChatGPT layout, bounds constraints to prevent overflows) */}
      <div className="flex-1 flex flex-col justify-between bg-transparent min-w-0 z-10 h-full min-h-0">
        
        {/* Chat Top Nav */}
        <header className="px-6 py-3 border-b border-[#212121] bg-[#171717] flex items-center justify-between flex-shrink-0">
          <div className="flex items-center space-x-2">
            {/* Sidebar toggle button */}
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-1.5 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-[#212121] transition-colors mr-1 focus:outline-none"
              title="Toggle sidebar"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <line x1="9" y1="3" x2="9" y2="21" />
              </svg>
            </button>
            <span className="text-sm font-semibold text-white bg-transparent px-1 py-1 flex items-center gap-1">
              SpendWise Advisor <span className="text-[10px] bg-[#212121] text-slate-400 px-1.5 py-0.5 rounded font-mono font-bold">2.5</span>
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          </div>

          <div className="flex items-center space-x-2">
            {messages.length > 0 && activeSession === 'live-chat' && (
              <>
                <button
                  onClick={exportAdviceReport}
                  className="text-xs text-slate-350 hover:text-white font-medium px-3 py-1.5 rounded-lg bg-[#212121] hover:bg-[#2f2f2f] border border-[#2f2f2f] transition duration-200"
                >
                  Export Report
                </button>
                <button
                  onClick={clearChatHistory}
                  className="text-xs text-rose-455 hover:text-rose-400 font-medium px-3 py-1.5 rounded-lg bg-[#212121] hover:bg-[#2f2f2f] border border-[#2f2f2f] transition duration-200"
                >
                  Clear Chat
                </button>
              </>
            )}
          </div>
        </header>

        {/* Message Lane (Constrained to scroll internally within parent height bounds) */}
        <div className="flex-1 overflow-y-auto px-6 py-6 min-h-0 bg-[#171717]">
          <div className="max-w-2xl mx-auto space-y-6">
            
            {/* Show Empty state */}
            {messages.length === 0 && (
              <div className="py-20 text-center space-y-5">
                <div className="inline-flex bg-[#212121] border border-[#2f2f2f] p-4 rounded-full text-indigo-400 shadow-lg">
                  <Icons.Sparkles className="w-8 h-8 text-white" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-bold text-white tracking-tight">How can I help you, {user ? user.name : 'User'}?</h3>
                  <p className="text-sm text-slate-400 max-w-md mx-auto leading-relaxed font-normal">
                    I am your dedicated private wealth copilot, fully integrated with your SpendWise database. Ask me to audit your categories, detect anomalies, or forecast your savings.
                  </p>
                </div>
              </div>
            )}

            {/* Chat Messages */}
            {messages.map((msg, index) => {
              const isUser = msg.sender === 'user';
              const isTyping = activeTypingIndex === index;

              if (isUser) {
                return (
                  <div key={index} className="flex justify-end animate-fade-in">
                    <div className="bg-[#2f2f2f] text-white px-5 py-2.5 rounded-[24px] max-w-[70%] ml-auto w-fit break-words whitespace-pre-wrap text-[15px] font-normal shadow-sm">
                      {msg.content}
                    </div>
                  </div>
                );
              }

              return (
                <div key={index} className="flex gap-4 items-start justify-start animate-fade-in">
                  {/* Assistant Avatar */}
                  <div className="w-7 h-7 rounded-full bg-[#212121] border border-[#2f2f2f] text-white flex items-center justify-center flex-shrink-0 mt-1 shadow-sm">
                    <Icons.Sparkles className="w-3.5 h-3.5" />
                  </div>

                  {/* AI Content */}
                  <div className="flex-1 min-w-0">
                    <div className="text-slate-200 text-[15px] leading-relaxed space-y-2">
                      {isTyping ? (
                        <TypewriterMessage 
                          content={msg.content} 
                          onComplete={() => setActiveTypingIndex(null)}
                        />
                      ) : (
                        <div>{renderMessageContent(msg.content)}</div>
                      )}

                      {/* Retry trigger */}
                      {msg.isFailed && (
                        <button
                          onClick={() => handleSendMessage(msg.failedText)}
                          className="mt-3 px-3 py-1.5 bg-rose-600/20 hover:bg-rose-600/30 border border-rose-500/20 text-[10px] text-rose-300 font-bold rounded-lg transition"
                        >
                          🔄 Retry message
                        </button>
                      )}
                    </div>

                    {/* Meta parameters (confidence and followups) */}
                    {!isTyping && (
                      <div className="mt-3 space-y-2.5">
                        {/* Confidence score */}
                        {msg.confidence && (
                          <div className="flex items-center gap-1.5 text-[8px] text-slate-500 font-bold uppercase tracking-wider">
                            <span>Confidence:</span>
                            <div className="flex gap-0.5">
                              {[...Array(5)].map((_, i) => (
                                <div 
                                  key={i} 
                                  className={`w-1.5 h-1.5 rounded-full ${i < Math.round(msg.confidence * 5) ? 'bg-indigo-500' : 'bg-slate-800'}`} 
                                />
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Inline follow-up query buttons */}
                        {msg.followUps && msg.followUps.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 pt-0.5">
                            {msg.followUps.map((followUp, fIdx) => (
                              <button
                                key={fIdx}
                                onClick={() => handleSendMessage(followUp)}
                                className="text-xs text-slate-400 hover:text-white bg-[#212121] hover:bg-[#2f2f2f] border border-[#2f2f2f] px-3 py-1.5 rounded-xl transition duration-150 break-words max-w-full"
                              >
                                {followUp}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Spinner typing skeleton */}
            {isLoading && (
              <div className="flex items-start gap-4 animate-pulse">
                <div className="w-7 h-7 rounded-full bg-[#212121] border border-[#2f2f2f] text-white flex items-center justify-center flex-shrink-0 mt-1">
                  <Icons.Sparkles className="w-3.5 h-3.5 animate-pulse" />
                </div>
                <div className="flex-1 text-slate-400 text-[15px] leading-relaxed flex items-center gap-2 mt-1.5">
                  <Icons.Spinner className="w-3.5 h-3.5 text-indigo-500 animate-spin" />
                  <span className="font-semibold tracking-wide uppercase text-[9px] text-slate-500">Advisor compiling logs...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input Panel wrapper */}
        <div className="p-4 bg-[#171717] flex-shrink-0">
          <div className="max-w-2xl mx-auto space-y-3.5">
            
            {/* Quick Prompt chips positioned above the input */}
            {messages.length === 0 && (
              <div className="flex flex-wrap gap-2 justify-center pb-2">
                {presetChips.map((chip, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSendMessage(chip.prompt)}
                    className="text-xs font-semibold text-slate-400 hover:text-white bg-[#212121] hover:bg-[#2f2f2f] border border-[#2f2f2f] rounded-xl px-3 py-1.5 transition duration-200"
                  >
                    {chip.text}
                  </button>
                ))}
              </div>
            )}

            {/* Pill-shaped ChatGPT message input box */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage(inputMessage);
              }}
              className="relative flex items-center bg-[#2f2f2f] border border-transparent rounded-[26px] px-4 py-2.5 shadow-sm"
            >
              <input
                type="text"
                placeholder={isLoading ? 'Advisor is reasoning...' : 'Message SpendWise Advisor...'}
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                disabled={isLoading}
                className="flex-1 bg-transparent border-none text-[15px] text-slate-200 focus:outline-none placeholder-slate-400 disabled:opacity-50 py-1 pr-12"
              />
              <button
                type="submit"
                disabled={isLoading || !inputMessage.trim()}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-2 bg-white text-black disabled:bg-[#212121]/50 disabled:text-slate-600 rounded-full transition duration-200 flex items-center justify-center hover:bg-slate-200 shadow-md"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
                  <line x1="12" y1="19" x2="12" y2="5" />
                  <polyline points="5 12 12 5 19 12" />
                </svg>
              </button>
            </form>

            <span className="text-[10px] text-slate-500 block text-center font-normal tracking-wide">
              SpendWise Advisor can make mistakes. Verify critical financial details.
            </span>
          </div>
        </div>

      </div>
    </div>
  );
};

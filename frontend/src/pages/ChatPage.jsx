import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../hooks/useSocket';
import { userAPI } from '../services/api';
import api from '../services/api';

export default function ChatPage() {
  const { chatId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const socket = useSocket();

  const [chats, setChats] = useState([]);
  const [messages, setMessages] = useState([]);
  const [content, setContent] = useState('');
  const [typingUser, setTypingUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [showEmoji, setShowEmoji] = useState(false);
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  const EMOJIS = ['😀','😂','😍','🥰','😭','😎','🙏','❤️','🔥','✨','💜','🎶','📜','🌹','💫','🥺','😊','🤣','💯','🎉'];

  // ─── Profile se aaya hai to chat auto-open ────────────────────────────────
  useEffect(() => {
    const { userId } = location.state || {};
    if (!userId) return;
    const startChat = async () => {
      try {
        const { data } = await api.post('/chats', { userId });
        navigate(`/chat/${data.chat._id}`, { replace: true });
      } catch (err) {
        console.error('Chat start error:', err);
      }
    };
    startChat();
  }, [location.state]);

  // ─── Inbox load ───────────────────────────────────────────────────────────
  useEffect(() => {
    const fetchChats = async () => {
      try {
        const { data } = await api.get('/chats');
        setChats(data.chats);
      } catch (err) {
        console.error('Chats fetch error:', err);
      }
    };
    fetchChats();
  }, []);

  // ─── Suggested shayers ────────────────────────────────────────────────────
  useEffect(() => {
    const fetchSuggestions = async () => {
      try {
        const { data } = await userAPI.getSuggestions();
        setSuggestions(data.users || data.suggestions || []);
      } catch (err) {
        console.error('Suggestions error:', err);
      }
    };
    fetchSuggestions();
  }, []);

  // ─── Messages load ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!chatId) return;
    const fetchMessages = async () => {
      setLoading(true);
      try {
        const { data } = await api.get(`/messages/${chatId}`);
        setMessages(data.messages);
      } catch (err) {
        console.error('Messages fetch error:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchMessages();
  }, [chatId]);

  // ─── Socket events ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!socket || !chatId) return;
    socket.emit('chat:join', { chatId });

    socket.on('message:new', (message) => {
      if (message.chatId === chatId) {
        setMessages(prev => [...prev, message]);
      }
      setChats(prev => prev.map(c =>
        c._id === message.chatId
          ? { ...c, lastMessage: message, lastMessageAt: message.createdAt }
          : c
      ));
    });

    socket.on('typing:start', ({ userId: tid }) => {
      if (tid !== user._id) setTypingUser(tid);
    });
    socket.on('typing:stop', () => setTypingUser(null));

    return () => {
      socket.off('message:new');
      socket.off('typing:start');
      socket.off('typing:stop');
    };
  }, [socket, chatId, user._id]);

  // ─── Auto scroll ──────────────────────────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ─── Send message ─────────────────────────────────────────────────────────
  const sendMessage = () => {
    if (!content.trim() || !socket || !chatId) return;
    socket.emit('message:send', { chatId, content: content.trim() });
    setContent('');
    setShowEmoji(false);
  };

  // ─── Typing handler ───────────────────────────────────────────────────────
  const handleTyping = (e) => {
    setContent(e.target.value);
    if (!socket || !chatId) return;
    socket.emit('typing:start', { chatId });
    clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('typing:stop', { chatId });
    }, 1500);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // ─── Follow suggestion ────────────────────────────────────────────────────
  const handleFollow = async (id) => {
    try {
      await userAPI.toggleFollow(id);
      setSuggestions(prev => prev.filter(u => u._id !== id));
    } catch (err) {
      console.error('Follow error:', err);
    }
  };

  // ─── Helpers ──────────────────────────────────────────────────────────────
  const getOtherUser = (chat) =>
    chat.participants?.find(p => p._id !== user._id);

  const formatTime = (date) => {
    if (!date) return '';
    const d = new Date(date);
    const now = new Date();
    const diff = now - d;
    if (diff < 60000) return 'just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return d.toLocaleDateString([], { day: '2-digit', month: 'short' });
  };

  const activeChat = chats.find(c => c._id === chatId);
  const otherUser = activeChat ? getOtherUser(activeChat) : null;

  return (
    <div className="flex h-[calc(100vh-4rem)] md:h-screen overflow-hidden"
      style={{ background: 'var(--bg-primary)' }}>

      {/* ── LEFT: Inbox ── */}
      <div className={`${chatId ? 'hidden md:flex' : 'flex'} w-full md:w-80 flex-col border-r`}
        style={{ borderColor: 'var(--border)' }}>

        {/* Header */}
        <div className="p-4 border-b" style={{ borderColor: 'var(--border)' }}>
          <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Messages</h2>
        </div>

        {/* Chat list */}
        <div className="flex-1 overflow-y-auto">
          {chats.length === 0 && (
            <div className="text-center mt-16 px-6">
              <div className="text-5xl mb-3">💬</div>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                Koi message nahi abhi
              </p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                Kisi ke profile pe jaake Message button dabao
              </p>
            </div>
          )}
          {chats.map(chat => {
            const other = getOtherUser(chat);
            const isSelected = chatId === chat._id;
            return (
              <div
                key={chat._id}
                onClick={() => navigate(`/chat/${chat._id}`)}
                className="flex items-center gap-3 px-4 py-3 cursor-pointer transition-all"
                style={{
                  background: isSelected
                    ? 'linear-gradient(135deg, rgba(147,51,234,0.2), rgba(124,58,237,0.1))'
                    : 'transparent',
                  borderLeft: isSelected ? '2px solid #9333ea' : '2px solid transparent'
                }}
              >
                {/* Avatar with online dot */}
                <div className="relative shrink-0">
                  <img
                    src={other?.avatar || `https://ui-avatars.com/api/?name=${other?.username}&background=9333ea&color=fff`}
                    alt={other?.username}
                    className="w-12 h-12 rounded-full object-cover"
                  />
                  <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full border-2"
                    style={{
                      background: '#22c55e',
                      borderColor: 'var(--bg-primary)'
                    }} />
                </div>

                {/* Name + last message */}
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center">
                    <p className="font-semibold text-sm truncate"
                      style={{ color: 'var(--text-primary)' }}>
                      {other?.fullName || other?.username}
                    </p>
                    <span className="text-xs shrink-0 ml-2"
                      style={{ color: 'var(--text-muted)' }}>
                      {formatTime(chat.lastMessageAt)}
                    </span>
                  </div>
                  <p className="text-xs truncate mt-0.5"
                    style={{ color: 'var(--text-muted)' }}>
                    {chat.lastMessage?.content || 'Chat shuru karo'}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── MIDDLE: Chat Window ── */}
      <div className={`${chatId ? 'flex' : 'hidden md:flex'} flex-1 flex-col`}>
        {!chatId ? (
          <div className="flex-1 flex flex-col items-center justify-center"
            style={{ color: 'var(--text-muted)' }}>
            <div className="text-6xl mb-4">💬</div>
            <p className="text-lg font-semibold">Koi chat select karo</p>
            <p className="text-sm mt-1">Ya kisi ke profile se message bhejo</p>
          </div>
        ) : (
          <>
            {/* Chat header */}
            <div className="flex items-center gap-3 px-4 py-3 border-b"
              style={{ borderColor: 'var(--border)', background: 'var(--bg-card)' }}>
              {/* Back button — mobile only */}
              <button
                className="md:hidden mr-1 text-gray-400 hover:text-white"
                onClick={() => navigate('/chat')}>
                ←
              </button>
              <div className="relative">
                <img
                  src={otherUser?.avatar || `https://ui-avatars.com/api/?name=${otherUser?.username}&background=9333ea&color=fff`}
                  alt={otherUser?.username}
                  className="w-10 h-10 rounded-full object-cover"
                />
                <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2"
                  style={{ background: '#22c55e', borderColor: 'var(--bg-card)' }} />
              </div>
              <div>
                <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
                  {otherUser?.fullName || otherUser?.username}
                </p>
                <p className="text-xs" style={{ color: '#22c55e' }}>● online</p>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
              {loading && (
                <p className="text-center text-sm" style={{ color: 'var(--text-muted)' }}>
                  Loading...
                </p>
              )}

              {messages.map((msg, i) => {
                const isMe = msg.sender?._id === user._id || msg.sender === user._id;
                const showDate = i === 0 || (
                  new Date(msg.createdAt).toDateString() !==
                  new Date(messages[i - 1]?.createdAt).toDateString()
                );
                return (
                  <div key={msg._id}>
                    {/* Date separator */}
                    {showDate && (
                      <div className="flex items-center gap-2 my-3">
                        <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
                        <span className="text-xs px-2" style={{ color: 'var(--text-muted)' }}>
                          {new Date(msg.createdAt).toLocaleDateString([], { day: '2-digit', month: 'short' })}
                        </span>
                        <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
                      </div>
                    )}

                    <div className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-xs lg:max-w-md ${isMe ? 'items-end' : 'items-start'} flex flex-col`}>
                        <div
                          className="px-4 py-2.5 rounded-2xl text-sm"
                          style={isMe ? {
                            background: 'linear-gradient(135deg, #9333ea, #7c3aed)',
                            color: 'white',
                            borderBottomRightRadius: '4px'
                          } : {
                            background: 'var(--bg-card)',
                            color: 'var(--text-primary)',
                            border: '1px solid var(--border)',
                            borderBottomLeftRadius: '4px'
                          }}>
                          {msg.content}
                        </div>
                        <span className="text-xs mt-1 px-1"
                          style={{ color: 'var(--text-muted)' }}>
                          {isMe ? 'Sent by Me' : `${msg.sender?.username || ''} · ${formatTime(msg.createdAt)}`}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Typing indicator */}
              {typingUser && (
                <div className="flex justify-start">
                  <div className="px-4 py-2.5 rounded-2xl text-sm italic"
                    style={{
                      background: 'var(--bg-card)',
                      color: 'var(--text-muted)',
                      border: '1px solid var(--border)'
                    }}>
                    ••• typing...
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Emoji picker */}
            {showEmoji && (
              <div className="px-4 pb-2">
                <div className="p-3 rounded-2xl flex flex-wrap gap-2"
                  style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                  {EMOJIS.map(emoji => (
                    <button
                      key={emoji}
                      onClick={() => setContent(prev => prev + emoji)}
                      className="text-xl hover:scale-125 transition-transform">
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Input bar */}
            <div className="px-4 py-3 border-t flex items-end gap-2"
              style={{ borderColor: 'var(--border)', background: 'var(--bg-card)' }}>
              {/* Emoji button */}
              <button
                onClick={() => setShowEmoji(prev => !prev)}
                className="text-xl pb-1.5 transition-transform hover:scale-110"
                style={{ color: showEmoji ? '#9333ea' : 'var(--text-muted)' }}>
                😊
              </button>

              {/* Text input */}
              <textarea
                value={content}
                onChange={handleTyping}
                onKeyDown={handleKeyDown}
                placeholder="Message likho..."
                rows={1}
                className="flex-1 rounded-xl px-4 py-2.5 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-purple-500"
                style={{
                  background: 'var(--bg-primary)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border)'
                }}
              />

              {/* Send button */}
              <button
                onClick={sendMessage}
                disabled={!content.trim()}
                className="px-4 py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-40"
                style={{
                  background: 'linear-gradient(135deg, #9333ea, #7c3aed)',
                  color: 'white'
                }}>
                Send
              </button>
            </div>
          </>
        )}
      </div>

      {/* ── RIGHT: Suggested Shayers ── */}
      <div className="hidden xl:flex w-72 flex-col border-l p-4"
        style={{ borderColor: 'var(--border)' }}>
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs font-bold tracking-widest uppercase"
            style={{ color: 'var(--text-muted)' }}>
            Suggested Shayars
          </p>
          <Link to="/explore" className="text-xs"
            style={{ color: '#9333ea' }}>
            See All
          </Link>
        </div>

        <div className="space-y-3">
          {suggestions.length === 0 && (
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Loading...
            </p>
          )}
          {suggestions.slice(0, 6).map(u => (
            <div key={u._id} className="flex items-center gap-3">
              <Link to={`/profile/${u.username}`}>
                <img
                  src={u.avatar || `https://ui-avatars.com/api/?name=${u.username}&background=9333ea&color=fff`}
                  alt={u.username}
                  className="w-9 h-9 rounded-full object-cover"
                />
              </Link>
              <div className="flex-1 min-w-0">
                <Link to={`/profile/${u.username}`}>
                  <p className="text-sm font-semibold truncate"
                    style={{ color: 'var(--text-primary)' }}>
                    {u.username}
                  </p>
                </Link>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {u.followersCount ?? 0} followers
                </p>
              </div>
              <button
                onClick={() => handleFollow(u._id)}
                className="text-xs px-3 py-1.5 rounded-full font-semibold transition-all hover:opacity-90"
                style={{
                  background: 'linear-gradient(135deg, #9333ea, #7c3aed)',
                  color: 'white'
                }}>
                Follow
              </button>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
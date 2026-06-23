import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../hooks/useSocket';
import { userAPI } from '../services/api';
import api from '../services/api';
import {
  Home, Search, Plus, MessageCircle, User,
  Settings, LogOut, Heart, Droplets, Zap,
  Star, Flame, Ghost, Edit3, CheckCheck
} from 'lucide-react';

const CATEGORIES = [
  { name: 'Love',       icon: Heart,     color: 'text-red-500',    bg: 'bg-[#2A1625]' },
  { name: 'Sad',        icon: Droplets,  color: 'text-blue-400',   bg: 'bg-[#1A233A]' },
  { name: 'Motivational', icon: Zap,     color: 'text-yellow-500', bg: 'bg-[#2D281C]' },
  { name: 'Spiritual',  icon: Star,      color: 'text-teal-400',   bg: 'bg-[#182A2A]' },
  { name: 'Poetry',     icon: Flame,     color: 'text-orange-500', bg: 'bg-[#2D201A]' },
  { name: 'Funny',      icon: Ghost,     color: 'text-purple-400', bg: 'bg-[#251A3A]' },
];

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

  // ─── Profile se auto open ─────────────────────────────────────────────────
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

  // ─── Suggestions load ─────────────────────────────────────────────────────
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

  // ─── Socket ───────────────────────────────────────────────────────────────
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

  // ─── Send ─────────────────────────────────────────────────────────────────
  const sendMessage = () => {
    if (!content.trim() || !socket || !chatId) return;
    socket.emit('message:send', { chatId, content: content.trim() });
    setContent('');
    setShowEmoji(false);
  };

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

  const handleFollow = async (id) => {
    try {
      await userAPI.toggleFollow(id);
      setSuggestions(prev => prev.filter(u => u._id !== id));
    } catch (err) {
      console.error('Follow error:', err);
    }
  };

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
  const avatarUrl = (u) =>
    u?.avatar || `https://ui-avatars.com/api/?name=${u?.username || '?'}&background=9333ea&color=fff`;

  return (
    <div className="flex h-screen w-full overflow-hidden"
      style={{ background: '#0b0814', color: '#e2e8f0' }}>

      {/* ── LEFT: Inbox ── */}
      <div className={`${chatId ? 'hidden md:flex' : 'flex'} w-full md:w-[300px] flex-col border-r shrink-0`}
        style={{ borderColor: '#1f1a2e' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b"
          style={{ borderColor: '#1f1a2e' }}>
          <h1 className="text-xl font-bold text-gray-100">Messages</h1>
          <button className="text-gray-500 hover:text-gray-300">
            <Edit3 size={18} />
          </button>
        </div>

        {/* Chat list */}
        <div className="flex-1 overflow-y-auto px-3 py-2"
          style={{ scrollbarWidth: 'none' }}>
          {chats.length === 0 && (
            <div className="text-center mt-16 px-4">
              <div className="text-5xl mb-3">💬</div>
              <p className="text-sm text-gray-500">Koi message nahi abhi</p>
              <p className="text-xs mt-1 text-gray-600">
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
                className="flex items-center gap-3 p-3 rounded-2xl cursor-pointer transition-all mb-1"
                style={{
                  background: isSelected ? '#151023' : 'transparent',
                  border: isSelected ? '1px solid #2a1f40' : '1px solid transparent'
                }}
              >
                <div className="relative shrink-0">
                  <img
                    src={avatarUrl(other)}
                    alt={other?.username}
                    className="w-11 h-11 rounded-full object-cover"
                  />
                  <div className="absolute bottom-0 right-0 w-3 h-3 rounded-full border-2"
                    style={{ background: '#22c55e', borderColor: '#0b0814' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-baseline mb-0.5">
                    <p className="font-semibold text-sm truncate text-gray-200">
                      {other?.fullName || other?.username}
                    </p>
                    <span className="text-[10px] text-gray-500 ml-2 shrink-0">
                      {formatTime(chat.lastMessageAt)}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 truncate">
                    {chat.lastMessage?.content || 'Chat shuru karo'}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── MIDDLE: Chat Window ── */}
      <div className={`${chatId ? 'flex' : 'hidden md:flex'} flex-1 flex-col overflow-hidden`}
        style={{ background: '#0f0b1a' }}>

        {!chatId ? (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-600">
            <div className="text-6xl mb-4">💬</div>
            <p className="text-lg font-semibold">Koi chat select karo</p>
            <p className="text-sm mt-1">Ya kisi ke profile se message bhejo</p>
          </div>
        ) : (
          <>
            {/* Chat header */}
            <div className="h-16 flex items-center justify-between px-6 border-b shrink-0"
              style={{ borderColor: '#1f1a2e', background: '#0f0b1a' }}>
              <div className="flex items-center gap-3">
                <button
                  className="md:hidden mr-1 text-gray-400 hover:text-white"
                  onClick={() => navigate('/chat')}>
                  ←
                </button>
                <div className="relative">
                  <img
                    src={avatarUrl(otherUser)}
                    alt={otherUser?.username}
                    className="w-10 h-10 rounded-full object-cover"
                  />
                  <div className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2"
                    style={{ background: '#22c55e', borderColor: '#0f0b1a' }} />
                </div>
                <div>
                  <p className="font-semibold text-sm text-gray-100">
                    {otherUser?.fullName || otherUser?.username}
                  </p>
                  <p className="text-[11px] text-green-500 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
                    online
                  </p>
                </div>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4"
              style={{ scrollbarWidth: 'none' }}>
              {loading && (
                <p className="text-center text-sm text-gray-500">Loading...</p>
              )}

              {messages.map((msg, i) => {
                const isMe = msg.sender?._id === user._id || msg.sender === user._id;
                const showDate = i === 0 || (
                  new Date(msg.createdAt).toDateString() !==
                  new Date(messages[i - 1]?.createdAt).toDateString()
                );
                return (
                  <div key={msg._id}>
                    {showDate && (
                      <div className="flex items-center gap-2 my-3">
                        <div className="flex-1 h-px" style={{ background: '#1f1a2e' }} />
                        <span className="text-[11px] text-gray-600 bg-[#1a1429] px-3 py-1 rounded-full">
                          {new Date(msg.createdAt).toLocaleDateString([], { day: '2-digit', month: 'short' })}
                        </span>
                        <div className="flex-1 h-px" style={{ background: '#1f1a2e' }} />
                      </div>
                    )}
                    <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                      <div
                        className="max-w-[70%] px-4 py-3 text-sm leading-relaxed rounded-2xl"
                        style={isMe ? {
                          background: '#9d4edd',
                          color: 'white',
                          borderBottomRightRadius: '4px',
                          boxShadow: '0 0 20px rgba(157,78,221,0.3)'
                        } : {
                          background: '#1a1429',
                          color: '#d1d5db',
                          borderBottomLeftRadius: '4px',
                          border: '1px solid rgba(255,255,255,0.05)'
                        }}>
                        {msg.content}
                      </div>
                      <div className="flex items-center gap-1 mt-1 px-1 text-[10px] text-gray-500">
                        {isMe
                          ? <><CheckCheck size={12} className="text-blue-400" /> Sent by Me</>
                          : <span>{msg.sender?.username} · {formatTime(msg.createdAt)}</span>
                        }
                      </div>
                    </div>
                  </div>
                );
              })}

              {typingUser && (
                <div className="flex items-center gap-2 text-gray-500 text-[11px] bg-[#1a1429] w-fit px-4 py-2 rounded-full border border-white/5">
                  <div className="flex gap-1 items-center">
                    <div className="w-1 h-1 bg-gray-400 rounded-full animate-bounce" />
                    <div className="w-1 h-1 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-1 h-1 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                  <span className="ml-1">Typing...</span>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Emoji picker */}
            {showEmoji && (
              <div className="px-4 pb-2">
                <div className="p-3 rounded-2xl flex flex-wrap gap-2"
                  style={{ background: '#1a1429', border: '1px solid #2a1f40' }}>
                  {EMOJIS.map(emoji => (
                    <button key={emoji}
                      onClick={() => setContent(prev => prev + emoji)}
                      className="text-xl hover:scale-125 transition-transform">
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Input bar */}
            <div className="p-4 px-6 pb-6 shrink-0">
              <div className="flex items-center gap-2 rounded-2xl p-1.5 pr-2 border focus-within:border-purple-500/50 transition-colors"
                style={{ background: '#1a1429', borderColor: '#2a1f40' }}>
                <button
                  onClick={() => setShowEmoji(prev => !prev)}
                  className="p-2.5 rounded-xl hover:bg-white/5 transition-colors"
                  style={{ color: showEmoji ? '#b026ff' : '#6b7280' }}>
                  <span className="text-lg">😊</span>
                </button>
                <input
                  type="text"
                  placeholder="Message likho..."
                  value={content}
                  onChange={handleTyping}
                  onKeyDown={handleKeyDown}
                  className="flex-1 bg-transparent text-gray-200 text-sm focus:outline-none px-2 placeholder-gray-600"
                />
                <button
                  onClick={sendMessage}
                  disabled={!content.trim()}
                  className="px-5 py-2.5 rounded-xl text-sm font-medium transition-all duration-300 disabled:opacity-40"
                  style={{
                    background: '#1f1533',
                    border: '1px solid rgba(176,38,255,0.3)',
                    color: '#b026ff'
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = '#b026ff';
                    e.currentTarget.style.color = 'white';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = '#1f1533';
                    e.currentTarget.style.color = '#b026ff';
                  }}>
                  Send
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── RIGHT: Info Panel ── */}
      <div className="hidden xl:flex w-[300px] flex-col border-l p-6 shrink-0 overflow-y-auto"
        style={{ borderColor: '#1f1a2e', background: '#0b0814', scrollbarWidth: 'none' }}>

        {/* Profile card */}
        <div className="flex items-center justify-between p-4 rounded-2xl mb-6 border"
          style={{ background: '#151023', borderColor: '#1f1a2e' }}>
          <div className="flex items-center gap-3">
            <img
              src={avatarUrl(user)}
              alt={user?.username}
              className="w-10 h-10 rounded-full ring-2"
              style={{ ringColor: 'rgba(176,38,255,0.3)' }}
            />
            <div>
              <p className="text-sm font-semibold text-white">{user?.username}</p>
              <p className="text-[10px] text-gray-500">{user?.fullName || 'Shayar'}</p>
            </div>
          </div>
          <Link to="/profile/edit"
            className="text-[11px] px-3 py-1.5 rounded-lg font-medium"
            style={{ color: '#b026ff', background: '#1f1533' }}>
            Edit
          </Link>
        </div>

        {/* Categories */}
        <div className="mb-6">
          <h3 className="text-[11px] font-bold text-gray-600 tracking-widest mb-4 uppercase">
            Categories
          </h3>
          <div className="grid grid-cols-3 gap-2">
            {CATEGORIES.map((cat, i) => (
              <Link to={`/explore?category=${cat.name}`} key={i}
                className={`flex flex-col items-center justify-center py-4 px-2 rounded-2xl ${cat.bg} cursor-pointer hover:brightness-110 transition-all border border-white/5`}>
                <cat.icon size={20} className={`${cat.color} mb-2`} />
                <span className="text-[10px] font-medium text-gray-300">{cat.name}</span>
              </Link>
            ))}
          </div>
        </div>

        {/* Suggested Shayers */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[11px] font-bold text-gray-600 tracking-widest uppercase">
              Suggested Shayers
            </h3>
            <Link to="/explore" className="text-[10px] text-gray-400 hover:text-white">
              See All
            </Link>
          </div>
          <div className="space-y-2">
            {suggestions.length === 0 && (
              <p className="text-xs text-gray-600">Loading...</p>
            )}
            {suggestions.slice(0, 5).map(u => (
              <div key={u._id}
                className="flex items-center gap-3 p-2.5 rounded-2xl border border-transparent hover:border-[#1f1a2e] transition-colors"
                style={{ background: '#110d1c' }}>
                <Link to={`/profile/${u.username}`}>
                  <img
                    src={avatarUrl(u)}
                    alt={u.username}
                    className="w-10 h-10 rounded-xl object-cover"
                  />
                </Link>
                <div className="flex-1 min-w-0">
                  <Link to={`/profile/${u.username}`}>
                    <p className="text-sm font-semibold text-gray-200 truncate">{u.username}</p>
                  </Link>
                  <p className="text-[10px] text-gray-500">
                    {u.followersCount ?? 0} followers
                  </p>
                </div>
                <button
                  onClick={() => handleFollow(u._id)}
                  className="text-[11px] px-3 py-1.5 rounded-lg font-medium text-white transition-all hover:opacity-90"
                  style={{ background: '#b026ff' }}>
                  Follow
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-auto pt-6 flex flex-wrap justify-center gap-x-3 gap-y-1 text-[10px] text-gray-600">
          <Link to="/policies/terms" className="hover:text-gray-400">Terms</Link>
          <Link to="/policies/privacy" className="hover:text-gray-400">Privacy</Link>
          <Link to="/policies/guidelines" className="hover:text-gray-400">Guidelines</Link>
          <p className="w-full text-center mt-2">© 2026 ShayeriGram • Made with ✦ for Shayars</p>
        </div>
      </div>

    </div>
  );
}
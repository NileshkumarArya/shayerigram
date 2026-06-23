import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Bot,
  CheckCheck,
  Droplets,
  Edit3,
  Flame,
  Ghost,
  Heart,
  Lock,
  Mic,
  MoreVertical,
  Paperclip,
  Phone,
  Search,
  Send,
  Smile,
  Sparkles,
  Star,
  Zap,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../hooks/useSocket';
import { userAPI } from '../services/api';
import api from '../services/api';

const CATEGORIES = [
  { name: 'Love', icon: Heart, color: '#fb7185', bg: 'rgba(251,113,133,0.12)' },
  { name: 'Sad', icon: Droplets, color: '#60a5fa', bg: 'rgba(96,165,250,0.12)' },
  { name: 'Motivation', icon: Zap, color: '#fbbf24', bg: 'rgba(251,191,36,0.12)' },
  { name: 'Spiritual', icon: Star, color: '#5eead4', bg: 'rgba(94,234,212,0.12)' },
  { name: 'Poetry', icon: Flame, color: '#fb923c', bg: 'rgba(251,146,60,0.12)' },
  { name: 'Funny', icon: Ghost, color: '#c084fc', bg: 'rgba(192,132,252,0.12)' },
];

const EMOJIS = [
  '\uD83D\uDE00',
  '\uD83D\uDE02',
  '\uD83D\uDE0D',
  '\uD83E\uDD70',
  '\uD83D\uDE2D',
  '\uD83D\uDE0E',
  '\uD83D\uDE4F',
  '\u2764\uFE0F',
  '\uD83D\uDD25',
  '\u2728',
  '\uD83D\uDC9C',
  '\uD83C\uDFB6',
  '\uD83D\uDCDC',
  '\uD83C\uDF39',
  '\uD83D\uDCAB',
  '\uD83E\uDD7A',
];

const demoBot = {
  _id: 'shayari-bot',
  username: 'ShayeriBot',
  fullName: 'ShayeriBot',
  isVerified: true,
};

const cx = (...classes) => classes.filter(Boolean).join(' ');

const getInitial = (user) =>
  (user?.fullName || user?.username || '?').trim().charAt(0).toUpperCase();

const avatarUrl = (user) =>
  user?.avatar ||
  `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.username || '?')}&background=9333ea&color=fff`;

const formatTime = (date) => {
  if (!date) return '';
  const value = new Date(date);
  if (Number.isNaN(value.getTime())) return '';

  const diff = Date.now() - value.getTime();
  if (diff < 60_000) return 'now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} min ago`;
  if (diff < 86_400_000) {
    return value.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return value.toLocaleDateString([], { day: '2-digit', month: 'short' });
};

const formatDay = (date) => {
  const value = new Date(date);
  if (Number.isNaN(value.getTime())) return 'Today';
  const today = new Date();

  if (value.toDateString() === today.toDateString()) return 'Today';

  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (value.toDateString() === yesterday.toDateString()) return 'Yesterday';

  return value.toLocaleDateString([], { day: '2-digit', month: 'short' });
};

const getMessageText = (chat) =>
  chat?.lastMessage?.content ||
  chat?.lastMessage?.text ||
  chat?.lastMessage ||
  'Start a poetic conversation';

function Avatar({ person, size = 'md', bot = false }) {
  const sizeClass = size === 'lg' ? 'h-14 w-14' : size === 'sm' ? 'h-9 w-9' : 'h-11 w-11';

  return (
    <div className={cx('relative shrink-0 rounded-full', sizeClass)}>
      {person?.avatar ? (
        <img
          src={avatarUrl(person)}
          alt={person?.username || 'avatar'}
          className="h-full w-full rounded-full object-cover"
          loading="lazy"
          decoding="async"
        />
      ) : (
        <div
          className="flex h-full w-full items-center justify-center rounded-full text-sm font-bold text-white"
          style={{ background: bot ? '#3b245f' : 'linear-gradient(145deg,#9333ea,#5b21b6)' }}
        >
          {bot ? <Bot size={size === 'lg' ? 24 : 18} /> : getInitial(person)}
        </div>
      )}

      {bot ? (
        <span className="absolute -right-0.5 bottom-0 rounded-full bg-[#10101a] p-0.5 text-emerald-400">
          <Lock size={12} />
        </span>
      ) : (
        <span
          className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2"
          style={{ background: '#22c55e', borderColor: '#0c0915' }}
        />
      )}
    </div>
  );
}

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
  const [query, setQuery] = useState('');

  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const currentUserId = user?._id ? String(user._id) : '';

  useEffect(() => {
    const { userId } = location.state || {};
    if (!userId) return;

    const startChat = async () => {
      try {
        const { data } = await api.post('/chats', { userId });
        if (data?.chat?._id) {
          navigate(`/chat/${data.chat._id}`, { replace: true });
        }
      } catch (err) {
        console.error('Chat start error:', err);
      }
    };

    startChat();
  }, [location.state, navigate]);

  useEffect(() => {
    const fetchChats = async () => {
      try {
        const { data } = await api.get('/chats');
        setChats(data.chats || []);
      } catch (err) {
        console.error('Chats fetch error:', err);
      }
    };

    fetchChats();
  }, []);

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

  useEffect(() => {
    if (!chatId) {
      setMessages([]);
      return;
    }

    const fetchMessages = async () => {
      setLoading(true);
      try {
        const { data } = await api.get(`/messages/${chatId}`);
        setMessages(data.messages || []);
      } catch (err) {
        console.error('Messages fetch error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchMessages();
  }, [chatId]);

  useEffect(() => {
    if (!socket || !chatId || !currentUserId) return;

    socket.emit('chat:join', { chatId });

    const handleNewMessage = (message) => {
      if (String(message.chatId) === String(chatId)) {
        setMessages((prev) => {
          if (prev.some((item) => item._id === message._id)) return prev;
          return [...prev, message];
        });
      }

      setChats((prev) =>
        prev.map((chat) =>
          String(chat._id) === String(message.chatId)
            ? { ...chat, lastMessage: message, lastMessageAt: message.createdAt }
            : chat
        )
      );
    };

    const handleTypingStart = ({ userId }) => {
      if (String(userId) !== currentUserId) setTypingUser(userId);
    };

    socket.on('message:new', handleNewMessage);
    socket.on('typing:start', handleTypingStart);
    socket.on('typing:stop', () => setTypingUser(null));

    return () => {
      socket.off('message:new', handleNewMessage);
      socket.off('typing:start', handleTypingStart);
      socket.off('typing:stop');
    };
  }, [socket, chatId, currentUserId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, typingUser]);

  const getOtherUser = (chat) =>
    chat?.participants?.find((person) => String(person._id) !== currentUserId);

  const activeChat = useMemo(
    () => chats.find((chat) => String(chat._id) === String(chatId)),
    [chats, chatId]
  );

  const otherUser = activeChat ? getOtherUser(activeChat) : null;

  const filteredChats = useMemo(() => {
    const value = query.trim().toLowerCase();
    if (!value) return chats;

    return chats.filter((chat) => {
      const other = getOtherUser(chat);
      const name = `${other?.username || ''} ${other?.fullName || ''}`.toLowerCase();
      return name.includes(value) || String(getMessageText(chat)).toLowerCase().includes(value);
    });
  }, [chats, query, currentUserId]);

  const sendMessage = () => {
    const text = content.trim();
    if (!text || !socket || !chatId) return;

    socket.emit('message:send', { chatId, content: text });
    setContent('');
    setShowEmoji(false);
  };

  const handleTyping = (event) => {
    setContent(event.target.value);
    if (!socket || !chatId) return;

    socket.emit('typing:start', { chatId });
    clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('typing:stop', { chatId });
    }, 1200);
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  };

  const handleFollow = async (id) => {
    try {
      await userAPI.toggleFollow(id);
      setSuggestions((prev) => prev.filter((item) => item._id !== id));
    } catch (err) {
      console.error('Follow error:', err);
    }
  };

  const ConversationRow = ({ chat, compact = false }) => {
    const other = getOtherUser(chat);
    const selected = String(chat._id) === String(chatId);
    const bot = chat._id === demoBot._id;

    return (
      <button
        type="button"
        onClick={() => !bot && navigate(`/chat/${chat._id}`)}
        className="group relative flex w-full items-center gap-3 rounded-none px-4 py-3 text-left transition"
        style={{
          background: selected
            ? 'linear-gradient(90deg,rgba(147,51,234,.36),rgba(147,51,234,.13),transparent)'
            : 'transparent',
          borderLeft: selected ? '3px solid #a855f7' : '3px solid transparent',
        }}
      >
        <Avatar person={bot ? demoBot : other} size={compact ? 'sm' : 'md'} bot={bot} />

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <p className="truncate text-[15px] font-semibold text-zinc-100">
              {bot ? 'ShayeriBot' : other?.fullName || other?.username || 'Unknown'}
              {bot && <span className="ml-1 text-emerald-400">✓</span>}
            </p>
            <span className="shrink-0 text-xs text-zinc-500">
              {bot ? '' : formatTime(chat.lastMessageAt)}
            </span>
          </div>

          <p className="mt-0.5 line-clamp-2 text-sm leading-snug text-zinc-400">
            {bot ? 'New ghazals and writing prompts for you.' : getMessageText(chat)}
          </p>
        </div>

        {bot && <Lock size={15} className="text-zinc-500" />}
      </button>
    );
  };

  const ChatHeader = ({ mobile = false }) => (
    <div
      className="flex h-16 shrink-0 items-center gap-3 border-b px-4"
      style={{
        background: 'rgba(13,10,24,.92)',
        borderColor: 'rgba(255,255,255,.07)',
        backdropFilter: 'blur(18px)',
      }}
    >
      {mobile && (
        <button
          type="button"
          onClick={() => navigate('/chat')}
          className="flex h-9 w-9 items-center justify-center rounded-full text-zinc-300 hover:bg-white/5"
        >
          <ArrowLeft size={20} />
        </button>
      )}

      <Avatar person={otherUser} size="sm" />

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-zinc-100">
          {otherUser?.fullName || otherUser?.username || 'Conversation'}
        </p>
        <p className="text-xs text-emerald-400">online</p>
      </div>

      <button
        type="button"
        className="flex h-9 w-9 items-center justify-center rounded-xl text-purple-300 hover:bg-purple-500/10"
      >
        <Phone size={17} />
      </button>
      <button
        type="button"
        className="flex h-9 w-9 items-center justify-center rounded-xl text-zinc-400 hover:bg-white/5"
      >
        <MoreVertical size={18} />
      </button>
    </div>
  );

  const MessageBubble = ({ message, index }) => {
    const senderId = typeof message.sender === 'object' ? message.sender?._id : message.sender;
    const isMe = String(senderId) === currentUserId;
    const previous = messages[index - 1];
    const showDay =
      index === 0 ||
      new Date(message.createdAt).toDateString() !== new Date(previous?.createdAt).toDateString();

    return (
      <div>
        {showDay && (
          <div className="my-4 flex items-center gap-3">
            <div className="h-px flex-1 bg-white/5" />
            <span className="rounded-full border border-white/5 bg-white/[.04] px-3 py-1 text-[11px] text-zinc-500">
              {formatDay(message.createdAt)}
            </span>
            <div className="h-px flex-1 bg-white/5" />
          </div>
        )}

        <div className={cx('flex flex-col', isMe ? 'items-end' : 'items-start')}>
          <div
            className={cx(
              'max-w-[78%] px-4 py-2.5 text-sm leading-relaxed shadow-lg md:max-w-[68%]',
              isMe
                ? 'rounded-[20px] rounded-br-md text-white'
                : 'rounded-[20px] rounded-bl-md text-zinc-200'
            )}
            style={{
              background: isMe
                ? 'linear-gradient(145deg,#a855f7,#7c3aed)'
                : 'linear-gradient(145deg,rgba(45,48,63,.96),rgba(30,34,48,.96))',
              boxShadow: isMe
                ? '0 12px 30px rgba(147,51,234,.28)'
                : '0 12px 26px rgba(0,0,0,.18)',
            }}
          >
            {message.content}
          </div>

          <div className="mt-1 flex items-center gap-1 px-1 text-[10px] text-zinc-500">
            {isMe ? (
              <>
                <CheckCheck size={12} className="text-sky-400" />
                <span>Sent by Me</span>
              </>
            ) : (
              <span>
                {message.sender?.username || otherUser?.username || 'Shayar'} · {formatTime(message.createdAt)}
              </span>
            )}
          </div>
        </div>
      </div>
    );
  };

  const MessageComposer = () => (
    <div className="shrink-0 border-t border-white/5 bg-[#0d0a18]/95 px-3 py-3 backdrop-blur md:px-5">
      {showEmoji && (
        <div className="mb-3 flex flex-wrap gap-2 rounded-2xl border border-white/10 bg-[#191327] p-3">
          {EMOJIS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => setContent((prev) => prev + emoji)}
              className="flex h-9 w-9 items-center justify-center rounded-xl text-xl transition hover:bg-white/5 hover:scale-110"
            >
              {emoji}
            </button>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2">
        <button
          type="button"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
        >
          <Paperclip size={19} />
        </button>

        <button
          type="button"
          onClick={() => setShowEmoji((prev) => !prev)}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-zinc-400 hover:bg-white/5 hover:text-purple-300"
        >
          <Smile size={19} />
        </button>

        <button
          type="button"
          className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-zinc-400 hover:bg-white/5 hover:text-zinc-200 sm:flex"
        >
          <Mic size={19} />
        </button>

        <div className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-white/[.06] px-4 py-2">
          <input
            value={content}
            onChange={handleTyping}
            onKeyDown={handleKeyDown}
            placeholder="Message likho..."
            className="h-6 w-full bg-transparent text-sm text-zinc-100 outline-none placeholder:text-zinc-500"
          />
        </div>

        <button
          type="button"
          onClick={sendMessage}
          disabled={!content.trim()}
          className="flex h-10 shrink-0 items-center gap-2 rounded-2xl px-4 text-sm font-semibold text-white shadow-lg transition disabled:cursor-not-allowed disabled:opacity-40"
          style={{ background: 'linear-gradient(145deg,#a855f7,#7c3aed)' }}
        >
          <Send size={16} />
          <span className="hidden sm:inline">Send</span>
        </button>
      </div>
    </div>
  );

  const ChatBody = () => (
    <div className="flex min-h-0 flex-1 flex-col">
      <ChatHeader mobile />

      <div className="relative min-h-0 flex-1 overflow-hidden">
        {/* ---------- WATERMARK REMOVED ---------- */}

        <div className="relative h-full overflow-y-auto px-4 py-4 md:px-6" style={{ scrollbarWidth: 'none' }}>
          {loading && <p className="py-6 text-center text-sm text-zinc-500">Loading messages...</p>}

          {!loading && messages.length === 0 && (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <MessageCircleIcon />
              <p className="mt-4 text-sm font-semibold text-zinc-200">No messages yet</p>
              <p className="mt-1 max-w-xs text-xs text-zinc-500">
                Start with a sher, a salam, or just a simple hello.
              </p>
            </div>
          )}

          {messages.map((message, index) => (
            <MessageBubble key={message._id || `${message.createdAt}-${index}`} message={message} index={index} />
          ))}

          {typingUser && (
            <div className="mt-3 flex w-fit items-center gap-2 rounded-full border border-white/5 bg-white/[.06] px-4 py-2 text-xs text-zinc-400">
              <span className="flex gap-1">
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-400" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-400 [animation-delay:150ms]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-400 [animation-delay:300ms]" />
              </span>
              Typing...
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      <MessageComposer />
    </div>
  );

  const Inbox = ({ desktop = false }) => (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 px-5 pb-3 pt-5">
        <div className="flex items-center justify-between">
          <h1 className={cx('font-semibold tracking-tight text-zinc-100', desktop ? 'text-lg' : 'text-3xl')}>
            Messages
          </h1>
          <button
            type="button"
            className="flex h-9 w-9 items-center justify-center rounded-2xl text-zinc-400 hover:bg-white/5"
          >
            <Edit3 size={18} />
          </button>
        </div>

        <div className="mt-4 flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[.05] px-3 py-2">
          <Search size={16} className="text-zinc-500" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search conversations"
            className="min-w-0 flex-1 bg-transparent text-sm text-zinc-200 outline-none placeholder:text-zinc-600"
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto pb-3" style={{ scrollbarWidth: 'none' }}>
        <ConversationRow chat={{ _id: demoBot._id, participants: [demoBot], lastMessage: null }} />

        {filteredChats.length === 0 ? (
          <div className="mx-5 mt-8 rounded-3xl border border-white/10 bg-white/[.04] px-5 py-8 text-center">
            <MessageCircleIcon />
            <p className="mt-4 text-sm font-semibold text-zinc-200">Koi message nahi abhi</p>
            <p className="mt-1 text-xs leading-relaxed text-zinc-500">
              Kisi ke profile pe jaake message start karo.
            </p>
          </div>
        ) : (
          filteredChats.map((chat) => <ConversationRow key={chat._id} chat={chat} compact={desktop} />)
        )}
      </div>

      {!desktop && (
        <div className="mx-5 mb-3 rounded-full border border-white/10 bg-white/[.08] px-4 py-2 text-center text-sm text-zinc-300">
          Showing recent conversations only
        </div>
      )}
    </div>
  );

  const RightPanel = () => (
    <aside className="hidden w-[282px] shrink-0 border-l border-white/5 bg-[#0c0915] p-4 xl:block">
      <div className="rounded-3xl border border-white/10 bg-white/[.04] p-4">
        <div className="flex items-center gap-3">
          <Avatar person={user} size="sm" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-zinc-100">{user?.username || 'Shayar'}</p>
            <p className="text-xs text-zinc-500">{user?.fullName || 'Poetry account'}</p>
          </div>
          <Link to="/profile/edit" className="text-xs font-semibold text-purple-300">
            Edit
          </Link>
        </div>
      </div>

      <p className="mt-6 text-xs font-bold uppercase tracking-[.18em] text-zinc-600">Categories</p>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {CATEGORIES.map((category) => (
          <Link
            key={category.name}
            to={`/explore?category=${category.name}`}
            className="rounded-2xl border border-white/5 px-2 py-3 text-center transition hover:-translate-y-0.5 hover:border-purple-400/30"
            style={{ background: category.bg }}
          >
            <category.icon size={18} className="mx-auto" style={{ color: category.color }} />
            <span className="mt-1 block truncate text-[10px] font-medium text-zinc-300">{category.name}</span>
          </Link>
        ))}
      </div>

      <div className="mt-6 flex items-center justify-between">
        <p className="text-xs font-bold uppercase tracking-[.18em] text-zinc-600">Suggested Shayers</p>
        <Link to="/explore" className="text-xs text-zinc-500 hover:text-zinc-300">
          See all
        </Link>
      </div>

      <div className="mt-3 space-y-2">
        {suggestions.slice(0, 5).map((item) => (
          <div key={item._id} className="flex items-center gap-3 rounded-2xl bg-white/[.04] p-2.5">
            <Link to={`/profile/${item.username}`}>
              <Avatar person={item} size="sm" />
            </Link>
            <div className="min-w-0 flex-1">
              <Link to={`/profile/${item.username}`} className="block truncate text-sm font-semibold text-zinc-200">
                {item.username}
              </Link>
              <p className="text-[11px] text-zinc-500">{item.followersCount || 0} followers</p>
            </div>
            <button
              type="button"
              onClick={() => handleFollow(item._id)}
              className="rounded-xl bg-purple-600 px-3 py-1.5 text-xs font-semibold text-white"
            >
              Follow
            </button>
          </div>
        ))}
      </div>

      <div className="mt-8 rounded-3xl border border-purple-400/10 bg-purple-500/[.06] p-4">
        <Sparkles size={18} className="text-purple-300" />
        <p className="mt-2 text-sm font-semibold text-zinc-100">Poetry flows better in conversation.</p>
        <p className="mt-1 text-xs leading-relaxed text-zinc-500">
          Share a line, ask for feedback, or continue a thought.
        </p>
      </div>
    </aside>
  );

  return (
    <>
      <div className="md:hidden h-[calc(100vh-4rem)] overflow-hidden bg-[#090711] text-zinc-100">
        {chatId ? <ChatBody /> : <Inbox />}
      </div>

      <div className="hidden h-screen w-full overflow-hidden bg-[#090711] text-zinc-100 md:flex">
        <aside className="w-[320px] shrink-0 border-r border-white/5 bg-[#0c0915]">
          <Inbox desktop />
        </aside>

        {/* Change 2: Updated main classes */}
        <main className="flex min-h-0 flex-1 flex-col w-full overflow-hidden">
          {chatId ? (
            /* Change 3: Updated outer div classes */
            <div className="flex h-full min-h-0 flex-col overflow-hidden">
              <div className="hidden md:block">
                <ChatHeader />
              </div>

              <div className="relative min-h-0 flex-1 overflow-hidden">
                {/* ---------- WATERMARK REMOVED ---------- */}

                <div className="relative h-full overflow-y-auto px-6 py-5" style={{ scrollbarWidth: 'none' }}>
                  {loading && <p className="py-6 text-center text-sm text-zinc-500">Loading messages...</p>}

                  {!loading && messages.length === 0 && (
                    <div className="flex h-full flex-col items-center justify-center text-center">
                      <MessageCircleIcon />
                      <p className="mt-4 text-sm font-semibold text-zinc-200">No messages yet</p>
                      <p className="mt-1 max-w-xs text-xs text-zinc-500">
                        Start with a sher, a salam, or just a simple hello.
                      </p>
                    </div>
                  )}

                  {messages.map((message, index) => (
                    <MessageBubble
                      key={message._id || `${message.createdAt}-${index}`}
                      message={message}
                      index={index}
                    />
                  ))}

                  {typingUser && (
                    <div className="mt-3 flex w-fit items-center gap-2 rounded-full border border-white/5 bg-white/[.06] px-4 py-2 text-xs text-zinc-400">
                      <span className="flex gap-1">
                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-400" />
                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-400 [animation-delay:150ms]" />
                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-400 [animation-delay:300ms]" />
                      </span>
                      Typing...
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </div>
              </div>

              <MessageComposer />
            </div>
          ) : (
            <div className="flex h-full flex-col items-center justify-center px-8 text-center">
              <MessageCircleIcon />
              <p className="mt-5 text-lg font-semibold text-zinc-100">Select a conversation</p>
              <p className="mt-1 max-w-sm text-sm leading-relaxed text-zinc-500">
                Open a chat from the left, or start one from a poet profile.
              </p>
            </div>
          )}
        </main>

        <RightPanel />
      </div>
    </>
  );
}

function MessageCircleIcon() {
  return (
    <div className="flex h-16 w-16 items-center justify-center rounded-3xl border border-purple-400/20 bg-purple-500/10 text-purple-300">
      <Smile size={28} />
    </div>
  );
}
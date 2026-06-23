import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../hooks/useSocket';
import api from '../services/api';

export default function ChatPage() {
  const { chatId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const socket = useSocket();

  const [chats, setChats] = useState([]);
  const [messages, setMessages] = useState([]);
  const [content, setContent] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [typingUser, setTypingUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  // ─── Inbox load karo ───────────────────────────────────────────────────────
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

  // ─── Messages load karo jab chatId change ho ───────────────────────────────
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

  // ─── Socket events ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!socket || !chatId) return;

    // Chat room join karo
    socket.emit('chat:join', { chatId });

    // Naya message aaya
    socket.on('message:new', (message) => {
      if (message.chatId === chatId) {
        setMessages(prev => [...prev, message]);
      }
      // Inbox mein lastMessage update karo
      setChats(prev => prev.map(c =>
        c._id === message.chatId
          ? { ...c, lastMessage: message, lastMessageAt: message.createdAt }
          : c
      ));
    });

    // Typing indicators
    socket.on('typing:start', ({ userId: typingUserId }) => {
      if (typingUserId !== user._id) setTypingUser(typingUserId);
    });
    socket.on('typing:stop', () => setTypingUser(null));

    return () => {
      socket.off('message:new');
      socket.off('typing:start');
      socket.off('typing:stop');
    };
  }, [socket, chatId, user._id]);

  // ─── Auto scroll ───────────────────────────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ─── Message send karo ────────────────────────────────────────────────────
  const sendMessage = () => {
    if (!content.trim() || !socket || !chatId) return;
    socket.emit('message:send', { chatId, content: content.trim() });
    setContent('');
  };

  // ─── Typing indicator ─────────────────────────────────────────────────────
  const handleTyping = (e) => {
    setContent(e.target.value);
    if (!socket || !chatId) return;

    socket.emit('typing:start', { chatId });
    clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('typing:stop', { chatId });
    }, 1500);
  };

  // ─── Enter key se send ────────────────────────────────────────────────────
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // ─── Other user ka naam/avatar lao ───────────────────────────────────────
  const getOtherUser = (chat) => {
    return chat.participants?.find(p => p._id !== user._id);
  };

  return (
    <div className="flex h-screen bg-gray-950 text-white">

      {/* ── Inbox / Chat List ── */}
      <div className="w-80 border-r border-purple-900/40 flex flex-col">
        <div className="p-4 border-b border-purple-900/40">
          <h2 className="text-lg font-bold text-purple-300">Messages</h2>
        </div>
        <div className="flex-1 overflow-y-auto">
          {chats.length === 0 && (
            <p className="text-gray-500 text-sm text-center mt-8">
              Koi chat nahi hai abhi
            </p>
          )}
          {chats.map(chat => {
            const other = getOtherUser(chat);
            return (
              <div
                key={chat._id}
                onClick={() => navigate(`/chat/${chat._id}`)}
                className={`flex items-center gap-3 p-4 cursor-pointer hover:bg-purple-900/20 transition
                  ${chatId === chat._id ? 'bg-purple-900/30' : ''}`}
              >
                <img
                  src={other?.avatar || '/default-avatar.png'}
                  alt={other?.username}
                  className="w-10 h-10 rounded-full object-cover"
                />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate">
                    {other?.fullName || other?.username}
                  </p>
                  <p className="text-xs text-gray-400 truncate">
                    {chat.lastMessage?.content || 'Chat shuru karo'}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Chat Window ── */}
      <div className="flex-1 flex flex-col">
        {!chatId ? (
          <div className="flex-1 flex items-center justify-center text-gray-500">
            Kisi se chat select karo
          </div>
        ) : (
          <>
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {loading && (
                <p className="text-center text-gray-500 text-sm">Loading...</p>
              )}
              {messages.map(msg => {
                const isMe = msg.sender?._id === user._id || msg.sender === user._id;
                return (
                  <div key={msg._id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-2xl text-sm
                      ${isMe
                        ? 'bg-purple-600 text-white rounded-br-sm'
                        : 'bg-gray-800 text-gray-100 rounded-bl-sm'
                      }`}>
                      {msg.content}
                    </div>
                  </div>
                );
              })}
              {typingUser && (
                <div className="flex justify-start">
                  <div className="bg-gray-800 px-4 py-2 rounded-2xl text-sm text-gray-400 italic">
                    typing...
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-4 border-t border-purple-900/40 flex gap-2">
              <textarea
                value={content}
                onChange={handleTyping}
                onKeyDown={handleKeyDown}
                placeholder="Message likho..."
                rows={1}
                className="flex-1 bg-gray-800 text-white rounded-xl px-4 py-2 text-sm
                  resize-none focus:outline-none focus:ring-1 focus:ring-purple-500"
              />
              <button
                onClick={sendMessage}
                disabled={!content.trim()}
                className="bg-purple-600 hover:bg-purple-700 disabled:opacity-40
                  px-4 py-2 rounded-xl text-sm font-semibold transition"
              >
                Send
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
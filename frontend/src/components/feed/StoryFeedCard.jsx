import { Link } from 'react-router-dom';
import { optimizeImageUrl } from '../../utils/image';

/**
 * StoryFeedCard — compact story preview injected into the home feed
 * Client-side interleaved with posts, same pattern as AdCard
 */
export default function StoryFeedCard({ story }) {
  return (
    <Link to={`/story/${story._id}`}
      className="glass rounded-2xl p-4 mb-4 flex gap-4 hover:opacity-90 transition-opacity animate-fade-in"
      style={{ border: '1px solid var(--border)' }}>
      <div className="w-20 h-28 rounded-lg overflow-hidden shrink-0"
        style={{ background: 'linear-gradient(135deg, #1a0533, #0e0e1a)' }}>
        {story.coverImage ? (
          <img src={optimizeImageUrl(story.coverImage, { width: 240 })} alt={story.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center p-1">
            <p className="text-[10px] font-shayari text-center line-clamp-4" style={{ color: 'var(--text-secondary)' }}>
              {story.title}
            </p>
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0 flex flex-col justify-center">
        <span className="text-xs w-fit px-2 py-0.5 rounded-full mb-2"
          style={{ background: 'rgba(147,51,234,0.1)', color: 'var(--purple-light)', border: '1px solid rgba(147,51,234,0.2)' }}>
          📖 Story
        </span>
        <p className="font-semibold text-sm truncate" style={{ color: 'var(--text-primary)' }}>{story.title}</p>
        <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-muted)' }}>
          by {story.author?.username} · {story.genre}
        </p>
        <div className="flex items-center gap-3 mt-2 text-xs" style={{ color: 'var(--text-muted)' }}>
          <span>❤️ {story.totalLikes || 0}</span>
          <span>👁️ {story.totalReads || 0}</span>
        </div>
      </div>
    </Link>
  );
}
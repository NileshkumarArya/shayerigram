import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const POLICIES = {
  terms: {
    title: 'Terms of Service',
    updated: 'April 13, 2026',
    intro: 'These terms explain the basic rules for using ShayeriGram, what users can post, and when accounts or content can be restricted.',
    sections: [
      {
        heading: 'Using ShayeriGram',
        points: [
          'Use accurate account information and keep your account secure.',
          'Meet the minimum age required by applicable law.',
          'Do not misuse another person’s account or evade restrictions.'
        ]
      },
      {
        heading: 'Content Rules',
        points: [
          'You may share original poetry, lawful creative content, and respectful comments.',
          'Do not post hate speech, harassment, threats, sexual exploitation content, scams, malware, or illegal material.',
          'Do not upload content that violates copyright, trademark, or privacy rights.'
        ]
      },
      {
        heading: 'Moderation and Enforcement',
        points: [
          'We may remove content, limit visibility, or suspend accounts that violate platform rules.',
          'Repeated or severe violations can result in permanent bans.',
          'We may update these terms as the platform evolves.'
        ]
      }
    ]
  },
  privacy: {
    title: 'Privacy Policy',
    updated: 'April 13, 2026',
    intro: 'This policy explains what account, content, and security information ShayeriGram collects and how it is used.',
    sections: [
      {
        heading: 'What We Collect',
        points: [
          'Account details like username, email, password hash, and optional profile fields.',
          'Posts, comments, images, saved content, and profile information you choose to share.',
          'Security and usage data such as login attempts, IP address, device/browser details, and abuse-prevention signals.'
        ]
      },
      {
        heading: 'How We Use Information',
        points: [
          'To operate your account and show your content in the product.',
          'To secure the platform, detect abuse, and investigate fraud or spam.',
          'To improve reliability, moderation, and user safety.'
        ]
      },
      {
        heading: 'Your Choices',
        points: [
          'You should be able to edit profile information and remove content you posted.',
          'Some data may be retained for legal, safety, or abuse-prevention reasons.',
          'Before launch, add a real privacy contact email and deletion workflow.'
        ]
      }
    ]
  },
  community: {
    title: 'Community Guidelines',
    updated: 'April 13, 2026',
    intro: 'ShayeriGram should feel creative, respectful, and safe. These guidelines define what is welcome and what is not.',
    sections: [
      {
        heading: 'What Is Welcome',
        points: [
          'Original poetry, thoughtful discussion, emotional expression, and respectful feedback.',
          'Creative, cultural, and personal storytelling that does not target or harm others.'
        ]
      },
      {
        heading: 'What Is Not Allowed',
        points: [
          'Hate speech, targeted harassment, violent threats, and bullying.',
          'Sexual exploitation, self-harm encouragement, privacy violations, and impersonation.',
          'Spam, fake engagement, scams, phishing, and repeated reposting of stolen content.'
        ]
      },
      {
        heading: 'How Enforcement Works',
        points: [
          'We may warn, remove content, reduce reach, temporarily restrict accounts, or permanently ban users.',
          'Severe violations can lead to immediate suspension without prior warning.'
        ]
      }
    ]
  },
  cookies: {
    title: 'Cookie Policy',
    updated: 'April 13, 2026',
    intro: 'ShayeriGram currently uses essential cookies mainly for authentication, security, and basic site functionality.',
    sections: [
      {
        heading: 'Why Cookies Are Used',
        points: [
          'To keep users signed in securely.',
          'To maintain sessions and reduce abuse.',
          'To support core product functionality.'
        ]
      },
      {
        heading: 'Launch Recommendation',
        points: [
          'Do not add non-essential trackers without also adding a clear consent flow where legally required.'
        ]
      }
    ]
  },
  content: {
    title: 'Content Policy',
    updated: 'April 13, 2026',
    intro: 'This policy explains what kinds of content are restricted or removed to keep ShayeriGram safe and lawful.',
    sections: [
      {
        heading: 'Restricted Content',
        points: [
          'No hate speech, violent threats, targeted harassment, scams, phishing, malware, or illegal goods promotion.',
          'No sexual exploitation, child safety violations, privacy leaks, doxxing, or impersonation intended to deceive.',
          'No repeated spam, engagement manipulation, or stolen content reposting without rights or permission.'
        ]
      },
      {
        heading: 'Enforcement',
        points: [
          'Content may be removed, age-restricted, limited in reach, or escalated for manual review.',
          'Accounts that repeatedly violate the rules may be suspended or permanently banned.'
        ]
      }
    ]
  },
  copyright: {
    title: 'Copyright Policy',
    updated: 'April 13, 2026',
    intro: 'Users must only post content they own or have permission to share.',
    sections: [
      {
        heading: 'What Happens on a Report',
        points: [
          'Reported infringing content may be removed or disabled.',
          'Repeat infringers may lose access to the platform.',
          'Before launch, add a copyright/takedown contact email.'
        ]
      }
    ]
  },
};

const policyLinks = [
  ['terms', 'Terms'],
  ['privacy', 'Privacy'],
  ['community', 'Community'],
  ['cookies', 'Cookies'],
  ['content', 'Content Policy'],
  ['copyright', 'Copyright'],
];

export default function PolicyPage() {
  const { slug = 'terms' } = useParams();
  const { user } = useAuth();
  const policy = POLICIES[slug] || POLICIES.terms;
  const backTo = user ? '/' : '/login';

  return (
    <div className="min-h-screen px-4 py-8 md:py-12" style={{ background: 'var(--bg-primary)' }}>
      <div className="max-w-4xl mx-auto">
        <div className="mb-6 text-center">
          <Link to={backTo} className="inline-flex items-center gap-2 text-sm hover:opacity-80" style={{ color: 'var(--purple-light)' }}>
            ✦ {user ? 'Back to ShayeriGram' : 'Back to sign in'}
          </Link>
        </div>

        <div className="glass rounded-3xl p-6 md:p-8">
          <div className="flex flex-wrap gap-2 mb-6">
            {policyLinks.map(([key, label]) => (
              <Link
                key={key}
                to={`/policies/${key}`}
                className="px-3 py-1.5 rounded-full text-xs font-medium transition-all"
                style={slug === key ? {
                  background: 'linear-gradient(135deg, #9333ea, #7c3aed)',
                  color: 'white'
                } : {
                  background: 'rgba(147,51,234,0.12)',
                  border: '1px solid rgba(147,51,234,0.25)',
                  color: 'var(--purple-light)'
                }}
              >
                {label}
              </Link>
            ))}
          </div>

          <h1 className="text-3xl md:text-4xl font-cinzel gradient-text mb-2">{policy.title}</h1>
          <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>Last updated: {policy.updated}</p>
          <p className="text-base leading-7 mb-8" style={{ color: 'var(--text-secondary)' }}>{policy.intro}</p>

          <div className="space-y-6">
            {policy.sections.map((section) => (
              <section key={section.heading} className="rounded-2xl p-5" style={{ border: '1px solid var(--border)', background: 'rgba(255,255,255,0.02)' }}>
                <h2 className="text-lg font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>{section.heading}</h2>
                <ul className="space-y-2">
                  {section.points.map((point) => (
                    <li key={point} className="text-sm leading-7" style={{ color: 'var(--text-secondary)' }}>
                      • {point}
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

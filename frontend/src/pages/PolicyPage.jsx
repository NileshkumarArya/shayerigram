import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const POLICIES = {
  terms: {
    title: 'Terms of Service',
    updated: 'July 12, 2026',
    intro: "These terms explain the rules for using ShayeriGram — what you can do here, what's expected of you, and when we may need to restrict access.",
    sections: [
      {
        heading: 'Eligibility',
        points: [
          'You must be at least 13 years old to create an account. We verify this using the date of birth you provide at signup.',
          'Users who are not confirmed as 18 or older will not see Mature-tagged content.',
          'You are responsible for the accuracy of the information you provide, including your date of birth.'
        ]
      },
      {
        heading: 'Your Account',
        points: [
          'Keep your login credentials secure and do not share your account with others.',
          'You are responsible for activity that happens under your account.',
          'Do not create multiple accounts to evade a suspension or ban.'
        ]
      },
      {
        heading: 'Your Content',
        points: [
          'You retain ownership of the shayari, stories, posts, and other content you create.',
          'By posting, you grant ShayeriGram a license to host, display, and distribute your content on the platform.',
          'You must only post content you own or have permission to share — see our Copyright Policy for how infringement claims are handled.'
        ]
      },
      {
        heading: 'Content Restrictions',
        points: [
          'Do not post hate speech, harassment, threats, sexual exploitation content, scams, malware, or unlawful material.',
          'Explicit or intense content must be marked Mature at the chapter level — it is hidden from users who are not confirmed adults.',
          'See our Community Guidelines and Content Policy for the full list of restrictions.'
        ]
      },
      {
        heading: 'Moderation and Enforcement',
        points: [
          'We may remove content, restrict visibility, or suspend accounts that violate these terms.',
          'Copyright strikes count on a rolling 90-day basis; 3 active strikes result in account suspension — see our Copyright Policy for details and how to dispute a strike.',
          'Severe or repeated violations can result in immediate, permanent suspension without prior warning.'
        ]
      },
      {
        heading: 'Changes and Termination',
        points: [
          'We may update these terms as the platform evolves; continued use after an update means you accept the revised terms.',
          'You may deactivate or delete your account at any time from Settings.',
          'We may suspend or terminate accounts that violate these terms or applicable law.'
        ]
      },
      {
        heading: 'Disclaimer',
        points: [
          'ShayeriGram is provided "as is" without warranties of any kind.',
          'We are not liable for content posted by users, or for indirect or consequential damages arising from your use of the platform.'
        ]
      }
    ]
  },
  privacy: {
    title: 'Privacy Policy',
    updated: 'July 12, 2026',
    intro: 'This policy explains what information ShayeriGram collects, why we collect it, and the choices you have.',
    sections: [
      {
        heading: 'What We Collect',
        points: [
          'Account details: username, email, password (stored as a secure hash, never in plain text), full name, bio, and date of birth.',
          'Content you create: posts, stories, chapters, comments, likes, saves, and follows.',
          'Security and usage data: IP address, device/browser details, login attempts, and signals used to detect abuse.'
        ]
      },
      {
        heading: 'Why We Collect Date of Birth',
        points: [
          'To confirm you meet the minimum age (13) required to use ShayeriGram.',
          'To determine whether Mature-tagged content can be shown to you — this content is hidden by default unless you are a confirmed adult.',
          'Your date of birth is stored securely and is never shown to other users.'
        ]
      },
      {
        heading: 'Users Under 18',
        points: [
          "Accounts belonging to users under 18 default to safer settings — Mature-tagged content stays hidden until you're confirmed as an adult.",
          "India's data protection rules for users under 18 are still evolving as of 2026; we follow the same practical, industry-standard safety approach used by major platforms and will update this policy as clearer requirements are established."
        ]
      },
      {
        heading: 'How We Use Information',
        points: [
          'To operate your account and display your content on the platform.',
          'To secure the platform, detect abuse, investigate reports, and enforce our policies.',
          'To improve reliability and the overall product experience.'
        ]
      },
      {
        heading: 'Third-Party Services',
        points: [
          'We use Cloudinary to store and serve images and audio you upload.',
          'We use Cloudflare Turnstile to verify you are not a bot when creating an account.',
          'We do not sell your personal information to third parties.'
        ]
      },
      {
        heading: 'Your Choices',
        points: [
          "You can edit your profile information and delete content you've posted at any time.",
          'You can deactivate or permanently delete your account from Settings.',
          'Some data may be retained for legal, safety, or abuse-prevention reasons even after account deletion.'
        ]
      },
      {
        heading: "Children's Privacy",
        points: [
          'ShayeriGram is not directed at children under 13, and we do not knowingly collect data from anyone under 13.',
          'If you believe a child under 13 has created an account, contact us at [support email] and we will investigate.'
        ]
      },
      {
        heading: 'Grievance Officer',
        points: [
          '[Grievance Officer Name] is the Grievance Officer for ShayeriGram, reachable at [grievance officer email].',
          'Complaints are acknowledged within 24 hours and resolved within 15 days, in line with applicable law.'
        ]
      },
      {
        heading: 'Contact',
        points: [
          'Questions about this policy can be sent to [support email].'
        ]
      }
    ]
  },
  community: {
    title: 'Community Guidelines',
    updated: 'July 12, 2026',
    intro: "ShayeriGram should feel creative, respectful, and safe. These guidelines define what's welcome here and what isn't.",
    sections: [
      {
        heading: 'What Is Welcome',
        points: [
          'Original poetry, shayari, stories, and thoughtful creative writing.',
          'Respectful discussion, feedback, and emotional expression.',
          "Creative, cultural, and personal storytelling that doesn't target or harm others."
        ]
      },
      {
        heading: 'What Is Not Allowed',
        points: [
          'Hate speech, targeted harassment, violent threats, and bullying.',
          'Sexual exploitation, self-harm encouragement, privacy violations, doxxing, and impersonation.',
          "Spam, fake engagement, scams, phishing, and reposting others' work without permission.",
          'Explicit or intense content posted outside a Mature-tagged chapter.'
        ]
      },
      {
        heading: 'Mature Content',
        points: [
          'Writers can mark individual chapters as Mature for explicit or intense content.',
          'Mature-tagged chapters are only shown to users confirmed as 18 or older.',
          'Marking a chapter Mature does not exempt it from our other content rules — illegal content is never allowed, tagged or not.'
        ]
      },
      {
        heading: 'Reporting and Enforcement',
        points: [
          'Anyone can report a post, story, or chapter that breaks these guidelines.',
          'We may warn, remove content, limit reach, temporarily restrict, or permanently ban accounts depending on severity.',
          'Severe violations can lead to immediate suspension without prior warning.'
        ]
      }
    ]
  },
  cookies: {
    title: 'Cookie Policy',
    updated: 'July 12, 2026',
    intro: 'ShayeriGram currently uses essential cookies for authentication, security, and core site functionality — nothing more.',
    sections: [
      {
        heading: 'Why Cookies Are Used',
        points: [
          'To keep you signed in securely between visits.',
          'To maintain your session and protect against abuse (e.g. rate limiting).',
          'To support core product functionality — these cookies are required for the site to work.'
        ]
      },
      {
        heading: "What We Don't Do",
        points: [
          'We do not currently use advertising or third-party tracking cookies.',
          'If this changes in the future, we will update this policy and add a consent flow where legally required.'
        ]
      }
    ]
  },
  content: {
    title: 'Content Policy',
    updated: 'July 12, 2026',
    intro: 'This policy explains what kinds of content are restricted or removed to keep ShayeriGram safe, lawful, and age-appropriate.',
    sections: [
      {
        heading: 'Restricted Content',
        points: [
          'Hate speech, violent threats, targeted harassment, scams, phishing, malware, or promotion of illegal goods.',
          'Sexual exploitation, child safety violations, privacy leaks, doxxing, or impersonation intended to deceive.',
          "Repeated spam, engagement manipulation, or reposting others' work without rights or permission."
        ]
      },
      {
        heading: 'Mature-Tagged Content',
        points: [
          'Explicit or intense romantic/violent content is allowed only within chapters explicitly marked Mature by the writer.',
          'Mature-tagged chapters are hidden from anyone who is not a confirmed adult (18+) on their account.',
          'Content that would otherwise be illegal is never permitted, regardless of tagging.'
        ]
      },
      {
        heading: 'Reporting and Enforcement',
        points: [
          'Users can report any post, story, or chapter directly from the platform.',
          'Reported content is reviewed, and may be removed, age-restricted, or escalated for further review.',
          'Accounts that repeatedly violate these rules may be suspended or permanently banned.'
        ]
      }
    ]
  },
  copyright: {
    title: 'Copyright Policy',
    updated: 'July 12, 2026',
    intro: 'You may only post content you own or have permission to share. This policy explains how we handle copyright reports and strikes.',
    sections: [
      {
        heading: 'Filing a Report',
        points: [
          'If you believe your copyrighted work has been posted on ShayeriGram without permission, you can report the specific post, story, or chapter.',
          'For copyright reports that need more detail, contact [copyright contact email].'
        ]
      },
      {
        heading: 'What Happens on a Report',
        points: [
          'Reported content is reviewed, and if the report is upheld, the specific content is removed and the uploader receives a copyright strike.',
          "The uploader is notified when a strike is issued and can dispute it if they believe the content isn't infringing."
        ]
      },
      {
        heading: 'Strikes and Suspension',
        points: [
          'Copyright strikes count on a rolling 90-day basis — a strike older than 90 days no longer counts toward suspension.',
          '3 active strikes within that window result in account suspension.',
          "A disputed strike is paused (doesn't count) while under review; if the dispute is upheld in the uploader's favor, the strike is removed and the content is restored."
        ]
      },
      {
        heading: 'Contact',
        points: [
          'Copyright-related questions can be sent to [copyright contact email].'
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

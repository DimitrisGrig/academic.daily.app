import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Tag } from "antd";
import {
  FireOutlined,
  BookOutlined,
  TeamOutlined,
  BellOutlined,
  SearchOutlined,
  SettingOutlined,
  HistoryOutlined,
  TagOutlined,
  StarOutlined,
  ArrowLeftOutlined,
} from "@ant-design/icons";
import { IoBookmarkOutline } from "react-icons/io5";
import { MdOutlineRssFeed } from "react-icons/md";
import { BsFillJournalBookmarkFill } from "react-icons/bs";
import { PiFileArchiveThin } from "react-icons/pi";
import { SiZotero } from "react-icons/si";

const SECTIONS = [
  { id: "getting-started", label: "Getting Started" },
  { id: "main-feed", label: "Personalized Feed" },
  { id: "custom-feeds", label: "Custom Feeds" },
  { id: "journal-follows", label: "Following Journals" },
  { id: "bookmarks", label: "Bookmarks" },
  { id: "groups", label: "Research Groups" },
  { id: "bioarchive", label: "BioArchive (Preprints)" },
  { id: "topics-tags", label: "Topics & Tags" },
  { id: "history", label: "Reading History" },
  { id: "search", label: "Search" },
  { id: "zotero", label: "Zotero Integration" },
  { id: "settings", label: "Settings & Profile" },
  { id: "faq", label: "FAQ" },
];

function Section({ id, icon, title, children }: { id: string; icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="mb-16 scroll-mt-6">
      <div className="flex items-center gap-3 mb-6 pb-3 border-b border-indigo-100">
        <span className="text-2xl text-indigo-600">{icon}</span>
        <h2 className="text-2xl font-bold text-gray-900 m-0">{title}</h2>
      </div>
      <div className="space-y-4 text-gray-700 leading-relaxed">{children}</div>
    </section>
  );
}

function Step({ number, title, children }: { number: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-4">
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-sm">{number}</div>
      <div>
        <p className="font-semibold text-gray-900 mb-1">{title}</p>
        <p className="text-gray-600 text-sm">{children}</p>
      </div>
    </div>
  );
}

function TipBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-indigo-50 border-l-4 border-indigo-400 rounded-r-lg p-4 my-4">
      <p className="text-sm text-indigo-800 m-0">
        <strong>Tip:</strong> {children}
      </p>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 flex gap-4">
      <div className="flex-shrink-0 w-10 h-10 bg-indigo-50 rounded-lg flex items-center justify-center text-indigo-600 text-xl">{icon}</div>
      <div>
        <p className="font-semibold text-gray-900 mb-1">{title}</p>
        <p className="text-sm text-gray-500 m-0">{description}</p>
      </div>
    </div>
  );
}

function Documentation() {
  const navigate = useNavigate();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    const prevTitle = document.title;
    document.title = "Documentation - Daily Academic | Research Feed for Scientists";

    let metaDesc = document.querySelector('meta[name="description"]');
    if (!metaDesc) {
      metaDesc = document.createElement("meta");
      metaDesc.setAttribute("name", "description");
      document.head.appendChild(metaDesc);
    }
    metaDesc.setAttribute(
      "content",
      "Complete guide to Daily Academic: personalized research feeds, custom feeds, bookmarks, research groups, BioArchive preprints, Zotero integration, and more. Learn how to stay on top of scientific literature."
    );

    let metaKeywords = document.querySelector('meta[name="keywords"]');
    if (!metaKeywords) {
      metaKeywords = document.createElement("meta");
      metaKeywords.setAttribute("name", "keywords");
      document.head.appendChild(metaKeywords);
    }
    metaKeywords.setAttribute(
      "content",
      "academic research feed, scientific literature tracker, PubMed feed, custom research feed, journal follows, research bookmarks, Zotero integration, BioArchive preprints, research groups"
    );

    return () => {
      document.title = prevTitle;
    };
  }, []);

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Hero */}
      <header className="bg-gray-150">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
          <button
            onClick={() => navigate("/MainFeed")}
            className="flex items-center gap-2 text-gray-700 hover:text-blue-600 text-sm mb-8 transition-colors cursor-pointer bg-transparent border-0"
          >
            <ArrowLeftOutlined />
            Back to Feed
          </button>
          <div className="max-w-3xl">
            <Tag color="blue" className="mb-4 text-xs font-semibold uppercase tracking-wider bg-indigo-500 border-indigo-400">
              Documentation
            </Tag>
            <h1 className="text-4xl sm:text-5xl font-semibold mb-4 leading-tight text-gray-800">How to use Daily Academic</h1>
            <p className="text-lg sm:text-xl text-gray-500 font-semibold leading-relaxed">
              Daily Academic delivers a personalized stream of scientific papers tailored to your research interests. This guide covers every feature
              so you can get the most out of your research workflow.
            </p>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
        <div className="flex gap-10">
          {/* Sticky sidebar nav - desktop */}
          <nav className="hidden lg:block w-56 flex-shrink-0" aria-label="Documentation sections">
            <div className="sticky top-6">
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">On this page</p>
              <ul className="space-y-0.5 list-none p-0 m-0">
                {SECTIONS.map(s => (
                  <li key={s.id}>
                    <button
                      onClick={() => {
                        document.getElementById(s.id)?.scrollIntoView({ behavior: "smooth", block: "start" });
                      }}
                      className="w-full text-left text-sm text-gray-500 hover:text-indigo-600 py-1.5 px-2 rounded-md hover:bg-indigo-50 transition-colors cursor-pointer bg-transparent border-0"
                    >
                      {s.label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </nav>

          {/* Mobile nav toggle */}
          <div className="lg:hidden w-full mb-6">
            <button
              onClick={() => setMobileNavOpen(v => !v)}
              className="w-full flex items-center justify-between bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm font-medium text-gray-700 shadow-sm cursor-pointer"
            >
              <span>Jump to section</span>
              <span className="text-indigo-600">{mobileNavOpen ? "▲" : "▼"}</span>
            </button>
            {mobileNavOpen && (
              <div className="bg-white border border-gray-200 rounded-xl mt-1 shadow-md overflow-hidden">
                {SECTIONS.map(s => (
                  <a
                    key={s.id}
                    href={`#${s.id}`}
                    onClick={() => setMobileNavOpen(false)}
                    className="block px-4 py-2.5 text-sm text-gray-700 hover:bg-indigo-50 hover:text-indigo-700 border-b border-gray-100 last:border-0"
                  >
                    {s.label}
                  </a>
                ))}
              </div>
            )}
          </div>

          {/* Main content */}
          <article className="flex-1 min-w-0">
            {/* - Getting Started - */}
            <Section id="getting-started" icon={<StarOutlined />} title="Getting Started">
              <p>
                Daily Academic curates peer-reviewed papers from thousands of journals and matches them to your specific research interests using
                AI-powered semantic similarity. Here's how to set it up in minutes.
              </p>

              <h3 className="text-lg font-semibold text-gray-900 mt-6 mb-4">Initial setup</h3>
              <div className="space-y-5">
                <Step number={1} title="Sign in with your account">
                  Log in using your email or Google account. Your profile and preferences are securely stored.
                </Step>
                <Step number={2} title="Describe your research interests">
                  On the onboarding screen, write a short paragraph describing what you study - the more specific the better. For example:{" "}
                  <em>"I study mRNA splicing mechanisms in neurodegeneration and follow advances in CRISPR-based therapeutic approaches."</em>
                </Step>
                <Step number={3} title="Connect your Google Scholar profile (optional)">
                  Paste your Google Scholar profile URL to let Daily Academic analyse your publication history and further personalize your feed based
                  on the topics you actually publish on.
                </Step>
                <Step number={4} title="Your feed is ready">
                  You'll land on your personalized Main Feed, already populated with the most relevant papers for your interests. The feed improves
                  over time as you interact with articles.
                </Step>
              </div>

              <TipBox>
                You can update your research interests at any time from <strong>Settings → Feed Settings</strong>. The feed recalibrates within a few
                minutes.
              </TipBox>

              <h3 className="text-lg font-semibold text-gray-900 mt-6 mb-3">What Daily Academic indexes</h3>
              <p>
                Articles are sourced from PubMed and major biomedical, life science, and interdisciplinary journals. Preprints from bioRxiv and
                medRxiv are available separately in the{" "}
                <a href="#bioarchive" className="text-indigo-600 hover:underline">
                  BioArchive
                </a>{" "}
                section.
              </p>
            </Section>

            {/* - Main Feed - */}
            <Section id="main-feed" icon={<FireOutlined />} title="Personalized Feed">
              <p>
                The <strong>Main Feed</strong> is your daily dashboard for new research. It surfaces papers most relevant to your stated interests,
                ranked by semantic similarity to your research profile.
              </p>

              <h3 className="text-lg font-semibold text-gray-900 mt-6 mb-3">Sorting options</h3>
              <div className="grid sm:grid-cols-2 gap-3">
                <FeatureCard
                  icon="🎯"
                  title="Recommended"
                  description="Articles ranked by how closely they match your research interests (default)."
                />
                <FeatureCard icon="🆕" title="New" description="Most recently published or indexed papers, sorted by date." />
                <FeatureCard icon="👍" title="Top" description="Articles with the most upvotes from the community." />
                <FeatureCard icon="💬" title="Discussed" description="Papers with the most active discussion in Research Groups." />
              </div>

              <h3 className="text-lg font-semibold text-gray-900 mt-6 mb-3">Article actions</h3>
              <p>On each article card you can:</p>
              <ul className="list-none space-y-2 mt-2">
                {[
                  ["👍 Upvote", "Signal that a paper is relevant or high-quality. Upvotes improve your feed recommendations."],
                  ["✓ Mark as read", "Track which papers you've already reviewed. Read articles appear in your History."],
                  ["🔖 Bookmark", "Save an article to a named folder for later reference."],
                  ["💬 Comment", "Discuss an article within a Research Group you belong to."],
                  ["↗ Share", "Copy a shareable link or send to a group."],
                  ["📋 Add to group", "Post the article directly into a Research Group's shared feed."],
                ].map(([action, desc]) => (
                  <li key={action} className="flex gap-3 text-sm">
                    <span className="font-medium text-gray-800 w-36 flex-shrink-0">{action}</span>
                    <span className="text-gray-600">{desc}</span>
                  </li>
                ))}
              </ul>

              <h3 className="text-lg font-semibold text-gray-900 mt-6 mb-3">Article detail panel</h3>
              <p>
                Click any article title to open the detail panel. There you'll find the full abstract, author list, journal impact factor, open access
                status, graphical abstract (when available), MeSH terms, figures, and links to the DOI, PubMed, and PMC.
              </p>

              <TipBox>
                The <strong>"You might have missed this"</strong> widget occasionally highlights high-relevance papers from earlier weeks that you
                haven't seen yet - perfect for catching up after a busy period.
              </TipBox>
            </Section>

            {/* - Custom Feeds - */}
            <Section id="custom-feeds" icon={<MdOutlineRssFeed />} title="Custom Feeds">
              <p>
                Custom Feeds let you define focused reading lists around specific topics, journals, or publication criteria - completely separate from
                your main personalized feed.
              </p>

              <h3 className="text-lg font-semibold text-gray-900 mt-6 mb-3">Creating a custom feed</h3>
              <div className="space-y-4">
                <Step number={1} title="Open the sidebar and click + next to Feeds">
                  The sidebar lists all your custom feeds. Click the <strong>+</strong> icon to create a new one.
                </Step>
                <Step number={2} title="Name your feed and pick an icon">
                  Give the feed a memorable name (e.g. "CRISPR Therapeutics") and choose an emoji icon to identify it.
                </Step>
                <Step number={3} title="Write a topic prompt">
                  Describe what the feed should cover in plain language. The system uses this to find semantically matching articles.
                </Step>
                <Step number={4} title="Refine with filters (optional)">
                  Narrow or expand the feed using any combination of source journals, publishers, publication types, time range, and content
                  preferences (open access only, graphical abstract only).
                </Step>
              </div>

              <h3 className="text-lg font-semibold text-gray-900 mt-6 mb-3">Feed filters explained</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-indigo-50">
                      <th className="text-left px-3 py-2 font-semibold text-indigo-700 rounded-tl-lg">Filter</th>
                      <th className="text-left px-3 py-2 font-semibold text-indigo-700 rounded-tr-lg">What it does</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ["Source journals", "Limit articles to specific journals or all journals from chosen publishers."],
                      ["Publication type", "Show only original research, reviews, meta-analyses, case reports, etc."],
                      ["Time range", "Restrict to articles published in the last 30, 90, 180 days, or all time."],
                      ["Default sorting", "Choose how articles are ordered when you open the feed."],
                      ["Open access only", "Show only freely available full-text articles."],
                      ["Graphical abstract only", "Show only articles that have a graphical abstract image."],
                    ].map(([f, d]) => (
                      <tr key={f} className="border-b border-gray-100">
                        <td className="px-3 py-2 font-medium text-gray-800 align-top">{f}</td>
                        <td className="px-3 py-2 text-gray-600">{d}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <TipBox>
                You can edit any custom feed at any time by hovering over it in the sidebar and clicking the edit icon. Changes take effect
                immediately.
              </TipBox>
            </Section>

            {/* - Journal Follows - */}
            <Section id="journal-follows" icon={<BsFillJournalBookmarkFill />} title="Following Journals">
              <p>
                If you want to track every new article from a specific journal regardless of topic relevance, use <strong>Journal Follows</strong>.
                This creates a dedicated feed for that journal in your sidebar.
              </p>

              <h3 className="text-lg font-semibold text-gray-900 mt-6 mb-3">How to follow a journal</h3>
              <div className="space-y-4">
                <Step number={1} title="Click + next to Journals in the sidebar">
                  This opens the journal search dialog.
                </Step>
                <Step number={2} title="Search for the journal by name or ISSN">
                  Type part of the journal title - the autocomplete will suggest matching journals.
                </Step>
                <Step number={3} title="Click Follow">
                  The journal appears in your sidebar under Journals. Click it to see all recent articles from that journal.
                </Step>
              </div>

              <TipBox>
                You can also follow a journal directly from the article detail panel - click the journal name and select{" "}
                <strong>"Follow this journal"</strong>.
              </TipBox>
            </Section>

            {/* - Bookmarks - */}
            <Section id="bookmarks" icon={<IoBookmarkOutline />} title="Bookmarks">
              <p>
                Bookmarks let you save papers to named folders so you can return to them later. This is useful for building reading lists for a
                project, grant application, review paper, or literature class.
              </p>

              <h3 className="text-lg font-semibold text-gray-900 mt-6 mb-3">Organizing with folders</h3>
              <div className="space-y-4">
                <Step number={1} title="Create a folder">
                  Click <strong>+</strong> next to Bookmarks in the sidebar. Give the folder a descriptive name.
                </Step>
                <Step number={2} title="Bookmark an article">
                  On any article card, click the bookmark icon. A modal will ask which folder to save it to.
                </Step>
                <Step number={3} title="Browse saved articles">
                  Click a folder in the sidebar to open your saved articles. You can apply the same sorting options as the main feed.
                </Step>
                <Step number={4} title="Remove or move bookmarks">
                  Open the folder, find the article, and use the dropdown menu to remove it or move it to another folder.
                </Step>
              </div>

              <TipBox>
                Bookmarked articles remain saved even after they scroll out of your main feed. They're great for building a "to-read" list before a
                journal club meeting.
              </TipBox>
            </Section>

            {/* - Groups - */}
            <Section id="groups" icon={<TeamOutlined />} title="Research Groups">
              <p>
                Research Groups are collaborative spaces where you and your team can share articles, discuss findings, and keep everyone aligned on
                the latest literature - all within Daily Academic.
              </p>

              <h3 className="text-lg font-semibold text-gray-900 mt-6 mb-3">Creating a group</h3>
              <div className="space-y-4">
                <Step number={1} title="Click + next to Groups in the sidebar">
                  Fill in a group name, optional description, and choose between Public (discoverable) or Private (invite-only).
                </Step>
                <Step number={2} title="Invite members">
                  Share the group link or search for users by email to add them as members.
                </Step>
                <Step number={3} title="Share articles to the group">
                  From any feed, open an article and click <strong>"Add to group"</strong> - or use the share button on the article card. It will
                  appear in the group's shared feed.
                </Step>
                <Step number={4} title="Discuss in the comments panel">
                  Each shared article has a group-specific comments thread. Members can post notes, questions, and reactions directly on the paper.
                </Step>
              </div>

              <h3 className="text-lg font-semibold text-gray-900 mt-6 mb-3">Joining existing groups</h3>
              <p>
                Go to <strong>Find Groups</strong> (sidebar → Groups section) to browse and search public groups by name or topic. Click{" "}
                <strong>Join</strong> to become a member instantly.
              </p>

              <h3 className="text-lg font-semibold text-gray-900 mt-6 mb-3">Group notifications</h3>
              <p>
                You'll receive in-app notifications when someone shares a new article or comments in a group you belong to. Visit the{" "}
                <strong>Notifications</strong> page to see all recent group activity.
              </p>

              <TipBox>
                Group admins can manage members, rename the group, change its visibility, and remove members from the group settings panel.
              </TipBox>
            </Section>

            {/* - BioArchive - */}
            <Section id="bioarchive" icon={<PiFileArchiveThin />} title="BioArchive - Preprints">
              <p>
                The <strong>BioArchive</strong> section gives you AI-ranked access to preprints from <strong>bioRxiv</strong> and{" "}
                <strong>medRxiv</strong> - the two largest biology and medicine preprint servers. Stay ahead of the peer-review timeline.
              </p>

              <h3 className="text-lg font-semibold text-gray-900 mt-6 mb-3">Key features</h3>
              <div className="grid sm:grid-cols-2 gap-3">
                <FeatureCard
                  icon={<PiFileArchiveThin />}
                  title="Similarity ranking"
                  description="Preprints are ranked by semantic similarity to your research interests, just like the main feed."
                />
                <FeatureCard icon="🗂" title="Server filter" description="Filter by bioRxiv, medRxiv, or view all preprints together." />
                <FeatureCard
                  icon="📂"
                  title="Category filter"
                  description="Narrow results to a specific subject category (e.g. Neuroscience, Genomics, Infectious Diseases)."
                />
                <FeatureCard icon="📅" title="Sort by date" description="Switch between similarity-based ranking and chronological order." />
              </div>

              <TipBox>
                Preprints have not yet completed peer review. Always verify claims before citing - look for the corresponding published version when
                it appears.
              </TipBox>
            </Section>

            {/* - Topics & Tags - */}
            <Section id="topics-tags" icon={<TagOutlined />} title="Topics & Tags">
              <p>
                Every article is tagged with one or more research topics drawn from a curated taxonomy spanning all major scientific disciplines. Use
                the <strong>Tags</strong> page to browse the full topic tree and find papers by subject area.
              </p>

              <h3 className="text-lg font-semibold text-gray-900 mt-6 mb-3">Using the Tags page</h3>
              <ul className="space-y-2 text-sm">
                <li className="flex gap-2">
                  <span className="text-indigo-500">▸</span>
                  <span>
                    <strong>Browse categories:</strong> Topics are grouped into broad categories (e.g. Molecular Biology, Neuroscience, Machine
                    Learning). Expand any category to see its sub-topics.
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="text-indigo-500">▸</span>
                  <span>
                    <strong>Search topics:</strong> Use the search bar to find a specific topic by keyword.
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="text-indigo-500">▸</span>
                  <span>
                    <strong>Trending & popular topics:</strong> See which tags are currently trending and which have the most articles.
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="text-indigo-500">▸</span>
                  <span>
                    <strong>Click a tag:</strong> Opens the Explore view for that topic, showing the top-performing articles in it.
                  </span>
                </li>
              </ul>

              <h3 className="text-lg font-semibold text-gray-900 mt-6 mb-3">Article tags</h3>
              <p>
                On any article card, click a tag chip to jump directly to that topic's Explore view. This is a quick way to drill down into adjacent
                research areas.
              </p>
            </Section>

            {/* - History - */}
            <Section id="history" icon={<HistoryOutlined />} title="Reading History">
              <p>
                The <strong>History</strong> page logs every article you've opened or marked as read. It's your personal reading archive, searchable
                and sortable.
              </p>

              <h3 className="text-lg font-semibold text-gray-900 mt-6 mb-3">What you can do in History</h3>
              <ul className="space-y-2 text-sm">
                <li className="flex gap-2">
                  <span className="text-indigo-500">▸</span>
                  <span>
                    <strong>Search:</strong> Filter your reading history by keyword to find a specific paper you remember reading.
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="text-indigo-500">▸</span>
                  <span>
                    <strong>Sort:</strong> Order by most recent, most upvoted, or most commented.
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="text-indigo-500">▸</span>
                  <span>
                    <strong>Re-read & share:</strong> All the same article actions are available - bookmark, share, add to group.
                  </span>
                </li>
              </ul>

              <TipBox>
                Your reading activity also feeds into your <strong>Metrics</strong> dashboard (Settings → Profile → Reading Overview) where you can
                see your weekly reading stats and top topics.
              </TipBox>
            </Section>

            {/* - Search - */}
            <Section id="search" icon={<SearchOutlined />} title="Search">
              <p>
                The global search bar (top navigation, or keyboard shortcut) lets you find anything indexed in Daily Academic across three dimensions.
              </p>

              <h3 className="text-lg font-semibold text-gray-900 mt-6 mb-3">Search targets</h3>
              <div className="grid sm:grid-cols-3 gap-3">
                <FeatureCard
                  icon={<BookOutlined />}
                  title="Articles"
                  description="Full-text search across titles and abstracts of all indexed papers."
                />
                <FeatureCard
                  icon={<TagOutlined />}
                  title="Topics"
                  description="Find topics and sub-topics in the taxonomy to jump to their Explore view."
                />
                <FeatureCard
                  icon={<BsFillJournalBookmarkFill />}
                  title="Journals"
                  description="Search journal names to follow them or browse their recent publications."
                />
              </div>

              <h3 className="text-lg font-semibold text-gray-900 mt-6 mb-3">Search tips</h3>
              <ul className="space-y-2 text-sm">
                <li className="flex gap-2">
                  <span className="text-indigo-500">▸</span>
                  <span>Use specific terminology (e.g. gene names, disease names, method names) for more precise results.</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-indigo-500">▸</span>
                  <span>
                    Switch between the <strong>Articles</strong>, <strong>Topics</strong>, and <strong>Journals</strong> tabs to filter by result
                    type.
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="text-indigo-500">▸</span>
                  <span>
                    Sort article results by <strong>relevance</strong>, <strong>date</strong>, <strong>upvotes</strong>, or <strong>comments</strong>.
                  </span>
                </li>
              </ul>
            </Section>

            {/* - Zotero - */}
            <Section id="zotero" icon={<SiZotero />} title="Zotero Integration">
              <p>
                Daily Academic connects directly to your <strong>Zotero</strong> reference manager. Export any article to your Zotero library with a
                single click - no manual entry required.
              </p>

              <h3 className="text-lg font-semibold text-gray-900 mt-6 mb-3">Connecting Zotero</h3>
              <div className="space-y-4">
                <Step number={1} title="Go to Settings → Reference Managers">
                  Navigate to <strong>Settings</strong> (sidebar bottom) and select the <strong>Reference Managers</strong> tab.
                </Step>
                <Step number={2} title="Click Connect Zotero">
                  You'll be redirected to Zotero's OAuth authorization page. Log in with your Zotero account and grant access.
                </Step>
                <Step number={3} title="Authorization complete">
                  You're redirected back to Daily Academic. Your Zotero libraries and collections are now available.
                </Step>
              </div>

              <h3 className="text-lg font-semibold text-gray-900 mt-6 mb-3">Exporting an article</h3>
              <p>
                Open any article's detail panel and click <strong>"Export to Zotero"</strong>. Choose the target library and collection, then confirm.
                The full metadata (title, authors, journal, DOI, abstract) is transferred automatically.
              </p>

              <TipBox>
                You can disconnect Zotero at any time from the same Reference Managers settings tab without losing any previously exported references.
              </TipBox>
            </Section>

            {/* - Settings - */}
            <Section id="settings" icon={<SettingOutlined />} title="Settings & Profile">
              <p>
                Access <strong>Settings</strong> from the bottom of the sidebar. It's organized into six tabs:
              </p>

              <div className="space-y-4 mt-4">
                {[
                  {
                    tab: "Profile",
                    desc: "View your reading overview (weekly stats, top topics, most-read journals) and activity timeline. Update your display name and avatar via Account.",
                  },
                  {
                    tab: "Account",
                    desc: "Manage your login credentials, connected social accounts, and two-factor authentication through the Clerk profile panel.",
                  },
                  {
                    tab: "Notifications",
                    desc: "Control which events trigger in-app notifications - new group activity, article comments, and system announcements.",
                  },
                  {
                    tab: "Reference Managers",
                    desc: "Connect or disconnect your Zotero account. See the Zotero Integration section above.",
                  },
                  {
                    tab: "Feed Settings",
                    desc: "Update your research interest prompt and your Google Scholar profile URL. Changes here recalibrate your Main Feed recommendations.",
                  },
                  {
                    tab: "Support",
                    desc: "Report a bug, request a feature, or contact the team. Links to the feedback form and community channels.",
                  },
                ].map(({ tab, desc }) => (
                  <div key={tab} className="flex gap-4 p-4 bg-white rounded-xl border border-gray-100 shadow-sm">
                    <div className="flex-shrink-0">
                      <span className="inline-block bg-indigo-600 text-white text-xs font-semibold px-2.5 py-1 rounded-full">{tab}</span>
                    </div>
                    <p className="text-sm text-gray-600 m-0">{desc}</p>
                  </div>
                ))}
              </div>
            </Section>

            {/* - Notifications - */}
            <section id="notifications" className="mb-16 scroll-mt-6">
              <div className="flex items-center gap-3 mb-6 pb-3 border-b border-indigo-100">
                <span className="text-2xl text-indigo-600">
                  <BellOutlined />
                </span>
                <h2 className="text-2xl font-bold text-gray-900 m-0">Notifications</h2>
              </div>
              <p className="text-gray-700 leading-relaxed">
                The <strong>Notifications</strong> page shows all recent activity relevant to you: new articles shared in your groups, replies to your
                comments, and platform announcements. Click a notification to jump directly to the relevant article or group.
              </p>
              <TipBox>
                Notification preferences (which events alert you) are managed under <strong>Settings → Notifications</strong>.
              </TipBox>
            </section>

            {/* - FAQ - */}
            <Section id="faq" icon="❓" title="Frequently Asked Questions">
              <div className="space-y-6">
                {[
                  {
                    q: "How often is the feed updated?",
                    a: "New articles are indexed daily from PubMed and major journal feeds. Preprints from bioRxiv and medRxiv are updated multiple times per day.",
                  },
                  {
                    q: "How does the relevance ranking work?",
                    a: "Each article is embedded into a semantic vector and compared against your research interest profile using cosine similarity. The similarity score (shown on each card) reflects this match.",
                  },
                  {
                    q: "Can I use Daily Academic on mobile?",
                    a: "Yes. The interface is fully responsive and works in any modern mobile browser. A dedicated mobile app is on the roadmap.",
                  },
                  {
                    q: "Is Daily Academic free?",
                    a: "Daily Academic is currently free during the early access period. Pricing details will be communicated before any changes take effect.",
                  },
                  {
                    q: "How do I improve my feed quality?",
                    a: "Upvote relevant articles, mark papers as read, and keep your interest prompt in Feed Settings up to date. The more you interact, the more accurate your recommendations become.",
                  },
                  {
                    q: "Can I export my bookmarks?",
                    a: "You can export individual articles to Zotero using the Zotero integration. Bulk export functionality is coming in a future update.",
                  },
                  {
                    q: "How do I report a bug or request a feature?",
                    a: "Go to Settings → Support. You can submit a bug report or feature request directly from there.",
                  },
                ].map(({ q, a }) => (
                  <div key={q} className="border-b border-gray-100 pb-5 last:border-0 last:pb-0">
                    <p className="font-semibold text-gray-900 mb-1">{q}</p>
                    <p className="text-sm text-gray-600 m-0">{a}</p>
                  </div>
                ))}
              </div>
            </Section>

            {/* Footer CTA */}
            <div className="bg-purple-950 rounded-2xl p-8 text-center text-white mt-8">
              <h2 className="text-2xl font-bold mb-2">Ready to get started?</h2>
              <p className="text-indigo-100 mb-6">Head back to your feed and start discovering the research that matters to you.</p>
              <button
                onClick={() => navigate("/MainFeed")}
                className="bg-white text-indigo-700 font-semibold px-8 py-3 rounded-xl hover:bg-indigo-50 transition-colors cursor-pointer border-0"
              >
                Go to My Feed
              </button>
            </div>
          </article>
        </div>
      </div>
    </main>
  );
}

export default Documentation;

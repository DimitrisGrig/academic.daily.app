import { useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import axiosInstance from "../../lib/axios";
import {
  FiBook,
  FiCalendar,
  FiUser,
  FiZap,
  FiAward,
  FiChevronLeft,
  FiChevronRight,
  FiHash,
  FiEye,
  FiBookOpen,
  FiStar,
  FiTrendingUp,
} from "react-icons/fi";
import { Tooltip } from "antd";
import { FaRegPaperPlane } from "react-icons/fa";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Article {
  id: number;
  publication_type: string | null;
  issn: string | null;
  title: string;
  abstract: string;
  journal: string;
  publication_date: string;
  created_at?: string;
  authors_full: string[] | string;
  affiliations: string | null;
  doi: string | null;
  pmcid: string | null;
  pmid: string | null;
  mesh_terms: string | null;
  figures_urls: string[] | string | null;
  unpaywall_status: string | null;
  is_open_access_unpaywall: boolean;
  graphical_abstract_path: string | null;
  similarity_score: number;
  upvotes: number;
  user_has_upvoted: boolean;
  user_has_read: boolean;
  comments_count?: number;
  wos_journal?: {
    journal_impact_factor: number | null;
    five_year_impact_factor: number | null;
    country: string | null;
  } | null;
  scimagojr_rankings?: {
    publisher: string | null;
    categories: string | null;
    areas: string | null;
  } | null;
  journal_icon_url?: string | null;
}

interface YouMightMissThisProps {
  onCardClick: (article: Article) => void;
  layout?: "horizontal" | "vertical";
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatAuthors = (authors: string[] | string) => {
  if (!authors) return "Unknown authors";
  const cleanAuthor = (a: string) => a.split(":")[0].trim();
  if (typeof authors === "string") {
    return authors
      .split(";")
      .map(a => cleanAuthor(a))
      .filter(a => a.length > 0)
      .join(", ");
  }
  if (!Array.isArray(authors) || authors.length === 0) return "Unknown authors";
  const cleaned = authors.map(cleanAuthor);
  if (cleaned.length <= 2) return cleaned.join(", ");
  return `${cleaned.slice(0, 2).join(", ")} et al.`;
};

const getFirstFigureUrl = (figuresUrls: string[] | string | null): string | null => {
  if (!figuresUrls) return null;
  if (Array.isArray(figuresUrls)) return figuresUrls.length > 0 ? figuresUrls[0] : null;
  if (typeof figuresUrls === "string") {
    const urls = figuresUrls
      .split(",")
      .map((u: string) => u.trim())
      .filter((u: string) => u.length > 0);
    return urls.length > 0 ? urls[0] : null;
  }
  return null;
};

const getMeshTerms = (meshTermsStr: string | null) => {
  if (!meshTermsStr || meshTermsStr.trim().length === 0) return [];
  return meshTermsStr
    .split(";")
    .map(t => t.trim())
    .filter(t => t.length > 0)
    .map(term => {
      const mainTerm = term.split("/")[0].trim();
      const hasAsterisk = mainTerm.includes("*");
      const displayTerm = hasAsterisk ? mainTerm.slice(0, -1).trim() : mainTerm;
      return { display: displayTerm, hasAsterisk };
    })
    .slice(0, 2);
};

const getRelevanceLabel = (score: number): { label: string; color: string; bg: string; border: string } => {
  if (score >= 0.75) return { label: "High Match", color: "#92400e", bg: "#fef3c7", border: "#fcd34d" };
  if (score >= 0.6) return { label: "Strong Match", color: "#1e40af", bg: "#eff6ff", border: "#bfdbfe" };
  return { label: "Relevant", color: "#5b21b6", bg: "#f5f3ff", border: "#ddd6fe" };
};

// Returns a subtle signal badge based on the article's rank in the list
const getSignalBadge = (
  index: number,
  score: number
): { label: string; icon: "trending" | "star" | "zap" | null; color: string; bg: string; border: string } | null => {
  if (index === 0) return { label: "Top Pick", icon: "star", color: "#92400e", bg: "#fffbeb", border: "#fde68a" };
  if (score >= 0.8) return { label: "Highly Relevant", icon: "zap", color: "#065f46", bg: "#ecfdf5", border: "#a7f3d0" };
  if (score >= 0.7 && index <= 2) return { label: "Trending", icon: "trending", color: "#1e3a5f", bg: "#f0f7ff", border: "#bfdbfe" };
  return null;
};

// ─── Skeleton card ────────────────────────────────────────────────────────────

const SkeletonCard = ({ isFirst = false, layout = "horizontal" }: { isFirst?: boolean; layout?: "horizontal" | "vertical" }) => (
  <div
    className={`bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden animate-pulse ${
      layout === "vertical" ? "w-full flex-shrink-0" : `flex-shrink-0 ${isFirst ? "w-64 sm:w-80" : "w-60 sm:w-72"}`
    }`}
  >
    {/* thumbnail placeholder */}
    <div className={`${isFirst ? "h-40" : "h-36"} bg-gray-200`} />
    <div className="p-4 space-y-3">
      {/* signal badges */}
      <div className="flex gap-1.5">
        <div className="h-5 w-20 bg-indigo-100 rounded-full" />
        <div className="h-5 w-16 bg-amber-100 rounded-full" />
      </div>
      {/* title lines */}
      <div className="h-3 bg-gray-200 rounded-full w-4/5" />
      <div className="h-3 bg-gray-200 rounded-full w-full" />
      <div className="h-3 bg-gray-200 rounded-full w-3/4" />
      {/* meta lines */}
      <div className="h-2.5 bg-gray-100 rounded-full w-1/2 mt-2" />
      <div className="h-2.5 bg-gray-100 rounded-full w-2/3" />
      {/* badge pills */}
      <div className="flex gap-2 pt-1">
        <div className="h-5 w-16 bg-gray-100 rounded-full" />
        <div className="h-5 w-20 bg-gray-100 rounded-full" />
      </div>
    </div>
  </div>
);

// ─── Article card ─────────────────────────────────────────────────────────────

const MissedArticleCard = ({
  article,
  onClick,
  index,
  layout = "horizontal",
}: {
  article: Article;
  onClick: () => void;
  index: number;
  layout?: "horizontal" | "vertical";
}) => {
  const isFirst = index === 0;
  const isVertical = layout === "vertical";
  const thumbnail = article.graphical_abstract_path || getFirstFigureUrl(article.figures_urls);
  const meshTerms = getMeshTerms(article.mesh_terms);
  const relevance = getRelevanceLabel(article.similarity_score);
  const signal = getSignalBadge(index, article.similarity_score);
  const pubYear = article.publication_date ? new Date(article.publication_date).getFullYear() : null;

  return (
    <div
      onClick={onClick}
      className={`
        group bg-white rounded-2xl cursor-pointer
        transition-all duration-200 overflow-hidden flex flex-col
        ${
          isVertical
            ? "w-full flex-shrink-0 border border-gray-100 shadow-sm hover:shadow-md hover:-translate-y-0.5"
            : isFirst
              ? "flex-shrink-0 w-64 sm:w-80 border border-indigo-200 shadow-md hover:shadow-xl hover:-translate-y-1.5 ring-1 ring-indigo-100"
              : "flex-shrink-0 w-60 sm:w-72 border border-gray-100 shadow-sm hover:shadow-lg hover:-translate-y-1"
        }
      `}
    >
      {/* ── Top Pick accent bar (first card only, horizontal mode) ── */}
      {isFirst && !isVertical && <div className="h-1 w-full bg-gradient-to-r from-indigo-400 via-violet-400 to-indigo-300 flex-shrink-0" />}

      {/* Thumbnail */}
      {thumbnail && (
        <div className={`relative ${isVertical ? "h-28" : isFirst ? "h-40" : "h-36"} overflow-hidden bg-gray-50 flex-shrink-0`}>
          <img
            src={thumbnail}
            alt="Article visual"
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            onError={e => {
              (e.currentTarget.parentElement as HTMLElement).style.display = "none";
            }}
          />
          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
          {/* Open access badge on image */}
          {article.is_open_access_unpaywall && (
            <span className="absolute top-2 left-2 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500 text-white shadow">
              Open Access
            </span>
          )}
          {/* Top Pick corner badge on image */}
          {isFirst && (
            <span className="absolute top-2 right-2 text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-600 text-white shadow flex items-center gap-1">
              <FiStar className="w-2.5 h-2.5" />
              Top Pick
            </span>
          )}
        </div>
      )}

      {/* ── Top Pick badge when no thumbnail ── */}
      {isFirst && !thumbnail && (
        <div className="px-4 pt-3 flex">
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-600 text-white flex items-center gap-1 shadow-sm">
            <FiStar className="w-2.5 h-2.5" />
            Top Pick
          </span>
        </div>
      )}

      {/* Body */}
      <div className="p-4 flex flex-col gap-2 flex-1">
        {/* Badges row */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Viewed badge */}
          {article.user_has_read && (
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full flex items-center gap-1 bg-gray-100 text-gray-500 border border-gray-200">
              <FiEye className="w-2.5 h-2.5" />
              Viewed
            </span>
          )}

          {/* Signal badge (Trending / Highly Relevant / Top Pick for no-thumbnail first card) */}
          {signal && !isFirst && (
            <Tooltip title="Based on your research interests and recent activity">
              <span
                className="text-[10px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1 cursor-default"
                style={{ color: signal.color, background: signal.bg, border: `1px solid ${signal.border}` }}
              >
                {signal.icon === "trending" && <FiTrendingUp className="w-2.5 h-2.5" />}
                {signal.icon === "zap" && <FiZap className="w-2.5 h-2.5" />}
                {signal.icon === "star" && <FiStar className="w-2.5 h-2.5" />}
                {signal.label}
              </span>
            </Tooltip>
          )}

          {/* Relevance badge */}
          <Tooltip title={`Similarity score: ${(article.similarity_score * 100).toFixed(0)}%`}>
            <span
              className="text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 cursor-default"
              style={{ color: relevance.color, background: relevance.bg, border: `1px solid ${relevance.border}` }}
            >
              <FiZap className="w-2.5 h-2.5" />
              {relevance.label}
            </span>
          </Tooltip>

          {/* Publication type */}
          {article.publication_type && (
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-100">
              {article.publication_type}
            </span>
          )}

          {/* Open Access (no thumbnail) */}
          {!thumbnail && article.is_open_access_unpaywall && (
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100">
              Open Access
            </span>
          )}
        </div>

        {/* Title */}
        <h3
          className={`font-semibold text-gray-900 leading-snug line-clamp-3 group-hover:text-indigo-700 transition-colors ${
            !isVertical && isFirst ? "text-sm sm:text-[15px]" : "text-sm"
          }`}
        >
          {article.title}
        </h3>

        {/* Authors */}
        <div className="flex items-start gap-1.5 text-xs text-gray-500">
          <FiUser className="mt-0.5 shrink-0 w-3 h-3" />
          <span className="line-clamp-1">{formatAuthors(article.authors_full)}</span>
        </div>

        {/* Journal + IF */}
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            {article.journal_icon_url ? (
              <img
                src={article.journal_icon_url}
                alt=""
                className="shrink-0 w-4 h-4 rounded-sm object-contain"
                onError={e => {
                  e.currentTarget.style.display = "none";
                  (e.currentTarget.nextElementSibling as HTMLElement)?.style.removeProperty("display");
                }}
              />
            ) : null}
            <FiBook className="shrink-0 w-3 h-3" style={article.journal_icon_url ? { display: "none" } : undefined} />
            <span className="line-clamp-1">{article.journal || "Unknown journal"}</span>
          </div>
          {article.wos_journal?.journal_impact_factor && (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5">
              <FiAward className="w-2.5 h-2.5" />
              IF {article.wos_journal.journal_impact_factor.toFixed(1)}
            </span>
          )}
        </div>

        {/* Date */}
        {pubYear && (
          <div className="flex items-center gap-1.5 text-[11px] text-gray-400">
            <FiCalendar className="w-3 h-3" />
            <span>{pubYear}</span>
          </div>
        )}

        {/* MeSH Tags */}
        {meshTerms.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-1 border-t border-dashed border-gray-100 mt-auto">
            <FiHash className="text-orange-400 w-3.5 h-3.5 mt-0.5 shrink-0" />
            {meshTerms.map((term, i) => (
              <span key={i} className="text-[10px] px-1.5 py-0 rounded border border-gray-200 text-gray-600 bg-white">
                {term.display}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* CTA strip */}
      <div className="px-4 pb-3">
        <div
          className={`w-full text-center text-xs font-semibold rounded-lg py-1.5 transition-colors ${
            !isVertical && isFirst
              ? "text-indigo-700 bg-indigo-100 group-hover:bg-indigo-200"
              : "text-indigo-600 bg-indigo-50 group-hover:bg-indigo-100"
          }`}
        >
          Read More →
        </div>
      </div>
    </div>
  );
};

// ─── Main component ───────────────────────────────────────────────────────────

export default function YouMightMissThis({ onCardClick, layout = "horizontal" }: YouMightMissThisProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const { data: articles, isLoading } = useQuery<Article[]>({
    queryKey: ["youMightMiss"],
    queryFn: async () => {
      const res = await axiosInstance.get("/mainFeed/you_might_miss?limit=8");
      return res.data;
    },
    staleTime: 5 * 60 * 1000, // 5 min — no need to re-fetch constantly
  });

  // Mark the clicked article as read in the local cache (persists until page refresh),
  // then delegate to the parent handler which posts the click + writes to history.
  const handleClick = (article: Article) => {
    queryClient.setQueryData<Article[]>(["youMightMiss"], prev =>
      prev ? prev.map(a => (a.id === article.id ? { ...a, user_has_read: true } : a)) : []
    );
    onCardClick(article);
  };

  const scroll = (direction: "left" | "right") => {
    if (!scrollRef.current) return;
    const amount = 300;
    scrollRef.current.scrollBy({
      left: direction === "left" ? -amount : amount,
      behavior: "smooth",
    });
  };

  // Don't render the section at all if there are no missed articles
  if (!isLoading && (!articles || articles.length === 0)) return null;

  // ── Vertical (sidebar) layout ──────────────────────────────────────────────
  if (layout === "vertical") {
    return (
      <div className="flex flex-col h-full rounded-2xl border-1 border-gray-400 bg-gradient-to-b from-slate-50 via-white to-indigo-50/30 shadow-sm overflow-hidden">
        {/* Header */}
        <div className="px-4 pt-4 pb-3 flex-shrink-0">
          <div className="flex items-center gap-2.5 mb-2">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-white border border-indigo-200 shadow-sm shrink-0">
              <FaRegPaperPlane className="text-indigo-700 w-5 h-5" />
              {/* <FaPaperPlane className="text-indigo-500 w-5 h-5" /> */}
            </div>
            <div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <h2 className="text-xl font-bold text-indigo-700 leading-none">Don't Miss</h2>
                {/* <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-gray-100 text-yellow-700 border border-indigo-200 leading-none">
                  <FiStar className="w-2 h-2" />
                  Curated
                </span> */}
              </div>
              <p className="text-[12px] text-gray-500 mt-0.5">Top picks you haven't seen yet</p>
            </div>
          </div>
          {/* Accent divider */}
          <div className="h-px bg-gradient-to-r from-indigo-300 via-violet-200 to-transparent" />
        </div>

        {/* Scrollable card list */}
        <div
          className="flex-1 overflow-y-auto px-3 pb-4 flex flex-col gap-3"
          style={{ scrollbarWidth: "thin", scrollbarColor: "#e0e7ff transparent" }}
        >
          {isLoading
            ? Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={i} layout="vertical" />)
            : articles?.map((article, index) => (
                <MissedArticleCard key={article.id} article={article} index={index} layout="vertical" onClick={() => handleClick(article)} />
              ))}
        </div>
      </div>
    );
  }

  // ── Horizontal (default) layout ────────────────────────────────────────────
  return (
    <section className="mb-6 sm:mb-8">
      {/* ── Elevated container ── */}
      <div className="rounded-2xl border border-indigo-100 bg-gradient-to-br from-slate-50 via-white to-indigo-50/40 shadow-sm px-4 sm:px-5 pt-4 sm:pt-5 pb-4 sm:pb-5">
        {/* ── Section header ── */}
        <div className="flex items-center justify-between mb-3 sm:mb-4 gap-2">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            {/* Icon blob — academic style */}
            <div className="flex items-center justify-center w-9 h-9 sm:w-11 sm:h-11 rounded-xl bg-white border border-indigo-200 shadow-sm shrink-0">
              <FiBookOpen className="text-indigo-500 w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl sm:text-2xl font-bold text-indigo-800 leading-none">Don't Miss</h2>
                {/* Curated pill */}
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 border border-indigo-200 leading-none">
                  <FiStar className="w-2.5 h-2.5" />
                  Curated for you
                </span>
              </div>
              <p className="text-xs sm:text-sm text-gray-500 mt-1 hidden sm:block">Top relevant articles you haven't seen yet</p>
            </div>
          </div>

          {/* Scroll arrows */}
          <div className="flex gap-1.5 sm:gap-2 shrink-0">
            <button
              onClick={() => scroll("left")}
              title="Scroll left"
              className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center rounded-full border border-gray-200 text-gray-400 bg-white shadow-sm hover:border-indigo-400 hover:text-indigo-600 transition-colors"
            >
              <FiChevronLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>
            <button
              onClick={() => scroll("right")}
              title="Scroll right"
              className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center rounded-full border border-gray-200 text-gray-400 bg-white shadow-sm hover:border-indigo-400 hover:text-indigo-600 transition-colors"
            >
              <FiChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>
          </div>
        </div>

        {/* ── Thin gradient accent divider ── */}
        <div className="h-px bg-gradient-to-r from-indigo-300 via-violet-200 to-transparent mb-3 sm:mb-4" />

        {/* ── Horizontal scroll strip with fade edges ── */}
        <div className="relative">
          {/* Left fade */}
          <div className="pointer-events-none absolute left-0 top-0 bottom-3 w-6 bg-gradient-to-r from-white/80 to-transparent z-10 rounded-l-xl hidden sm:block" />
          {/* Right fade */}
          <div className="pointer-events-none absolute right-0 top-0 bottom-3 w-10 bg-gradient-to-l from-indigo-50/60 to-transparent z-10 rounded-r-xl hidden sm:block" />

          <div
            ref={scrollRef}
            className="flex gap-3 sm:gap-4 overflow-x-auto pb-3 scroll-smooth"
            style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
          >
            <style>{`
              .you-might-miss-scroll::-webkit-scrollbar { display: none; }
            `}</style>

            {isLoading
              ? Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={i} isFirst={i === 0} />)
              : articles?.map((article, index) => (
                  <MissedArticleCard key={article.id} article={article} index={index} onClick={() => handleClick(article)} />
                ))}
          </div>
        </div>
      </div>

      {/* ── Bottom divider ── */}
      <div className="mt-4 sm:mt-6 h-px bg-gray-200" />
    </section>
  );
}

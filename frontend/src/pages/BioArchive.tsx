import axiosInstance from "../lib/axios";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Loading from "../components/misc/Loading";
import { useSearchParams } from "react-router-dom";
import { Card, Tag, Button, Space, Tooltip, Spin, Dropdown, message, Select } from "antd";
import {
  CalendarOutlined,
  UserOutlined,
  CheckOutlined,
  ShareAltOutlined,
  FireOutlined,
  EyeOutlined,
  LikeOutlined,
  TagOutlined,
} from "@ant-design/icons";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { BsSortDownAlt } from "react-icons/bs";
import type { MenuProps } from "antd";
import { CiRead } from "react-icons/ci";
import BioArchiveDetailsModal from "../components/bioarchive/BioArchiveDetailsModal";
import type { BioArchiveArticle } from "../components/bioarchive/BioArchiveDetailsModal";
import { PiFileArchiveThin } from "react-icons/pi";

function BioArchive() {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();

  const [displayedArticles, setDisplayedArticles] = useState<BioArchiveArticle[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [selectedArticle, setSelectedArticle] = useState<BioArchiveArticle | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [sortBy, setSortBy] = useState<"similarity" | "date">("date");
  const [serverFilter, setServerFilter] = useState<"all" | "biorxiv" | "medrxiv">("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const loaderRef = useRef<HTMLDivElement>(null);
  const isMountedRef = useRef<boolean>(true);
  const upvoteInFlightRef = useRef<Set<number>>(new Set());
  const ITEMS_PER_PAGE = 20;

  // Detect touch device to disable tooltips on mobile
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  useEffect(() => {
    setIsTouchDevice(window.matchMedia("(pointer: coarse)").matches);
  }, []);

  // Fetch bioarchive articles
  const { data: articles, isLoading: isLoadingArticles } = useQuery<BioArchiveArticle[]>({
    queryKey: ["bioarchive", sortBy],
    queryFn: async () => {
      const response = await axiosInstance.get(`/bioarchive/get_recommended_by_faiss?k=1000&sort_mode=${sortBy}`);
      return response.data;
    },
  });

  // Unique categories derived from all articles (before server filter)
  const uniqueCategories = useMemo(() => {
    if (!articles) return [];
    const cats = articles.map(a => a.category).filter((c): c is string => !!c);
    return [...new Set(cats)].sort();
  }, [articles]);

  // Filter articles by server and category
  const filteredArticles = useMemo(() => {
    if (!articles) return [];
    return articles.filter(a => {
      const matchesServer = serverFilter === "all" || a.server?.toLowerCase() === serverFilter;
      const matchesCategory = categoryFilter === "all" || a.category === categoryFilter;
      return matchesServer && matchesCategory;
    });
  }, [articles, serverFilter, categoryFilter]);

  // Initialize/reset pagination when articles change
  useEffect(() => {
    if (filteredArticles.length > 0) {
      setDisplayedArticles(filteredArticles.slice(0, ITEMS_PER_PAGE));
      setHasMore(filteredArticles.length > ITEMS_PER_PAGE);
      setPage(1);
    } else {
      setDisplayedArticles([]);
      setHasMore(false);
    }
  }, [filteredArticles]);

  // Handle URL parameter for article modal — only for deep-link navigation
  // (i.e. arriving at the page with ?article=xxx already in the URL).
  // We deliberately exclude isModalOpen from deps so this never overwrites
  // optimistic state set by handleCardClick.
  const deepLinkHandled = useRef(false);
  useEffect(() => {
    const articleId = searchParams.get("article");
    if (!articleId) {
      deepLinkHandled.current = false;
      return;
    }
    // Skip if the modal is already open (opened programmatically by handleCardClick)
    if (isModalOpen) return;
    if (deepLinkHandled.current) return;
    if (articles && articles.length > 0) {
      const id = parseInt(articleId);
      // Prefer displayedArticles so any optimistic updates are preserved
      const article = displayedArticles.find(a => a.id === id) || articles.find(a => a.id === id);
      if (article) {
        deepLinkHandled.current = true;
        setSelectedArticle(article);
        setIsModalOpen(true);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, articles]);

  // Infinite scroll load more
  const loadMoreArticles = useCallback(() => {
    if (!filteredArticles.length || !hasMore) return;
    const nextPage = page + 1;
    const startIndex = page * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    const newArticles = filteredArticles.slice(startIndex, endIndex);
    if (newArticles.length > 0) {
      setDisplayedArticles(prev => [...prev, ...newArticles]);
      setPage(nextPage);
      setHasMore(endIndex < filteredArticles.length);
    } else {
      setHasMore(false);
    }
  }, [filteredArticles, hasMore, page]);

  // Intersection observer for infinite scroll
  useEffect(() => {
    if (!loaderRef.current || !hasMore || isLoadingArticles) return;
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && hasMore && !isLoadingArticles) loadMoreArticles();
      },
      { threshold: 0.1 }
    );
    const current = loaderRef.current;
    observer.observe(current);
    return () => {
      if (current) observer.unobserve(current);
      observer.disconnect();
    };
  }, [hasMore, isLoadingArticles, loadMoreArticles]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  if (isLoadingArticles) {
    return <Loading />;
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  const formatAuthors = (authors: string | null): string => {
    if (!authors) return "Unknown authors";
    const list = authors
      .split(";")
      .map(a => a.trim())
      .filter(a => a.length > 0);
    if (list.length <= 3) return list.join(", ");
    return `${list.slice(0, 3).join(", ")} et al.`;
  };

  const formatDate = (dateString: string | null): string => {
    if (!dateString) return "Unknown date";
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  // const truncateAbstract = (text: string | null, maxLength = 200): string => {
  //   if (!text) return "No abstract available";
  //   if (text.length <= maxLength) return text;
  //   return text.substring(0, maxLength) + "...";
  // };

  const handleCardClick = (article: BioArchiveArticle) => {
    // Use the most up-to-date version from displayedArticles
    const currentArticle = displayedArticles.find(a => a.id === article.id) || article;
    // Mark as read immediately in local state
    const readArticle = { ...currentArticle, user_has_read: true };
    setSelectedArticle(readArticle);
    setIsModalOpen(true);
    setSearchParams({ article: article.id.toString() });

    // Update displayedArticles optimistically
    if (isMountedRef.current) {
      setDisplayedArticles(prev => prev.map(a => (a.id === article.id ? { ...a, user_has_read: true } : a)));
    }

    // Also update the React Query cache so if filteredArticles ever resets,
    // the fresh data already has user_has_read: true.
    queryClient.setQueryData<BioArchiveArticle[]>(
      ["bioarchive", sortBy],
      prev => prev?.map(a => (a.id === article.id ? { ...a, user_has_read: true } : a)) ?? []
    );

    // Track click on server
    axiosInstance.post("/bioarchive/article_click", { article_id: article.id }).catch(err => {
      console.error("Failed to track bioarchive article view:", err);
    });
  };

  const handleUpvote = async (article: BioArchiveArticle, e: React.MouseEvent) => {
    e.stopPropagation();

    // Guard against duplicate in-flight requests for the same article
    if (upvoteInFlightRef.current.has(article.id)) return;
    upvoteInFlightRef.current.add(article.id);

    const wasUpvoted = article.user_has_upvoted;
    const previousUpvotes = article.upvotes;

    // Optimistic update — toggle immediately so the UI feels instant
    const optimisticUpvotes = wasUpvoted ? Math.max(0, previousUpvotes - 1) : previousUpvotes + 1;
    const optimisticUpdate = (a: BioArchiveArticle) =>
      a.id === article.id ? { ...a, upvotes: optimisticUpvotes, user_has_upvoted: !wasUpvoted } : a;

    setDisplayedArticles(prev => prev.map(optimisticUpdate));
    setSelectedArticle(prev => (prev?.id === article.id ? optimisticUpdate(prev) : prev));
    queryClient.setQueryData<BioArchiveArticle[]>(["bioarchive", sortBy], prev => prev?.map(optimisticUpdate) ?? []);

    try {
      const response = await axiosInstance.post("/bioarchive/upvote", {
        article_id: article.id,
        undo: wasUpvoted,
      });
      if (response.data.success && isMountedRef.current) {
        // Reconcile with server truth
        const serverUpdate = (a: BioArchiveArticle) =>
          a.id === article.id ? { ...a, upvotes: response.data.upvotes, user_has_upvoted: response.data.user_has_upvoted } : a;

        setDisplayedArticles(prev => prev.map(serverUpdate));
        setSelectedArticle(prev => (prev?.id === article.id ? serverUpdate(prev) : prev));
        queryClient.setQueryData<BioArchiveArticle[]>(["bioarchive", sortBy], prev => prev?.map(serverUpdate) ?? []);

        message.success(wasUpvoted ? "Upvote removed" : "Preprint upvoted!");
      }
    } catch {
      // Revert optimistic update on failure
      if (isMountedRef.current) {
        const revertUpdate = (a: BioArchiveArticle) => (a.id === article.id ? { ...a, upvotes: previousUpvotes, user_has_upvoted: wasUpvoted } : a);

        setDisplayedArticles(prev => prev.map(revertUpdate));
        setSelectedArticle(prev => (prev?.id === article.id ? revertUpdate(prev) : prev));
        queryClient.setQueryData<BioArchiveArticle[]>(["bioarchive", sortBy], prev => prev?.map(revertUpdate) ?? []);
        message.error("Failed to upvote preprint");
      }
    } finally {
      upvoteInFlightRef.current.delete(article.id);
    }
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedArticle(null);
    setSearchParams({});
  };

  const handleShareArticle = (article: BioArchiveArticle, platform?: "linkedin" | "twitter" | "facebook" | "copyLink") => {
    const url = article.doi ? `https://doi.org/${article.doi}` : null;
    if (!url) {
      message.warning("No DOI available to share");
      return;
    }
    if (platform === "copyLink" || !platform) {
      navigator.clipboard.writeText(url).then(() => message.success("Link copied to clipboard!"));
    } else if (platform === "linkedin") {
      window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`, "_blank", "width=600,height=600");
    } else if (platform === "twitter") {
      window.open(
        `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(article.title)}`,
        "_blank",
        "width=600,height=600"
      );
    } else if (platform === "facebook") {
      window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, "_blank", "width=600,height=600");
    }
  };

  const shareMenuItems = (article: BioArchiveArticle): MenuProps["items"] => [
    { key: "copy", label: "Copy Link", icon: <ShareAltOutlined />, onClick: () => handleShareArticle(article) },
    { key: "linkedin", label: "Share on LinkedIn", onClick: () => handleShareArticle(article, "linkedin") },
    { key: "twitter", label: "Share on X (Twitter)", onClick: () => handleShareArticle(article, "twitter") },
    { key: "facebook", label: "Share on Facebook", onClick: () => handleShareArticle(article, "facebook") },
  ];

  const sortMenuItems: MenuProps["items"] = [
    {
      key: "similarity",
      label: (
        <div className="flex items-center justify-between gap-3">
          <span>By Relevance</span>
          {sortBy === "similarity" && <CheckOutlined className="text-blue-600" />}
        </div>
      ),
      onClick: () => setSortBy("similarity"),
    },
    {
      key: "date",
      label: (
        <div className="flex items-center justify-between gap-3">
          <span>By Date (Newest)</span>
          {sortBy === "date" && <CheckOutlined className="text-blue-600" />}
        </div>
      ),
      onClick: () => setSortBy("date"),
    },
  ];

  return (
    <>
      <div className="max-w-[1920px] mx-auto px-3 sm:px-4 lg:px-0">
        {/* Header */}
        <div className="mb-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <PiFileArchiveThin className="text-2xl! sm:text-3xl! shrink-0! mt-0.5! text-slate-600!" />
              <h1 className="text-2xl sm:text-3xl font-semibold text-gray-800">
                / Bio
                <span className="text-rose-700 font-semibold">R</span>
                xiv Preprints
              </h1>
            </div>
            <p className="text-gray-600 mt-1 text-sm sm:text-base">
              Preprints personalised to your interests · powered by bio
              <span className="text-rose-700 font-semibold">R</span>
              xiv &amp; med
              <span className="text-blue-500 font-semibold">R</span>
              xiv
            </p>
          </div>
          {/* Controls — two aligned rows on all screen sizes */}
          <div className="w-full sm:w-auto flex flex-col gap-2 mt-1 sm:mt-0">
            {/* Row 1 — Category (full width) */}
            {uniqueCategories.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wide w-16 shrink-0 text-right">Category</span>
                <Select
                  value={categoryFilter}
                  onChange={setCategoryFilter}
                  size="small"
                  className="flex-1 min-w-0!"
                  popupMatchSelectWidth={false}
                  options={[{ value: "all", label: "All Categories" }, ...uniqueCategories.map(c => ({ value: c, label: c }))]}
                  showSearch
                  filterOption={(input, option) => (option?.label as string)?.toLowerCase().includes(input.toLowerCase())}
                />
              </div>
            )}

            {/* Row 2 — Source + Sort */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wide w-16 shrink-0 text-right">Source</span>
              <Button.Group className="flex-1 flex! sm:flex-none! sm:flex!">
                <Button
                  type={serverFilter === "all" ? "primary" : "default"}
                  onClick={() => setServerFilter("all")}
                  size="small"
                  className="flex-1! sm:flex-none!"
                >
                  Both
                </Button>
                <Button
                  type={serverFilter === "biorxiv" ? "primary" : "default"}
                  onClick={() => setServerFilter("biorxiv")}
                  size="small"
                  className="flex-1! sm:flex-none!"
                >
                  bioRxiv
                </Button>
                <Button
                  type={serverFilter === "medrxiv" ? "primary" : "default"}
                  onClick={() => setServerFilter("medrxiv")}
                  size="small"
                  className="flex-1! sm:flex-none!"
                >
                  medRxiv
                </Button>
              </Button.Group>
              <Dropdown menu={{ items: sortMenuItems }} trigger={["click"]}>
                <Button
                  type="default"
                  size="small"
                  className="shrink-0 bg-white! text-gray-700! font-semibold! border-2! border-gray-300! hover:border-purple-500! hover:text-purple-600! hover:bg-purple-50! shadow-sm! hover:shadow-md! transition-all! duration-200!"
                >
                  <BsSortDownAlt className="text-base!" />
                  Sort
                </Button>
              </Dropdown>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="mb-3 sm:mb-4 h-px bg-gray-300!" />

        {/* Articles Grid */}
        {/* <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4"> */}
        <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,320px),1fr))] gap-3 sm:gap-4">
          {displayedArticles.map(article => (
            <Card
              key={article.id}
              hoverable
              className="h-full flex flex-col shadow-sm hover:shadow-md transition-shadow cursor-pointer rounded-xl!"
              styles={{
                body: { padding: "12px", display: "flex", flexDirection: "column", height: "100%" },
              }}
              onClick={() => handleCardClick(article)}
            >
              {/* Server / type / category tags */}
              <div className="flex flex-wrap gap-1 mb-3">
                {article.user_has_read && (
                  <Tag color="default" className="mr-0! border-gray-400! bg-gray-50!">
                    <span className="flex items-center gap-1 text-gray-600!">
                      <CiRead className="text-base!" />
                      Viewed
                    </span>
                  </Tag>
                )}
                {article.server?.toLowerCase() === "biorxiv" && (
                  <Tag color="teal" className="mr-0! font-semibold!">
                    bioRxiv
                  </Tag>
                )}
                {article.server?.toLowerCase() === "medrxiv" && (
                  <Tag color="geekblue" className="mr-0! font-semibold!">
                    medRxiv
                  </Tag>
                )}
                {article.category && (
                  <Tag color="volcano" className="mr-0!">
                    {article.category}
                  </Tag>
                )}
                {article.similarity_score > 0.6 && (
                  <Tooltip title={isTouchDevice ? "" : "Recommended for you"}>
                    <Tag color="pink" className="mr-0!">
                      <FireOutlined /> Hot pick
                    </Tag>
                  </Tooltip>
                )}
              </div>

              {/* Title */}
              <h3 className="text-base font-semibold text-gray-900 mb-3 leading-tight">{article.title}</h3>

              {/* Authors */}
              <div className="flex items-start gap-2 mb-2 text-sm text-gray-600">
                <UserOutlined className="mt-1 shrink-0" />
                <span className="line-clamp-2">{formatAuthors(article.authors)}</span>
              </div>

              {/* Dates */}
              <div className="space-y-1 text-sm text-gray-600 mb-2">
                {article.date_posted && (
                  <div className="flex items-center gap-2">
                    <CalendarOutlined className="shrink-0 text-sky-600!" />
                    <span className="text-gray-500">Posted: {formatDate(article.date_posted)}</span>
                  </div>
                )}
                {article.version && (
                  <div className="flex items-center gap-2">
                    <TagOutlined className="shrink-0! text-gray-500!" />
                    <span className="text-gray-400">Version {article.version}</span>
                  </div>
                )}
              </div>

              {/* Divider */}
              <div className="flex items-center w-full gap-2 px-2 my-2">
                <hr className="grow border-t border-dashed border-gray-400" />
                <span className="text-gray-500">•</span>
                <hr className="grow border-t border-dashed border-gray-400" />
              </div>

              {/* Abstract */}
              {/* <p className="text-sm text-justify text-gray-700 line-clamp-4 grow">{truncateAbstract(article.abstract)}</p> */}

              {/* Footer Actions */}
              <div className="mt-auto pt-2 border-t border-gray-100" onClick={e => e.stopPropagation()}>
                <div className="w-full flex justify-center mb-2">
                  <Space size="small">
                    <Button
                      type="default"
                      onClick={e => {
                        e.stopPropagation();
                        handleCardClick(article);
                      }}
                      className="h-8! px-2! bg-indigo-400! text-white! hover:shadow-md! transition-all! duration-200! border-gray-300! hover:border-sky-500! hover:text-sky-700! hover:bg-white!"
                    >
                      Read More
                      <EyeOutlined className="text-md!" />
                    </Button>
                  </Space>
                </div>

                {/* Interaction Footer */}
                <div className="flex items-center justify-around w-full pt-2 border-t border-gray-100 gap-1">
                  <Tooltip title={isTouchDevice ? "" : article.user_has_upvoted ? "Remove upvote" : "Upvote"}>
                    <Button
                      type="text"
                      icon={<LikeOutlined className="text-base! sm:text-lg!" />}
                      onClick={e => handleUpvote(article, e)}
                      className={`rounded-md! px-2! min-w-0! ${
                        article.user_has_upvoted ? "text-green-500! bg-green-50!" : "text-gray-500 hover:text-green-500! hover:bg-green-100!"
                      }`}
                    >
                      <span className="text-xs ml-1">{article.upvotes || 0}</span>
                    </Button>
                  </Tooltip>
                  <Dropdown menu={{ items: shareMenuItems(article) }} trigger={["click"]}>
                    <Tooltip title={isTouchDevice ? "" : "Share"}>
                      <Button
                        type="text"
                        icon={<ShareAltOutlined className="text-base! sm:text-lg!" />}
                        onClick={e => e.stopPropagation()}
                        className="text-gray-500 hover:text-sky-500! hover:bg-sky-100! rounded-md! px-2! min-w-0!"
                      />
                    </Tooltip>
                  </Dropdown>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* Loading Indicator */}
        {hasMore && (
          <div ref={loaderRef} className="flex justify-center py-8">
            <Spin size="large" />
          </div>
        )}

        {/* End of Results */}
        {!hasMore && displayedArticles.length > 0 && (
          <div className="text-center py-8">
            <p className="text-gray-500">You've reached the end of your BioArchives feed</p>
          </div>
        )}

        {/* Empty State */}
        {filteredArticles.length === 0 && !isLoadingArticles && articles && articles.length > 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg">No preprints found for the selected filters.</p>
            <Button
              type="link"
              className="text-blue-500 mt-1!"
              onClick={() => {
                setServerFilter("all");
                setCategoryFilter("all");
              }}
            >
              Clear filters
            </Button>
          </div>
        )}
        {articles && articles.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg">No preprints found. Try updating your interests in settings.</p>
          </div>
        )}
      </div>

      {/* Article Detail Modal */}
      <BioArchiveDetailsModal isOpen={isModalOpen} article={selectedArticle} onClose={handleCloseModal} onUpvote={handleUpvote} />
    </>
  );
}

export default BioArchive;

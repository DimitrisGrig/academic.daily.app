import { useState, useEffect, useMemo, useRef } from "react";
import { Modal, Input, Tabs, Empty, Spin, Tag, Typography, List, Space, Divider, Button } from "antd";
import {
  SearchOutlined,
  FileTextOutlined,
  TagOutlined,
  BookOutlined,
  ClockCircleOutlined,
  LikeOutlined,
  FireOutlined,
  ExperimentOutlined,
} from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import axiosInstance from "../../lib/axios";

const { Text, Paragraph } = Typography;

// Simple debounce function
function debounce<T extends (...args: any[]) => any>(func: T, wait: number): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

interface SearchArticle {
  id: number;
  title: string;
  abstract: string;
  journal: string;
  authors: string;
  publication_date: string;
  doi: string | null;
  upvotes: number;
  clicks: number;
  journal_icon_url: string | null;
  type: "article";
}

interface SearchTopic {
  id: number;
  subtopic: string;
  broadtopic: string;
  type: "topic";
}

interface SearchJournal {
  id: number;
  journal_title: string;
  issn: string;
  impact_factor: number | null;
  journal_icon_url: string | null;
  type: "journal";
}

interface SearchBioArchive {
  id: number;
  title: string;
  abstract: string;
  authors: string;
  author_corresponding: string | null;
  date_posted: string | null;
  doi: string | null;
  category: string | null;
  server: string | null;
  upvotes: number;
  type: "bioarchive";
}

interface SearchResults {
  articles: SearchArticle[];
  topics: SearchTopic[];
  journals: SearchJournal[];
  bioarchive: SearchBioArchive[];
  total: number;
}

interface GlobalSearchModalProps {
  open: boolean;
  onClose: () => void;
}

function GlobalSearchModal({ open, onClose }: GlobalSearchModalProps) {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [results, setResults] = useState<SearchResults>({
    articles: [],
    topics: [],
    journals: [],
    bioarchive: [],
    total: 0,
  });
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("all");
  const inputRef = useRef<any>(null);

  // Focus the input when modal opens
  useEffect(() => {
    if (open) {
      // Small delay to ensure modal is fully rendered
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [open]);

  // Debounced search function
  const debouncedSearch = useMemo(
    () =>
      debounce(async (query: string) => {
        if (!query || query.trim().length < 2) {
          setResults({
            articles: [],
            topics: [],
            journals: [],
            bioarchive: [],
            total: 0,
          });
          setLoading(false);
          return;
        }

        try {
          setLoading(true);
          const response = await axiosInstance.get("/search/global", {
            params: { query: query.trim(), limit: 10 },
          });
          setResults(response.data);
        } catch (error) {
          console.error("Search failed:", error);
          setResults({
            articles: [],
            topics: [],
            journals: [],
            bioarchive: [],
            total: 0,
          });
        } finally {
          setLoading(false);
        }
      }, 400),
    []
  );

  useEffect(() => {
    if (open && searchQuery) {
      debouncedSearch(searchQuery);
    }
  }, [searchQuery, open, debouncedSearch]);

  useEffect(() => {
    if (!open) {
      setSearchQuery("");
      setResults({ articles: [], topics: [], journals: [], bioarchive: [], total: 0 });
      setActiveTab("all");
    }
  }, [open]);

  const handleArticleClick = (article: SearchArticle) => {
    // First close the modal
    setSearchQuery("");
    setResults({ articles: [], topics: [], journals: [], bioarchive: [], total: 0 });
    onClose();

    // Navigate to Article page with article_id
    setTimeout(() => {
      navigate(`/Article?article_id=${article.id}`);
    }, 100);
  };
  const handleTopicClick = (topic: SearchTopic) => {
    setSearchQuery("");
    setResults({ articles: [], topics: [], journals: [], bioarchive: [], total: 0 });
    onClose();
    setTimeout(() => {
      navigate(`/Explore?topic=${encodeURIComponent(topic.subtopic)}`);
    }, 100);
  };

  const handleJournalClick = (journal: SearchJournal) => {
    setSearchQuery("");
    setResults({ articles: [], topics: [], journals: [], bioarchive: [], total: 0 });
    onClose();
    setTimeout(() => {
      navigate(`/SourceJournals?journal=${encodeURIComponent(journal.journal_title)}`);
    }, 100);
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return "";
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
    });
  };

  const truncateText = (text: string, maxLength: number) => {
    if (!text) return "";
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + "...";
  };

  const highlightMatch = (text: string, query: string) => {
    if (!query || !text) return text;
    const parts = text.split(new RegExp(`(${query})`, "gi"));
    return parts.map((part, i) =>
      part.toLowerCase() === query.toLowerCase() ? (
        <span key={i} className="bg-yellow-200 font-semibold">
          {part}
        </span>
      ) : (
        part
      )
    );
  };

  const renderArticleItem = (article: SearchArticle) => (
    <List.Item
      key={article.id}
      className="cursor-pointer hover:bg-gray-50 transition-colors rounded-lg px-4 py-3"
      onClick={() => handleArticleClick(article)}
    >
      <div className="w-full">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <Text strong className="text-base text-gray-800 block mb-1">
              {highlightMatch(article.title, searchQuery)}
            </Text>
            <Paragraph className="text-sm text-gray-600 mb-2 line-clamp-2">
              {highlightMatch(truncateText(article.abstract, 150), searchQuery)}
            </Paragraph>
            <Space size={[8, 4]} wrap>
              <Text type="secondary" className="text-xs flex items-center">
                {article.journal_icon_url ? (
                  <img
                    src={article.journal_icon_url}
                    alt=""
                    className="w-4 h-4 mr-1 shrink-0 rounded-sm object-contain inline-block"
                    onError={e => {
                      (e.currentTarget as HTMLImageElement).style.display = "none";
                      const next = e.currentTarget.nextElementSibling as HTMLElement;
                      if (next) next.style.display = "inline";
                    }}
                  />
                ) : null}
                <BookOutlined className="mr-1" style={article.journal_icon_url ? { display: "none" } : undefined} />
                {truncateText(article.journal, 40)}
              </Text>
              {article.publication_date && (
                <Text type="secondary" className="text-xs">
                  <ClockCircleOutlined className="mr-1" />
                  {formatDate(article.publication_date)}
                </Text>
              )}
              <Tag icon={<LikeOutlined />} color="blue" className="text-xs">
                {article.upvotes}
              </Tag>
              <Tag icon={<FireOutlined />} color="orange" className="text-xs">
                {article.clicks}
              </Tag>
            </Space>
          </div>
        </div>
      </div>
    </List.Item>
  );

  const renderTopicItem = (topic: SearchTopic) => (
    <List.Item
      key={topic.id}
      className="cursor-pointer hover:bg-gray-50 transition-colors rounded-lg px-4 py-3"
      onClick={() => handleTopicClick(topic)}
    >
      <div className="w-full">
        <Space direction="vertical" size={4}>
          <Text strong className="text-base text-gray-800">
            {highlightMatch(topic.subtopic, searchQuery)}
          </Text>
          <Tag color="purple" className="text-xs">
            {topic.broadtopic}
          </Tag>
        </Space>
      </div>
    </List.Item>
  );

  const renderJournalItem = (journal: SearchJournal) => (
    <List.Item
      key={journal.id}
      className="cursor-pointer hover:bg-gray-50 transition-colors rounded-lg px-4 py-3"
      onClick={() => handleJournalClick(journal)}
    >
      <div className="w-full flex items-center justify-between">
        <div className="flex items-center gap-2">
          {journal.journal_icon_url ? (
            <img
              src={journal.journal_icon_url}
              alt=""
              className="w-5 h-5 shrink-0 rounded-sm object-contain"
              onError={e => {
                (e.currentTarget as HTMLImageElement).style.display = "none";
              }}
            />
          ) : (
            <BookOutlined className="text-gray-400 shrink-0" />
          )}
          <div>
            <Text strong className="text-base text-gray-800 block mb-1">
              {highlightMatch(journal.journal_title, searchQuery)}
            </Text>
            <Text type="secondary" className="text-xs">
              ISSN: {journal.issn}
            </Text>
          </div>
        </div>
        {journal.impact_factor && (
          <Tag color="green" className="ml-3">
            IF: {journal.impact_factor.toFixed(2)}
          </Tag>
        )}
      </div>
    </List.Item>
  );

  const handleBioArchiveClick = (article: SearchBioArchive) => {
    setSearchQuery("");
    setResults({ articles: [], topics: [], journals: [], bioarchive: [], total: 0 });
    onClose();
    setTimeout(() => {
      navigate(`/BioArchiveArticle?article_id=${article.id}`);
    }, 100);
  };

  const renderBioArchiveItem = (article: SearchBioArchive) => (
    <List.Item
      key={article.id}
      className="cursor-pointer hover:bg-gray-50 transition-colors rounded-lg px-4 py-3"
      onClick={() => handleBioArchiveClick(article)}
    >
      <div className="w-full">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <Text strong className="text-base text-gray-800 block mb-1">
              {highlightMatch(article.title, searchQuery)}
            </Text>
            <Paragraph className="text-sm text-gray-600 mb-2 line-clamp-2">
              {highlightMatch(truncateText(article.abstract, 150), searchQuery)}
            </Paragraph>
            <Space size={[8, 4]} wrap>
              {article.server && (
                <Tag color={article.server === "biorxiv" ? "green" : "blue"} className="text-xs">
                  {article.server === "biorxiv" ? "bioRxiv" : "medRxiv"}
                </Tag>
              )}
              {article.category && (
                <Tag color="purple" className="text-xs">
                  {article.category}
                </Tag>
              )}
              {article.date_posted && (
                <Text type="secondary" className="text-xs">
                  <ClockCircleOutlined className="mr-1" />
                  {formatDate(article.date_posted)}
                </Text>
              )}
              <Tag icon={<LikeOutlined />} color="blue" className="text-xs">
                {article.upvotes}
              </Tag>
            </Space>
          </div>
        </div>
      </div>
    </List.Item>
  );

  const tabItems = [
    {
      key: "all",
      label: `All (${results.total})`,
      children: (
        <div className="space-y-4">
          {results.articles.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2 px-4">
                <FileTextOutlined className="text-blue-600" />
                <Text strong className="text-gray-700">
                  Articles ({results.articles.length})
                </Text>
              </div>
              <List dataSource={results.articles.slice(0, 3)} renderItem={renderArticleItem} split={false} />
              {results.articles.length > 3 && (
                <div className="text-center mt-2">
                  <Text type="secondary" className="text-xs cursor-pointer hover:text-blue-600" onClick={() => setActiveTab("articles")}>
                    View all {results.articles.length} articles →
                  </Text>
                </div>
              )}
              <Divider className="my-3" />
            </div>
          )}

          {results.topics.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2 px-4">
                <TagOutlined className="text-purple-600" />
                <Text strong className="text-gray-700">
                  Topics ({results.topics.length})
                </Text>
              </div>
              <List dataSource={results.topics.slice(0, 5)} renderItem={renderTopicItem} split={false} />
              {results.topics.length > 5 && (
                <div className="text-center mt-2">
                  <Text type="secondary" className="text-xs cursor-pointer hover:text-purple-600" onClick={() => setActiveTab("topics")}>
                    View all {results.topics.length} topics →
                  </Text>
                </div>
              )}
              <Divider className="my-3" />
            </div>
          )}

          {results.journals.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2 px-4">
                <BookOutlined className="text-green-600" />
                <Text strong className="text-gray-700">
                  Journals ({results.journals.length})
                </Text>
              </div>
              <List dataSource={results.journals.slice(0, 5)} renderItem={renderJournalItem} split={false} />
              {results.journals.length > 5 && (
                <div className="text-center mt-2">
                  <Text type="secondary" className="text-xs cursor-pointer hover:text-green-600" onClick={() => setActiveTab("journals")}>
                    View all {results.journals.length} journals →
                  </Text>
                </div>
              )}
            </div>
          )}

          {results.bioarchive.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2 px-4">
                <ExperimentOutlined className="text-teal-600" />
                <Text strong className="text-gray-700">
                  bioRxiv ({results.bioarchive.length})
                </Text>
              </div>
              <List dataSource={results.bioarchive.slice(0, 3)} renderItem={renderBioArchiveItem} split={false} />
              {results.bioarchive.length > 3 && (
                <div className="text-center mt-2">
                  <Text type="secondary" className="text-xs cursor-pointer hover:text-teal-600" onClick={() => setActiveTab("bioarchive")}>
                    View all {results.bioarchive.length} preprints →
                  </Text>
                </div>
              )}
            </div>
          )}

          {results.total === 0 && !loading && searchQuery && (
            <Empty
              description={
                <Text type="secondary">
                  No results found for "<strong>{searchQuery}</strong>"
                </Text>
              }
              className="py-8"
            />
          )}
        </div>
      ),
    },
    {
      key: "articles",
      label: `Articles (${results.articles.length})`,
      children: (
        <List
          dataSource={results.articles}
          renderItem={renderArticleItem}
          split={false}
          locale={{
            emptyText: <Empty description={<Text type="secondary">No articles found</Text>} className="py-8" />,
          }}
        />
      ),
    },
    {
      key: "topics",
      label: `Topics (${results.topics.length})`,
      children: (
        <List
          dataSource={results.topics}
          renderItem={renderTopicItem}
          split={false}
          locale={{
            emptyText: <Empty description={<Text type="secondary">No topics found</Text>} className="py-8" />,
          }}
        />
      ),
    },
    {
      key: "journals",
      label: `Journals (${results.journals.length})`,
      children: (
        <List
          dataSource={results.journals}
          renderItem={renderJournalItem}
          split={false}
          locale={{
            emptyText: <Empty description={<Text type="secondary">No journals found</Text>} className="py-8" />,
          }}
        />
      ),
    },
    {
      key: "bioarchive",
      label: `bioRxiv (${results.bioarchive.length})`,
      children: (
        <List
          dataSource={results.bioarchive}
          renderItem={renderBioArchiveItem}
          split={false}
          locale={{
            emptyText: <Empty description={<Text type="secondary">No preprints found</Text>} className="py-8" />,
          }}
        />
      ),
    },
  ];

  return (
    <Modal open={open} onCancel={onClose} footer={null} width={800} closeIcon={null} className="global-search-modal" destroyOnClose>
      <div className="py-2">
        <Input
          ref={inputRef}
          size="large"
          placeholder="Search articles, topics, journals..."
          prefix={<SearchOutlined className="text-gray-500 text-lg" />}
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          autoFocus
          className="mb-4"
          allowClear
        />

        {loading && (
          <div className="text-center py-12">
            <Spin size="large" />
            <Text type="secondary" className="block mt-4">
              Searching...
            </Text>
          </div>
        )}

        {!loading && searchQuery && searchQuery.trim().length >= 2 && (
          <>
            <Tabs activeKey={activeTab} onChange={setActiveTab} items={tabItems} className="search-results-tabs" />
            {results.total > 0 && (
              <div className="text-center mt-4 pb-2">
                <Button
                  type="link"
                  onClick={() => {
                    onClose();
                    navigate(`/Search?q=${encodeURIComponent(searchQuery)}`);
                  }}
                >
                  View all results in dedicated page →
                </Button>
              </div>
            )}
          </>
        )}

        {!loading && (!searchQuery || searchQuery.trim().length < 2) && (
          <div className="text-center py-12">
            <SearchOutlined className="text-6xl text-gray-300" />
            <Text type="secondary" className="block mt-4 text-base">
              Start typing to search across articles, topics, and journals
            </Text>
            <Text type="secondary" className="block mt-2 text-sm">
              Minimum 2 characters required
            </Text>
            <Button
              type="link"
              size="large"
              className="mt-4"
              onClick={() => {
                onClose();
                navigate("/Search");
              }}
            >
              Go to Advanced Search Page →
            </Button>
          </div>
        )}

        {/* Close Button */}
        <div className="mt-6 text-center border-t pt-4">
          <Button type="default" size="large" onClick={onClose} className="w-full sm:w-auto px-8">
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export default GlobalSearchModal;

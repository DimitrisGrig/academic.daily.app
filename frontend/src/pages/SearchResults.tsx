import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Input, Card, Tabs, Empty, Tag, Button, Space, Typography, Pagination, Spin, Tooltip, message } from "antd";
import {
  SearchOutlined,
  FileTextOutlined,
  TagOutlined,
  BookOutlined,
  ClockCircleOutlined,
  LikeOutlined,
  FireOutlined,
  CommentOutlined,
  TrophyOutlined,
  ExperimentOutlined,
} from "@ant-design/icons";
import { FiExternalLink } from "react-icons/fi";
import { IoBookmarkOutline } from "react-icons/io5";
import axiosInstance from "../lib/axios";
import Loading from "../components/misc/Loading";

const { Text, Title, Paragraph } = Typography;

interface Article {
  id: number;
  title: string;
  abstract: string;
  journal: string;
  authors_full: string[] | string;
  publication_date: string;
  doi: string | null;
  upvotes: number;
  clicks: number;
  user_has_upvoted: boolean;
  comments_count: number;
  journal_icon_url?: string | null;
  wos_journal?: {
    journal_impact_factor: number | null;
  };
}

interface SearchTopic {
  id: number;
  subtopic: string;
  broadtopic: string;
}

interface SearchJournal {
  id: number;
  journal_title: string;
  issn: string;
  impact_factor: number | null;
  journal_icon_url: string | null;
}

interface SearchBioArchive {
  id: number;
  title: string;
  abstract: string | null;
  authors: string | null;
  author_corresponding: string | null;
  author_corresponding_institution: string | null;
  doi: string | null;
  date_posted: string | null;
  version: number | null;
  publication_type: string | null;
  license: string | null;
  category: string | null;
  published: string | null;
  server: string | null;
  upvotes: number;
  user_has_upvoted: boolean;
}

function SearchResults() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const query = searchParams.get("q") || "";
  const [searchInput, setSearchInput] = useState(query);
  const [activeTab, setActiveTab] = useState("articles");
  const [currentPage, setCurrentPage] = useState(1);
  const [bioarchivePage, setBioarchivePage] = useState(1);
  const pageSize = 20;

  useEffect(() => {
    setSearchInput(query);
  }, [query]);

  // Fetch search results
  const { data: searchResults, isLoading } = useQuery({
    queryKey: ["globalSearch", query],
    queryFn: async () => {
      if (!query || query.trim().length < 4) return null;
      const response = await axiosInstance.get("/search/global", {
        params: { query: query.trim(), limit: 50 },
      });
      return response.data;
    },
    enabled: query.trim().length >= 4,
  });

  // Fetch detailed articles when on articles tab
  const { data: articlesData, isLoading: isLoadingArticles } = useQuery({
    queryKey: ["searchArticles", query, currentPage],
    queryFn: async () => {
      if (!query || query.trim().length < 4) return null;
      const response = await axiosInstance.get("/search/articles", {
        params: {
          query: query.trim(),
          limit: pageSize,
          offset: (currentPage - 1) * pageSize,
        },
      });
      return response.data;
    },
    enabled: activeTab === "articles" && query.trim().length >= 4,
  });

  // Fetch detailed bioarchive articles when on bioarchive tab
  const { data: bioarchiveData, isLoading: isLoadingBioarchive } = useQuery({
    queryKey: ["searchBioarchive", query, bioarchivePage],
    queryFn: async () => {
      if (!query || query.trim().length < 4) return null;
      const response = await axiosInstance.get("/search/bioarchive", {
        params: {
          query: query.trim(),
          limit: pageSize,
          offset: (bioarchivePage - 1) * pageSize,
        },
      });
      return response.data;
    },
    enabled: activeTab === "bioarchive" && query.trim().length >= 4,
  });

  const handleSearch = () => {
    if (searchInput.trim().length < 4) {
      message.warning("Please enter at least 4 characters to search");
      return;
    }
    setSearchParams({ q: searchInput.trim() });
    setCurrentPage(1);
    setBioarchivePage(1);
  };

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
    if (cleaned.length <= 3) return cleaned.join(", ");
    return `${cleaned.slice(0, 3).join(", ")} et al.`;
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return "No date";
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const truncateText = (text: string, maxLength: number) => {
    if (!text) return "";
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + "...";
  };

  const handleArticleClick = (articleId: number) => {
    navigate(`/Article?article_id=${articleId}`);
  };

  const handleOpenDOI = (doi: string) => {
    window.open(`https://doi.org/${doi}`, "_blank");
  };

  if (!query || query.trim().length < 4) {
    return (
      <div className="min-h-screen bg-gray-50 pt-3 sm:pt-6 px-3 sm:px-4">
        <div className="max-w-4xl mx-auto">
          <Card>
            <div className="text-center py-6 sm:py-12">
              <SearchOutlined className="text-4xl sm:text-6xl text-gray-300 mb-3 sm:mb-4" />
              <Title level={3} className="text-gray-600 text-lg sm:text-2xl! hidden sm:block!">
                Search Daily Academic
              </Title>
              <Paragraph className="text-gray-500 mb-4 sm:mb-6 text-xs sm:text-sm">
                Search across thousands of articles, topics, and journals
              </Paragraph>
              <Input.Search
                size="large"
                placeholder="Search (minimum 4 characters)..."
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                onSearch={handleSearch}
                enterButton={<Button type="primary">Search</Button>}
                className="max-w-2xl"
              />
            </div>
          </Card>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return <Loading />;
  }

  const articles = articlesData?.articles || [];
  const topics = searchResults?.topics || [];
  const journals = searchResults?.journals || [];
  const bioarchive = bioarchiveData?.bioarchive || searchResults?.bioarchive || [];
  const totalArticles = articlesData?.total || 0;
  const totalBioarchive = bioarchiveData?.total || searchResults?.bioarchive?.length || 0;

  const tabItems = [
    {
      key: "articles",
      label: (
        <span className="text-xs sm:text-sm">
          <FileTextOutlined /> Articles {totalArticles > 0 && `(${totalArticles})`}
        </span>
      ),
      children: (
        <div>
          {isLoadingArticles ? (
            <div className="text-center py-12">
              <Spin size="large" />
            </div>
          ) : articles.length > 0 ? (
            <>
              <div className="space-y-3 sm:space-y-4">
                {articles.map((article: Article) => (
                  <Card
                    key={article.id}
                    hoverable
                    className="cursor-pointer transition-shadow hover:shadow-lg"
                    onClick={() => handleArticleClick(article.id)}
                  >
                    <div className="space-y-2 sm:space-y-3">
                      <div className="flex items-start justify-between gap-2 sm:gap-3">
                        <div className="flex-1">
                          <Title level={5} className="mb-1 sm:mb-2 text-gray-800 hover:text-blue-600 text-sm sm:text-base!">
                            {article.title}
                          </Title>
                          <Paragraph className="text-gray-600 mb-2 sm:mb-3 line-clamp-3 text-xs sm:text-sm!">
                            {truncateText(article.abstract, 300)}
                          </Paragraph>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-1 sm:gap-2">
                        <Tag
                          icon={
                            article.journal_icon_url ? (
                              <img
                                src={article.journal_icon_url}
                                alt=""
                                className="w-3.5 h-3.5 rounded-sm object-contain inline-block mr-1 align-middle"
                                onError={e => {
                                  (e.currentTarget as HTMLImageElement).replaceWith(document.createElement("span"));
                                }}
                              />
                            ) : (
                              <BookOutlined />
                            )
                          }
                          color="blue"
                          className="text-xs m-0"
                        >
                          {truncateText(article.journal, 40)}
                        </Tag>
                        {article.wos_journal?.journal_impact_factor && (
                          <Tag icon={<TrophyOutlined />} color="gold" className="text-xs m-0 font-semibold!">
                            IF: {article.wos_journal.journal_impact_factor.toFixed(1)}
                          </Tag>
                        )}
                        <Tag icon={<ClockCircleOutlined />} className="text-xs m-0">
                          {formatDate(article.publication_date)}
                        </Tag>
                        <Tag icon={<LikeOutlined />} color="blue" className="text-xs m-0">
                          {article.upvotes}
                        </Tag>
                        <Tag icon={<FireOutlined />} color="orange" className="text-xs m-0">
                          {article.clicks}
                        </Tag>
                        {article.comments_count > 0 && (
                          <Tag icon={<CommentOutlined />} color="purple" className="text-xs m-0">
                            {article.comments_count}
                          </Tag>
                        )}
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t">
                        <Text type="secondary" className="text-xs sm:text-sm flex-1 mr-2" ellipsis>
                          {formatAuthors(article.authors_full)}
                        </Text>
                        <Space size="small" className="shrink-0">
                          {article.doi && (
                            <Tooltip title="Open in new tab">
                              <Button
                                type="text"
                                size="small"
                                icon={<FiExternalLink />}
                                onClick={e => {
                                  e.stopPropagation();
                                  handleOpenDOI(article.doi!);
                                }}
                                className="text-xs sm:text-sm"
                              />
                            </Tooltip>
                          )}
                          <Tooltip title="Bookmark">
                            <Button
                              type="text"
                              size="small"
                              icon={<IoBookmarkOutline />}
                              onClick={e => {
                                e.stopPropagation();
                                // Handle bookmark
                              }}
                              className="text-xs sm:text-sm"
                            />
                          </Tooltip>
                        </Space>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>

              {totalArticles > pageSize && (
                <div className="mt-4 sm:mt-6 flex justify-center">
                  <Pagination
                    current={currentPage}
                    total={totalArticles}
                    pageSize={pageSize}
                    onChange={page => setCurrentPage(page)}
                    showSizeChanger={false}
                    showTotal={(total, range) => `${range[0]}-${range[1]} of ${total} articles`}
                    size="small"
                    responsive
                  />
                </div>
              )}
            </>
          ) : (
            <Empty description="No articles found" className="py-6 sm:py-12" />
          )}
        </div>
      ),
    },
    {
      key: "topics",
      label: (
        <span className="text-xs sm:text-sm">
          <TagOutlined /> Topics ({topics.length})
        </span>
      ),
      children: (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
          {topics.length > 0 ? (
            topics.map((topic: SearchTopic) => (
              <Card
                key={topic.id}
                hoverable
                className="cursor-pointer"
                onClick={() => navigate(`/Explore?topic=${encodeURIComponent(topic.subtopic)}`)}
              >
                <Space direction="vertical" size={2}>
                  <Text strong className="text-sm sm:text-base">
                    {topic.subtopic}
                  </Text>
                  <Tag color="purple" className="text-xs">
                    {topic.broadtopic}
                  </Tag>
                </Space>
              </Card>
            ))
          ) : (
            <div className="col-span-full">
              <Empty description="No topics found" className="py-6 sm:py-12" />
            </div>
          )}
        </div>
      ),
    },
    {
      key: "journals",
      label: (
        <span className="text-xs sm:text-sm">
          <BookOutlined /> Journals ({journals.length})
        </span>
      ),
      children: (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
          {journals.length > 0 ? (
            journals.map((journal: SearchJournal) => (
              <Card
                key={journal.id}
                hoverable
                className="cursor-pointer"
                onClick={() => navigate(`/SourceJournals?journal=${encodeURIComponent(journal.journal_title)}`)}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
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
                    <div className="flex-1 min-w-0">
                      <Text strong className="block mb-1 text-sm sm:text-base" ellipsis>
                        {journal.journal_title}
                      </Text>
                      <Text type="secondary" className="text-xs">
                        ISSN: {journal.issn}
                      </Text>
                    </div>
                  </div>
                  {journal.impact_factor && (
                    <Tag color="green" className="ml-2 text-xs shrink-0">
                      IF: {journal.impact_factor.toFixed(2)}
                    </Tag>
                  )}
                </div>
              </Card>
            ))
          ) : (
            <div className="col-span-full">
              <Empty description="No journals found" className="py-6 sm:py-12" />
            </div>
          )}
        </div>
      ),
    },
    {
      key: "bioarchive",
      label: (
        <span className="text-xs sm:text-sm">
          <ExperimentOutlined /> bioRxiv {totalBioarchive > 0 && `(${totalBioarchive})`}
        </span>
      ),
      children: (
        <div>
          {isLoadingBioarchive ? (
            <div className="text-center py-12">
              <Spin size="large" />
            </div>
          ) : bioarchive.length > 0 ? (
            <>
              <div className="space-y-3 sm:space-y-4">
                {bioarchive.map((article: SearchBioArchive) => (
                  <Card
                    key={article.id}
                    hoverable
                    className="cursor-pointer transition-shadow hover:shadow-lg"
                    onClick={() => navigate(`/BioArchive?article_id=${article.id}`)}
                  >
                    <div className="space-y-2 sm:space-y-3">
                      <div className="flex items-start justify-between gap-2 sm:gap-3">
                        <div className="flex-1">
                          <Title level={5} className="mb-1 sm:mb-2 text-gray-800 hover:text-teal-600 text-sm sm:text-base!">
                            {article.title}
                          </Title>
                          <Paragraph className="text-gray-600 mb-2 sm:mb-3 line-clamp-3 text-xs sm:text-sm!">
                            {truncateText(article.abstract || "", 300)}
                          </Paragraph>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-1 sm:gap-2">
                        {article.server && (
                          <Tag color={article.server === "biorxiv" ? "green" : "blue"} className="text-xs m-0">
                            {article.server === "biorxiv" ? "bioRxiv" : "medRxiv"}
                          </Tag>
                        )}
                        {article.category && (
                          <Tag color="purple" className="text-xs m-0">
                            {article.category}
                          </Tag>
                        )}
                        {article.date_posted && (
                          <Tag icon={<ClockCircleOutlined />} className="text-xs m-0">
                            {formatDate(article.date_posted)}
                          </Tag>
                        )}
                        <Tag icon={<LikeOutlined />} color="blue" className="text-xs m-0">
                          {article.upvotes}
                        </Tag>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t">
                        <Text type="secondary" className="text-xs sm:text-sm flex-1 mr-2" ellipsis>
                          {article.author_corresponding || (article.authors ? formatAuthors(article.authors) : "Unknown authors")}
                        </Text>
                        <Space size="small" className="shrink-0">
                          {article.doi && (
                            <Tooltip title="Open in new tab">
                              <Button
                                type="text"
                                size="small"
                                icon={<FiExternalLink />}
                                onClick={e => {
                                  e.stopPropagation();
                                  handleOpenDOI(article.doi!);
                                }}
                                className="text-xs sm:text-sm"
                              />
                            </Tooltip>
                          )}
                        </Space>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>

              {totalBioarchive > pageSize && (
                <div className="mt-4 sm:mt-6 flex justify-center">
                  <Pagination
                    current={bioarchivePage}
                    total={totalBioarchive}
                    pageSize={pageSize}
                    onChange={page => setBioarchivePage(page)}
                    showSizeChanger={false}
                    showTotal={(total, range) => `${range[0]}-${range[1]} of ${total} preprints`}
                    size="small"
                    responsive
                  />
                </div>
              )}
            </>
          ) : (
            <Empty description="No preprints found" className="py-6 sm:py-12" />
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50 pt-3 sm:pt-6 px-3 sm:px-4">
      <div className="max-w-6xl mx-auto">
        {/* Search Header */}
        <Card className="mb-4 sm:mb-6">
          <Space direction="vertical" size="middle" className="w-full">
            <div className="flex items-center justify-between gap-2">
              <Title level={3} className="mb-0 text-lg sm:text-2xl!">
                Search Results
              </Title>
              <Text type="secondary" className="text-xs sm:text-sm">
                {totalArticles + topics.length + journals.length + totalBioarchive} results
              </Text>
            </div>
            <Input.Search
              size="large"
              placeholder="Search articles, topics, journals, preprints..."
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              onSearch={handleSearch}
              enterButton={
                <Button type="primary" className="text-xs sm:text-sm">
                  Search
                </Button>
              }
              prefix={<SearchOutlined />}
              className="text-sm sm:text-base"
            />
            <Text type="secondary" className="text-xs sm:text-sm">
              Searching for: <Text strong>"{query}"</Text>
            </Text>
          </Space>
        </Card>

        {/* Results Tabs */}
        <Card>
          <Tabs activeKey={activeTab} onChange={setActiveTab} items={tabItems} size="small" />
        </Card>
      </div>
    </div>
  );
}

export default SearchResults;

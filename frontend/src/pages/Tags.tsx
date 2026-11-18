import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Input, Card, Collapse, Statistic, Tag, Empty, Spin } from "antd";
import { SearchOutlined, TagOutlined, FireOutlined, BarChartOutlined, LikeOutlined } from "@ant-design/icons";
import axiosInstance from "../lib/axios";
import { useNavigate } from "react-router-dom";

const { Panel } = Collapse;

interface Topic {
  id: number;
  subtopic: string;
  broadtopic: string;
}

interface TrendingTag {
  tag: string;
  count: number;
  broadtopic: string;
}

interface PopularTag {
  tag: string;
  count: number;
  broadtopic: string;
}

interface MostUpvotedTag {
  tag: string;
  count: number;
  broadtopic: string;
}

interface CategorizedTopics {
  categories: Record<string, Topic[]>;
  total_categories: number;
  total_tags: number;
}

interface TagStats {
  total_topics: number;
  unique_categories: number;
}

function Tags() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [activeKeys, setActiveKeys] = useState<string[]>([]);
  const [isSmallMobile, setIsSmallMobile] = useState(window.innerWidth < 400);

  useEffect(() => {
    const handleResize = () => {
      setIsSmallMobile(window.innerWidth < 400);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Fetch all categorized tags
  const { data: categorizedData, isLoading: isLoadingCategories } = useQuery<CategorizedTopics>({
    queryKey: ["allTagsCategorized"],
    queryFn: async () => {
      const response = await axiosInstance.get("/tags/categorized");
      return response.data;
    },
  });

  // Fetch trending tags
  const { data: trendingData, isLoading: isLoadingTrending } = useQuery({
    queryKey: ["trendingTags"],
    queryFn: async () => {
      const response = await axiosInstance.get("/tags/trending", { params: { limit: 10 } });
      return response.data;
    },
  });

  // Fetch popular tags (from user feeds)
  const { data: popularData, isLoading: isLoadingPopular } = useQuery({
    queryKey: ["popularTags"],
    queryFn: async () => {
      const response = await axiosInstance.get("/tags/popular", { params: { limit: 10 } });
      return response.data;
    },
  });

  // Fetch most upvoted tags
  const { data: mostUpvotedData, isLoading: isLoadingMostUpvoted } = useQuery({
    queryKey: ["mostUpvotedTags"],
    queryFn: async () => {
      const response = await axiosInstance.get("/tags/most-upvoted", { params: { limit: 10 } });
      return response.data;
    },
  });

  // Fetch tag statistics
  const { data: statsData } = useQuery<TagStats>({
    queryKey: ["tagStats"],
    queryFn: async () => {
      const response = await axiosInstance.get("/tags/stats");
      return response.data;
    },
  });

  // Filter categories and tags based on search
  const filteredCategories = categorizedData?.categories
    ? Object.entries(categorizedData.categories).filter(([category, topics]) => {
        const categoryMatch = category.toLowerCase().includes(searchTerm.toLowerCase());
        const topicsMatch = topics.some((topic: Topic) => topic.subtopic.toLowerCase().includes(searchTerm.toLowerCase()));
        return categoryMatch || topicsMatch;
      })
    : [];

  // Filter topics within each category
  const getFilteredTopics = (topics: Topic[]) => {
    if (!searchTerm) return topics;
    return topics.filter(topic => topic.subtopic.toLowerCase().includes(searchTerm.toLowerCase()));
  };

  // Expand all matching categories when searching
  const handleSearch = (value: string) => {
    setSearchTerm(value);
    if (value && categorizedData?.categories) {
      const matchingKeys = Object.entries(categorizedData.categories)
        .filter(([category, topics]) => {
          const categoryMatch = category.toLowerCase().includes(value.toLowerCase());
          const topicsMatch = topics.some((topic: Topic) => topic.subtopic.toLowerCase().includes(value.toLowerCase()));
          return categoryMatch || topicsMatch;
        })
        .map(([category]) => category);
      setActiveKeys(matchingKeys);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-2 sm:p-3 md:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-4 sm:mb-6 md:mb-8 px-1">
          <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-semibold text-gray-900 mb-1 sm:mb-2 flex items-center gap-2">
            <TagOutlined className="text-blue-600! text-lg sm:text-xl md:text-2xl mr-2!" />
            Tags Explorer
          </h1>
          <p className="text-xs sm:text-sm md:text-base text-gray-600! leading-tight">
            Browse and explore all research topics and tags in our database
          </p>
        </div>

        {/* Statistics Cards */}
        <div className={`grid gap-2 sm:gap-3 md:gap-4 mb-4 sm:mb-6 md:mb-8 ${isSmallMobile ? "grid-cols-1" : "grid-cols-2"}`}>
          <Card className="shadow-sm!">
            <Statistic
              title={<span className="text-xs sm:text-sm whitespace-nowrap">Total Tags</span>}
              value={statsData?.total_topics || 0}
              prefix={<TagOutlined style={{ color: "#1890ff" }} />}
              valueStyle={{ fontSize: isSmallMobile ? "1.5rem" : "clamp(1.2rem, 4vw, 1.5rem)" }}
            />
          </Card>
          <Card className="shadow-sm">
            <Statistic
              title={<span className="text-xs sm:text-sm whitespace-nowrap">Categories</span>}
              value={statsData?.unique_categories || 0}
              prefix={<BarChartOutlined style={{ color: "#52c41a" }} />}
              valueStyle={{ fontSize: isSmallMobile ? "1.5rem" : "clamp(1.25rem, 4vw, 1.5rem)", color: "#52c41a" }}
            />
          </Card>
        </div>

        {/* Top Section: Trending, Popular, and Most Upvoted */}
        <div className="grid grid-cols-1 gap-3 sm:gap-4 md:gap-6 mb-4 sm:mb-6 md:mb-8">
          {/* Trending Tags */}
          <Card
            title={
              <span className="flex items-center gap-2 text-sm sm:text-base md:text-lg font-semibold">
                <FireOutlined className="text-orange-500!" />
                Trending Tags
              </span>
            }
            className="shadow-md"
          >
            <div className="text-xs text-gray-500 mb-2 sm:mb-3">From top 10 clicked articles</div>
            {isLoadingTrending ? (
              <div className="text-center py-6 sm:py-8">
                <Spin size="large" />
              </div>
            ) : trendingData?.trending_tags?.length > 0 ? (
              <div className="space-y-1.5 sm:space-y-2 md:space-y-3">
                {trendingData.trending_tags.map((tag: TrendingTag, index: number) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-2 sm:p-2.5 md:p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
                    onClick={() => navigate(`/Explore?topic=${encodeURIComponent(tag.tag)}`)}
                  >
                    <div className="flex items-center gap-2 sm:gap-2.5 md:gap-3 flex-1 min-w-0">
                      <span className="text-sm sm:text-base md:text-lg font-bold text-gray-400 w-4 sm:w-5 md:w-6 shrink-0">{index + 1}</span>
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-xs sm:text-sm md:text-base text-gray-900 cursor-pointer truncate">{tag.tag}</div>
                        <div className="text-xs text-gray-500 truncate">{tag.broadtopic}</div>
                      </div>
                    </div>
                    <Tag color="orange" className="shrink-0 ml-1 sm:ml-2 text-xs">
                      {tag.count}
                    </Tag>
                  </div>
                ))}
              </div>
            ) : (
              <Empty description="No trending tags available" />
            )}
          </Card>

          {/* Popular Tags */}
          <Card
            title={
              <span className="flex items-center gap-2 text-sm sm:text-base md:text-lg font-semibold">
                <TagOutlined className="text-blue-500!" />
                Popular Tags
              </span>
            }
            className="shadow-md"
          >
            <div className="text-xs text-gray-500 mb-2 sm:mb-3">Most used in user feeds</div>
            {isLoadingPopular ? (
              <div className="text-center py-6 sm:py-8">
                <Spin size="large" />
              </div>
            ) : popularData?.popular_tags?.length > 0 ? (
              <div className="space-y-1.5 sm:space-y-2 md:space-y-3">
                {popularData.popular_tags.map((tag: PopularTag, index: number) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-2 sm:p-2.5 md:p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
                    onClick={() => navigate(`/Explore?topic=${encodeURIComponent(tag.tag)}`)}
                  >
                    <div className="flex items-center gap-2 sm:gap-2.5 md:gap-3 flex-1 min-w-0">
                      <span className="text-sm sm:text-base md:text-lg font-bold text-gray-400 w-4 sm:w-5 md:w-6 shrink-0">{index + 1}</span>
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-xs sm:text-sm md:text-base text-gray-900 truncate">{tag.tag}</div>
                        <div className="text-xs text-gray-500 truncate">{tag.broadtopic}</div>
                      </div>
                    </div>
                    <Tag color="blue" className="shrink-0 ml-1 sm:ml-2 text-xs">
                      {tag.count} {isSmallMobile ? "" : "users"}
                    </Tag>
                  </div>
                ))}
              </div>
            ) : (
              <Empty description="No popular tags available" />
            )}
          </Card>

          {/* Most Upvoted Tags */}
          <Card
            title={
              <span className="flex items-center gap-2 text-sm sm:text-base md:text-lg font-semibold">
                <LikeOutlined className="text-green-600!" />
                Most Upvoted Tags
              </span>
            }
            className="shadow-md"
          >
            <div className="text-xs text-gray-500 mb-2 sm:mb-3">From top 10 upvoted articles</div>
            {isLoadingMostUpvoted ? (
              <div className="text-center py-6 sm:py-8">
                <Spin size="large" />
              </div>
            ) : mostUpvotedData?.most_upvoted_tags?.length > 0 ? (
              <div className="space-y-1.5 sm:space-y-2 md:space-y-3">
                {mostUpvotedData.most_upvoted_tags.map((tag: MostUpvotedTag, index: number) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-2 sm:p-2.5 md:p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
                    onClick={() => navigate(`/Explore?topic=${encodeURIComponent(tag.tag)}`)}
                  >
                    <div className="flex items-center gap-2 sm:gap-2.5 md:gap-3 flex-1 min-w-0">
                      <span className="text-sm sm:text-base md:text-lg font-bold text-gray-400 w-4 sm:w-5 md:w-6 shrink-0">{index + 1}</span>
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-xs sm:text-sm md:text-base text-gray-900 truncate">{tag.tag}</div>
                        <div className="text-xs text-gray-500 truncate">{tag.broadtopic}</div>
                      </div>
                    </div>
                    <Tag color="red" className="shrink-0 ml-1 sm:ml-2 text-xs">
                      {tag.count}
                    </Tag>
                  </div>
                ))}
              </div>
            ) : (
              <Empty description="No upvoted tags available" />
            )}
          </Card>
        </div>

        {/* All Tags Section */}
        <Card
          title={
            <span className="flex items-center gap-2 text-sm sm:text-base md:text-lg font-semibold">
              <TagOutlined className="text-gray-700!" />
              All Tags by Category
            </span>
          }
          className="shadow-md!"
        >
          {/* Search Bar */}
          <div className="mb-3 sm:mb-4 md:mb-6">
            <Input
              size={isSmallMobile ? "middle" : "large"}
              placeholder="Search tags or categories..."
              prefix={<SearchOutlined />}
              value={searchTerm}
              onChange={e => handleSearch(e.target.value)}
              allowClear
              className="rounded-lg! text-xs sm:text-sm md:text-base"
            />
          </div>

          {/* Loading State */}
          {isLoadingCategories ? (
            <div className="text-center py-8 sm:py-12">
              <Spin size="large" />
              <p className="text-gray-500 mt-3 sm:mt-4 text-xs sm:text-sm">Loading tags...</p>
            </div>
          ) : filteredCategories.length === 0 ? (
            <Empty description={searchTerm ? `No tags found matching "${searchTerm}"` : "No tags available"} />
          ) : (
            <>
              <div className="mb-2 sm:mb-3 md:mb-4 text-xs sm:text-sm text-gray-600 px-1">
                Showing {filteredCategories.length} {filteredCategories.length === 1 ? "category" : "categories"} with{" "}
                {filteredCategories.reduce((acc, [, topics]) => acc + getFilteredTopics(topics).length, 0)} tags
              </div>

              {/* Collapsible Categories */}
              <Collapse
                activeKey={activeKeys}
                onChange={keys => setActiveKeys(keys as string[])}
                className="bg-white!"
                style={{ fontSize: isSmallMobile ? "12px" : undefined }}
              >
                {filteredCategories.map(([category, topics]) => {
                  const filteredTopics = getFilteredTopics(topics);
                  if (filteredTopics.length === 0) return null;

                  return (
                    <Panel
                      header={
                        <div className="flex items-center justify-between pr-2">
                          <span
                            className="font-semibold text-xs sm:text-sm md:text-base text-gray-900 leading-tight pr-2"
                            style={{ lineHeight: "1.3" }}
                          >
                            {category}
                          </span>
                          {!isSmallMobile && (
                            <Tag color="blue" className="text-xs shrink-0">
                              {filteredTopics.length}
                            </Tag>
                          )}
                        </div>
                      }
                      key={category}
                      className="text-xs sm:text-sm"
                    >
                      {isSmallMobile && (
                        <div className="mb-2 pb-2 border-b border-gray-200">
                          <span className="text-xs text-gray-900 bg-lime-100 px-3 py-1 rounded-full">
                            {filteredTopics.length} {filteredTopics.length === 1 ? "tag" : "tags"}
                          </span>
                        </div>
                      )}
                      <div className="flex flex-wrap gap-1 sm:gap-1.5 md:gap-2 p-1 sm:p-2 md:p-4">
                        {filteredTopics.map((topic: Topic) => (
                          <Tag
                            key={topic.id}
                            className="px-1.5 sm:px-2 md:px-3 py-0.5 sm:py-0.5 md:py-1 text-xs sm:text-sm cursor-pointer hover:opacity-80 transition-opacity hover:bg-sky-600 hover:text-white m-0"
                            style={{
                              fontSize: isSmallMobile ? "11px" : undefined,
                              lineHeight: isSmallMobile ? "1.3" : undefined,
                              marginBottom: "4px",
                            }}
                            color={searchTerm && topic.subtopic.toLowerCase().includes(searchTerm.toLowerCase()) ? "blue" : "default"}
                            onClick={() => navigate(`/Explore?topic=${encodeURIComponent(topic.subtopic)}`)}
                          >
                            {topic.subtopic}
                          </Tag>
                        ))}
                      </div>
                    </Panel>
                  );
                })}
              </Collapse>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}

export default Tags;

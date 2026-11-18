import { useState, useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Input, Button, message } from "antd";
import { LoadingOutlined } from "@ant-design/icons";
import axiosInstance from "../lib/axios";

interface Topic {
  id: number;
  subtopic: string;
  broadtopic: string;
  relevance_score?: number;
  reason?: string;
  isCustom?: boolean;
}

interface CategorizedTopics {
  categories: Record<string, Topic[]>;
  total_tags: number;
}

function OnBoarding() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [customTopics, setCustomTopics] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [scholarUrl, setScholarUrl] = useState("");

  // Check if user is already onboarded
  // prettier-ignore
  const {data: isOnBoard, isLoading: isCheckingOnBoard} = useQuery({
    queryKey: ["isOnBoarded"],
    queryFn: async () => {
      const response = await axiosInstance.get("/mainFeed/is_onboarded");
      return response.data.onBoard;
    },
  });

  // Redirect to MainFeed if already onboarded
  useEffect(() => {
    if (isOnBoard === true) {
      navigate("/MainFeed");
    }
  }, [isOnBoard, navigate]);

  // Fetch categorized topics
  // prettier-ignore
  const {data: categorizedTopics, isLoading: isLoadingTopics, error: topicsError} = useQuery<CategorizedTopics>({
    queryKey: ["categorizedTopics"],
    queryFn: async () => {
      const response = await axiosInstance.get("/onboarding/tags/categorized");
      return response.data;
    },
  });

  // Fetch intelligent suggestions based on selected topics
  // prettier-ignore
  const {data: suggestionsData, isLoading: isLoadingSuggestions} = useQuery({
    queryKey: ["tagSuggestions", selectedTopics],
    queryFn: async () => {
      const response = await axiosInstance.post("/onboarding/tags/suggestions", {
        selected_tags: selectedTopics.filter(tag => !customTopics.includes(tag)), // Only send non-custom tags
        limit: 30
      });
      return response.data;
    },
    enabled: selectedTopics.length > 0,
  });

  // Fetch search results when user types
  // prettier-ignore
  const {data: searchResults, isLoading: isSearching} = useQuery({
    queryKey: ["tagSearch", searchTerm],
    queryFn: async () => {
      const response = await axiosInstance.get("/onboarding/tags/search", {
        params: {
          query: searchTerm,
          limit: 50
        }
      });
      return response.data;
    },
    enabled: searchTerm.length >= 2, // Only search if 2+ characters
  });

  const toggleTopic = (topicName: string) => {
    setSelectedTopics(prev => (prev.includes(topicName) ? prev.filter(t => t !== topicName) : [...prev, topicName]));
  };

  const addCustomTopic = (topicName: string) => {
    const trimmedTopic = topicName.trim();
    if (trimmedTopic && !customTopics.includes(trimmedTopic) && !selectedTopics.includes(trimmedTopic)) {
      setCustomTopics(prev => [...prev, trimmedTopic]);
      setSelectedTopics(prev => [...prev, trimmedTopic]);
      setSearchTerm("");
      message.success(`Added custom topic: "${trimmedTopic}"`);
    } else if (selectedTopics.includes(trimmedTopic)) {
      message.info("This topic is already in your selection");
    }
  };

  const handleSearchKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && searchTerm.trim()) {
      const trimmedSearch = searchTerm.trim();
      // If no results found, add as custom tag
      if (displayedTopics.length === 0) {
        addCustomTopic(trimmedSearch);
      }
    }
  };

  // Get flat list of all available topics
  const allTopics = useMemo(() => {
    if (!categorizedTopics?.categories) return [];

    const topics: Topic[] = [];
    Object.values(categorizedTopics.categories).forEach(categoryTopics => {
      topics.push(...categoryTopics);
    });
    return topics;
  }, [categorizedTopics]);

  // Get tags to display based on selections and search
  const displayedTopics = useMemo(() => {
    let topicsToShow: Topic[] = [];

    // If user is searching, show search results
    if (searchTerm.length >= 2 && searchResults?.results) {
      return searchResults.results;
    }

    if (selectedTopics.length === 0) {
      // No selections: show 10-20 random tags
      const shuffled = [...allTopics].sort(() => Math.random() - 0.5);
      topicsToShow = shuffled.slice(0, 15);
    } else {
      // Has selections: show intelligent suggestions
      const suggestions = suggestionsData?.suggestions || [];

      // Mark suggestions as recommended (but we won't show purple dots anymore)
      topicsToShow = suggestions.map((s: any) => ({
        ...s,
        isRecommended: true,
      }));

      // Add some random tags if we have less than 15 suggestions
      if (topicsToShow.length < 15) {
        const unselectedTopics = allTopics.filter(t => !selectedTopics.includes(t.subtopic) && !topicsToShow.some(st => st.subtopic === t.subtopic));
        const shuffled = [...unselectedTopics].sort(() => Math.random() - 0.5);
        const additionalTags = shuffled.slice(0, 15 - topicsToShow.length);
        topicsToShow = [...topicsToShow, ...additionalTags];
      }
    }

    return topicsToShow;
  }, [selectedTopics, allTopics, suggestionsData, searchTerm, searchResults]);

  // Get selected tags as Topic objects for display
  const selectedTopicsAsObjects = useMemo(() => {
    return selectedTopics.map((topicName, index) => {
      // Check if it's a custom topic
      const isCustom = customTopics.includes(topicName);

      // Try to find in allTopics
      const existingTopic = allTopics.find(t => t.subtopic === topicName);

      if (existingTopic) {
        return existingTopic;
      }

      // If not found (custom topic), create a simple object
      return {
        id: -index - 1, // Negative ID for custom topics
        subtopic: topicName,
        broadtopic: isCustom ? "Custom" : "Other",
        isCustom: isCustom,
      } as Topic;
    });
  }, [selectedTopics, customTopics, allTopics]);

  const handleComplete = async () => {
    if (selectedTopics.length === 0) {
      message.warning("Please select at least one tag to continue");
      return;
    }

    setIsSubmitting(true);
    try {
      // Save Google Scholar profile if provided
      if (scholarUrl.trim()) {
        await axiosInstance.post("/settings/scholar-profile", {
          google_scholar_url: scholarUrl.trim(),
        });
      }

      await axiosInstance.post("/mainFeed/complete_onboarding", {
        tags: selectedTopics,
      });

      // Invalidate the onboarding status query so it refetches with updated status
      queryClient.invalidateQueries({ queryKey: ["isOnBoarded"] });

      message.success("Welcome! Your onboarding is complete.");
      navigate("/MainFeed?loc=MainFeed");
    } catch (error: any) {
      console.error("Error completing onboarding:", error);
      message.error(error?.response?.data?.detail || "Failed to complete onboarding. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Show loading while checking onboard status
  if (isCheckingOnBoard) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-500">Loading...</p>
        </div>
      </div>
    );
  }

  // Only show onboarding if user is not onboarded
  if (isOnBoard === false) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center px-4 py-10 sm:py-16">
        {/* Header */}
        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-indigo-700 mb-8 sm:mb-10 text-center">Welcome to Daily Academic!</h1>

        {/* Google Scholar Profile (optional) */}
        <div className="w-full max-w-lg mb-8 sm:mb-10">
          <p className="text-gray-500 text-sm mb-2 text-center">
            Add your Google Scholar Profile url <span className="text-gray-400">(optional)</span>
          </p>
          <Input
            placeholder="https://scholar.google.com/citations?user=..."
            value={scholarUrl}
            onChange={e => setScholarUrl(e.target.value)}
            allowClear
            size="large"
            className="rounded-full!"
          />
          <p className="text-gray-400 text-xs mt-1.5 text-center">Better recommendations based on your publications</p>
        </div>

        <hr className="w-full max-w-2xl border-t border-gray-400! mb-8 sm:mb-10" />

        {/* Heading */}
        <h1 className="text-xl sm:text-2xl md:text-3xl font-semibold text-gray-800 mb-8 sm:mb-10 text-center">Pick tags that are relevant to you</h1>

        {/* Search Bar */}
        <div className="w-full max-w-lg mb-8 sm:mb-10">
          <Input.Search
            placeholder="Search topics (e.g., neuroscience, CRISPR, machine learning)..."
            allowClear
            size="large"
            className="rounded-full!"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            onKeyPress={handleSearchKeyPress}
          />
        </div>

        {/* Loading State */}
        {(isLoadingTopics || isLoadingSuggestions || isSearching) && (
          <div className="text-center text-gray-500 mb-6">
            {isSearching ? (
              "Searching..."
            ) : isLoadingSuggestions ? (
              <div className="flex flex-col items-center">
                Finding relevant tags...
                <LoadingOutlined className="m-2! text-2xl! text-indigo-600! animate-spin" />
              </div>
            ) : (
              "Loading topics..."
            )}
          </div>
        )}

        {/* Error State */}
        {topicsError && <div className="text-center py-4 text-red-500 mb-4">Error loading topics. Please try again.</div>}

        {/* No Results - Add Custom Topic */}
        {searchTerm.length >= 2 && !isSearching && !isLoadingTopics && displayedTopics.length === 0 && (
          <div className="mb-6 text-center">
            <p className="text-gray-500 mb-3 text-sm">
              No matching topics found. Add "<span className="text-gray-900 font-medium">{searchTerm}</span>" as a custom topic?
            </p>
            <button
              onClick={() => addCustomTopic(searchTerm)}
              className="px-5 py-2 rounded-full bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-500 transition-colors"
            >
              + Add Custom Topic
            </button>
          </div>
        )}

        {/* Add Search Term as Custom (when there ARE results) */}
        {searchTerm.length >= 2 &&
          !isSearching &&
          !isLoadingTopics &&
          displayedTopics.length > 0 &&
          !selectedTopics.includes(searchTerm.trim()) &&
          !displayedTopics.some((t: Topic) => t.subtopic.toLowerCase() === searchTerm.toLowerCase().trim()) && (
            <div className="mb-4 text-center">
              <button
                onClick={() => addCustomTopic(searchTerm)}
                className="px-4 py-1.5 rounded-full border border-gray-300 text-gray-500 text-xs hover:border-indigo-500 hover:text-indigo-600 transition-colors"
              >
                + Add "{searchTerm}" as custom topic
              </button>
            </div>
          )}

        {/* Tags Grid */}
        {!isLoadingTopics && !topicsError && !isSearching && displayedTopics.length > 0 && (
          <div className="w-full max-w-3xl">
            <div className="flex flex-wrap justify-center gap-2.5 sm:gap-3">
              {/* Selected Tags First */}
              {selectedTopicsAsObjects.map((topic: Topic) => (
                <button
                  key={`selected-${topic.id}`}
                  onClick={() => !isLoadingSuggestions && toggleTopic(topic.subtopic)}
                  disabled={isLoadingSuggestions}
                  className={`px-4 sm:px-5 py-2 sm:py-2.5 rounded-full text-sm font-medium transition-all ${
                    isLoadingSuggestions
                      ? "bg-gray-300 text-gray-400 cursor-not-allowed"
                      : topic.isCustom
                        ? "bg-teal-600 text-white hover:bg-teal-500 shadow-md"
                        : "bg-indigo-600 text-white hover:bg-indigo-500 shadow-md"
                  }`}
                >
                  {topic.subtopic}
                  <span className="ml-2 text-xs opacity-75">✕</span>
                </button>
              ))}

              {/* Unselected Tags */}
              {displayedTopics
                .filter((topic: Topic) => !selectedTopics.includes(topic.subtopic))
                .map((topic: Topic) => (
                  <button
                    key={topic.id}
                    onClick={() => !isLoadingSuggestions && toggleTopic(topic.subtopic)}
                    disabled={isLoadingSuggestions}
                    className={`px-4 sm:px-5 py-2 sm:py-2.5 rounded-full text-sm font-medium transition-all ${
                      isLoadingSuggestions
                        ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200 hover:text-gray-900 border border-gray-200 hover:border-gray-400"
                    }`}
                  >
                    {topic.subtopic}
                  </button>
                ))}
            </div>
          </div>
        )}

        {/* Tags Selected + Continue */}
        <div className="w-full max-w-3xl mt-8 sm:mt-10 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-sm">
            {selectedTopics.length > 0 ? (
              <span className="text-indigo-600 font-medium">
                {selectedTopics.length} tag{selectedTopics.length !== 1 ? "s" : ""} selected
              </span>
            ) : (
              <span className="text-gray-400">Select at least one tag</span>
            )}
          </div>
          <Button
            type="primary"
            size="large"
            onClick={handleComplete}
            loading={isSubmitting}
            disabled={selectedTopics.length === 0}
            className="bg-indigo-600! hover:bg-indigo-500! border-none! rounded-full! px-8! font-medium! disabled:bg-gray-200! disabled:text-gray-400!"
          >
            Continue
          </Button>
        </div>
      </div>
    );
  }

  return null;
}

export default OnBoarding;

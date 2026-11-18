import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Input, Button, message } from "antd";
import axiosInstance from "../lib/axios";

const { TextArea } = Input;

const EXAMPLE_PROMPTS = [
  "I study the molecular mechanisms of neurodegeneration, particularly how protein misfolding contributes to Alzheimer's and Parkinson's disease. I'm also interested in novel biomarkers for early diagnosis.",
  "My research focuses on reinforcement learning and its applications in robotics. I follow advances in transformer architectures, sim-to-real transfer, and multi-agent systems.",
  "I work on climate modeling and carbon cycle dynamics. I'm interested in remote sensing, land-use change impacts, and machine learning approaches for downscaling climate projections.",
];

function OnBoarding() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [interestsPrompt, setInterestsPrompt] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [scholarUrl, setScholarUrl] = useState("");
  const [currentExample, setCurrentExample] = useState(0);

  // Cycle through example prompts
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentExample(prev => (prev + 1) % EXAMPLE_PROMPTS.length);
    }, 6000);
    return () => clearInterval(interval);
  }, []);

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

  const handleComplete = async () => {
    const trimmed = interestsPrompt.trim();
    if (!trimmed) {
      message.warning("Please describe your research interests to continue");
      return;
    }
    if (trimmed.length < 20) {
      message.warning("Please write a bit more so we can find relevant papers for you");
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
        tags: [trimmed],
      });

      queryClient.invalidateQueries({ queryKey: ["isOnBoarded"] });

      message.success("Welcome! Your feed is being personalized.");
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
        <h2 className="text-xl sm:text-2xl md:text-3xl font-semibold text-gray-800 mb-3 text-center">Tell us about your research interests</h2>
        <p className="text-gray-500 text-sm sm:text-base mb-6 sm:mb-8 text-center max-w-xl">
          Describe your field, topics, methods, or questions you care about. The more detail you provide, the better we can personalize your paper
          feed.
        </p>

        {/* Interests Textarea */}
        <div className="w-full max-w-2xl mb-4">
          <TextArea
            value={interestsPrompt}
            onChange={e => setInterestsPrompt(e.target.value)}
            placeholder="Describe your research interests, topics you follow, methods you use..."
            autoSize={{ minRows: 5, maxRows: 12 }}
            maxLength={2000}
            showCount
            className="text-base! rounded-xl!"
          />
        </div>

        {/* Example prompt hint */}
        <div className="w-full max-w-2xl mb-8 sm:mb-10">
          <p className="text-gray-400 text-xs mb-1.5">Example:</p>
          <p key={currentExample} className="text-gray-400 text-xs italic leading-relaxed animate-[fadeIn_0.5s_ease-in-out]">
            "{EXAMPLE_PROMPTS[currentExample]}"
          </p>
        </div>

        {/* Character guidance + Continue */}
        <div className="w-full max-w-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-sm">
            {interestsPrompt.trim().length === 0 ? (
              <span className="text-gray-400">Write a few sentences about your interests</span>
            ) : interestsPrompt.trim().length < 40 ? (
              <span className="text-amber-500">Keep going — a bit more detail helps</span>
            ) : (
              <span className="text-indigo-600 font-medium">Looks good!</span>
            )}
          </div>
          <Button
            type="primary"
            size="large"
            onClick={handleComplete}
            loading={isSubmitting}
            disabled={interestsPrompt.trim().length < 20}
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

import React, { useState, useEffect } from "react";
import { Modal, Input, Rate, Button, message } from "antd";
import { StarOutlined } from "@ant-design/icons";
import axiosInstance from "../../lib/axios";

const { TextArea } = Input;

interface TestimonialModalProps {
  open: boolean;
  onCancel: () => void;
  onSuccess: () => void;
}

const TestimonialModal: React.FC<TestimonialModalProps> = ({ open, onCancel, onSuccess }) => {
  const [rating, setRating] = useState(5);
  const [testimonialText, setTestimonialText] = useState("");
  const [loading, setLoading] = useState(false);
  const [fetchingExisting, setFetchingExisting] = useState(false);

  // Fetch existing testimonial when modal opens
  useEffect(() => {
    if (open) {
      fetchExistingTestimonial();
    }
  }, [open]);

  const fetchExistingTestimonial = async () => {
    setFetchingExisting(true);
    try {
      const response = await axiosInstance.get("/testimonials/my-testimonial");
      if (response.data && response.data.rating) {
        setRating(response.data.rating);
        setTestimonialText(response.data.testimonial_text || "");
      } else {
        // Reset to defaults if no existing testimonial
        setRating(5);
        setTestimonialText("");
      }
    } catch (error: any) {
      console.error("Error fetching testimonial:", error);
      // Reset to defaults on error - don't block the user
      setRating(5);
      setTestimonialText("");

      // Only show error if it's not a 404 or "no testimonial" case
      if (error?.response?.status !== 404 && error?.response?.status !== 500) {
        message.info("Starting fresh testimonial");
      }
    } finally {
      setFetchingExisting(false);
    }
  };

  const handleSubmit = async () => {
    if (!testimonialText.trim()) {
      message.warning("Please write your testimonial");
      return;
    }

    if (testimonialText.trim().length < 10) {
      message.warning("Please write at least 10 characters");
      return;
    }

    setLoading(true);
    try {
      const response = await axiosInstance.post("/testimonials/submit", {
        rating,
        testimonial_text: testimonialText.trim(),
      });

      message.success(response.data.message || "Thank you for your testimonial!");
      onSuccess();
      onCancel();
    } catch (error: any) {
      console.error("Error submitting testimonial:", error);
      message.error(error?.response?.data?.detail || "Failed to submit testimonial");
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setRating(5);
    setTestimonialText("");
    onCancel();
  };

  return (
    <Modal
      title={
        <div className="flex items-center gap-2">
          <StarOutlined className="text-yellow-500 text-xl" />
          <span>Leave a Testimonial</span>
        </div>
      }
      open={open}
      onCancel={handleCancel}
      footer={[
        <Button key="cancel" onClick={handleCancel} disabled={loading || fetchingExisting}>
          Cancel
        </Button>,
        <Button
          key="submit"
          type="primary"
          loading={loading}
          disabled={fetchingExisting}
          onClick={handleSubmit}
          className="bg-indigo-600 hover:bg-indigo-700"
        >
          Submit Testimonial
        </Button>,
      ]}
      width={600}
    >
      <div className="space-y-4 py-4">
        {/* Loading State */}
        {fetchingExisting && (
          <div className="text-center py-4">
            <p className="text-gray-500">Loading your testimonial...</p>
          </div>
        )}

        {/* Rating Section */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">How would you rate Daily Academic?</label>
          <div className="flex items-center gap-3">
            <Rate value={rating} onChange={setRating} disabled={loading || fetchingExisting} className="text-2xl" />
            <span className="text-gray-600 font-medium">
              {rating} {rating === 1 ? "star" : "stars"}
            </span>
          </div>
          <div className="mt-2 text-xs text-gray-500">
            {rating === 5 && "⭐ Excellent! Thank you!"}
            {rating === 4 && "⭐ Great! We appreciate your feedback!"}
            {rating === 3 && "⭐ Good! We'd love to hear how we can improve."}
            {rating === 2 && "⭐ We appreciate your honesty. Please tell us what we can do better."}
            {rating === 1 && "⭐ We're sorry to hear that. Your feedback will help us improve."}
          </div>
        </div>

        {/* Testimonial Text */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Your Testimonial <span className="text-red-500">*</span>
          </label>
          <TextArea
            value={testimonialText}
            onChange={e => setTestimonialText(e.target.value)}
            placeholder="Share your experience with Daily Academic... What do you like? How has it helped you? What could be improved?"
            rows={6}
            maxLength={5000}
            showCount
            disabled={loading || fetchingExisting}
            className="rounded-lg"
          />
          <div className="mt-1 text-xs text-gray-500">Minimum 10 characters</div>
        </div>

        {/* Info Message */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <p className="text-sm text-blue-800">
            💙 Your feedback helps us improve Daily Academic for researchers like you. Thank you for taking the time to share your thoughts!
          </p>
        </div>
      </div>
    </Modal>
  );
};

export default TestimonialModal;

import { useEffect } from "react";
import { useParams, useLocation } from "wouter";

export default function CommunityManage() {
  const { id } = useParams();
  const [, setLocation] = useLocation();

  // Use useEffect to redirect during mount, not during render
  useEffect(() => {
    if (id) {
      // Redirect to the regular community detail page with creator view
      // This will show the dark Skool-style interface with creator privileges
      setLocation(`/community/${id}`);
    } else {
      // Fallback if no ID
      setLocation("/communities");
    }
  }, [id, setLocation]);

  return null;
}
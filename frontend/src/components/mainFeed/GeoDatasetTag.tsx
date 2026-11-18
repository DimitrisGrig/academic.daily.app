import { useEffect, useState } from "react";
import { Tag, Tooltip } from "antd";
import { fetchGseIds } from "../../lib/geoApi";
import { DatabaseOutlined } from "@ant-design/icons";

// Simple in-memory cache shared across all instances
const geoCache = new Map<string, boolean>();

interface GeoDatasetTagProps {
  pmid: string | null;
}

/**
 * Lightweight tag that checks the GEO API for linked datasets.
 * Renders nothing while loading, on error, or when no datasets exist.
 */
function GeoDatasetTag({ pmid }: GeoDatasetTagProps) {
  const [hasDataset, setHasDataset] = useState<boolean | null>(null);

  useEffect(() => {
    if (!pmid) return;

    // Check cache first
    if (geoCache.has(pmid)) {
      setHasDataset(geoCache.get(pmid)!);
      return;
    }

    let cancelled = false;

    fetchGseIds(pmid)
      .then(ids => {
        if (cancelled) return;
        const found = ids.length > 0;
        geoCache.set(pmid, found);
        setHasDataset(found);
      })
      .catch(() => {
        if (!cancelled) setHasDataset(false);
      });

    return () => {
      cancelled = true;
    };
  }, [pmid]);

  if (!hasDataset) return null;

  return (
    <Tooltip title="GEO Dataset available">
      <Tag color="purple" className="mr-1!">
        <span className="flex items-center gap-1">
          <DatabaseOutlined />
          GEO Dataset
        </span>
      </Tag>
    </Tooltip>
  );
}

export default GeoDatasetTag;

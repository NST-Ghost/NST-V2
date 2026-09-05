import React from "react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import type { Project } from "@bindings/nst-go/pkg/model";
import type { WorkspaceStats } from "@bindings/nst-go/pkg/storage";

interface StatusbarProps {
  project: Project | null;
  stats: WorkspaceStats | null;
}

export const Statusbar: React.FC<StatusbarProps> = ({ project, stats }) => {
  const percent = stats?.percent || 0;

  return (
    <div className="h-6 bg-[#1f1f1f] border-t border-[#333333] flex items-center justify-between px-3 text-[11px] text-[#909090] select-none z-40">
      {/* Left items: Project name & Engine */}
      <div className="flex items-center gap-2 truncate">
        {project ? (
          <>
            <span className="font-semibold text-white truncate max-w-[200px]">
              {project.name || "Untitled Project"}
            </span>
            <span className="text-[#555555]">·</span>
            <Badge variant="default" className="text-[10px] px-1.5 py-0 h-4 uppercase">
              {project.engine || "Engine"}
            </Badge>
            <span className="text-[#555555]">·</span>
            <span className="text-[#c0c0c0]">
              {project.source_lang || "Source"} → {project.target_lang || "Target"}
            </span>
          </>
        ) : (
          <span className="italic text-[#666666]">No project open</span>
        )}
      </div>

      {/* Right items: Stats & Progress Bar */}
      {project && stats && (
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 font-mono">
            <span className="text-emerald-400 font-medium">
              {stats.translated.toLocaleString()}
            </span>
            <span className="text-[#555555]">/</span>
            <span className="text-white">
              {stats.total.toLocaleString()}
            </span>
            <span className="text-[#777777] ml-1">
              ({percent.toFixed(1)}%)
            </span>
          </div>

          <div className="w-24">
            <Progress value={percent} className="h-1.5" />
          </div>
        </div>
      )}
    </div>
  );
};

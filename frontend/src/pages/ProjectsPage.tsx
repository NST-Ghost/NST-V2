import React, { useEffect, useState } from "react";
import {
  ProjectService,
} from "@bindings/nst-go/cmd/nst-desktop";
import type { ProjectEntry } from "@bindings/nst-go/pkg/registry";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import {
  FolderOpen,
  FileCode,
  MoreVertical,
  Trash2,
  ExternalLink,
  Layers,
  ArrowRight,
  Clock,
} from "lucide-react";

interface ProjectsPageProps {
  onOpenProject: (workspacePath: string) => void;
  onExtractNew: () => void;
  onBrowseWorkspace: () => void;
}

export const ProjectsPage: React.FC<ProjectsPageProps> = ({
  onOpenProject,
  onExtractNew,
  onBrowseWorkspace,
}) => {
  const [projects, setProjects] = useState<ProjectEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const loadProjects = async () => {
    try {
      setLoading(true);
      const list = await ProjectService.List();
      setProjects(list || []);
    } catch (err: any) {
      toast.error(`Failed to load projects: ${err?.message || err}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProjects();
  }, []);

  const handleRemove = async (e: React.MouseEvent, path: string) => {
    e.stopPropagation();
    try {
      await ProjectService.RemoveFromRegistry(path);
      toast.success("Project removed from list");
      loadProjects();
    } catch (err: any) {
      toast.error(`Failed to remove project: ${err?.message || err}`);
    }
  };

  return (
    <div className="flex-1 flex flex-col p-6 overflow-y-auto bg-[#1a1a1a]">
      {/* Page Header */}
      <div className="flex items-center justify-between pb-6 border-b border-[#2e2e2e]">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <Layers className="w-5 h-5 text-[#3399ff]" />
            Translation Projects
          </h1>
          <p className="text-xs text-[#888888] mt-0.5">
            Manage your game translation workspaces and track progress
          </p>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onBrowseWorkspace}
            className="gap-1.5"
          >
            <FileCode className="w-3.5 h-3.5 text-[#3399ff]" />
            Open Workspace…
          </Button>
          <Button
            size="sm"
            onClick={onExtractNew}
            className="gap-1.5 shadow-md shadow-[#3399ff]/20"
          >
            <FolderOpen className="w-3.5 h-3.5" />
            Open Game Folder…
          </Button>
        </div>
      </div>

      {/* Projects Grid or Empty State */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center text-xs text-[#777777]">
          Loading registered projects…
        </div>
      ) : projects.length === 0 ? (
        /* Empty State */
        <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
          <div className="w-16 h-16 rounded-2xl bg-[#242424] border border-[#333333] flex items-center justify-center mb-4 text-[#3399ff] shadow-lg">
            <Layers className="w-8 h-8" />
          </div>
          <h3 className="text-base font-semibold text-white mb-1">
            No projects registered yet
          </h3>
          <p className="text-xs text-[#888888] max-w-sm mb-6">
            Get started by extracting text strings from your game folder or opening an existing .nst workspace file.
          </p>
          <div className="flex gap-3">
            <Button onClick={onExtractNew} className="gap-2">
              <FolderOpen className="w-4 h-4" />
              Open Game Folder…
            </Button>
            <Button
              variant="outline"
              onClick={onBrowseWorkspace}
              className="gap-2"
            >
              <FileCode className="w-4 h-4 text-[#3399ff]" />
              Open Workspace…
            </Button>
          </div>
        </div>
      ) : (
        /* Project Cards */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-6">
          {projects.map((p) => {
            const pct = p.translated_percent || 0;
            return (
              <div
                key={p.file_path}
                onClick={() => onOpenProject(p.file_path)}
                className="group relative bg-[#222222] border border-[#333333] hover:border-[#3399ff]/60 rounded-lg p-4 transition-all duration-200 hover:shadow-lg hover:shadow-black/40 cursor-pointer flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="text-sm font-bold text-white group-hover:text-[#70baff] transition-colors truncate">
                      {p.display_name || "Untitled Game"}
                    </h3>

                    <div className="flex items-center gap-1">
                      <Badge variant="default" className="text-[10px] uppercase">
                        {p.engine_name || "Engine"}
                      </Badge>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-[#777777] hover:text-white"
                          >
                            <MoreVertical className="w-3.5 h-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={(e) => handleRemove(e, p.file_path)}
                            className="text-rose-400 focus:text-rose-300"
                          >
                            <Trash2 className="w-3.5 h-3.5 mr-2" />
                            Remove from List
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>

                  <div className="text-xs text-[#a0a0a0] mb-3 flex items-center gap-1.5">
                    <span>{p.source_lang || "Japanese"}</span>
                    <ArrowRight className="w-3 h-3 text-[#666666]" />
                    <span className="text-white font-medium">
                      {p.target_lang || "Thai"}
                    </span>
                  </div>

                  <div className="text-[11px] text-[#777777] truncate font-mono mb-4" title={p.project_path}>
                    {p.project_path}
                  </div>
                </div>

                <div>
                  {/* Progress info */}
                  <div className="flex items-center justify-between text-xs mb-1.5 font-mono">
                    <span className="text-[#888888]">
                      {(p.translated_entries || 0).toLocaleString()} /{" "}
                      {(p.total_entries || 0).toLocaleString()} lines
                    </span>
                    <span className="font-bold text-emerald-400">
                      {pct.toFixed(1)}%
                    </span>
                  </div>
                  <Progress value={pct} className="h-1.5" />

                  <div className="flex items-center justify-between pt-3 mt-3 border-t border-[#2a2a2a] text-[10px] text-[#666666]">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(p.last_modified).toLocaleDateString()}
                    </span>
                    <span className="group-hover:text-[#3399ff] transition-colors flex items-center gap-1">
                      Open in Editor
                      <ExternalLink className="w-3 h-3" />
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

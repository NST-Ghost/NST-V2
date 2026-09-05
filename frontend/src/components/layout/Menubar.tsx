import React from "react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import {
  FolderOpen,
  FileCode,
  XSquare,
  Settings,
  Languages,
  Rocket,
  GitMerge,
  Share2,
  HelpCircle,
  LayoutGrid,
  Edit3,
} from "lucide-react";

interface MenubarProps {
  hasOpenProject: boolean;
  onOpenGame: () => void;
  onOpenWorkspace: () => void;
  onCloseProject: () => void;
  onOpenSettings: () => void;
  onOpenTranslate: () => void;
  onOpenDeploy: () => void;
  onOpenMerge: () => void;
  onOpenPublish: () => void;
  onOpenAbout: () => void;
  currentRoute: string;
  onNavigate: (route: string) => void;
}

export const Menubar: React.FC<MenubarProps> = ({
  hasOpenProject,
  onOpenGame,
  onOpenWorkspace,
  onCloseProject,
  onOpenSettings,
  onOpenTranslate,
  onOpenDeploy,
  onOpenMerge,
  onOpenPublish,
  onOpenAbout,
  currentRoute,
  onNavigate,
}) => {
  return (
    <div className="h-8 bg-[#222222] border-b border-[#333333] flex items-center px-2 text-xs select-none gap-0.5 z-40">
      {/* Brand logo / tag */}
      <div className="flex items-center gap-1.5 px-2 mr-1 text-[#3399ff] font-bold tracking-wide">
        <span className="w-2 h-2 rounded-full bg-[#3399ff]" />
        NST
      </div>

      {/* File Menu */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-6 px-2 text-xs font-normal">
            File
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem onClick={onOpenGame}>
            <FolderOpen className="w-3.5 h-3.5 mr-2 text-[#3399ff]" />
            Open Game Folder…
            <DropdownMenuShortcut>Ctrl+O</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onOpenWorkspace}>
            <FileCode className="w-3.5 h-3.5 mr-2 text-[#3399ff]" />
            Open Workspace File (.nst)…
            <DropdownMenuShortcut>Ctrl+Shift+O</DropdownMenuShortcut>
          </DropdownMenuItem>
          {hasOpenProject && (
            <DropdownMenuItem onClick={onCloseProject}>
              <XSquare className="w-3.5 h-3.5 mr-2 text-rose-400" />
              Close Project
              <DropdownMenuShortcut>Ctrl+W</DropdownMenuShortcut>
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={onOpenSettings}>
            <Settings className="w-3.5 h-3.5 mr-2 text-[#a0a0a0]" />
            Settings…
            <DropdownMenuShortcut>Ctrl+,</DropdownMenuShortcut>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Translate Menu */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            disabled={!hasOpenProject}
            className="h-6 px-2 text-xs font-normal disabled:opacity-40"
          >
            Translate
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem onClick={onOpenTranslate}>
            <Languages className="w-3.5 h-3.5 mr-2 text-[#3399ff]" />
            Batch Translate with AI…
            <DropdownMenuShortcut>Ctrl+T</DropdownMenuShortcut>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Deploy Menu */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            disabled={!hasOpenProject}
            className="h-6 px-2 text-xs font-normal disabled:opacity-40"
          >
            Deploy
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem onClick={onOpenDeploy}>
            <Rocket className="w-3.5 h-3.5 mr-2 text-amber-400" />
            Deploy to Game…
            <DropdownMenuShortcut>Ctrl+D</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onOpenMerge}>
            <GitMerge className="w-3.5 h-3.5 mr-2 text-emerald-400" />
            Smart Merge: Update Game Version…
            <DropdownMenuShortcut>Ctrl+M</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={onOpenPublish}>
            <Share2 className="w-3.5 h-3.5 mr-2 text-[#3399ff]" />
            Publish Mod to Chanomhub…
            <DropdownMenuShortcut>Ctrl+P</DropdownMenuShortcut>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* View Menu */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-6 px-2 text-xs font-normal">
            View
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem
            onClick={() => onNavigate("/")}
            className={currentRoute === "/" ? "bg-[#2c2c2c] font-semibold" : ""}
          >
            <LayoutGrid className="w-3.5 h-3.5 mr-2 text-[#3399ff]" />
            Projects Library
          </DropdownMenuItem>
          {hasOpenProject && (
            <DropdownMenuItem
              onClick={() => onNavigate("/editor")}
              className={currentRoute === "/editor" ? "bg-[#2c2c2c] font-semibold" : ""}
            >
              <Edit3 className="w-3.5 h-3.5 mr-2 text-emerald-400" />
              Translation Grid Editor
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Help Menu */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-6 px-2 text-xs font-normal">
            Help
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem onClick={onOpenAbout}>
            <HelpCircle className="w-3.5 h-3.5 mr-2 text-[#3399ff]" />
            About NST Ghost…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};

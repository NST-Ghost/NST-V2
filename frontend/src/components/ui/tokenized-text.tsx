import React from "react";

// Regex matching NST masked tags and common RPG Maker / game escape codes
const TOKEN_REGEX = /(__NST_TAG_\d+__|\\[A-Za-z]+\[[^\]]*\]|\\[!><|.^$%\\])/g;

interface TokenizedTextProps {
  text: string;
  className?: string;
  highlightSearch?: string;
}

export const TokenizedText: React.FC<TokenizedTextProps> = ({
  text,
  className = "",
  highlightSearch = "",
}) => {
  if (!text) {
    return <span className="text-[#666666] italic text-xs">(empty)</span>;
  }

  // Split text by tokens while capturing the matches
  const parts = text.split(TOKEN_REGEX);

  return (
    <span className={`font-mono text-xs whitespace-pre-wrap break-words leading-relaxed ${className}`}>
      {parts.map((part, index) => {
        if (!part) return null;

        if (part.startsWith("__NST_TAG_") && part.endsWith("__")) {
          return (
            <span key={index} className="nst-token select-all" title="NST Masked Tag">
              {part}
            </span>
          );
        }

        if (part.startsWith("\\")) {
          return (
            <span key={index} className="nst-escape select-all" title="Game Engine Escape Code">
              {part}
            </span>
          );
        }

        // If search highlight is active
        if (highlightSearch && highlightSearch.trim() !== "") {
          const searchLower = highlightSearch.toLowerCase();
          const partLower = part.toLowerCase();
          const matchIndex = partLower.indexOf(searchLower);

          if (matchIndex !== -1) {
            const before = part.slice(0, matchIndex);
            const match = part.slice(matchIndex, matchIndex + highlightSearch.length);
            const after = part.slice(matchIndex + highlightSearch.length);

            return (
              <React.Fragment key={index}>
                {before}
                <mark className="bg-amber-400/40 text-white rounded-xs px-0.5">{match}</mark>
                {after}
              </React.Fragment>
            );
          }
        }

        // Plain string safely rendered by React
        return <React.Fragment key={index}>{part}</React.Fragment>;
      })}
    </span>
  );
};

import { getCategoryColor, isLightColor } from '../../utils/colorUtils';
import { FaArrowLeftLong, FaArrowRightLong } from 'react-icons/fa6';
import { FaChevronUp, FaChevronDown, FaSearch } from 'react-icons/fa';
import FilterSelect from '../story/FilterSelect';
import React, { useState, useEffect, useMemo, useRef } from 'react';

const LeftSidebar = ({
  stories = [],
  currentStory = null,
  currentChapter = null,
  currentSection = null,
  currentStoryId = null,
  currentChapterId = null,
  currentSectionId = null,
  onStorySelect,
  onChapterSelect,
  onSectionSelect,
  onPrevious,
  onNext,
  onCollapseChange = () => {},
  onAISearch = null,
  onAISummary = null,
  graphData = { nodes: [], links: [] },
  graphDescription = null,
  sectionDescription = null,
  onEntityHighlight = null,
  showSavePositionButton = false,
  onSavePositionClick = null,
  savePositionStatus = null,
  resetPositionStatus = null,
  onResetPositionClick = null,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [topSearchQuery, setTopSearchQuery] = useState('');
  const [bottomQuery, setBottomQuery] = useState('');
  const sidebarRef = useRef(null);
  const [sidebarWidth, setSidebarWidth] = useState(320);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024);
    };

    checkMobile();

    window.addEventListener('resize', checkMobile);

    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    onCollapseChange(isCollapsed);
  }, [isCollapsed, onCollapseChange]);

  useEffect(() => {
    const updateSidebarWidth = () => {
      if (sidebarRef.current) {
        setSidebarWidth(sidebarRef.current.offsetWidth);
      }
    };

    updateSidebarWidth();

    window.addEventListener('resize', updateSidebarWidth);
    return () => window.removeEventListener('resize', updateSidebarWidth);
  }, []);

  const toggleCollapse = () => {
    setIsCollapsed(!isCollapsed);
  };

  const availableChapters = useMemo(() => {
    if (!currentStoryId || !currentStory) return [];
    return (currentStory.chapters || []).map(chapter => ({
      id: chapter.id,
      value: chapter.id,
      label: chapter.title,
      ...chapter
    }));
  }, [currentStoryId, currentStory]);

  const availableSections = useMemo(() => {
    if (!currentChapterId || !currentChapter) return [];
    return (currentChapter.sections || []).map(section => ({
      id: section.id,
      value: section.id,
      label: section.title,
      ...section
    }));
  }, [currentChapterId, currentChapter]);

  const highlightedNodes = useMemo(() => {
    if (!graphData || !graphData.nodes || !currentSectionId) {
      return [];
    }

    return graphData.nodes.filter(node => node.highlight === true);
  }, [graphData, currentSectionId]);

  // Saved list of entity, event, and framework names from the graph. Only these are highlighted in the section description.
  const highlightTermNames = useMemo(() => {
    const nodes = graphData?.nodes || [];
    const allowedTypes = new Set(['entity', 'event', 'framework']);
    const seen = new Set();
    const names = [];
    for (const node of nodes) {
      const type = String(node.node_type || node.type || node.category || '').toLowerCase().trim();
      if (!allowedTypes.has(type)) continue;
      const name = (node.name || node.id || '').toString().trim();
      if (!name) continue;
      const key = name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      names.push(name);
    }
    // Sort by length descending so longer phrases match before shorter substrings
    names.sort((a, b) => b.length - a.length);
    return names;
  }, [graphData]);

  const colors = ['#9B5629', '#2C649D', '#2E7302'];
  const highlightColors = {
    timing: '#6B4C9A',
    event: '#0D7377',
    performer: '#B8860B',
    money: '#C45B2C',
  };

  const badgePillClass = 'inline-flex items-center py-0 px-1.5 mx-[1px] text-[14px] leading-[14px] rounded-[10px] text-white border shadow-sm';

  // No timing/event/performer/money highlights — only entity/event/framework names from highlightTermNames.
  const getTimingEventPerformerSpans = () => [];

  // Split segment into parts: plain text vs special highlights (currently none; only entity badges).
  const splitSegmentByHighlights = (segment) => {
    const spans = getTimingEventPerformerSpans();
    if (spans.length === 0) return [{ type: 'plain', text: segment }];
    const parts = [];
    let last = 0;
    for (const s of spans) {
      if (s.start > last) parts.push({ type: 'plain', text: segment.slice(last, s.start) });
      parts.push({ type: s.type, text: s.text });
      last = s.end;
    }
    if (last < segment.length) parts.push({ type: 'plain', text: segment.slice(last) });
    return parts;
  };

  // Renders a segment with entity terms as clickable badges; used for plain (non-highlight) parts.
  const renderSegmentWithEntityBadges = (segment, terms, keyPrefix) => {
    if (!segment) return [];
    if (!terms || terms.length === 0) return [<span key={`${keyPrefix}-plain`}>{segment}</span>];

    const sortedTerms = [...terms].sort((a, b) => b.length - a.length);
    const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(
      `(${sortedTerms.map(t => (t.includes(' ') ? escapeRegExp(t) : `\\b${escapeRegExp(t)}\\b`)).join('|')})`,
      'gi'
    );
    const used = new Set();
    const parts = segment.split(pattern);

    return parts.map((part, idx) => {
      if (!part) return null;
      const matched = sortedTerms.find(t => t.toLowerCase() === part.toLowerCase());
      if (matched && !used.has(matched.toLowerCase())) {
        used.add(matched.toLowerCase());
        const colorIndex = Array.from(used).length - 1;
        const badgeColor = colors[colorIndex % colors.length];
        return (
          <button
            key={`${keyPrefix}-badge-${idx}-${part}`}
            type="button"
            className={`${badgePillClass} hover:opacity-80 transition-opacity cursor-pointer`}
            style={{ background: badgeColor, borderColor: badgeColor }}
            onClick={() => onEntityHighlight?.(matched)}
            title={`Highlight ${matched} in graph`}
          >
            {part}
          </button>
        );
      }
      return <span key={`${keyPrefix}-text-${idx}`}>{part}</span>;
    }).filter(Boolean);
  };

  // Renders one non-quoted segment: timing/event/performer as colored pills, then plain parts with entity badges.
  const renderSegment = (segment, terms, keyPrefix) => {
    if (!segment) return [];
    const parts = splitSegmentByHighlights(segment);
    const out = [];
    parts.forEach((p, idx) => {
      if (p.type === 'plain') {
        out.push(...renderSegmentWithEntityBadges(p.text, terms, `${keyPrefix}-${idx}`));
      } else {
        const color = highlightColors[p.type] || colors[0];
        out.push(
          <span
            key={`${keyPrefix}-${p.type}-${idx}-${p.text}`}
            className={badgePillClass}
            style={{ background: color, borderColor: color }}
          >
            {p.text}
          </span>
        );
      }
    });
    return out;
  };

  // Only entity, event, framework names (from highlightTermNames) get pills; everything else is plain text.
  const renderBriefWithBadges = (brief, terms) => {
    if (!brief) return null;
    const result = renderSegment(brief, terms, 'brief');
    return result.length === 0 ? null : result;
  };

  
  return (
    <div ref={sidebarRef} className="bg-[#09090B] flex flex-col h-full w-full relative overflow-hidden overflow-x-hidden">
      {}
      {isCollapsed && (
        <div className="lg:hidden p-2 px-3 pb-8 flex-1 text-[#B4B4B4] flex flex-col">
          {}
          {currentSectionId && (
            <div className="mb-1">
              <div className="flex justify-between items-center space-x-1">
                <button
                  onClick={onPrevious}
                  onKeyDown={(e) => e.key === 'Enter' && onPrevious && onPrevious()}
                  className="p-0 text-[#2699FB] text-xs flex items-center nav-link-button"
                  aria-label="Go to previous segment"
                  tabIndex={0}
                >
                  <FaArrowLeftLong className="mr-1" /> Previous
                </button>
                <button
                  onClick={onNext}
                  onKeyDown={(e) => e.key === 'Enter' && onNext && onNext()}
                  className="p-0 text-[#2699FB] text-xs flex items-center nav-link-button"
                  aria-label="Go to next segment"
                  tabIndex={0}
                >
                  Next <FaArrowRightLong className="ml-1" />
                </button>
              </div>
            </div>
          )}

          {}
          {currentSection?.headline && (
            <div className="text-center mb-1">
              <h3 className="text-base font-semibold text-[#B4B4B4] font-headline line-clamp-2">
                {currentSection.headline}
              </h3>
            </div>
          )}
        </div>
      )}

      {}
      <div className={`${isCollapsed ? 'hidden' : 'block'} lg:block p-3 pb-0 flex-1 text-[#B4B4B4] flex flex-col h-full overflow-y-auto overflow-x-hidden`}>
        {}
        <div className="flex items-center gap-2 mb-4 hidden">
          {}
          <div className="flex-shrink-0">
            <svg width="28" height="18" viewBox="0 0 28 18" fill="none" xmlns="http://www.w3.org/2000/svg">
              <g clipPath="url(#clip0_3_4781)">
              <path d="M9.31217 17.1429C7.4704 17.1429 5.66999 16.6402 4.13861 15.6983C2.60723 14.7565 1.41367 13.4178 0.708851 11.8516C0.00403483 10.2854 -0.180377 8.56192 0.178935 6.89923C0.538247 5.23654 1.42515 3.70925 2.72748 2.51052C4.02981 1.31178 5.68908 0.495432 7.49546 0.164701C9.30184 -0.166029 11.1742 0.00371388 12.8758 0.652465C14.5774 1.30122 16.0317 2.39984 17.055 3.8094C18.0782 5.21897 18.6243 6.87616 18.6243 8.57143C18.6217 10.844 17.6397 13.0227 15.8939 14.6296C14.1481 16.2366 11.7811 17.1404 9.31217 17.1429ZM9.31217 1.42858C7.77736 1.42858 6.27702 1.8475 5.00087 2.63236C3.72472 3.41723 2.73008 4.53279 2.14274 5.83798C1.55539 7.14317 1.40171 8.57936 1.70114 9.96493C2.00057 11.3505 2.73965 12.6232 3.82492 13.6222C4.9102 14.6211 6.29293 15.3014 7.79825 15.577C9.30357 15.8527 10.8639 15.7112 12.2819 15.1706C13.6998 14.6299 14.9118 13.7144 15.7645 12.5398C16.6172 11.3652 17.0723 9.98416 17.0723 8.57143C17.0701 6.67767 16.2517 4.86206 14.7969 3.52297C13.3421 2.18387 11.3696 1.43066 9.31217 1.42858Z" fill="#D4D4D4"/>
              </g>
              <g clipPath="url(#clip1_3_4781)">
              <path d="M18.6244 17.1429C16.7827 17.1429 14.9822 16.6402 13.4509 15.6983C11.9195 14.7565 10.7259 13.4178 10.0211 11.8516C9.31629 10.2854 9.13188 8.56192 9.49119 6.89923C9.8505 5.23654 10.7374 3.70925 12.0397 2.51052C13.3421 1.31178 15.0013 0.495432 16.8077 0.164701C18.6141 -0.166029 20.4865 0.00371388 22.188 0.652465C23.8896 1.30122 25.344 2.39984 26.3672 3.8094C27.3904 5.21897 27.9366 6.87616 27.9366 8.57143C27.9339 10.844 26.952 13.0227 25.2062 14.6296C23.4604 16.2366 21.0934 17.1404 18.6244 17.1429ZM18.6244 1.42858C17.0896 1.42858 15.5893 1.8475 14.3131 2.63236C13.037 3.41723 12.0423 4.53279 11.455 5.83798C10.8676 7.14317 10.714 8.57936 11.0134 9.96493C11.3128 11.3505 12.0519 12.6232 13.1372 13.6222C14.2225 14.6211 15.6052 15.3014 17.1105 15.577C18.6158 15.8527 20.1761 15.7112 21.5941 15.1706C23.0121 14.6299 24.2241 13.7144 25.0767 12.5398C25.9294 11.3652 26.3846 9.98416 26.3846 8.57143C26.3823 6.67767 25.564 4.86206 24.1092 3.52297C22.6544 2.18387 20.6819 1.43066 18.6244 1.42858Z" fill="#D4D4D4"/>
              </g>
              <defs>
              <clipPath id="clip0_3_4781">
              <rect width="18.6243" height="17.1429" fill="white"/>
              </clipPath>
              <clipPath id="clip1_3_4781">
              <rect width="18.6243" height="17.1429" fill="white" transform="translate(9.31226)"/>
              </clipPath>
              </defs>
            </svg>
          </div>

          {}
          <div className="relative flex-none order-1 flex-grow">
            <input
              type="text"
              value={topSearchQuery}
              onChange={(e) => setTopSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && topSearchQuery.trim() && onAISearch) {
                  e.preventDefault();
                  onAISearch(topSearchQuery.trim());
                  setTopSearchQuery('');
                }
              }}
              className="w-full pl-2 pr-6 text-[#EFEFF0] bg-[#131315] border border-[#666666]
              rounded-lg text-sm placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-[#434343] h-[27px] rounded-[5px]"
            />
            <button
              onClick={() => {
                if (topSearchQuery.trim() && onAISearch) {
                  onAISearch(topSearchQuery.trim());
                  setTopSearchQuery('');
                }
              }}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-white hover:text-[#2699FB] transition-colors cursor-pointer"
              disabled={!topSearchQuery.trim()}
              title="Search with AI"
            >
              <FaSearch className="text-xs" />
            </button>
          </div>
        </div>

        {}
        <div className="mb-4">
          {}
          <FilterSelect
            label="Story"
            options={stories.map(story => ({
              id: story.id,
              value: story.id,
              label: story.title,
              ...story
            }))}
            selectedValue={currentStoryId}
            onSelect={(storyId, option) => {
              if (onStorySelect) {
                // Pass both storyId and option object (which contains title and full story data)
                onStorySelect(storyId, option);

                if (onChapterSelect) onChapterSelect(null, null);
                if (onSectionSelect) onSectionSelect(null, null);
              }
            }}
            placeholder="Select a Story"
            disabled={stories.length === 0}
            hasChildSelected={!!currentChapterId || !!currentSectionId}
            dropdownWidth={sidebarWidth}
          />

          {}
          <FilterSelect
            label="Chapter"
            options={availableChapters}
            selectedValue={currentChapterId}
            onSelect={(chapterId, option) => {
              if (onChapterSelect) {
                // Pass both chapterId and option object (which contains title and full chapter data)
                onChapterSelect(chapterId, option);
                // Don't clear section here - let handleChapterSelect handle selecting the first section
              }
            }}
            placeholder="Select a Chapter"
            disabled={!currentStoryId || !currentStory || availableChapters.length === 0}
            hasChildSelected={!!currentSectionId}
            dropdownWidth={sidebarWidth}
          />

          {}
          <FilterSelect
            label="Section"
            options={availableSections}
            selectedValue={currentSectionId}
            onSelect={(sectionId, option) => {
              if (onSectionSelect) {
                // Pass both sectionId and option object (which contains title and full section data)
                onSectionSelect(sectionId, option);
              }
            }}
            placeholder="Select a Section"
            disabled={!currentChapterId || !currentChapter || availableSections.length === 0}
            dropdownWidth={sidebarWidth}
          />

          {currentSection && (graphDescription ?? sectionDescription ?? currentSection?.brief) && (
            <div className="pb-4">
              <div
                className="text-[#B4B4B4] mb-3 mt-4 font-normal text-[14px] leading-[18px] tracking-[0px]"
              >
                {renderBriefWithBadges(graphDescription ?? sectionDescription ?? currentSection?.brief ?? '', highlightTermNames)}
              </div>
            </div>
          )}
        </div>
      </div>

        {/* Save / Reset XYZ position - when graph is shown (showSavePositionButton) and at least one handler provided */}
        {showSavePositionButton && (typeof onSavePositionClick === 'function' || typeof onResetPositionClick === 'function') && (
          <div className="pt-3 pl-3 pr-3 flex flex-col gap-2 pb-3 hidden">
            {typeof onSavePositionClick === 'function' && (
              <button
                type="button"
                onClick={onSavePositionClick}
                disabled={savePositionStatus === 'saving'}
                className="w-full px-3 py-2 rounded-[5px] text-sm font-medium border border-[#666666] bg-[#131315] text-[#EFEFF0] hover:bg-[#1a1a1a] hover:border-[#71717A] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                title="Save current camera position to restore next time you sign in"
              >
                {savePositionStatus === 'saving' ? 'Saving…' : savePositionStatus === 'saved' ? 'Saved' : savePositionStatus === 'error' ? 'Error' : 'Save XYZ position'}
              </button>
            )}
            {typeof onResetPositionClick === 'function' && (
              <button
                type="button"
                onClick={onResetPositionClick}
                disabled={resetPositionStatus === 'resetting'}
                className="w-full px-3 py-2 rounded-[5px] text-sm font-medium border border-[#666666] bg-[#131315] text-[#EFEFF0] hover:bg-[#1a1a1a] hover:border-[#71717A] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                title="Reset camera to initial view"
              >
                {resetPositionStatus === 'resetting' ? 'Resetting…' : resetPositionStatus === 'reset' ? 'Reset' : 'Reset XYZ position'}
              </button>
            )}
          </div>
        )}
      {}
      <div className={`mt-auto pb-3 px-3`}>
        {}
        {currentSectionId && (
          <div className="mb-4">
            <div className="flex justify-between items-center">
              <button
                onClick={onPrevious}
                onKeyDown={(e) => e.key === 'Enter' && onPrevious && onPrevious()}
                className="p-0 text-[#6EA4F4] text-sm flex items-center hover:opacity-80 transition-opacity drop-shadow-[0_0_4px_rgba(110,164,244,0.5)]"
                aria-label="Go to previous segment"
                tabIndex={0}
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M11.0833 7L2.91659 7" stroke="#9F9FA9" strokeWidth="1.16667" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M7 11.0833L2.91667 6.99998L7 2.91665" stroke="#9F9FA9" strokeWidth="1.16667" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Previous
              </button>
              <button
                onClick={onNext}
                onKeyDown={(e) => e.key === 'Enter' && onNext && onNext()}
                className="p-0 text-[#6EA4F4] text-sm flex items-center hover:opacity-80 transition-opacity drop-shadow-[0_0_4px_rgba(110,164,244,0.5)]"
                aria-label="Go to next segment"
                tabIndex={0}
              >
                Next
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M2.91675 7H11.0834" stroke="#9F9FA9" strokeWidth="1.16667" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M7 2.91669L11.0833 7.00002L7 11.0834" stroke="#9F9FA9" strokeWidth="1.16667" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* Bottom Ask AI Section */}
        <div className="w-full relative hidden">
          <textarea
            value={bottomQuery}
            onChange={(e) => setBottomQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && bottomQuery.trim() && onAISummary) {
                e.preventDefault();
                onAISummary(bottomQuery.trim());
                setBottomQuery('');
              }
            }}
            placeholder="Ask AI about this graph..."
            rows={3}
            className="w-full py-2 pl-3 pr-10 text-[#EFEFF0] bg-[#131315] border border-[#666666]
            rounded-[5px] text-sm placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-[#434343] resize-none"
          />
          <button
            onClick={() => {
              if (bottomQuery.trim() && onAISummary) {
                onAISummary(bottomQuery.trim());
                setBottomQuery('');
              }
            }}
            disabled={!bottomQuery.trim()}
            className="absolute right-3 top-3 text-white hover:text-[#2699FB] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Ask AI about this graph"
          >
            <FaSearch size={14} />
          </button>
        </div>
      </div>

      {}
      <div className="mt-auto flex-shrink-0 pt-2 pb-8 lg:pb-2 px-3 text-center text-xs text-[#71717A]">
        © 2026 INVINQ Inc
      </div>
      <div className="lg:hidden absolute bottom-0 left-0 right-0 flex justify-center z-10">
        <button
          onClick={toggleCollapse}
          className="text-white bg-transparent rounded-full p-0 hover:bg-[#333333]"
          aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {isCollapsed ? <FaChevronDown size={14} /> : <FaChevronUp size={14} />}
        </button>
      </div>
    </div>
  );
};

export default React.memo(LeftSidebar);

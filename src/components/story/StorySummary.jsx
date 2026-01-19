import PropTypes from 'prop-types';

const StorySummary = ({
  storyHeadline = '',
  storyBrief = '',
  substoryHeadline = '',
  substoryBrief = '',
  chapterHeadline = '',
  chapterBrief = '',
  importantEntities = []
}) => {
  return (
    <div className="space-y-3">
      {}
      {importantEntities && importantEntities.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {importantEntities.slice(0, 3).map((name, idx) => (
            <button
              key={idx}
              className="px-2 py-1 text-[10px] font-semibold rounded-[12px] bg-[#13345C] text-white border border-[#1F4B7D] shadow-sm"
            >
              {name}
            </button>
          ))}
        </div>
      )}
      {}
      {storyHeadline && (
        <div className="mb-2">
          <h2 className="text-xl font-bold text-[#B4B4B4] font-headline">
            {storyHeadline}
          </h2>
        </div>
      )}

      {}
      {storyBrief && (
        <div className="mb-3">
          <h3 className="text-lg font-semibold mb-1 text-[#B4B4B4] font-headline">Story Summary</h3>
          <p className="text-xs text-[#B4B4B4]">
            {storyBrief}
          </p>
        </div>
      )}

      {}
      {chapterBrief && (
        <div className="mb-3">
          <h3 className="text-base font-semibold mb-1 text-[#B4B4B4] font-headline">
            {chapterHeadline || 'Chapter Summary'}
          </h3>
          <p className="text-xs text-[#B4B4B4]">
            {chapterBrief}
          </p>
        </div>
      )}

      {}
      {substoryBrief && (
        <div>
          <h3 className="text-base font-semibold mb-1 text-[#B4B4B4] font-headline">
            {substoryHeadline || 'Substory Summary'}
          </h3>
          <p className="text-xs text-[#B4B4B4]">
            {substoryBrief}
          </p>
        </div>
      )}
    </div>
  );
};

StorySummary.propTypes = {
  storyHeadline: PropTypes.string,
  storyBrief: PropTypes.string,
  substoryHeadline: PropTypes.string,
  substoryBrief: PropTypes.string,
  chapterHeadline: PropTypes.string,
  chapterBrief: PropTypes.string,
  importantEntities: PropTypes.arrayOf(PropTypes.string)
};

export default StorySummary;

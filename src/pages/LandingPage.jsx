import { useNavigate } from 'react-router-dom';
import Header from '../components/layout/Header';
import CombinedStoryDropdown from '../components/story/CombinedStoryDropdown';
import useGraphData from '../hooks/useGraphData';

const LandingPage = () => {
  const navigate = useNavigate();

  const {
    stories
  } = useGraphData();

  return (
    <div className="flex flex-col min-h-screen bg-black text-white">
      {}
      <Header showStoryDropdown={false} usePlainLogo={true} />

      {}
      <main className="flex-1 flex flex-col items-center justify-center">
        {}
        <div className="mb-4 lg:mb-8">
          <img
            src="/logo/logo-with-text.png"
            alt="Invisible Injury Logo"
            className="h-8 object-contain"
          />
        </div>

        {}
        <div className="w-64">
          <CombinedStoryDropdown
            stories={stories}
            onOptionSelect={(option) => {
              if (option && option.storyId && option.chapterId && option.substoryId) {
                navigate(`/graph?story=${option.storyId}&chapter=${option.chapterId}&substory=${option.substoryId}`);
              }
            }}
            inHeader={false}
            placeholder="Select an Investigation"
          />
        </div>
      </main>
    </div>
  );
};

export default LandingPage;
